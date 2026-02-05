/**
 * Rotas de Webhook para ERPs
 * 
 * @description Endpoints para receber notificações de Bling, Tiny, etc.
 * @pre Integração configurada com segredo de validação
 * @post Pedidos importados para processamento
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHmac } from 'crypto';
import prisma from '../lib/prisma.js';
import * as integracaoService from '../services/integracoes.js';

// ==========================================
// TIPOS
// ==========================================

interface BlingWebhookPayload {
  event: string;
  data: {
    id: number;
    numero: string;
    data: string;
    cliente: {
      nome: string;
      cpf_cnpj?: string;
      fone?: string;
      celular?: string;
      email?: string;
      endereco?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      cidade?: string;
      uf?: string;
      cep?: string;
    };
    itens?: Array<{
      codigo: string;
      descricao: string;
      quantidade: number;
      valor: number;
    }>;
    volumes?: number;
    peso_total?: number;
    valor_total?: number;
    observacoes?: string;
  };
}

interface TinyWebhookPayload {
  tipo: string;
  dados: {
    id: string;
    numero: string;
    data_pedido: string;
    nome_comprador: string;
    cpf_cnpj_comprador?: string;
    telefone_comprador?: string;
    email_comprador?: string;
    endereco_entrega: {
      endereco: string;
      numero: string;
      complemento?: string;
      bairro: string;
      cidade: string;
      uf: string;
      cep: string;
    };
    total_pedido?: number;
    peso_bruto?: number;
    quantidade_volumes?: number;
  };
}

// ==========================================
// PLUGIN
// ==========================================

export default async function webhookErpRoutes(fastify: FastifyInstance) {
  
  // ==========================================
  // BLING
  // ==========================================
  
  /**
   * POST /bling/:integracaoId - Receber webhook do Bling
   * 
   * @description Bling envia pedidos novos/atualizados via webhook
   * @pre X-Bling-Signature no header com HMAC do payload
   */
  fastify.post('/bling/:integracaoId', async (
    request: FastifyRequest<{
      Params: { integracaoId: string };
      Body: BlingWebhookPayload;
    }>,
    reply: FastifyReply
  ) => {
    const { integracaoId } = request.params;
    const payload = request.body;
    
    // Buscar integração
    const integracao = await prisma.integracaoFornecedor.findUnique({
      where: { id: integracaoId }
    });
    
    if (!integracao || !integracao.ativo) {
      return reply.status(404).send({ error: 'Integração não encontrada ou inativa' });
    }
    
    // Validar assinatura HMAC (se configurada)
    const signature = request.headers['x-bling-signature'] as string;
    if (integracao.webhookSecret && signature) {
      const expectedSignature = createHmac('sha256', integracao.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');
      
      if (signature !== expectedSignature) {
        fastify.log.warn({ integracaoId }, 'Assinatura inválida do webhook Bling');
        return reply.status(401).send({ error: 'Assinatura inválida' });
      }
    }
    
    // Verificar evento (pedidos.criado, pedidos.alterado, etc.)
    if (!payload.event?.startsWith('pedidos')) {
      return reply.status(200).send({ ignored: true, reason: 'Evento não é de pedidos' });
    }
    
    try {
      const result = await integracaoService.processarPedidoBling(payload.data, integracaoId);
      
      fastify.log.info({
        integracaoId,
        pedidoId: result.pedidoImportadoId,
        blingId: payload.data.id
      }, 'Pedido Bling importado');
      
      return reply.status(200).send({
        success: true,
        pedidoImportadoId: result.pedidoImportadoId,
        paradaId: result.paradaId
      });
    } catch (error) {
      fastify.log.error({ error, integracaoId }, 'Erro ao processar webhook Bling');
      
      // Ainda retorna 200 para evitar reenvios (Bling pode retentar)
      return reply.status(200).send({
        success: false,
        error: (error as Error).message
      });
    }
  });
  
  // ==========================================
  // TINY
  // ==========================================
  
  /**
   * POST /tiny/:integracaoId - Receber webhook do Tiny
   * 
   * @description Tiny envia pedidos via callback URL configurada
   */
  fastify.post('/tiny/:integracaoId', async (
    request: FastifyRequest<{
      Params: { integracaoId: string };
      Body: TinyWebhookPayload;
    }>,
    reply: FastifyReply
  ) => {
    const { integracaoId } = request.params;
    const payload = request.body;
    
    // Buscar integração
    const integracao = await prisma.integracaoFornecedor.findUnique({
      where: { id: integracaoId }
    });
    
    if (!integracao || !integracao.ativo) {
      return reply.status(404).send({ error: 'Integração não encontrada ou inativa' });
    }
    
    // Validar assinatura (se configurada)
    const signature = request.headers['x-tiny-signature'] as string;
    if (integracao.webhookSecret && signature) {
      const expectedSignature = createHmac('sha256', integracao.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');
      
      if (signature !== expectedSignature) {
        fastify.log.warn({ integracaoId }, 'Assinatura inválida do webhook Tiny');
        return reply.status(401).send({ error: 'Assinatura inválida' });
      }
    }
    
    // Verificar tipo (pedido_incluido, pedido_alterado, etc.)
    if (!payload.tipo?.startsWith('pedido')) {
      return reply.status(200).send({ ignored: true, reason: 'Tipo não é de pedidos' });
    }
    
    try {
      const result = await integracaoService.processarPedidoTiny(payload.dados, integracaoId);
      
      fastify.log.info({
        integracaoId,
        pedidoId: result.pedidoImportadoId,
        tinyId: payload.dados.id
      }, 'Pedido Tiny importado');
      
      return reply.status(200).send({
        success: true,
        pedidoImportadoId: result.pedidoImportadoId
      });
    } catch (error) {
      fastify.log.error({ error, integracaoId }, 'Erro ao processar webhook Tiny');
      
      return reply.status(200).send({
        success: false,
        error: (error as Error).message
      });
    }
  });
  
  // ==========================================
  // GENÉRICO (para outros ERPs)
  // ==========================================
  
  /**
   * POST /generic/:integracaoId - Receber webhook genérico
   * 
   * @description Endpoint flexível para ERPs customizados
   * Espera payload com campos padronizados
   */
  fastify.post('/generic/:integracaoId', async (
    request: FastifyRequest<{
      Params: { integracaoId: string };
      Body: {
        idExterno: string;
        numero?: string;
        cliente: string;
        endereco: string;
        cidade: string;
        uf: string;
        cep?: string;
        telefone?: string;
        valor?: number;
        peso?: number;
        volumes?: number;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { integracaoId } = request.params;
    const payload = request.body;
    
    // Buscar integração
    const integracao = await prisma.integracaoFornecedor.findUnique({
      where: { id: integracaoId }
    });
    
    if (!integracao || !integracao.ativo) {
      return reply.status(404).send({ error: 'Integração não encontrada ou inativa' });
    }
    
    // Validar assinatura
    const signature = request.headers['x-webhook-signature'] as string;
    if (integracao.webhookSecret && signature) {
      const expectedSignature = createHmac('sha256', integracao.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');
      
      if (signature !== expectedSignature) {
        return reply.status(401).send({ error: 'Assinatura inválida' });
      }
    }
    
    // Validar campos obrigatórios
    if (!payload.idExterno || !payload.cliente || !payload.endereco) {
      return reply.status(400).send({
        error: 'Campos obrigatórios: idExterno, cliente, endereco, cidade, uf'
      });
    }
    
    try {
      // Verificar se já existe
      const existente = await prisma.pedidoImportado.findUnique({
        where: {
          integracaoId_idExterno: {
            integracaoId,
            idExterno: payload.idExterno
          }
        }
      });
      
      if (existente) {
        return reply.status(200).send({
          success: true,
          pedidoImportadoId: existente.id,
          duplicated: true
        });
      }
      
      // Criar pedido
      const pedido = await prisma.pedidoImportado.create({
        data: {
          integracaoId,
          idExterno: payload.idExterno,
          numeroNota: payload.numero,
          cliente: payload.cliente,
          endereco: payload.endereco,
          cidade: payload.cidade,
          uf: payload.uf,
          cep: payload.cep,
          telefone: payload.telefone,
          valorTotal: payload.valor,
          peso: payload.peso,
          volumes: payload.volumes,
          status: 'PENDENTE'
        }
      });
      
      // Atualizar contador
      await prisma.integracaoFornecedor.update({
        where: { id: integracaoId },
        data: {
          totalPedidosImportados: { increment: 1 },
          ultimaSincronizacao: new Date()
        }
      });
      
      return reply.status(200).send({
        success: true,
        pedidoImportadoId: pedido.id
      });
    } catch (error) {
      fastify.log.error({ error, integracaoId }, 'Erro ao processar webhook genérico');
      
      return reply.status(200).send({
        success: false,
        error: (error as Error).message
      });
    }
  });
  
  // ==========================================
  // STATUS
  // ==========================================
  
  /**
   * GET /:integracaoId/status - Status da integração
   */
  fastify.get('/:integracaoId/status', async (
    request: FastifyRequest<{ Params: { integracaoId: string } }>,
    reply: FastifyReply
  ) => {
    const { integracaoId } = request.params;
    
    const integracao = await prisma.integracaoFornecedor.findUnique({
      where: { id: integracaoId },
      select: {
        id: true,
        fornecedor: true,
        ativo: true,
        ultimaSincronizacao: true,
        totalPedidosImportados: true,
        totalErros: true,
        createdAt: true
      }
    });
    
    if (!integracao) {
      return reply.status(404).send({ error: 'Integração não encontrada' });
    }
    
    // Contar pedidos por status
    const [pendentes, processados, erros] = await Promise.all([
      prisma.pedidoImportado.count({ where: { integracaoId, status: 'PENDENTE' } }),
      prisma.pedidoImportado.count({ where: { integracaoId, status: 'PROCESSADO' } }),
      prisma.pedidoImportado.count({ where: { integracaoId, status: 'ERRO' } })
    ]);
    
    return {
      ...integracao,
      pedidos: {
        pendentes,
        processados,
        erros
      }
    };
  });
}
