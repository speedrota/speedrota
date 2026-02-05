/**
 * @fileoverview Serviço de Status em Tempo Real
 *
 * DESIGN POR CONTRATO:
 * @description Gerencia status de entregas e rotas com SSE (Server-Sent Events)
 * @pre Usuário autenticado, rota existente
 * @post Status atualizado e broadcast enviado via SSE
 * @invariant Status segue fluxo: PENDENTE → EM_TRANSITO → ENTREGUE|FALHA
 *
 * FUNCIONALIDADES:
 * - Atualização de status de paradas
 * - Tracking de posição do entregador
 * - Broadcast SSE para clientes conectados
 * - Histórico de atualizações
 * - Métricas de tempo real
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// ==========================================
// TIPOS
// ==========================================

/**
 * Status possíveis de uma parada
 */
export enum StatusParada {
  PENDENTE = 'PENDENTE',
  EM_TRANSITO = 'EM_TRANSITO',
  CHEGOU = 'CHEGOU',
  ENTREGUE = 'ENTREGUE',
  FALHA = 'FALHA',
  CANCELADO = 'CANCELADO',
  PULADO = 'PULADO',
}

/**
 * Status da rota
 */
export enum StatusRota {
  PLANEJADA = 'PLANEJADA',
  EM_ANDAMENTO = 'EM_ANDAMENTO',
  PAUSADA = 'PAUSADA',
  CONCLUIDA = 'CONCLUIDA',
  CANCELADA = 'CANCELADA',
}

/**
 * Motivos de falha
 */
export enum MotivoFalha {
  CLIENTE_AUSENTE = 'CLIENTE_AUSENTE',
  ENDERECO_NAO_ENCONTRADO = 'ENDERECO_NAO_ENCONTRADO',
  RECUSADO = 'RECUSADO',
  AVARIADO = 'AVARIADO',
  OUTRO = 'OUTRO',
}

/**
 * Evento de atualização de status
 */
export interface EventoStatus {
  tipo: 'STATUS_PARADA' | 'STATUS_ROTA' | 'POSICAO' | 'METRICAS' | 'ALERTA';
  rotaId: string;
  paradaId?: string;
  dados: {
    status?: StatusParada | StatusRota;
    posicao?: { lat: number; lng: number };
    timestamp: Date;
    motivoFalha?: MotivoFalha;
    observacao?: string;
    metricas?: MetricasTempoReal;
  };
}

/**
 * Métricas em tempo real
 */
export interface MetricasTempoReal {
  totalParadas: number;
  entregues: number;
  pendentes: number;
  falhas: number;
  progresso: number; // 0-100%
  tempoDecorrido: number; // minutos
  tempoEstimadoRestante: number; // minutos
  kmPercorridos: number;
  kmRestantes: number;
  velocidadeMedia: number; // km/h
  proximaParada?: {
    id: string;
    endereco: string;
    etaMinutos: number;
  };
}

/**
 * Posição do entregador
 */
export interface PosicaoEntregador {
  lat: number;
  lng: number;
  heading?: number; // 0-360 graus
  velocidade?: number; // km/h
  precisao?: number; // metros
  timestamp: Date;
}

// ==========================================
// STORE DE CONEXÕES SSE
// ==========================================

type SSEClient = {
  id: string;
  userId: string;
  rotaId: string;
  enviar: (evento: EventoStatus) => void;
};

const clientesSSE: Map<string, SSEClient> = new Map();

// ==========================================
// FUNÇÕES PRINCIPAIS
// ==========================================

/**
 * Registra cliente SSE
 *
 * @pre clientId único, userId e rotaId válidos
 * @post Cliente adicionado ao Map de conexões
 */
export function registrarClienteSSE(
  clientId: string,
  userId: string,
  rotaId: string,
  enviar: (evento: EventoStatus) => void
): void {
  clientesSSE.set(clientId, { id: clientId, userId, rotaId, enviar });
  console.log(`[SSE] Cliente registrado: ${clientId} para rota ${rotaId}`);
}

/**
 * Remove cliente SSE
 */
export function removerClienteSSE(clientId: string): void {
  clientesSSE.delete(clientId);
  console.log(`[SSE] Cliente removido: ${clientId}`);
}

/**
 * Broadcast evento para todos os clientes de uma rota
 *
 * @pre rotaId válido
 * @post Evento enviado para todos os clientes conectados à rota
 */
