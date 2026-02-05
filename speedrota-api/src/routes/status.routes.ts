/**
 * @fileoverview Rotas de Status em Tempo Real
 *
 * DESIGN POR CONTRATO:
 * @description Endpoints para tracking de status e posição em tempo real
 * @pre Usuário autenticado, rota de propriedade do usuário
 * @post Status atualizado e broadcast SSE enviado
 *
 * ENDPOINTS:
 * - GET /api/v1/status/:rotaId/stream - SSE stream de eventos
 * - GET /api/v1/status/:rotaId - Status atual da rota
 * - PATCH /api/v1/status/:rotaId/iniciar - Iniciar rota
 * - PATCH /api/v1/status/:rotaId/pausar - Pausar rota
 * - PATCH /api/v1/status/:rotaId/finalizar - Finalizar rota
 * - PATCH /api/v1/status/parada/:paradaId - Atualizar status parada
 * - POST /api/v1/status/:rotaId/posicao - Atualizar posição
 * - GET /api/v1/status/:rotaId/historico - Histórico de status
 * - GET /api/v1/status/:rotaId/posicoes - Histórico de posições
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  registrarClienteSSE,
  removerClienteSSE,
  atualizarStatusParada,
  atualizarPosicaoEntregador,
  iniciarRota,
  pausarRota,
  finalizarRota,
  obterStatusRota,
  calcularMetricasTempoReal,
  obterHistoricoPosicoes,
  obterHistoricoStatusParada,
  StatusParada,
  MotivoFalha,
  EventoStatus,
} from '../services/statusTempoReal.js';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// ==========================================
// SCHEMAS DE VALIDAÇÃO
// ==========================================

const atualizarStatusParadaSchema = z.object({
  status: z.enum([
    'PENDENTE',
    'EM_TRANSITO',
    'CHEGOU',
    'ENTREGUE',
    'FALHA',
    'CANCELADO',
    'PULADO',
  ]),
  motivoFalha: z
    .enum([
      'CLIENTE_AUSENTE',
      'ENDERECO_NAO_ENCONTRADO',
      'RECUSADO',
      'AVARIADO',
      'OUTRO',
    ])
    .optional(),
  observacao: z.string().max(500).optional(),
  posicao: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
});

const atualizarPosicaoSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  velocidade: z.number().min(0).max(300).optional(),
  precisao: z.number().min(0).optional(),
});

// ==========================================
// ROTAS
// ==========================================

export async function statusRoutes(app: FastifyInstance) {
  // ==========================================
  // SSE STREAM - Status em tempo real
  // ==========================================

  app.get(
    '/:rotaId/stream',
    {
      schema: {
        tags: ['Status Tempo Real'],
        summary: 'Stream SSE de eventos da rota',
        description: 'Conexão SSE para receber atualizações em tempo real',
        params: z.object({
          rotaId: z.string().uuid(),
        }),
        response: {
          200: z.any(),
        },
      },
    },
    async (request: FastifyRequest<{ Params: { rotaId: string } }>, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Não autorizado' });
        }

        const { rotaId } = request.params;

        // Verificar propriedade da rota
        const rota = await prisma.rota.findFirst({
          where: { id: rotaId, userId },
        });

        if (!rota) {
          return reply.status(404).send({ error: 'Rota não encontrada' });
        }

        // Configurar headers SSE
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });

        // Gerar ID único para o cliente
        const clientId = randomUUID();

        // Função para enviar evento
        const enviar = (evento: EventoStatus) => {
          reply.raw.write(`data: ${JSON.stringify(evento)}\n\n`);
        };

        // Registrar cliente
        registrarClienteSSE(clientId, userId, rotaId, enviar);

        // Enviar status inicial
        const statusInicial = await obterStatusRota(rotaId);
        enviar({
          tipo: 'METRICAS',
          rotaId,
          dados: {
            status: rota.status as any,
            timestamp: new Date(),
            metricas: statusInicial.metricas,
          },
        });

        // Heartbeat para manter conexão
        const heartbeat = setInterval(() => {
          reply.raw.write(':heartbeat\n\n');
        }, 30000);

        // Cleanup ao desconectar
        request.raw.on('close', () => {
          clearInterval(heartbeat);
          removerClienteSSE(clientId);
        });
      } catch (error) {
        console.error('[SSE] Erro:', error);
        return reply.status(500).send({ error: 'Erro ao iniciar stream' });
      }
    }
  );

  // ==========================================
  // GET STATUS ATUAL
  // ==========================================

  app.get(
    '/:rotaId',
    {
      schema: {
        tags: ['Status Tempo Real'],
        summary: 'Obtém status atual da rota',
        params: z.object({
          rotaId: z.string().uuid(),
        }),
      },
    },
    async (request: FastifyRequest<{ Params: { rotaId: string } }>, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Não autorizado' });
        }

        const { rotaId } = request.params;

        // Verificar propriedade
        const rota = await prisma.rota.findFirst({
          where: { id: rotaId, userId },
        });

        if (!rota) {
          return reply.status(404).send({ error: 'Rota não encontrada' });
        }

        const status = await obterStatusRota(rotaId);
        return reply.send({
          sucesso: true,
          ...status,
        });
      } catch (error) {
        console.error('[Status] Erro:', error);
        return reply.status(500).send({ error: 'Erro ao obter status' });
      }
    }
  );

  // ==========================================
  // INICIAR ROTA
  // ==========================================

  app.patch(
    '/:rotaId/iniciar',
    {
      schema: {
        tags: ['Status Tempo Real'],
        summary: 'Inicia uma rota',
        params: z.object({
          rotaId: z.string().uuid(),
        }),
      },
    },
    async (request: FastifyRequest<{ Params: { rotaId: string } }>, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Não autorizado' });
        }

        const { rotaId } = request.params;

        // Verificar propriedade
        const rota = await prisma.rota.findFirst({
          where: { id: rotaId, userId },
        });

        if (!rota) {
          return reply.status(404).send({ error: 'Rota não encontrada' });
        }

        const rotaAtualizada = await iniciarRota(rotaId);
        const metricas = await calcularMetricasTempoReal(rotaId);

        return reply.send({
          sucesso: true,
          rota: rotaAtualizada,
          metricas,
        });
      } catch (error: any) {
        console.error('[Status] Erro ao iniciar:', error);
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // ==========================================
  // PAUSAR ROTA
  // ==========================================

  app.patch(
    '/:rotaId/pausar',
    {
      schema: {
        tags: ['Status Tempo Real'],
        summary: 'Pausa uma rota em andamento',
        params: z.object({
          rotaId: z.string().uuid(),
        }),
      },
    },
    async (request: FastifyRequest<{ Params: { rotaId: string } }>, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Não autorizado' });
        }

        const { rotaId } = request.params;

        const rota = await prisma.rota.findFirst({
          where: { id: rotaId, userId },
        });

        if (!rota) {
          return reply.status(404).send({ error: 'Rota não encontrada' });
        }

        const rotaAtualizada = await pausarRota(rotaId);

        return reply.send({
          sucesso: true,
          rota: rotaAtualizada,
        });
      } catch (error: any) {
        console.error('[Status] Erro ao pausar:', error);
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // ==========================================
  // FINALIZAR ROTA
  // ==========================================

  app.patch(
    '/:rotaId/finalizar',
    {
      schema: {
        tags: ['Status Tempo Real'],
        summary: 'Finaliza uma rota',
        params: z.object({
          rotaId: z.string().uuid(),
        }),
      },
    },
    async (request: FastifyRequest<{ Params: { rotaId: string } }>, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Não autorizado' });
        }

        const { rotaId } = request.params;

        const rota = await prisma.rota.findFirst({
          where: { id: rotaId, userId },
        });

        if (!rota) {
          return reply.status(404).send({ error: 'Rota não encontrada' });
        }

        const rotaAtualizada = await finalizarRota(rotaId);
        const metricas = await calcularMetricasTempoReal(rotaId);

        return reply.send({
          sucesso: true,
          rota: rotaAtualizada,
          metricas,
        });
      } catch (error: any) {
        console.error('[Status] Erro ao finalizar:', error);
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // ==========================================
  // ATUALIZAR STATUS PARADA
  // ==========================================

  app.patch(
    '/parada/:paradaId',
    {
      schema: {
        tags: ['Status Tempo Real'],
        summary: 'Atualiza status de uma parada',
        params: z.object({
          paradaId: z.string().uuid(),
        }),
        body: atualizarStatusParadaSchema,
      },
    },
    async (
      request: FastifyRequest<{
        Params: { paradaId: string };
        Body: z.infer<typeof atualizarStatusParadaSchema>;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Não autorizado' });
        }

        const { paradaId } = request.params;
        const { status, motivoFalha, observacao, posicao } = request.body;

        // Verificar propriedade via rota
        const parada = await prisma.parada.findFirst({
          where: { id: paradaId },
          include: { rota: true },
        });

        if (!parada || parada.rota.userId !== userId) {
          return reply.status(404).send({ error: 'Parada não encontrada' });
        }

        const resultado = await atualizarStatusParada(
          paradaId,
          status as StatusParada,
          {
            motivoFalha: motivoFalha as MotivoFalha,
            observacao,
            posicao: posicao
              ? { ...posicao, timestamp: new Date() }
              : undefined,
          }
        );

        return reply.send({
          sucesso: true,
          parada: resultado.parada,
          metricas: resultado.metricas,
        });
      } catch (error: any) {
        console.error('[Status] Erro ao atualizar parada:', error);
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // ==========================================
  // ATUALIZAR POSIÇÃO
  // ==========================================

  app.post(
    '/:rotaId/posicao',
    {
      schema: {
        tags: ['Status Tempo Real'],
        summary: 'Atualiza posição do entregador',
        params: z.object({
          rotaId: z.string().uuid(),
        }),
        body: atualizarPosicaoSchema,
      },
    },
    async (
      request: FastifyRequest<{
        Params: { rotaId: string };
        Body: z.infer<typeof atualizarPosicaoSchema>;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Não autorizado' });
        }

        const { rotaId } = request.params;
        const posicao = request.body;

        // Verificar propriedade
        const rota = await prisma.rota.findFirst({
          where: { id: rotaId, userId },
        });

        if (!rota) {
          return reply.status(404).send({ error: 'Rota não encontrada' });
        }

        await atualizarPosicaoEntregador(rotaId, {
          ...posicao,
          timestamp: new Date(),
        });

        return reply.send({ sucesso: true });
      } catch (error: any) {
        console.error('[Status] Erro ao atualizar posição:', error);
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // ==========================================
  // HISTÓRICO DE STATUS
  // ==========================================

  app.get(
    '/:rotaId/historico',
    {
      schema: {
        tags: ['Status Tempo Real'],
        summary: 'Obtém histórico de status da rota',
        params: z.object({
          rotaId: z.string().uuid(),
        }),
      },
    },
    async (request: FastifyRequest<{ Params: { rotaId: string } }>, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Não autorizado' });
        }

        const { rotaId } = request.params;

        // Verificar propriedade
        const rota = await prisma.rota.findFirst({
          where: { id: rotaId, userId },
        });

        if (!rota) {
          return reply.status(404).send({ error: 'Rota não encontrada' });
        }

        const historico = await prisma.statusHistorico.findMany({
          where: { rotaId },
          orderBy: { timestamp: 'asc' },
          include: {
            parada: {
              select: { id: true, endereco: true, ordem: true },
            },
          },
        });

        return reply.send({
          sucesso: true,
          historico,
        });
      } catch (error) {
        console.error('[Status] Erro:', error);
        return reply.status(500).send({ error: 'Erro ao obter histórico' });
      }
    }
  );

  // ==========================================
  // HISTÓRICO DE POSIÇÕES
  // ==========================================

  app.get(
    '/:rotaId/posicoes',
    {
      schema: {
        tags: ['Status Tempo Real'],
        summary: 'Obtém histórico de posições da rota',
        params: z.object({
          rotaId: z.string().uuid(),
        }),
        querystring: z.object({
          limite: z.string().transform(Number).default('100'),
        }),
      },
    },
    async (
      request: FastifyRequest<{
        Params: { rotaId: string };
        Querystring: { limite: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: 'Não autorizado' });
        }

        const { rotaId } = request.params;
        const limite = parseInt(request.query.limite) || 100;

        // Verificar propriedade
        const rota = await prisma.rota.findFirst({
          where: { id: rotaId, userId },
        });

        if (!rota) {
          return reply.status(404).send({ error: 'Rota não encontrada' });
        }

        const posicoes = await obterHistoricoPosicoes(rotaId, limite);

        return reply.send({
          sucesso: true,
          posicoes,
          total: posicoes.length,
        });
      } catch (error) {
        console.error('[Status] Erro:', error);
        return reply.status(500).send({ error: 'Erro ao obter posições' });
      }
    }
  );
}

export default statusRoutes;
