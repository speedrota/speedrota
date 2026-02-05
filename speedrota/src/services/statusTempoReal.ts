/**
 * @fileoverview Serviço de Status em Tempo Real (Web)
 *
 * DESIGN POR CONTRATO:
 * @description Cliente para SSE e API de status em tempo real
 * @pre Token de autenticação válido
 * @post Conexão SSE estabelecida, eventos recebidos
 *
 * FUNCIONALIDADES:
 * - Conexão SSE para eventos em tempo real
 * - Atualização de status de paradas
 * - Tracking de posição
 * - Métricas em tempo real
 */

import { API_BASE_URL, getToken } from './api';

// ==========================================
// TIPOS
// ==========================================

export enum StatusParada {
  PENDENTE = 'PENDENTE',
  EM_TRANSITO = 'EM_TRANSITO',
  CHEGOU = 'CHEGOU',
  ENTREGUE = 'ENTREGUE',
  FALHA = 'FALHA',
  CANCELADO = 'CANCELADO',
  PULADO = 'PULADO',
}

export enum StatusRota {
  PLANEJADA = 'PLANEJADA',
  EM_ANDAMENTO = 'EM_ANDAMENTO',
  PAUSADA = 'PAUSADA',
  CONCLUIDA = 'CONCLUIDA',
  CANCELADA = 'CANCELADA',
}

export enum MotivoFalha {
  CLIENTE_AUSENTE = 'CLIENTE_AUSENTE',
  ENDERECO_NAO_ENCONTRADO = 'ENDERECO_NAO_ENCONTRADO',
  RECUSADO = 'RECUSADO',
  AVARIADO = 'AVARIADO',
  OUTRO = 'OUTRO',
}

export interface MetricasTempoReal {
  totalParadas: number;
  entregues: number;
  pendentes: number;
  falhas: number;
  progresso: number;
  tempoDecorrido: number;
  tempoEstimadoRestante: number;
  kmPercorridos: number;
  kmRestantes: number;
  velocidadeMedia: number;
  proximaParada?: {
    id: string;
    endereco: string;
    etaMinutos: number;
  };
}

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

export interface Posicao {
  lat: number;
  lng: number;
  heading?: number;
  velocidade?: number;
  precisao?: number;
}

// ==========================================
// SSE CONNECTION
// ==========================================

type EventCallback = (evento: EventoStatus) => void;
let eventSource: EventSource | null = null;
let reconnectTimeout: number | null = null;
const eventListeners: Map<string, EventCallback[]> = new Map();

/**
 * Conecta ao stream SSE de uma rota
 *
 * @pre rotaId válido, token disponível
 * @post Conexão SSE estabelecida
 */
export function conectarSSE(rotaId: string): EventSource | null {
  const token = getToken();
  if (!token) {
    console.error('[SSE] Token não disponível');
    return null;
  }

  // Desconectar se já existir conexão
  desconectarSSE();

  try {
    // Criar URL com token (SSE não suporta headers customizados)
    const url = `${API_BASE_URL}/status/${rotaId}/stream`;
    
    eventSource = new EventSource(url, {
      withCredentials: true,
    });

    eventSource.onopen = () => {
      console.log('[SSE] Conexão estabelecida');
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    };

    eventSource.onmessage = (event) => {
      try {
        const dados = JSON.parse(event.data) as EventoStatus;
        notificarListeners(dados);
      } catch (error) {
        console.error('[SSE] Erro ao parsear evento:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[SSE] Erro na conexão:', error);
      eventSource?.close();
      
      // Tentar reconectar após 5 segundos
      reconnectTimeout = window.setTimeout(() => {
        console.log('[SSE] Tentando reconectar...');
        conectarSSE(rotaId);
      }, 5000);
    };

    return eventSource;
  } catch (error) {
    console.error('[SSE] Erro ao conectar:', error);
    return null;
  }
}

/**
 * Desconecta do stream SSE
 */
export function desconectarSSE(): void {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
}

/**
 * Adiciona listener para eventos
 */
export function adicionarEventListener(
  tipo: EventoStatus['tipo'] | '*',
  callback: EventCallback
): () => void {
  const key = tipo;
  const listeners = eventListeners.get(key) || [];
  listeners.push(callback);
  eventListeners.set(key, listeners);

  // Retorna função para remover listener
  return () => {
    const current = eventListeners.get(key) || [];
    eventListeners.set(
      key,
      current.filter((cb) => cb !== callback)
    );
  };
}

/**
 * Notifica todos os listeners
 */
function notificarListeners(evento: EventoStatus): void {
  // Listeners específicos por tipo
  const listeners = eventListeners.get(evento.tipo) || [];
  listeners.forEach((cb) => cb(evento));

  // Listeners globais
  const globalListeners = eventListeners.get('*') || [];
  globalListeners.forEach((cb) => cb(evento));
}

// ==========================================
// API CALLS
// ==========================================

/**
 * Obtém status atual da rota
 */
export async function obterStatusRota(rotaId: string): Promise<{
  rota: any;
  metricas: MetricasTempoReal;
  paradas: any[];
}> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/status/${rotaId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Erro ao obter status');
  }

  return response.json();
}

/**
 * Inicia uma rota
 */
export async function iniciarRota(rotaId: string): Promise<any> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/status/${rotaId}/iniciar`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao iniciar rota');
  }

  return response.json();
}

/**
 * Pausa uma rota
 */
export async function pausarRota(rotaId: string): Promise<any> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/status/${rotaId}/pausar`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao pausar rota');
  }

  return response.json();
}

