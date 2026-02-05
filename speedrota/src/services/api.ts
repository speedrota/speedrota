/**
 * @fileoverview Cliente API para comunicação com backend SpeedRota
 * 
 * DESIGN POR CONTRATO:
 * @pre API backend rodando em API_BASE_URL
 * @post Requisições autenticadas com JWT quando necessário
 * @invariant Erros tratados e convertidos para formato padrão
 */

// ==========================================
// CONFIGURAÇÃO
// ==========================================

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

// Helper para obter token (alias para compatibilidade)
export const getToken = (): string | null => {
  return localStorage.getItem('speedrota_token');
};

// ==========================================
// TIPOS
// ==========================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: Record<string, string[]>;
}

export interface ApiError {
  message: string;
  status: number;
  details?: Record<string, string[]>;
}

// ==========================================
// STORAGE KEYS
// ==========================================

const TOKEN_KEY = 'speedrota_token';
const REFRESH_TOKEN_KEY = 'speedrota_refresh_token';
const USER_KEY = 'speedrota_user';

// ==========================================
// TOKEN MANAGEMENT
// ==========================================

export const tokenManager = {
  getToken: (): string | null => {
    return localStorage.getItem(TOKEN_KEY);
  },
  
  setToken: (token: string): void => {
    localStorage.setItem(TOKEN_KEY, token);
  },
  
  getRefreshToken: (): string | null => {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  
  setRefreshToken: (token: string): void => {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  },
  
  clearTokens: (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  
  getStoredUser: <T>(): T | null => {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  },
  
  setStoredUser: <T>(user: T): void => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
};

// ==========================================
// FETCH WRAPPER
// ==========================================

/**
 * Requisição HTTP com tratamento de erros e autenticação
 * 
 * @pre url é um endpoint válido
 * @post Retorna dados ou lança ApiError
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Headers padrão
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  // Adicionar token se disponível
  const token = tokenManager.getToken();
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    // Parse da resposta
    const data = await response.json();
    
    // Erro HTTP
    if (!response.ok) {
      // Tentar refresh token se 401
      if (response.status === 401 && tokenManager.getRefreshToken()) {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
          // Retry da requisição original
          return request<T>(endpoint, options);
        }
      }
      
      throw {
        message: data.error || 'Erro na requisição',
        status: response.status,
        details: data.details,
      } as ApiError;
    }
    
    // Sucesso - retorna data se existir, senão o objeto completo
    return data.data !== undefined ? data.data : data;
    
  } catch (error) {
    // Erro de rede
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw {
        message: 'Servidor indisponível. Verifique sua conexão.',
        status: 0,
      } as ApiError;
    }
    
    // Re-throw ApiError
    throw error;
  }
}

/**
 * Tenta renovar o token de acesso
 */
async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = tokenManager.getRefreshToken();
  if (!refreshToken) return false;
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    
    if (response.ok) {
      const data = await response.json();
      tokenManager.setToken(data.data.token);
      if (data.data.refreshToken) {
        tokenManager.setRefreshToken(data.data.refreshToken);
      }
      return true;
    }
  } catch {
    // Refresh falhou
  }
  
  // Limpar tokens e deslogar
  tokenManager.clearTokens();
  return false;
}

// ==========================================
// API CLIENT
// ==========================================

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  
  post: <T>(endpoint: string, body?: unknown) => 
    request<T>(endpoint, { 
      method: 'POST', 
      body: body ? JSON.stringify(body) : undefined,
    }),
  
  put: <T>(endpoint: string, body?: unknown) => 
    request<T>(endpoint, { 
      method: 'PUT', 
      body: body ? JSON.stringify(body) : undefined,
    }),
  
  patch: <T>(endpoint: string, body?: unknown) => 
    request<T>(endpoint, { 
      method: 'PATCH', 
      body: body ? JSON.stringify(body) : undefined,
    }),
  
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

export default api;
