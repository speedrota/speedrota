/**
 * @fileoverview Serviço de Pagamentos com Mercado Pago
 * 
 * Atualizado com novos planos conforme análise competitiva (Fev/2026)
 * @see SpeedRota_Pricing_Brasil_Revisado.docx
 */

import { api } from './api';
import type { Plano } from '../types';

// ==========================================
// TIPOS
// ==========================================

export interface PlanoInfo {
  id: Plano;
  nome: string;
  preco: number;
  precoFormatado: string;
  precoAnual?: number;
  categoria: 'individual' | 'frota';
  recursos: string[];
  limites: {
    rotasPorMes: number | null;
    paradasPorRota: number;
    fornecedores: number | null;
    historicosDias: number;
    pdfUpload: boolean;
    apiAccess: boolean;
    maxMotoristas?: number;
  };
  popular?: boolean;
  destaque?: string; // "MAIS POPULAR", "MELHOR CUSTO-BENEFÍCIO"
}

export interface Promocao {
  codigo: string;
  nome: string;
  desconto: number; // percentual
  meses: number;
  planosAplicaveis: Plano[];
  ativo: boolean;
  validoAte?: string;
}

export interface PreferenceResponse {
  preferenceId: string;
  initPoint: string;
  sandboxInitPoint: string;
}

export interface SubscriptionStatus {
  plano: Plano;
  expiraEm?: string;
  ativo: boolean;
  rotasNoMes: number;
  limites: PlanoInfo['limites'];
  promocaoAtiva?: string;
  descontoAtivo?: number;
}

// ==========================================
// SERVIÇO
// ==========================================

export const pagamentoService = {
  /**
   * Listar planos disponíveis
   */
  async listarPlanos(): Promise<PlanoInfo[]> {
    const response = await api.get<{ data: PlanoInfo[] }>('/pagamentos/plans');
    return (response as any).data || response;
  },
  
  /**
   * Criar preferência de pagamento (inicia checkout)
   */
  async criarPreferencia(plano: 'PRO' | 'FULL'): Promise<PreferenceResponse> {
    const response = await api.post<{ data: PreferenceResponse }>('/pagamentos/create-preference', { plano });
    return (response as any).data || response;
  },
  
  /**
   * Confirmar upgrade após retorno do Mercado Pago
   */
  async confirmarUpgrade(plano: string, paymentId?: string): Promise<{ plano: string; mensagem: string }> {
    const response = await api.post<{ data: { plano: string; mensagem: string } }>('/pagamentos/confirm-upgrade', { plano, paymentId });
    return (response as any).data || response;
  },
  
  /**
   * Verificar status do pagamento
   */
  async verificarPagamento(paymentId: string): Promise<{ status: string; approved: boolean }> {
    const response = await api.get<{ data: { status: string; approved: boolean } }>(`/pagamentos/payment-status/${paymentId}`);
    return (response as any).data || response;
  },
  
  /**
   * Obter status da assinatura atual
   */
  async obterAssinatura(): Promise<SubscriptionStatus> {
    const response = await api.get<{ data: SubscriptionStatus }>('/pagamentos/subscription');
    return (response as any).data || response;
  },
  
  /**
   * Obter public key do Mercado Pago
   */
  async obterPublicKey(): Promise<string> {
    const response = await api.get<{ data: { publicKey: string } }>('/pagamentos/public-key');
    return ((response as any).data || response).publicKey;
  },
};

export default pagamentoService;
