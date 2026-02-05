/**
 * @fileoverview Rotas de Geofencing
 *
 * ENDPOINTS:
 * POST /geofencing/verificar - Verifica posição contra zonas
 * POST /geofencing/posicao - Processa posição e gera eventos
 * GET  /geofencing/eventos/:motoristaId - Lista eventos de um motorista
 * GET  /geofencing/conformidade/:motoristaId - Verifica se motorista está na zona
 * GET  /geofencing/configuracao/:zonaId - Obtém configuração de alerta
 * PUT  /geofencing/configuracao/:zonaId - Salva configuração de alerta
 *
 * @pre Usuário autenticado
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  pontoEmPoligono,
  pontoEmCirculo,
  verificarZonas,
  registrarEvento,
  processarPosicao,
  obterConfiguracao,
  salvarConfiguracao,
  listarEventos,
  verificarConformidade,
  type ZonaGeofence,
  type Geometria
} from '../services/geofencing.js';

// ==========================================
// SCHEMAS DE VALIDAÇÃO
// ==========================================

const CoordenadaSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});

const PoligonoSchema = z.object({
  tipo: z.literal('POLIGONO'),
  vertices: z.array(CoordenadaSchema).min(3)
});

const CirculoSchema = z.object({
  tipo: z.literal('CIRCULO'),
  centro: CoordenadaSchema,
  raioKm: z.number().positive()
});

const GeometriaSchema = z.union([PoligonoSchema, CirculoSchema]);

const ZonaSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().min(1),
  geometria: GeometriaSchema
});

const VerificarPontoSchema = z.object({
  ponto: CoordenadaSchema,
  zona: ZonaSchema
});

const VerificarZonasSchema = z.object({
  ponto: CoordenadaSchema,
  zonas: z.array(ZonaSchema)
});

const PosicaoMotoristaSchema = z.object({
  motoristaId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});

const ConfiguracaoSchema = z.object({
  alertaEntrada: z.boolean().optional(),
  alertaSaida: z.boolean().optional(),
  alertaTempoExcedido: z.boolean().optional(),
  tempoMaximoMin: z.number().int().positive().optional(),
  debounceSegundos: z.number().int().min(0).optional(),
  toleranciaMetros: z.number().int().min(0).optional(),
  webhookUrl: z.string().url().optional()
});

const EventosQuerySchema = z.object({
  inicio: z.string().datetime().optional(),
  fim: z.string().datetime().optional()
});

// ==========================================
// ROTAS
// ==========================================

export async function geofencingRoutes(fastify: FastifyInstance) {
  /**
   * POST /geofencing/verificar-ponto
   * Verifica se um ponto está dentro de uma zona
   */
  fastify.post<{
    Body: z.infer<typeof VerificarPontoSchema>
  }>('/verificar-ponto', async (request, reply) => {
    try {
      const { ponto, zona } = VerificarPontoSchema.parse(request.body);
      
      let estaDentro = false;
      if (zona.geometria.tipo === 'CIRCULO') {
        estaDentro = pontoEmCirculo(ponto, zona.geometria.centro, zona.geometria.raioKm);
      } else {
        estaDentro = pontoEmPoligono(ponto, zona.geometria.vertices);
      }

      return {
        success: true,
        data: {
          ponto,
          zona: zona.nome,
          estaDentro
        }
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
   * POST /geofencing/verificar-zonas
   * Verifica posição contra múltiplas zonas
   */
  fastify.post<{
    Body: z.infer<typeof VerificarZonasSchema>
  }>('/verificar-zonas', async (request, reply) => {
    try {
      const { ponto, zonas } = VerificarZonasSchema.parse(request.body);
      
      const zonasGeofence: ZonaGeofence[] = zonas.map(z => ({
        id: z.id,
        nome: z.nome,
        geometria: z.geometria as Geometria
      }));

      const resultados = verificarZonas(ponto, zonasGeofence);

      return {
        success: true,
        data: {
          ponto,
          totalZonas: zonas.length,
          resultados: resultados.map(r => ({
            zona: r.zona.nome,
            dentroZona: r.dentroZona,
            distanciaBordaMetros: r.distanciaBorda
          }))
        }
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
   * POST /geofencing/posicao
   * Processa atualização de posição e detecta eventos de entrada/saída
   */
  fastify.post<{
    Body: z.infer<typeof PosicaoMotoristaSchema>
  }>('/posicao', async (request, reply) => {
    try {
      const { motoristaId, lat, lng } = PosicaoMotoristaSchema.parse(request.body);
      
      const eventos = await processarPosicao(motoristaId, { lat, lng });

      return {
        success: true,
        data: {
          motoristaId,
          posicao: { lat, lng },
          eventosGerados: eventos.length,
          eventos: eventos.map(e => ({
            tipo: e.tipo,
            zonaId: e.zonaId,
            timestamp: e.timestamp
          }))
        }
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
   * GET /geofencing/eventos/:motoristaId
   * Lista eventos de geofence de um motorista
   */
  fastify.get<{
    Params: { motoristaId: string },
    Querystring: z.infer<typeof EventosQuerySchema>
  }>('/eventos/:motoristaId', async (request, reply) => {
    try {
      const { motoristaId } = request.params;
      const query = EventosQuerySchema.parse(request.query);

      // Default: últimas 24h
      const agora = new Date();
      const inicio = query.inicio ? new Date(query.inicio) : new Date(agora.getTime() - 24 * 60 * 60 * 1000);
      const fim = query.fim ? new Date(query.fim) : agora;

      const eventos = await listarEventos(motoristaId, inicio, fim);

      return {
        success: true,
        data: {
          motoristaId,
          periodo: { inicio, fim },
          total: eventos.length,
          eventos
        }
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
   * GET /geofencing/conformidade/:motoristaId
   * Verifica se motorista está dentro de suas zonas atribuídas
   */
  fastify.get<{
    Params: { motoristaId: string }
  }>('/conformidade/:motoristaId', async (request, reply) => {
    try {
      const { motoristaId } = request.params;
      const resultado = await verificarConformidade(motoristaId);

      return {
        success: true,
        data: resultado
      };
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
      return reply.status(500).send({
        success: false,
        error: mensagem
      });
    }
  });

  /**
   * GET /geofencing/configuracao/:zonaId
   * Obtém configuração de alertas de uma zona
   */
  fastify.get<{
    Params: { zonaId: string }
  }>('/configuracao/:zonaId', async (request, reply) => {
    try {
      const { zonaId } = request.params;
      const config = await obterConfiguracao(zonaId);

      if (!config) {
        return reply.status(404).send({
          success: false,
          error: 'Configuração não encontrada'
        });
      }

      return {
        success: true,
        data: config
      };
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
      return reply.status(500).send({
        success: false,
        error: mensagem
      });
    }
  });

  /**
   * PUT /geofencing/configuracao/:zonaId
   * Salva/atualiza configuração de alertas de uma zona
   */
  fastify.put<{
    Params: { zonaId: string },
    Body: z.infer<typeof ConfiguracaoSchema>
  }>('/configuracao/:zonaId', async (request, reply) => {
    try {
      const { zonaId } = request.params;
      const config = ConfiguracaoSchema.parse(request.body);

      await salvarConfiguracao(zonaId, config);

      return {
        success: true,
        message: 'Configuração salva com sucesso'
      };
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
      return reply.status(400).send({
        success: false,
        error: mensagem
      });
    }
  });
}
