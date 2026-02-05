/**
 * @fileoverview Rotas de Histórico
 *
 * DESIGN POR CONTRATO:
 * @description Endpoints para consulta e exportação de histórico
 * @pre Usuário autenticado
 * @post Retorna dados históricos ou arquivos de exportação
 *
 * ENDPOINTS:
 * - GET /api/v1/historico - Lista rotas com filtros
 * - GET /api/v1/historico/resumo - Resumo agregado do período
 * - GET /api/v1/historico/export/pdf - Exportar para PDF
 * - GET /api/v1/historico/export/excel - Exportar para Excel
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  buscarHistorico,
  calcularResumo,
  gerarPDF,
  gerarExcel,
  FiltrosHistorico,
} from '../services/historico.js';

// ==========================================
// JSON SCHEMAS
// ==========================================

const filtrosQuerySchema = {
  type: 'object',
  properties: {
    dataInicio: { type: 'string', format: 'date' },
    dataFim: { type: 'string', format: 'date' },
    fornecedor: { type: 'string' },
    status: { type: 'string', enum: ['CONCLUIDA', 'CANCELADA'] },
    pagina: { type: 'integer', minimum: 1, default: 1 },
    limite: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    ordenarPor: { type: 'string', enum: ['data', 'distancia', 'entregas', 'custo'], default: 'data' },
    ordem: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
  },
};

const resumoQuerySchema = {
  type: 'object',
  properties: {
    dataInicio: { type: 'string', format: 'date' },
    dataFim: { type: 'string', format: 'date' },
    fornecedor: { type: 'string' },
  },
};

const exportQuerySchema = {
  type: 'object',
  properties: {
    dataInicio: { type: 'string', format: 'date' },
    dataFim: { type: 'string', format: 'date' },
    fornecedor: { type: 'string' },
  },
};

// ==========================================
// PLUGIN DE ROTAS
// ==========================================

export default async function historicoRoutes(fastify: FastifyInstance) {
  // Middleware de autenticação para todas as rotas
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ success: false, error: 'Token inválido ou expirado' });
    }
  });

  /**
   * GET /api/v1/historico
   * Lista rotas com filtros e paginação
   *
   * @pre Token JWT válido
   * @post Lista paginada de rotas + resumo
   */
  fastify.get(
    '/',
    {
      schema: {
        querystring: filtrosQuerySchema,
        description: 'Lista histórico de rotas com filtros',
        tags: ['Histórico'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  rotas: { type: 'array' },
                  resumo: { type: 'object' },
                  paginacao: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as { id: string };
      const query = request.query as any;

      // Converter datas
      const filtros: FiltrosHistorico = {
        dataInicio: query.dataInicio ? new Date(query.dataInicio) : undefined,
        dataFim: query.dataFim ? new Date(query.dataFim) : undefined,
        fornecedor: query.fornecedor,
        status: query.status,
        pagina: query.pagina,
        limite: query.limite,
        ordenarPor: query.ordenarPor,
        ordem: query.ordem,
      };

      try {
        const resultado = await buscarHistorico(user.id, filtros);
        return { success: true, data: resultado };
      } catch (error) {
        fastify.log.error(error, 'Erro ao buscar histórico');
        return reply.code(500).send({
          success: false,
          error: 'Erro ao buscar histórico',
        });
      }
    }
  );

  /**
   * GET /api/v1/historico/resumo
   * Resumo agregado do período
   *
   * @pre Token JWT válido
   * @post Métricas agregadas
   */
  fastify.get(
    '/resumo',
    {
      schema: {
        querystring: resumoQuerySchema,
        description: 'Resumo agregado do histórico',
        tags: ['Histórico'],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as { id: string };
      const query = request.query as any;

      // Período padrão: últimos 30 dias
      const dataFim = query.dataFim ? new Date(query.dataFim) : new Date();
      const dataInicio = query.dataInicio
        ? new Date(query.dataInicio)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      try {
        const resumo = await calcularResumo(user.id, dataInicio, dataFim, query.fornecedor);
        return { success: true, data: resumo };
      } catch (error) {
        fastify.log.error(error, 'Erro ao calcular resumo');
        return reply.code(500).send({
          success: false,
          error: 'Erro ao calcular resumo',
        });
      }
    }
  );

  /**
   * GET /api/v1/historico/export/pdf
   * Exporta histórico para PDF
   *
   * @pre Token JWT válido, período <= 90 dias
   * @post Stream do PDF
   */
  fastify.get(
    '/export/pdf',
    {
      schema: {
        querystring: exportQuerySchema,
        description: 'Exportar histórico para PDF',
        tags: ['Histórico'],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as { id: string };
      const query = request.query as any;

      // Validar período máximo (90 dias)
      const dataFim = query.dataFim ? new Date(query.dataFim) : new Date();
      const dataInicio = query.dataInicio
        ? new Date(query.dataInicio)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const diasDiff = Math.ceil(
        (dataFim.getTime() - dataInicio.getTime()) / (24 * 60 * 60 * 1000)
      );

      if (diasDiff > 90) {
        return reply.code(400).send({
          success: false,
          error: 'Período máximo para exportação PDF é 90 dias',
        });
      }

      try {
        const pdfStream = await gerarPDF(user.id, {
          dataInicio,
          dataFim,
          fornecedor: query.fornecedor,
        });

        const filename = `speedrota-relatorio-${dataInicio.toISOString().split('T')[0]}-${dataFim.toISOString().split('T')[0]}.pdf`;

        return reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `attachment; filename="${filename}"`)
          .send(pdfStream);
      } catch (error) {
        fastify.log.error(error, 'Erro ao gerar PDF');
        return reply.code(500).send({
          success: false,
          error: 'Erro ao gerar PDF',
        });
      }
    }
  );

  /**
   * GET /api/v1/historico/export/excel
   * Exporta histórico para Excel
   *
   * @pre Token JWT válido
   * @post Buffer do Excel (.xlsx)
   */
  fastify.get(
    '/export/excel',
    {
      schema: {
        querystring: exportQuerySchema,
        description: 'Exportar histórico para Excel',
        tags: ['Histórico'],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as { id: string };
      const query = request.query as any;

      // Período padrão: últimos 30 dias
      const dataFim = query.dataFim ? new Date(query.dataFim) : new Date();
      const dataInicio = query.dataInicio
        ? new Date(query.dataInicio)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      try {
        const excelBuffer = await gerarExcel(user.id, {
          dataInicio,
          dataFim,
          fornecedor: query.fornecedor,
        });

        const filename = `speedrota-historico-${dataInicio.toISOString().split('T')[0]}-${dataFim.toISOString().split('T')[0]}.xlsx`;

        return reply
          .header(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          )
          .header('Content-Disposition', `attachment; filename="${filename}"`)
          .send(excelBuffer);
      } catch (error) {
        fastify.log.error(error, 'Erro ao gerar Excel');
        return reply.code(500).send({
          success: false,
          error: 'Erro ao gerar Excel',
        });
      }
    }
  );

  /**
   * GET /api/v1/historico/fornecedores
   * Lista fornecedores disponíveis para filtro
   *
   * @pre Token JWT válido
   * @post Lista de fornecedores únicos
   */
  fastify.get(
    '/fornecedores',
    {
      schema: {
        description: 'Lista fornecedores para filtro',
        tags: ['Histórico'],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as { id: string };

      try {
        // Buscar fornecedores únicos das paradas do usuário
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();

        const paradas = await prisma.parada.findMany({
          where: {
            rota: {
              userId: user.id,
            },
          },
          select: {
            fornecedor: true,
          },
          distinct: ['fornecedor'],
        });

        const fornecedores = paradas.map((p) => p.fornecedor).sort();

        await prisma.$disconnect();

        return {
          success: true,
          data: { fornecedores },
        };
      } catch (error) {
        fastify.log.error(error, 'Erro ao buscar fornecedores');
        return reply.code(500).send({
          success: false,
          error: 'Erro ao buscar fornecedores',
        });
      }
    }
  );
}
