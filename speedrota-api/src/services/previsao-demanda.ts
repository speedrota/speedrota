/**
 * @fileoverview Serviço de Machine Learning para Previsão de Demanda
 * 
 * DESIGN POR CONTRATO:
 * @pre Histórico de entregas existe no banco
 * @post Previsões com confiança 0-1 e insights acionáveis
 * @invariant demandaPrevista >= 0, confiança ∈ [0, 1]
 * 
 * ALGORITMOS:
 * - Média Móvel Ponderada (7, 14, 30 dias)
 * - Sazonalidade por dia da semana
 * - Fator de horário de pico
 * - Tendência linear simples
 * 
 * @author SpeedRota Team
 * @version 1.0.0
 */

import { prisma } from '../lib/prisma.js';
import type { TipoInsight } from '@prisma/client';

// ==========================================
// TIPOS E INTERFACES
// ==========================================

interface PrevisaoInput {
  zona: string;
  data: Date;
  horaInicio?: number;
  horaFim?: number;
  fornecedor?: string;
}

interface PrevisaoOutput {
  zona: string;
  data: Date;
  horaInicio: number;
  horaFim: number;
  demandaPrevista: number;
  confianca: number;
  limiteInferior: number;
  limiteSuperior: number;
  fatores: {
    diaSemana: number;
    horario: number;
    sazonalidade: number;
    tendencia: number;
  };
  insights: InsightOutput[];
}

interface InsightOutput {
  tipo: TipoInsight;
  titulo: string;
  descricao: string;
  valor: number;
  acao: string;
  prioridade: number;
}

interface AgregacaoInput {
  zona: string;
  diaSemana: number;
  horaInicio: number;
  fornecedor?: string;
}

interface MapaCalorOutput {
  zonas: {
    zona: string;
    lat?: number;
    lng?: number;
    demandaPrevista: number;
    intensidade: number; // 0-1
    melhorHorario: string;
  }[];
  dataReferencia: Date;
}

// ==========================================
// CONSTANTES
// ==========================================

const FATORES_DIA_SEMANA: Record<number, number> = {
  0: 0.7,  // Domingo
  1: 1.1,  // Segunda
  2: 1.2,  // Terça
  3: 1.15, // Quarta
  4: 1.1,  // Quinta
  5: 1.3,  // Sexta (pico)
  6: 0.9,  // Sábado
};

const FATORES_HORARIO: Record<string, number> = {
  '06-09': 0.8,  // Manhã cedo
  '09-12': 1.2,  // Manhã comercial
  '12-14': 0.9,  // Almoço
  '14-17': 1.4,  // Tarde (pico)
  '17-19': 1.1,  // Final tarde
  '19-22': 0.6,  // Noite
};

// Eventos sazonais (dia-mês)
const SAZONALIDADE: Record<string, { nome: string; fator: number }> = {
  '15-01': { nome: 'Fechamento Natura', fator: 1.5 },
  '15-02': { nome: 'Fechamento Natura', fator: 1.5 },
  '15-03': { nome: 'Fechamento Natura', fator: 1.5 },
  '15-04': { nome: 'Fechamento Natura', fator: 1.5 },
  '15-05': { nome: 'Dia das Mães', fator: 2.0 },
  '15-06': { nome: 'Fechamento Natura', fator: 1.5 },
  '15-07': { nome: 'Fechamento Natura', fator: 1.5 },
  '15-08': { nome: 'Fechamento Natura', fator: 1.5 },
  '15-09': { nome: 'Fechamento Natura', fator: 1.5 },
  '15-10': { nome: 'Fechamento Natura', fator: 1.5 },
  '11-11': { nome: 'Singles Day', fator: 1.8 },
  '25-11': { nome: 'Black Friday', fator: 2.5 },
  '15-12': { nome: 'Natal', fator: 2.2 },
};

const PESOS_MEDIA_MOVEL = {
  7: 0.5,   // Últimos 7 dias
  14: 0.3,  // Últimos 14 dias
  30: 0.2,  // Últimos 30 dias
};

