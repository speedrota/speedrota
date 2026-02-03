/**
 * @fileoverview Serviço de Pagamentos com Mercado Pago
 */

import { api } from './api';

// ==========================================
// TIPOS
// ==========================================

export interface PlanoInfo {
  id: string;
  nome: string;
  preco: number;
  precoFormatado: string;
  recursos: string[];
  limites: {
    rotasPorMes: number | null;
    paradasPorRota: number;
    fornecedores: number | null;
    historicosDias: number;
    pdfUpload: boolean;
    apiAccess: boolean;
  };
  popular?: boolean;
}

export interface PreferenceResponse {
  preferenceId: string;
  initPoint: string;
  sandboxInitPoint: string;
}

export interface SubscriptionStatus {
  plano: string;
  expiraEm?: string;
  ativo: boolean;
  rotasNoMes: number;
  limites: PlanoInfo['limites'];
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
