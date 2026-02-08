/**
 * @fileoverview Cliente Prisma singleton com retry para Neon cold start
 * 
 * DESIGN POR CONTRATO:
 * @pre DATABASE_URL configurada
 * @post Conexão única reutilizada com retry automático
 * @invariant Hot reload não cria conexões duplicadas
 * 
 * CONFIGURAÇÃO:
 * - connection_limit: 10 (Render free tier)
 * - Retry: 3 tentativas com backoff exponencial
 * - Neon cold start: ~5s para acordar
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Configuração otimizada para produção (Render/Railway + Neon)
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'production' 
    ? ['error', 'warn'] 
    : ['query', 'error', 'warn'],
});

// Cache global para evitar conexões órfãs
globalForPrisma.prisma = prisma;

/**
 * Wrapper para queries com retry (Neon cold start handling)
 * @param fn - Função async que executa query Prisma
 * @param maxRetries - Número máximo de tentativas (default: 3)
 * @returns Resultado da query ou erro após todas tentativas
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const isConnectionError = 
        lastError.message?.includes('Can\'t reach database server') ||
        lastError.message?.includes('Connection refused') ||
        lastError.message?.includes('PrismaClientInitializationError') ||
        lastError.name === 'PrismaClientInitializationError';
      
      if (!isConnectionError || attempt === maxRetries) {
        throw error;
      }
      
      // Backoff exponencial: 1s, 2s, 4s
      const waitMs = Math.pow(2, attempt - 1) * 1000;
      console.log(`[Prisma] Tentativa ${attempt}/${maxRetries} falhou, aguardando ${waitMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }
  
  throw lastError;
}

/**
 * Teste de conexão com o banco (útil para warmup)
 */
export async function testConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// Default export
export default prisma;
