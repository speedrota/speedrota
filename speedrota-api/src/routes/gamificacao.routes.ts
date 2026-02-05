/**
 * @fileoverview Rotas de Gamificação - Badges, Ranking e Conquistas
 * 
 * DESIGN POR CONTRATO:
 * @pre Autenticação válida
 * @post Dados de gamificação do usuário
 * 
 * ENDPOINTS:
 * - GET /perfil - Perfil de gamificação
 * - GET /badges - Lista todos os badges
 * - GET /ranking - Ranking semanal
 * - GET /conquistas - Histórico de conquistas
 * - POST /inicializar - Inicializa badges (admin)
 * 
 * @author SpeedRota Team
 * @version 1.0.0
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import gamificacaoService from '../services/gamificacao.js';

// ==========================================
// ROTAS
// ==========================================

export default async function gamificacaoRoutes(fastify: FastifyInstance) {

  /**
   * GET /perfil
   * Obtém perfil de gamificação do usuário
   * 
   * @pre userId válido no token
   * @post PerfilGamificacao com pontos, nível, badges, streak
   */
  fastify.get('/perfil', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                userId: { type: 'string' },
                pontosTotais: { type: 'integer' },
                nivel: { type: 'integer' },
                badgesDesbloqueados: { type: 'integer' },
                badgesTotal: { type: 'integer' },
                streakAtual: { type: 'integer' },
                maiorStreak: { type: 'integer' },
                posicaoRanking: { type: ['integer', 'null'] },
                proximoBadge: {
                  type: ['object', 'null'],
                  properties: {
                    nome: { type: 'string' },
                    progressoAtual: { type: 'integer' },
                    requisito: { type: 'integer' },
                    percentual: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (request: any, reply) => {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ success: false, error: 'Não autenticado' });
      }

      const perfil = await gamificacaoService.getPerfilGamificacao(userId);

      return reply.send({
        success: true,
        data: perfil,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /badges
   * Lista todos os badges com progresso do usuário
   * 
   * @pre userId válido
   * @post Lista de BadgeDetalhado ordenada por tipo
   */
  fastify.get('/badges', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  codigo: { type: 'string' },
                  nome: { type: 'string' },
                  descricao: { type: 'string' },
                  icone: { type: 'string' },
                  tipo: { type: 'string' },
                  requisito: { type: 'integer' },
                  pontos: { type: 'integer' },
                  raridade: { type: 'string' },
                  desbloqueado: { type: 'boolean' },
                  progressoAtual: { type: 'integer' },
                  percentualProgresso: { type: 'number' },
                  desbloqueadoEm: { type: ['string', 'null'] },
                },
              },
            },
          },
        },
      },
    },
  }, async (request: any, reply) => {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ success: false, error: 'Não autenticado' });
      }

      const badges = await gamificacaoService.getBadgesUsuario(userId);

      return reply.send({
        success: true,
        data: badges.map(b => ({
          ...b,
          desbloqueadoEm: b.desbloqueadoEm?.toISOString() || null,
        })),
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /badges/:tipo
   * Lista badges filtrados por tipo
   */
  fastify.get<{
    Params: { tipo: string };
  }>('/badges/:tipo', async (request: any, reply) => {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ success: false, error: 'Não autenticado' });
      }

      const { tipo } = request.params;
      const badges = await gamificacaoService.getBadgesUsuario(userId);

      const filtrados = badges.filter(b => 
        b.tipo.toLowerCase() === tipo.toLowerCase()
      );

      return reply.send({
        success: true,
        data: filtrados.map(b => ({
          ...b,
          desbloqueadoEm: b.desbloqueadoEm?.toISOString() || null,
        })),
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /ranking
   * Obtém ranking semanal
   * 
   * @pre userId para destacar posição
   * @post Lista de RankingEntry top 50
   */
  fastify.get('/ranking', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  posicao: { type: 'integer' },
                  userId: { type: 'string' },
                  nome: { type: 'string' },
                  pontos: { type: 'integer' },
                  totalEntregas: { type: 'integer' },
                  streakAtual: { type: 'integer' },
                  badges: { type: 'integer' },
                  isCurrentUser: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request: any, reply) => {
    try {
      const userId = request.user?.id || '';

      const ranking = await gamificacaoService.getRankingSemanal(userId);

      return reply.send({
        success: true,
        data: ranking,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /conquistas
   * Histórico de conquistas do usuário
   */
  fastify.get('/conquistas', async (request: any, reply) => {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ success: false, error: 'Não autenticado' });
      }

      const { prisma } = await import('../lib/prisma.js');

      const conquistas = await prisma.conquista.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return reply.send({
        success: true,
        data: conquistas.map(c => ({
          id: c.id,
          tipo: c.tipo,
          valor: c.valor,
          descricao: c.descricao,
          pontosGanhos: c.pontosGanhos,
          data: c.data.toISOString(),
        })),
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /leaderboard
   * Leaderboard com diferentes períodos
   */
  fastify.get<{
    Querystring: { periodo?: string };
  }>('/leaderboard', async (request: any, reply) => {
    try {
      const userId = request.user?.id || '';
      const periodo = request.query.periodo || 'SEMANAL';

      const { prisma } = await import('../lib/prisma.js');

      const rankings = await prisma.ranking.findMany({
        where: {
          periodo: periodo as any,
        },
        orderBy: { pontos: 'desc' },
        take: 100,
      });

      // Buscar nomes
      const userIds = rankings.map(r => r.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, nome: true },
      });
      const userMap = new Map(users.map(u => [u.id, u.nome]));

      return reply.send({
        success: true,
        data: rankings.map((r, index) => ({
          posicao: r.posicao || index + 1,
          userId: r.userId,
          nome: userMap.get(r.userId) || 'Anônimo',
          pontos: r.pontos,
          totalEntregas: r.totalEntregas,
          totalKm: r.totalKm,
          streakAtual: r.streakAtual,
          isCurrentUser: r.userId === userId,
        })),
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /inicializar
   * Inicializa badges no banco (admin)
   */
  fastify.post('/inicializar', async (request, reply) => {
    try {
      const resultado = await gamificacaoService.inicializarBadges();

      return reply.send({
        success: true,
        data: resultado,
        message: `${resultado.criados} badges criados, ${resultado.atualizados} atualizados`,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /resumo-semanal
   * Resumo semanal do usuário com comparação
   */
  fastify.get('/resumo-semanal', async (request: any, reply) => {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ success: false, error: 'Não autenticado' });
      }

      const { prisma } = await import('../lib/prisma.js');

      // Semana atual
      const inicioSemanaAtual = new Date();
      inicioSemanaAtual.setDate(inicioSemanaAtual.getDate() - inicioSemanaAtual.getDay());
      inicioSemanaAtual.setHours(0, 0, 0, 0);

      // Semana anterior
      const inicioSemanaAnterior = new Date(inicioSemanaAtual);
      inicioSemanaAnterior.setDate(inicioSemanaAnterior.getDate() - 7);

      const [atual, anterior] = await Promise.all([
        prisma.ranking.findFirst({
          where: { userId, periodo: 'SEMANAL', dataInicio: { gte: inicioSemanaAtual } },
        }),
        prisma.ranking.findFirst({
          where: { userId, periodo: 'SEMANAL', dataInicio: { gte: inicioSemanaAnterior, lt: inicioSemanaAtual } },
        }),
      ]);

      const comparacao = {
        entregas: {
          atual: atual?.totalEntregas || 0,
          anterior: anterior?.totalEntregas || 0,
          variacao: anterior?.totalEntregas 
            ? ((atual?.totalEntregas || 0) - anterior.totalEntregas) / anterior.totalEntregas * 100 
            : 0,
        },
        km: {
          atual: atual?.totalKm || 0,
          anterior: anterior?.totalKm || 0,
          variacao: anterior?.totalKm 
            ? ((atual?.totalKm || 0) - anterior.totalKm) / anterior.totalKm * 100 
            : 0,
        },
        pontos: {
          atual: atual?.pontos || 0,
          anterior: anterior?.pontos || 0,
          variacao: anterior?.pontos 
            ? ((atual?.pontos || 0) - anterior.pontos) / anterior.pontos * 100 
            : 0,
        },
        posicao: atual?.posicao || null,
        streak: atual?.streakAtual || 0,
      };

      return reply.send({
        success: true,
        data: comparacao,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });
}
