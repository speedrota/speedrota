/**
 * @fileoverview Rotas de Tráfego Real-time
 *
 * ENDPOINTS:
 * GET /trafego/atual - Obtém status atual do tráfego
 * GET /trafego/fator/:hora - Obtém fator para hora específica
 * POST /trafego/ajustar - Ajusta duração com tráfego
 *
 * @pre Usuário autenticado (opcional para alguns endpoints)
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  obterFatorTrafegoAtual,
  obterFatorTrafego,
  ajustarDuracaoComTrafego,
  formatarTempoComTrafego,
  obterResumoTrafego,
} from '../services/trafego.js';

// Schemas de validação
const AjustarDuracaoSchema = z.object({
  duracaoMinutos: z.number().min(0),
  hora: z.number().min(0).max(23).optional(),
});

const HoraParamsSchema = z.object({
  hora: z.string().regex(/^\d{1,2}$/),
});

export async function trafegoRoutes(fastify: FastifyInstance) {
  /**
   * GET /trafego/atual
   * Retorna o status atual do tráfego
   */
  fastify.get('/atual', async () => {
    const resumo = obterResumoTrafego();
    const fator = obterFatorTrafegoAtual();

    return {
      success: true,
      data: {
        ...resumo,
        periodo: fator.periodo,
        horaAtual: new Date().getHours(),
        horarioLocal: new Date().toLocaleTimeString('pt-BR'),
      },
    };
  });

  /**
   * GET /trafego/fator/:hora
   * Retorna o fator de tráfego para uma hora específica
   */
  fastify.get<{
    Params: z.infer<typeof HoraParamsSchema>;
  }>('/fator/:hora', async (request) => {
    const { hora } = HoraParamsSchema.parse(request.params);
    const horaNum = parseInt(hora, 10);

    if (horaNum < 0 || horaNum > 23) {
      return {
        success: false,
        error: 'Hora deve estar entre 0 e 23',
      };
    }

    const fator = obterFatorTrafego(horaNum);

    return {
      success: true,
      data: {
        hora: horaNum,
        ...fator,
      },
    };
  });

  /**
   * POST /trafego/ajustar
   * Ajusta uma duração com base no tráfego
   */
  fastify.post<{
    Body: z.infer<typeof AjustarDuracaoSchema>;
  }>('/ajustar', async (request) => {
    const { duracaoMinutos, hora } = AjustarDuracaoSchema.parse(request.body);

    const ajuste = ajustarDuracaoComTrafego(duracaoMinutos, hora);
    const formato = formatarTempoComTrafego(duracaoMinutos);

    return {
      success: true,
      data: {
        ...ajuste,
        formatado: formato,
      },
    };
  });

  /**
   * GET /trafego/previsao
   * Retorna previsão de tráfego para as próximas horas
   */
  fastify.get('/previsao', async () => {
    const horaAtual = new Date().getHours();
    const previsao = [];

    for (let i = 0; i < 12; i++) {
      const hora = (horaAtual + i) % 24;
      const fator = obterFatorTrafego(hora);
      previsao.push({
        hora,
        horaFormatada: `${hora.toString().padStart(2, '0')}:00`,
        ...fator,
      });
    }

    return {
      success: true,
      data: {
        horaAtual,
        previsao,
      },
    };
  });
}

export default trafegoRoutes;
