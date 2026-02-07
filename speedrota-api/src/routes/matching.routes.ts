/**
 * @fileoverview Rotas de Matching Caixa ↔ NF-e
 * 
 * DESIGN POR CONTRATO:
 * @pre Usuário autenticado
 * @pre Rota deve existir
 * @post Caixas pareadas com NF-e
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as matchingService from '../services/matching.js';
import { analisarImagemNota } from '../services/ocr.js';

// ==========================================
// SCHEMAS
// ==========================================

const caixaSchema = z.object({
  fotoBase64: z.string().optional(),
  pedido: z.string().optional(),
  remessa: z.string().optional(),
  destinatario: z.string().optional(),
  cep: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  itens: z.number().optional(),
  pesoKg: z.number().optional(),
  barcode: z.string().optional(),
});

const matchManualSchema = z.object({
  caixaId: z.string().uuid(),
  paradaId: z.string().uuid(),
});

// ==========================================
// ROTAS
// ==========================================

export async function matchingRoutes(app: FastifyInstance) {
  
  /**
   * POST /api/rotas/:rotaId/caixas
   * Adiciona uma caixa escaneada
   */
  app.post<{
    Params: { rotaId: string };
    Body: z.infer<typeof caixaSchema>;
  }>('/api/rotas/:rotaId/caixas', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const { rotaId } = request.params;
    const dados = caixaSchema.parse(request.body);
    
    try {
      // Se tiver foto e não tiver dados, processar OCR
      let dadosProcessados = { ...dados };
      
      if (dados.fotoBase64 && !dados.pedido && !dados.remessa) {
        // Extrair dados da etiqueta via OCR
        // Reutilizar o serviço de OCR existente com padrões de etiqueta
        const resultado = await processarEtiquetaCaixa(dados.fotoBase64);
        dadosProcessados = {
          ...dadosProcessados,
          ...resultado
        };
      }
      
      const caixaId = await matchingService.salvarCaixa(rotaId, dadosProcessados);
      
      return reply.status(201).send({
        success: true,
        caixaId,
        dados: dadosProcessados
      });
    } catch (error) {
      console.error('[Matching] Erro ao salvar caixa:', error);
      return reply.status(500).send({
        error: 'Erro ao processar caixa',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  /**
   * POST /api/rotas/:rotaId/caixas/lote
   * Adiciona múltiplas caixas de uma vez
   */
  app.post<{
    Params: { rotaId: string };
    Body: { caixas: z.infer<typeof caixaSchema>[] };
  }>('/api/rotas/:rotaId/caixas/lote', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const { rotaId } = request.params;
    const { caixas } = request.body;
    
    const resultados = [];
    
    for (const dados of caixas) {
      try {
        let dadosProcessados = { ...dados };
        
        if (dados.fotoBase64 && !dados.pedido && !dados.remessa) {
          const resultado = await processarEtiquetaCaixa(dados.fotoBase64);
          dadosProcessados = { ...dadosProcessados, ...resultado };
        }
        
        const caixaId = await matchingService.salvarCaixa(rotaId, dadosProcessados);
        resultados.push({ success: true, caixaId });
      } catch (error) {
        resultados.push({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Erro' 
        });
      }
    }
    
    return reply.send({
      total: caixas.length,
      sucesso: resultados.filter(r => r.success).length,
      resultados
    });
  });

  /**
   * GET /api/rotas/:rotaId/caixas
   * Lista caixas de uma rota
   */
  app.get<{
    Params: { rotaId: string };
  }>('/api/rotas/:rotaId/caixas', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const { rotaId } = request.params;
    
    const caixas = await matchingService.listarCaixas(rotaId);
    
    return reply.send({ caixas });
  });

  /**
   * POST /api/rotas/:rotaId/match
   * Executa o matching automático
   */
  app.post<{
    Params: { rotaId: string };
  }>('/api/rotas/:rotaId/match', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const { rotaId } = request.params;
    
    try {
      const matches = await matchingService.executarMatching(rotaId);
      
      return reply.send({
        success: true,
        totalMatches: matches.length,
        matches
      });
    } catch (error) {
      console.error('[Matching] Erro ao executar matching:', error);
      return reply.status(500).send({
        error: 'Erro ao executar matching',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  /**
   * GET /api/rotas/:rotaId/matches
   * Busca matches de uma rota
   */
  app.get<{
    Params: { rotaId: string };
  }>('/api/rotas/:rotaId/matches', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const { rotaId } = request.params;
    
    const matches = await matchingService.buscarMatches(rotaId);
    
    return reply.send({ matches });
  });

  /**
   * POST /api/rotas/:rotaId/match/manual
   * Match manual entre caixa e parada
   */
  app.post<{
    Params: { rotaId: string };
    Body: z.infer<typeof matchManualSchema>;
  }>('/api/rotas/:rotaId/match/manual', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const dados = matchManualSchema.parse(request.body);
    
    try {
      const resultado = await matchingService.matchManual(dados.caixaId, dados.paradaId);
      
      return reply.send({
        success: true,
        match: resultado
      });
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : 'Erro ao fazer match manual'
      });
    }
  });

  /**
   * DELETE /api/rotas/:rotaId/match/:paradaId
   * Remove match de uma parada
   */
  app.delete<{
    Params: { rotaId: string; paradaId: string };
  }>('/api/rotas/:rotaId/match/:paradaId', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const { paradaId } = request.params;
    
    await matchingService.removerMatch(paradaId);
    
    return reply.send({ success: true });
  });

  // ==========================================
  // PREPARAÇÃO DE ROTAS (Armazenista ↔ Motorista)
  // ==========================================

  /**
   * POST /api/rotas/:rotaId/preparar
   * Armazenista marca rota como preparada
   */
  app.post<{
    Params: { rotaId: string };
  }>('/api/rotas/:rotaId/preparar', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const { rotaId } = request.params;
    const userId = request.user?.id;
    
    if (!userId) {
      return reply.status(401).send({ error: 'Usuário não autenticado' });
    }
    
    try {
      await matchingService.prepararRota(rotaId, userId);
      
      return reply.send({ 
        success: true,
        message: 'Rota marcada como preparada'
      });
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : 'Erro ao preparar rota'
      });
    }
  });

  /**
   * GET /api/rotas/preparadas
   * Lista rotas preparadas disponíveis para download
   */
  app.get('/api/rotas/preparadas', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const userId = request.user?.id;
    
    if (!userId) {
      return reply.status(401).send({ error: 'Usuário não autenticado' });
    }
    
    const rotas = await matchingService.buscarRotasPreparadas(userId);
    
    return reply.send({ rotas });
  });

  /**
   * POST /api/rotas/:rotaId/baixar
   * Motorista baixa (assume) uma rota preparada
   */
  app.post<{
    Params: { rotaId: string };
  }>('/api/rotas/:rotaId/baixar', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const { rotaId } = request.params;
    const userId = request.user?.id;
    
    if (!userId) {
      return reply.status(401).send({ error: 'Usuário não autenticado' });
    }
    
    try {
      const rota = await matchingService.baixarRota(rotaId, userId);
      
      return reply.send({
        success: true,
        message: 'Rota baixada com sucesso',
        rota
      });
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : 'Erro ao baixar rota'
      });
    }
  });

  /**
   * GET /api/rotas/:rotaId/status-preparacao
   * Verifica status de preparação de uma rota
   */
  app.get<{
    Params: { rotaId: string };
  }>('/api/rotas/:rotaId/status-preparacao', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const { rotaId } = request.params;
    
    try {
      const status = await matchingService.verificarStatusPreparacao(rotaId);
      
      return reply.send(status);
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : 'Erro ao verificar status'
      });
    }
  });
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

