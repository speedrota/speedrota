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
import { otimizarRotaCompleta, haversineCorrigido } from '../services/otimizacao.js';

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
});

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
        _count: {
          select: { paradas: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    
    return {
      success: true,
      data: rotas,
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
    
    return {
      success: true,
      data: rota,
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
   * Calcular rota otimizada usando OSRM + 2-opt
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
    
    // Preparar dados para otimização
    const origem = { id: 'origem', lat: rota.origemLat, lng: rota.origemLng };
    const paradasParaOtimizar = rota.paradas.map(p => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
    }));
    
    // Otimizar usando OSRM + Nearest Neighbor + 2-opt
    const resultado = await otimizarRotaCompleta(origem, paradasParaOtimizar, rota.incluirRetorno);
    
    // Atualizar paradas com ordem e distâncias
    for (const item of resultado.paradas) {
      await prisma.parada.update({
        where: { id: item.id },
        data: {
          ordem: item.ordem,
          distanciaAnterior: item.distanciaAnterior,
          tempoAnterior: item.tempoAnterior,
        },
      });
    }
    
    // Calcular métricas
    const tempoEntregas = rota.paradas.length * CONSTANTES.TEMPO_POR_ENTREGA_MIN;
    const combustivel = resultado.distanciaTotal / CONSTANTES.CONSUMO_MEDIO_KML;
    const custo = combustivel * CONSTANTES.PRECO_COMBUSTIVEL;
    
    // Atualizar rota
    const rotaAtualizada = await prisma.rota.update({
      where: { id },
      data: {
        distanciaTotalKm: resultado.distanciaTotal,
        tempoViagemMin: resultado.tempoTotal,
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
      otimizacao: {
        algoritmo: resultado.algoritmo,
        melhoriaPercentual: resultado.melhoriaPercentual,
      },
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
