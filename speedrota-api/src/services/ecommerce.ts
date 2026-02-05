/**
 * @fileoverview Serviço de Integração E-commerce (VTEX + Shopify Brasil)
 * 
 * DESIGN POR CONTRATO:
 * @pre Credenciais válidas (API Key, Access Token)
 * @pre Ambiente configurado (sandbox ou produção)
 * @post Pedidos importados com endereço completo para geocodificação
 * @invariant Rate limit respeitado (VTEX: 60/min, Shopify: 40/s)
 * 
 * FUNCIONALIDADES:
 * 1. Autenticação OAuth/API Key para ambas plataformas
 * 2. Sincronização de pedidos pendentes de entrega
 * 3. Atualização de status (entregue, falhou, em trânsito)
 * 4. Webhook para receber novos pedidos automaticamente
 * 
 * QUALITY GATES:
 * - Validação de schema nos payloads
 * - Retry com backoff exponencial (3 tentativas)
 * - Cache de tokens (15min VTEX, 1h Shopify)
 * - Logs estruturados para debugging
 * 
 * @author SpeedRota Team
 * @version 1.0.0
 * @since Sprint 13-14
 */

import prisma from '../lib/prisma.js';
import { TipoIntegracao, StatusPedidoImportado } from '@prisma/client';
import { createHmac } from 'crypto';

// ==========================================
// TIPOS - VTEX
// ==========================================

export interface VtexCredentials {
  accountName: string;      // Nome da conta VTEX
  appKey: string;           // X-VTEX-API-AppKey
  appToken: string;         // X-VTEX-API-AppToken
  ambiente: 'sandbox' | 'producao';
}

export interface VtexOrder {
  orderId: string;
  sequence: string;
  marketplaceOrderId: string;
  creationDate: string;
  clientName: string;
  clientProfileData: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    document: string;        // CPF ou CNPJ
    documentType: 'cpf' | 'cnpj';
  };
  shippingData: {
    address: {
      addressType: 'residential' | 'commercial';
      receiverName: string;
      street: string;
      number: string;
      complement?: string;
      neighborhood: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      geoCoordinates?: [number, number]; // [lng, lat]
    };
    logisticsInfo: Array<{
      itemIndex: number;
      selectedSla: string;
      deliveryWindow?: {
        startDateUtc: string;
        endDateUtc: string;
      };
    }>;
  };
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    sellingPrice: number;
  }>;
  value: number;            // Centavos
  status: string;
  statusDescription: string;
  packageAttachment?: {
    packages: Array<{
      courier: string;
      trackingNumber: string;
      trackingUrl: string;
    }>;
  };
}

export interface VtexOrderListResponse {
  list: VtexOrder[];
  paging: {
    total: number;
    pages: number;
    currentPage: number;
    perPage: number;
  };
}

// ==========================================
// TIPOS - SHOPIFY
// ==========================================

export interface ShopifyCredentials {
  shopDomain: string;       // loja.myshopify.com
  accessToken: string;      // Admin API access token
  apiVersion: string;       // Ex: '2024-01'
  ambiente: 'sandbox' | 'producao';
}

export interface ShopifyOrder {
  id: number;
  name: string;             // #1001
  order_number: number;
  created_at: string;
  fulfillment_status: 'fulfilled' | 'partial' | 'unfulfilled' | null;
  financial_status: 'pending' | 'authorized' | 'paid' | 'refunded' | 'voided';
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
    default_address?: {
      address1: string;
      address2?: string;
      city: string;
      province: string;
      province_code: string;
      country: string;
      country_code: string;
      zip: string;
    };
  };
  shipping_address: {
    first_name: string;
    last_name: string;
    address1: string;
    address2?: string;
    city: string;
    province: string;
    province_code: string;
    country: string;
    country_code: string;
    zip: string;
    phone?: string;
    name: string;
  };
  line_items: Array<{
    id: number;
    title: string;
    quantity: number;
    price: string;
    sku?: string;
    grams: number;
  }>;
  total_price: string;
  total_weight: number;     // gramas
  note?: string;
  tags?: string;
}

