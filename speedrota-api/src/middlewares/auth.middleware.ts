/**
 * @fileoverview Middleware de autenticação JWT
 */

import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Middleware para verificar JWT
 * Usar em rotas que requerem autenticação
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({
      success: false,
      error: 'Não autorizado',
    });
  }
}

/**
 * Middleware para verificar plano mínimo
 */
export function requirePlano(planosPermitidos: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      
      const { plano } = request.user;
      
      if (!planosPermitidos.includes(plano)) {
        return reply.status(403).send({
          success: false,
          error: 'Seu plano não tem acesso a este recurso',
          planoAtual: plano,
          planosPermitidos,
        });
      }
    } catch (err) {
      return reply.status(401).send({
        success: false,
        error: 'Não autorizado',
      });
    }
  };
}