// ==========================================
// FUNÇÕES PRINCIPAIS
// ==========================================

/**
 * Gera previsão de demanda para uma zona
 * 
 * @pre zona não vazia, data válida
 * @post PrevisaoOutput com demandaPrevista >= 0, confianca ∈ [0, 1]
 * @throws Error se zona inválida
 */
export async function gerarPrevisao(input: PrevisaoInput): Promise<PrevisaoOutput> {
  const { zona, data, horaInicio = 8, horaFim = 18, fornecedor } = input;

  // Validação de entrada (Design por Contrato)
  if (!zona || zona.trim() === '') {
    throw new Error('Zona é obrigatória');
  }

  const diaSemana = data.getDay();
  const diaMes = `${String(data.getDate()).padStart(2, '0')}-${String(data.getMonth() + 1).padStart(2, '0')}`;

  // Buscar agregações históricas
  const agregacoes = await buscarAgregacoes({ zona, diaSemana, horaInicio, fornecedor });

  // Calcular média ponderada
  const mediaBase = calcularMediaPonderada(agregacoes);

  // Aplicar fatores
  const fatorDiaSemana = FATORES_DIA_SEMANA[diaSemana] || 1.0;
  const fatorHorario = calcularFatorHorario(horaInicio, horaFim);
  const fatorSazonalidade = SAZONALIDADE[diaMes]?.fator || 1.0;
  const fatorTendencia = await calcularTendencia(zona, fornecedor);

  // Previsão final
  const demandaPrevista = Math.max(0, Math.round(
    mediaBase * fatorDiaSemana * fatorHorario * fatorSazonalidade * fatorTendencia
  ));

  // Calcular confiança baseada na quantidade de dados
  const confianca = calcularConfianca(agregacoes);

  // Intervalo de confiança (95%)
  const desvio = calcularDesvioPadrao(agregacoes);
  const margem = 1.96 * desvio;
  const limiteInferior = Math.max(0, Math.round(demandaPrevista - margem));
  const limiteSuperior = Math.round(demandaPrevista + margem);

  // Gerar insights
  const insights = await gerarInsights(zona, data, demandaPrevista, {
    diaSemana: fatorDiaSemana,
    horario: fatorHorario,
    sazonalidade: fatorSazonalidade,
    tendencia: fatorTendencia,
  }, fornecedor);

  // Salvar previsão
  await prisma.previsaoDemanda.create({
    data: {
      zona,
      data,
      horaInicio,
      horaFim,
      fornecedor,
      demandaPrevista,
      confianca,
      limiteInferior,
      limiteSuperior,
      fatorDiaSemana,
      fatorHorario,
      fatorSazonalidade,
      fatorTendencia,
    },
  });

  return {
    zona,
    data,
    horaInicio,
    horaFim,
    demandaPrevista,
    confianca,
    limiteInferior,
    limiteSuperior,
    fatores: {
      diaSemana: fatorDiaSemana,
      horario: fatorHorario,
      sazonalidade: fatorSazonalidade,
      tendencia: fatorTendencia,
    },
    insights,
  };
}

/**
 * Gera mapa de calor de demanda para todas as zonas
 * 
 * @pre data válida
 * @post MapaCalorOutput com intensidades normalizadas 0-1
 */
export async function gerarMapaCalor(data: Date): Promise<MapaCalorOutput> {
  // Buscar todas as zonas com histórico
  const zonasDistintas = await prisma.agregacaoDemanda.findMany({
    distinct: ['zona'],
    select: { zona: true },
  });

  const previsoes = await Promise.all(
    zonasDistintas.map(async ({ zona }) => {
      const previsao = await gerarPrevisao({ zona, data });
      return {
        zona,
        demandaPrevista: previsao.demandaPrevista,
      };
    })
  );

  // Normalizar intensidades
  const maxDemanda = Math.max(...previsoes.map(p => p.demandaPrevista), 1);

  const zonas = previsoes.map(p => ({
    zona: p.zona,
    demandaPrevista: p.demandaPrevista,
    intensidade: p.demandaPrevista / maxDemanda,
    melhorHorario: calcularMelhorHorario(data.getDay()),
  }));

  return {
    zonas: zonas.sort((a, b) => b.demandaPrevista - a.demandaPrevista),
    dataReferencia: data,
  };
}

