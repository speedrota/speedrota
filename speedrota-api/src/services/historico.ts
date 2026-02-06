/**
 * @fileoverview Serviço de Histórico de Rotas
 *
 * DESIGN POR CONTRATO:
 * @description Gerencia histórico de rotas com filtros, agregações e exports
 * @pre Usuário autenticado com rotas existentes
 * @post Retorna dados históricos paginados e/ou exportados
 * @invariant Dados pertencem ao usuário autenticado
 *
 * FUNCIONALIDADES:
 * - Listar rotas com filtros (data, fornecedor, status)
 * - Resumo agregado por período
 * - Exportar para PDF
 * - Exportar para Excel
 */

import { StatusRota, Prioridade } from '@prisma/client';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { Readable, PassThrough } from 'stream';
import { prisma } from '../lib/prisma';

// ==========================================
// INTERFACES
// ==========================================

/**
 * Filtros para busca de histórico
 * @pre dataInicio <= dataFim se ambos informados
 * @pre pagina >= 1, limite >= 1 e <= 100
 */
export interface FiltrosHistorico {
  dataInicio?: Date;
  dataFim?: Date;
  fornecedor?: string;
  status?: StatusRota;
  pagina?: number;
  limite?: number;
  ordenarPor?: 'data' | 'distancia' | 'entregas' | 'custo';
  ordem?: 'asc' | 'desc';
}

/**
 * Rota resumida para listagem
 */
export interface RotaHistorico {
  id: string;
  data: Date;
  origemEndereco: string;
  totalParadas: number;
  entregasRealizadas: number;
  entregasFalhas: number;
  distanciaKm: number;
  tempoMin: number;
  custoR: number;
  status: StatusRota;
  fornecedores: string[];
}

/**
 * Resumo agregado do período
 */
export interface ResumoHistorico {
  periodo: {
    inicio: Date;
    fim: Date;
    dias: number;
  };
  totais: {
    rotas: number;
    paradas: number;
    entregasRealizadas: number;
    entregasFalhas: number;
    taxaSucesso: number; // 0-100%
  };
  distancia: {
    totalKm: number;
    mediaKm: number;
  };
  tempo: {
    totalMin: number;
    mediaMin: number;
  };
  custo: {
    totalR: number;
    mediaR: number;
    combustivelL: number;
  };
  fornecedores: {
    nome: string;
    entregas: number;
    percentual: number;
  }[];
  porDia: {
    data: string;
    rotas: number;
    entregas: number;
    km: number;
  }[];
}

/**
 * Resultado paginado do histórico
 */
export interface ResultadoHistorico {
  rotas: RotaHistorico[];
  resumo: ResumoHistorico;
  paginacao: {
    pagina: number;
    limite: number;
    total: number;
    totalPaginas: number;
  };
}

// ==========================================
// FUNÇÕES PRINCIPAIS
// ==========================================

/**
 * Busca histórico de rotas com filtros e paginação
 *
 * @description Retorna rotas finalizadas do usuário com métricas
 * @pre userId válido, filtros dentro dos limites
 * @post Retorna lista paginada + resumo agregado
 * @throws Error se userId não encontrado
 */
export async function buscarHistorico(
  userId: string,
  filtros: FiltrosHistorico = {}
): Promise<ResultadoHistorico> {
  // Validar e normalizar filtros
  const pagina = Math.max(1, filtros.pagina || 1);
  const limite = Math.min(100, Math.max(1, filtros.limite || 20));
  const ordenarPor = filtros.ordenarPor || 'data';
  const ordem = filtros.ordem || 'desc';

  // Definir período padrão (últimos 30 dias)
  const dataFim = filtros.dataFim || new Date();
  const dataInicio = filtros.dataInicio || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Construir where clause
  const where: any = {
    userId,
    createdAt: {
      gte: dataInicio,
      lte: dataFim,
    },
    status: {
      in: [StatusRota.FINALIZADA, StatusRota.CANCELADA],
    },
  };

  // Filtro por status específico
  if (filtros.status) {
    where.status = filtros.status;
  }

  // Buscar rotas com paradas
  const [rotas, total] = await Promise.all([
    prisma.rota.findMany({
      where,
      include: {
        paradas: {
          select: {
            id: true,
            fornecedor: true,
            statusEntrega: true,
          },
        },
      },
      orderBy: getOrderBy(ordenarPor, ordem),
      skip: (pagina - 1) * limite,
      take: limite,
    }),
    prisma.rota.count({ where }),
  ]);

  // Filtrar por fornecedor (pós-query porque é em paradas)
  let rotasFiltradas = rotas;
  if (filtros.fornecedor) {
    rotasFiltradas = rotas.filter((rota) =>
      rota.paradas.some((p) => p.fornecedor === filtros.fornecedor)
    );
  }

  // Transformar em RotaHistorico
  const rotasHistorico: RotaHistorico[] = rotasFiltradas.map((rota) => ({
    id: rota.id,
    data: rota.createdAt,
    origemEndereco: rota.origemEndereco,
    totalParadas: rota.paradas.length,
    entregasRealizadas: rota.entregasRealizadas || 0,
    entregasFalhas: rota.entregasFalhas || 0,
    distanciaKm: rota.distanciaTotalKm || 0,
    tempoMin: (rota.tempoViagemMin || 0) + (rota.tempoEntregasMin || 0),
    custoR: rota.custoR || 0,
    status: rota.status,
    fornecedores: [...new Set(rota.paradas.map((p) => p.fornecedor))],
  }));

  // Calcular resumo
  const resumo = await calcularResumo(userId, dataInicio, dataFim, filtros.fornecedor);

  return {
    rotas: rotasHistorico,
    resumo,
    paginacao: {
      pagina,
      limite,
      total,
      totalPaginas: Math.ceil(total / limite),
    },
  };
}