/**
 * Processa OCR de etiqueta de caixa
 * Extrai: PED, REM, destinatário, CEP, itens, peso
 */
async function processarEtiquetaCaixa(fotoBase64: string): Promise<Partial<matchingService.DadosCaixa>> {
  try {
    // Reutilizar o OCR existente
    const resultado = await analisarImagemNota(fotoBase64);
    
    if (!resultado || !resultado.sucesso) {
      return { textoRaw: '', confianca: 0 };
    }
    
    const texto = resultado.textoExtraido || '';
    
    // Extrair dados específicos de etiqueta
    const dados: Partial<matchingService.DadosCaixa> = {
      textoRaw: texto,
      confianca: resultado.confianca || 0
    };
    
    // Padrões de etiqueta Natura/Avon
    
    // PED (Pedido): 842324648
    const pedMatch = texto.match(/PED[:\s]*(\d{8,12})/i);
    if (pedMatch) dados.pedido = pedMatch[1];
    
    // REM (Remessa): 246832970
    const remMatch = texto.match(/REM[:\s]*(\d{8,12})/i);
    if (remMatch) dados.remessa = remMatch[1];
    
    // SubRota: 0246832970
    const subRotaMatch = texto.match(/(?:SUB\s*ROTA|SUBROTA)[:\s]*(\d{10,14})/i);
    if (subRotaMatch && !dados.remessa) {
      dados.remessa = subRotaMatch[1];
    }
    
    // Destinatário: nome antes ou depois de CEP
    const nomeMatch = texto.match(/(?:DEST|DESTINAT[ÁA]RIO)[:\s]*([A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{5,50})/i);
    if (nomeMatch) dados.destinatario = nomeMatch[1].trim();
    
    // CEP
    const cepMatch = texto.match(/\d{5}[-\s]?\d{3}/);
    if (cepMatch) dados.cep = cepMatch[0].replace(/\s/g, '');
    
    // Itens: "9 itens" ou "Itens: 9"
    const itensMatch = texto.match(/(?:ITENS?|QTD)[:\s]*(\d{1,3})|(\d{1,3})\s*(?:ITENS?|PCS)/i);
    if (itensMatch) dados.itens = parseInt(itensMatch[1] || itensMatch[2]);
    
    // Peso: "1.605 kg" ou "Peso: 1,605"
    const pesoMatch = texto.match(/(?:PESO)[:\s]*(\d+[.,]\d+)|(\d+[.,]\d+)\s*(?:KG|KILOS?)/i);
    if (pesoMatch) {
      const pesoStr = (pesoMatch[1] || pesoMatch[2]).replace(',', '.');
      dados.pesoKg = parseFloat(pesoStr);
    }
    
    // Código de barras
    const barcodeMatch = texto.match(/\d{12,20}/);
    if (barcodeMatch) dados.barcode = barcodeMatch[0];
    
    return dados;
  } catch (error) {
    console.error('[Matching] Erro ao processar etiqueta:', error);
    return { textoRaw: '', confianca: 0 };
  }
}

export default matchingRoutes;
