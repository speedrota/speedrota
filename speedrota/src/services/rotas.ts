/**
 * @fileoverview Serviço de Rotas - API Backend
 * 
 * DESIGN POR CONTRATO:
 * @pre Usuário autenticado
 * @post Rotas sincronizadas com banco de dados
 */

import { api } from './api';
import type { Fornecedor } from '../types';

// ==========================================
// TIPOS DA API
// ==========================================

export interface RotaAPI {
  id: string;
  userId: string;
  origemLat: number;
  origemLng: number;
  origemEndereco: string;
  origemFonte: 'gps' | 'manual';
  distanciaTotalKm?: number;
  tempoViagemMin?: number;
  tempoEntregasMin?: number;
  combustivelL?: number;
  custoR?: number;
  status: 'RASCUNHO' | 'CALCULADA' | 'EM_ANDAMENTO' | 'FINALIZADA' | 'CANCELADA';
  incluirRetorno: boolean;
  calculadaEm?: string;
  iniciadaEm?: string;
  finalizadaEm?: string;
  createdAt: string;
  updatedAt: string;
  paradas: ParadaAPI[];
}

export interface ParadaAPI {
  id: string;
  rotaId: string;
  lat: number;
  lng: number;
  endereco: string;
  cidade: string;
  uf: string;
  cep?: string;
  nome: string;
  telefone?: string;
  fornecedor: Fornecedor;
  fonte: 'ocr' | 'manual' | 'pdf';
  confianca: number;
  ordem?: number;
  distanciaAnterior?: number;
  tempoAnterior?: number;
  statusEntrega: 'PENDENTE' | 'ENTREGUE' | 'AUSENTE' | 'RECUSADA' | 'REAGENDADA';
  entregueEm?: string;
  observacao?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRotaData {
  origemLat: number;
  origemLng: number;
  origemEndereco: string;
  origemFonte: 'gps' | 'manual';
  incluirRetorno?: boolean;
}

export interface CreateParadaData {
  lat: number;
  lng: number;
  endereco: string;
  cidade: string;
  uf: string;
  cep?: string;
  nome: string;
  telefone?: string;
  fornecedor: Fornecedor;
  fonte: 'ocr' | 'manual' | 'pdf';
  confianca?: number;
}

export interface RotaCalculada {
  rota: RotaAPI;
  metricas: {
    distanciaTotalKm: number;
    tempoViagemMin: number;
    tempoEntregasMin: number;
    tempoTotalMin: number;
    combustivelL: number;
    custoR: number;
  };
  ordemOtimizada: string[];
}

export interface ListaRotasResponse {
  rotas: RotaAPI[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
}

// ==========================================
// SERVIÇO
// ==========================================

export const rotaService = {
  /**
   * Listar rotas do usuário
   */
  async listar(params?: {
    pagina?: number;
    porPagina?: number;
    status?: string;
    ordenar?: string;
  }): Promise<ListaRotasResponse> {
    const query = new URLSearchParams();
    if (params?.pagina) query.set('pagina', String(params.pagina));
    if (params?.porPagina) query.set('porPagina', String(params.porPagina));
    if (params?.status) query.set('status', params.status);
    if (params?.ordenar) query.set('ordenar', params.ordenar);
    
    const queryString = query.toString();
    return api.get<ListaRotasResponse>(`/rotas${queryString ? '?' + queryString : ''}`);
  },
  
  /**
   * Obter rota por ID
   */
  async obter(id: string): Promise<RotaAPI> {
    return api.get<RotaAPI>(`/rotas/${id}`);
  },
  
  /**
   * Criar nova rota
   */
  async criar(data: CreateRotaData): Promise<RotaAPI> {
    return api.post<RotaAPI>('/rotas', data);
  },
  
  /**
   * Atualizar rota
   */
  async atualizar(id: string, data: Partial<CreateRotaData>): Promise<RotaAPI> {
    return api.patch<RotaAPI>(`/rotas/${id}`, data);
  },
  
  /**
   * Excluir rota
   */
  async excluir(id: string): Promise<void> {
    await api.delete(`/rotas/${id}`);
  },
  
  /**
   * Adicionar parada à rota
   */
  async adicionarParada(rotaId: string, parada: CreateParadaData): Promise<ParadaAPI> {
    return api.post<ParadaAPI>(`/rotas/${rotaId}/paradas`, parada);
  },
  
  /**
   * Adicionar múltiplas paradas de uma vez
   */
  async adicionarParadasBatch(rotaId: string, paradas: CreateParadaData[]): Promise<ParadaAPI[]> {
    return api.post<ParadaAPI[]>(`/rotas/${rotaId}/paradas/batch`, { paradas });
  },
  
  /**
   * Atualizar parada
   */
  async atualizarParada(
    rotaId: string, 
    paradaId: string, 
    data: Partial<CreateParadaData & { statusEntrega?: string; observacao?: string }>
  ): Promise<ParadaAPI> {
    return api.patch<ParadaAPI>(`/rotas/${rotaId}/paradas/${paradaId}`, data);
  },
  
  /**
   * Remover parada
   */
  async removerParada(rotaId: string, paradaId: string): Promise<void> {
    await api.delete(`/rotas/${rotaId}/paradas/${paradaId}`);
  },
  
  /**
   * Calcular rota otimizada (Nearest Neighbor TSP)
   */
  async calcular(rotaId: string): Promise<RotaCalculada> {
    return api.post<RotaCalculada>(`/rotas/${rotaId}/calcular`);
  },
  
  /**
   * Iniciar rota (mudar status para EM_ANDAMENTO)
   */
  async iniciar(id: string): Promise<RotaAPI> {
    return api.post<RotaAPI>(`/rotas/${id}/iniciar`);
  },
  
  /**
   * Finalizar rota
   */
  async finalizar(id: string): Promise<RotaAPI> {
    return api.post<RotaAPI>(`/rotas/${id}/finalizar`);
  },
  
  /**
   * Marcar entrega como feita
   */
  async marcarEntregue(rotaId: string, paradaId: string, observacao?: string): Promise<ParadaAPI> {
    return api.post<ParadaAPI>(`/rotas/${rotaId}/paradas/${paradaId}/entregar`, { observacao });
  },
};

export default rotaService;
