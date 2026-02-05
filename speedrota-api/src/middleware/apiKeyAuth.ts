/**
 * Middleware de Autenticação por API Key
 * 
 * @description Autentica requisições da API Pública usando API Key
 * @pre Header 'x-api-key' ou 'Authorization: Bearer <key>' presente
 * @post Request decorado com apiKey e empresa/user
 * @invariant API Keys são hasheadas (SHA256) antes de comparação
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'crypto';
import prisma from '../lib/prisma.js';

// Tipos
export interface ApiKeyInfo {
  id: string;
  empresaId: string | null;
  userId: string | null;
  permissoes: string[];
  ambiente: 'SANDBOX' | 'PRODUCAO';
  rateLimitPorMinuto: number;
}

// Rate limiting em memória (em produção usar Redis)
const rateLimitStore: Map<string, { count: number; resetAt: number }> = new Map();

/**
 * Hash da API Key (SHA256)
 * @pre key não vazia
 * @post hash de 64 caracteres
 */
function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Extrai API Key do request
 * @pre Request com header x-api-key ou Authorization
 * @post API Key string ou null
 */
function extractApiKey(request: FastifyRequest): string | null {
  // Prioridade 1: Header x-api-key
  const xApiKey = request.headers['x-api-key'];
  if (typeof xApiKey === 'string' && xApiKey.length > 0) {
    return xApiKey;
  }
  
  // Prioridade 2: Bearer token
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  
  // Prioridade 3: Query param (para downloads/exports)
  const queryKey = (request.query as Record<string, unknown>)?.api_key;
  if (typeof queryKey === 'string' && queryKey.length > 0) {
    return queryKey;
  }
  
  return null;
}

/**
 * Verifica rate limit
 * @pre apiKeyId válido
 * @post true se dentro do limite, false se excedeu
 */
function checkRateLimit(apiKeyId: string, limit: number): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minuto
  
  const current = rateLimitStore.get(apiKeyId);
  
  if (!current || now > current.resetAt) {
    // Nova janela
    rateLimitStore.set(apiKeyId, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetIn: 60 };
  }
  
  if (current.count >= limit) {
    const resetIn = Math.ceil((current.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, resetIn };
  }
  
  current.count++;
  const resetIn = Math.ceil((current.resetAt - now) / 1000);
  return { allowed: true, remaining: limit - current.count, resetIn };
}

/**
 * Middleware de autenticação por API Key
 * 
 * @description Valida API Key e decora request com info
 * @pre Header de API Key presente
 * @post request.apiKey populado ou erro 401/403/429
 */
