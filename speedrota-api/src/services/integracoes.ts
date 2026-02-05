/**
 * Service de Integrações - API Pública
 * 
 * @description Gerencia API Keys, Webhooks e integração com ERPs
 * @pre Usuário ou Empresa autenticado
 * @post Operações de CRUD em chaves e webhooks
 */

import prisma from '../lib/prisma.js';
import { createHmac, createHash } from 'crypto';
import { generateApiKey, type ApiKeyInfo } from '../middleware/apiKeyAuth.js';

// ==========================================
// TIPOS
// ==========================================

export interface CriarApiKeyInput {
  nome: string;
  empresaId?: string;
  userId?: string;
  permissoes?: string[];
  ambiente?: 'SANDBOX' | 'PRODUCAO';
  expiresAt?: Date;
  rateLimitPorMinuto?: number;
}

export interface CriarWebhookInput {
  apiKeyId: string;
  url: string;
  eventos: string[];
}

export interface PedidoBlingPayload {
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
}

export interface PedidoTinyPayload {
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
}

// Eventos disponíveis para webhooks
export const EVENTOS_WEBHOOK = [
  'rota.criada',
  'rota.otimizada',
  'rota.iniciada',
  'rota.pausada',
  'rota.retomada',
  'rota.finalizada',
  'rota.cancelada',
  'parada.criada',
  'parada.atualizada',
  'parada.entregue',
  'parada.falhou',
  'parada.pulada',
  'motorista.atribuido',
  'motorista.posicao',
  'pod.registrado'
] as const;

// Permissões disponíveis
export const PERMISSOES_API = [
  '*',           // Todas as permissões
  'rotas:*',     // Todas em rotas
  'rotas:read',
  'rotas:write',
  'paradas:*',
  'paradas:read',
  'paradas:write',
  'otimizacao:*',
  'otimizacao:execute',
  'webhooks:*',
  'webhooks:read',
  'webhooks:write',
  'motoristas:*',
  'motoristas:read',
  'motoristas:write',
  'integracoes:*',
  'integracoes:read',
  'integracoes:write'
] as const;

// ==========================================
// API KEYS
// ==========================================

/**
 * Criar nova API Key
 * 
 * @description Gera nova chave de API
 * @pre empresaId ou userId válido
 * @post API Key criada, retorna chave APENAS uma vez
 */
export async function criarApiKey(input: CriarApiKeyInput): Promise<{
  id: string;
  key: string;  // Retornado APENAS na criação
  keyPrefix: string;
  nome: string;
  permissoes: string[];
  ambiente: string;
  expiresAt: Date | null;
}> {
  // Validar que tem empresaId OU userId
  if (!input.empresaId && !input.userId) {
    throw new Error('empresaId ou userId é obrigatório');
  }
  
  // Gerar chave
  const { key, keyPrefix, keyHash } = generateApiKey(input.ambiente);
  
  // Permissões padrão
  const permissoes = input.permissoes?.length
    ? input.permissoes
    : ['rotas:read', 'rotas:write', 'paradas:read', 'paradas:write', 'otimizacao:execute'];
  
  // Criar no banco
  const apiKey = await prisma.apiKey.create({
    data: {
      keyHash,
      keyPrefix,
      nome: input.nome,
      empresaId: input.empresaId,
      userId: input.userId,
      permissoes,
      ambiente: input.ambiente || 'PRODUCAO',
      expiresAt: input.expiresAt,
      rateLimitPorMinuto: input.rateLimitPorMinuto || 100
    }
  });
  
  return {
    id: apiKey.id,
    key, // IMPORTANTE: Única vez que a chave completa é retornada
    keyPrefix: apiKey.keyPrefix,
    nome: apiKey.nome,
    permissoes: apiKey.permissoes,
    ambiente: apiKey.ambiente,
    expiresAt: apiKey.expiresAt
  };
}

/**
 * Listar API Keys
 * 
 * @pre empresaId ou userId
 * @post Lista de chaves (sem o hash completo)
 */