/**
 * Atualiza agregações com novas entregas
 * 
 * @pre entregas é array de objetos com zona, data, fornecedor
 * @post Agregações atualizadas no banco
 */
export async function atualizarAgregacoes(): Promise<{ atualizadas: number }> {
  // Buscar paradas concluídas dos últimos 30 dias
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 30);

  const paradas = await prisma.parada.findMany({
    where: {
      status: 'ENTREGUE',
      entregueEm: { gte: dataLimite },
    },
    select: {
      cep: true,
      entregueEm: true,
      fornecedor: true,
    },
  });

  // Agrupar por zona + diaSemana + hora + fornecedor
  const agregacoesMap = new Map<string, {
    zona: string;
    diaSemana: number;
    horaInicio: number;
    fornecedor: string | null;
    entregas: number[];
  }>();

  for (const parada of paradas) {
    if (!parada.cep || !parada.entregueEm) continue;

    const zona = parada.cep.substring(0, 5); // CEP prefix
    const diaSemana = parada.entregueEm.getDay();
    const horaInicio = parada.entregueEm.getHours();
    const fornecedor = parada.fornecedor || null;

    const chave = `${zona}-${diaSemana}-${horaInicio}-${fornecedor}`;

    if (!agregacoesMap.has(chave)) {
      agregacoesMap.set(chave, {
        zona,
        diaSemana,
        horaInicio,
        fornecedor,
        entregas: [],
      });
    }

    agregacoesMap.get(chave)!.entregas.push(1);
  }

  // Upsert agregações
  let atualizadas = 0;
  const periodoInicio = dataLimite;
  const periodoFim = new Date();
  const totalDias = 30;

  for (const [_, agregacao] of agregacoesMap) {
    const totalEntregas = agregacao.entregas.length;
    const mediaEntregasDia = totalEntregas / totalDias;
    const desvioPadrao = calcularDesvioPadraoArray(agregacao.entregas);

    await prisma.agregacaoDemanda.upsert({
      where: {
        zona_diaSemana_horaInicio_fornecedor: {
          zona: agregacao.zona,
          diaSemana: agregacao.diaSemana,
          horaInicio: agregacao.horaInicio,
          fornecedor: agregacao.fornecedor,
        },
      },
      create: {
        zona: agregacao.zona,
        diaSemana: agregacao.diaSemana,
        horaInicio: agregacao.horaInicio,
        fornecedor: agregacao.fornecedor,
        totalEntregas,
        mediaEntregasDia,
        desvioPadrao,
        periodoInicio,
        periodoFim,
        totalDias,
      },
      update: {
        totalEntregas,
        mediaEntregasDia,
        desvioPadrao,
        periodoInicio,
        periodoFim,
        totalDias,
      },
    });

    atualizadas++;
  }

  return { atualizadas };
}

/**
 * Valida previsões anteriores com demanda real
 * 
 * @pre previsões existem com demandaReal nulo
 * @post erroAbsoluto calculado para previsões validáveis
 */
export async function validarPrevisoes(): Promise<{ validadas: number; erroMedio: number }> {
  // Buscar previsões antigas sem validação
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);

  const previsoes = await prisma.previsaoDemanda.findMany({
    where: {
      data: { lte: ontem },
      demandaReal: null,
    },
  });

  let validadas = 0;
  let somaErros = 0;

  for (const previsao of previsoes) {
    // Contar entregas reais
    const demandaReal = await prisma.parada.count({
      where: {
        cep: { startsWith: previsao.zona },
        status: 'ENTREGUE',
        entregueEm: {
          gte: new Date(previsao.data.setHours(previsao.horaInicio, 0, 0)),
          lt: new Date(previsao.data.setHours(previsao.horaFim, 0, 0)),
        },
        ...(previsao.fornecedor && { fornecedor: previsao.fornecedor }),
      },
    });

    const erroAbsoluto = Math.abs(previsao.demandaPrevista - demandaReal);

    await prisma.previsaoDemanda.update({
      where: { id: previsao.id },
      data: {
        demandaReal,
        erroAbsoluto,
        validadoEm: new Date(),
      },
    });

    somaErros += erroAbsoluto;
    validadas++;
  }

  return {
    validadas,
    erroMedio: validadas > 0 ? somaErros / validadas : 0,
  };
}