export function broadcastParaRota(rotaId: string, evento: EventoStatus): void {
  let enviados = 0;
  clientesSSE.forEach((cliente) => {
    if (cliente.rotaId === rotaId) {
      try {
        cliente.enviar(evento);
        enviados++;
      } catch (error) {
        console.error(`[SSE] Erro ao enviar para ${cliente.id}:`, error);
        removerClienteSSE(cliente.id);
      }
    }
  });
  console.log(`[SSE] Broadcast para rota ${rotaId}: ${enviados} clientes`);
}

/**
 * Atualiza status de uma parada
 *
 * @pre paradaId existe, novoStatus é válido
 * @post Status atualizado no DB, evento broadcast enviado
 * @throws Error se parada não existir ou transição inválida
 */
export async function atualizarStatusParada(
  paradaId: string,
  novoStatus: StatusParada,
  dados: {
    motivoFalha?: MotivoFalha;
    observacao?: string;
    posicao?: PosicaoEntregador;
  } = {}
): Promise<{
  parada: any;
  metricas: MetricasTempoReal;
}> {
  // Buscar parada atual
  const parada = await prisma.parada.findUnique({
    where: { id: paradaId },
    include: { rota: true },
  });

  if (!parada) {
    throw new Error(`Parada ${paradaId} não encontrada`);
  }

  // Validar transição de status
  validarTransicaoStatus(parada.status as StatusParada, novoStatus);

  // Preparar dados de atualização
  const dadosAtualizacao: Prisma.ParadaUpdateInput = {
    status: novoStatus,
    ...(novoStatus === StatusParada.ENTREGUE && { entregueEm: new Date() }),
    ...(novoStatus === StatusParada.FALHA && {
      motivoFalha: dados.motivoFalha,
      observacaoFalha: dados.observacao,
    }),
  };

  // Atualizar parada
  const paradaAtualizada = await prisma.parada.update({
    where: { id: paradaId },
    data: dadosAtualizacao,
  });

  // Registrar histórico
  await registrarHistoricoStatus(paradaId, parada.rotaId, novoStatus, dados);

  // Calcular métricas atualizadas
  const metricas = await calcularMetricasTempoReal(parada.rotaId);

  // Broadcast evento
  const evento: EventoStatus = {
    tipo: 'STATUS_PARADA',
    rotaId: parada.rotaId,
    paradaId,
    dados: {
      status: novoStatus,
      timestamp: new Date(),
      motivoFalha: dados.motivoFalha,
      observacao: dados.observacao,
      metricas,
    },
  };
  broadcastParaRota(parada.rotaId, evento);

  // Atualizar status da rota se necessário
  await atualizarStatusRotaSeNecessario(parada.rotaId, metricas);

  return { parada: paradaAtualizada, metricas };
}

/**
 * Atualiza posição do entregador
 *
 * @pre rotaId existe, posição válida
 * @post Posição atualizada no DB, broadcast enviado
 */
export async function atualizarPosicaoEntregador(
  rotaId: string,
  posicao: PosicaoEntregador
): Promise<void> {
  // Salvar posição no histórico
  await prisma.posicaoHistorico.create({
    data: {
      rotaId,
      lat: posicao.lat,
      lng: posicao.lng,
      heading: posicao.heading,
      velocidade: posicao.velocidade,
      precisao: posicao.precisao,
      timestamp: posicao.timestamp,
    },
  });

  // Atualizar última posição na rota
  await prisma.rota.update({
    where: { id: rotaId },
    data: {
      ultimaLat: posicao.lat,
      ultimaLng: posicao.lng,
      ultimaPosicaoEm: posicao.timestamp,
    },
  });

  // Broadcast
  const evento: EventoStatus = {
    tipo: 'POSICAO',
    rotaId,
    dados: {
      posicao: { lat: posicao.lat, lng: posicao.lng },
      timestamp: posicao.timestamp,
    },
  };
  broadcastParaRota(rotaId, evento);
}

/**
 * Inicia uma rota
 *
 * @pre rotaId existe, status atual é PLANEJADA
 * @post Status mudado para EM_ANDAMENTO, timestamp registrado
 */
export async function iniciarRota(rotaId: string): Promise<any> {
  const rota = await prisma.rota.findUnique({ where: { id: rotaId } });

  if (!rota) {
    throw new Error(`Rota ${rotaId} não encontrada`);
  }

  if (rota.status !== StatusRota.PLANEJADA && rota.status !== StatusRota.PAUSADA) {
    throw new Error(`Rota não pode ser iniciada. Status atual: ${rota.status}`);
  }

  const rotaAtualizada = await prisma.rota.update({
    where: { id: rotaId },
    data: {
      status: StatusRota.EM_ANDAMENTO,
      iniciadaEm: rota.iniciadaEm || new Date(),
    },
  });

  // Broadcast
  const metricas = await calcularMetricasTempoReal(rotaId);
  const evento: EventoStatus = {
    tipo: 'STATUS_ROTA',
    rotaId,
    dados: {
      status: StatusRota.EM_ANDAMENTO,
      timestamp: new Date(),
      metricas,
    },
  };
  broadcastParaRota(rotaId, evento);

  return rotaAtualizada;
}

