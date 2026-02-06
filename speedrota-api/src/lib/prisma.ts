/**
 * @fileoverview Cliente Prisma singleton
 * 
 * DESIGN POR CONTRATO:
 * @pre DATABASE_URL configurada
 * @post Conexão única reutilizada
 * @invariant Hot reload não cria conexões duplicadas
 * 
 * CONFIGURAÇÃO DE POOL:
 * - connection_limit: 10 (padrão Render free tier)
 * - pool_timeout: 10 segundos
 * - connect_timeout: 10 segundos
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Configuração otimizada para produção (Render/Railway)
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'production' 
    ? ['error', 'warn'] 
    : ['query', 'error', 'warn'],
  // Adicionar datasources para melhor controle de conexão
});

// Em produção também cache o cliente para evitar conexões órfãs
globalForPrisma.prisma = prisma;

// Graceful shutdown - fechar conexões ao encerrar
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// Default export para compatibilidade com imports existentes
export default prisma;
