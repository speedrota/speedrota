/**
 * @fileoverview Rotas de Rotas (CRUD + Otimização)
 * 
 * DESIGN POR CONTRATO:
 * @pre Usuário autenticado
 * @pre Respeitar limites do plano
 * @post Rota criada/calculada
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { LIMITES_PLANOS, CONSTANTES } from '../config/env.js';

// ==========================================
// SCHEMAS
// ==========================================

const createRotaSchema = z.object({
  origem: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    endereco: z.string().min(1),
    fonte: z.enum(['gps', 'manual']),
  }),
  incluirRetorno: z.boolean().default(true),
});

const addParadaSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  endereco: z.string().min(1),
  cidade: z.string().min(1),
  uf: z.string().length(2),
  cep: z.string().optional(),
  nome: z.string().min(1),
  telefone: z.string().optional(),
  fornecedor: z.string().default('outro'),
  fonte: z.enum(['ocr', 'manual', 'pdf']).default('manual'),
  confianca: z.number().min(0).max(1).default(1),
  // Novos campos - Janela de tempo e prioridade
  janelaInicio: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(), // "08:00"
  janelaFim: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),    // "12:00"
  prioridade: z.enum(['ALTA', 'MEDIA', 'BAIXA']).default('MEDIA'),
});

// ==========================================
// FUNÇÕES DE CÁLCULO
// ==========================================

/**
 * Haversine com correção urbana
 */
function haversineCorrigido(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c * CONSTANTES.FATOR_CORRECAO_URBANA;
}

/**
 * Converte horário "HH:MM" para minutos desde meia-noite
 * @pre horario no formato "HH:MM"
 * @post retorna minutos (0-1439)
 */
