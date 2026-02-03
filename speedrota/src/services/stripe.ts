/**
 * @fileoverview Serviço de Pagamentos Stripe
 */

import { api } from './api';

// ==========================================
// TIPOS
// ==========================================

export interface PlanoInfo {
  id: string;
  nome: string;
  preco: number;
  precoAnual?: number;
  recursos: string[];
  limites: {
    rotasPorMes: number;
    paradasPorRota: number;
    fornecedores: number;
  };
  popular?: boolean;
}

export interface SubscriptionStatus {
  ativo: boolean;
  plano: string;
  expiraEm?: string;
  stripeSubscriptionId?: string;
  canceladoEm?: string;
  proximaCobranca?: string;
}

export interface CheckoutSession {
  url: string;
  sessionId: string;
}

// ==========================================
// SERVIÇO
// ==========================================

export const stripeService = {
  /**
   * Listar planos disponíveis
   */
  async listarPlanos(): Promise<PlanoInfo[]> {
    return api.get<PlanoInfo[]>('/stripe/plans');
  },
  
  /**
   * Criar sessão de checkout para upgrade
   */
  async criarCheckout(plano: 'PRO' | 'FULL'): Promise<CheckoutSession> {
    return api.post<CheckoutSession>('/stripe/create-checkout-session', { plano });
  },
  
  /**
   * Abrir portal do cliente Stripe (gerenciar assinatura)
   */
  async abrirPortal(): Promise<{ url: string }> {
    return api.post<{ url: string }>('/stripe/create-portal-session');
  },
  
  /**
   * Verificar status da assinatura
   */
  async verificarAssinatura(): Promise<SubscriptionStatus> {
    return api.get<SubscriptionStatus>('/stripe/subscription');
  },
};

export default stripeService;