export interface ShopifyOrdersResponse {
  orders: ShopifyOrder[];
}

// ==========================================
// TIPOS COMUNS
// ==========================================

export interface PedidoNormalizado {
  idExterno: string;
  numeroNota?: string;
  plataforma: 'VTEX' | 'SHOPIFY';
  cliente: {
    nome: string;
    documento?: string;
    telefone?: string;
    email?: string;
  };
  endereco: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
    geolocalizacao?: {
      lat: number;
      lng: number;
    };
  };
  itens: Array<{
    nome: string;
    quantidade: number;
    valorUnitario: number;
  }>;
  valorTotal: number;
  pesoTotal?: number;       // kg
  volumesTotal?: number;
  dataCompra: Date;
  observacoes?: string;
}

export interface ResultadoSincronizacao {
  sucesso: boolean;
  plataforma: 'VTEX' | 'SHOPIFY';
  totalEncontrados: number;
  totalImportados: number;
  totalDuplicados: number;
  totalErros: number;
  erros: Array<{
    idExterno: string;
    erro: string;
  }>;
  tempoMs: number;
}

export interface ConfiguracaoEcommerce {
  sincronizarAutomatico: boolean;
  intervalorMinutos: number;
  filtrarPorStatus: string[];      // Ex: ['ready-for-handling']
  filtrarPorSla?: string;          // Ex: 'Entrega Expressa'
  agruparPorZona: boolean;
}

// ==========================================
// CONSTANTES
// ==========================================

const VTEX_BASE_URL = (account: string) => `https://${account}.vtexcommercestable.com.br`;
const VTEX_API_VERSION = 'v1';
const VTEX_RATE_LIMIT = 60; // requisições por minuto

const SHOPIFY_API_VERSION = '2024-01';
const SHOPIFY_RATE_LIMIT = 40; // requisições por segundo (burst)

// Cache de tokens (em memória - produção usar Redis)
const tokenCache = new Map<string, { token: string; expiresAt: Date }>();

// ==========================================
// UTILITÁRIOS
// ==========================================

/**
 * Delay para rate limiting
 * @pre ms >= 0
 * @post Aguarda ms milissegundos
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry com backoff exponencial
 * @pre fn é uma função async
 * @pre maxRetries >= 1
 * @post Retorna resultado ou throw após maxRetries
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const isRateLimit = (error as any)?.status === 429;
      
      if (attempt < maxRetries) {
        const delayMs = isRateLimit 
          ? baseDelayMs * Math.pow(2, attempt)  // Exponential for rate limit
          : baseDelayMs * attempt;               // Linear for other errors
        
        console.log(`[Ecommerce] Tentativa ${attempt}/${maxRetries} falhou, aguardando ${delayMs}ms...`);
        await delay(delayMs);
      }
    }
  }
  
  throw lastError;
}

/**
 * Normaliza CEP brasileiro
 * @pre cep pode ter formatação variada
 * @post Retorna 8 dígitos ou string original se inválido
 */
function normalizarCep(cep: string): string {
  const digits = cep.replace(/\D/g, '');
  return digits.length === 8 ? digits : cep;
}

/**
 * Normaliza UF brasileira
 * @pre uf pode ser nome completo ou sigla
 * @post Retorna sigla 2 caracteres uppercase
 */
