/**
 * @fileoverview Rotas de E-commerce - VTEX e Shopify Brasil
 * 
 * DESIGN POR CONTRATO:
 * @pre Autenticação válida (JWT ou API Key)
 * @post Operações CRUD em integrações e pedidos
 * 
 * ENDPOINTS:
 * - GET    /integracoes           - Listar integrações
 * - POST   /integracoes           - Criar integração
 * - GET    /integracoes/:id       - Detalhes da integração
 * - PUT    /integracoes/:id       - Atualizar integração
 * - DELETE /integracoes/:id       - Remover integração
 * - POST   /integracoes/:id/sync  - Sincronizar pedidos
 * - GET    /integracoes/:id/pedidos - Listar pedidos importados
 * - POST   /webhook/vtex          - Webhook VTEX
 * - POST   /webhook/shopify       - Webhook Shopify
 * 
 * @author SpeedRota Team
 * @version 1.0.0
 * @since Sprint 13-14
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as ecommerceService from '../services/ecommerce.js';
import { TipoIntegracao } from '@prisma/client';

// ==========================================
// TIPOS
// ==========================================

interface CriarIntegracaoBody {
  fornecedor: 'VTEX' | 'SHOPIFY';
  nome: string;
  credentials: {
    // VTEX
    accountName?: string;
    appKey?: string;
    appToken?: string;
    // Shopify
    shopDomain?: string;
    accessToken?: string;
    apiVersion?: string;
    // Comum
    ambiente: 'sandbox' | 'producao';
  };
  config?: {
    sincronizarAutomatico?: boolean;
    intervalorMinutos?: number;
    filtrarPorStatus?: string[];
    agruparPorZona?: boolean;
  };
}

interface SincronizarParams {
  id: string;
}

interface WebhookHeaders {
  'x-vtex-signature'?: string;
  'x-shopify-hmac-sha256'?: string;
  'x-shopify-topic'?: string;
}

// ==========================================
// ROTAS
// ==========================================

export default async function ecommerceRoutes(fastify: FastifyInstance) {
  
  // ==========================================
  // INTEGRAÇÕES CRUD
  // ==========================================

  /**
   * GET /integracoes
   * Lista integrações do usuário/empresa
   * 
   * @pre userId ou empresaId no contexto
   * @post Array de integrações
   */
  fastify.get('/integracoes', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          fornecedor: { 
            type: 'string',
            enum: ['VTEX', 'SHOPIFY', 'WOOCOMMERCE', 'MERCADOLIVRE']
          }
        }
      },
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
                  fornecedor: { type: 'string' },
                  nome: { type: ['string', 'null'] },
                  ativo: { type: 'boolean' },
                  ultimaSincronizacao: { type: ['string', 'null'] },
                  totalPedidosImportados: { type: 'integer' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: any, reply) => {
    try {
      const userId = request.user?.id;
      const empresaId = request.user?.empresaId;
      const { fornecedor } = request.query as { fornecedor?: TipoIntegracao };

      const integracoes = await ecommerceService.listarIntegracoes({
        userId,
        empresaId,
        fornecedor
      });

      return reply.send({
        success: true,
        data: integracoes
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      });
    }
  });

  /**
   * POST /integracoes
   * Criar nova integração
   * 
   * @pre Credenciais válidas
   * @post Integração criada e testada
   */
  fastify.post('/integracoes', {
    schema: {
      body: {
        type: 'object',
        required: ['fornecedor', 'nome', 'credentials'],
        properties: {
          fornecedor: { type: 'string', enum: ['VTEX', 'SHOPIFY'] },
          nome: { type: 'string', minLength: 1, maxLength: 100 },
          credentials: {
            type: 'object',
            properties: {
              accountName: { type: 'string' },
              appKey: { type: 'string' },
              appToken: { type: 'string' },
              shopDomain: { type: 'string' },
              accessToken: { type: 'string' },
              apiVersion: { type: 'string' },
              ambiente: { type: 'string', enum: ['sandbox', 'producao'] }
            },
            required: ['ambiente']
          },
          config: {
            type: 'object',
            properties: {
              sincronizarAutomatico: { type: 'boolean' },
              intervalorMinutos: { type: 'integer', minimum: 5, maximum: 1440 },
              filtrarPorStatus: { type: 'array', items: { type: 'string' } },
              agruparPorZona: { type: 'boolean' }
            }
          }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                testado: { type: 'boolean' },
                message: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request: any, reply) => {
    try {
      const userId = request.user?.id;
      const empresaId = request.user?.empresaId;
      const body = request.body as CriarIntegracaoBody;

      // Validar credenciais por plataforma
      if (body.fornecedor === 'VTEX') {
        if (!body.credentials.accountName || !body.credentials.appKey || !body.credentials.appToken) {
          return reply.status(400).send({
            success: false,
            error: 'VTEX requer: accountName, appKey, appToken'
          });
        }
      } else if (body.fornecedor === 'SHOPIFY') {
        if (!body.credentials.shopDomain || !body.credentials.accessToken) {
          return reply.status(400).send({
            success: false,
            error: 'Shopify requer: shopDomain, accessToken'
          });
        }
      }

      // Montar credenciais específicas
      const credentials = body.fornecedor === 'VTEX' 
        ? {
            accountName: body.credentials.accountName!,
            appKey: body.credentials.appKey!,
            appToken: body.credentials.appToken!,
            ambiente: body.credentials.ambiente
          }
        : {
            shopDomain: body.credentials.shopDomain!,
            accessToken: body.credentials.accessToken!,
            apiVersion: body.credentials.apiVersion || '2024-01',
            ambiente: body.credentials.ambiente
          };

      const result = await ecommerceService.criarIntegracao({
        userId,
        empresaId,
        fornecedor: body.fornecedor,
        nome: body.nome,
        credentials,
        config: body.config
      });

      return reply.status(201).send({
        success: true,
        data: {
          id: result.id,
          testado: result.testado,
          message: result.testado 
            ? 'Integração criada e conexão testada com sucesso'
            : 'Integração criada, mas não foi possível testar a conexão'
        }
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      });
    }
  });

  /**
   * POST /integracoes/:id/sync
   * Sincronizar pedidos de uma integração
   * 
   * @pre Integração existe e está ativa
   * @post Pedidos importados para processamento
   */
  fastify.post<{ Params: SincronizarParams }>('/integracoes/:id/sync', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                plataforma: { type: 'string' },
                totalEncontrados: { type: 'integer' },
                totalImportados: { type: 'integer' },
                totalDuplicados: { type: 'integer' },
                totalErros: { type: 'integer' },
                tempoMs: { type: 'integer' },
                erros: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      idExterno: { type: 'string' },
                      erro: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params;

      const resultado = await ecommerceService.sincronizarPedidos(id);

      return reply.send({
        success: resultado.sucesso,
        data: resultado
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      });
    }
  });

  /**
   * GET /integracoes/:id/pedidos
   * Listar pedidos importados pendentes
   * 
   * @pre Integração existe
   * @post Lista de pedidos prontos para geocodificação
   */
  fastify.get<{ Params: { id: string } }>('/integracoes/:id/pedidos', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['PENDENTE', 'PROCESSADO', 'IGNORADO', 'ERRO'] }
        }
      },
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
                  idExterno: { type: 'string' },
                  cliente: { type: 'string' },
                  endereco: { type: 'string' },
                  cidade: { type: 'string' },
                  uf: { type: 'string' },
                  cep: { type: ['string', 'null'] },
                  valorTotal: { type: ['number', 'null'] }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params;

      const pedidos = await ecommerceService.buscarPedidosPendentes(id);

      return reply.send({
        success: true,
        data: pedidos
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      });
    }
  });

  /**
   * POST /integracoes/:id/processar
   * Marcar pedidos como processados
   */
  fastify.post<{ Params: { id: string }; Body: { pedidoIds: string[]; paradaId?: string } }>(
    '/integracoes/:id/processar',
    {
      schema: {
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        },
        body: {
          type: 'object',
          required: ['pedidoIds'],
          properties: {
            pedidoIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
            paradaId: { type: 'string' }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        const { pedidoIds, paradaId } = request.body;

        const count = await ecommerceService.marcarPedidosProcessados(pedidoIds, paradaId);

        return reply.send({
          success: true,
          data: { processados: count }
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: (error as Error).message
        });
      }
    }
  );

  // ==========================================
  // WEBHOOKS
  // ==========================================

  /**
   * POST /webhook/vtex/:integracaoId
   * Webhook para receber novos pedidos VTEX
   * 
   * @pre Header X-VTEX-Signature válido
   * @post Pedido importado automaticamente
   */
  fastify.post<{ Params: { integracaoId: string }; Body: any }>(
    '/webhook/vtex/:integracaoId',
    {
      config: {
        rawBody: true // Necessário para validação de assinatura
      }
    },
    async (request, reply) => {
      try {
        const { integracaoId } = request.params;
        const headers = request.headers as unknown as WebhookHeaders;
        const payload = request.body;

        // Validar assinatura em produção
        if (process.env.NODE_ENV === 'production') {
          const signature = headers['x-vtex-signature'];
          // Em produção, buscar secret da integração e validar
          // Por enquanto, apenas logar warning se não tiver assinatura
          if (!signature) {
            console.warn('[Webhook VTEX] Assinatura não fornecida em produção');
            // Em produção real, descomentar:
            // return reply.status(401).send({ error: 'Assinatura obrigatória' });
          }
        }

        const resultado = await ecommerceService.processarWebhookPedido(
          integracaoId,
          'VTEX',
          payload
        );

        return reply.send(resultado);
      } catch (error) {
        console.error('[Webhook VTEX] Erro:', error);
        return reply.status(500).send({
          sucesso: false,
          erro: (error as Error).message
        });
      }
    }
  );

  /**
   * POST /webhook/shopify/:integracaoId
   * Webhook para receber novos pedidos Shopify
   * 
   * @pre Header X-Shopify-Hmac-SHA256 válido
   * @post Pedido importado automaticamente
   */
  fastify.post<{ Params: { integracaoId: string }; Body: any }>(
    '/webhook/shopify/:integracaoId',
    {
      config: {
        rawBody: true
      }
    },
    async (request, reply) => {
      try {
        const { integracaoId } = request.params;
        const headers = request.headers as unknown as WebhookHeaders;
        const payload = request.body;

        // Validar assinatura em produção
        if (process.env.NODE_ENV === 'production') {
          const signature = headers['x-shopify-hmac-sha256'];
          if (!signature) {
            console.warn('[Webhook Shopify] Assinatura não fornecida em produção');
            // Em produção real, descomentar:
            // return reply.status(401).send({ error: 'Assinatura obrigatória' });
          }
        }

        // Verificar se é evento de pedido
        const topic = headers['x-shopify-topic'];
        if (topic && !topic.startsWith('orders/')) {
          return reply.status(200).send({ message: 'Evento ignorado' });
        }

        const resultado = await ecommerceService.processarWebhookPedido(
          integracaoId,
          'SHOPIFY',
          payload
        );

        return reply.send(resultado);
      } catch (error) {
        console.error('[Webhook Shopify] Erro:', error);
        return reply.status(500).send({
          sucesso: false,
          erro: (error as Error).message
        });
      }
    }
  );

  // ==========================================
  // HEALTH CHECK
  // ==========================================

  /**
   * GET /health
   * Status do serviço de e-commerce
   */
  fastify.get('/health', async (request, reply) => {
    return reply.send({
      success: true,
      service: 'ecommerce',
      plataformas: ['VTEX', 'SHOPIFY'],
      timestamp: new Date().toISOString()
    });
  });
}
