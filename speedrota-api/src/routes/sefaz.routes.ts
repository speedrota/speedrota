/**
 * @fileoverview Rotas de Integração SEFAZ
 *
 * ENDPOINTS:
 * POST /sefaz/consultar - Consulta NF-e por chave de acesso
 * POST /sefaz/validar-chave - Valida formato de chave de acesso
 * POST /sefaz/importar - Importa NF-e como parada
 * POST /sefaz/importar-lote - Importa múltiplas NF-e
 * GET  /sefaz/configuracao - Obtém configuração SEFAZ da empresa
 * PUT  /sefaz/configuracao - Salva configuração SEFAZ
 *
 * @pre Usuário autenticado
 * @pre Certificado digital para ambiente de produção
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  validarChaveAcesso,
  consultarNfe,
  formatarEnderecoParaGeocoding,
  importarNfeComoParada,
  importarLoteNfe,
  obterConfiguracaoEmpresa,
  salvarConfiguracaoSefaz,
  obterUfDaChave
} from '../services/sefaz.js';

// ==========================================
// SCHEMAS DE VALIDAÇÃO
// ==========================================

const ChaveAcessoSchema = z.string().regex(/^\d{44}$/, 'Chave deve ter 44 dígitos numéricos');

const ConsultarNfeSchema = z.object({
  chaveAcesso: ChaveAcessoSchema,
  forcarConsulta: z.boolean().optional() // Ignora cache
});

const ImportarNfeSchema = z.object({
  chaveAcesso: ChaveAcessoSchema,
  rotaId: z.string().uuid()
});

const ImportarLoteSchema = z.object({
  chaves: z.array(ChaveAcessoSchema).min(1).max(50),
  rotaId: z.string().uuid()
});

const ConfiguracaoSefazSchema = z.object({
  ambiente: z.enum(['PRODUCAO', 'HOMOLOGACAO']).optional(),
  certificadoBase64: z.string().optional(),
  senhaCertificado: z.string().optional(),
  cnpjConsultante: z.string().regex(/^\d{14}$/, 'CNPJ deve ter 14 dígitos').optional(),
  rateLimitPorMinuto: z.number().int().min(1).max(60).optional()
});

// ==========================================
// ROTAS
// ==========================================

export async function sefazRoutes(fastify: FastifyInstance) {
  /**
   * POST /sefaz/validar-chave
   * Valida formato de chave de acesso e extrai componentes
   */
  fastify.post<{
    Body: { chaveAcesso: string }
  }>('/validar-chave', async (request, reply) => {
    try {
      const { chaveAcesso } = request.body;
      const chaveInfo = validarChaveAcesso(chaveAcesso);

      return {
        success: true,
        data: {
          valida: true,
          componentes: {
            uf: obterUfDaChave(chaveAcesso),
            codigoUf: chaveInfo.uf,
            dataEmissao: chaveInfo.dataEmissao,
            cnpjEmitente: chaveInfo.cnpjEmitente,
            modelo: chaveInfo.modelo === '55' ? 'NF-e' : 'NFC-e',
            serie: parseInt(chaveInfo.serie),
            numero: parseInt(chaveInfo.numero),
            tipoEmissao: chaveInfo.tipoEmissao,
            digitoVerificador: chaveInfo.digitoVerificador
          }
        }
      };
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Chave inválida';
      return reply.status(400).send({
        success: false,
        data: {
          valida: false,
          erro: mensagem
        }
      });
    }
  });

  /**
   * POST /sefaz/consultar
   * Consulta NF-e no SEFAZ (usa cache se disponível)
   */
  fastify.post<{
    Body: z.infer<typeof ConsultarNfeSchema>
  }>('/consultar', async (request, reply) => {
    try {
      const { chaveAcesso, forcarConsulta } = ConsultarNfeSchema.parse(request.body);
      
      // TODO: Obter config da empresa do usuário autenticado
      // const empresaId = request.user.empresaId;
      // const config = await obterConfiguracaoEmpresa(empresaId);

      const resultado = await consultarNfe(chaveAcesso);

      if (!resultado.sucesso) {
        return reply.status(400).send({
          success: false,
          error: resultado.erro,
          consultaEm: resultado.consultaEm
        });
      }

      return {
        success: true,
        data: {
          nfe: resultado.dados,
          cache: resultado.cache,
          consultaEm: resultado.consultaEm,
          enderecoFormatado: resultado.dados
            ? formatarEnderecoParaGeocoding(resultado.dados.destinatario)
            : null
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
   * POST /sefaz/importar
   * Importa NF-e e cria parada automaticamente
   */
  fastify.post<{
    Body: z.infer<typeof ImportarNfeSchema>
  }>('/importar', async (request, reply) => {
    try {
      const { chaveAcesso, rotaId } = ImportarNfeSchema.parse(request.body);
      
      const resultado = await importarNfeComoParada(chaveAcesso, rotaId);

      if (!resultado.sucesso) {
        return reply.status(400).send({
          success: false,
          error: resultado.erro
        });
      }

      return {
        success: true,
        data: {
          paradaId: resultado.paradaId,
          mensagem: 'NF-e importada com sucesso'
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
   * POST /sefaz/importar-lote
   * Importa múltiplas NF-e em lote (respeita rate limit)
   */
  fastify.post<{
    Body: z.infer<typeof ImportarLoteSchema>
  }>('/importar-lote', async (request, reply) => {
    try {
      const { chaves, rotaId } = ImportarLoteSchema.parse(request.body);

      // Rate limit padrão
      const resultado = await importarLoteNfe(chaves, rotaId, 20);

      return {
        success: true,
        data: {
          total: resultado.total,
          sucesso: resultado.sucesso,
          falha: resultado.falha,
          percentualSucesso: Math.round((resultado.sucesso / resultado.total) * 100),
          detalhes: resultado.detalhes
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
   * GET /sefaz/configuracao/:empresaId
   * Obtém configuração SEFAZ de uma empresa
   */
  fastify.get<{
    Params: { empresaId: string }
  }>('/configuracao/:empresaId', async (request, reply) => {
    try {
      const { empresaId } = request.params;
      const config = await obterConfiguracaoEmpresa(empresaId);

      if (!config) {
        return {
          success: true,
          data: {
            configurado: false,
            mensagem: 'SEFAZ não configurado para esta empresa'
          }
        };
      }

      // Não retornar certificado/senha por segurança
      return {
        success: true,
        data: {
          configurado: true,
          ambiente: config.ambiente,
          cnpjConsultante: config.cnpjConsultante,
          rateLimitPorMinuto: config.rateLimitPorMinuto,
          temCertificado: !!config.certificadoBase64
        }
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
   * PUT /sefaz/configuracao/:empresaId
   * Salva configuração SEFAZ de uma empresa
   */
  fastify.put<{
    Params: { empresaId: string },
    Body: z.infer<typeof ConfiguracaoSefazSchema>
  }>('/configuracao/:empresaId', async (request, reply) => {
    try {
      const { empresaId } = request.params;
      const config = ConfiguracaoSefazSchema.parse(request.body);

      await salvarConfiguracaoSefaz(empresaId, config);

      return {
        success: true,
        message: 'Configuração SEFAZ salva com sucesso'
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
   * GET /sefaz/status
   * Status da integração SEFAZ (para monitoramento)
   */
  fastify.get('/status', async () => {
    return {
      success: true,
      data: {
        servico: 'SEFAZ Integration',
        versao: '1.0.0',
        ambientesSuportados: ['HOMOLOGACAO', 'PRODUCAO'],
        limitesConsulta: {
          porMinuto: 20,
          cacheTtlHoras: 24
        },
        ufsSuportadas: ['SP', 'MG', 'RJ', 'PR', 'RS', 'SVRS (demais)']
      }
    };
  });
}