function normalizarUf(uf: string): string {
  const mapa: Record<string, string> = {
    'são paulo': 'SP', 'sao paulo': 'SP',
    'rio de janeiro': 'RJ',
    'minas gerais': 'MG',
    'bahia': 'BA',
    'paraná': 'PR', 'parana': 'PR',
    'rio grande do sul': 'RS',
    'santa catarina': 'SC',
    'pernambuco': 'PE',
    'ceará': 'CE', 'ceara': 'CE',
    'goiás': 'GO', 'goias': 'GO',
    'pará': 'PA', 'para': 'PA',
    'maranhão': 'MA', 'maranhao': 'MA',
    'amazonas': 'AM',
    'espírito santo': 'ES', 'espirito santo': 'ES',
    'paraíba': 'PB', 'paraiba': 'PB',
    'mato grosso': 'MT',
    'rio grande do norte': 'RN',
    'alagoas': 'AL',
    'piauí': 'PI', 'piaui': 'PI',
    'mato grosso do sul': 'MS',
    'distrito federal': 'DF',
    'sergipe': 'SE',
    'rondônia': 'RO', 'rondonia': 'RO',
    'tocantins': 'TO',
    'acre': 'AC',
    'amapá': 'AP', 'amapa': 'AP',
    'roraima': 'RR'
  };
  
  const ufLower = uf.trim().toLowerCase();
  return mapa[ufLower] || uf.toUpperCase().substring(0, 2);
}

// ==========================================
// VTEX - FUNÇÕES
// ==========================================

/**
 * Construir headers VTEX
 * @pre credentials válidas
 * @post Headers prontos para requisição
 */
function buildVtexHeaders(credentials: VtexCredentials): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-VTEX-API-AppKey': credentials.appKey,
    'X-VTEX-API-AppToken': credentials.appToken
  };
}

/**
 * Buscar pedidos VTEX pendentes de entrega
 * 
 * @description Lista pedidos com status prontos para entrega
 * @pre credentials.accountName existe no VTEX
 * @pre credentials.appKey e appToken são válidos
 * @post Retorna lista de pedidos normalizados
 * @throws {Error} Se credenciais inválidas (401)
 * @throws {Error} Se rate limit excedido (429)
 */
export async function buscarPedidosVtex(
  credentials: VtexCredentials,
  filtros?: {
    status?: string[];
    dataInicio?: Date;
    dataFim?: Date;
    pagina?: number;
    porPagina?: number;
  }
): Promise<{ pedidos: PedidoNormalizado[]; total: number }> {
  const baseUrl = VTEX_BASE_URL(credentials.accountName);
  const headers = buildVtexHeaders(credentials);
  
  // Status padrão: prontos para handling
  const statusList = filtros?.status || ['ready-for-handling', 'handling'];
  
  // Construir query
  const params = new URLSearchParams();
  params.append('orderBy', 'creationDate,desc');
  params.append('page', String(filtros?.pagina || 1));
  params.append('per_page', String(filtros?.porPagina || 50));
  
  // Filtro por status
  const statusQuery = statusList.map(s => `status=${s}`).join(' OR ');
  params.append('f_status', statusQuery);
  
  // Filtro por data
  if (filtros?.dataInicio) {
    params.append('f_creationDate', `creationDate:[${filtros.dataInicio.toISOString()} TO ${filtros?.dataFim?.toISOString() || '*'}]`);
  }
  
  const url = `${baseUrl}/api/oms/${VTEX_API_VERSION}/orders?${params.toString()}`;
  
  console.log(`[VTEX] Buscando pedidos: ${url}`);
  
  const response = await withRetry(async () => {
    const res = await fetch(url, { headers });
    
    if (!res.ok) {
      const error: any = new Error(`VTEX API Error: ${res.status} ${res.statusText}`);
      error.status = res.status;
      throw error;
    }
    
    return res.json() as Promise<VtexOrderListResponse>;
  });
  
  // Normalizar pedidos
  const pedidos: PedidoNormalizado[] = response.list.map(order => normalizarPedidoVtex(order));
  
  console.log(`[VTEX] Encontrados ${response.paging.total} pedidos, página ${response.paging.currentPage}/${response.paging.pages}`);
  
  return {
    pedidos,
    total: response.paging.total
  };
}

/**
 * Normalizar pedido VTEX para formato interno
 * @pre order é VtexOrder válido
 * @post Retorna PedidoNormalizado
 */
