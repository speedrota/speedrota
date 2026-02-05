/**
 * @fileoverview Rotas de Capacidade de Veículo
 *
 * ENDPOINTS:
 * GET  /capacidade/padrao/:tipo - Obtém capacidade padrão por tipo de veículo
 * POST /capacidade/validar - Valida se carga cabe no veículo
 * POST /capacidade/rota/:rotaId - Salva carga atual de uma rota
 * PUT  /capacidade/rota/:rotaId/entrega - Registra entrega (subtrai carga)
 * GET  /capacidade/veiculo/:veiculoId - Obtém capacidade de um veículo
 *
 * @pre Usuário autenticado para rotas com dados persistentes
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  validarCapacidade,
  validarCargaRota,
  salvarCargaVeiculo,
  registrarEntrega,
  obterCapacidadeVeiculo,
  obterCapacidadePadrao,
  CAPACIDADE_PADRAO
} from '../services/capacidade.js';
import { TipoVeiculo } from '@prisma/client';

// ==========================================
// SCHEMAS DE VALIDAÇÃO
// ==========================================

const TipoVeiculoSchema = z.enum(['MOTO', 'BIKE', 'CARRO', 'VAN', 'CAMINHAO_LEVE', 'CAMINHAO']);

const CargaSchema = z.object({
  pesoKg: z.number().min(0),
  volumes: z.number().int().min(0),
  m3: z.number().min(0).optional()
});

const CapacidadeSchema = z.object({
  tipo: TipoVeiculoSchema,
  capacidadeKg: z.number().positive(),
  capacidadeVolumes: z.number().int().positive(),
  capacidadeM3: z.number().positive().optional()
});

const ValidarCargaSchema = z.object({
  veiculo: CapacidadeSchema,
  carga: CargaSchema
});

const ValidarRotaSchema = z.object({
  veiculo: CapacidadeSchema,
  itens: z.array(z.object({
    paradaId: z.string().uuid(),
    pesoKg: z.number().min(0),
    volumes: z.number().int().min(0),
    m3: z.number().min(0).optional()
  }))
});

const SalvarCargaSchema = z.object({
  carga: CargaSchema,
  capacidade: CapacidadeSchema
});

const EntregaSchema = z.object({
  paradaId: z.string().uuid(),
  pesoKg: z.number().min(0),
  volumes: z.number().int().min(0),
  m3: z.number().min(0).optional()
});

// ==========================================
// ROTAS
// ==========================================

export async function capacidadeRoutes(fastify: FastifyInstance) {
  /**
   * GET /capacidade/padrao/:tipo
   * Retorna capacidade padrão para um tipo de veículo
   */
  fastify.get<{
    Params: { tipo: string }
  }>('/padrao/:tipo', async (request, reply) => {
    const tipo = request.params.tipo.toUpperCase();

    if (!TipoVeiculoSchema.safeParse(tipo).success) {
      return reply.status(400).send({
        success: false,
        error: `Tipo inválido. Use: ${Object.keys(CAPACIDADE_PADRAO).join(', ')}`
      });
    }

    const capacidade = obterCapacidadePadrao(tipo as TipoVeiculo);

    return {
      success: true,
      data: capacidade
    };
  });

  /**
   * GET /capacidade/tipos
   * Lista todos os tipos de veículo e suas capacidades padrão
   */
  fastify.get('/tipos', async () => {
    return {
      success: true,
      data: CAPACIDADE_PADRAO
    };
  });

  /**
   * POST /capacidade/validar
   * Valida se uma carga cabe em um veículo
   */
  fastify.post<{
    Body: z.infer<typeof ValidarCargaSchema>
  }>('/validar', async (request, reply) => {
    try {
      const { veiculo, carga } = ValidarCargaSchema.parse(request.body);
      const resultado = validarCapacidade(veiculo, carga);

      return {
        success: true,
        data: resultado
      };
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
      return reply.status(400).send({
        success: false,
        error: mensagem
      });
    }
  });

  /**
   * POST /capacidade/validar-rota
   * Valida se todas as paradas cabem no veículo (soma total)
   */
  fastify.post<{
    Body: z.infer<typeof ValidarRotaSchema>
  }>('/validar-rota', async (request, reply) => {
    try {
      const { veiculo, itens } = ValidarRotaSchema.parse(request.body);
      const resultado = validarCargaRota(veiculo, itens);

      return {
        success: true,
        data: resultado
      };
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
      return reply.status(400).send({
        success: false,
        error: mensagem
      });
    }
  });

  /**
   * POST /capacidade/rota/:rotaId
   * Salva o estado atual da carga de uma rota
   */
  fastify.post<{
    Params: { rotaId: string },
    Body: z.infer<typeof SalvarCargaSchema>
  }>('/rota/:rotaId', async (request, reply) => {
    try {
      const { rotaId } = request.params;
      const { carga, capacidade } = SalvarCargaSchema.parse(request.body);

      await salvarCargaVeiculo(rotaId, carga, capacidade);

      return {
        success: true,
        message: 'Carga salva com sucesso'
      };
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
      return reply.status(400).send({
        success: false,
        error: mensagem
      });
    }
  });

  /**
   * PUT /capacidade/rota/:rotaId/entrega
   * Registra uma entrega (subtrai peso/volumes da carga atual)
   */
  fastify.put<{
    Params: { rotaId: string },
    Body: z.infer<typeof EntregaSchema>
  }>('/rota/:rotaId/entrega', async (request, reply) => {
    try {
      const { rotaId } = request.params;
      const entrega = EntregaSchema.parse(request.body);

      const resultado = await registrarEntrega(rotaId, entrega);

      if (!resultado) {
        return reply.status(404).send({
          success: false,
          error: 'Rota não encontrada ou sem carga registrada'
        });
      }

      return {
        success: true,
        data: resultado
      };
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
      return reply.status(400).send({
        success: false,
        error: mensagem
      });
    }
  });

  /**
   * GET /capacidade/veiculo/:veiculoId
   * Obtém capacidade de um veículo específico
   */
  fastify.get<{
    Params: { veiculoId: string }
  }>('/veiculo/:veiculoId', async (request, reply) => {
    try {
      const { veiculoId } = request.params;
      const capacidade = await obterCapacidadeVeiculo(veiculoId);

      if (!capacidade) {
        return reply.status(404).send({
          success: false,
          error: 'Veículo não encontrado'
        });
      }

      return {
        success: true,
        data: capacidade
      };
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
      return reply.status(500).send({
        success: false,
        error: mensagem
      });
    }
  });
}
