/**
 * @fileoverview Rotas de Analytics - Dashboard profissional diferenciado por plano
 *
 * DESIGN POR CONTRATO:
 * @pre Usuário deve estar autenticado
 * @pre Plano determina nível de acesso aos dados
 * @post Retorna métricas e gráficos conforme nível do plano
 *
 * NÍVEIS:
 * - FREE: Overview básico (3 KPIs + status entregas)
 * - PRO: + trends, suppliers, filtros período, CSV
 * - FULL/ENTERPRISE: + heatmap, performance, filtros avançados, PDF
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requirePlano } from '../middlewares/auth.middleware.js';

// ==========================================
// SCHEMAS DE VALIDAÇÃO
// ==========================================

const periodoSchema = z.object({
  periodo: z.enum(['7d', '30d', '90d', '365d', 'custom']).optional().default('30d'),
  dataInicio: z.string().optional(),
  dataFim: z.string().optional(),
  fornecedor: z.string().optional(),
});

const trendsSchema = z.object({
  periodo: z.enum(['7d', '30d', '90d', '365d']).optional().default('30d'),
  groupBy: z.enum(['day', 'week', 'month']).optional().default('day'),
});

// ==========================================
// HELPERS
// ==========================================

/**
 * Calcula datas de início e fim baseado no período
 */