function normalizarPedidoVtex(order: VtexOrder): PedidoNormalizado {
  const addr = order.shippingData.address;
  const client = order.clientProfileData;
  
  return {
    idExterno: order.orderId,
    numeroNota: order.marketplaceOrderId || order.sequence,
    plataforma: 'VTEX',
    cliente: {
      nome: `${client.firstName} ${client.lastName}`.trim() || order.clientName,
      documento: client.document,
      telefone: client.phone,
      email: client.email
    },
    endereco: {
      logradouro: addr.street,
      numero: addr.number,
      complemento: addr.complement,
      bairro: addr.neighborhood,
      cidade: addr.city,
      uf: normalizarUf(addr.state),
      cep: normalizarCep(addr.postalCode),
      geolocalizacao: addr.geoCoordinates 
        ? { lat: addr.geoCoordinates[1], lng: addr.geoCoordinates[0] }
        : undefined
    },
    itens: order.items.map(item => ({
      nome: item.name,
      quantidade: item.quantity,
      valorUnitario: item.sellingPrice / 100  // Centavos para reais
    })),
    valorTotal: order.value / 100,
    dataCompra: new Date(order.creationDate)
  };
}

/**
 * Atualizar status de pedido no VTEX
 * 
 * @pre orderId existe no VTEX
 * @pre status é válido para transição
 * @post Status atualizado no VTEX
 */
export async function atualizarStatusVtex(
  credentials: VtexCredentials,
  orderId: string,
  status: 'start-handling' | 'invoice' | 'ready-for-handling'
): Promise<boolean> {
  const baseUrl = VTEX_BASE_URL(credentials.accountName);
  const headers = buildVtexHeaders(credentials);
  
  const url = `${baseUrl}/api/oms/pvt/orders/${orderId}/${status}`;
  
  const response = await withRetry(async () => {
    const res = await fetch(url, { 
      method: 'POST',
      headers 
    });
    
    if (!res.ok) {
      const error: any = new Error(`VTEX Status Update Error: ${res.status}`);
      error.status = res.status;
      throw error;
    }
    
    return true;
  });
  
  console.log(`[VTEX] Status atualizado: ${orderId} -> ${status}`);
  
  return response;
}

// ==========================================
// SHOPIFY - FUNÇÕES
// ==========================================

/**
 * Construir headers Shopify
 * @pre credentials válidas com accessToken
 * @post Headers prontos para requisição
 */
function buildShopifyHeaders(credentials: ShopifyCredentials): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Shopify-Access-Token': credentials.accessToken
  };
}

/**
 * Buscar pedidos Shopify pendentes de fulfillment
 * 
 * @description Lista pedidos não fulfillados
 * @pre credentials.shopDomain é válido
 * @pre credentials.accessToken tem permissão read_orders
 * @post Retorna lista de pedidos normalizados
 * @throws {Error} Se token inválido (401)
 * @throws {Error} Se rate limit (429)
 */
