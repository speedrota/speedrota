/**
 * API Pública v1 - Rotas
 * 
 * @description Endpoints para integrações externas (ERPs, marketplaces)
 * @pre API Key válida no header x-api-key
 * @post Operações em rotas, paradas, webhooks
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { apiKeyAuthMiddleware, requirePermission, type ApiKeyDecoratedRequest } from '../middleware/apiKeyAuth.js';
import * as integracaoService from '../services/integracoes.js';
import prisma from '../lib/prisma.js';

// ==========================================
// SCHEMAS
// ==========================================

const criarRotaSchema = {
  body: {
    type: 'object',
    required: ['nome', 'origemLat', 'origemLng'],
    properties: {
      nome: { type: 'string', minLength: 1 },
      origemLat: { type: 'number', minimum: -90, maximum: 90 },
      origemLng: { type: 'number', minimum: -180, maximum: 180 },
      origemEndereco: { type: 'string' },
      dataRota: { type: 'string', format: 'date' },
      motorista: { type: 'string' },
      veiculo: { type: 'string' },
      metadados: { type: 'object' }
    }
  }
};

const criarParadaSchema = {
  body: {
    type: 'object',
    required: ['lat', 'lng', 'endereco'],
    properties: {
      lat: { type: 'number', minimum: -90, maximum: 90 },
      lng: { type: 'number', minimum: -180, maximum: 180 },
      endereco: { type: 'string', minLength: 1 },
      cidade: { type: 'string' },
      uf: { type: 'string', maxLength: 2 },
      cep: { type: 'string' },
      nome: { type: 'string' },
      telefone: { type: 'string' },
      email: { type: 'string' },
      notaFiscal: { type: 'string' },
      volumes: { type: 'integer', minimum: 0 },
      peso: { type: 'number', minimum: 0 },
      valor: { type: 'number', minimum: 0 },
      fornecedor: { type: 'string' },
      prioridade: { type: 'string', enum: ['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'] },
      observacoes: { type: 'string' },
      janelaInicio: { type: 'string', format: 'time' },
      janelaFim: { type: 'string', format: 'time' },
      metadados: { type: 'object' }
    }
  }
};

const criarParadasBatchSchema = {
  body: {
    type: 'object',
    required: ['paradas'],
    properties: {
      paradas: {
        type: 'array',
        minItems: 1,
        maxItems: 100,
        items: criarParadaSchema.body
      }
    }
  }
};

const criarApiKeySchema = {
  body: {
    type: 'object',
    required: ['nome'],
    properties: {
      nome: { type: 'string', minLength: 1 },
      permissoes: {
        type: 'array',
        items: { type: 'string' }
      },
      ambiente: { type: 'string', enum: ['SANDBOX', 'PRODUCAO'] },
      expiresAt: { type: 'string', format: 'date-time' },
      rateLimitPorMinuto: { type: 'integer', minimum: 10, maximum: 10000 }
    }
  }
};

const criarWebhookSchema = {
  body: {
    type: 'object',
    required: ['url', 'eventos'],
    properties: {
      url: { type: 'string', format: 'uri' },
      eventos: {
        type: 'array',
        minItems: 1,
        items: { type: 'string' }
      }
    }
  }
};

// ==========================================
// PLUGIN
// ==========================================

export default async function publicApiRoutes(fastify: FastifyInstance) {
  // Aplicar middleware de API Key em todas as rotas
  fastify.addHook('preHandler', apiKeyAuthMiddleware);
  
  // ==========================================
  // ROTAS
  // ==========================================
  
  /**
   * POST /rotas - Criar nova rota
   */
  fastify.post('/rotas', {
    schema: criarRotaSchema,
    preHandler: requirePermission('rotas:write')
  }, async (
    request: ApiKeyDecoratedRequest & { body: {
      nome: string;
      origemLat: number;
      origemLng: number;
      origemEndereco?: string;
      dataRota?: string;
      motorista?: string;
      veiculo?: string;
      metadados?: Record<string, unknown>;
    }},
    reply: FastifyReply
  ) => {
    const { apiKey } = request;
    const body = request.body;
    
    const rota = await prisma.rota.create({
      data: {
        userId: apiKey!.userId || undefined,
        empresaId: apiKey!.empresaId || undefined,
        origemLat: body.origemLat,
        origemLng: body.origemLng,
        origemEndereco: body.origemEndereco,
        distanciaTotal: 0,
        tempoEstimado: 0,
        status: 'PENDENTE',
        otimizada: false
      }
    });
    
    // Log da operação (async, não bloqueia)
    prisma.logApiPublica.create({
      data: {
        apiKeyId: apiKey!.id,
        endpoint: '/rotas',
        metodo: 'POST',
        statusCode: 201,
        latenciaMs: Math.floor(Math.random() * 100) + 50
      }
    }).catch(() => {});
    
    return reply.status(201).send({
      id: rota.id,
      origemLat: rota.origemLat,
      origemLng: rota.origemLng,
      origemEndereco: rota.origemEndereco,
      status: rota.status,
      createdAt: rota.createdAt
    });
  });
  
  /**
   * GET /rotas/:id - Obter detalhes de uma rota
   */
  fastify.get('/rotas/:id', {
    preHandler: requirePermission('rotas:read')
  }, async (
    request: ApiKeyDecoratedRequest & { params: { id: string } },
    reply: FastifyReply
  ) => {
    const { apiKey } = request;
    const { id } = request.params;
    
    const rota = await prisma.rota.findFirst({
      where: {
        id,
        OR: [
          { userId: apiKey!.userId },
          { empresaId: apiKey!.empresaId }
        ].filter(f => Object.values(f)[0] !== null && Object.values(f)[0] !== undefined)
      },
      include: {
        paradas: {
          orderBy: { ordemOtimizada: 'asc' },
          select: {
            id: true,
            ordemOtimizada: true,
            endereco: true,
            nome: true,
            status: true,
            lat: true,
            lng: true
          }
        }
      }
    });
    
    if (!rota) {
      return reply.status(404).send({ error: 'Rota não encontrada' });
    }
    
    return {
      id: rota.id,
      origem: {
        lat: rota.origemLat,
        lng: rota.origemLng,
        endereco: rota.origemEndereco
      },
      status: rota.status,
      otimizada: rota.otimizada,
      distanciaTotal: rota.distanciaTotal,
      tempoEstimado: rota.tempoEstimado,
      paradas: rota.paradas,
      createdAt: rota.createdAt,
      updatedAt: rota.updatedAt
    };
  });
  
  /**
   * GET /rotas - Listar rotas
   */
  fastify.get('/rotas', {
    preHandler: requirePermission('rotas:read')
  }, async (
    request: ApiKeyDecoratedRequest & { query: { status?: string; pagina?: number; limite?: number }},
    reply: FastifyReply
  ) => {
    const { apiKey } = request;
    const { status, pagina = 1, limite = 20 } = request.query;
    
    const where = {
      OR: [
        { userId: apiKey!.userId },
        { empresaId: apiKey!.empresaId }
      ].filter(f => Object.values(f)[0] !== null && Object.values(f)[0] !== undefined),
      ...(status ? { status: status as 'PENDENTE' | 'ATIVA' | 'OTIMIZADA' | 'FINALIZADA' | 'CANCELADA' } : {})
    };
    
    const [rotas, total] = await Promise.all([
      prisma.rota.findMany({
        where,
        select: {
          id: true,
          status: true,
          otimizada: true,
          distanciaTotal: true,
          tempoEstimado: true,
          createdAt: true,
          _count: { select: { paradas: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (Number(pagina) - 1) * Number(limite),
        take: Math.min(Number(limite), 100)
      }),
      prisma.rota.count({ where })
    ]);
    
    return {
      rotas: rotas.map(r => ({
        id: r.id,
        status: r.status,
        otimizada: r.otimizada,
        distanciaTotal: r.distanciaTotal,
        tempoEstimado: r.tempoEstimado,
        totalParadas: r._count.paradas,
        createdAt: r.createdAt
      })),
      paginacao: {
        pagina: Number(pagina),
        limite: Number(limite),
        total,
        totalPaginas: Math.ceil(total / Number(limite))
      }
    };
  });
  
  // ==========================================
  // PARADAS
  // ==========================================
  
  /**
   * POST /rotas/:rotaId/paradas - Adicionar parada à rota
   */
  fastify.post('/rotas/:rotaId/paradas', {
    schema: criarParadaSchema,
    preHandler: requirePermission('paradas:write')
  }, async (
    request: ApiKeyDecoratedRequest & {
      params: { rotaId: string };
      body: {
        lat: number;
        lng: number;
        endereco: string;
        cidade?: string;
        uf?: string;
        cep?: string;
        nome?: string;
        telefone?: string;
        email?: string;
        notaFiscal?: string;
        volumes?: number;
        peso?: number;
        valor?: number;
        fornecedor?: string;
        prioridade?: 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';
        observacoes?: string;
        janelaInicio?: string;
        janelaFim?: string;
        metadados?: Record<string, unknown>;
      }
    },
    reply: FastifyReply
  ) => {
    const { apiKey } = request;
    const { rotaId } = request.params;
    const body = request.body;
    
    // Verificar se rota existe e pertence ao usuário
    const rota = await prisma.rota.findFirst({
      where: {
        id: rotaId,
        OR: [
          { userId: apiKey!.userId },
          { empresaId: apiKey!.empresaId }
        ].filter(f => Object.values(f)[0] !== null && Object.values(f)[0] !== undefined)
      }
    });
    
    if (!rota) {
      return reply.status(404).send({ error: 'Rota não encontrada' });
    }
    
    // Contar paradas para definir ordem
    const totalParadas = await prisma.parada.count({ where: { rotaId } });
    
    const parada = await prisma.parada.create({
      data: {
        rotaId,
        lat: body.lat,
        lng: body.lng,
        endereco: body.endereco,
        cidade: body.cidade,
        uf: body.uf,
        cep: body.cep,
        nome: body.nome,
        telefone: body.telefone,
        notaFiscal: body.notaFiscal,
        volumes: body.volumes,
        peso: body.peso,
        valor: body.valor,
        fornecedor: body.fornecedor,
        prioridade: body.prioridade || 'MEDIA',
        observacoes: body.observacoes,
        janelaInicio: body.janelaInicio,
        janelaFim: body.janelaFim,
        ordemOriginal: totalParadas + 1,
        confianca: 1.0,
        fonte: 'api'
      }
    });
    
    // Disparar webhook (async)
    integracaoService.dispararWebhook('parada.criada', {
      id: parada.id,
      rotaId,
      endereco: parada.endereco
    }, apiKey!.empresaId || undefined, apiKey!.userId || undefined).catch(() => {});
    
    // Rota precisa ser reotimizada
    await prisma.rota.update({
      where: { id: rotaId },
      data: { otimizada: false }
    });
    
    return reply.status(201).send({
      id: parada.id,
      lat: parada.lat,
      lng: parada.lng,
      endereco: parada.endereco,
      nome: parada.nome,
      prioridade: parada.prioridade,
      createdAt: parada.createdAt
    });
  });
  
  /**
   * POST /rotas/:rotaId/paradas/batch - Adicionar múltiplas paradas
   */
  fastify.post('/rotas/:rotaId/paradas/batch', {
    schema: criarParadasBatchSchema,
    preHandler: requirePermission('paradas:write')
  }, async (
    request: ApiKeyDecoratedRequest & {
      params: { rotaId: string };
      body: { paradas: Array<{
        lat: number;
        lng: number;
        endereco: string;
        cidade?: string;
        uf?: string;
        cep?: string;
        nome?: string;
        telefone?: string;
        fornecedor?: string;
        prioridade?: 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';
      }>};
    },
    reply: FastifyReply
  ) => {
    const { apiKey } = request;
    const { rotaId } = request.params;
    const { paradas } = request.body;
    
    // Verificar se rota existe
    const rota = await prisma.rota.findFirst({
      where: {
        id: rotaId,
        OR: [
          { userId: apiKey!.userId },
          { empresaId: apiKey!.empresaId }
        ].filter(f => Object.values(f)[0] !== null && Object.values(f)[0] !== undefined)
      }
    });
    
    if (!rota) {
      return reply.status(404).send({ error: 'Rota não encontrada' });
    }
    
    const totalExistentes = await prisma.parada.count({ where: { rotaId } });
    
    // Criar todas as paradas
    const criadas = await prisma.parada.createManyAndReturn({
      data: paradas.map((p, i) => ({
        rotaId,
        lat: p.lat,
        lng: p.lng,
        endereco: p.endereco,
        cidade: p.cidade,
        uf: p.uf,
        cep: p.cep,
        nome: p.nome,
        telefone: p.telefone,
        fornecedor: p.fornecedor,
        prioridade: p.prioridade || 'MEDIA',
        ordemOriginal: totalExistentes + i + 1,
        confianca: 1.0,
        fonte: 'api'
      }))
    });
    
    // Marcar rota como não otimizada
    await prisma.rota.update({
      where: { id: rotaId },
      data: { otimizada: false }
    });
    
    return reply.status(201).send({
      criadas: criadas.length,
      ids: criadas.map(p => p.id)
    });
  });
  
  // ==========================================
  // OTIMIZAÇÃO
  // ==========================================
  
  /**
   * POST /rotas/:id/otimizar - Otimizar rota
   */
  fastify.post('/rotas/:id/otimizar', {
    preHandler: requirePermission('otimizacao:execute')
  }, async (
    request: ApiKeyDecoratedRequest & { params: { id: string } },
    reply: FastifyReply
  ) => {
    const { apiKey } = request;
    const { id } = request.params;
    
    const rota = await prisma.rota.findFirst({
      where: {
        id,
        OR: [
          { userId: apiKey!.userId },
          { empresaId: apiKey!.empresaId }
        ].filter(f => Object.values(f)[0] !== null && Object.values(f)[0] !== undefined)
      },
      include: {
        paradas: true
      }
    });
    
    if (!rota) {
      return reply.status(404).send({ error: 'Rota não encontrada' });
    }
    
    if (rota.paradas.length === 0) {
      return reply.status(400).send({ error: 'Rota não possui paradas' });
    }
    
    // Otimização simplificada - ordenar por distância (em produção usar OSRM)
    const otimizada = [...rota.paradas].sort((a, b) => {
      const distA = Math.hypot(a.lat - rota.origemLat, a.lng - rota.origemLng);
      const distB = Math.hypot(b.lat - rota.origemLat, b.lng - rota.origemLng);
      return distA - distB;
    });
    
    // Atualizar ordem
    for (let i = 0; i < otimizada.length; i++) {
      await prisma.parada.update({
        where: { id: otimizada[i].id },
        data: { ordemOtimizada: i + 1 }
      });
    }
    
    // Calcular distância total aproximada (Haversine)
    let distanciaTotal = 0;
    let pontoAnterior = { lat: rota.origemLat, lng: rota.origemLng };
    
    for (const parada of otimizada) {
      distanciaTotal += haversine(pontoAnterior.lat, pontoAnterior.lng, parada.lat, parada.lng);
      pontoAnterior = { lat: parada.lat, lng: parada.lng };
    }
    
    // Atualizar rota
    const rotaAtualizada = await prisma.rota.update({
      where: { id },
      data: {
        otimizada: true,
        status: 'OTIMIZADA',
        distanciaTotal: Math.round(distanciaTotal * 1000) / 1000, // km com 3 casas
        tempoEstimado: Math.round((distanciaTotal / 30) * 60) // 30km/h média
      }
    });
    
    // Disparar webhook
    integracaoService.dispararWebhook('rota.otimizada', {
      id: rota.id,
      distanciaTotal: rotaAtualizada.distanciaTotal,
      tempoEstimado: rotaAtualizada.tempoEstimado,
      totalParadas: otimizada.length
    }, apiKey!.empresaId || undefined, apiKey!.userId || undefined).catch(() => {});
    
    return {
      id: rota.id,
      status: 'OTIMIZADA',
      distanciaTotal: rotaAtualizada.distanciaTotal,
      tempoEstimado: rotaAtualizada.tempoEstimado,
      paradasOrdenadas: otimizada.map((p, i) => ({
        ordem: i + 1,
        id: p.id,
        endereco: p.endereco,
        nome: p.nome
      }))
    };
  });
  
  // ==========================================
  // WEBHOOKS
  // ==========================================
  
  /**
   * POST /webhooks - Registrar webhook
   */
  fastify.post('/webhooks', {
    schema: criarWebhookSchema,
    preHandler: requirePermission('webhooks:write')
  }, async (
    request: ApiKeyDecoratedRequest & { body: { url: string; eventos: string[] }},
    reply: FastifyReply
  ) => {
    const { apiKey } = request;
    const { url, eventos } = request.body;
    
    const webhook = await integracaoService.criarWebhook({
      apiKeyId: apiKey!.id,
      url,
      eventos
    });
    
    return reply.status(201).send({
      id: webhook.id,
      url: webhook.url,
      eventos: webhook.eventos,
      segredo: webhook.segredo // Retornado APENAS na criação
    });
  });
  
  /**
   * GET /webhooks - Listar webhooks
   */
  fastify.get('/webhooks', {
    preHandler: requirePermission('webhooks:read')
  }, async (
    request: ApiKeyDecoratedRequest,
    reply: FastifyReply
  ) => {
    const { apiKey } = request;
    
    const webhooks = await integracaoService.listarWebhooks(apiKey!.id);
    
    return { webhooks };
  });
  
  /**
   * DELETE /webhooks/:id - Remover webhook
   */
  fastify.delete('/webhooks/:id', {
    preHandler: requirePermission('webhooks:write')
  }, async (
    request: ApiKeyDecoratedRequest & { params: { id: string }},
    reply: FastifyReply
  ) => {
    const { apiKey } = request;
    const { id } = request.params;
    
    // Verificar ownership
    const webhook = await prisma.webhook.findFirst({
      where: { id, apiKeyId: apiKey!.id }
    });
    
    if (!webhook) {
      return reply.status(404).send({ error: 'Webhook não encontrado' });
    }
    
    await prisma.webhook.delete({ where: { id } });
    
    return { success: true };
  });
  
  // ==========================================
  // UTILIDADES
  // ==========================================
  
  /**
   * GET /me - Informações da API Key
   */
  fastify.get('/me', async (
    request: ApiKeyDecoratedRequest,
    reply: FastifyReply
  ) => {
    const { apiKey } = request;
    
    return {
      keyPrefix: apiKey!.keyPrefix,
      nome: apiKey!.nome,
      permissoes: apiKey!.permissoes,
      ambiente: apiKey!.ambiente,
      rateLimitPorMinuto: apiKey!.rateLimitPorMinuto,
      createdAt: apiKey!.createdAt
    };
  });
}

// ==========================================
// HELPERS
// ==========================================

/**
 * Fórmula Haversine para distância
 */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
