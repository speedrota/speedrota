/**
 * @fileoverview Endpoints de Notificações Push
 *
 * ENDPOINTS:
 * POST /subscribe - Registra token push
 * DELETE /unsubscribe - Remove token push
 * GET / - Lista notificações
 * GET /nao-lidas - Conta não lidas
 * PATCH /:id/lida - Marca como lida
 * PATCH /todas-lidas - Marca todas como lidas
 * GET /vapid-public-key - Obtém chave VAPID pública
 *
 * DESIGN POR CONTRATO:
 * @pre Usuário autenticado
 * @post Notificações gerenciadas
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  registrarToken,
  removerToken,
  obterNotificacoes,
  marcarComoLida,
  marcarTodasComoLidas,
  TipoNotificacao,
} from '../services/notificacoes.js';
import { env } from '../config/env.js';
import { authenticate } from '../middlewares/auth.middleware.js';

// ==========================================
// SCHEMAS
// ==========================================

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  platform: z.enum(['web', 'android', 'ios']).default('web'),
  deviceId: z.string().optional(),
});

const UnsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

const ListarQuerySchema = z.object({
  limite: z.coerce.number().min(1).max(100).default(50),
  apenasNaoLidas: z.coerce.boolean().default(false),
  tipo: z.string().optional(),
});

// ==========================================
// TIPOS
// ==========================================

type SubscribeBody = z.infer<typeof SubscribeSchema>;
type UnsubscribeBody = z.infer<typeof UnsubscribeSchema>;
type ListarQuery = z.infer<typeof ListarQuerySchema>;
type ParamsId = { id: string };

// ==========================================
// HANDLERS
// ==========================================

/**
 * POST /subscribe
 * Registra token push para o usuário autenticado
 */
async function subscribeHandler(
  request: FastifyRequest<{ Body: SubscribeBody }>,
  reply: FastifyReply
) {
  const user = request.user as { id: string };
  const parseResult = SubscribeSchema.safeParse(request.body);

  if (!parseResult.success) {
    return reply.status(400).send({
      success: false,
      error: 'Dados inválidos',
      detalhes: parseResult.error.issues,
    });
  }

  const { endpoint, keys, platform, deviceId } = parseResult.data;

  try {
    await registrarToken({
      userId: user.id,
      endpoint,
      keys,
      platform,
      deviceId,
    });

    return {
      success: true,
      mensagem: 'Token registrado com sucesso',
    };
  } catch (error) {
    request.log.error(error, 'Erro ao registrar token');
    return reply.status(500).send({
      success: false,
      error: 'Erro ao registrar token',
    });
  }
}

/**
 * DELETE /unsubscribe
 * Remove token push
 */
async function unsubscribeHandler(
  request: FastifyRequest<{ Body: UnsubscribeBody }>,
  reply: FastifyReply
) {
  const user = request.user as { id: string };
  const parseResult = UnsubscribeSchema.safeParse(request.body);

  if (!parseResult.success) {
    return reply.status(400).send({
      success: false,
      error: 'Endpoint inválido',
    });
  }

  try {
    await removerToken(user.id, parseResult.data.endpoint);

    return {
      success: true,
      mensagem: 'Token removido com sucesso',
    };
  } catch (error) {
    request.log.error(error, 'Erro ao remover token');
    return reply.status(500).send({
      success: false,
      error: 'Erro ao remover token',
    });
  }
}

/**
 * GET /
 * Lista notificações do usuário
 */
async function listarHandler(
  request: FastifyRequest<{ Querystring: ListarQuery }>,
  reply: FastifyReply
) {
  const user = request.user as { id: string };

  const parseResult = ListarQuerySchema.safeParse(request.query);
  if (!parseResult.success) {
    return reply.status(400).send({
      success: false,
      error: 'Parâmetros inválidos',
    });
  }

  const { limite, apenasNaoLidas, tipo } = parseResult.data;

  try {
    const result = await obterNotificacoes(user.id, {
      limite,
      apenasNaoLidas,
      tipo: tipo as TipoNotificacao | undefined,
    });

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    request.log.error(error, 'Erro ao listar notificações');
    return reply.status(500).send({
      success: false,
      error: 'Erro ao listar notificações',
    });
  }
}

/**
 * GET /nao-lidas
 * Retorna contagem de não lidas
 */
async function contarNaoLidasHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as { id: string };

  try {
    const result = await obterNotificacoes(user.id, { limite: 0 });

    return {
      success: true,
      naoLidas: result.naoLidas,
    };
  } catch (error) {
    request.log.error(error, 'Erro ao contar notificações');
    return reply.status(500).send({
      success: false,
      error: 'Erro ao contar notificações',
    });
  }
}

/**
 * PATCH /:id/lida
 * Marca notificação como lida
 */
async function marcarLidaHandler(
  request: FastifyRequest<{ Params: ParamsId }>,
  reply: FastifyReply
) {
  const user = request.user as { id: string };
  const { id } = request.params;

  try {
    await marcarComoLida(user.id, id);

    return {
      success: true,
      mensagem: 'Notificação marcada como lida',
    };
  } catch (error) {
    request.log.error(error, 'Erro ao marcar notificação');
    return reply.status(500).send({
      success: false,
      error: 'Erro ao marcar notificação',
    });
  }
}

/**
 * PATCH /todas-lidas
 * Marca todas como lidas
 */
async function marcarTodasLidasHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as { id: string };

  try {
    const count = await marcarTodasComoLidas(user.id);

    return {
      success: true,
      mensagem: `${count} notificação(ões) marcada(s) como lida(s)`,
      total: count,
    };
  } catch (error) {
    request.log.error(error, 'Erro ao marcar notificações');
    return reply.status(500).send({
      success: false,
      error: 'Erro ao marcar notificações',
    });
  }
}

/**
 * GET /vapid-public-key
 * Retorna chave pública VAPID para o cliente
 */
async function vapidPublicKeyHandler() {
  return {
    success: true,
    publicKey: env.VAPID_PUBLIC_KEY || null,
  };
}

// ==========================================
// REGISTRO DAS ROTAS
// ==========================================

export async function notificacoesRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // Rota pública para obter chave VAPID
  fastify.get('/vapid-public-key', vapidPublicKeyHandler);

  // Rotas autenticadas
  fastify.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', authenticate);

    // Gerenciamento de tokens
    protectedRoutes.post<{ Body: SubscribeBody }>(
      '/subscribe',
      subscribeHandler
    );
    protectedRoutes.delete<{ Body: UnsubscribeBody }>(
      '/unsubscribe',
      unsubscribeHandler
    );

    // Listagem e contagem
    protectedRoutes.get<{ Querystring: ListarQuery }>('/', listarHandler);
    protectedRoutes.get('/nao-lidas', contarNaoLidasHandler);

    // Marcar como lida
    protectedRoutes.patch<{ Params: ParamsId }>('/:id/lida', marcarLidaHandler);
    protectedRoutes.patch('/todas-lidas', marcarTodasLidasHandler);
  });
}
