/**
 * @fileoverview Cliente Prisma singleton com retry para Neon cold start
 * 
 * DESIGN POR CONTRATO:
 * @pre DATABASE_URL configurada
 * @post Conexão única reutilizada com retry automático
 * @invariant Hot reload não cria conexões duplicadas
 * 
 * CONFIGURAÇÃO:
 * - connection_limit: 5 (Neon free tier = 5 concurrent connections)
 * - Retry: 5 tentativas com backoff exponencial
 * - Neon cold start: ~5s para acordar
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Configuração otimizada para Neon serverless
// Adicionar ?connection_limit=5&pool_timeout=30&connect_timeout=30 na DATABASE_URL

// Criar nova instância apenas se não existir no cache global
function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production' 
      ? ['error', 'warn'] 
      : ['query', 'error', 'warn'],
    // Configuração de datasources para otimizar conexões
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Cache global para evitar conexões órfãs em dev (hot reload)
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Wrapper para queries com retry (Neon cold start handling)
 * @param fn - Função async que executa query Prisma
 * @param maxRetries - Número máximo de tentativas (default: 5)
 * @returns Resultado da query ou erro após todas tentativas
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 5
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const errorMsg = lastError.message || '';
      const isConnectionError = 
        errorMsg.includes('Can\'t reach database server') ||
        errorMsg.includes('Connection refused') ||
        errorMsg.includes('PrismaClientInitializationError') ||
        errorMsg.includes('Closed') ||
        errorMsg.includes('kind: Closed') ||
        errorMsg.includes('connection') ||
        errorMsg.includes('ECONNRESET') ||
        errorMsg.includes('ETIMEDOUT') ||
        lastError.name === 'PrismaClientInitializationError';
      
      if (!isConnectionError || attempt === maxRetries) {
        throw error;
      }
      
      // Reconectar antes da retry
      try {
        await prisma.$disconnect();
        await prisma.$connect();
        console.log(`[Prisma] Reconexão bem sucedida na tentativa ${attempt}`);
      } catch {
        console.log(`[Prisma] Falha na reconexão, continuando retry...`);
      }
      
      // Backoff exponencial: 1s, 2s, 4s
      const waitMs = Math.pow(2, attempt - 1) * 1000;
      console.log(`[Prisma] Tentativa ${attempt}/${maxRetries} falhou (${errorMsg.slice(0, 50)}...), aguardando ${waitMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }
  
  throw lastError;
}

/**
 * Teste de conexão com o banco (útil para warmup)
 * Tenta reconectar automaticamente se falhar
 */
export async function testConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (e) {
    console.log('[Prisma] Conexão perdida, tentando reconectar...');
    try {
      await prisma.$disconnect();
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      console.log('[Prisma] Reconexão bem sucedida');
      return true;
    } catch {
      console.error('[Prisma] Falha na reconexão');
      return false;
    }
  }
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// Default export
export default prisma;
