/**
 * @description Serviço de Matching Caixa ↔ NF-e
 * Pareia etiquetas de caixas com notas fiscais usando algoritmo fuzzy
 * 
 * @pre Caixas e NF-e devem ter sido processadas por OCR
 * @post Suporta N:1 (múltiplas caixas para 1 NF-e)
 * @invariant Score de match >= 30 para ser considerado válido
 */

import { prisma } from '../lib/prisma';
import crypto from 'crypto';

// ============================================================
// TIPOS
// ============================================================

export interface DadosCaixa {
  id?: string;
  fotoBase64?: string;
  pedido?: string;
  remessa?: string;
  destinatario?: string;
  cep?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  itens?: number;
  pesoKg?: number;
  barcode?: string;
  textoRaw?: string;
  confianca?: number;
}

export interface DadosNFe {
  paradaId: string;
  pedido?: string;
  nfe?: string;
  subrota?: string;
  destinatario?: string;
  cep?: string;
  endereco?: string;
  valor?: number;
}

export interface ResultadoMatch {
  caixaId: string;
  paradaId: string;
  score: number;
  tagVisual: string;
  tagCor: number;
  detalhes: {
    scoreRemessa: number;
    scorePedido: number;
    scoreCep: number;
    scoreNome: number;
  };
}

// ============================================================
// ALGORITMO DE MATCHING
// ============================================================

/**
 * Calcula distância de Levenshtein entre duas strings
 * @pre a e b são strings
 * @post retorna número >= 0
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  
  return dp[m][n];
}

/**
 * Compara nomes de forma fuzzy
 * @pre nomes são strings não vazias
 * @post retorna score 0-1
 */