/**
 * Calcula resumo agregado do período
 *
 * @pre Datas válidas, dataInicio <= dataFim
 * @post Retorna métricas agregadas do período
 */
export async function calcularResumo(
  userId: string,
  dataInicio: Date,
  dataFim: Date,
  fornecedor?: string
): Promise<ResumoHistorico> {
  // Buscar todas as rotas do período
  const rotas = await prisma.rota.findMany({
    where: {
      userId,
      createdAt: {
        gte: dataInicio,
        lte: dataFim,
      },
      status: {
        in: [StatusRota.FINALIZADA, StatusRota.CANCELADA],
      },
    },
    include: {
      paradas: {
        select: {
          fornecedor: true,
          statusEntrega: true,
        },
      },
    },
  });

  // Filtrar por fornecedor se especificado
  const rotasFiltradas = fornecedor
    ? rotas.filter((r) => r.paradas.some((p) => p.fornecedor === fornecedor))
    : rotas;

  // Calcular totais
  const totalParadas = rotasFiltradas.reduce((sum, r) => sum + r.paradas.length, 0);
  const entregasRealizadas = rotasFiltradas.reduce(
    (sum, r) => sum + (r.entregasRealizadas || 0),
    0
  );
  const entregasFalhas = rotasFiltradas.reduce((sum, r) => sum + (r.entregasFalhas || 0), 0);
  const totalKm = rotasFiltradas.reduce((sum, r) => sum + (r.distanciaTotalKm || 0), 0);
  const totalMin = rotasFiltradas.reduce(
    (sum, r) => sum + (r.tempoViagemMin || 0) + (r.tempoEntregasMin || 0),
    0
  );
  const totalCusto = rotasFiltradas.reduce((sum, r) => sum + (r.custoR || 0), 0);
  const totalCombustivel = rotasFiltradas.reduce((sum, r) => sum + (r.combustivelL || 0), 0);

  // Contar por fornecedor
  const fornecedoresMap = new Map<string, number>();
  rotasFiltradas.forEach((rota) => {
    rota.paradas.forEach((parada) => {
      const count = fornecedoresMap.get(parada.fornecedor) || 0;
      fornecedoresMap.set(parada.fornecedor, count + 1);
    });
  });

  const fornecedores = Array.from(fornecedoresMap.entries())
    .map(([nome, entregas]) => ({
      nome,
      entregas,
      percentual: totalParadas > 0 ? Math.round((entregas / totalParadas) * 100) : 0,
    }))
    .sort((a, b) => b.entregas - a.entregas);

  // Agrupar por dia
  const porDiaMap = new Map<string, { rotas: number; entregas: number; km: number }>();
  rotasFiltradas.forEach((rota) => {
    const data = rota.createdAt.toISOString().split('T')[0];
    const atual = porDiaMap.get(data) || { rotas: 0, entregas: 0, km: 0 };
    porDiaMap.set(data, {
      rotas: atual.rotas + 1,
      entregas: atual.entregas + (rota.entregasRealizadas || 0),
      km: atual.km + (rota.distanciaTotalKm || 0),
    });
  });

  const porDia = Array.from(porDiaMap.entries())
    .map(([data, valores]) => ({
      data,
      ...valores,
    }))
    .sort((a, b) => a.data.localeCompare(b.data));

  // Calcular dias no período
  const dias = Math.ceil((dataFim.getTime() - dataInicio.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  return {
    periodo: {
      inicio: dataInicio,
      fim: dataFim,
      dias,
    },
    totais: {
      rotas: rotasFiltradas.length,
      paradas: totalParadas,
      entregasRealizadas,
      entregasFalhas,
      taxaSucesso:
        totalParadas > 0 ? Math.round((entregasRealizadas / totalParadas) * 100) : 0,
    },
    distancia: {
      totalKm: Math.round(totalKm * 10) / 10,
      mediaKm: rotasFiltradas.length > 0 ? Math.round((totalKm / rotasFiltradas.length) * 10) / 10 : 0,
    },
    tempo: {
      totalMin: Math.round(totalMin),
      mediaMin: rotasFiltradas.length > 0 ? Math.round(totalMin / rotasFiltradas.length) : 0,
    },
    custo: {
      totalR: Math.round(totalCusto * 100) / 100,
      mediaR: rotasFiltradas.length > 0 ? Math.round((totalCusto / rotasFiltradas.length) * 100) / 100 : 0,
      combustivelL: Math.round(totalCombustivel * 10) / 10,
    },
    fornecedores,
    porDia,
  };
}

// ==========================================
// EXPORTAÇÃO PDF
// ==========================================

/**
 * Gera PDF do relatório de histórico
 *
 * @description Cria PDF formatado com resumo e lista de rotas
 * @pre userId válido, período <= 90 dias
 * @post Retorna stream do PDF gerado
 * @invariant PDF em formato A4, português BR
 */
export async function gerarPDF(
  userId: string,
  filtros: FiltrosHistorico
): Promise<PassThrough> {
  const resultado = await buscarHistorico(userId, { ...filtros, limite: 1000 });
  const { resumo, rotas } = resultado;

  // Criar documento PDF
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: 'Relatório de Entregas - SpeedRota',
      Author: 'SpeedRota',
      Subject: 'Histórico de Rotas e Entregas',
    },
  });

  // Stream para retornar
  const stream = new PassThrough();
  doc.pipe(stream);

  // ===== CABEÇALHO =====
  doc
    .fontSize(24)
    .fillColor('#2563eb')
    .text('SpeedRota', { align: 'center' })
    .fontSize(16)
    .fillColor('#374151')
    .text('Relatório de Entregas', { align: 'center' })
    .moveDown(0.5);

  // Período
  const dataInicioStr = resumo.periodo.inicio.toLocaleDateString('pt-BR');
  const dataFimStr = resumo.periodo.fim.toLocaleDateString('pt-BR');
  doc
    .fontSize(12)
    .fillColor('#6b7280')
    .text(`Período: ${dataInicioStr} a ${dataFimStr}`, { align: 'center' })
    .moveDown(1.5);

  // ===== RESUMO =====
  doc
    .fontSize(16)
    .fillColor('#1f2937')
    .text('Resumo do Período', { underline: true })
    .moveDown(0.5);

  // Grid de métricas
  const metricas = [
    { label: 'Total de Rotas', valor: resumo.totais.rotas.toString() },
    { label: 'Total de Entregas', valor: resumo.totais.paradas.toString() },
    { label: 'Entregas Realizadas', valor: resumo.totais.entregasRealizadas.toString() },
    { label: 'Taxa de Sucesso', valor: `${resumo.totais.taxaSucesso}%` },
    { label: 'Distância Total', valor: `${resumo.distancia.totalKm} km` },
    { label: 'Tempo Total', valor: formatarTempo(resumo.tempo.totalMin) },
    { label: 'Custo Total', valor: `R$ ${resumo.custo.totalR.toFixed(2)}` },
    { label: 'Combustível', valor: `${resumo.custo.combustivelL} L` },
  ];

  doc.fontSize(11).fillColor('#374151');
  metricas.forEach((m, i) => {
    const x = i % 2 === 0 ? 50 : 300;
    if (i % 2 === 0 && i > 0) doc.moveDown(0.3);
    doc.text(`${m.label}: ${m.valor}`, x, undefined, { continued: i % 2 === 0 });
  });

  doc.moveDown(1.5);

  // ===== FORNECEDORES =====
  if (resumo.fornecedores.length > 0) {
    doc
      .fontSize(14)
      .fillColor('#1f2937')
      .text('Por Fornecedor', { underline: true })
      .moveDown(0.5);

    doc.fontSize(10).fillColor('#374151');
    resumo.fornecedores.slice(0, 5).forEach((f) => {
      doc.text(`• ${f.nome}: ${f.entregas} entregas (${f.percentual}%)`);
    });
    doc.moveDown(1);
  }

  // ===== LISTA DE ROTAS =====
  doc
    .fontSize(14)
    .fillColor('#1f2937')
    .text('Detalhamento das Rotas', { underline: true })
    .moveDown(0.5);

  // Cabeçalho da tabela
  const tableTop = doc.y;
  const tableHeaders = ['Data', 'Origem', 'Entregas', 'Km', 'Tempo', 'Custo'];
  const colWidths = [60, 150, 60, 50, 50, 60];
  let xPos = 50;

  doc.fontSize(9).fillColor('#6b7280');
  tableHeaders.forEach((header, i) => {
    doc.text(header, xPos, tableTop, { width: colWidths[i] });
    xPos += colWidths[i];
  });

  doc.moveDown(0.3);

  // Linhas da tabela
  doc.fillColor('#374151');
  rotas.slice(0, 50).forEach((rota, index) => {
    if (doc.y > 750) {
      doc.addPage();
    }

    xPos = 50;
    const y = doc.y;
    const rowData = [
      rota.data.toLocaleDateString('pt-BR'),
      rota.origemEndereco.substring(0, 25) + (rota.origemEndereco.length > 25 ? '...' : ''),
      `${rota.entregasRealizadas}/${rota.totalParadas}`,
      `${rota.distanciaKm.toFixed(1)}`,
      formatarTempo(rota.tempoMin),
      `R$ ${rota.custoR.toFixed(2)}`,
    ];

    rowData.forEach((cell, i) => {
      doc.text(cell, xPos, y, { width: colWidths[i] });
      xPos += colWidths[i];
    });

    doc.moveDown(0.2);
  });

  // ===== RODAPÉ =====
  doc
    .fontSize(8)
    .fillColor('#9ca3af')
    .text(
      `Gerado em ${new Date().toLocaleString('pt-BR')} - SpeedRota`,
      50,
      780,
      { align: 'center' }
    );

  doc.end();
  return stream;
}