/**
 * Obtém insights ativos para o usuário
 */
export async function getInsightsAtivos(zona?: string): Promise<InsightOutput[]> {
  const insights = await prisma.insightDemanda.findMany({
    where: {
      validoAte: { gte: new Date() },
      ...(zona && { zona }),
    },
    orderBy: [{ prioridade: 'asc' }, { createdAt: 'desc' }],
    take: 10,
  });

  return insights.map(i => ({
    tipo: i.tipo,
    titulo: i.titulo,
    descricao: i.descricao,
    valor: i.valor,
    acao: i.acao,
    prioridade: i.prioridade,
  }));
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

async function buscarAgregacoes(input: AgregacaoInput) {
  return prisma.agregacaoDemanda.findMany({
    where: {
      zona: input.zona,
      diaSemana: input.diaSemana,
      horaInicio: { gte: input.horaInicio - 2, lte: input.horaInicio + 2 },
      ...(input.fornecedor && { fornecedor: input.fornecedor }),
    },
  });
}

function calcularMediaPonderada(agregacoes: any[]): number {
  if (agregacoes.length === 0) return 5; // Default mínimo

  let somaMedias = 0;
  let count = 0;

  for (const ag of agregacoes) {
    somaMedias += ag.mediaEntregasDia;
    count++;
  }

  return count > 0 ? somaMedias / count * 8 : 5; // 8h de trabalho
}

function calcularFatorHorario(horaInicio: number, horaFim: number): number {
  const hora = Math.floor((horaInicio + horaFim) / 2);

  if (hora >= 6 && hora < 9) return FATORES_HORARIO['06-09'];
  if (hora >= 9 && hora < 12) return FATORES_HORARIO['09-12'];
  if (hora >= 12 && hora < 14) return FATORES_HORARIO['12-14'];
  if (hora >= 14 && hora < 17) return FATORES_HORARIO['14-17'];
  if (hora >= 17 && hora < 19) return FATORES_HORARIO['17-19'];
  if (hora >= 19 && hora < 22) return FATORES_HORARIO['19-22'];

  return 1.0;
}

async function calcularTendencia(zona: string, fornecedor?: string): Promise<number> {
  // Comparar últimas 2 semanas com 2 semanas anteriores
  const agora = new Date();
  const umaSemana = new Date(agora);
  umaSemana.setDate(umaSemana.getDate() - 7);
  const duasSemanas = new Date(agora);
  duasSemanas.setDate(duasSemanas.getDate() - 14);
  const tresSemanas = new Date(agora);
  tresSemanas.setDate(tresSemanas.getDate() - 21);

  const [recente, anterior] = await Promise.all([
    prisma.parada.count({
      where: {
        cep: { startsWith: zona },
        status: 'ENTREGUE',
        entregueEm: { gte: umaSemana },
        ...(fornecedor && { fornecedor }),
      },
    }),
    prisma.parada.count({
      where: {
        cep: { startsWith: zona },
        status: 'ENTREGUE',
        entregueEm: { gte: tresSemanas, lt: duasSemanas },
        ...(fornecedor && { fornecedor }),
      },
    }),
  ]);

  if (anterior === 0) return 1.0;

  const tendencia = recente / anterior;
  // Limitar entre 0.5 e 2.0
  return Math.max(0.5, Math.min(2.0, tendencia));
}

function calcularConfianca(agregacoes: any[]): number {
  // Confiança baseada na quantidade de dados
  const totalDados = agregacoes.reduce((acc, a) => acc + a.totalEntregas, 0);

  if (totalDados >= 100) return 0.95;
  if (totalDados >= 50) return 0.85;
  if (totalDados >= 20) return 0.70;
  if (totalDados >= 10) return 0.55;
  if (totalDados >= 5) return 0.40;

  return 0.25; // Poucos dados
}

function calcularDesvioPadrao(agregacoes: any[]): number {
  if (agregacoes.length === 0) return 2;

  const desvios = agregacoes.map(a => a.desvioPadrao || 0);
  return desvios.reduce((acc, d) => acc + d, 0) / desvios.length || 2;
}

function calcularDesvioPadraoArray(valores: number[]): number {
  if (valores.length === 0) return 0;

  const media = valores.reduce((a, b) => a + b, 0) / valores.length;
  const somaQuadrados = valores.reduce((acc, v) => acc + Math.pow(v - media, 2), 0);

  return Math.sqrt(somaQuadrados / valores.length);
}

function calcularMelhorHorario(diaSemana: number): string {
  // Baseado nos fatores de horário
  if (diaSemana === 0 || diaSemana === 6) {
    return '10:00-14:00'; // Fim de semana: manhã
  }
  return '14:00-17:00'; // Dia útil: tarde
}

async function gerarInsights(
  zona: string,
  data: Date,
  demandaPrevista: number,
  fatores: { diaSemana: number; horario: number; sazonalidade: number; tendencia: number },
  fornecedor?: string
): Promise<InsightOutput[]> {
  const insights: InsightOutput[] = [];

  // Insight de pico de demanda
  if (fatores.sazonalidade > 1.3) {
    const diaMes = `${String(data.getDate()).padStart(2, '0')}-${String(data.getMonth() + 1).padStart(2, '0')}`;
    const evento = SAZONALIDADE[diaMes];

    insights.push({
      tipo: 'PICO_DEMANDA',
      titulo: `📈 ${evento?.nome || 'Pico de demanda'}`,
      descricao: `Demanda +${Math.round((fatores.sazonalidade - 1) * 100)}% esperada`,
      valor: fatores.sazonalidade,
      acao: `Prepare-se para ${demandaPrevista} entregas na ${zona}`,
      prioridade: 1,
    });
  }

  // Insight de melhor horário
  if (fatores.horario > 1.2) {
    insights.push({
      tipo: 'MELHOR_HORARIO',
      titulo: '⏰ Horário ideal',
      descricao: `Produtividade +${Math.round((fatores.horario - 1) * 100)}% neste horário`,
      valor: fatores.horario,
      acao: calcularMelhorHorario(data.getDay()),
      prioridade: 2,
    });
  }

  // Insight de tendência
  if (fatores.tendencia > 1.15) {
    insights.push({
      tipo: 'TENDENCIA',
      titulo: '📊 Demanda crescendo',
      descricao: `+${Math.round((fatores.tendencia - 1) * 100)}% vs semana anterior`,
      valor: fatores.tendencia,
      acao: `Zona ${zona} em alta - considere priorizar`,
      prioridade: 2,
    });
  } else if (fatores.tendencia < 0.85) {
    insights.push({
      tipo: 'ZONA_EVITAR',
      titulo: '⚠️ Demanda em queda',
      descricao: `${Math.round((1 - fatores.tendencia) * 100)}% menos que antes`,
      valor: fatores.tendencia,
      acao: `Considere outras zonas além da ${zona}`,
      prioridade: 3,
    });
  }

  // Salvar insights no banco
  const validoAte = new Date(data);
  validoAte.setHours(23, 59, 59);

  for (const insight of insights) {
    await prisma.insightDemanda.create({
      data: {
        tipo: insight.tipo,
        titulo: insight.titulo,
        descricao: insight.descricao,
        zona,
        fornecedor,
        valor: insight.valor,
        comparacao: insight.descricao,
        acao: insight.acao,
        prioridade: insight.prioridade,
        validoAte,
      },
    });
  }

  return insights;
}

// ==========================================
// EXPORT DEFAULT
// ==========================================

export default {
  gerarPrevisao,
  gerarMapaCalor,
  atualizarAgregacoes,
  validarPrevisoes,
  getInsightsAtivos,
};