export async function listarApiKeys(filtro: {
  empresaId?: string;
  userId?: string;
}): Promise<Array<{
  id: string;
  keyPrefix: string;
  nome: string;
  ambiente: string;
  ativo: boolean;
  ultimoUso: Date | null;
  totalRequisicoes: number;
  createdAt: Date;
}>> {
  const apiKeys = await prisma.apiKey.findMany({
    where: {
      empresaId: filtro.empresaId,
      userId: filtro.userId,
      revogadoEm: null
    },
    select: {
      id: true,
      keyPrefix: true,
      nome: true,
      ambiente: true,
      ativo: true,
      ultimoUso: true,
      totalRequisicoes: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  });
  
  return apiKeys;
}

/**
 * Revogar API Key
 * 
 * @pre API Key existe e pertence ao usuário/empresa
 * @post API Key marcada como revogada
 */
export async function revogarApiKey(apiKeyId: string, donoId: string): Promise<void> {
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: apiKeyId,
      OR: [
        { empresaId: donoId },
        { userId: donoId }
      ]
    }
  });
  
  if (!apiKey) {
    throw new Error('API Key não encontrada');
  }
  
  await prisma.apiKey.update({
    where: { id: apiKeyId },
    data: {
      ativo: false,
      revogadoEm: new Date()
    }
  });
}

// ==========================================
// WEBHOOKS
// ==========================================

/**
 * Criar webhook
 * 
 * @pre API Key válida, URL acessível
 * @post Webhook criado com segredo para validação HMAC
 */
export async function criarWebhook(input: CriarWebhookInput): Promise<{
  id: string;
  url: string;
  eventos: string[];
  segredo: string; // Retornado APENAS na criação
}> {
  // Validar eventos
  const eventosInvalidos = input.eventos.filter(e => !EVENTOS_WEBHOOK.includes(e as typeof EVENTOS_WEBHOOK[number]));
  if (eventosInvalidos.length > 0) {
    throw new Error(`Eventos inválidos: ${eventosInvalidos.join(', ')}`);
  }
  
  // Gerar segredo para HMAC
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const segredo = 'whsec_' + Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const webhook = await prisma.webhook.create({
    data: {
      apiKeyId: input.apiKeyId,
      url: input.url,
      eventos: input.eventos,
      segredo
    }
  });
  
  return {
    id: webhook.id,
    url: webhook.url,
    eventos: webhook.eventos,
    segredo // IMPORTANTE: Única vez que o segredo é retornado
  };
}

/**
 * Listar webhooks
 */
export async function listarWebhooks(apiKeyId: string): Promise<Array<{
  id: string;
  url: string;
  eventos: string[];
  ativo: boolean;
  totalEnvios: number;
  totalSucessos: number;
  ultimoEnvio: Date | null;
}>> {
  return prisma.webhook.findMany({
    where: { apiKeyId },
    select: {
      id: true,
      url: true,
      eventos: true,
      ativo: true,
      totalEnvios: true,
      totalSucessos: true,
      ultimoEnvio: true
    }
  });
}

/**
 * Disparar webhook para evento
 * 
 * @pre Webhook configurado para o evento
 * @post Webhook enfileirado para envio
 */
export async function dispararWebhook(
  evento: string,
  payload: Record<string, unknown>,
  empresaId?: string,
  userId?: string
): Promise<void> {
  // Buscar webhooks que escutam esse evento
  const webhooks = await prisma.webhook.findMany({
    where: {
      ativo: true,
      eventos: { has: evento },
      apiKey: {
        ativo: true,
        OR: [
          { empresaId },
          { userId }
        ].filter(f => Object.values(f)[0] !== undefined) as Array<{ empresaId?: string; userId?: string }>
      }
    },
    include: {
      apiKey: { select: { id: true } }
    }
  });
  
  // Criar entregas pendentes
  for (const webhook of webhooks) {
    const payloadJson = JSON.stringify({
      evento,
      timestamp: new Date().toISOString(),
      data: payload
    });
    
    await prisma.webhookEntrega.create({
      data: {
        webhookId: webhook.id,
        evento,
        payload: payloadJson,
        status: 'PENDENTE',
        proximaTentativa: new Date()
      }
    });
  }
}

/**
 * Processar fila de webhooks (chamado por job)
 */