function fuzzyNameMatch(a: string, b: string): number {
  const wordsA = a.toUpperCase().replace(/[^A-Z\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  const wordsB = b.toUpperCase().replace(/[^A-Z\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  
  if (!wordsA.length || !wordsB.length) return 0;
  
  let matches = 0;
  for (const wa of wordsA) {
    for (const wb of wordsB) {
      if (wa === wb) {
        matches += 1;
      } else if (wa.startsWith(wb) || wb.startsWith(wa)) {
        matches += 0.7;
      } else if (levenshtein(wa, wb) <= 2) {
        matches += 0.5;
      }
    }
  }
  
  return Math.min(1, matches / Math.max(wordsA.length, wordsB.length));
}

/**
 * Calcula score de matching entre uma caixa e uma NF-e
 * 
 * Critérios de pontuação:
 * - REM ↔ SubRota: 50 pontos (link mais forte)
 * - PED fuzzy: até 40 pontos
 * - CEP match: 15 pontos
 * - Nome fuzzy: até 20 pontos
 * 
 * @pre caixa e nfe são objetos válidos
 * @post retorna objeto com score total e scores parciais
 */
function calcularScore(caixa: DadosCaixa, nfe: DadosNFe): { total: number; remessa: number; pedido: number; cep: number; nome: number } {
  let scoreRemessa = 0;
  let scorePedido = 0;
  let scoreCep = 0;
  let scoreNome = 0;
  
  // 1. REM ↔ SubRota (50 pontos) - link mais forte
  if (caixa.remessa && nfe.subrota) {
    const remClean = caixa.remessa.replace(/\D/g, '');
    const subClean = nfe.subrota.replace(/\D/g, '');
    if (subClean.includes(remClean) || remClean.includes(subClean)) {
      scoreRemessa = 50;
    }
  }
  
  // 2. PED - fuzzy match (até 40 pontos)
  if (caixa.pedido && nfe.pedido) {
    const pedCaixa = caixa.pedido.replace(/\D/g, '');
    const pedNfe = nfe.pedido.replace(/\D/g, '');
    const diff = levenshtein(pedCaixa, pedNfe);
    
    if (diff === 0) {
      scorePedido = 40;
    } else if (diff <= 2) {
      scorePedido = 25;
    } else if (diff <= 4) {
      scorePedido = 10;
    }
  }
  
  // 3. CEP match (15 pontos)
  if (caixa.cep && nfe.cep) {
    const cepCaixa = caixa.cep.replace(/\D/g, '');
    const cepNfe = nfe.cep.replace(/\D/g, '');
    
    if (cepCaixa === cepNfe) {
      scoreCep = 15;
    } else if (cepCaixa.substring(0, 5) === cepNfe.substring(0, 5)) {
      scoreCep = 8;
    }
  }
  
  // 4. Nome fuzzy (até 20 pontos)
  if (caixa.destinatario && nfe.destinatario) {
    scoreNome = fuzzyNameMatch(caixa.destinatario, nfe.destinatario) * 20;
  }
  
  return {
    total: scoreRemessa + scorePedido + scoreCep + scoreNome,
    remessa: scoreRemessa,
    pedido: scorePedido,
    cep: scoreCep,
    nome: scoreNome
  };
}

/**
 * Gera tag visual para identificação rápida
 * Formato: {NOME3}-{CEP3}-{ITENS2}
 * Ex: PAU-474-09
 * 
 * @pre nome e cep são strings
 * @post retorna tag de 10-12 caracteres
 */
function gerarTagVisual(nome: string, cep: string, itens: number): string {
  const nome3 = (nome || 'XXX').replace(/[^A-Z]/gi, '').substring(0, 3).toUpperCase().padEnd(3, 'X');
  const cep3 = (cep || '000').replace(/\D/g, '').slice(-3).padStart(3, '0');
  const itens2 = String(itens || 0).padStart(2, '0');
  
  return `${nome3}-${cep3}-${itens2}`;
}

/**
 * Cores disponíveis para tags (8 cores)
 */
const CORES_TAG = [
  1, // Laranja #f97316
  2, // Verde #22c55e
  3, // Azul #3b82f6
  4, // Roxo #a855f7
  5, // Pink #ec4899
  6, // Amarelo #eab308
  7, // Teal #14b8a6
  8  // Vermelho #f43f5e
];

// ============================================================
// SERVIÇO PRINCIPAL
// ============================================================

/**
 * Salva uma caixa escaneada no banco
 * @pre rotaId existe
 * @post caixa criada com status PENDENTE
 */
export async function salvarCaixa(rotaId: string, dados: DadosCaixa): Promise<string> {
  const caixa = await prisma.caixaEscaneada.create({
    data: {
      rotaId,
      fotoUrl: dados.fotoBase64,
      pedido: dados.pedido,
      remessa: dados.remessa,
      destinatario: dados.destinatario,
      cep: dados.cep,
      bairro: dados.bairro,
      cidade: dados.cidade,
      uf: dados.uf,
      itens: dados.itens,
      pesoKg: dados.pesoKg,
      barcode: dados.barcode,
      textoRaw: dados.textoRaw,
      confianca: dados.confianca,
      statusOcr: dados.textoRaw ? 'SUCESSO' : 'PENDENTE',
      statusMatch: 'PENDENTE'
    }
  });
  
  return caixa.id;
}

/**
 * Lista caixas de uma rota
 */
export async function listarCaixas(rotaId: string) {
  return prisma.caixaEscaneada.findMany({
    where: { rotaId },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Executa o matching entre caixas e NF-e de uma rota
 * 
 * @pre rotaId existe com caixas e paradas
 * @post Paradas atualizadas com tagVisual e caixaId
 * @post Suporta N:1 (múltiplas caixas para 1 NF-e)
 * @returns Lista de matches encontrados
 */
export async function executarMatching(rotaId: string): Promise<ResultadoMatch[]> {
  // Buscar caixas da rota
  const caixas = await prisma.caixaEscaneada.findMany({
    where: { 
      rotaId,
      statusOcr: 'SUCESSO'
    }
  });
  
  // Buscar paradas (NF-e) da rota
  const paradas = await prisma.parada.findMany({
    where: { rotaId }
  });
  
  if (!caixas.length || !paradas.length) {
    return [];
  }
  
  // ============================================================
  // PASSO 1: Agrupar caixas por PED+REM (mesmo pedido = mesmo grupo)
  // ============================================================
  const gruposCaixas = new Map<string, typeof caixas>();
  
  for (const caixa of caixas) {
    // Chave é PED+REM ou apenas PED se não tiver REM
    const chave = `${caixa.pedido || ''}-${caixa.remessa || ''}`.toLowerCase().trim();
    
    if (!gruposCaixas.has(chave)) {
      gruposCaixas.set(chave, []);
    }
    gruposCaixas.get(chave)!.push(caixa);
  }
  
  console.log(`[Matching] ${caixas.length} caixas agrupadas em ${gruposCaixas.size} grupos`);
  
  // ============================================================
  // PASSO 2: Para cada grupo, encontrar a melhor NF-e
  // ============================================================
  const results: ResultadoMatch[] = [];
  const usedParadas = new Set<string>();
  let colorIndex = 0;
  
  for (const [chaveGrupo, caixasGrupo] of gruposCaixas) {
    // Pular grupo vazio (sem identificação)
    if (chaveGrupo === '-') {
      for (const caixa of caixasGrupo) {
        await prisma.caixaEscaneada.update({
          where: { id: caixa.id },
          data: { statusMatch: 'SEM_MATCH' }
        });
      }
      continue;
    }
    
    // Usar primeira caixa do grupo para matching
    const caixaRef = caixasGrupo[0];
    let bestMatch: { parada: typeof paradas[0]; score: ReturnType<typeof calcularScore> } | null = null;
    
    for (const parada of paradas) {
      // Não bloquear parada já usada - permitir N:1
      // Mas preferir paradas não usadas
      
      const caixaDados: DadosCaixa = {
        pedido: caixaRef.pedido || undefined,
        remessa: caixaRef.remessa || undefined,
        destinatario: caixaRef.destinatario || undefined,
        cep: caixaRef.cep || undefined,
        itens: caixaRef.itens || undefined
      };
      
      const nfeDados: DadosNFe = {
        paradaId: parada.id,
        pedido: parada.pedido || undefined,
        subrota: parada.subrota || undefined,
        destinatario: parada.nome,
        cep: parada.cep || undefined,
        endereco: parada.endereco
      };
      
      const score = calcularScore(caixaDados, nfeDados);
      
      // Preferir paradas não usadas, mas aceitar reusar se score muito alto
      const scoreAjustado = usedParadas.has(parada.id) ? score.total * 0.9 : score.total;
      
      if (score.total >= 30 && (!bestMatch || scoreAjustado > bestMatch.score.total * (usedParadas.has(bestMatch.parada.id) ? 0.9 : 1))) {
        bestMatch = { parada, score };
      }
    }
    
    if (bestMatch) {
      usedParadas.add(bestMatch.parada.id);
      
      const tagVisual = gerarTagVisual(
        caixaRef.destinatario || bestMatch.parada.nome,
        caixaRef.cep || bestMatch.parada.cep || '',
        caixasGrupo.reduce((sum, c) => sum + (c.itens || 0), 0) // Total de itens de todas as caixas
      );
      
      const tagCor = CORES_TAG[colorIndex % CORES_TAG.length];
      colorIndex++;
      
      const grupoCaixaId = crypto.randomUUID();
      const totalCaixas = caixasGrupo.length;
      
      console.log(`[Matching] Grupo "${chaveGrupo}": ${totalCaixas} caixas -> NF-e ${bestMatch.parada.nome}`);
      
      // ============================================================
      // PASSO 3: Atualizar todas as caixas do grupo com mesma tag
      // ============================================================
      for (let i = 0; i < caixasGrupo.length; i++) {
        const caixa = caixasGrupo[i];
        const numeroCaixa = i + 1;
        
        await prisma.caixaEscaneada.update({
          where: { id: caixa.id },
          data: {
            statusMatch: 'PAREADO',
            paradaId: bestMatch.parada.id,
            matchScore: bestMatch.score.total,
            numeroCaixa,
            totalCaixas,
            grupoCaixaId,
            tagVisual: totalCaixas > 1 ? `${tagVisual} (${numeroCaixa}/${totalCaixas})` : tagVisual,
            tagCor
          }
        });
        
        results.push({
          caixaId: caixa.id,
          paradaId: bestMatch.parada.id,
          score: bestMatch.score.total,
          tagVisual: totalCaixas > 1 ? `${tagVisual} (${numeroCaixa}/${totalCaixas})` : tagVisual,
          tagCor,
          detalhes: {
            scoreRemessa: bestMatch.score.remessa,
            scorePedido: bestMatch.score.pedido,
            scoreCep: bestMatch.score.cep,
            scoreNome: bestMatch.score.nome
          }
        });
      }
      
      // Atualizar parada com dados da primeira caixa
      await prisma.parada.update({
        where: { id: bestMatch.parada.id },
        data: {
          tagVisual: totalCaixas > 1 ? `${tagVisual} (${totalCaixas} cx)` : tagVisual,
          tagCor,
          matchScore: bestMatch.score.total,
          caixaId: caixaRef.id, // Referência à primeira caixa
          pedido: caixaRef.pedido,
          remessa: caixaRef.remessa,
          itens: caixasGrupo.reduce((sum, c) => sum + (c.itens || 0), 0), // Total de itens
          pesoKg: caixasGrupo.reduce((sum, c) => sum + (c.pesoKg || 0), 0) // Peso total
        }
      });
    } else {
      // Marcar todas as caixas do grupo como sem match
      for (const caixa of caixasGrupo) {
        await prisma.caixaEscaneada.update({
          where: { id: caixa.id },
          data: { statusMatch: 'SEM_MATCH' }
        });
      }
    }
  }
  
  console.log(`[Matching] Concluído: ${results.length} caixas pareadas`);
  return results;
}

/**
 * Busca matches de uma rota
 */
export async function buscarMatches(rotaId: string) {
  const paradas = await prisma.parada.findMany({
    where: { 
      rotaId,
      tagVisual: { not: null }
    },
    include: {
      caixa: true
    },
    orderBy: { ordem: 'asc' }
  });
  
  return paradas.map(p => ({
    paradaId: p.id,
    tagVisual: p.tagVisual,
    tagCor: p.tagCor,
    matchScore: p.matchScore,
    destinatario: p.nome,
    endereco: p.endereco,
    cep: p.cep,
    ordem: p.ordem,
    itens: p.itens,
    pesoKg: p.pesoKg,
    caixa: p.caixa
  }));
}

/**
 * Remove match manual
 */
export async function removerMatch(paradaId: string): Promise<void> {
  const parada = await prisma.parada.findUnique({
    where: { id: paradaId }
  });
  
  if (!parada) return;
  
  // Limpar parada
  await prisma.parada.update({
    where: { id: paradaId },
    data: {
      tagVisual: null,
      tagCor: null,
      matchScore: null,
      caixaId: null
    }
  });
  
  // Limpar caixa se existir
  if (parada.caixaId) {
    await prisma.caixaEscaneada.update({
      where: { id: parada.caixaId },
      data: {
        statusMatch: 'PENDENTE',
        paradaId: null,
        matchScore: null
      }
    });
  }
}

/**
 * Match manual: pareia uma caixa com uma parada específica
 */
export async function matchManual(caixaId: string, paradaId: string): Promise<ResultadoMatch> {
  const caixa = await prisma.caixaEscaneada.findUnique({ where: { id: caixaId } });
  const parada = await prisma.parada.findUnique({ where: { id: paradaId } });
  
  if (!caixa || !parada) {
    throw new Error('Caixa ou parada não encontrada');
  }
  
  // Remover matches anteriores
  if (parada.caixaId && parada.caixaId !== caixaId) {
    await prisma.caixaEscaneada.update({
      where: { id: parada.caixaId },
      data: { statusMatch: 'PENDENTE', paradaId: null }
    });
  }
  
  // Gerar tag
  const tagVisual = gerarTagVisual(
    caixa.destinatario || parada.nome,
    caixa.cep || parada.cep || '',
    caixa.itens || 0
  );
  
  // Buscar próxima cor disponível
  const usedColors = await prisma.parada.findMany({
    where: { rotaId: parada.rotaId, tagCor: { not: null } },
    select: { tagCor: true }
  });
  const usedSet = new Set(usedColors.map(c => c.tagCor));
  const tagCor = CORES_TAG.find(c => !usedSet.has(c)) || CORES_TAG[0];
  
  // Atualizar parada
  await prisma.parada.update({
    where: { id: paradaId },
    data: {
      tagVisual,
      tagCor,
      matchScore: 100, // Manual = 100%
      caixaId,
      pedido: caixa.pedido,
      remessa: caixa.remessa,
      itens: caixa.itens,
      pesoKg: caixa.pesoKg
    }
  });
  
  // Atualizar caixa
  await prisma.caixaEscaneada.update({
    where: { id: caixaId },
    data: {
      statusMatch: 'PAREADO',
      paradaId,
      matchScore: 100
    }
  });
  
  return {
    caixaId,
    paradaId,
    score: 100,
    tagVisual,
    tagCor,
    detalhes: { scoreRemessa: 0, scorePedido: 0, scoreCep: 0, scoreNome: 0 }
  };
}

// ============================================================
// PREPARAÇÃO DE ROTAS (Armazenista ↔ Motorista)
// ============================================================

/**
 * Armazenista marca rota como preparada (pronta para download)
 * 
 * @pre rotaId existe e tem caixas pareadas
 * @post statusPreparacao = 'PRONTA'
 */
export async function prepararRota(rotaId: string, armazenistaId: string): Promise<void> {
  // Verificar se tem caixas pareadas
  const caixasPareadas = await prisma.caixaEscaneada.count({
    where: { rotaId, statusMatch: 'PAREADO' }
  });
  
  if (caixasPareadas === 0) {
    throw new Error('Rota não tem caixas pareadas para preparar');
  }
  
  await prisma.rota.update({
    where: { id: rotaId },
    data: {
      statusPreparacao: 'PRONTA',
      preparadaPorId: armazenistaId,
      preparadaEm: new Date()
    }
  });
  
  console.log(`[Preparação] Rota ${rotaId} marcada como PRONTA por ${armazenistaId}`);
}

/**
 * Busca rotas preparadas disponíveis para download
 * 
 * @pre userId é motorista
 * @post Lista de rotas com status PRONTA
 */
export async function buscarRotasPreparadas(userId: string) {
  return prisma.rota.findMany({
    where: {
      statusPreparacao: 'PRONTA',
      baixadaPorId: null, // Ainda não baixada
      status: 'RASCUNHO' // Disponível
    },
    include: {
      paradas: {
        select: {
          id: true,
          nome: true,
          endereco: true,
          cidade: true,
          tagVisual: true,
          tagCor: true
        }
      },
      caixas: {
        where: { statusMatch: 'PAREADO' },
        select: {
          id: true,
          pedido: true,
          remessa: true,
          destinatario: true,
          tagVisual: true,
          tagCor: true,
          numeroCaixa: true,
          totalCaixas: true
        }
      }
    },
    orderBy: { preparadaEm: 'desc' }
  });
}

/**
 * Motorista baixa (assume) uma rota preparada
 * 
 * @pre rotaId está com status PRONTA
 * @post Rota vinculada ao motorista
 */
export async function baixarRota(rotaId: string, motoristaId: string) {
  const rota = await prisma.rota.findUnique({
    where: { id: rotaId }
  });
  
  if (!rota) {
    throw new Error('Rota não encontrada');
  }
  
  if (rota.statusPreparacao !== 'PRONTA') {
    throw new Error('Rota não está preparada para download');
  }
  
  if (rota.baixadaPorId && rota.baixadaPorId !== motoristaId) {
    throw new Error('Rota já foi baixada por outro motorista');
  }
  
  // Atualizar rota para o motorista
  const rotaAtualizada = await prisma.rota.update({
    where: { id: rotaId },
    data: {
      userId: motoristaId, // Transfere para o motorista
      baixadaPorId: motoristaId,
      baixadaEm: new Date(),
      status: 'CALCULADA' // Pronta para iniciar
    },
    include: {
      paradas: {
        orderBy: { ordem: 'asc' },
        include: {
          caixa: true
        }
      },
      caixas: {
        where: { statusMatch: 'PAREADO' }
      }
    }
  });
  
  console.log(`[Preparação] Rota ${rotaId} baixada por motorista ${motoristaId}`);
  
  return rotaAtualizada;
}

/**
 * Verifica status de preparação de uma rota
 */
export async function verificarStatusPreparacao(rotaId: string) {
  const rota = await prisma.rota.findUnique({
    where: { id: rotaId },
    select: {
      id: true,
      statusPreparacao: true,
      preparadaPorId: true,
      preparadaEm: true,
      baixadaPorId: true,
      baixadaEm: true,
      _count: {
        select: {
          caixas: true,
          paradas: true
        }
      }
    }
  });
  
  if (!rota) {
    throw new Error('Rota não encontrada');
  }
  
  // Contar caixas pareadas
  const caixasPareadas = await prisma.caixaEscaneada.count({
    where: { rotaId, statusMatch: 'PAREADO' }
  });
  
  return {
    rotaId: rota.id,
    status: rota.statusPreparacao || 'NAO_PREPARADA',
    preparadaPor: rota.preparadaPorId,
    preparadaEm: rota.preparadaEm,
    baixadaPor: rota.baixadaPorId,
    baixadaEm: rota.baixadaEm,
    totalCaixas: rota._count.caixas,
    caixasPareadas,
    totalParadas: rota._count.paradas,
    prontaParaBaixar: rota.statusPreparacao === 'PRONTA' && !rota.baixadaPorId
  };
}

export default {
  salvarCaixa,
  listarCaixas,
  executarMatching,
  buscarMatches,
  removerMatch,
  matchManual,
  // Preparação
  prepararRota,
  buscarRotasPreparadas,
  baixarRota,
  verificarStatusPreparacao
};
