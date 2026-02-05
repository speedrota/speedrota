/**
 * @fileoverview Rotas de Machine Learning - Previsão de Demanda
 * 
 * DESIGN POR CONTRATO:
 * @pre Autenticação válida
 * @post Previsões com confiança e insights
 * 
 * ENDPOINTS:
 * - GET /previsao/:zona - Previsão para zona específica
 * - GET /mapa-calor - Mapa de calor de demanda
 * - GET /insights - Insights ativos
 * - POST /agregar - Atualizar agregações (admin)
 * - POST /validar - Validar previsões anteriores (admin)
 * 
 * @author SpeedRota Team
 * @version 1.0.0
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import previsaoDemandaService from '../services/previsao-demanda.js';

// ==========================================
// SCHEMAS
// ==========================================

const previsaoParamsSchema = {
  type: 'object',
  properties: {
    zona: { type: 'string', minLength: 5, maxLength: 10 },
  },
  required: ['zona'],
};

const previsaoQuerySchema = {
  type: 'object',
  properties: {
    data: { type: 'string', format: 'date' },
    horaInicio: { type: 'integer', minimum: 0, maximum: 23 },
    horaFim: { type: 'integer', minimum: 0, maximum: 23 },
    fornecedor: { type: 'string' },
  },
};

const mapaCalorQuerySchema = {
  type: 'object',
  properties: {
    data: { type: 'string', format: 'date' },
  },
};

// ==========================================
// ROTAS
// ==========================================

export default async function mlRoutes(fastify: FastifyInstance) {
  
  /**
   * GET /previsao/:zona
   * Gera previsão de demanda para uma zona
   * 
   * @pre zona com 5-10 caracteres (CEP prefix)
   * @post PrevisaoOutput com demanda, confiança e insights
   */
  fastify.get<{
    Params: { zona: string };
    Querystring: { data?: string; horaInicio?: number; horaFim?: number; fornecedor?: string };
  }>('/previsao/:zona', {
    schema: {
      params: previsaoParamsSchema,
      querystring: previsaoQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                zona: { type: 'string' },
                data: { type: 'string' },
                horaInicio: { type: 'integer' },
                horaFim: { type: 'integer' },
                demandaPrevista: { type: 'integer' },
                confianca: { type: 'number' },
                limiteInferior: { type: 'integer' },
                limiteSuperior: { type: 'integer' },
                fatores: {
                  type: 'object',
                  properties: {
                    diaSemana: { type: 'number' },
                    horario: { type: 'number' },
                    sazonalidade: { type: 'number' },
                    tendencia: { type: 'number' },
                  },
                },
                insights: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      tipo: { type: 'string' },
                      titulo: { type: 'string' },
                      descricao: { type: 'string' },
                      valor: { type: 'number' },
                      acao: { type: 'string' },
                      prioridade: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { zona } = request.params;
      const { data, horaInicio, horaFim, fornecedor } = request.query;

      const dataPrevisao = data ? new Date(data) : new Date();
      dataPrevisao.setDate(dataPrevisao.getDate() + 1); // Amanhã por padrão

      const previsao = await previsaoDemandaService.gerarPrevisao({
        zona,
        data: dataPrevisao,
        horaInicio,
        horaFim,
        fornecedor,
      });

      return reply.send({
        success: true,
        data: {
          ...previsao,
          data: previsao.data.toISOString(),
        },
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /mapa-calor
   * Gera mapa de calor de demanda para todas as zonas
   * 
   * @pre data válida (opcional, default = amanhã)
   * @post MapaCalorOutput com zonas ordenadas por demanda
   */
  fastify.get<{
    Querystring: { data?: string };
  }>('/mapa-calor', {
    schema: {
      querystring: mapaCalorQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                zonas: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      zona: { type: 'string' },
                      demandaPrevista: { type: 'integer' },
                      intensidade: { type: 'number' },
                      melhorHorario: { type: 'string' },
                    },
                  },
                },
                dataReferencia: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { data } = request.query;

      const dataPrevisao = data ? new Date(data) : new Date();
      if (!data) {
        dataPrevisao.setDate(dataPrevisao.getDate() + 1); // Amanhã
      }

      const mapaCalor = await previsaoDemandaService.gerarMapaCalor(dataPrevisao);

      return reply.send({
        success: true,
        data: {
          zonas: mapaCalor.zonas,
          dataReferencia: mapaCalor.dataReferencia.toISOString(),
        },
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /insights
   * Lista insights ativos para o usuário
   * 
   * @pre zona opcional para filtrar
   * @post Lista de insights ordenados por prioridade
   */
  fastify.get<{
    Querystring: { zona?: string };
  }>('/insights', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          zona: { type: 'string' },
        },
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
                  tipo: { type: 'string' },
                  titulo: { type: 'string' },
                  descricao: { type: 'string' },
                  valor: { type: 'number' },
                  acao: { type: 'string' },
                  prioridade: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const { zona } = request.query;

      const insights = await previsaoDemandaService.getInsightsAtivos(zona);

      return reply.send({
        success: true,
        data: insights,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /agregar
   * Atualiza agregações de demanda (job administrativo)
   * 
   * @pre Permissão de admin
   * @post Agregações atualizadas com dados dos últimos 30 dias
   */
  fastify.post('/agregar', async (request, reply) => {
    try {
      const resultado = await previsaoDemandaService.atualizarAgregacoes();

      return reply.send({
        success: true,
        data: resultado,
        message: `${resultado.atualizadas} agregações atualizadas`,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /validar
   * Valida previsões anteriores com demanda real
   * 
   * @pre Permissão de admin
   * @post Previsões validadas com erro absoluto calculado
   */
  fastify.post('/validar', async (request, reply) => {
    try {
      const resultado = await previsaoDemandaService.validarPrevisoes();

      return reply.send({
        success: true,
        data: resultado,
        message: `${resultado.validadas} previsões validadas, erro médio: ${resultado.erroMedio.toFixed(2)}`,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /metricas
   * Métricas de qualidade do modelo ML
   */
  fastify.get('/metricas', async (request, reply) => {
    try {
      const { prisma } = await import('../lib/prisma.js');

      // Buscar previsões validadas
      const previsoes = await prisma.previsaoDemanda.findMany({
        where: {
          demandaReal: { not: null },
        },
        select: {
          demandaPrevista: true,
          demandaReal: true,
          erroAbsoluto: true,
          confianca: true,
        },
        take: 1000,
        orderBy: { createdAt: 'desc' },
      });

      if (previsoes.length === 0) {
        return reply.send({
          success: true,
          data: {
            totalPrevisoes: 0,
            message: 'Nenhuma previsão validada ainda',
          },
        });
      }

      // Calcular métricas
      const erros = previsoes.map(p => p.erroAbsoluto || 0);
      const erroMedio = erros.reduce((a, b) => a + b, 0) / erros.length;

      const errosPercentuais = previsoes.map(p => {
        if (p.demandaReal === 0) return 0;
        return Math.abs((p.demandaPrevista - (p.demandaReal || 0)) / (p.demandaReal || 1)) * 100;
      });
      const mape = errosPercentuais.reduce((a, b) => a + b, 0) / errosPercentuais.length;

      const acertos = previsoes.filter(p => {
        const erro = Math.abs(p.demandaPrevista - (p.demandaReal || 0));
        return erro <= 3; // Tolerância de 3 entregas
      }).length;
      const taxaAcerto = (acertos / previsoes.length) * 100;

      return reply.send({
        success: true,
        data: {
          totalPrevisoes: previsoes.length,
          erroMedioAbsoluto: erroMedio.toFixed(2),
          mape: `${mape.toFixed(1)}%`,
          taxaAcerto: `${taxaAcerto.toFixed(1)}%`,
          confiancaMedia: (previsoes.reduce((a, p) => a + p.confianca, 0) / previsoes.length).toFixed(2),
        },
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });
}