export async function processarFilaWebhooks(): Promise<{ enviados: number; falhas: number }> {
  const pendentes = await prisma.webhookEntrega.findMany({
    where: {
      status: 'PENDENTE',
      tentativas: { lt: 5 },
      proximaTentativa: { lte: new Date() }
    },
    include: {
      webhook: true
    },
    take: 100
  });
  
  let enviados = 0;
  let falhas = 0;
  
  for (const entrega of pendentes) {
    try {
      // Calcular assinatura HMAC
      const assinatura = createHmac('sha256', entrega.webhook.segredo)
        .update(entrega.payload)
        .digest('hex');
      
      // Enviar
      const response = await fetch(entrega.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SpeedRota-Signature': `sha256=${assinatura}`,
          'X-SpeedRota-Event': entrega.evento,
          'X-SpeedRota-Delivery': entrega.id
        },
        body: entrega.payload,
        signal: AbortSignal.timeout(30000) // 30s timeout
      });
      
      if (response.ok) {
        await prisma.$transaction([
          prisma.webhookEntrega.update({
            where: { id: entrega.id },
            data: {
              status: 'ENVIADO',
              httpStatus: response.status,
              tentativas: { increment: 1 },
              enviadoEm: new Date()
            }
          }),
          prisma.webhook.update({
            where: { id: entrega.webhook.id },
            data: {
              totalEnvios: { increment: 1 },
              totalSucessos: { increment: 1 },
              ultimoEnvio: new Date(),
              ultimoStatus: response.status
            }
          })
        ]);
        enviados++;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      const tentativas = entrega.tentativas + 1;
      const proximaTentativa = tentativas < 5
        ? new Date(Date.now() + Math.pow(2, tentativas) * 60000) // Exponential backoff
        : null;
      
      await prisma.$transaction([
        prisma.webhookEntrega.update({
          where: { id: entrega.id },
          data: {
            status: tentativas >= 5 ? 'FALHOU' : 'PENDENTE',
            tentativas,
            proximaTentativa,
            erro: (error as Error).message
          }
        }),
        prisma.webhook.update({
          where: { id: entrega.webhook.id },
          data: {
            totalEnvios: { increment: 1 },
            totalFalhas: { increment: 1 },
            ultimoEnvio: new Date()
          }
        })
      ]);
      falhas++;
    }
  }
  
  return { enviados, falhas };
}

// ==========================================
// INTEGRAÇÃO COM ERPs
// ==========================================

/**
 * Processar pedido do Bling
 * 
 * @description Converte pedido do Bling para parada
 * @pre Payload do webhook Bling válido
 * @post Parada criada ou PedidoImportado registrado
 */