// ==========================================
// EXPORTAÇÃO EXCEL
// ==========================================

/**
 * Gera Excel do histórico de rotas
 *
 * @description Cria planilha Excel com dados tabulares
 * @pre userId válido
 * @post Retorna buffer do Excel gerado
 * @invariant Formato xlsx compatível com Excel/Google Sheets
 */
export async function gerarExcel(
  userId: string,
  filtros: FiltrosHistorico
): Promise<Buffer> {
  const resultado = await buscarHistorico(userId, { ...filtros, limite: 10000 });
  const { resumo, rotas } = resultado;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SpeedRota';
  workbook.created = new Date();

  // ===== ABA RESUMO =====
  const resumoSheet = workbook.addWorksheet('Resumo', {
    properties: { tabColor: { argb: '2563EB' } },
  });

  // Cabeçalho
  resumoSheet.mergeCells('A1:D1');
  resumoSheet.getCell('A1').value = 'SpeedRota - Relatório de Entregas';
  resumoSheet.getCell('A1').font = { size: 18, bold: true, color: { argb: '2563EB' } };
  resumoSheet.getCell('A1').alignment = { horizontal: 'center' };

  // Período
  resumoSheet.getCell('A3').value = 'Período:';
  resumoSheet.getCell('B3').value = `${resumo.periodo.inicio.toLocaleDateString('pt-BR')} a ${resumo.periodo.fim.toLocaleDateString('pt-BR')}`;
  resumoSheet.getCell('A3').font = { bold: true };

  // Métricas
  const metricasData = [
    ['Métrica', 'Valor'],
    ['Total de Rotas', resumo.totais.rotas],
    ['Total de Entregas', resumo.totais.paradas],
    ['Entregas Realizadas', resumo.totais.entregasRealizadas],
    ['Entregas com Falha', resumo.totais.entregasFalhas],
    ['Taxa de Sucesso (%)', resumo.totais.taxaSucesso],
    ['Distância Total (km)', resumo.distancia.totalKm],
    ['Distância Média (km)', resumo.distancia.mediaKm],
    ['Tempo Total (min)', resumo.tempo.totalMin],
    ['Tempo Médio (min)', resumo.tempo.mediaMin],
    ['Custo Total (R$)', resumo.custo.totalR],
    ['Custo Médio (R$)', resumo.custo.mediaR],
    ['Combustível (L)', resumo.custo.combustivelL],
  ];

  metricasData.forEach((row, index) => {
    const rowNum = 5 + index;
    resumoSheet.getRow(rowNum).values = row;
    if (index === 0) {
      resumoSheet.getRow(rowNum).font = { bold: true };
      resumoSheet.getRow(rowNum).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'E5E7EB' },
      };
    }
  });

  // Ajustar largura das colunas
  resumoSheet.getColumn('A').width = 25;
  resumoSheet.getColumn('B').width = 20;

  // ===== ABA ROTAS =====
  const rotasSheet = workbook.addWorksheet('Rotas', {
    properties: { tabColor: { argb: '22C55E' } },
  });

  // Cabeçalhos
  rotasSheet.columns = [
    { header: 'ID', key: 'id', width: 36 },
    { header: 'Data', key: 'data', width: 12 },
    { header: 'Origem', key: 'origem', width: 40 },
    { header: 'Total Paradas', key: 'totalParadas', width: 14 },
    { header: 'Entregas OK', key: 'entregasOk', width: 12 },
    { header: 'Falhas', key: 'falhas', width: 10 },
    { header: 'Distância (km)', key: 'distancia', width: 14 },
    { header: 'Tempo (min)', key: 'tempo', width: 12 },
    { header: 'Custo (R$)', key: 'custo', width: 12 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Fornecedores', key: 'fornecedores', width: 30 },
  ];

  // Estilizar cabeçalho
  rotasSheet.getRow(1).font = { bold: true };
  rotasSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '22C55E' },
  };
  rotasSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };

  // Dados
  rotas.forEach((rota) => {
    rotasSheet.addRow({
      id: rota.id,
      data: rota.data.toLocaleDateString('pt-BR'),
      origem: rota.origemEndereco,
      totalParadas: rota.totalParadas,
      entregasOk: rota.entregasRealizadas,
      falhas: rota.entregasFalhas,
      distancia: rota.distanciaKm,
      tempo: rota.tempoMin,
      custo: rota.custoR,
      status: rota.status,
      fornecedores: rota.fornecedores.join(', '),
    });
  });

  // ===== ABA POR DIA =====
  const diaSheet = workbook.addWorksheet('Por Dia', {
    properties: { tabColor: { argb: 'F59E0B' } },
  });

  diaSheet.columns = [
    { header: 'Data', key: 'data', width: 12 },
    { header: 'Rotas', key: 'rotas', width: 10 },
    { header: 'Entregas', key: 'entregas', width: 12 },
    { header: 'Km', key: 'km', width: 12 },
  ];

  diaSheet.getRow(1).font = { bold: true };
  diaSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'F59E0B' },
  };
  diaSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };

  resumo.porDia.forEach((dia) => {
    diaSheet.addRow({
      data: dia.data,
      rotas: dia.rotas,
      entregas: dia.entregas,
      km: Math.round(dia.km * 10) / 10,
    });
  });

  // ===== ABA FORNECEDORES =====
  const fornSheet = workbook.addWorksheet('Fornecedores', {
    properties: { tabColor: { argb: '8B5CF6' } },
  });

  fornSheet.columns = [
    { header: 'Fornecedor', key: 'nome', width: 20 },
    { header: 'Entregas', key: 'entregas', width: 12 },
    { header: '% do Total', key: 'percentual', width: 12 },
  ];

  fornSheet.getRow(1).font = { bold: true };
  fornSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '8B5CF6' },
  };
  fornSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };

  resumo.fornecedores.forEach((f) => {
    fornSheet.addRow({
      nome: f.nome,
      entregas: f.entregas,
      percentual: f.percentual,
    });
  });

  // Gerar buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as Buffer;
}

// ==========================================
// HELPERS
// ==========================================

function getOrderBy(
  campo: string,
  ordem: 'asc' | 'desc'
): { [key: string]: 'asc' | 'desc' } {
  const mapping: { [key: string]: string } = {
    data: 'createdAt',
    distancia: 'distanciaTotalKm',
    entregas: 'entregasRealizadas',
    custo: 'custoR',
  };
  return { [mapping[campo] || 'createdAt']: ordem };
}

function formatarTempo(minutos: number): string {
  if (minutos < 60) {
    return `${Math.round(minutos)}min`;
  }
  const horas = Math.floor(minutos / 60);
  const mins = Math.round(minutos % 60);
  return `${horas}h${mins}m`;
}

// ==========================================
// EXPORTS
// ==========================================

export default {
  buscarHistorico,
  calcularResumo,
  gerarPDF,
  gerarExcel,
};
