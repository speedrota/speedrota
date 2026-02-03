/**
 * @fileoverview Serviço de Autenticação
 * 
 * DESIGN POR CONTRATO:
 * @pre Email e senha válidos para login/registro
 * @post Token JWT armazenado em localStorage
 * @invariant Usuário permanece autenticado até logout ou expiração
 */

import { api, tokenManager } from './api';
import type { Plano } from '../types';

// ==========================================
// TIPOS
// ==========================================

export interface User {
  id: string;
  email: string;
  nome: string;
  telefone?: string;
  plano: Plano;
  rotasNoMes: number;
  createdAt: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken?: string;
}

export interface RegisterData {
  email: string;
  senha: string;
  nome: string;
  telefone?: string;
}

export interface LoginData {
  email: string;
  senha: string;
}

export interface UserStats {
  totalRotas: number;
  rotasNoMes: number;
  totalParadas: number;
  totalDistanciaKm: number;
  rotasFinalizadas: number;
  mediaParadasPorRota: number;
}

// ==========================================
// SERVIÇO
// ==========================================

export const authService = {
  /**
   * Registrar novo usuário
   * 
   * @pre email único, senha >= 6 chars, nome preenchido
   * @post Usuário criado e logado automaticamente
   */
  async register(data: RegisterData): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/register', data);
    
    // Salvar tokens
    tokenManager.setToken(response.token);
    if (response.refreshToken) {
      tokenManager.setRefreshToken(response.refreshToken);
    }
    tokenManager.setStoredUser(response.user);
    
    return response;
  },
  
  /**
   * Login de usuário existente
   * 
   * @pre Email e senha corretos
   * @post Token JWT válido por 7 dias
   */
  async login(data: LoginData): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login', data);
    
    // Salvar tokens
    tokenManager.setToken(response.token);
    if (response.refreshToken) {
      tokenManager.setRefreshToken(response.refreshToken);
    }
    tokenManager.setStoredUser(response.user);
    
    return response;
  },
  
  /**
   * Logout - limpa tokens locais
   */
  logout(): void {
    tokenManager.clearTokens();
  },
  
  /**
   * Obter dados do usuário atual
   * 
   * @pre Token válido
   * @post Dados atualizados do usuário
   */
  async me(): Promise<User> {
    const user = await api.get<User>('/auth/me');
    tokenManager.setStoredUser(user);
    return user;
  },
  
  /**
   * Atualizar perfil
   */
  async updateProfile(data: { nome?: string; telefone?: string }): Promise<User> {
    const user = await api.patch<User>('/users/profile', data);
    tokenManager.setStoredUser(user);
    return user;
  },
  
  /**
   * Trocar senha
   */
  async changePassword(senhaAtual: string, novaSenha: string): Promise<void> {
    await api.post('/users/change-password', { senhaAtual, novaSenha });
  },
  
  /**
   * Obter estatísticas do usuário
   */
  async getStats(): Promise<UserStats> {
    return api.get<UserStats>('/users/stats');
  },
  
  /**
   * Excluir conta
   */
  async deleteAccount(senha: string): Promise<void> {
    await api.delete('/users/account?senha=' + encodeURIComponent(senha));
    tokenManager.clearTokens();
  },
  
  /**
   * Verificar se está logado (localmente)
   */
  isLoggedIn(): boolean {
    return !!tokenManager.getToken();
  },
  
  /**
   * Obter usuário do cache local
   */
  getCachedUser(): User | null {
    return tokenManager.getStoredUser<User>();
  },
};

export default authService;