export async function processarPedidoBling(
  payload: PedidoBlingPayload,
  integracaoId: string
): Promise<{
  pedidoImportadoId: string;
  paradaId?: string;
}> {
  const integracao = await prisma.integracaoFornecedor.findUnique({
    where: { id: integracaoId }
  });
  
  if (!integracao) {
    throw new Error('Integração não encontrada');
  }
  
  // Montar endereço
  const endereco = [
    payload.cliente.endereco,
    payload.cliente.numero,
    payload.cliente.complemento,
    payload.cliente.bairro
  ].filter(Boolean).join(', ');
  
  // Verificar se já foi importado
  const existente = await prisma.pedidoImportado.findUnique({
    where: {
      integracaoId_idExterno: {
        integracaoId,
        idExterno: String(payload.id)
      }
    }
  });
  
  if (existente) {
    return { pedidoImportadoId: existente.id, paradaId: existente.paradaId || undefined };
  }
  
  // Criar pedido importado
  const pedidoImportado = await prisma.pedidoImportado.create({
    data: {
      integracaoId,
      idExterno: String(payload.id),
      numeroNota: payload.numero,
      cliente: payload.cliente.nome,
      endereco,
      cidade: payload.cliente.cidade || 'N/A',
      uf: payload.cliente.uf || 'N/A',
      cep: payload.cliente.cep,
      telefone: payload.cliente.celular || payload.cliente.fone,
      valorTotal: payload.valor_total,
      peso: payload.peso_total,
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
  
  return { pedidoImportadoId: pedidoImportado.id };
}

/**
 * Processar pedido do Tiny
 * 
 * @description Converte pedido do Tiny para parada
 * @pre Payload do webhook Tiny válido
 * @post PedidoImportado registrado
 */
export async function processarPedidoTiny(
  payload: PedidoTinyPayload,
  integracaoId: string
): Promise<{ pedidoImportadoId: string }> {
  const integracao = await prisma.integracaoFornecedor.findUnique({
    where: { id: integracaoId }
  });
  
  if (!integracao) {
    throw new Error('Integração não encontrada');
  }
  
  // Montar endereço
  const endereco = [
    payload.endereco_entrega.endereco,
    payload.endereco_entrega.numero,
    payload.endereco_entrega.complemento,
    payload.endereco_entrega.bairro
  ].filter(Boolean).join(', ');
  
  // Verificar se já foi importado
  const existente = await prisma.pedidoImportado.findUnique({
    where: {
      integracaoId_idExterno: {
        integracaoId,
        idExterno: payload.id
      }
    }
  });
  
  if (existente) {
    return { pedidoImportadoId: existente.id };
  }
  
  // Criar pedido importado
  const pedidoImportado = await prisma.pedidoImportado.create({
    data: {
      integracaoId,
      idExterno: payload.id,
      numeroNota: payload.numero,
      cliente: payload.nome_comprador,
      endereco,
      cidade: payload.endereco_entrega.cidade,
      uf: payload.endereco_entrega.uf,
      cep: payload.endereco_entrega.cep,
      telefone: payload.telefone_comprador,
      valorTotal: payload.total_pedido,
      peso: payload.peso_bruto,
      volumes: payload.quantidade_volumes,
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
  
  return { pedidoImportadoId: pedidoImportado.id };
}

/**
 * Converter pedidos importados em paradas
 * 
 * @pre Pedidos com status PENDENTE
 * @post Paradas criadas na rota especificada
 */
export async function converterPedidosEmParadas(
  pedidoIds: string[],
  rotaId: string
): Promise<{ convertidos: number; erros: string[] }> {
  const erros: string[] = [];
  let convertidos = 0;
  
  for (const pedidoId of pedidoIds) {
    try {
      const pedido = await prisma.pedidoImportado.findUnique({
        where: { id: pedidoId },
        include: { integracao: true }
      });
      
      if (!pedido || pedido.status !== 'PENDENTE') {
        erros.push(`Pedido ${pedidoId}: não encontrado ou já processado`);
        continue;
      }
      
      // Geocodificar endereço (simplificado - em produção usar serviço real)
      // Por enquanto, usar coordenadas placeholder
      const lat = -23.55 + Math.random() * 0.1;
      const lng = -46.63 + Math.random() * 0.1;
      
      // Criar parada
      const parada = await prisma.parada.create({
        data: {
          rotaId,
          lat,
          lng,
          endereco: pedido.endereco,
          cidade: pedido.cidade,
          uf: pedido.uf,
          cep: pedido.cep,
          nome: pedido.cliente,
          telefone: pedido.telefone,
          fornecedor: pedido.integracao.fornecedor.toLowerCase(),
          fonte: 'integracao',
          confianca: 1.0,
          prioridade: 'MEDIA'
        }
      });
      
      // Atualizar pedido
      await prisma.pedidoImportado.update({
        where: { id: pedidoId },
        data: {
          status: 'PROCESSADO',
          paradaId: parada.id,
          processadoEm: new Date()
        }
      });
      
      convertidos++;
    } catch (error) {
      erros.push(`Pedido ${pedidoId}: ${(error as Error).message}`);
    }
  }
  
  return { convertidos, erros };
}

/**
 * Listar pedidos importados
 */
export async function listarPedidosImportados(filtro: {
  integracaoId?: string;
  empresaId?: string;
  status?: string;
  pagina?: number;
  limite?: number;
}): Promise<{
  pedidos: Array<{
    id: string;
    idExterno: string;
    cliente: string;
    endereco: string;
    cidade: string;
    status: string;
    createdAt: Date;
  }>;
  total: number;
}> {
  const pagina = filtro.pagina || 1;
  const limite = Math.min(filtro.limite || 20, 100);
  
  const where = {
    integracao: {
      id: filtro.integracaoId,
      empresaId: filtro.empresaId
    },
    status: filtro.status as 'PENDENTE' | 'PROCESSADO' | 'IGNORADO' | 'ERRO' | undefined
  };
  
  const [pedidos, total] = await Promise.all([
    prisma.pedidoImportado.findMany({
      where,
      select: {
        id: true,
        idExterno: true,
        cliente: true,
        endereco: true,
        cidade: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      skip: (pagina - 1) * limite,
      take: limite
    }),
    prisma.pedidoImportado.count({ where })
  ]);
  
  return { pedidos, total };
}