function calcularPeriodo(periodo: string, dataInicio?: string, dataFim?: string): { inicio: Date; fim: Date } {
  const fim = dataFim ? new Date(dataFim) : new Date();
  let inicio: Date;

  switch (periodo) {
    case '7d':
      inicio = new Date(fim);
      inicio.setDate(fim.getDate() - 7);
      break;
    case '30d':
      inicio = new Date(fim);
      inicio.setDate(fim.getDate() - 30);
      break;
    case '90d':
      inicio = new Date(fim);
      inicio.setDate(fim.getDate() - 90);
      break;
    case '365d':
      inicio = new Date(fim);
      inicio.setFullYear(fim.getFullYear() - 1);
      break;
    case 'custom':
      inicio = dataInicio ? new Date(dataInicio) : new Date(fim.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      inicio = new Date(fim);
      inicio.setDate(fim.getDate() - 30);
  }

  return { inicio, fim };
}

/**
 * Determina nível do dashboard baseado no plano
 */
function getDashboardNivel(plano: string): 'essencial' | 'avancado' | 'completo' {
  switch (plano) {
    case 'FREE':
      return 'essencial';
    case 'PRO':
      return 'avancado';
    case 'FULL':
    case 'ENTERPRISE':
      return 'completo';
    default:
      return 'essencial';
  }
}

/**
 * Determina features disponíveis por plano
 */
function getFeaturesDisponiveis(plano: string) {
  return {
    filtrosPeriodo: plano !== 'FREE',
    filtrosFornecedor: plano === 'FULL' || plano === 'ENTERPRISE',
    exportCSV: plano !== 'FREE',
    exportPDF: plano === 'FULL' || plano === 'ENTERPRISE',
    heatmap: plano === 'FULL' || plano === 'ENTERPRISE',
    insights: plano === 'FULL' || plano === 'ENTERPRISE',
    trends: plano !== 'FREE',
    suppliers: plano !== 'FREE',
  };
}

// ==========================================
// CONFIGURAÇÃO FORNECEDORES (cores/emojis)
// ==========================================

const FORNECEDORES_CONFIG: Record<string, { nome: string; cor: string; emoji: string }> = {
  natura: { nome: 'Natura', cor: '#FF6B00', emoji: '🧴' },
  avon: { nome: 'Avon', cor: '#E91E8C', emoji: '💄' },
  boticario: { nome: 'O Boticário', cor: '#1D4E3E', emoji: '🌿' },
  mercadolivre: { nome: 'Mercado Livre', cor: '#FFE600', emoji: '📦' },
  shopee: { nome: 'Shopee', cor: '#EE4D2D', emoji: '🛒' },
  amazon: { nome: 'Amazon', cor: '#FF9900', emoji: '📦' },
  magazineluiza: { nome: 'Magazine Luiza', cor: '#0086FF', emoji: '🏪' },
  americanas: { nome: 'Americanas', cor: '#E60014', emoji: '🛍️' },
  correios: { nome: 'Correios', cor: '#FEDD00', emoji: '✉️' },
  jadlog: { nome: 'JadLog', cor: '#009F4D', emoji: '🚚' },
  loggi: { nome: 'Loggi', cor: '#00D26A', emoji: '🏍️' },
  ifood: { nome: 'iFood', cor: '#EA1D2C', emoji: '🍔' },
  rappi: { nome: 'Rappi', cor: '#FF441F', emoji: '🛵' },
  outro: { nome: 'Outro', cor: '#6B7280', emoji: '📋' },
};

// ==========================================
// ROTAS
// ==========================================

export async function analyticsRoutes(app: FastifyInstance) {
  // Todas as rotas requerem autenticação
  app.addHook('onRequest', authenticate);

  /**
   * GET /analytics/overview
   * KPIs principais - disponível para todos os planos
   * @description Retorna overview do dashboard baseado no plano
   */
  app.get('/overview', async (request) => {
    const { userId, plano } = request.user;
    const query = periodoSchema.safeParse(request.query);
    const params = query.success ? query.data : { periodo: '30d' as const };

    // FREE sempre usa 7d
    const periodoReal = plano === 'FREE' ? '7d' : params.periodo;
    const { inicio, fim } = calcularPeriodo(periodoReal, params.dataInicio, params.dataFim);

    // Período anterior para comparativo (FULL+)
    const duracaoDias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
    const inicioAnterior = new Date(inicio);
    inicioAnterior.setDate(inicioAnterior.getDate() - duracaoDias);
    const fimAnterior = new Date(inicio);

    // Query base - rotas no período
    const whereRotas = {
      userId,
      createdAt: { gte: inicio, lte: fim },
    };

    // Agregações paralelas
    const [
      totalRotas,
      rotasFinalizadas,
      totalParadas,
      paradasEntregues,
      metricas,
      rotasAnterior,
      metricasAnterior,
    ] = await Promise.all([
      // Total de rotas
      prisma.rota.count({ where: whereRotas }),

      // Rotas finalizadas
      prisma.rota.count({
        where: { ...whereRotas, status: 'FINALIZADA' },
      }),

      // Total de paradas
      prisma.parada.count({
        where: { rota: whereRotas },
      }),

      // Paradas entregues
      prisma.parada.count({
        where: {
          rota: whereRotas,
          statusEntrega: 'ENTREGUE',
        },
      }),

      // Métricas agregadas
      prisma.rota.aggregate({
        where: { ...whereRotas, status: 'FINALIZADA' },
        _sum: {
          distanciaTotalKm: true,
          tempoViagemMin: true,
          custoR: true,
        },
        _avg: {
          distanciaTotalKm: true,
          tempoViagemMin: true,
        },
      }),

      // Comparativo período anterior (FULL+)
      plano === 'FULL' || plano === 'ENTERPRISE'
        ? prisma.rota.count({
            where: {
              userId,
              createdAt: { gte: inicioAnterior, lte: fimAnterior },
            },
          })
        : null,

      // Métricas período anterior (FULL+)
      plano === 'FULL' || plano === 'ENTERPRISE'
        ? prisma.rota.aggregate({
            where: {
              userId,
              createdAt: { gte: inicioAnterior, lte: fimAnterior },
              status: 'FINALIZADA',
            },
            _sum: {
              distanciaTotalKm: true,
              custoR: true,
            },
          })
        : null,
    ]);

    // Calcular taxa de sucesso
    const taxaSucesso = totalParadas > 0 ? (paradasEntregues / totalParadas) * 100 : 0;

    // KPIs base (todos os planos)
    const kpis: Record<string, number | null> = {
      totalRotas,
      rotasFinalizadas,
      totalParadas,
      totalKm: metricas._sum.distanciaTotalKm || 0,
      taxaSucesso: Math.round(taxaSucesso * 10) / 10,
    };

    // KPIs adicionais (PRO+)
    if (plano !== 'FREE') {
      kpis.tempoTotalMin = metricas._sum.tempoViagemMin || 0;
      kpis.custoTotal = metricas._sum.custoR || 0;
      kpis.kmMedio = metricas._avg.distanciaTotalKm || 0;
      kpis.tempoMedio = metricas._avg.tempoViagemMin || 0;
    }

    // KPIs extras (FULL+)
    if (plano === 'FULL' || plano === 'ENTERPRISE') {
      kpis.paradasEntregues = paradasEntregues;
      kpis.economiaPercent = 0; // TODO: calcular economia vs rota sequencial
    }

    // Comparativo período anterior (FULL+)
    let comparativoAnterior = null;
    if ((plano === 'FULL' || plano === 'ENTERPRISE') && rotasAnterior !== null && metricasAnterior !== null) {
      const calcVariacao = (atual: number, anterior: number): number => {
        if (anterior === 0) return atual > 0 ? 100 : 0;
        return Math.round(((atual - anterior) / anterior) * 1000) / 10;
      };

      comparativoAnterior = {
        rotas: calcVariacao(totalRotas, rotasAnterior),
        km: calcVariacao(metricas._sum.distanciaTotalKm || 0, metricasAnterior._sum.distanciaTotalKm || 0),
        custo: calcVariacao(metricas._sum.custoR || 0, metricasAnterior._sum.custoR || 0),
      };
    }

    return {
      success: true,
      data: {
        plano,
        dashboardNivel: getDashboardNivel(plano),
        periodo: {
          inicio: inicio.toISOString(),
          fim: fim.toISOString(),
          label: periodoReal,
        },
        kpis,
        comparativoAnterior,
        featuresDisponiveis: getFeaturesDisponiveis(plano),
      },
    };
  });

  /**
   * GET /analytics/deliveries
   * Análise de status de entregas
   * @description Disponível para todos - detalhamento por status
   */
  app.get('/deliveries', async (request) => {
    const { userId, plano } = request.user;
    const query = periodoSchema.safeParse(request.query);
    const params = query.success ? query.data : { periodo: '30d' as const };

    const periodoReal = plano === 'FREE' ? '7d' : params.periodo;
    const { inicio, fim } = calcularPeriodo(periodoReal, params.dataInicio, params.dataFim);

    const whereRotas = {
      userId,
      createdAt: { gte: inicio, lte: fim },
    };

    // Status breakdown
    const [entregues, pendentes, ausentes, recusadas, reagendadas, podsRegistrados, alertasDistancia] =
      await Promise.all([
        prisma.parada.count({ where: { rota: whereRotas, statusEntrega: 'ENTREGUE' } }),
        prisma.parada.count({ where: { rota: whereRotas, statusEntrega: 'PENDENTE' } }),
        prisma.parada.count({ where: { rota: whereRotas, statusEntrega: 'AUSENTE' } }),
        prisma.parada.count({ where: { rota: whereRotas, statusEntrega: 'RECUSADA' } }),
        prisma.parada.count({ where: { rota: whereRotas, statusEntrega: 'REAGENDADA' } }),
        prisma.proofOfDelivery.count({
          where: { parada: { rota: whereRotas } },
        }),
        prisma.proofOfDelivery.count({
          where: { parada: { rota: whereRotas }, alertaDistancia: true },
        }),
      ]);

    const total = entregues + pendentes + ausentes + recusadas + reagendadas;

    return {
      success: true,
      data: {
        periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
        statusBreakdown: {
          ENTREGUE: entregues,
          PENDENTE: pendentes,
          AUSENTE: ausentes,
          RECUSADA: recusadas,
          REAGENDADA: reagendadas,
        },
        pieChartData: [
          { id: 'Entregue', value: entregues, color: '#22c55e' },
          { id: 'Pendente', value: pendentes, color: '#6b7280' },
          { id: 'Ausente', value: ausentes, color: '#f59e0b' },
          { id: 'Recusada', value: recusadas, color: '#ef4444' },
          { id: 'Reagendada', value: reagendadas, color: '#8b5cf6' },
        ].filter((d) => d.value > 0),
        totais: {
          total,
          podsRegistrados,
          alertasDistancia,
          taxaSucesso: total > 0 ? Math.round((entregues / total) * 1000) / 10 : 0,
        },
      },
    };
  });

  /**
   * GET /analytics/trends
   * Tendências temporais - PRO+
   */
  app.get(
    '/trends',
    {
      onRequest: [requirePlano(['PRO', 'FULL', 'ENTERPRISE'])],
    },
    async (request) => {
      const { userId } = request.user;
      const query = trendsSchema.safeParse(request.query);
      const params = query.success ? query.data : { periodo: '30d' as const, groupBy: 'day' as const };

      const { inicio, fim } = calcularPeriodo(params.periodo);

      // Buscar rotas no período
      const rotas = await prisma.rota.findMany({
        where: {
          userId,
          createdAt: { gte: inicio, lte: fim },
        },
        select: {
          createdAt: true,
          distanciaTotalKm: true,
          tempoViagemMin: true,
          custoR: true,
          _count: { select: { paradas: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      // Agrupar por período
      const agrupado = new Map<
        string,
        { rotas: number; km: number; paradas: number; custo: number; tempo: number }
      >();

      for (const rota of rotas) {
        let chave: string;
        const data = rota.createdAt;

        switch (params.groupBy) {
          case 'week': {
            const primeiroDia = new Date(data);
            primeiroDia.setDate(data.getDate() - data.getDay());
            chave = primeiroDia.toISOString().split('T')[0];
            break;
          }
          case 'month':
            chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-01`;
            break;
          default:
            chave = data.toISOString().split('T')[0];
        }

        const atual = agrupado.get(chave) || { rotas: 0, km: 0, paradas: 0, custo: 0, tempo: 0 };
        agrupado.set(chave, {
          rotas: atual.rotas + 1,
          km: atual.km + (rota.distanciaTotalKm || 0),
          paradas: atual.paradas + rota._count.paradas,
          custo: atual.custo + (rota.custoR || 0),
          tempo: atual.tempo + (rota.tempoViagemMin || 0),
        });
      }

      // Converter para array ordenado
      const series = Array.from(agrupado.entries())
        .map(([data, valores]) => ({
          data,
          ...valores,
          km: Math.round(valores.km * 10) / 10,
          custo: Math.round(valores.custo * 100) / 100,
        }))
        .sort((a, b) => a.data.localeCompare(b.data));

      return {
        success: true,
        data: {
          periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
          agregacao: params.groupBy,
          series,
          // Dados formatados para Nivo Line Chart
          lineChartData: [
            {
              id: 'Rotas',
              color: '#3b82f6',
              data: series.map((s) => ({ x: s.data, y: s.rotas })),
            },
            {
              id: 'Km',
              color: '#22c55e',
              data: series.map((s) => ({ x: s.data, y: s.km })),
            },
            {
              id: 'Paradas',
              color: '#f59e0b',
              data: series.map((s) => ({ x: s.data, y: s.paradas })),
            },
          ],
        },
      };
    }
  );

  /**
   * GET /analytics/suppliers
   * Métricas por fornecedor - PRO+
   */
  app.get(
    '/suppliers',
    {
      onRequest: [requirePlano(['PRO', 'FULL', 'ENTERPRISE'])],
    },
    async (request) => {
      const { userId } = request.user;
      const query = periodoSchema.safeParse(request.query);
      const params = query.success ? query.data : { periodo: '30d' as const };

      const { inicio, fim } = calcularPeriodo(params.periodo, params.dataInicio, params.dataFim);

      // Agregação por fornecedor
      const paradasPorFornecedor = await prisma.parada.groupBy({
        by: ['fornecedor', 'statusEntrega'],
        where: {
          rota: {
            userId,
            createdAt: { gte: inicio, lte: fim },
          },
        },
        _count: true,
        _sum: {
          distanciaAnterior: true,
        },
      });

      // Processar dados
      const fornecedoresMap = new Map<
        string,
        {
          totalParadas: number;
          entregues: number;
          ausentes: number;
          recusadas: number;
          reagendadas: number;
          distanciaTotal: number;
        }
      >();

      for (const grupo of paradasPorFornecedor) {
        const atual = fornecedoresMap.get(grupo.fornecedor) || {
          totalParadas: 0,
          entregues: 0,
          ausentes: 0,
          recusadas: 0,
          reagendadas: 0,
          distanciaTotal: 0,
        };

        atual.totalParadas += grupo._count;
        atual.distanciaTotal += grupo._sum.distanciaAnterior || 0;

        switch (grupo.statusEntrega) {
          case 'ENTREGUE':
            atual.entregues += grupo._count;
            break;
          case 'AUSENTE':
            atual.ausentes += grupo._count;
            break;
          case 'RECUSADA':
            atual.recusadas += grupo._count;
            break;
          case 'REAGENDADA':
            atual.reagendadas += grupo._count;
            break;
        }

        fornecedoresMap.set(grupo.fornecedor, atual);
      }

      // Converter para array com config
      const fornecedores = Array.from(fornecedoresMap.entries())
        .map(([fornecedor, dados]) => {
          const config = FORNECEDORES_CONFIG[fornecedor] || FORNECEDORES_CONFIG.outro;
          return {
            id: fornecedor,
            nome: config.nome,
            cor: config.cor,
            emoji: config.emoji,
            ...dados,
            taxaSucesso:
              dados.totalParadas > 0 ? Math.round((dados.entregues / dados.totalParadas) * 1000) / 10 : 0,
            distanciaTotal: Math.round(dados.distanciaTotal * 10) / 10,
          };
        })
        .sort((a, b) => b.totalParadas - a.totalParadas);

      return {
        success: true,
        data: {
          periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
          fornecedores,
          // Dados formatados para Nivo Bar Chart
          barChartData: fornecedores.map((f) => ({
            fornecedor: f.nome,
            totalParadas: f.totalParadas,
            entregues: f.entregues,
            cor: f.cor,
          })),
        },
      };
    }
  );

  /**
   * GET /analytics/heatmap
   * Heatmap de entregas (dia x hora) - FULL+
   */
  app.get(
    '/heatmap',
    {
      onRequest: [requirePlano(['FULL', 'ENTERPRISE'])],
    },
    async (request) => {
      const { userId } = request.user;
      const query = periodoSchema.safeParse(request.query);
      const params = query.success ? query.data : { periodo: '30d' as const };

      const { inicio, fim } = calcularPeriodo(params.periodo, params.dataInicio, params.dataFim);

      // Buscar entregas com timestamp
      const entregas = await prisma.parada.findMany({
        where: {
          rota: {
            userId,
            createdAt: { gte: inicio, lte: fim },
          },
          statusEntrega: 'ENTREGUE',
          entregueEm: { not: null },
        },
        select: {
          entregueEm: true,
        },
      });

      // Criar matriz dia x hora
      const diasSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
      const horas = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

      // Inicializar matriz
      const matriz: Record<string, Record<string, number>> = {};
      for (const dia of diasSemana) {
        matriz[dia] = {};
        for (const hora of horas) {
          matriz[dia][hora] = 0;
        }
      }

      // Preencher com entregas
      for (const entrega of entregas) {
        if (entrega.entregueEm) {
          const dia = diasSemana[entrega.entregueEm.getDay()];
          const hora = String(entrega.entregueEm.getHours()).padStart(2, '0');
          matriz[dia][hora]++;
        }
      }

      // Converter para formato Nivo HeatMap
      const heatmapData = diasSemana.map((dia) => ({
        id: dia,
        data: horas.map((hora) => ({
          x: hora,
          y: matriz[dia][hora],
        })),
      }));

      return {
        success: true,
        data: {
          periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
          heatmapData,
          totalEntregas: entregas.length,
        },
      };
    }
  );

  /**
   * GET /analytics/performance
   * Tabela de performance detalhada - FULL+
   */
  app.get(
    '/performance',
    {
      onRequest: [requirePlano(['FULL', 'ENTERPRISE'])],
    },
    async (request) => {
      const { userId } = request.user;
      const query = periodoSchema.safeParse(request.query);
      const params = query.success ? query.data : { periodo: '30d' as const };

      const { inicio, fim } = calcularPeriodo(params.periodo, params.dataInicio, params.dataFim);

      // Top 10 rotas do período
      const topRotas = await prisma.rota.findMany({
        where: {
          userId,
          createdAt: { gte: inicio, lte: fim },
          status: 'FINALIZADA',
        },
        select: {
          id: true,
          createdAt: true,
          distanciaTotalKm: true,
          tempoViagemMin: true,
          custoR: true,
          _count: { select: { paradas: true } },
          paradas: {
            select: {
              statusEntrega: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const performanceData = topRotas.map((rota) => {
        const entregues = rota.paradas.filter((p) => p.statusEntrega === 'ENTREGUE').length;
        const total = rota._count.paradas;

        return {
          id: rota.id,
          data: rota.createdAt.toISOString().split('T')[0],
          paradas: total,
          entregues,
          taxaSucesso: total > 0 ? Math.round((entregues / total) * 100) : 0,
          km: Math.round((rota.distanciaTotalKm || 0) * 10) / 10,
          tempo: Math.round(rota.tempoViagemMin || 0),
          custo: Math.round((rota.custoR || 0) * 100) / 100,
          kmPorParada: total > 0 ? Math.round(((rota.distanciaTotalKm || 0) / total) * 10) / 10 : 0,
        };
      });

      return {
        success: true,
        data: {
          periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
          performanceData,
        },
      };
    }
  );

  /**
   * GET /analytics/export/csv
   * Exportar dados em CSV - PRO+
   */
  app.get(
    '/export/csv',
    {
      onRequest: [requirePlano(['PRO', 'FULL', 'ENTERPRISE'])],
    },
    async (request, reply) => {
      const { userId } = request.user;
      const query = periodoSchema.safeParse(request.query);
      const params = query.success ? query.data : { periodo: '30d' as const };

      const { inicio, fim } = calcularPeriodo(params.periodo, params.dataInicio, params.dataFim);

      // Buscar rotas com paradas
      const rotas = await prisma.rota.findMany({
        where: {
          userId,
          createdAt: { gte: inicio, lte: fim },
        },
        include: {
          paradas: {
            select: {
              nome: true,
              endereco: true,
              fornecedor: true,
              statusEntrega: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Gerar CSV
      const headers = ['Data', 'Status', 'Paradas', 'KM', 'Tempo (min)', 'Custo (R$)', 'Fornecedores'];
      const rows = rotas.map((rota) => {
        const fornecedores = [...new Set(rota.paradas.map((p) => p.fornecedor))].join(';');
        return [
          rota.createdAt.toISOString().split('T')[0],
          rota.status,
          rota.paradas.length,
          rota.distanciaTotalKm?.toFixed(1) || '0',
          Math.round(rota.tempoViagemMin || 0),
          rota.custoR?.toFixed(2) || '0',
          fornecedores,
        ].join(',');
      });

      const csv = [headers.join(','), ...rows].join('\n');

      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="analytics-${inicio.toISOString().split('T')[0]}-${fim.toISOString().split('T')[0]}.csv"`);

      return csv;
    }
  );

  /**
   * GET /analytics/insights
   * Insights automáticos - FULL+
   */
  app.get(
    '/insights',
    {
      onRequest: [requirePlano(['FULL', 'ENTERPRISE'])],
    },
    async (request) => {
      const { userId } = request.user;
      const query = periodoSchema.safeParse(request.query);
      const params = query.success ? query.data : { periodo: '30d' as const };

      const { inicio, fim } = calcularPeriodo(params.periodo, params.dataInicio, params.dataFim);

      // Coletar dados para insights
      const [totalParadas, paradasAusentes, alertasDistancia, rotasSemCalculo] = await Promise.all([
        prisma.parada.count({ where: { rota: { userId, createdAt: { gte: inicio, lte: fim } } } }),
        prisma.parada.count({
          where: { rota: { userId, createdAt: { gte: inicio, lte: fim } }, statusEntrega: 'AUSENTE' },
        }),
        prisma.proofOfDelivery.count({
          where: { parada: { rota: { userId, createdAt: { gte: inicio, lte: fim } } }, alertaDistancia: true },
        }),
        prisma.rota.count({
          where: { userId, createdAt: { gte: inicio, lte: fim }, status: 'RASCUNHO' },
        }),
      ]);

      const insights: Array<{ tipo: 'info' | 'alerta' | 'sucesso'; titulo: string; descricao: string }> = [];

      // Taxa de ausentes alta
      const taxaAusentes = totalParadas > 0 ? (paradasAusentes / totalParadas) * 100 : 0;
      if (taxaAusentes > 10) {
        insights.push({
          tipo: 'alerta',
          titulo: 'Alta taxa de ausentes',
          descricao: `${taxaAusentes.toFixed(1)}% das entregas resultaram em ausente. Considere confirmar horários com os clientes.`,
        });
      }

      // Alertas de distância
      if (alertasDistancia > 0) {
        insights.push({
          tipo: 'alerta',
          titulo: 'PODs com distância suspeita',
          descricao: `${alertasDistancia} comprovantes foram registrados longe do endereço de entrega.`,
        });
      }

      // Rotas não calculadas
      if (rotasSemCalculo > 0) {
        insights.push({
          tipo: 'info',
          titulo: 'Rotas em rascunho',
          descricao: `Você tem ${rotasSemCalculo} rotas que não foram otimizadas.`,
        });
      }

      // Taxa de sucesso boa
      const taxaSucesso = totalParadas > 0 ? ((totalParadas - paradasAusentes) / totalParadas) * 100 : 0;
      if (taxaSucesso >= 90) {
        insights.push({
          tipo: 'sucesso',
          titulo: 'Excelente taxa de sucesso',
          descricao: `${taxaSucesso.toFixed(1)}% das entregas foram bem-sucedidas. Continue assim!`,
        });
      }

      return {
        success: true,
        data: {
          periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
          insights,
        },
      };
    }
  );
}