function horarioParaMinutos(horario: string | null | undefined): number {
  if (!horario) return 1440; // Sem janela = final do dia
  const [h, m] = horario.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Ordena paradas por prioridade e janela de tempo
 * @pre paradas com campos prioridade e janelaFim opcionais
 * @post paradas ordenadas: ALTA primeiro, depois por janelaFim mais cedo
 */
function ordenarPorPrioridadeEJanela<T extends { 
  id: string; 
  prioridade?: string | null;
  janelaFim?: string | null;
}>(paradas: T[]): T[] {
  const pesosPrioridade: Record<string, number> = {
    'ALTA': 0,
    'MEDIA': 1,
    'BAIXA': 2,
  };
  
  return [...paradas].sort((a, b) => {
    // Primeiro por prioridade
    const prioA = pesosPrioridade[a.prioridade || 'MEDIA'] ?? 1;
    const prioB = pesosPrioridade[b.prioridade || 'MEDIA'] ?? 1;
    if (prioA !== prioB) return prioA - prioB;
    
    // Depois por janela de tempo (mais cedo primeiro)
    const janelaA = horarioParaMinutos(a.janelaFim);
    const janelaB = horarioParaMinutos(b.janelaFim);
    return janelaA - janelaB;
  });
}

/**
 * Algoritmo Nearest Neighbor para TSP
 */
function nearestNeighbor(
  origem: { lat: number; lng: number },
  paradas: Array<{ id: string; lat: number; lng: number }>,
  incluirRetorno: boolean
): Array<{ id: string; ordem: number; distanciaAnterior: number }> {
  if (paradas.length === 0) return [];
  
  const resultado: Array<{ id: string; ordem: number; distanciaAnterior: number }> = [];
  const visitados = new Set<string>();
  let atual = origem;
  let ordem = 1;
  
  while (visitados.size < paradas.length) {
    let menorDist = Infinity;
    let proxima: typeof paradas[0] | null = null;
    
    for (const parada of paradas) {
      if (visitados.has(parada.id)) continue;
      
      const dist = haversineCorrigido(atual.lat, atual.lng, parada.lat, parada.lng);
      if (dist < menorDist) {
        menorDist = dist;
        proxima = parada;
      }
    }
    
    if (proxima) {
      visitados.add(proxima.id);
      resultado.push({
        id: proxima.id,
        ordem,
        distanciaAnterior: menorDist,
      });
      atual = proxima;
      ordem++;
    }
  }
  
  return resultado;
}

// ==========================================
// ROTAS
// ==========================================

export async function rotaRoutes(app: FastifyInstance) {
  
  // Todas as rotas requerem autenticação
  app.addHook('onRequest', authenticate);

  /**
   * GET /rotas
   * Listar rotas do usuário
   */
  app.get('/', async (request) => {
    const { userId, plano } = request.user;
    const limites = LIMITES_PLANOS[plano as keyof typeof LIMITES_PLANOS];
    
    // Calcular data limite do histórico
    const dataLimite = limites.historicosDias === Infinity
      ? new Date(0)
      : new Date(Date.now() - limites.historicosDias * 24 * 60 * 60 * 1000);
    
    const rotas = await prisma.rota.findMany({
      where: {
        userId,
        createdAt: { gte: dataLimite },
      },
      include: {
        paradas: {
          orderBy: { ordem: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    
    // Transformar para formato esperado pelo frontend/mobile
    const rotasFormatadas = rotas.map(rota => ({
      id: rota.id,
      nome: `Rota de ${new Date(rota.createdAt).toLocaleDateString('pt-BR')}`,
      criadoEm: rota.createdAt.toISOString(),
      fornecedor: rota.paradas[0]?.fornecedor || null,
      totalParadas: rota.paradas.length,
      distanciaTotal: rota.distanciaTotalKm ? rota.distanciaTotalKm * 1000 : null, // km para metros
      tempoEstimado: rota.tempoViagemMin ? Math.round(rota.tempoViagemMin * 60) : null, // min para segundos
      origemEndereco: rota.origemEndereco,
      origemLat: rota.origemLat,
      origemLng: rota.origemLng,
      paradas: rota.paradas.map(p => ({
        id: p.id,
        rotaId: p.rotaId,
        endereco: p.endereco,
        lat: p.lat,
        lng: p.lng,
        ordem: p.ordem ?? 0,
        status: p.statusEntrega,
        fornecedor: p.fornecedor,
        nomeDestinatario: p.nome,
        telefone: p.telefone,
        // Novos campos - janela de tempo e prioridade
        janelaInicio: p.janelaInicio,
        janelaFim: p.janelaFim,
        prioridade: p.prioridade,
        createdAt: p.createdAt?.toISOString(),
      })),
    }));
    
    // Retornar no formato esperado pelo frontend
    return {
      rotas: rotasFormatadas,
      total: rotas.length,
      pagina: 1,
      porPagina: 50,
      totalPaginas: 1,
    };
  });

  /**
   * GET /rotas/:id
   * Detalhes de uma rota
   */
  app.get('/:id', async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params as { id: string };
    
    const rota = await prisma.rota.findFirst({
      where: { id, userId },
      include: {
        paradas: {
          orderBy: { ordem: 'asc' },
        },
      },
    });
    
    if (!rota) {
      return reply.status(404).send({
        success: false,
        error: 'Rota não encontrada',
      });
    }
    
    // Transformar para formato esperado pelo mobile
    const rotaFormatada = {
      id: rota.id,
      nome: `Rota de ${new Date(rota.createdAt).toLocaleDateString('pt-BR')}`,
      criadoEm: rota.createdAt.toISOString(),
      fornecedor: rota.paradas[0]?.fornecedor || null,
      totalParadas: rota.paradas.length,
      distanciaTotal: rota.distanciaTotalKm ? rota.distanciaTotalKm * 1000 : null,
      tempoEstimado: rota.tempoViagemMin ? Math.round(rota.tempoViagemMin * 60) : null,
      origemEndereco: rota.origemEndereco,
      origemLat: rota.origemLat,
      origemLng: rota.origemLng,
      paradas: rota.paradas.map(p => ({
        id: p.id,
        rotaId: p.rotaId,
        endereco: p.endereco,
        lat: p.lat,
        lng: p.lng,
        ordem: p.ordem ?? 0,
        status: p.statusEntrega,
        fornecedor: p.fornecedor,
        nomeDestinatario: p.nome,
        telefone: p.telefone,
        // Novos campos - janela de tempo e prioridade
        janelaInicio: p.janelaInicio,
        janelaFim: p.janelaFim,
        prioridade: p.prioridade,
        createdAt: p.createdAt?.toISOString(),
      })),
    };
    
    return {
      success: true,
      data: rotaFormatada,
    };
  });

  /**
   * POST /rotas
   * Criar nova rota
   */
  app.post('/', async (request, reply) => {
    const { userId, plano } = request.user;
    
    const body = createRotaSchema.safeParse(request.body);
    
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: 'Dados inválidos',
        details: body.error.flatten().fieldErrors,
      });
    }
    
    // Verificar limite de rotas do plano
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    const limites = LIMITES_PLANOS[plano as keyof typeof LIMITES_PLANOS];
    
    if (user!.rotasNoMes >= limites.rotasPorMes) {
      return reply.status(403).send({
        success: false,
        error: 'Limite de rotas do mês atingido',
        limiteAtual: limites.rotasPorMes,
        rotasUsadas: user!.rotasNoMes,
        upgrade: 'Faça upgrade para o plano PRO ou FULL',
      });
    }
    
    const { origem, incluirRetorno } = body.data;
    
    // Criar rota
    const rota = await prisma.rota.create({
      data: {
        userId,
        origemLat: origem.lat,
        origemLng: origem.lng,
        origemEndereco: origem.endereco,
        origemFonte: origem.fonte,
        incluirRetorno,
        status: 'RASCUNHO',
      },
    });
    
    // Incrementar contador de rotas
    await prisma.user.update({
      where: { id: userId },
      data: { rotasNoMes: { increment: 1 } },
    });
    
    return reply.status(201).send({
      success: true,
      data: rota,
    });
  });

  /**
   * POST /rotas/:id/paradas
   * Adicionar parada à rota
   */
  app.post('/:id/paradas', async (request, reply) => {
    const { userId, plano } = request.user;
    const { id } = request.params as { id: string };
    
    const body = addParadaSchema.safeParse(request.body);
    
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: 'Dados inválidos',
        details: body.error.flatten().fieldErrors,
      });
    }
    
    // Verificar se rota existe e pertence ao usuário
    const rota = await prisma.rota.findFirst({
      where: { id, userId },
      include: {
        _count: { select: { paradas: true } },
      },
    });
    
    if (!rota) {
      return reply.status(404).send({
        success: false,
        error: 'Rota não encontrada',
      });
    }
    
    // Verificar limite de paradas
    const limites = LIMITES_PLANOS[plano as keyof typeof LIMITES_PLANOS];
    
    if (rota._count.paradas >= limites.paradasPorRota) {
      return reply.status(403).send({
        success: false,
        error: 'Limite de paradas por rota atingido',
        limiteAtual: limites.paradasPorRota,
        paradasAtuais: rota._count.paradas,
      });
    }
    
    // Criar parada
    const parada = await prisma.parada.create({
      data: {
        rotaId: id,
        ...body.data,
      },
    });
    
    return reply.status(201).send({
      success: true,
      data: parada,
    });
  });

  /**
   * POST /rotas/:id/paradas/batch
   * Adicionar múltiplas paradas (OCR)
   */
  app.post('/:id/paradas/batch', async (request, reply) => {
    const { userId, plano } = request.user;
    const { id } = request.params as { id: string };
    
    const schema = z.object({
      paradas: z.array(addParadaSchema),
    });
    
    const body = schema.safeParse(request.body);
    
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: 'Dados inválidos',
        details: body.error.flatten().fieldErrors,
      });
    }
    
    // Verificar rota
    const rota = await prisma.rota.findFirst({
      where: { id, userId },
      include: {
        _count: { select: { paradas: true } },
      },
    });
    
    if (!rota) {
      return reply.status(404).send({
        success: false,
        error: 'Rota não encontrada',
      });
    }
    
    // Verificar limite
    const limites = LIMITES_PLANOS[plano as keyof typeof LIMITES_PLANOS];
    const totalAposAdicao = rota._count.paradas + body.data.paradas.length;
    
    if (totalAposAdicao > limites.paradasPorRota) {
      return reply.status(403).send({
        success: false,
        error: 'Limite de paradas seria excedido',
        limiteAtual: limites.paradasPorRota,
        paradasAtuais: rota._count.paradas,
        tentandoAdicionar: body.data.paradas.length,
      });
    }
    
    // Criar paradas em batch
    const paradas = await prisma.parada.createMany({
      data: body.data.paradas.map(p => ({
        rotaId: id,
        ...p,
      })),
    });
    
    return reply.status(201).send({
      success: true,
      data: {
        count: paradas.count,
      },
    });
  });

  /**
   * POST /rotas/:id/calcular
   * Calcular rota otimizada
   */
  app.post('/:id/calcular', async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params as { id: string };
    
    // Buscar rota com paradas
    const rota = await prisma.rota.findFirst({
      where: { id, userId },
      include: {
        paradas: true,
      },
    });
    
    if (!rota) {
      return reply.status(404).send({
        success: false,
        error: 'Rota não encontrada',
      });
    }
    
    if (rota.paradas.length === 0) {
      return reply.status(400).send({
        success: false,
        error: 'Rota não tem paradas',
      });
    }
    
    // Calcular ordem otimizada
    const origem = { lat: rota.origemLat, lng: rota.origemLng };
    
    // NOVO: Pré-ordenar por prioridade e janela de tempo
    const paradasOrdenadas = ordenarPorPrioridadeEJanela(rota.paradas);
    
    // Separar paradas de alta prioridade (devem ser visitadas primeiro)
    const paradasAlta = paradasOrdenadas.filter(p => p.prioridade === 'ALTA');
    const paradasOutras = paradasOrdenadas.filter(p => p.prioridade !== 'ALTA');
    
    // Otimizar paradas de alta prioridade primeiro, depois as outras
    const paradasParaOtimizar = [...paradasAlta, ...paradasOutras].map(p => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      prioridade: p.prioridade,
      janelaFim: p.janelaFim,
    }));
    
    const ordemOtimizada = nearestNeighbor(origem, paradasParaOtimizar, rota.incluirRetorno);
    
    // Atualizar paradas com ordem e distâncias
    let distanciaTotal = 0;
    let tempoTotal = 0;
    
    for (const item of ordemOtimizada) {
      distanciaTotal += item.distanciaAnterior;
      const tempoAnterior = (item.distanciaAnterior / CONSTANTES.VELOCIDADE_URBANA_KMH) * 60;
      tempoTotal += tempoAnterior;
      
      await prisma.parada.update({
        where: { id: item.id },
        data: {
          ordem: item.ordem,
          distanciaAnterior: item.distanciaAnterior,
          tempoAnterior,
        },
      });
    }
    
    // Adicionar retorno à origem se necessário
    if (rota.incluirRetorno && ordemOtimizada.length > 0) {
      const ultimaParada = rota.paradas.find(p => p.id === ordemOtimizada[ordemOtimizada.length - 1].id);
      if (ultimaParada) {
        const distRetorno = haversineCorrigido(ultimaParada.lat, ultimaParada.lng, origem.lat, origem.lng);
        distanciaTotal += distRetorno;
        tempoTotal += (distRetorno / CONSTANTES.VELOCIDADE_URBANA_KMH) * 60;
      }
    }
    
    // Calcular métricas
    const tempoEntregas = rota.paradas.length * CONSTANTES.TEMPO_POR_ENTREGA_MIN;
    const combustivel = distanciaTotal / CONSTANTES.CONSUMO_MEDIO_KML;
    const custo = combustivel * CONSTANTES.PRECO_COMBUSTIVEL;
    
    // Atualizar rota
    const rotaAtualizada = await prisma.rota.update({
      where: { id },
      data: {
        distanciaTotalKm: distanciaTotal,
        tempoViagemMin: tempoTotal,
        tempoEntregasMin: tempoEntregas,
        combustivelL: combustivel,
        custoR: custo,
        status: 'CALCULADA',
        calculadaEm: new Date(),
      },
      include: {
        paradas: {
          orderBy: { ordem: 'asc' },
        },
      },
    });
    
    return {
      success: true,
      data: rotaAtualizada,
    };
  });

  /**
   * PATCH /rotas/:id/status
   * Atualizar status da rota
   */
  app.patch('/:id/status', async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params as { id: string };
    
    const schema = z.object({
      status: z.enum(['RASCUNHO', 'CALCULADA', 'EM_ANDAMENTO', 'FINALIZADA', 'CANCELADA']),
    });
    
    const body = schema.safeParse(request.body);
    
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: 'Status inválido',
      });
    }
    
    const updateData: Record<string, unknown> = {
      status: body.data.status,
    };
    
    if (body.data.status === 'EM_ANDAMENTO') {
      updateData.iniciadaEm = new Date();
    } else if (body.data.status === 'FINALIZADA') {
      updateData.finalizadaEm = new Date();
    }
    
    const rota = await prisma.rota.updateMany({
      where: { id, userId },
      data: updateData,
    });
    
    if (rota.count === 0) {
      return reply.status(404).send({
        success: false,
        error: 'Rota não encontrada',
      });
    }
    
    return {
      success: true,
      message: `Status atualizado para ${body.data.status}`,
    };
  });

  /**
   * DELETE /rotas/:id
   * Deletar rota
   */
  app.delete('/:id', async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params as { id: string };
    
    const rota = await prisma.rota.deleteMany({
      where: { id, userId },
    });
    
    if (rota.count === 0) {
      return reply.status(404).send({
        success: false,
        error: 'Rota não encontrada',
      });
    }
    
    return {
      success: true,
      message: 'Rota deletada',
    };
  });

  /**
   * DELETE /rotas/:id/paradas/:paradaId
   * Remover parada da rota
   */
  app.delete('/:id/paradas/:paradaId', async (request, reply) => {
    const { userId } = request.user;
    const { id, paradaId } = request.params as { id: string; paradaId: string };
    
    // Verificar se rota pertence ao usuário
    const rota = await prisma.rota.findFirst({
      where: { id, userId },
    });
    
    if (!rota) {
      return reply.status(404).send({
        success: false,
        error: 'Rota não encontrada',
      });
    }
    
    await prisma.parada.delete({
      where: { id: paradaId },
    });
    
    return {
      success: true,
      message: 'Parada removida',
    };
  });
}