export async function apiKeyAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const startTime = Date.now();
  
  // Extrair API Key
  const apiKey = extractApiKey(request);
  
  if (!apiKey) {
    return reply.status(401).send({
      success: false,
      error: 'API Key não fornecida',
      code: 'MISSING_API_KEY',
      docs: 'https://docs.speedrota.com.br/api/autenticacao'
    });
  }
  
  // Validar formato (sk_live_xxx ou sk_test_xxx)
  if (!apiKey.startsWith('sk_live_') && !apiKey.startsWith('sk_test_')) {
    return reply.status(401).send({
      success: false,
      error: 'Formato de API Key inválido',
      code: 'INVALID_API_KEY_FORMAT',
      expected: 'sk_live_xxx ou sk_test_xxx'
    });
  }
  
  // Hash para buscar no banco
  const keyHash = hashApiKey(apiKey);
  const keyPrefix = apiKey.slice(0, 12);
  
  try {
    // Buscar API Key
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        empresa: {
          select: { id: true, nome: true, gestorId: true }
        }
      }
    });
    
    if (!apiKeyRecord) {
      return reply.status(401).send({
        success: false,
        error: 'API Key inválida',
        code: 'INVALID_API_KEY'
      });
    }
    
    // Verificar se está ativa
    if (!apiKeyRecord.ativo) {
      return reply.status(403).send({
        success: false,
        error: 'API Key desativada',
        code: 'API_KEY_DISABLED'
      });
    }
    
    // Verificar expiração
    if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
      return reply.status(403).send({
        success: false,
        error: 'API Key expirada',
        code: 'API_KEY_EXPIRED',
        expiredAt: apiKeyRecord.expiresAt.toISOString()
      });
    }
    
    // Verificar revogação
    if (apiKeyRecord.revogadoEm) {
      return reply.status(403).send({
        success: false,
        error: 'API Key revogada',
        code: 'API_KEY_REVOKED',
        revokedAt: apiKeyRecord.revogadoEm.toISOString()
      });
    }
    
    // Rate limiting
    const rateLimit = checkRateLimit(apiKeyRecord.id, apiKeyRecord.rateLimitPorMinuto);
    
    // Headers de rate limit (padrão RateLimit-*)
    reply.header('RateLimit-Limit', apiKeyRecord.rateLimitPorMinuto);
    reply.header('RateLimit-Remaining', rateLimit.remaining);
    reply.header('RateLimit-Reset', rateLimit.resetIn);
    
    if (!rateLimit.allowed) {
      return reply.status(429).send({
        success: false,
        error: 'Rate limit excedido',
        code: 'RATE_LIMIT_EXCEEDED',
        limit: apiKeyRecord.rateLimitPorMinuto,
        resetIn: rateLimit.resetIn
      });
    }
    
    // Decorar request
    (request as FastifyRequest & { apiKey: ApiKeyInfo }).apiKey = {
      id: apiKeyRecord.id,
      empresaId: apiKeyRecord.empresaId,
      userId: apiKeyRecord.userId,
      permissoes: apiKeyRecord.permissoes,
      ambiente: apiKeyRecord.ambiente,
      rateLimitPorMinuto: apiKeyRecord.rateLimitPorMinuto
    };
    
    // Atualizar último uso (async, não bloquear)
    prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: {
        ultimoUso: new Date(),
        totalRequisicoes: { increment: 1 }
      }
    }).catch(() => { /* ignore */ });
    
    // Log (async)
    const tempoMs = Date.now() - startTime;
    prisma.logApiPublica.create({
      data: {
        apiKeyId: apiKeyRecord.id,
        metodo: request.method,
        path: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent'] || null,
        statusCode: 200, // Será atualizado no onResponse
        tempoMs
      }
    }).catch(() => { /* ignore */ });
    
  } catch (error) {
    request.log.error(error, 'Erro ao validar API Key');
    return reply.status(500).send({
      success: false,
      error: 'Erro interno ao validar API Key',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Verifica se a API Key tem permissão específica
 * @pre request.apiKey populado
 * @post true se tem permissão
 */
export function hasPermission(request: FastifyRequest, permission: string): boolean {
  const apiKey = (request as FastifyRequest & { apiKey?: ApiKeyInfo }).apiKey;
  if (!apiKey) return false;
  
  // Wildcard
  if (apiKey.permissoes.includes('*')) return true;
  
  // Permissão específica
  if (apiKey.permissoes.includes(permission)) return true;
  
  // Permissão de grupo (ex: 'rotas:*' para 'rotas:read')
  const [resource] = permission.split(':');
  if (apiKey.permissoes.includes(`${resource}:*`)) return true;
  
  return false;
}

/**
 * Middleware para verificar permissão específica
 */
export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!hasPermission(request, permission)) {
      return reply.status(403).send({
        success: false,
        error: `Permissão '${permission}' necessária`,
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permission
      });
    }
  };
}

/**
 * Gerar nova API Key
 * @pre empresaId ou userId
 * @post { key, keyPrefix, keyHash }
 */
export function generateApiKey(ambiente: 'SANDBOX' | 'PRODUCAO' = 'PRODUCAO'): {
  key: string;
  keyPrefix: string;
  keyHash: string;
} {
  const prefix = ambiente === 'SANDBOX' ? 'sk_test_' : 'sk_live_';
  
  // Gerar 32 bytes aleatórios
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const randomPart = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const key = `${prefix}${randomPart}`;
  const keyPrefix = key.slice(0, 12);
  const keyHash = hashApiKey(key);
  
  return { key, keyPrefix, keyHash };
}
