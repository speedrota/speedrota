/**
 * @fileoverview Store de Autenticação com Zustand
 * 
 * DESIGN POR CONTRATO:
 * @pre Serviço de auth disponível
 * @post Estado de autenticação sincronizado com localStorage
 */

import { create } from 'zustand';
import { authService, type User, type UserStats } from '../services/auth';
import type { Plano } from '../types';

// ==========================================
// INTERFACE DO STORE
// ==========================================

interface AuthState {
  // Estado
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  stats: UserStats | null;
  
  // Actions
  login: (email: string, senha: string) => Promise<boolean>;
  register: (data: { email: string; senha: string; nome: string; telefone?: string; tipoUsuario?: 'ENTREGADOR' | 'GESTOR_FROTA' }) => Promise<boolean>;
  logout: () => void;
  loadUser: () => Promise<void>;
  updateProfile: (data: { nome?: string; telefone?: string }) => Promise<boolean>;
  changePassword: (senhaAtual: string, novaSenha: string) => Promise<boolean>;
  loadStats: () => Promise<void>;
  clearError: () => void;
  
  // Getters
  getLimites: () => { rotasPorMes: number; paradasPorRota: number; fornecedores: number };
  podecriarRota: () => boolean;
}

// ==========================================
// LIMITES POR PLANO
// ==========================================

const LIMITES_PLANO: Record<Plano, { rotasPorMes: number; paradasPorRota: number; fornecedores: number }> = {
  FREE: { rotasPorMes: 5, paradasPorRota: 10, fornecedores: 3 },
  STARTER: { rotasPorMes: 20, paradasPorRota: 20, fornecedores: 5 },
  PRO: { rotasPorMes: 50, paradasPorRota: 30, fornecedores: 8 },
  FULL: { rotasPorMes: 999, paradasPorRota: 100, fornecedores: 14 },
  FROTA_START: { rotasPorMes: 999, paradasPorRota: 50, fornecedores: 14 },
  FROTA_PRO: { rotasPorMes: 999999, paradasPorRota: 100, fornecedores: 14 },
  FROTA_ENTERPRISE: { rotasPorMes: 999999, paradasPorRota: 500, fornecedores: 14 },
  ENTERPRISE: { rotasPorMes: 999999, paradasPorRota: 500, fornecedores: 14 }, // legacy
};

// ==========================================
// STORE
// ==========================================

export const useAuthStore = create<AuthState>((set, get) => ({
  // Estado inicial
  user: authService.getCachedUser(),
  token: localStorage.getItem('speedrota_token'),
  isAuthenticated: authService.isLoggedIn(),
  isLoading: false,
  error: null,
  stats: null,
  
  // ----------------------------------------
  // LOGIN
  // ----------------------------------------
  
  login: async (email, senha) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await authService.login({ email, senha });
      set({ 
        user: response.user,
        token: localStorage.getItem('speedrota_token'),
        isAuthenticated: true, 
        isLoading: false,
      });
      return true;
    } catch (error: any) {
      set({ 
        error: error.message || 'Erro ao fazer login', 
        isLoading: false,
      });
      return false;
    }
  },
  
  // ----------------------------------------
  // REGISTRO
  // ----------------------------------------
  
  register: async (data) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await authService.register(data);
      set({ 
        user: response.user,
        token: localStorage.getItem('speedrota_token'),
        isAuthenticated: true, 
        isLoading: false,
      });
      return true;
    } catch (error: any) {
      set({ 
        error: error.message || 'Erro ao criar conta', 
        isLoading: false,
      });
      return false;
    }
  },
  
  // ----------------------------------------
  // LOGOUT
  // ----------------------------------------
  
  logout: () => {
    authService.logout();
    set({ 
      user: null,
      token: null,
      isAuthenticated: false, 
      stats: null,
      error: null,
    });
  },
  
  // ----------------------------------------
  // CARREGAR USUÁRIO
  // ----------------------------------------
  
  loadUser: async () => {
    if (!authService.isLoggedIn()) {
      set({ isAuthenticated: false, user: null });
      return;
    }
    
    set({ isLoading: true });
    
    try {
      const user = await authService.me();
      set({ user, token: localStorage.getItem('speedrota_token'), isAuthenticated: true, isLoading: false });
    } catch {
      // Token inválido/expirado
      authService.logout();
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },
  
  // ----------------------------------------
  // ATUALIZAR PERFIL
  // ----------------------------------------
  
  updateProfile: async (data) => {
    set({ isLoading: true, error: null });
    
    try {
      const user = await authService.updateProfile(data);
      set({ user, isLoading: false });
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },
  
  // ----------------------------------------
  // TROCAR SENHA
  // ----------------------------------------
  
  changePassword: async (senhaAtual, novaSenha) => {
    set({ isLoading: true, error: null });
    
    try {
      await authService.changePassword(senhaAtual, novaSenha);
      set({ isLoading: false });
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },
  
  // ----------------------------------------
  // CARREGAR ESTATÍSTICAS
  // ----------------------------------------
  
  loadStats: async () => {
    try {
      const stats = await authService.getStats();
      set({ stats });
    } catch {
      // Silencioso - stats são opcionais
    }
  },
  
  // ----------------------------------------
  // LIMPAR ERRO
  // ----------------------------------------
  
  clearError: () => set({ error: null }),
  
  // ----------------------------------------
  // GETTERS
  // ----------------------------------------
  
  getLimites: () => {
    const { user } = get();
    const plano = user?.plano || 'FREE';
    return LIMITES_PLANO[plano];
  },
  
  podecriarRota: () => {
    const { user } = get();
    if (!user) return false;
    
    const limites = LIMITES_PLANO[user.plano];
    return user.rotasNoMes < limites.rotasPorMes;
  },
}));

export default useAuthStore;
