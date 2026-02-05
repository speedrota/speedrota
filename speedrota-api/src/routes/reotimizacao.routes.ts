/**
 * @fileoverview Endpoints de Re-otimização Dinâmica
 *
 * ENDPOINTS:
 * POST /api/v1/reotimizar/:rotaId - Re-otimiza rota baseado em cenário
 * GET  /api/v1/reotimizar/cenarios - Lista cenários disponíveis
 *
 * DESIGN POR CONTRATO:
 * @pre Rota existe e está em andamento
 * @post Rota re-otimizada ou erro informativo
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  processarReotimizacao,
  MotivoReotimizacao,
  ReotimizacaoResult,
} from '../services/reotimizacao.js';

// ==========================================
// SCHEMAS
// ==========================================

const MotivosValidos = [
  'CANCELAMENTO',
  'TRAFEGO_INTENSO',
  'ATRASO_ACUMULADO',
  'CLIENTE_AUSENTE',
  'NOVO_PEDIDO_URGENTE',
  'ENDERECO_INCORRETO',
  'REAGENDAMENTO',
] as const;

const ReotimizacaoRequestSchema = z.object({
  motivo: z.enum(MotivosValidos),
  paradaId: z.string().uuid().optional(),
  dados: z
    .object({
      novaJanelaInicio: z.string().optional(),
      novaJanelaFim: z.string().optional(),
      novaParada: z
        .object({
          lat: z.number().min(-90).max(90),
          lng: z.number().min(-180).max(180),
          endereco: z.string().min(1),
          cidade: z.string().min(1),
          uf: z.string().length(2),
          nome: z.string().min(1),
          fornecedor: z.string().min(1),
          prioridade: z.enum(['ALTA', 'MEDIA', 'BAIXA']),
        })
        .optional(),
    })
    .optional(),
});

type ReotimizacaoBody = z.infer<typeof ReotimizacaoRequestSchema>;
type ParamsRota = { rotaId: string };

// ==========================================
// INFORMAÇÕES DOS CENÁRIOS
// ==========================================

const CENARIOS_INFO = [
  {
    motivo: 'CANCELAMENTO',
    nome: 'Cancelamento',
    descricao: 'Cliente cancelou o pedido',
    icone: '❌',
    requerParadaId: true,
    acaoAutomatica: 'Remove parada e recalcula rota',
  },
  {
    motivo: 'TRAFEGO_INTENSO',
    nome: 'Tráfego Intenso',
    descricao: 'Congestionamento detectado no trajeto',
    icone: '🚗',
    requerParadaId: false,
    acaoAutomatica: 'Reordena priorizando janelas de tempo',
  },
  {
    motivo: 'ATRASO_ACUMULADO',
    nome: 'Atraso Acumulado',
    descricao: 'Entregador está atrasado na rota',
    icone: '⏰',
    requerParadaId: false,
    acaoAutomatica: 'Prioriza entregas com janela próxima de expirar',
  },
  {
    motivo: 'CLIENTE_AUSENTE',
    nome: 'Cliente Ausente',
    descricao: 'Cliente não estava no local',
    icone: '🏠',
    requerParadaId: true,
    acaoAutomatica: 'Move entrega para o final (tentativa posterior)',
  },
  {
    motivo: 'NOVO_PEDIDO_URGENTE',
    nome: 'Novo Pedido Urgente',
    descricao: 'Nova entrega de alta prioridade',
    icone: '🚨',
    requerParadaId: false,
    acaoAutomatica: 'Insere na melhor posição da rota',
  },
  {
    motivo: 'ENDERECO_INCORRETO',
    nome: 'Endereço Incorreto',
    descricao: 'Não foi possível encontrar o endereço',
    icone: '📍',
    requerParadaId: true,
    acaoAutomatica: 'Pula entrega e marca para verificação',
  },
  {
    motivo: 'REAGENDAMENTO',
    nome: 'Reagendamento',
    descricao: 'Cliente solicitou outro horário',
    icone: '📅',
    requerParadaId: true,
    acaoAutomatica: 'Atualiza janela e reordena rota',
  },
];

// ==========================================
// HANDLERS
// ==========================================

/**
 * POST /reotimizar/:rotaId
 * Re-otimiza rota baseado no cenário informado
 */
