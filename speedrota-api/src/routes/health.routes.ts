/**
 * @fileoverview Rotas de Health Check
 */

import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function healthRoutes(app: FastifyInstance) {
  // Health check básico
  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // Health check com verificação do banco
  app.get('/health/db', async (request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return reply.status(503).send({
        status: 'error',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  });
}