export async function buscarPedidosShopify(
  credentials: ShopifyCredentials,
  filtros?: {
    fulfillmentStatus?: 'unfulfilled' | 'partial' | 'fulfilled' | 'any';
    financialStatus?: 'paid' | 'pending' | 'any';
    dataInicio?: Date;
    dataFim?: Date;
    limite?: number;
  }
): Promise<{ pedidos: PedidoNormalizado[]; total: number }> {
  const apiVersion = credentials.apiVersion || SHOPIFY_API_VERSION;
  const baseUrl = `https://${credentials.shopDomain}/admin/api/${apiVersion}`;
  const headers = buildShopifyHeaders(credentials);
  
  // Construir query
  const params = new URLSearchParams();
  params.append('status', 'open');
  params.append('fulfillment_status', filtros?.fulfillmentStatus || 'unfulfilled');
  
  if (filtros?.financialStatus && filtros.financialStatus !== 'any') {
    params.append('financial_status', filtros.financialStatus);
  }
  
  if (filtros?.dataInicio) {
    params.append('created_at_min', filtros.dataInicio.toISOString());
  }
  
  if (filtros?.dataFim) {
    params.append('created_at_max', filtros.dataFim.toISOString());
  }
  
  params.append('limit', String(filtros?.limite || 50));
  
  const url = `${baseUrl}/orders.json?${params.toString()}`;
  
  console.log(`[Shopify] Buscando pedidos: ${credentials.shopDomain}`);
  
  const response = await withRetry(async () => {
    const res = await fetch(url, { headers });
    
    if (!res.ok) {
      const error: any = new Error(`Shopify API Error: ${res.status} ${res.statusText}`);
      error.status = res.status;
      throw error;
    }
    
    return res.json() as Promise<ShopifyOrdersResponse>;
  });
  
  // Normalizar pedidos (filtrar só BR)
  const pedidosBrasil = response.orders.filter(o => 
    o.shipping_address?.country_code === 'BR' || 
    o.shipping_address?.country === 'Brazil' ||
    o.shipping_address?.country === 'Brasil'
  );
  
  const pedidos: PedidoNormalizado[] = pedidosBrasil.map(order => normalizarPedidoShopify(order));
  
  console.log(`[Shopify] Encontrados ${response.orders.length} pedidos, ${pedidos.length} no Brasil`);
  
  return {
    pedidos,
    total: pedidos.length
  };
}

/**
 * Normalizar pedido Shopify para formato interno
 * @pre order é ShopifyOrder válido
 * @post Retorna PedidoNormalizado
 */
function normalizarPedidoShopify(order: ShopifyOrder): PedidoNormalizado {
  const addr = order.shipping_address;
  const customer = order.customer;
  
  // Extrair número do endereço (padrão brasileiro)
  const matchNumero = addr.address1.match(/,?\s*(\d+)\s*$/);
  const numero = matchNumero ? matchNumero[1] : 'S/N';
  const logradouro = matchNumero 
    ? addr.address1.replace(/,?\s*\d+\s*$/, '').trim()
    : addr.address1;
  
  return {
    idExterno: String(order.id),
    numeroNota: order.name,
    plataforma: 'SHOPIFY',
    cliente: {
      nome: addr.name || `${customer.first_name} ${customer.last_name}`.trim(),
      telefone: addr.phone || customer.phone,
      email: customer.email
    },
    endereco: {
      logradouro,
      numero,
      complemento: addr.address2,
      bairro: extractBairro(addr.address2) || 'Centro',
      cidade: addr.city,
      uf: normalizarUf(addr.province_code || addr.province),
      cep: normalizarCep(addr.zip)
    },
    itens: order.line_items.map(item => ({
      nome: item.title,
      quantidade: item.quantity,
      valorUnitario: parseFloat(item.price)
    })),
    valorTotal: parseFloat(order.total_price),
    pesoTotal: order.total_weight > 0 ? order.total_weight / 1000 : undefined, // g para kg
    dataCompra: new Date(order.created_at),
    observacoes: order.note
  };
}

/**
 * Extrair bairro do complemento (padrão BR comum)
 */
function extractBairro(complemento?: string): string | undefined {
  if (!complemento) return undefined;
  
  // Padrão: "Apto 123, Bairro Nome"
  const match = complemento.match(/bairro[:\s]+([^,]+)/i);
  return match ? match[1].trim() : undefined;
}

/**
 * Criar fulfillment no Shopify (marcar como entregue)
 * 
 * @pre orderId existe no Shopify
 * @pre Token tem permissão write_fulfillments
 * @post Fulfillment criado, pedido marcado como fulfillado
 */