async function reotimizarHandler(
  request: FastifyRequest<{ Params: ParamsRota; Body: ReotimizacaoBody }>,
  reply: FastifyReply
): Promise<ReotimizacaoResult> {
  const { rotaId } = request.params;

  // Validar body
  const parseResult = ReotimizacaoRequestSchema.safeParse(request.body);
  if (!parseResult.success) {
    return reply.status(400).send({
      success: false,
      error: 'Dados inválidos',
      detalhes: parseResult.error.issues,
    });
  }

  const { motivo, paradaId, dados } = parseResult.data;

  // Validar se paradaId é obrigatório para o cenário
  const cenario = CENARIOS_INFO.find(c => c.motivo === motivo);
  if (cenario?.requerParadaId && !paradaId) {
    return reply.status(400).send({
      success: false,
      error: `O cenário "${cenario.nome}" requer paradaId`,
    });
  }

  try {
    const resultado = await processarReotimizacao({
      rotaId,
      motivo: motivo as MotivoReotimizacao,
      paradaId,
      dados,
    });

    // Log de auditoria
    request.log.info({
      evento: 'REOTIMIZACAO',
      rotaId,
      motivo,
      paradaId,
      resultado: resultado.success,
      acaoTomada: resultado.acaoTomada,
    });

    return resultado;
  } catch (error) {
    request.log.error(error, 'Erro na re-otimização');
    return reply.status(500).send({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno',
    });
  }
}

/**
 * GET /reotimizar/cenarios
 * Lista todos os cenários de re-otimização disponíveis
 */
async function listarCenariosHandler(): Promise<{
  cenarios: typeof CENARIOS_INFO;
  total: number;
}> {
  return {
    cenarios: CENARIOS_INFO,
    total: CENARIOS_INFO.length,
  };
}

/**
 * POST /reotimizar/:rotaId/verificar-trafego
 * Verifica se há tráfego que justifique re-otimização
 */
async function verificarTrafegoHandler(
  request: FastifyRequest<{ Params: ParamsRota }>,
  reply: FastifyReply
): Promise<{
  requerReotimizacao: boolean;
  fatorTrafego: number;
  periodo: string;
  sugestao: string;
}> {
  const { rotaId } = request.params;

  // Importar dinâmico para evitar dependência circular
  const { obterFatorTrafegoAtual } = await import('../services/trafego.js');
  const trafego = obterFatorTrafegoAtual();

  const requerReotimizacao = trafego.fator >= 1.4;

  return {
    requerReotimizacao,
    fatorTrafego: trafego.fator,
    periodo: trafego.periodo,
    sugestao: requerReotimizacao
      ? 'Recomendamos re-otimizar a rota devido ao tráfego intenso'
      : 'Tráfego está normal, rota atual é adequada',
  };
}

/**
 * POST /reotimizar/:rotaId/verificar-atrasos
 * Verifica se há atrasos que justifiquem re-otimização
 */
async function verificarAtrasosHandler(
  request: FastifyRequest<{ Params: ParamsRota }>,
  reply: FastifyReply
): Promise<{
  requerReotimizacao: boolean;
  paradasEmRisco: number;
  sugestao: string;
}> {
  const { rotaId } = request.params;

  const { prisma } = await import('../lib/prisma.js');
  const rota = await prisma.rota.findUnique({
    where: { id: rotaId },
    include: { paradas: { orderBy: { ordem: 'asc' } } },
  });

  if (!rota) {
    return reply.status(404).send({
      success: false,
      error: 'Rota não encontrada',
    });
  }

  const agora = new Date();
  const horaAtual = agora.getHours() * 60 + agora.getMinutes();

  // Contar paradas com janela prestes a expirar (< 30min)
  const paradasEmRisco = rota.paradas.filter(p => {
    if (p.statusEntrega !== 'PENDENTE' || !p.janelaFim) return false;
    const [h, m] = p.janelaFim.split(':').map(Number);
    const fimJanela = h * 60 + m;
    return fimJanela - horaAtual <= 30 && fimJanela - horaAtual >= 0;
  }).length;

  const requerReotimizacao = paradasEmRisco > 0;

  return {
    requerReotimizacao,
    paradasEmRisco,
    sugestao: requerReotimizacao
      ? `${paradasEmRisco} entrega(s) com janela prestes a expirar. Recomendamos re-otimizar.`
      : 'Todas as entregas estão dentro do prazo.',
  };
}

// ==========================================
// REGISTRO DAS ROTAS
// ==========================================

export default async function reotimizacaoRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // Lista cenários disponíveis
  fastify.get('/cenarios', listarCenariosHandler);

  // Re-otimiza rota
  fastify.post<{ Params: ParamsRota; Body: ReotimizacaoBody }>(
    '/:rotaId',
    reotimizarHandler
  );

  // Verificações automatizadas
  fastify.post<{ Params: ParamsRota }>(
    '/:rotaId/verificar-trafego',
    verificarTrafegoHandler
  );

  fastify.post<{ Params: ParamsRota }>(
    '/:rotaId/verificar-atrasos',
    verificarAtrasosHandler
  );
}
