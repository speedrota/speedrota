/**
 * @fileoverview Cliente Prisma singleton
 * 
 * DESIGN POR CONTRATO:
 * @pre DATABASE_URL configurada
 * @post Conexão única reutilizada
 * @invariant Hot reload não cria conexões duplicadas
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['query', 'error', 'warn'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