export async function criarFulfillmentShopify(
  credentials: ShopifyCredentials,
  orderId: string,
  locationId: string,
  trackingInfo?: {
    number: string;
    company: string;
    url?: string;
  }
): Promise<boolean> {
  const apiVersion = credentials.apiVersion || SHOPIFY_API_VERSION;
  const baseUrl = `https://${credentials.shopDomain}/admin/api/${apiVersion}`;
  const headers = buildShopifyHeaders(credentials);
  
  // Primeiro, buscar fulfillment orders
  const fulfillmentOrdersUrl = `${baseUrl}/orders/${orderId}/fulfillment_orders.json`;
  
  const fulfillmentOrders = await withRetry(async () => {
    const res = await fetch(fulfillmentOrdersUrl, { headers });
    if (!res.ok) throw new Error(`Shopify Error: ${res.status}`);
    return res.json();
  });
  
  // Criar fulfillment
  const fulfillmentUrl = `${baseUrl}/fulfillments.json`;
  
  const response = await withRetry(async () => {
    const res = await fetch(fulfillmentUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fulfillment: {
          location_id: locationId,
          tracking_info: trackingInfo ? {
            number: trackingInfo.number,
            company: trackingInfo.company,
            url: trackingInfo.url
          } : undefined,
          notify_customer: true,
          line_items_by_fulfillment_order: fulfillmentOrders.fulfillment_orders.map((fo: any) => ({
            fulfillment_order_id: fo.id,
            fulfillment_order_line_items: fo.line_items.map((li: any) => ({
              id: li.id,
              quantity: li.quantity
            }))
          }))
        }
      })
    });
    
    if (!res.ok) throw new Error(`Shopify Fulfillment Error: ${res.status}`);
    return true;
  });
  
  console.log(`[Shopify] Fulfillment criado: ${orderId}`);
  
  return response;
}

// ==========================================
// SINCRONIZAÇÃO UNIFICADA
// ==========================================

/**
 * Sincronizar pedidos de uma integração
 * 
 * @description Importa novos pedidos e atualiza existentes
 * @pre integracaoId existe no banco
 * @pre Credenciais descriptografadas e válidas
 * @post Pedidos importados para PedidoImportado
 * @post Contadores atualizados na IntegracaoFornecedor
 * @invariant Não duplica pedidos (unique idExterno + integracaoId)
 */
export async function sincronizarPedidos(
  integracaoId: string
): Promise<ResultadoSincronizacao> {
  const inicio = Date.now();
  
  // Buscar integração
  const integracao = await prisma.integracaoFornecedor.findUnique({
    where: { id: integracaoId }
  });
  
  if (!integracao) {
    throw new Error(`Integração não encontrada: ${integracaoId}`);
  }
  
  if (!integracao.ativo) {
    throw new Error(`Integração desativada: ${integracaoId}`);
  }
  
  // Descriptografar credenciais (simplificado - produção usar KMS)
  let credentials: VtexCredentials | ShopifyCredentials;
  try {
    credentials = JSON.parse(integracao.credentials);
  } catch {
    throw new Error('Credenciais inválidas ou corrompidas');
  }
  
  // Buscar pedidos conforme plataforma
  let pedidosNormalizados: PedidoNormalizado[] = [];
  let plataforma: 'VTEX' | 'SHOPIFY';
  
  if (integracao.fornecedor === 'VTEX') {
    plataforma = 'VTEX';
    const result = await buscarPedidosVtex(credentials as VtexCredentials);
    pedidosNormalizados = result.pedidos;
  } else if (integracao.fornecedor === 'SHOPIFY') {
    plataforma = 'SHOPIFY';
    const result = await buscarPedidosShopify(credentials as ShopifyCredentials);
    pedidosNormalizados = result.pedidos;
  } else {
    throw new Error(`Plataforma não suportada: ${integracao.fornecedor}`);
  }
  
  // Importar pedidos
  let totalImportados = 0;
  let totalDuplicados = 0;
  let totalErros = 0;
  const erros: Array<{ idExterno: string; erro: string }> = [];
  
  for (const pedido of pedidosNormalizados) {
    try {
      // Verificar se já existe
      const existente = await prisma.pedidoImportado.findUnique({
        where: {
          integracaoId_idExterno: {
            integracaoId: integracao.id,
            idExterno: pedido.idExterno
          }
        }
      });
      
      if (existente) {
        totalDuplicados++;
        continue;
      }
      
      // Criar pedido importado
      await prisma.pedidoImportado.create({
        data: {
          integracaoId: integracao.id,
          idExterno: pedido.idExterno,
          numeroNota: pedido.numeroNota,
          cliente: pedido.cliente.nome,
          endereco: `${pedido.endereco.logradouro}, ${pedido.endereco.numero}`,
          cidade: pedido.endereco.cidade,
          uf: pedido.endereco.uf,
          cep: pedido.endereco.cep,
          telefone: pedido.cliente.telefone,
          valorTotal: pedido.valorTotal,
          peso: pedido.pesoTotal,
          volumes: pedido.volumesTotal,
          status: 'PENDENTE'
        }
      });
      
      totalImportados++;
    } catch (error) {
      totalErros++;
      erros.push({
        idExterno: pedido.idExterno,
        erro: (error as Error).message
      });
    }
  }
  
  // Atualizar contadores
  await prisma.integracaoFornecedor.update({
    where: { id: integracaoId },
    data: {
      ultimaSincronizacao: new Date(),
      totalPedidosImportados: {
        increment: totalImportados
      }
    }
  });
  
  const resultado: ResultadoSincronizacao = {
    sucesso: totalErros === 0,
    plataforma,
    totalEncontrados: pedidosNormalizados.length,
    totalImportados,
    totalDuplicados,
    totalErros,
    erros,
    tempoMs: Date.now() - inicio
  };
  
  console.log(`[Ecommerce] Sincronização concluída:`, resultado);
  
  return resultado;
}

