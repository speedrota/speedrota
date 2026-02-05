/**
 * Rotas de Gestão de API Keys
 * 
 * @description Endpoints para criar/revogar API Keys (protegidos por JWT)
 * @pre Usuário autenticado via JWT
 * @post API Keys criadas/listadas/revogadas
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as integracaoService from '../services/integracoes.js';
import prisma from '../lib/prisma.js';

// ==========================================
// SCHEMAS
// ==========================================

const criarApiKeySchema = {
  body: {
    type: 'object',
    required: ['nome'],
    properties: {
      nome: { type: 'string', minLength: 1, maxLength: 100 },
      permissoes: {
        type: 'array',
        items: { type: 'string' },
        default: ['rotas:read', 'rotas:write', 'paradas:read', 'paradas:write', 'otimizacao:execute']
      },
      ambiente: { type: 'string', enum: ['SANDBOX', 'PRODUCAO'], default: 'PRODUCAO' },
      expiresAt: { type: 'string', format: 'date-time' },
      rateLimitPorMinuto: { type: 'integer', minimum: 10, maximum: 10000, default: 100 }
    }
  }
};

const criarIntegracaoSchema = {
  body: {
    type: 'object',
    required: ['fornecedor', 'nome'],
    properties: {
      fornecedor: { type: 'string', enum: ['BLING', 'TINY', 'VTEX', 'SHOPIFY', 'MAGENTO', 'SAP', 'TOTVS', 'OMIE', 'OUTRO'] },
      nome: { type: 'string', minLength: 1, maxLength: 100 },
      apiKeyExterna: { type: 'string' },
      apiSecretExterna: { type: 'string' }
    }
  }
};

// ==========================================
// PLUGIN
// ==========================================

export default async function apiKeysRoutes(fastify: FastifyInstance) {
  // Todas as rotas exigem autenticação JWT
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({ error: 'Token inválido' });
    }
  });
  
  // ==========================================
  // API KEYS
  // ==========================================
  
  /**
   * POST /api-keys - Criar nova API Key
   */
  fastify.post('/api-keys', {
    schema: criarApiKeySchema
  }, async (
    request: FastifyRequest<{
      Body: {
        nome: string;
        permissoes?: string[];
        ambiente?: 'SANDBOX' | 'PRODUCAO';
        expiresAt?: string;
        rateLimitPorMinuto?: number;
      }
    }>,
    reply: FastifyReply
  ) => {
    const { userId } = request.user;
    const body = request.body;
    
    // Verificar limite de API Keys por usuário (máx 10)
    const total = await prisma.apiKey.count({
      where: { userId, revogadoEm: null }
    });
    
    if (total >= 10) {
      return reply.status(400).send({
        error: 'Limite de API Keys atingido',
        message: 'Você pode ter no máximo 10 API Keys ativas'
      });
    }
    
    const apiKey = await integracaoService.criarApiKey({
      nome: body.nome,
      userId,
      permissoes: body.permissoes,
      ambiente: body.ambiente,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      rateLimitPorMinuto: body.rateLimitPorMinuto
    });
    
    return reply.status(201).send({
      ...apiKey,
      aviso: 'IMPORTANTE: Guarde esta chave em local seguro. Ela não será exibida novamente.'
    });
  });
  
  /**
   * GET /api-keys - Listar minhas API Keys
   */
  fastify.get('/api-keys', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const { userId } = request.user;
    
    const apiKeys = await integracaoService.listarApiKeys({ userId });
    
    return { apiKeys };
  });
  
  /**
   * DELETE /api-keys/:id - Revogar API Key
   */
  fastify.delete('/api-keys/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { userId } = request.user;
    const { id } = request.params;
    
    await integracaoService.revogarApiKey(id, userId);
    
    return { success: true };
  });
  
  /**
   * GET /api-keys/:id/logs - Logs de uso da API Key
   */
  fastify.get('/api-keys/:id/logs', async (
    request: FastifyRequest<{
      Params: { id: string };
      Querystring: { pagina?: number; limite?: number };
    }>,
    reply: FastifyReply
  ) => {
    const { userId } = request.user;
    const { id } = request.params;
    const { pagina = 1, limite = 20 } = request.query;
    
    // Verificar ownership
    const apiKey = await prisma.apiKey.findFirst({
      where: { id, userId }
    });
    
    if (!apiKey) {
      return reply.status(404).send({ error: 'API Key não encontrada' });
    }
    
    const [logs, total] = await Promise.all([
      prisma.logApiPublica.findMany({
        where: { apiKeyId: id },
        select: {
          endpoint: true,
          metodo: true,
          statusCode: true,
          latenciaMs: true,
          ip: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        skip: (Number(pagina) - 1) * Number(limite),
        take: Math.min(Number(limite), 100)
      }),
      prisma.logApiPublica.count({ where: { apiKeyId: id } })
    ]);
    
    return {
      logs,
      paginacao: {
        pagina: Number(pagina),
        limite: Number(limite),
        total,
        totalPaginas: Math.ceil(total / Number(limite))
      }
    };
  });
  
  // ==========================================
  // INTEGRAÇÕES
  // ==========================================
  
  /**
   * POST /integracoes - Criar integração com ERP
   */
  fastify.post('/integracoes', {
    schema: criarIntegracaoSchema
  }, async (
    request: FastifyRequest<{
      Body: {
        fornecedor: 'BLING' | 'TINY' | 'VTEX' | 'SHOPIFY' | 'MAGENTO' | 'SAP' | 'TOTVS' | 'OMIE' | 'OUTRO';
        nome: string;
        apiKeyExterna?: string;
        apiSecretExterna?: string;
      }
    }>,
    reply: FastifyReply
  ) => {
    const { userId } = request.user;
    const body = request.body;
    
    // Buscar empresa do usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { empresaId: true }
    });
    
    if (!user?.empresaId) {
      return reply.status(400).send({
        error: 'Usuário sem empresa',
        message: 'Você precisa estar vinculado a uma empresa para criar integrações'
      });
    }
    
    // Gerar segredo para webhook
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const webhookSecret = 'whsec_' + Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Criar integração
    const integracao = await prisma.integracaoFornecedor.create({
      data: {
        empresaId: user.empresaId,
        fornecedor: body.fornecedor,
        nome: body.nome,
        webhookSecret,
        config: {
          apiKeyExterna: body.apiKeyExterna,
          apiSecretExterna: body.apiSecretExterna
        }
      }
    });
    
    return reply.status(201).send({
      id: integracao.id,
      fornecedor: integracao.fornecedor,
      nome: integracao.nome,
      webhookUrl: `/api/v1/webhooks/erp/${integracao.fornecedor.toLowerCase()}/${integracao.id}`,
      webhookSecret // Retornado APENAS na criação
    });
  });
  
  /**
   * GET /integracoes - Listar integrações
   */
  fastify.get('/integracoes', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const { userId } = request.user;
    
    // Buscar empresa do usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { empresaId: true }
    });
    
    if (!user?.empresaId) {
      return { integracoes: [] };
    }
    
    const integracoes = await prisma.integracaoFornecedor.findMany({
      where: { empresaId: user.empresaId },
      select: {
        id: true,
        fornecedor: true,
        nome: true,
        ativo: true,
        ultimaSincronizacao: true,
        totalPedidosImportados: true,
        totalErros: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return { integracoes };
  });
  
  /**
   * DELETE /integracoes/:id - Desativar integração
   */
  fastify.delete('/integracoes/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { userId } = request.user;
    const { id } = request.params;
    
    // Buscar empresa do usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { empresaId: true }
    });
    
    if (!user?.empresaId) {
      return reply.status(404).send({ error: 'Integração não encontrada' });
    }
    
    // Verificar ownership
    const integracao = await prisma.integracaoFornecedor.findFirst({
      where: { id, empresaId: user.empresaId }
    });
    
    if (!integracao) {
      return reply.status(404).send({ error: 'Integração não encontrada' });
    }
    
    await prisma.integracaoFornecedor.update({
      where: { id },
      data: { ativo: false }
    });
    
    return { success: true };
  });
  
  /**
   * GET /integracoes/:id/pedidos - Listar pedidos importados
   */
  fastify.get('/integracoes/:id/pedidos', async (
    request: FastifyRequest<{
      Params: { id: string };
      Querystring: { status?: string; pagina?: number; limite?: number };
    }>,
    reply: FastifyReply
  ) => {
    const { userId } = request.user;
    const { id } = request.params;
    const { status, pagina, limite } = request.query;
    
    // Buscar empresa do usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { empresaId: true }
    });
    
    if (!user?.empresaId) {
      return reply.status(404).send({ error: 'Integração não encontrada' });
    }
    
    // Verificar ownership
    const integracao = await prisma.integracaoFornecedor.findFirst({
      where: { id, empresaId: user.empresaId }
    });
    
    if (!integracao) {
      return reply.status(404).send({ error: 'Integração não encontrada' });
    }
    
    const result = await integracaoService.listarPedidosImportados({
      integracaoId: id,
      status,
      pagina: Number(pagina) || 1,
      limite: Number(limite) || 20
    });
    
    return result;
  });
  
  /**
   * POST /integracoes/:id/converter - Converter pedidos em paradas
   */
  fastify.post('/integracoes/:id/converter', async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: { pedidoIds: string[]; rotaId: string };
    }>,
    reply: FastifyReply
  ) => {
    const { userId } = request.user;
    const { id } = request.params;
    const { pedidoIds, rotaId } = request.body;
    
    // Buscar empresa do usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { empresaId: true }
    });
    
    if (!user?.empresaId) {
      return reply.status(404).send({ error: 'Integração não encontrada' });
    }
    
    // Verificar ownership da integração
    const integracao = await prisma.integracaoFornecedor.findFirst({
      where: { id, empresaId: user.empresaId }
    });
    
    if (!integracao) {
      return reply.status(404).send({ error: 'Integração não encontrada' });
    }
    
    // Verificar ownership da rota
    const rota = await prisma.rota.findFirst({
      where: { id: rotaId, userId }
    });
    
    if (!rota) {
      return reply.status(404).send({ error: 'Rota não encontrada' });
    }
    
    const result = await integracaoService.converterPedidosEmParadas(pedidoIds, rotaId);
    
    return result;
  });
}
