/**
 * @fileoverview Serviço de Re-otimização Dinâmica (Web)
 *
 * CENÁRIOS INTELIGENTES:
 * 1. Cancelamento - Cliente cancelou
 * 2. Tráfego Intenso - Congestionamento detectado
 * 3. Atraso Acumulado - Atrasado vs janela
 * 4. Cliente Ausente - Não encontrado
 * 5. Novo Pedido Urgente - Nova entrega prioritária
 * 6. Endereço Incorreto - Não localizado
 * 7. Reagendamento - Nova janela solicitada
 *
 * DESIGN POR CONTRATO:
 * @pre Rota em andamento
 * @post Rota re-otimizada ou sugestão retornada
 */

import api from './api';

// ==========================================
// TIPOS
// ==========================================

export type MotivoReotimizacao =
  | 'CANCELAMENTO'
  | 'TRAFEGO_INTENSO'
  | 'ATRASO_ACUMULADO'
  | 'CLIENTE_AUSENTE'
  | 'NOVO_PEDIDO_URGENTE'
  | 'ENDERECO_INCORRETO'
  | 'REAGENDAMENTO';

export interface CenarioInfo {
  motivo: MotivoReotimizacao;
  nome: string;
  descricao: string;
  icone: string;
  requerParadaId: boolean;
  acaoAutomatica: string;
}

export interface ReotimizacaoRequest {
  motivo: MotivoReotimizacao;
  paradaId?: string;
  dados?: {
    novaJanelaInicio?: string;
    novaJanelaFim?: string;
    novaParada?: {
      lat: number;
      lng: number;
      endereco: string;
      cidade: string;
      uf: string;
      nome: string;
      fornecedor: string;
      prioridade: 'ALTA' | 'MEDIA' | 'BAIXA';
    };
  };
}

export interface ReotimizacaoResult {
  success: boolean;
  motivo: MotivoReotimizacao;
  mensagem: string;
  acaoTomada: string;
  paradasAlteradas: number;
  novaDistanciaKm?: number;
  novoTempoMin?: number;
  economiaKm?: number;
  economiaMin?: number;
}

export interface VerificacaoTrafego {
  requerReotimizacao: boolean;
  fatorTrafego: number;
  periodo: string;
  sugestao: string;
}

export interface VerificacaoAtrasos {
  requerReotimizacao: boolean;
  paradasEmRisco: number;
  sugestao: string;
}

// ==========================================
// CENÁRIOS LOCAIS (cache)
// ==========================================

const CENARIOS_LOCAL: CenarioInfo[] = [
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
// API CALLS
// ==========================================

/**
 * Lista cenários de re-otimização disponíveis
 * @pre API disponível
 * @post Lista de cenários retornada
 */
export async function listarCenarios(): Promise<CenarioInfo[]> {
  try {
    const response = await api.get<{ cenarios: CenarioInfo[] }>(
      '/reotimizar/cenarios'
    );
    return response.cenarios;
  } catch {
    // Fallback para cache local
    return CENARIOS_LOCAL;
  }
}

/**
 * Re-otimiza rota baseado em cenário
 *
 * @pre rotaId válido, motivo válido
 * @post Rota re-otimizada ou erro informativo
 */
export async function reotimizarRota(
  rotaId: string,
  request: ReotimizacaoRequest
): Promise<ReotimizacaoResult> {
  const response = await api.post<ReotimizacaoResult>(
    `/reotimizar/${rotaId}`,
    request
  );
  return response;
}

/**
 * Verifica se tráfego requer re-otimização
 *
 * @pre rotaId válido
 * @post Sugestão de re-otimização ou não
 */
export async function verificarTrafego(
  rotaId: string
): Promise<VerificacaoTrafego> {
  const response = await api.post<VerificacaoTrafego>(
    `/reotimizar/${rotaId}/verificar-trafego`
  );
  return response;
}

/**
 * Verifica se há atrasos que requerem re-otimização
 *
 * @pre rotaId válido
 * @post Quantidade de paradas em risco
 */
export async function verificarAtrasos(
  rotaId: string
): Promise<VerificacaoAtrasos> {
  const response = await api.post<VerificacaoAtrasos>(
    `/reotimizar/${rotaId}/verificar-atrasos`
  );
  return response;
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

/**
 * Obtém informações de um cenário específico
 */
export function obterCenario(motivo: MotivoReotimizacao): CenarioInfo | undefined {
  return CENARIOS_LOCAL.find(c => c.motivo === motivo);
}

/**
 * Formata mensagem de resultado para exibição
 */
export function formatarResultado(result: ReotimizacaoResult): string {
  const partes = [result.mensagem, result.acaoTomada];

  if (result.economiaKm && result.economiaKm > 0) {
    partes.push(`Economia: ${result.economiaKm.toFixed(1)} km`);
  }
  if (result.economiaMin && result.economiaMin > 0) {
    partes.push(`Tempo: -${result.economiaMin.toFixed(0)} min`);
  }

  return partes.join(' • ');
}

/**
 * Helpers para ações rápidas
 */
export const acoes = {
  cancelar: (rotaId: string, paradaId: string) =>
    reotimizarRota(rotaId, { motivo: 'CANCELAMENTO', paradaId }),

  clienteAusente: (rotaId: string, paradaId: string) =>
    reotimizarRota(rotaId, { motivo: 'CLIENTE_AUSENTE', paradaId }),

  enderecoIncorreto: (rotaId: string, paradaId: string) =>
    reotimizarRota(rotaId, { motivo: 'ENDERECO_INCORRETO', paradaId }),

  trafego: (rotaId: string) =>
    reotimizarRota(rotaId, { motivo: 'TRAFEGO_INTENSO' }),

  atraso: (rotaId: string) =>
    reotimizarRota(rotaId, { motivo: 'ATRASO_ACUMULADO' }),

  reagendar: (
    rotaId: string,
    paradaId: string,
    novaJanelaInicio: string,
    novaJanelaFim: string
  ) =>
    reotimizarRota(rotaId, {
      motivo: 'REAGENDAMENTO',
      paradaId,
      dados: { novaJanelaInicio, novaJanelaFim },
    }),

  novoPedido: (
    rotaId: string,
    novaParada: NonNullable<ReotimizacaoRequest['dados']>['novaParada']
  ) =>
    reotimizarRota(rotaId, {
      motivo: 'NOVO_PEDIDO_URGENTE',
      dados: { novaParada },
    }),
};