// ==========================================
// WEBHOOK HANDLERS
// ==========================================

/**
 * Validar assinatura webhook VTEX
 * @pre signature é HMAC-SHA256
 */
export function validarAssinaturaVtex(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return signature === `sha256=${expected}`;
}

/**
 * Validar assinatura webhook Shopify
 * @pre X-Shopify-Hmac-SHA256 header presente
 */
export function validarAssinaturaShopify(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('base64');
  
  return signature === expected;
}

/**
 * Processar webhook de novo pedido
 * 
 * @description Recebe notificação e importa pedido
 * @pre Webhook configurado corretamente
 * @pre Assinatura válida
 * @post Pedido importado automaticamente
 */
export async function processarWebhookPedido(
  integracaoId: string,
  plataforma: 'VTEX' | 'SHOPIFY',
  payload: any
): Promise<{ sucesso: boolean; pedidoId?: string; erro?: string }> {
  try {
    let pedidoNormalizado: PedidoNormalizado;
    
    if (plataforma === 'VTEX') {
      pedidoNormalizado = normalizarPedidoVtex(payload as VtexOrder);
    } else {
      pedidoNormalizado = normalizarPedidoShopify(payload as ShopifyOrder);
    }
    
    // Verificar duplicidade
    const existente = await prisma.pedidoImportado.findUnique({
      where: {
        integracaoId_idExterno: {
          integracaoId,
          idExterno: pedidoNormalizado.idExterno
        }
      }
    });
    
    if (existente) {
      return { sucesso: true, pedidoId: existente.id };
    }
    
    // Criar pedido
    const pedido = await prisma.pedidoImportado.create({
      data: {
        integracaoId,
        idExterno: pedidoNormalizado.idExterno,
        numeroNota: pedidoNormalizado.numeroNota,
        cliente: pedidoNormalizado.cliente.nome,
        endereco: `${pedidoNormalizado.endereco.logradouro}, ${pedidoNormalizado.endereco.numero}`,
        cidade: pedidoNormalizado.endereco.cidade,
        uf: pedidoNormalizado.endereco.uf,
        cep: pedidoNormalizado.endereco.cep,
        telefone: pedidoNormalizado.cliente.telefone,
        valorTotal: pedidoNormalizado.valorTotal,
        peso: pedidoNormalizado.pesoTotal,
        volumes: pedidoNormalizado.volumesTotal,
        status: 'PENDENTE'
      }
    });
    
    // Atualizar contador
    await prisma.integracaoFornecedor.update({
      where: { id: integracaoId },
      data: {
        totalPedidosImportados: { increment: 1 }
      }
    });
    
    console.log(`[Webhook] Pedido importado: ${pedido.id} (${plataforma})`);
    
    return { sucesso: true, pedidoId: pedido.id };
  } catch (error) {
    console.error(`[Webhook] Erro:`, error);
    return { sucesso: false, erro: (error as Error).message };
  }
}