/**
 * Pausa uma rota
 */
export async function pausarRota(rotaId: string): Promise<any> {
  const rota = await prisma.rota.update({
    where: { id: rotaId },
    data: { status: StatusRota.PAUSADA },
  });

  const evento: EventoStatus = {
    tipo: 'STATUS_ROTA',
    rotaId,
    dados: {
      status: StatusRota.PAUSADA,
      timestamp: new Date(),
    },
  };
  broadcastParaRota(rotaId, evento);

  return rota;
}

/**
 * Finaliza uma rota
 */
export async function finalizarRota(rotaId: string): Promise<any> {
  const metricas = await calcularMetricasTempoReal(rotaId);

  const rota = await prisma.rota.update({
    where: { id: rotaId },
    data: {
      status: StatusRota.CONCLUIDA,
      finalizadaEm: new Date(),
      entregasRealizadas: metricas.entregues,
      entregasFalhas: metricas.falhas,
    },
  });

  const evento: EventoStatus = {
    tipo: 'STATUS_ROTA',
    rotaId,
    dados: {
      status: StatusRota.CONCLUIDA,
      timestamp: new Date(),
      metricas,
    },
  };
  broadcastParaRota(rotaId, evento);

  return rota;
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

/**
 * Valida transição de status
 *
 * @pre statusAtual e novoStatus são StatusParada válidos
 * @post Retorna void se válido, throw se inválido
 */
function validarTransicaoStatus(
  statusAtual: StatusParada,
  novoStatus: StatusParada
): void {
  const transicoesValidas: Record<StatusParada, StatusParada[]> = {
    [StatusParada.PENDENTE]: [
      StatusParada.EM_TRANSITO,
      StatusParada.CANCELADO,
      StatusParada.PULADO,
    ],
    [StatusParada.EM_TRANSITO]: [
      StatusParada.CHEGOU,
      StatusParada.ENTREGUE,
      StatusParada.FALHA,
      StatusParada.PULADO,
    ],
    [StatusParada.CHEGOU]: [
      StatusParada.ENTREGUE,
      StatusParada.FALHA,
    ],
    [StatusParada.ENTREGUE]: [], // Estado final
    [StatusParada.FALHA]: [StatusParada.EM_TRANSITO], // Pode retentar
    [StatusParada.CANCELADO]: [], // Estado final
    [StatusParada.PULADO]: [StatusParada.EM_TRANSITO], // Pode voltar
  };

  const permitidas = transicoesValidas[statusAtual] || [];
  if (!permitidas.includes(novoStatus)) {
    throw new Error(
      `Transição inválida: ${statusAtual} → ${novoStatus}. ` +
      `Permitidas: ${permitidas.join(', ') || 'nenhuma'}`
    );
  }
}

/**
 * Registra histórico de status
 */
async function registrarHistoricoStatus(
  paradaId: string,
  rotaId: string,
  status: StatusParada,
  dados: {
    motivoFalha?: MotivoFalha;
    observacao?: string;
    posicao?: PosicaoEntregador;
  }
): Promise<void> {
  await prisma.statusHistorico.create({
    data: {
      paradaId,
      rotaId,
      status,
      motivoFalha: dados.motivoFalha,
      observacao: dados.observacao,
      lat: dados.posicao?.lat,
      lng: dados.posicao?.lng,
      timestamp: new Date(),
    },
  });
}

/**
 * Calcula métricas em tempo real
 *
 * @pre rotaId existe
 * @post Retorna métricas atualizadas
 */
export async function calcularMetricasTempoReal(
  rotaId: string
): Promise<MetricasTempoReal> {
  const rota = await prisma.rota.findUnique({
    where: { id: rotaId },
    include: {
      paradas: {
        orderBy: { ordem: 'asc' },
      },
    },
  });

  if (!rota) {
    throw new Error(`Rota ${rotaId} não encontrada`);
  }

  const paradas = rota.paradas;
  const totalParadas = paradas.length;

  // Contadores
  const entregues = paradas.filter((p) => p.status === StatusParada.ENTREGUE).length;
  const falhas = paradas.filter((p) => p.status === StatusParada.FALHA).length;
  const cancelados = paradas.filter((p) => p.status === StatusParada.CANCELADO).length;
  const pulados = paradas.filter((p) => p.status === StatusParada.PULADO).length;
  const pendentes = totalParadas - entregues - falhas - cancelados - pulados;

  // Progresso
  const progresso = totalParadas > 0
    ? Math.round(((entregues + falhas + cancelados + pulados) / totalParadas) * 100)
    : 0;

  // Tempo decorrido
  const iniciadaEm = rota.iniciadaEm ? new Date(rota.iniciadaEm) : null;
  const tempoDecorrido = iniciadaEm
    ? Math.round((Date.now() - iniciadaEm.getTime()) / 60000)
    : 0;

  // Estimativa de tempo restante (baseado na média)
  const tempoMedioPorParada = entregues > 0 ? tempoDecorrido / entregues : 5;
  const tempoEstimadoRestante = Math.round(pendentes * tempoMedioPorParada);

  // Distâncias (estimativa baseada nas paradas)
  const kmTotal = rota.distanciaTotal || 0;
  const kmPercorridos = totalParadas > 0
    ? (kmTotal * (totalParadas - pendentes)) / totalParadas
    : 0;
  const kmRestantes = kmTotal - kmPercorridos;

  // Velocidade média
  const velocidadeMedia = tempoDecorrido > 0
    ? (kmPercorridos / tempoDecorrido) * 60
    : 0;

  // Próxima parada
  const proximaParada = paradas.find(
    (p) => p.status === StatusParada.PENDENTE || p.status === StatusParada.EM_TRANSITO
  );

  return {
    totalParadas,
    entregues,
    pendentes,
    falhas,
    progresso,
    tempoDecorrido,
    tempoEstimadoRestante,
    kmPercorridos: Math.round(kmPercorridos * 10) / 10,
    kmRestantes: Math.round(kmRestantes * 10) / 10,
    velocidadeMedia: Math.round(velocidadeMedia * 10) / 10,
    proximaParada: proximaParada
      ? {
          id: proximaParada.id,
          endereco: proximaParada.endereco,
          etaMinutos: Math.round(tempoMedioPorParada),
        }
      : undefined,
  };
}

/**
 * Atualiza status da rota baseado nas métricas
 */
async function atualizarStatusRotaSeNecessario(
  rotaId: string,
  metricas: MetricasTempoReal
): Promise<void> {
  // Se 100% concluído, finalizar rota
  if (metricas.progresso === 100) {
    await finalizarRota(rotaId);
  }
}

/**
 * Obtém status atual da rota com métricas
 */
export async function obterStatusRota(rotaId: string): Promise<{
  rota: any;
  metricas: MetricasTempoReal;
  paradas: any[];
}> {
  const rota = await prisma.rota.findUnique({
    where: { id: rotaId },
    include: {
      paradas: {
        orderBy: { ordem: 'asc' },
        select: {
          id: true,
          ordem: true,
          endereco: true,
          status: true,
          entregueEm: true,
          motivoFalha: true,
          lat: true,
          lng: true,
        },
      },
    },
  });

  if (!rota) {
    throw new Error(`Rota ${rotaId} não encontrada`);
  }

  const metricas = await calcularMetricasTempoReal(rotaId);

  return { rota, metricas, paradas: rota.paradas };
}

/**
 * Obtém histórico de posições
 */
export async function obterHistoricoPosicoes(
  rotaId: string,
  limite: number = 100
): Promise<PosicaoEntregador[]> {
  const posicoes = await prisma.posicaoHistorico.findMany({
    where: { rotaId },
    orderBy: { timestamp: 'desc' },
    take: limite,
  });

  return posicoes.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    heading: p.heading ?? undefined,
    velocidade: p.velocidade ?? undefined,
    precisao: p.precisao ?? undefined,
    timestamp: p.timestamp,
  }));
}

/**
 * Obtém histórico de status de uma parada
 */
export async function obterHistoricoStatusParada(
  paradaId: string
): Promise<any[]> {
  return prisma.statusHistorico.findMany({
    where: { paradaId },
    orderBy: { timestamp: 'asc' },
  });
}

// ==========================================
// EXPORTS
// ==========================================

export default {
  // SSE
  registrarClienteSSE,
  removerClienteSSE,
  broadcastParaRota,

  // Status
  atualizarStatusParada,
  atualizarPosicaoEntregador,

  // Rota
  iniciarRota,
  pausarRota,
  finalizarRota,
  obterStatusRota,

  // Métricas
  calcularMetricasTempoReal,

  // Histórico
  obterHistoricoPosicoes,
  obterHistoricoStatusParada,
};
