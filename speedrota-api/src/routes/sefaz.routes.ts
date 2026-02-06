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
  obterUfDaChave,
  extrairDadosQrCode,
  consultarNfePorQrCode,
  extrairChaveDeBarcode,
  importarQrCodeComoParada
} from '../services/sefaz.js';
import { analisarImagemNota } from '../services/ocr.js';

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

// QR Code / Barcode Schemas
const QrCodeSchema = z.object({
  conteudo: z.string().min(10, 'Conteúdo QR Code muito curto'),
  rotaId: z.string().uuid().optional()
});

const BarcodeSchema = z.object({
  barcode: z.string().min(44, 'Código de barras deve ter pelo menos 44 caracteres'),
  rotaId: z.string().uuid().optional()
});

const ImportarQrCodeSchema = z.object({
  conteudo: z.string().min(10),
  rotaId: z.string().uuid()
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

  // ==========================================
  // QR CODE / BARCODE ROUTES
  // ==========================================

  /**
   * POST /sefaz/qrcode/extrair
   * Extrai dados de um QR Code de NF-e/NFC-e (sem consultar SEFAZ)
   * 
   * @pre conteudo é string com QR Code escaneado
   * @post Retorna chave extraída e tipo de QR Code
   */
  fastify.post<{
    Body: z.infer<typeof QrCodeSchema>
  }>('/qrcode/extrair', async (request, reply) => {
    try {
      const { conteudo } = QrCodeSchema.parse(request.body);
      const resultado = extrairDadosQrCode(conteudo);

      if (!resultado.chaveAcesso) {
        return reply.status(400).send({
          success: false,
          error: 'Formato de QR Code não reconhecido',
          formatos_suportados: [
            'URL NFC-e (chNFe=...)',
            'URL DANFE (chave=...)',
            'Chave pura (44 dígitos)',
            'QR Code NFC-e compacto'
          ]
        });
      }

      return {
        success: true,
        data: {
          tipo: resultado.tipo,
          chaveAcesso: resultado.chaveAcesso,
          urlOrigem: resultado.url || null,
          parametrosExtras: resultado.dados || null,
          componentes: {
            uf: obterUfDaChave(resultado.chaveAcesso),
            modelo: resultado.chaveAcesso.substring(20, 22) === '55' ? 'NF-e' : 'NFC-e'
          }
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
   * POST /sefaz/qrcode/consultar
   * Extrai chave de QR Code e consulta NF-e no SEFAZ
   * 
   * @pre conteudo é QR Code válido com chave de acesso
   * @post Retorna dados completos da NF-e
   */
  fastify.post<{
    Body: z.infer<typeof QrCodeSchema>
  }>('/qrcode/consultar', async (request, reply) => {
    try {
      const { conteudo } = QrCodeSchema.parse(request.body);
      const resultado = await consultarNfePorQrCode(conteudo);

      if (!resultado.sucesso) {
        return reply.status(400).send({
          success: false,
          error: resultado.erro,
          dica: 'Verifique se o QR Code é de uma NF-e/NFC-e válida'
        });
      }

      // Extrair chave e tipo dos dados retornados
      const chaveAcesso = resultado.dados?.chaveAcesso || '';
      const tipoQrCode = resultado.dados?.tipoNfe || 'NF-e';

      return {
        success: true,
        data: {
          nfe: resultado.dados,
          chaveAcesso: chaveAcesso,
          tipoQrCode: tipoQrCode,
          enderecoFormatado: resultado.dados?.destinatario
            ? formatarEnderecoParaGeocoding(resultado.dados.destinatario)
            : null,
          cache: resultado.cache,
          consultaEm: resultado.consultaEm
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
   * POST /sefaz/qrcode/importar
   * Extrai dados de QR Code, consulta SEFAZ e cria parada
   * 
   * @pre QR Code válido e rotaId existente
   * @post Parada criada com endereço do destinatário
   */
  fastify.post<{
    Body: z.infer<typeof ImportarQrCodeSchema>
  }>('/qrcode/importar', async (request, reply) => {
    try {
      const { conteudo, rotaId } = ImportarQrCodeSchema.parse(request.body);
      const resultado = await importarQrCodeComoParada(conteudo, rotaId);

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
          chaveNfe: resultado.chaveNfe,
          nomeDestinatario: resultado.nomeDestinatario,
          endereco: resultado.endereco,
          mensagem: 'QR Code importado com sucesso'
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
   * POST /sefaz/barcode/extrair
   * Extrai chave de acesso de código de barras DANFE
   * 
   * @pre barcode com 44 dígitos (pode ter espaços/hífens)
   * @post Retorna chave de acesso normalizada
   */
  fastify.post<{
    Body: z.infer<typeof BarcodeSchema>
  }>('/barcode/extrair', async (request, reply) => {
    try {
      const { barcode } = BarcodeSchema.parse(request.body);
      const chaveExtraida = extrairChaveDeBarcode(barcode);

      if (!chaveExtraida) {
        return reply.status(400).send({
          success: false,
          error: 'Código de barras inválido',
          dica: 'O código de barras do DANFE deve conter 44 dígitos'
        });
      }

      return {
        success: true,
        data: {
          chaveAcesso: chaveExtraida,
          barcodeOriginal: barcode.substring(0, 20) + '...',
          componentes: {
            uf: obterUfDaChave(chaveExtraida),
            modelo: chaveExtraida.substring(20, 22) === '55' ? 'NF-e' : 'NFC-e',
            cnpjEmitente: chaveExtraida.substring(6, 20)
          }
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
   * POST /sefaz/barcode/importar
   * Extrai chave de barcode, consulta SEFAZ e cria parada
   */
  fastify.post<{
    Body: { barcode: string; rotaId: string }
  }>('/barcode/importar', async (request, reply) => {
    try {
      const { barcode, rotaId } = request.body;
      
      // Extrair e validar barcode
      const chaveExtraida = extrairChaveDeBarcode(barcode);
      if (!chaveExtraida) {
        return reply.status(400).send({
          success: false,
          error: 'Código de barras inválido'
        });
      }

      // Importar usando a chave extraída
      const resultado = await importarNfeComoParada(chaveExtraida, rotaId);

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
          chaveNfe: chaveExtraida,
          mensagem: 'Código de barras importado com sucesso'
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

  // ==========================================
  // ENDPOINTS OCR
  // ==========================================

  /**
   * POST /sefaz/ocr/analisar
   * Analisa imagem de nota fiscal via OCR para extrair dados
   * 
   * @pre Imagem em base64 (JPEG/PNG)
   * @post Dados extraídos: chave de acesso, endereco, destinatário
   */
  fastify.post<{
    Body: { imagem: string }
  }>('/ocr/analisar', async (request, reply) => {
    try {
      const { imagem } = request.body;

      if (!imagem) {
        return reply.status(400).send({
          success: false,
          error: 'Imagem base64 é obrigatória'
        });
      }

      console.log('[SEFAZ OCR] Recebida requisição de análise de imagem');

      const resultado = await analisarImagemNota(imagem);

      if (!resultado.sucesso) {
        return reply.status(400).send({
          success: false,
          error: resultado.erro || 'Falha na análise OCR'
        });
      }

      return {
        success: true,
        data: {
          chaveAcesso: resultado.chaveAcesso,
          tipoDocumento: resultado.tipoDocumento,
          confianca: resultado.confianca,
          destinatario: resultado.destinatario,
          endereco: resultado.endereco,
          notaFiscal: resultado.notaFiscal,
          dadosAdicionais: resultado.dadosAdicionais
        }
      };
    } catch (error) {
      console.error('[SEFAZ OCR] Erro:', error);
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido no OCR';
      return reply.status(500).send({
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
        versao: '1.2.0',
        ambientesSuportados: ['HOMOLOGACAO', 'PRODUCAO'],
        limitesConsulta: {
          porMinuto: 20,
          cacheTtlHoras: 24
        },
        ufsSuportadas: ['SP', 'MG', 'RJ', 'PR', 'RS', 'SVRS (demais)'],
        qrCode: {
          formatosSuportados: [
            'URL NFC-e (chNFe=...)',
            'URL DANFE (chave=...)',
            'Chave pura (44 dígitos)',
            'QR Code NFC-e compacto (p=...)'
          ],
          endpointsDisponiveis: [
            'POST /sefaz/qrcode/extrair',
            'POST /sefaz/qrcode/consultar',
            'POST /sefaz/qrcode/importar',
            'POST /sefaz/barcode/extrair',
            'POST /sefaz/barcode/importar',
            'POST /sefaz/ocr/analisar'
          ]
        }
      }
    };
  });
}