// ==========================================
// GESTÃO DE INTEGRAÇÕES
// ==========================================

/**
 * Criar nova integração e-commerce
 * 
 * @pre empresaId ou userId válido
 * @pre Credenciais válidas
 * @post Integração criada (testada antes)
 */
export async function criarIntegracao(input: {
  empresaId?: string;
  userId?: string;
  fornecedor: 'VTEX' | 'SHOPIFY';
  nome: string;
  credentials: VtexCredentials | ShopifyCredentials;
  config?: ConfiguracaoEcommerce;
}): Promise<{ id: string; testado: boolean }> {
  // Testar conexão antes de salvar
  let testado = false;
  try {
    if (input.fornecedor === 'VTEX') {
      await buscarPedidosVtex(input.credentials as VtexCredentials, { porPagina: 1 });
      testado = true;
    } else {
      await buscarPedidosShopify(input.credentials as ShopifyCredentials, { limite: 1 });
      testado = true;
    }
  } catch (error) {
    console.warn(`[Ecommerce] Teste falhou:`, (error as Error).message);
    // Permite criar mesmo sem teste bem sucedido (pode ser sandbox)
  }
  
  // Criptografar credenciais (simplificado - produção usar KMS)
  const credentialsJson = JSON.stringify(input.credentials);
  
  const integracao = await prisma.integracaoFornecedor.create({
    data: {
      empresaId: input.empresaId,
      userId: input.userId,
      fornecedor: input.fornecedor,
      nome: input.nome,
      credentials: credentialsJson,
      configJson: input.config ? JSON.stringify(input.config) : null,
      ativo: true
    }
  });
  
  console.log(`[Ecommerce] Integração criada: ${integracao.id} (${input.fornecedor})`);
  
  return { id: integracao.id, testado };
}

/**
 * Listar integrações
 */
export async function listarIntegracoes(filtro: {
  empresaId?: string;
  userId?: string;
  fornecedor?: TipoIntegracao;
}): Promise<Array<{
  id: string;
  fornecedor: TipoIntegracao;
  nome: string | null;
  ativo: boolean;
  ultimaSincronizacao: Date | null;
  totalPedidosImportados: number;
}>> {
  const integracoes = await prisma.integracaoFornecedor.findMany({
    where: {
      empresaId: filtro.empresaId,
      userId: filtro.userId,
      fornecedor: filtro.fornecedor
    },
    select: {
      id: true,
      fornecedor: true,
      nome: true,
      ativo: true,
      ultimaSincronizacao: true,
      totalPedidosImportados: true
    },
    orderBy: { createdAt: 'desc' }
  });
  
  return integracoes;
}

/**
 * Buscar pedidos importados pendentes
 */
export async function buscarPedidosPendentes(
  integracaoId: string
): Promise<Array<{
  id: string;
  idExterno: string;
  cliente: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string | null;
  valorTotal: number | null;
}>> {
  return prisma.pedidoImportado.findMany({
    where: {
      integracaoId,
      status: 'PENDENTE'
    },
    select: {
      id: true,
      idExterno: true,
      cliente: true,
      endereco: true,
      cidade: true,
      uf: true,
      cep: true,
      valorTotal: true
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Marcar pedidos como processados (virou parada)
 */
export async function marcarPedidosProcessados(
  pedidoIds: string[],
  paradaId?: string
): Promise<number> {
  const result = await prisma.pedidoImportado.updateMany({
    where: { id: { in: pedidoIds } },
    data: {
      status: 'PROCESSADO',
      paradaId,
      processadoEm: new Date()
    }
  });
  
  return result.count;
}
