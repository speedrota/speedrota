/**
 * @file pod.routes.ts
 * @description Rotas da API para POD (Proof of Delivery)
 * 
 * Design por Contrato:
 * @pre Todas as rotas requerem autenticação
 * @pre Plano do usuário deve permitir POD (FULL, FROTA, ENTERPRISE)
 * @post POD registrado atualiza status da parada para ENTREGUE
 * 
 * @invariant 1 Parada pode ter no máximo 1 POD
 * @invariant PODs não podem ser deletados, apenas invalidados
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middlewares/auth.middleware';
import { 
  validarPODRequest, 
  calcularDistanciaEntrega, 
  verificarDistanciaSuspeita,
  verificarPlanoPermitePOD,
  POD_CONSTANTS,
  type TipoPOD,
  type RegistrarPODRequest 
} from '../utils/pod.utils';

// ==========================================
// SCHEMAS DE VALIDAÇÃO
// ==========================================

const registrarPODSchema = {
  body: {
    type: 'object',
    required: ['paradaId', 'tipo', 'latitude', 'longitude'],
    properties: {
      paradaId: { type: 'string', minLength: 1 },
      tipo: { type: 'string', enum: ['FOTO', 'ASSINATURA', 'CODIGO'] },
      fotoBase64: { type: 'string' },
      assinaturaBase64: { type: 'string' },
      codigo: { type: 'string', minLength: 4, maxLength: 20 },
      latitude: { type: 'number', minimum: -90, maximum: 90 },
      longitude: { type: 'number', minimum: -180, maximum: 180 },
      precisaoGps: { type: 'number', minimum: 0 },
      observacao: { type: 'string', maxLength: 500 },
    },
  },
};

const getPODSchema = {
  params: {
    type: 'object',
    required: ['paradaId'],
    properties: {
      paradaId: { type: 'string', minLength: 1 },
    },
  },
};

// ==========================================
// TIPOS
// ==========================================

interface RegistrarPODBody extends RegistrarPODRequest {}

interface GetPODParams {
  paradaId: string;
}

// ==========================================
// ROTAS
// ==========================================

export async function podRoutes(app: FastifyInstance) {
  
  // Todas as rotas requerem autenticação
  app.addHook('onRequest', authenticate);

  /**
   * POST /pod
   * Registrar comprovante de entrega
   * 
   * @pre paradaId existe e pertence ao usuário
   * @pre parada.statusEntrega !== 'ENTREGUE'
   * @pre plano permite POD
   * @post POD criado, parada.statusEntrega = 'ENTREGUE'
   */
  app.post<{ Body: RegistrarPODBody }>('/', {
    schema: registrarPODSchema,
  }, async (request, reply) => {
    const { userId, plano } = request.user;
    const body = request.body;

    // 1. Verificar se plano permite POD
    if (!verificarPlanoPermitePOD(plano)) {
      return reply.status(403).send({
        error: {
          code: 'PLANO_NAO_PERMITE',
          message: 'Seu plano não inclui comprovante de entrega. Faça upgrade para FULL.',
        },
      });
    }

    // 2. Validar request com função utilitária
    const validacao = validarPODRequest(body);
    if (!validacao.valido) {
      return reply.status(400).send({
        error: {
          code: 'DADOS_INVALIDOS',
          message: 'Dados inválidos para registro de POD',
          detalhes: validacao.erros,
        },
      });
    }

    // 3. Buscar parada e verificar propriedade
    const parada = await prisma.parada.findFirst({
      where: {
        id: body.paradaId,
        rota: {
          userId,
        },
      },
      include: {
        pod: true,
        rota: true,
      },
    });

    if (!parada) {
      return reply.status(404).send({
        error: {
          code: 'PARADA_NAO_ENCONTRADA',
          message: 'Parada não encontrada ou não pertence ao usuário',
        },
      });
    }

    // 4. Verificar se já existe POD
    if (parada.pod) {
      return reply.status(409).send({
        error: {
          code: 'PARADA_JA_ENTREGUE',
          message: 'Esta parada já possui um comprovante de entrega',
          podExistente: {
            id: parada.pod.id,
            tipo: parada.pod.tipo,
            timestamp: parada.pod.timestamp,
          },
        },
      });
    }

    // 5. Calcular distância e verificar se é suspeita
    const distanciaMetros = calcularDistanciaEntrega(
      { latitude: parada.lat, longitude: parada.lng },
      { latitude: body.latitude, longitude: body.longitude }
    );
    const { suspeito, motivo } = verificarDistanciaSuspeita(distanciaMetros);

    // 6. Preparar dados do POD
    const dadosPOD = {
      paradaId: body.paradaId,
      tipo: body.tipo as TipoPOD,
      latitude: body.latitude,
      longitude: body.longitude,
      precisaoGps: body.precisaoGps,
      observacao: body.observacao,
      distanciaMetros,
      alertaDistancia: suspeito,
      // Campos específicos por tipo
      fotoUrl: body.tipo === 'FOTO' ? body.fotoBase64 : null,
      assinaturaUrl: body.tipo === 'ASSINATURA' ? body.assinaturaBase64 : null,
      codigo: body.tipo === 'CODIGO' ? body.codigo : null,
    };

    // 7. Criar POD e atualizar parada em transação
    const resultado = await prisma.$transaction(async (tx) => {
      // Criar POD
      const pod = await tx.proofOfDelivery.create({
        data: dadosPOD,
      });

      // Atualizar parada para ENTREGUE
      const paradaAtualizada = await tx.parada.update({
        where: { id: body.paradaId },
        data: {
          statusEntrega: 'ENTREGUE',
          entregueEm: new Date(),
        },
      });

      return { pod, parada: paradaAtualizada };
    });

    // 8. Log de auditoria
    console.log(`[POD] Registrado: paradaId=${body.paradaId}, tipo=${body.tipo}, distancia=${distanciaMetros}m, alerta=${suspeito}`);

    // 9. Retornar resposta
    return reply.status(201).send({
      success: true,
      pod: {
        id: resultado.pod.id,
        paradaId: resultado.pod.paradaId,
        tipo: resultado.pod.tipo,
        timestamp: resultado.pod.timestamp.toISOString(),
        latitude: resultado.pod.latitude,
        longitude: resultado.pod.longitude,
        distanciaMetros: resultado.pod.distanciaMetros,
        alertaDistancia: resultado.pod.alertaDistancia,
      },
      parada: {
        id: resultado.parada.id,
        statusEntrega: resultado.parada.statusEntrega,
        entregueEm: resultado.parada.entregueEm?.toISOString(),
      },
      ...(suspeito && {
        aviso: {
          tipo: 'DISTANCIA_ALTA',
          mensagem: motivo,
        },
      }),
    });
  });

  /**
   * GET /pod/:paradaId
   * Buscar POD de uma parada
   * 
   * @pre paradaId existe e pertence ao usuário
   * @post retorna POD ou null
   */
  app.get<{ Params: GetPODParams }>('/:paradaId', {
    schema: getPODSchema,
  }, async (request, reply) => {
    const { userId } = request.user;
    const { paradaId } = request.params;

    // Buscar parada com POD
    const parada = await prisma.parada.findFirst({
      where: {
        id: paradaId,
        rota: {
          userId,
        },
      },
      include: {
        pod: true,
      },
    });

    if (!parada) {
      return reply.status(404).send({
        error: {
          code: 'PARADA_NAO_ENCONTRADA',
          message: 'Parada não encontrada ou não pertence ao usuário',
        },
      });
    }

    if (!parada.pod) {
      return reply.status(200).send({
        pod: null,
        mensagem: 'Esta parada ainda não possui comprovante de entrega',
      });
    }

    return reply.status(200).send({
      pod: {
        id: parada.pod.id,
        paradaId: parada.pod.paradaId,
        tipo: parada.pod.tipo,
        fotoUrl: parada.pod.fotoUrl,
        assinaturaUrl: parada.pod.assinaturaUrl,
        codigo: parada.pod.codigo,
        latitude: parada.pod.latitude,
        longitude: parada.pod.longitude,
        precisaoGps: parada.pod.precisaoGps,
        distanciaMetros: parada.pod.distanciaMetros,
        alertaDistancia: parada.pod.alertaDistancia,
        timestamp: parada.pod.timestamp.toISOString(),
        observacao: parada.pod.observacao,
        sincronizadoFornecedor: parada.pod.sincronizadoFornecedor,
        protocoloFornecedor: parada.pod.protocoloFornecedor,
        createdAt: parada.pod.createdAt.toISOString(),
      },
    });
  });

  /**
   * GET /pod/rota/:rotaId
   * Listar todos os PODs de uma rota
   * 
   * @pre rotaId existe e pertence ao usuário
   * @post retorna lista de PODs
   */
  app.get<{ Params: { rotaId: string } }>('/rota/:rotaId', async (request, reply) => {
    const { userId } = request.user;
    const { rotaId } = request.params;

    // Buscar rota com paradas e PODs
    const rota = await prisma.rota.findFirst({
      where: {
        id: rotaId,
        userId,
      },
      include: {
        paradas: {
          include: {
            pod: true,
          },
          orderBy: {
            ordem: 'asc',
          },
        },
      },
    });

    if (!rota) {
      return reply.status(404).send({
        error: {
          code: 'ROTA_NAO_ENCONTRADA',
          message: 'Rota não encontrada ou não pertence ao usuário',
        },
      });
    }

    const resumo = {
      total: rota.paradas.length,
      comPOD: rota.paradas.filter(p => p.pod).length,
      semPOD: rota.paradas.filter(p => !p.pod).length,
      percentual: Math.round((rota.paradas.filter(p => p.pod).length / rota.paradas.length) * 100),
    };

    return reply.status(200).send({
      rotaId,
      resumo,
      paradas: rota.paradas.map(p => ({
        id: p.id,
        ordem: p.ordem,
        endereco: p.endereco,
        nome: p.nome,
        statusEntrega: p.statusEntrega,
        temPOD: !!p.pod,
        pod: p.pod ? {
          id: p.pod.id,
          tipo: p.pod.tipo,
          timestamp: p.pod.timestamp.toISOString(),
          alertaDistancia: p.pod.alertaDistancia,
        } : null,
      })),
    });
  });

  /**
   * GET /pod/verificar-plano
   * Verificar se o plano do usuário permite POD
   */
  app.get('/verificar-plano', async (request, reply) => {
    const { plano } = request.user;
    const permitido = verificarPlanoPermitePOD(plano);

    return reply.status(200).send({
      plano,
      podHabilitado: permitido,
      mensagem: permitido 
        ? 'Seu plano inclui comprovante de entrega' 
        : 'Faça upgrade para o plano FULL para usar comprovante de entrega',
    });
  });
}

export default podRoutes;