/**
 * Finaliza uma rota
 */
export async function finalizarRota(rotaId: string): Promise<any> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/status/${rotaId}/finalizar`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao finalizar rota');
  }

  return response.json();
}

/**
 * Atualiza status de uma parada
 */
export async function atualizarStatusParada(
  paradaId: string,
  status: StatusParada,
  dados?: {
    motivoFalha?: MotivoFalha;
    observacao?: string;
    posicao?: Posicao;
  }
): Promise<any> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/status/parada/${paradaId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status,
      ...dados,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao atualizar status');
  }

  return response.json();
}

/**
 * Atualiza posição do entregador
 */
export async function atualizarPosicao(
  rotaId: string,
  posicao: Posicao
): Promise<void> {
  const token = getToken();
  await fetch(`${API_BASE_URL}/status/${rotaId}/posicao`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(posicao),
  });
}

/**
 * Obtém histórico de posições
 */
export async function obterHistoricoPosicoes(
  rotaId: string,
  limite: number = 100
): Promise<Posicao[]> {
  const token = getToken();
  const response = await fetch(
    `${API_BASE_URL}/status/${rotaId}/posicoes?limite=${limite}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Erro ao obter posições');
  }

  const data = await response.json();
  return data.posicoes;
}

// ==========================================
// GEOLOCATION TRACKING
// ==========================================

let watchId: number | null = null;

/**
 * Inicia tracking de posição
 *
 * @pre Permissão de geolocalização concedida
 * @post Posição enviada periodicamente para API
 */
export function iniciarTracking(
  rotaId: string,
  onPosicao?: (posicao: Posicao) => void,
  onErro?: (erro: GeolocationPositionError) => void
): void {
  if (!navigator.geolocation) {
    console.error('[Tracking] Geolocalização não suportada');
    return;
  }

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const posicao: Posicao = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        heading: position.coords.heading ?? undefined,
        velocidade: position.coords.speed
          ? position.coords.speed * 3.6 // m/s para km/h
          : undefined,
        precisao: position.coords.accuracy,
      };

      // Enviar para API
      atualizarPosicao(rotaId, posicao).catch(console.error);

      // Callback
      onPosicao?.(posicao);
    },
    (erro) => {
      console.error('[Tracking] Erro:', erro);
      onErro?.(erro);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000,
    }
  );
}

/**
 * Para tracking de posição
 */
export function pararTracking(): void {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

// ==========================================
// HELPERS
// ==========================================

/**
 * Formata status para exibição
 */
export function formatarStatus(status: StatusParada | StatusRota): string {
  const labels: Record<string, string> = {
    PENDENTE: 'Pendente',
    EM_TRANSITO: 'Em Trânsito',
    CHEGOU: 'Chegou',
    ENTREGUE: 'Entregue',
    FALHA: 'Falha',
    CANCELADO: 'Cancelado',
    PULADO: 'Pulado',
    PLANEJADA: 'Planejada',
    EM_ANDAMENTO: 'Em Andamento',
    PAUSADA: 'Pausada',
    CONCLUIDA: 'Concluída',
    CANCELADA: 'Cancelada',
  };
  return labels[status] || status;
}

/**
 * Obtém cor por status
 */
export function corPorStatus(status: StatusParada | StatusRota): string {
  const cores: Record<string, string> = {
    PENDENTE: '#6b7280',
    EM_TRANSITO: '#3b82f6',
    CHEGOU: '#8b5cf6',
    ENTREGUE: '#22c55e',
    FALHA: '#ef4444',
    CANCELADO: '#9ca3af',
    PULADO: '#f59e0b',
    PLANEJADA: '#6b7280',
    EM_ANDAMENTO: '#3b82f6',
    PAUSADA: '#f59e0b',
    CONCLUIDA: '#22c55e',
    CANCELADA: '#9ca3af',
  };
  return cores[status] || '#6b7280';
}

/**
 * Obtém emoji por status
 */
export function emojiPorStatus(status: StatusParada | StatusRota): string {
  const emojis: Record<string, string> = {
    PENDENTE: '⏳',
    EM_TRANSITO: '🚗',
    CHEGOU: '📍',
    ENTREGUE: '✅',
    FALHA: '❌',
    CANCELADO: '🚫',
    PULADO: '⏭️',
    PLANEJADA: '📋',
    EM_ANDAMENTO: '🚀',
    PAUSADA: '⏸️',
    CONCLUIDA: '🎉',
    CANCELADA: '🚫',
  };
  return emojis[status] || '❓';
}

/**
 * Formata motivo de falha
 */
export function formatarMotivoFalha(motivo: MotivoFalha): string {
  const labels: Record<MotivoFalha, string> = {
    CLIENTE_AUSENTE: 'Cliente Ausente',
    ENDERECO_NAO_ENCONTRADO: 'Endereço Não Encontrado',
    RECUSADO: 'Recusado',
    AVARIADO: 'Produto Avariado',
    OUTRO: 'Outro Motivo',
  };
  return labels[motivo] || motivo;
}

export default {
  conectarSSE,
  desconectarSSE,
  adicionarEventListener,
  obterStatusRota,
  iniciarRota,
  pausarRota,
  finalizarRota,
  atualizarStatusParada,
  atualizarPosicao,
  obterHistoricoPosicoes,
  iniciarTracking,
  pararTracking,
  formatarStatus,
  corPorStatus,
  emojiPorStatus,
  formatarMotivoFalha,
};
