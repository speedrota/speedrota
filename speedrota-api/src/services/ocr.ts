/**
 * @fileoverview Serviço de OCR para extração de dados de notas fiscais
 * 
 * @description Usa Tesseract.js para extrair texto de imagens e identificar
 *              chaves de acesso de 44 dígitos e endereços.
 *              Versão 3.0 com worker pool para melhor performance.
 * 
 * @pre Imagem em base64 válida (JPEG, PNG)
 * @post Texto extraído + chave de acesso (se encontrada)
 */

import Tesseract, { createWorker, Worker } from 'tesseract.js';
import sharp from 'sharp';
import path from 'path';

// ==========================================
// WORKER POOL PARA PERFORMANCE OTIMIZADA
// ==========================================

/**
 * Singleton do worker Tesseract para evitar criar/destruir a cada OCR
 * PERFORMANCE: Criar worker = ~2-3s, reutilizar = ~100-300ms
 */
let ocrWorker: Worker | null = null;
let workerInitPromise: Promise<Worker> | null = null;

async function getOcrWorker(): Promise<Worker> {
  // Se já existe worker inicializado, retorna
  if (ocrWorker) {
    return ocrWorker;
  }
  
  // Se está inicializando, aguarda
  if (workerInitPromise) {
    return workerInitPromise;
  }
  
  // Inicializa novo worker
  console.log('[OCR] Inicializando worker Tesseract (singleton)...');
  const startTime = Date.now();
  
  workerInitPromise = (async () => {
    const worker = await createWorker('por', 1, {
      logger: m => {
        if (m.status === 'loading tesseract core') {
          console.log('[OCR] Carregando Tesseract core...');
        } else if (m.status === 'loading language traineddata') {
          console.log('[OCR] Carregando dados do idioma português...');
        }
      }
    });
    
    ocrWorker = worker;
    console.log(`[OCR] Worker inicializado em ${Date.now() - startTime}ms`);
    return worker;
  })();
  
  return workerInitPromise;
}

// Cleanup ao encerrar o processo
process.on('beforeExit', async () => {
  if (ocrWorker) {
    console.log('[OCR] Encerrando worker Tesseract...');
    await ocrWorker.terminate();
    ocrWorker = null;
  }
});

// ==========================================
// CIDADES CONHECIDAS COM CORREÇÃO OCR
// ==========================================
const CIDADES_CONHECIDAS: Record<string, { nome: string; uf: string; cepPrefixos: string[] }> = {
  // São Paulo interior
  'AMERICANA': { nome: 'AMERICANA', uf: 'SP', cepPrefixos: ['134'] },
  'AMERICANS': { nome: 'AMERICANA', uf: 'SP', cepPrefixos: ['134'] },
  'AMERIC4NA': { nome: 'AMERICANA', uf: 'SP', cepPrefixos: ['134'] },
  'AMER1CANA': { nome: 'AMERICANA', uf: 'SP', cepPrefixos: ['134'] },
  'CAMPINAS': { nome: 'CAMPINAS', uf: 'SP', cepPrefixos: ['130', '131'] },
  'CAMP1NAS': { nome: 'CAMPINAS', uf: 'SP', cepPrefixos: ['130', '131'] },
  'LIMEIRA': { nome: 'LIMEIRA', uf: 'SP', cepPrefixos: ['134'] },
  'L1MEIRA': { nome: 'LIMEIRA', uf: 'SP', cepPrefixos: ['134'] },
  'PIRACICABA': { nome: 'PIRACICABA', uf: 'SP', cepPrefixos: ['134'] },
  'SUMARE': { nome: 'SUMARE', uf: 'SP', cepPrefixos: ['138'] },
  'HORTOLANDIA': { nome: 'HORTOLANDIA', uf: 'SP', cepPrefixos: ['132'] },
  'SANTA BARBARA': { nome: 'SANTA BARBARA', uf: 'SP', cepPrefixos: ['134'] },
  'INDAIATUBA': { nome: 'INDAIATUBA', uf: 'SP', cepPrefixos: ['133'] },
  'JUNDIAI': { nome: 'JUNDIAI', uf: 'SP', cepPrefixos: ['132'] },
  'SOROCABA': { nome: 'SOROCABA', uf: 'SP', cepPrefixos: ['180'] },
  'PAULINIA': { nome: 'PAULINIA', uf: 'SP', cepPrefixos: ['130'] },
  'VALINHOS': { nome: 'VALINHOS', uf: 'SP', cepPrefixos: ['131'] },
  'VINHEDO': { nome: 'VINHEDO', uf: 'SP', cepPrefixos: ['131'] },
  'ITATIBA': { nome: 'ITATIBA', uf: 'SP', cepPrefixos: ['131'] },
  'CABREUVA': { nome: 'CABREUVA', uf: 'SP', cepPrefixos: ['131'] },
  'NOVA ODESSA': { nome: 'NOVA ODESSA', uf: 'SP', cepPrefixos: ['134'] },
  // Capitais
  'SAO PAULO': { nome: 'SAO PAULO', uf: 'SP', cepPrefixos: ['01', '02', '03', '04', '05', '08'] },
  'S4O PAULO': { nome: 'SAO PAULO', uf: 'SP', cepPrefixos: ['01', '02', '03', '04', '05', '08'] },
  'RIO DE JANEIRO': { nome: 'RIO DE JANEIRO', uf: 'RJ', cepPrefixos: ['20', '21', '22', '23'] },
  'BELO HORIZONTE': { nome: 'BELO HORIZONTE', uf: 'MG', cepPrefixos: ['30', '31'] },
  'CURITIBA': { nome: 'CURITIBA', uf: 'PR', cepPrefixos: ['80', '81', '82'] },
  'PORTO ALEGRE': { nome: 'PORTO ALEGRE', uf: 'RS', cepPrefixos: ['90', '91'] },
  'SALVADOR': { nome: 'SALVADOR', uf: 'BA', cepPrefixos: ['40', '41'] },
  'FORTALEZA': { nome: 'FORTALEZA', uf: 'CE', cepPrefixos: ['60'] },
  'RECIFE': { nome: 'RECIFE', uf: 'PE', cepPrefixos: ['50', '51', '52'] },
  'BRASILIA': { nome: 'BRASILIA', uf: 'DF', cepPrefixos: ['70', '71', '72', '73'] },
  'MANAUS': { nome: 'MANAUS', uf: 'AM', cepPrefixos: ['69'] },
  'BELEM': { nome: 'BELEM', uf: 'PA', cepPrefixos: ['66'] },
  'GOIANIA': { nome: 'GOIANIA', uf: 'GO', cepPrefixos: ['74'] },
  'GUARULHOS': { nome: 'GUARULHOS', uf: 'SP', cepPrefixos: ['07'] },
  'OSASCO': { nome: 'OSASCO', uf: 'SP', cepPrefixos: ['06'] },
  'SANTOS': { nome: 'SANTOS', uf: 'SP', cepPrefixos: ['110'] },
  'SANTO ANDRE': { nome: 'SANTO ANDRE', uf: 'SP', cepPrefixos: ['09'] },
  'SAO BERNARDO': { nome: 'SAO BERNARDO DO CAMPO', uf: 'SP', cepPrefixos: ['09'] },
};

/**
 * Resultado da análise OCR
 */
export interface OcrResult {
  sucesso: boolean;
  textoExtraido?: string;
  confianca?: number;
  chaveAcesso?: string;
  tipoDocumento?: string;
  fornecedor?: string;  // Fornecedor detectado: MERCADOLIVRE_AMAZON, SHOPEE, TIKTOK_KWAI, NATURA_AVON, NATURA_AVON_CAIXA
  destinatario?: {
    nome?: string;
  };
  endereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
    enderecoCompleto?: string;
  };
  notaFiscal?: {
    numero?: string;
    serie?: string;
    dataEmissao?: string;
    valorTotal?: number;
    chaveAcesso?: string;
  };
  dadosAdicionais?: {
    nomeDestinatario?: string;
    enderecoDestinatario?: string;
    valorTotal?: number;
    dataEmissao?: string;
  };
  // Campos específicos de etiqueta de caixa Natura/Avon
  caixa?: {
    numero?: number;         // CX 002/003 -> 2
    total?: number;          // CX 002/003 -> 3
    itens?: number;          // 2 ITENS -> 2
    pesoKg?: number;         // 0,784 KG -> 0.784
    pedido?: string;         // PED 842707084
    remessa?: string;        // REM 246998110
    subRota?: string;        // SR ou subrota
  };
  erro?: string;
}

// ==========================================
// LIMPEZA DE TEXTO OCR (v3.0 - Anti-Moiré)
// ==========================================

/**
 * Limpa texto OCR removendo ruído comum de fotos de celular
 * @pre texto bruto do Tesseract
 * @post texto limpo com correções aplicadas
 */
function limparTextoOCR(texto: string): string {
  let limpo = texto;
  
  // 1. Remover sequências de caracteres aleatórios (ruído moiré)
  // Padrões como "EAR NAT RAE Ar RES" são ruído
  limpo = limpo.replace(/([A-Z]{1,3}\s){4,}/g, ''); // Sequências de 1-3 letras soltas
  
  // 2. Corrigir substituições comuns de OCR
  const correcoes: Record<string, string> = {
    // Números confundidos com letras
    '0': ['O', 'o', 'Q'],
    '1': ['I', 'l', '|', 'i'],
    '2': ['Z'],
    '4': ['A'],
    '5': ['S', 's'],
    '6': ['G', 'b'],
    '7': ['T'],
    '8': ['B'],
    '9': ['g', 'q'],
  };
  
  // 3. Limpar caracteres especiais estranhos
  limpo = limpo.replace(/[—–―]/g, '-'); // Diferentes tipos de traço
  limpo = limpo.replace(/[''´`]/g, "'"); // Diferentes tipos de apóstrofo
  limpo = limpo.replace(/[""„]/g, '"'); // Diferentes tipos de aspas
  limpo = limpo.replace(/[^\w\sáéíóúàèìòùâêîôûãõçÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÃÕÇ.,\-\/\\:;()\[\]@#$%&*+=!?\n\r]/gi, ' ');
  
  // 4. Remover espaços múltiplos
  limpo = limpo.replace(/[ \t]{2,}/g, ' ');
  
  // 5. Remover linhas com apenas pontuação/símbolos
  limpo = limpo.split('\n').filter(linha => {
    const apenasSimbolos = /^[\s\-_|.,;:!?(){}[\]@#$%&*+=\\/<>]*$/.test(linha);
    return !apenasSimbolos && linha.trim().length > 0;
  }).join('\n');
  
  return limpo;
}

/**
 * Corrige erros de OCR em CEP (muito comum em fotos de celular)
 * @pre texto com possível CEP corrompido
 * @post CEP corrigido ou original
 */
function corrigirCEP(texto: string): string {
  // Substituições de letras por números em CEP
  const mapaSubstituicao: Record<string, string> = {
    'O': '0', 'o': '0', 'Q': '0',
    'I': '1', 'l': '1', '|': '1', 'i': '1',
    'Z': '2', 'z': '2',
    'A': '4',
    'S': '5', 's': '5',
    'G': '6', 'b': '6',
    'T': '7',
    'B': '8',
    'g': '9', 'q': '9',
  };
  
  // Padrão flexível para CEP (pode ter letras confundidas)
  return texto.replace(/(\d{2}[\dOoQIl|iZzASsGbTBgq]{3})\s*-?\s*(\d{0,1}[\dOoQIl|iZzASsGbTBgq]{2,3})/g, (match, p1, p2) => {
    let cep = (p1 + p2).toUpperCase();
    for (const [letra, numero] of Object.entries(mapaSubstituicao)) {
      cep = cep.replace(new RegExp(letra, 'g'), numero);
    }
    if (cep.length === 8 && /^\d{8}$/.test(cep)) {
      return cep.slice(0, 5) + '-' + cep.slice(5);
    }
    return match;
  });
}

// ==========================================
// VERIFICAÇÃO DE QUALIDADE OCR
// ==========================================

const PALAVRAS_CHAVE_NFE = [
  // Nota Fiscal / DANFE
  'destinatario',
  'danfe',
  'nota fiscal',
  'chave de acesso',
  'valor total',
  // Endereço
  'rua',
  'avenida',
  'bairro',
  'cidade',
  'cep',
  'endereco',
  // Etiquetas de caixa (Natura/Avon/MercadoLivre)
  'ped',
  'rem',
  'sr',
  'pedido',
  'remessa',
  'subrota',
  'nome:',
  'dest:',
  'destinatário'
];

/**
 * Verifica se o texto extraído contém palavras-chave de NF-e
 * @pre texto limpo
 * @post true se encontrou pelo menos 2 palavras-chave
 */
function verificarQualidadeOCR(texto: string): boolean {
  const textoLower = texto.toLowerCase();
  const encontradas = PALAVRAS_CHAVE_NFE.filter(p => textoLower.includes(p));
  console.log(`[OCR] Palavras-chave encontradas: ${encontradas.length} (${encontradas.join(', ')})`);
  return encontradas.length >= 2;
}

/**
 * Valida se o endereço extraído é válido (não é lixo de OCR)
 * VERSÃO TOLERANTE - aceita mais, rejeita menos
 * @pre endereço extraído
 * @post true se parece um endereço real
 */
function validarEnderecoExtraido(endereco: OcrResult['endereco']): boolean {
  if (!endereco) return false;
  
  // Deve ter pelo menos logradouro OU cep OU cidade
  const temLogradouro = endereco.logradouro && endereco.logradouro.length > 5;
  const temCep = endereco.cep && /^\d{5}-?\d{3}$/.test(endereco.cep);
  const temCidade = endereco.cidade && endereco.cidade.length > 2;
  const temBairro = endereco.bairro && endereco.bairro.length > 2;
  
  console.log(`[OCR Validação] Logradouro: ${temLogradouro ? endereco.logradouro : 'não'}, CEP: ${temCep ? endereco.cep : 'não'}, Cidade: ${temCidade ? endereco.cidade : 'não'}, Bairro: ${temBairro ? endereco.bairro : 'não'}`);
  
  // Aceita se tem pelo menos 2 componentes válidos OU logradouro com número
  if (temLogradouro) {
    // Se tem logradouro, já é minimamente válido
    console.log('[OCR] Endereço aceito: tem logradouro');
    return true;
  }
  
  if (temCep && temCidade) {
    console.log('[OCR] Endereço aceito: tem CEP + cidade');
    return true;
  }
  
  if (temBairro && temCidade) {
    console.log('[OCR] Endereço aceito: tem bairro + cidade');
    return true;
  }
  
  if (temCidade) {
    console.log('[OCR] Endereço aceito: tem cidade');
    return true;
  }
  
  if (temCep) {
    console.log('[OCR] Endereço aceito: tem CEP');
    return true;
  }
  
  console.log('[OCR] Endereço rejeitado: sem dados mínimos');
  return false;
}

/**
 * Aplica rotação à imagem usando Sharp
 * @pre buffer da imagem, graus ∈ {90, 180, 270}
 * @post buffer da imagem rotacionada
 */
async function rotacionarImagem(imageBuffer: Buffer, graus: number): Promise<Buffer> {
  return sharp(imageBuffer)
    .rotate(graus)
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1.5 })
    .png()
    .toBuffer();
}

/**
 * Executa OCR em um buffer de imagem
 * @pre buffer válido
 * @post resultado do Tesseract
 * 
 * OTIMIZAÇÃO v3.0: Usa worker singleton para evitar criar/destruir a cada OCR
 * Isso reduz tempo de ~3s para ~200ms em chamadas subsequentes
 */
async function executarOCR(imageBuffer: Buffer): Promise<Tesseract.RecognizeResult> {
  const startTime = Date.now();
  
  // Usa worker singleton em vez de Tesseract.recognize
  const worker = await getOcrWorker();
  
  console.log(`[OCR] Worker obtido em ${Date.now() - startTime}ms`);
  
  const result = await worker.recognize(imageBuffer);
  
  console.log(`[OCR] Reconhecimento completo em ${Date.now() - startTime}ms`);
  
  return result;
}

/**
 * Extrai chave de acesso de 44 dígitos do texto
 * 
 * @pre texto não vazio
 * @post chave de 44 dígitos se encontrada, null caso contrário
 */
function extrairChave44Digitos(texto: string): string | null {
  // Remove espaços e caracteres não numéricos
  const apenasNumeros = texto.replace(/[^0-9]/g, '');
  
  // Se tem exatamente 44 dígitos, retorna
  if (apenasNumeros.length === 44) {
    return apenasNumeros;
  }
  
  // Procura substring de 44 dígitos com UF válida (11-53)
  if (apenasNumeros.length >= 44) {
    for (let i = 0; i <= apenasNumeros.length - 44; i++) {
      const possibleKey = apenasNumeros.substring(i, i + 44);
      const uf = parseInt(possibleKey.substring(0, 2), 10);
      // UFs brasileiras vão de 11 a 53
      if (uf >= 11 && uf <= 53) {
        return possibleKey;
      }
    }
    // Se não encontrou UF válida, retorna os primeiros 44
    return apenasNumeros.substring(0, 44);
  }
  
  return null;
}

// ==========================================
// NORMALIZAÇÃO DE TEXTO
// ==========================================

function normalizarTexto(texto: string): string {
  return texto
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ==========================================
// EXTRAÇÃO ETIQUETA DE CAIXA NATURA/AVON
// Formato específico de etiquetas coladas nas caixas
// ==========================================

interface DadosEtiquetaCaixa {
  // Identificação da caixa
  caixaNumero?: number;      // CX 002/003 -> 2
  caixaTotal?: number;       // CX 002/003 -> 3
  itens?: number;            // 2 ITENS -> 2
  pesoKg?: number;           // 0,784 KG -> 0.784
  codigoCd?: string;         // MIK
  
  // Datas e tipo
  dataPlanejada?: string;    // DT.PLANO: 06/02/26
  dataPrevista?: string;     // DT.PREV: 10/02/26
  tipoEntrega?: string;      // ENTREGA PADRAO
  
  // Identificadores principais
  pedido?: string;           // PED 842707084
  remessa?: string;          // REM 246998110
  subRota?: string;          // SR ou subrota
  
  // Destinatário
  nome?: string;             // THAIS GALDEANO DOS SANTOS
  endereco?: string;         // R DAS JABUTICABEIRAS
  numero?: string;           // 240
  bairro?: string;           // RESIDENCIAL VALE DAS NOGUEIRAS
  cidade?: string;           // AMERICANA
  uf?: string;               // SP
  cep?: string;              // 13474-378
  
  // Operacional
  regiao?: string;           // CN
  centroDistribuicao?: string; // WARECLOUDS AMERICANA
}

/**
 * Parser especializado para ETIQUETAS DE CAIXA Natura/Avon
 * 
 * Formato típico:
 * CX 002 / 003
 * 2 ITENS
 * 0,784 KG     [MIK]
 * DT.PLANO: 06/02/26
 * DT.PREV: 10/02/26    ENTREGA PADRAO
 * PED 842707084
 * REM 246998110
 * THAIS GALDEANO DOS SANTOS
 * R DAS JABUTICABEIRAS 240
 * RESIDENCIAL VALE DAS NOGUEIRAS
 * SP SP AMERICANA
 * CEP 13474-378    [CN]
 * 
 * @pre texto OCR de etiqueta de caixa
 * @post dados estruturados da etiqueta
 */
function extrairEtiquetaCaixaNatura(texto: string): DadosEtiquetaCaixa | null {
  console.log('[Parser] Tentando extração Etiqueta Caixa Natura...');
  
  const textoNorm = texto.toUpperCase();
  
  // Detectar se é etiqueta de caixa (tem PED e REM)
  const temPED = /\bPED\s*[:\s]*\d{6,12}/i.test(texto);
  const temREM = /\bREM\s*[:\s]*\d{6,12}/i.test(texto);
  const temCX = /\bCX\s*\d{1,3}\s*[\/\\]\s*\d{1,3}/i.test(texto);
  
  if (!temPED && !temREM) {
    console.log('[Parser Etiqueta] Não parece ser etiqueta de caixa (sem PED/REM)');
    return null;
  }
  
  console.log('[Parser Etiqueta] Detectado formato etiqueta de caixa Natura');
  
  const dados: DadosEtiquetaCaixa = {};
  
  // === CX 002 / 003 (número da caixa / total) ===
  const cxMatch = texto.match(/\bCX\s*(\d{1,3})\s*[\/\\]\s*(\d{1,3})/i);
  if (cxMatch) {
    dados.caixaNumero = parseInt(cxMatch[1], 10);
    dados.caixaTotal = parseInt(cxMatch[2], 10);
    console.log(`[Parser Etiqueta] Caixa: ${dados.caixaNumero}/${dados.caixaTotal}`);
  }
  
  // === ITENS ===
  const itensMatch = texto.match(/\b(\d{1,3})\s*ITEN[S]?\b/i);
  if (itensMatch) {
    dados.itens = parseInt(itensMatch[1], 10);
    console.log(`[Parser Etiqueta] Itens: ${dados.itens}`);
  }
  
  // === PESO (0,784 KG) ===
  const pesoMatch = texto.match(/\b(\d{1,3})[,.](\d{1,3})\s*KG\b/i);
  if (pesoMatch) {
    dados.pesoKg = parseFloat(`${pesoMatch[1]}.${pesoMatch[2]}`);
    console.log(`[Parser Etiqueta] Peso: ${dados.pesoKg} kg`);
  }
  
  // === CÓDIGO CD (MIK, etc) ===
  const cdMatch = texto.match(/\b(MIK|WAR|CD[A-Z0-9]{1,5})\b/i);
  if (cdMatch) {
    dados.codigoCd = cdMatch[1].toUpperCase();
    console.log(`[Parser Etiqueta] CD: ${dados.codigoCd}`);
  }
  
  // === PED (pedido) ===
  const pedMatch = texto.match(/\bPED\s*[:\s]*(\d{6,12})/i);
  if (pedMatch) {
    dados.pedido = pedMatch[1];
    console.log(`[Parser Etiqueta] PED: ${dados.pedido}`);
  }
  
  // === REM (remessa) ===
  const remMatch = texto.match(/\bREM\s*[:\s]*(\d{6,12})/i);
  if (remMatch) {
    dados.remessa = remMatch[1];
    console.log(`[Parser Etiqueta] REM: ${dados.remessa}`);
  }
  
  // === SubRota (SR) ===
  const srMatch = texto.match(/\bSR\s*[:\s]*(\d{1,6})/i);
  if (srMatch) {
    dados.subRota = srMatch[1];
    console.log(`[Parser Etiqueta] SR: ${dados.subRota}`);
  }
  
  // === DT.PLANO ===
  const dtPlanoMatch = texto.match(/DT\.?\s*PLANO\s*[:\s]*(\d{2}\/\d{2}\/\d{2,4})/i);
  if (dtPlanoMatch) {
    dados.dataPlanejada = dtPlanoMatch[1];
    console.log(`[Parser Etiqueta] DT.PLANO: ${dados.dataPlanejada}`);
  }
  
  // === DT.PREV ===
  const dtPrevMatch = texto.match(/DT\.?\s*PREV\s*[:\s]*(\d{2}\/\d{2}\/\d{2,4})/i);
  if (dtPrevMatch) {
    dados.dataPrevista = dtPrevMatch[1];
    console.log(`[Parser Etiqueta] DT.PREV: ${dados.dataPrevista}`);
  }
  
  // === TIPO ENTREGA ===
  const entregaMatch = texto.match(/ENTREGA\s+(PADRAO|NORMAL|EXPRESSA|URGENTE|PRIORITARIA)/i);
  if (entregaMatch) {
    dados.tipoEntrega = entregaMatch[1].toUpperCase();
    console.log(`[Parser Etiqueta] Tipo Entrega: ${dados.tipoEntrega}`);
  }
  
  // === CEP (primeiro, para ajudar validação de cidade) ===
  const cepMatch = texto.match(/CEP\s*[:\s]*(\d{5})-?(\d{3})/i) ||
                   texto.match(/\b(\d{5})-(\d{3})\b/);
  if (cepMatch) {
    dados.cep = `${cepMatch[1]}-${cepMatch[2]}`;
    console.log(`[Parser Etiqueta] CEP: ${dados.cep}`);
  }
  
  // === CIDADE e UF ===
  // Formato: "SP SP AMERICANA" ou "SP AMERICANA" ou "AMERICANA SP"
  const cidadePatterns = [
    /\b([A-Z]{2})\s+\1?\s*(AMERICANA|CAMPINAS|SUMARE|LIMEIRA|PIRACICABA|SANTA BARBARA|NOVA ODESSA|HORTOLANDIA|PAULINIA|INDAIATUBA|RIO CLARO|JUNDIAI|VALINHOS|VINHEDO|ITATIBA)\b/i,
    /\b(AMERICANA|CAMPINAS|SUMARE|LIMEIRA|PIRACICABA|SANTA BARBARA|NOVA ODESSA|HORTOLANDIA|PAULINIA|INDAIATUBA|RIO CLARO|JUNDIAI|VALINHOS|VINHEDO|ITATIBA)\s*[-\/]?\s*([A-Z]{2})\b/i,
    /\b([A-Z]{2})\s+(AMERICANA|CAMPINAS|SUMARE|LIMEIRA|PIRACICABA|SANTA BARBARA|NOVA ODESSA|HORTOLANDIA|PAULINIA|INDAIATUBA|RIO CLARO|JUNDIAI|VALINHOS|VINHEDO|ITATIBA)\b/i,
  ];
  
  for (const p of cidadePatterns) {
    const m = texto.match(p);
    if (m) {
      // Determinar qual grupo é UF e qual é cidade
      if (m[1].length === 2 && /^[A-Z]{2}$/.test(m[1])) {
        dados.uf = m[1].toUpperCase();
        dados.cidade = m[2].toUpperCase();
      } else {
        dados.cidade = m[1].toUpperCase();
        dados.uf = m[2]?.toUpperCase() || 'SP';
      }
      console.log(`[Parser Etiqueta] Cidade: ${dados.cidade}, UF: ${dados.uf}`);
      break;
    }
  }
  
  // Se não encontrou cidade pelo padrão, tentar AMERICANA direto
  if (!dados.cidade && textoNorm.includes('AMERICANA')) {
    dados.cidade = 'AMERICANA';
    dados.uf = 'SP';
    console.log('[Parser Etiqueta] Cidade AMERICANA detectada diretamente');
  }
  
  // === BAIRRO/RESIDENCIAL ===
  const bairroPatterns = [
    /\b(RESIDENCIAL\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ\s]{3,30})/i,
    /\b(JD\.?\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ\s]{3,20})/i,
    /\b(JARDIM\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ\s]{3,20})/i,
    /\b(VILA\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ\s]{3,20})/i,
    /\b(PARQUE\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ\s]{3,20})/i,
    /\b(CHACARA\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ\s]{3,20})/i,
  ];
  
  for (const p of bairroPatterns) {
    const m = texto.match(p);
    if (m) {
      dados.bairro = m[1].trim().toUpperCase();
      console.log(`[Parser Etiqueta] Bairro: ${dados.bairro}`);
      break;
    }
  }
  
  // === ENDEREÇO (R/RUA/AV + nome + número) ===
  const enderecoPatterns = [
    /\b(R(?:UA)?\.?\s+(?:DAS?\s+)?[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕA-Za-záéíóúâêîôûãõ\s]{2,30})\s+(\d{1,5})\b/i,
    /\b(AV(?:ENIDA)?\.?\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕA-Za-záéíóúâêîôûãõ\s]{2,30})\s+(\d{1,5})\b/i,
  ];
  
  for (const p of enderecoPatterns) {
    const m = texto.match(p);
    if (m) {
      dados.endereco = m[1].trim().toUpperCase();
      dados.numero = m[2];
      console.log(`[Parser Etiqueta] Endereço: ${dados.endereco}, ${dados.numero}`);
      break;
    }
  }
  
  // === NOME DO DESTINATÁRIO ===
  // Procurar nome que vem ANTES do endereço (padrão Natura)
  // Nome = sequência de 2+ palavras maiúsculas sem números
  const nomePatterns = [
    // Nome seguido de R/RUA (próxima linha é endereço)
    /\b([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ]{2,}(?:\s+(?:DOS?|DAS?|DE|DA)?\s*[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ]{2,}){1,4})\s*\n?\s*R(?:UA)?\.?\s/i,
    // Nome com 2-5 palavras capitalizadas
    /\b([A-Z][a-záéíóúâêîôûãõ]+(?:\s+(?:dos?|das?|de|da)?\s*[A-Z][a-záéíóúâêîôûãõ]+){1,4})\s/,
  ];
  
  for (const p of nomePatterns) {
    const m = texto.match(p);
    if (m) {
      const nomeCandidate = m[1].trim();
      // Validar que não é parte do endereço ou outros campos
      if (nomeCandidate.length > 5 && 
          !nomeCandidate.includes('ENTREGA') &&
          !nomeCandidate.includes('PADRAO') &&
          !nomeCandidate.includes('RESIDENCIAL') &&
          !nomeCandidate.includes('WARECLOUDS')) {
        dados.nome = nomeCandidate.toUpperCase();
        console.log(`[Parser Etiqueta] Nome: ${dados.nome}`);
        break;
      }
    }
  }
  
  // === REGIÃO (CN, SUL, NORTE, etc) ===
  const regiaoMatch = texto.match(/\b(CN|CS|SU|NO|NE|SE|CO)\b/);
  if (regiaoMatch) {
    dados.regiao = regiaoMatch[1].toUpperCase();
    console.log(`[Parser Etiqueta] Região: ${dados.regiao}`);
  }
  
  // === CENTRO DE DISTRIBUIÇÃO ===
  const cdDistMatch = texto.match(/WARECLOUDS?\s+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ]+)/i);
  if (cdDistMatch) {
    dados.centroDistribuicao = `WARECLOUDS ${cdDistMatch[1]}`;
    console.log(`[Parser Etiqueta] Centro Distribuição: ${dados.centroDistribuicao}`);
  }
  
  // Verificar se extraiu dados mínimos
  const temDadosMinimos = dados.pedido || dados.remessa || 
                          (dados.endereco && dados.cidade) ||
                          (dados.cep && dados.nome);
  
  if (!temDadosMinimos) {
    console.log('[Parser Etiqueta] Dados insuficientes extraídos');
    return null;
  }
  
  console.log('[Parser Etiqueta] Dados extraídos:', JSON.stringify(dados, null, 2));
  return dados;
}

// ==========================================
// EXTRAÇÃO ESPECÍFICA NATURA/AVON (PORTADA DO WEB)
// ==========================================

interface DadosExtraidosNatura {
  nome?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  referencia?: string;
}

function extrairDadosNaturaAvon(texto: string): DadosExtraidosNatura {
  console.log('[Parser] Tentando extração Natura/Avon...');
  
  const dados: DadosExtraidosNatura = {};
  const textoUpper = texto.toUpperCase();
  
  // Padrão específico: "Destino AMERICANA" ou "Destine Americans" (com erros de OCR)
  const padroesDestino = [
    /DESTIN[OEA]\s+([A-Z]{4,})/i,
    /DESTE[SNS]\s+([A-Z]{4,})/i,
  ];
  
  for (const p of padroesDestino) {
    const m = texto.match(p);
    if (m) {
      const cidadeRaw = m[1].trim().toUpperCase().split(/\s+/)[0];
      const cidadeCorrigida = corrigirCidade(cidadeRaw);
      if (cidadeCorrigida) {
        console.log(`[Parser] Cidade encontrada via Destino: ${cidadeRaw} -> ${cidadeCorrigida}`);
        dados.cidade = cidadeCorrigida;
        dados.uf = 'SP';
        break;
      }
    }
  }
  
  // Se não encontrou, buscar AMERICANA diretamente no texto
  if (!dados.cidade) {
    const isLojaAmericanas = textoUpper.includes('LOJAS AMERICANAS') || 
                              textoUpper.includes('AMERICANAS S.A') || 
                              textoUpper.includes('AMERICANAS SA') ||
                              textoUpper.includes('AMERICANAS LTDA');
    
    if (!isLojaAmericanas && 
        (textoUpper.includes('AMERICANA') || textoUpper.includes('AMERICANS') || 
        textoUpper.includes('AMAR CANA') || textoUpper.includes('AMARCANA'))) {
      dados.cidade = 'AMERICANA';
      dados.uf = 'SP';
      console.log('[Parser] Cidade AMERICANA detectada no texto');
    }
  }
  
  // REFERÊNCIA: Detectar UNIMED/HOSPITAL
  if (textoUpper.includes('UNIMED') || textoUpper.includes('MOSPITAL UNIMED')) {
    dados.referencia = 'EM FRENTE AO HOSPITAL UNIMED';
    console.log('[Parser] Referência UNIMED detectada');
  }
  
  // ==========================================
  // EXTRAÇÃO REAL DO ENDEREÇO
  // ==========================================
  
  // Padrão 1: "R DOUTOR JOAO ZANAGA , 600" ou "RUA DOUTOR JOAO ZANAGA, 600"
  const padroesEndereco = [
    // RUA/R seguido de nome de rua e número
    /\b(R(?:UA)?\.?\s+(?:DOUTOR|DR\.?|PROFESSOR|PROF\.?|MAJOR|CORONEL|CAP)?\s*[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{3,40})[,\s]+(\d{1,5})\b/gi,
    // AV/AVENIDA seguido de nome e número
    /\b(AV(?:ENIDA)?\.?\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{3,40})[,\s]+(\d{1,5})\b/gi,
    // Qualquer logradouro genérico
    /\b((?:ALAMEDA|TRAVESSA|PRAÇA|ESTRADA|RODOVIA|VIA)\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{3,40})[,\s]+(\d{1,5})\b/gi,
  ];
  
  // Usar matchAll para encontrar TODAS as ocorrências (emitente E destinatário)
  enderecoLoop: for (const p of padroesEndereco) {
    const matches = [...texto.matchAll(p)];
    for (const m of matches) {
      const enderecoExtraido = m[1].trim().toUpperCase();
      const numeroExtraido = m[2];
      // Verificar se não é o endereço do remetente (NATURA em CABREUVA)
      // O endereço do emitente geralmente contém: TOLEDO, PINTO TOLEDO, CABREUVA, PINHAL
      if (!enderecoExtraido.includes('TOLEDO') && 
          !enderecoExtraido.includes('CABREUVA') &&
          !enderecoExtraido.includes('PINHAL') &&
          !enderecoExtraido.includes('LAURO')) {
        dados.endereco = enderecoExtraido;
        dados.numero = numeroExtraido;
        console.log(`[Parser] Endereço extraído: ${enderecoExtraido}, ${numeroExtraido}`);
        break enderecoLoop;
      } else {
        console.log(`[Parser] Endereço ignorado (emitente): ${enderecoExtraido}`);
      }
    }
  }
  
  // Padrão CEP: 13478-220 ou 13478220 (CEPs de Americana região)
  const cepMatch = texto.match(/\b(\d{5})-?(\d{3})\b/);
  if (cepMatch) {
    dados.cep = `${cepMatch[1]}-${cepMatch[2]}`;
    console.log(`[Parser] CEP extraído: ${dados.cep}`);
  }
  
  // Padrão bairro
  const bairroMatch = texto.match(/\b(CHACARA\s+MACHADINHO(?:\s+II)?|JD\.?\s+\w+|JARDIM\s+\w+|VILA\s+\w+|PARQUE\s+\w+|CENTRO)\b/i);
  if (bairroMatch && !dados.bairro) {
    dados.bairro = bairroMatch[1].toUpperCase();
    console.log(`[Parser] Bairro extraído: ${dados.bairro}`);
  }
  
  // Tentar encontrar complemento (AP xx BLOCO x)
  const padroesApto = [
    /AP\.?\s*(\d{1,4})/i,
    /APT\.?\s*(\d{1,4})/i,
    /APTO\.?\s*(\d{1,4})/i,
    /A[PF]\.?\s*(\d{2,4})\b/i,
  ];
  
  const padroesBloco = [
    /BLOCO?\s*([A-Z0-9]{1,2})\b/i,
    /BL\.?\s*([A-Z0-9]{1,2})\b/i,
  ];
  
  let apto = '';
  let bloco = '';
  
  for (const p of padroesApto) {
    const m = texto.match(p);
    if (m) {
      apto = m[1];
      break;
    }
  }
  
  for (const p of padroesBloco) {
    const m = texto.match(p);
    if (m) {
      bloco = m[1].toUpperCase();
      break;
    }
  }
  
  if (apto || bloco) {
    const partes = [];
    if (apto) partes.push(`AP ${apto}`);
    if (bloco) partes.push(`BLOCO ${bloco}`);
    dados.complemento = partes.join(' ');
    console.log(`[Parser] Complemento: ${dados.complemento}`);
  }
  
  // Tentar encontrar nome do destinatário
  const padroesNome = [
    /\b((?:MARIA|ANA|ELLEN|HELEN|SUZILAINE|SUZI|SUELI|SANDRA|SILVIA|SIMONE|SOLANGE|SONIA|ROSELI|ROSA|REGINA|PATRICIA|PAULA|LUCIANA|LUCIA|JULIANA|JOANA|IVONE|IVANA|HELENA|GABRIELA|FERNANDA|ELIANA|ELAINE|EDILAINE|DANIELA|CRISTINA|CLAUDIA|CARLA|CAMILA|BEATRIZ|BIANCA|ADRIANA|AMANDA|ANDREIA|ANGELA|APARECIDA|JOSE|JOAO|CARLOS|ANTONIO|MARCOS|PAULO|PEDRO|LUCAS|FERNANDO|RAFAEL|ROBERTO|RICARDO|ANDERSON|ALEX|ALEXANDRE|BRUNO|DIEGO|EDUARDO|FABIO|GUSTAVO|HENRIQUE|IGOR|LEANDRO|LUIZ|MARCELO|MATEUS|NELSON|RENATO|RODRIGO|SERGIO|THIAGO|VITOR|WAGNER)\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{3,40})/i,
    /NOME[:\s]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{5,40})/i,
  ];
  
  for (const p of padroesNome) {
    const m = texto.match(p);
    if (m) {
      let nome = m[1].trim();
      if (/^(REMETENT|DESTINAT|ENDERECO|ENDEREÇO|NOTA|FISCAL|DANFE|TRIBUT)/i.test(nome)) {
        continue;
      }
      nome = nome.replace(/\s*(CPF|CNPJ|RUA|AV|ENDERECO|ENDEREÇO|CEP|BAIRRO|\d{3}\.\d{3}\.\d{3}).*$/i, '');
      if (nome.length >= 5 && nome.length <= 50) {
        dados.nome = nome;
        console.log(`[Parser] Nome encontrado: ${nome}`);
        break;
      }
    }
  }
  
  console.log('[Parser] Dados Natura extraídos:', JSON.stringify(dados, null, 2));
  return dados;
}

// Corrigir cidade com erros de OCR
function corrigirCidade(cidadeRaw: string): string {
  const upper = cidadeRaw.toUpperCase().trim();
  
  const correcoes: Record<string, string> = {
    'AMERICANA': 'AMERICANA',
    'AMERICANS': 'AMERICANA',
    'AMERIC4NA': 'AMERICANA',
    'AMER1CANA': 'AMERICANA',
    'AMAR CANA': 'AMERICANA',
    'AMARCANA': 'AMERICANA',
    'CAMPINAS': 'CAMPINAS',
    'CAMP1NAS': 'CAMPINAS',
    'SAO PAULO': 'SAO PAULO',
    'S4O PAULO': 'SAO PAULO',
    'LIMEIRA': 'LIMEIRA',
    'L1MEIRA': 'LIMEIRA',
    'PIRACICABA': 'PIRACICABA',
    'SUMARE': 'SUMARE',
    'HORTOLANDIA': 'HORTOLANDIA',
    'SANTA BARBARA': 'SANTA BARBARA',
    'INDAIATUBA': 'INDAIATUBA',
    'JUNDIAI': 'JUNDIAI',
    'SOROCABA': 'SOROCABA',
  };
  
  if (correcoes[upper]) {
    return correcoes[upper];
  }
  
  for (const [erro, correto] of Object.entries(correcoes)) {
    if (upper.includes(erro) || erro.includes(upper)) {
      return correto;
    }
  }
  
  return '';
}

// ==========================================
// PARSERS ESPECÍFICOS POR FORNECEDOR/PLATAFORMA
// ==========================================

interface DadosExtraidosFornecedor {
  fornecedor?: string;
  nome?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  enderecoCompleto?: string;
  
  // Campos específicos de etiqueta de caixa Natura/Avon
  pedido?: string;           // PED 842707084
  remessa?: string;          // REM 246998110
  subRota?: string;          // SR ou subrota
  caixaNumero?: number;      // CX 002/003 -> 2
  caixaTotal?: number;       // CX 002/003 -> 3
  itens?: number;            // 2 ITENS -> 2
  pesoKg?: number;           // 0,784 KG -> 0.784
}

/**
 * Parser para Mercado Livre e Amazon (DANFE Padrão Retrato)
 * 
 * Âncora: "DESTINATÁRIO" ou "DESTINATÁRIO / REMETENTE"
 * O endereço está na 2ª e 3ª linha abaixo dessa palavra
 * CEP #####-### marca o fim do bloco
 * 
 * @pre texto OCR contendo DANFE padrão
 * @post dados do destinatário extraídos
 */
function extrairMercadoLivreAmazon(texto: string): DadosExtraidosFornecedor | null {
  console.log('[Parser] Tentando extração Mercado Livre/Amazon (DANFE padrão)...');
  
  // Padrões de âncora para seção DESTINATÁRIO
  const ancorasDestinatario = [
    /DESTINAT[ÁA]RIO\s*[\/\\]\s*REMETENTE/i,
    /DESTINAT[ÁA]RIO[\s\S]{0,20}REMETENTE/i,
    /DADOS\s+DO\s+DESTINAT[ÁA]RIO/i,
    /DESTINAT[ÁA]RIO/i,
  ];
  
  let posicaoAncora = -1;
  let textoAposAncora = '';
  
  for (const ancora of ancorasDestinatario) {
    const match = texto.match(ancora);
    if (match && match.index !== undefined) {
      posicaoAncora = match.index + match[0].length;
      textoAposAncora = texto.substring(posicaoAncora, posicaoAncora + 500);
      console.log(`[Parser ML/Amazon] Âncora encontrada: "${match[0]}"`);
      break;
    }
  }
  
  if (!textoAposAncora) {
    console.log('[Parser ML/Amazon] Âncora DESTINATÁRIO não encontrada');
    return null;
  }
  
  const dados: DadosExtraidosFornecedor = { fornecedor: 'MERCADOLIVRE_AMAZON' };
  
  // Dividir em linhas e pegar as próximas linhas relevantes
  const linhas = textoAposAncora.split(/\n/).map(l => l.trim()).filter(l => l.length > 3);
  console.log(`[Parser ML/Amazon] Linhas após âncora: ${linhas.slice(0, 5).join(' | ')}`);
  
  // Linha 1: Nome do destinatário (geralmente após "Nome/Razão Social")
  // Linha 2-3: Endereço
  for (let i = 0; i < Math.min(5, linhas.length); i++) {
    const linha = linhas[i];
    
    // Detectar nome
    if (!dados.nome && /^[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]+$/.test(linha) && linha.length > 5 && linha.length < 60) {
      // Verificar que não é um campo de formulário
      if (!/^(NOME|ENDERECO|RUA|BAIRRO|CEP|CIDADE|UF|CNPJ|CPF|INSCR)/i.test(linha)) {
        dados.nome = linha;
        continue;
      }
    }
    
    // Detectar endereço (RUA, AV, AL, etc.)
    if (!dados.endereco && /^(R(?:UA)?\.?|AV(?:ENIDA)?\.?|AL(?:AMEDA)?\.?|TV|TRAV|EST(?:RADA)?|ROD)/i.test(linha)) {
      // Extrair logradouro e número
      const matchEnd = linha.match(/^(.+?)[,\s]+(\d{1,5})(?:\s|,|$)/);
      if (matchEnd) {
        dados.endereco = matchEnd[1].trim();
        dados.numero = matchEnd[2];
      } else {
        dados.endereco = linha;
      }
      continue;
    }
    
    // Detectar CEP (marca final do bloco)
    const cepMatch = linha.match(/(\d{5})-?(\d{3})/);
    if (cepMatch) {
      dados.cep = `${cepMatch[1]}-${cepMatch[2]}`;
      
      // Tentar extrair cidade-UF do mesmo contexto
      const cidadeUfMatch = linha.match(/(\d{5}-?\d{3})\s+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]+?)[\s\-\/]+([A-Z]{2})\b/);
      if (cidadeUfMatch) {
        dados.cidade = cidadeUfMatch[2].trim();
        dados.uf = cidadeUfMatch[3];
      }
      break; // CEP marca fim do bloco
    }
    
    // Detectar bairro
    if (!dados.bairro && /^(JD\.?|JARDIM|VILA|VL\.?|PARQUE|PQ\.?|CENTRO|BAIRRO)/i.test(linha)) {
      dados.bairro = linha.replace(/^BAIRRO[:\s]*/i, '').trim();
    }
  }
  
  // Se não encontrou cidade, buscar no texto geral
  if (!dados.cidade) {
    const cidadeMatch = textoAposAncora.match(/([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{3,25})\s*[\-\/]\s*([A-Z]{2})\b/);
    if (cidadeMatch) {
      dados.cidade = cidadeMatch[1].trim();
      dados.uf = cidadeMatch[2];
    }
  }
  
  console.log('[Parser ML/Amazon] Dados extraídos:', JSON.stringify(dados, null, 2));
  return (dados.endereco || dados.cidade || dados.cep) ? dados : null;
}

/**
 * Parser para Shopee (DANFE Simplificado / Etiqueta)
 * 
 * Âncora: "DADOS DO DESTINATÁRIO" ou "DESTINATÁRIO"
 * Geralmente fica na metade inferior da etiqueta
 * Logo acima do código de barras de postagem
 * 
 * @pre texto OCR contendo DANFE simplificado Shopee
 * @post dados do destinatário extraídos
 */
function extrairShopee(texto: string): DadosExtraidosFornecedor | null {
  console.log('[Parser] Tentando extração Shopee (DANFE simplificado)...');
  
  // Detectar se é Shopee
  if (!texto.toUpperCase().includes('SHOPEE') && 
      !texto.toUpperCase().includes('SHOPPE') &&
      !texto.toUpperCase().includes('SPX') &&
      !texto.toUpperCase().includes('XPRESS')) {
    console.log('[Parser Shopee] Não parece ser nota Shopee');
    return null;
  }
  
  const ancorasShopee = [
    /DADOS\s+DO\s+DESTINAT[ÁA]RIO/i,
    /DESTINAT[ÁA]RIO/i,
    /ENTREGAR\s+PARA/i,
    /ENVIAR\s+PARA/i,
  ];
  
  let textoAposAncora = '';
  
  for (const ancora of ancorasShopee) {
    const match = texto.match(ancora);
    if (match && match.index !== undefined) {
      textoAposAncora = texto.substring(match.index + match[0].length, match.index + match[0].length + 400);
      console.log(`[Parser Shopee] Âncora encontrada: "${match[0]}"`);
      break;
    }
  }
  
  if (!textoAposAncora) {
    // Tentar pegar metade inferior do texto
    const metade = Math.floor(texto.length / 2);
    textoAposAncora = texto.substring(metade);
    console.log('[Parser Shopee] Usando metade inferior do texto');
  }
  
  const dados: DadosExtraidosFornecedor = { fornecedor: 'SHOPEE' };
  
  // Extrair endereço completo em uma linha
  const enderecoCompleto = textoAposAncora.match(/([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][^\n]{10,100}?\d{1,5}[^\n]*\d{5}-?\d{3})/);
  if (enderecoCompleto) {
    dados.enderecoCompleto = enderecoCompleto[1].trim();
  }
  
  // Extrair componentes
  const cepMatch = textoAposAncora.match(/(\d{5})-?(\d{3})/);
  if (cepMatch) {
    dados.cep = `${cepMatch[1]}-${cepMatch[2]}`;
  }
  
  // Endereço com número
  const endMatch = textoAposAncora.match(/\b((?:RUA|R\.?|AVENIDA|AV\.?|ALAMEDA|AL\.?)[^\n,]{5,50})[,\s]+(\d{1,5})\b/i);
  if (endMatch) {
    dados.endereco = endMatch[1].trim();
    dados.numero = endMatch[2];
  }
  
  // Cidade-UF
  const cidadeUfMatch = textoAposAncora.match(/([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{3,25})\s*[\-\/]\s*([A-Z]{2})\b/);
  if (cidadeUfMatch) {
    dados.cidade = cidadeUfMatch[1].trim();
    dados.uf = cidadeUfMatch[2];
  }
  
  // Bairro
  const bairroMatch = textoAposAncora.match(/\b(JD\.?\s+\w+|JARDIM\s+\w+|VILA\s+\w+|PARQUE\s+\w+|CENTRO)\b/i);
  if (bairroMatch) {
    dados.bairro = bairroMatch[1].toUpperCase();
  }
  
  console.log('[Parser Shopee] Dados extraídos:', JSON.stringify(dados, null, 2));
  return (dados.endereco || dados.cidade || dados.cep) ? dados : null;
}

/**
 * Parser para TikTok e Kwai (Declaração de Conteúdo)
 * 
 * Âncora: "ENDEREÇO" dentro do campo "2. DESTINATÁRIO"
 * O texto está entre "ENDEREÇO:" e "CIDADE:"
 * 
 * @pre texto OCR contendo Declaração de Conteúdo
 * @post dados do destinatário extraídos
 */
function extrairTikTokKwai(texto: string): DadosExtraidosFornecedor | null {
  console.log('[Parser] Tentando extração TikTok/Kwai (Declaração de Conteúdo)...');
  
  // Detectar se é TikTok/Kwai
  const isTikTok = texto.toUpperCase().includes('TIKTOK') || 
                   texto.toUpperCase().includes('TIK TOK') ||
                   texto.toUpperCase().includes('KWAI') ||
                   texto.toUpperCase().includes('DECLARACAO DE CONTEUDO') ||
                   texto.toUpperCase().includes('DECLARAÇÃO DE CONTEÚDO');
  
  if (!isTikTok) {
    // Tentar detectar pelo formato da declaração
    const temFormatoDeclaracao = /2\.\s*DESTINAT[ÁA]RIO/i.test(texto) || 
                                  /ENDERECO[:\s]+.*CIDADE[:\s]+/i.test(texto);
    if (!temFormatoDeclaracao) {
      console.log('[Parser TikTok/Kwai] Não parece ser nota TikTok/Kwai');
      return null;
    }
  }
  
  const dados: DadosExtraidosFornecedor = { fornecedor: 'TIKTOK_KWAI' };
  
  // Padrão específico: ENDEREÇO: xxx CIDADE: yyy
  const enderecoMatch = texto.match(/ENDERECO\s*[:\s]\s*(.+?)(?:CIDADE|CEP|BAIRRO|\d{5}-?\d{3})/is);
  if (enderecoMatch) {
    const enderecoBruto = enderecoMatch[1].trim().replace(/\s+/g, ' ');
    console.log(`[Parser TikTok/Kwai] Endereço bruto: ${enderecoBruto}`);
    
    // Extrair número
    const numMatch = enderecoBruto.match(/^(.+?)[,\s]+(\d{1,5})(?:\s|,|$)/);
    if (numMatch) {
      dados.endereco = numMatch[1].trim();
      dados.numero = numMatch[2];
    } else {
      dados.endereco = enderecoBruto;
    }
  }
  
  // CIDADE: xxx
  const cidadeMatch = texto.match(/CIDADE\s*[:\s]\s*([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{2,25})/i);
  if (cidadeMatch) {
    dados.cidade = cidadeMatch[1].trim().toUpperCase();
  }
  
  // UF/ESTADO
  const ufMatch = texto.match(/(?:UF|ESTADO)\s*[:\s]\s*([A-Z]{2})\b/i);
  if (ufMatch) {
    dados.uf = ufMatch[1].toUpperCase();
  }
  
  // CEP
  const cepMatch = texto.match(/CEP\s*[:\s]*(\d{5})-?(\d{3})/i);
  if (cepMatch) {
    dados.cep = `${cepMatch[1]}-${cepMatch[2]}`;
  } else {
    // CEP solto
    const cepSolto = texto.match(/(\d{5})-?(\d{3})/);
    if (cepSolto) {
      dados.cep = `${cepSolto[1]}-${cepSolto[2]}`;
    }
  }
  
  // BAIRRO
  const bairroMatch = texto.match(/BAIRRO\s*[:\s]\s*([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{2,30})/i);
  if (bairroMatch) {
    dados.bairro = bairroMatch[1].trim().toUpperCase();
  }
  
  // NOME/DESTINATÁRIO
  const nomeMatch = texto.match(/(?:DESTINAT[ÁA]RIO|NOME)\s*[:\s]\s*([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{5,50})/i);
  if (nomeMatch) {
    dados.nome = nomeMatch[1].trim();
  }
  
  console.log('[Parser TikTok/Kwai] Dados extraídos:', JSON.stringify(dados, null, 2));
  return (dados.endereco || dados.cidade || dados.cep) ? dados : null;
}

/**
 * Parser Universal - Tenta todos os fornecedores em ordem de especificidade
 * 
 * Ordem:
 * 0. Etiqueta Caixa Natura (formato PED/REM específico)
 * 1. TikTok/Kwai (formato mais específico com campos rotulados)
 * 2. Shopee (tem identificador SPX/SHOPEE)
 * 3. Mercado Livre/Amazon (DANFE padrão)
 * 4. Natura/Avon DANFE (Destino cidade)
 * 
 * @pre texto OCR de qualquer nota
 * @post dados extraídos do melhor parser que funcionou
 */
function extrairDadosUniversal(texto: string): DadosExtraidosFornecedor | null {
  console.log('[Parser Universal] Iniciando tentativa de todos os parsers...');
  
  // 0. Etiqueta de Caixa Natura (mais específico - tem PED/REM)
  const dadosEtiqueta = extrairEtiquetaCaixaNatura(texto);
  if (dadosEtiqueta && (dadosEtiqueta.pedido || dadosEtiqueta.remessa || dadosEtiqueta.endereco)) {
    console.log('[Parser Universal] Sucesso com parser Etiqueta Caixa Natura');
    return {
      fornecedor: 'NATURA_AVON_CAIXA',
      nome: dadosEtiqueta.nome,
      endereco: dadosEtiqueta.endereco,
      numero: dadosEtiqueta.numero,
      bairro: dadosEtiqueta.bairro,
      cidade: dadosEtiqueta.cidade,
      uf: dadosEtiqueta.uf,
      cep: dadosEtiqueta.cep,
      // Campos extras específicos de caixa
      pedido: dadosEtiqueta.pedido,
      remessa: dadosEtiqueta.remessa,
      subRota: dadosEtiqueta.subRota,
      caixaNumero: dadosEtiqueta.caixaNumero,
      caixaTotal: dadosEtiqueta.caixaTotal,
      itens: dadosEtiqueta.itens,
      pesoKg: dadosEtiqueta.pesoKg,
    };
  }
  
  // 1. TikTok/Kwai (mais específico)
  const dadosTikTok = extrairTikTokKwai(texto);
  if (dadosTikTok && (dadosTikTok.endereco || dadosTikTok.cidade)) {
    console.log('[Parser Universal] Sucesso com parser TikTok/Kwai');
    return dadosTikTok;
  }
  
  // 2. Shopee
  const dadosShopee = extrairShopee(texto);
  if (dadosShopee && (dadosShopee.endereco || dadosShopee.cidade)) {
    console.log('[Parser Universal] Sucesso com parser Shopee');
    return dadosShopee;
  }
  
  // 3. Mercado Livre/Amazon (DANFE padrão)
  const dadosML = extrairMercadoLivreAmazon(texto);
  if (dadosML && (dadosML.endereco || dadosML.cidade)) {
    console.log('[Parser Universal] Sucesso com parser Mercado Livre/Amazon');
    return dadosML;
  }
  
  // 4. Natura/Avon (fallback para notas de cosméticos)
  const dadosNatura = extrairDadosNaturaAvon(texto);
  if (dadosNatura && (dadosNatura.endereco || dadosNatura.cidade)) {
    console.log('[Parser Universal] Sucesso com parser Natura/Avon');
    return {
      fornecedor: 'NATURA_AVON',
      nome: dadosNatura.nome,
      endereco: dadosNatura.endereco,
      numero: dadosNatura.numero,
      complemento: dadosNatura.complemento,
      bairro: dadosNatura.bairro,
      cidade: dadosNatura.cidade,
      uf: dadosNatura.uf,
      cep: dadosNatura.cep,
    };
  }
  
  console.log('[Parser Universal] Nenhum parser específico funcionou');
  return null;
}

// ==========================================
// FUNÇÕES AUXILIARES DE EXTRAÇÃO (PORTADAS DO WEB)
// ==========================================

function limparTexto(texto: string): string {
  return texto
    .replace(/^[:\-\/\s]+/, '')
    .replace(/[:\-\/\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extrairEnderecoCompleto(texto: string): string {
  const padroes = [
    // AV BRASIL, 900 ou AV. BRASIL 900 (com ou sem ponto, com ou sem vírgula)
    /(AV[.\s]+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ0-9][A-ZÁÉÍÓÚÂÊÎÔÛÃÕA-Z0-9\s]+[,\s]+\d{1,5})/i,
    // RUA NOME, 123
    /(RUA\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ0-9][A-ZÁÉÍÓÚÂÊÎÔÛÃÕA-Z0-9\s]+[,\s]+\d{1,5})/i,
    // R. NOME 123 ou R NOME 123 (abreviado - COM OU SEM PONTO)
    /(R[.\s]+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ0-9][A-ZÁÉÍÓÚÂÊÎÔÛÃÕA-Z0-9\s]+[,\s]*\d{1,5})/i,
    // Qualquer padrão com AV/RUA seguido de texto
    /((?:AV|AVENIDA|RUA|ALAMEDA|AL|TRAVESSA|TV|ESTRADA|EST|RODOVIA|ROD|PRA[ÇC]A)[.\s]+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕA-Za-z\s]{3,25}[,\s]+\d{1,5})/i,
    // Endereço após label ENDEREÇO:
    /ENDERE[ÇC]O[:\s]+([^\n]{10,50})/i,
    // Logradouro
    /LOGRADOURO[:\s]+([^\n]{10,50})/i,
    // R DOUTOR JOAO ZANAGA , 600 (formato DANFE)
    /\b(R\s+(?:DOUTOR|DR\.?|PROFESSOR|PROF\.?)\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕA-Z\s]{5,30})[,\s]+(\d{1,5})\b/i,
  ];
  
  for (const p of padroes) {
    const m = texto.match(p);
    if (m) {
      let end = m[1] || m[0];
      end = end.trim();
      // Limpar sufixos indesejados
      end = end.replace(/\s*(BAIRRO|CEP|MUNIC|CIDADE|UF|FONE|TEL).*$/i, '');
      // Validar que não é "COSMETICOS" ou similar (nome de empresa) ou remetente
      if (end.toUpperCase().includes('COSMET') || 
          end.toUpperCase().includes('NATURA') ||
          end.toUpperCase().includes('TOLEDO') ||
          end.toUpperCase().includes('CABREUVA')) {
        continue;
      }
      // Normalizar R. para RUA, AV. para AV
      end = end.replace(/^AV\.\s*/i, 'AV ');
      end = end.replace(/^R\.\s*/i, 'RUA ');
      end = end.replace(/^R\s+/i, 'RUA ');
      // Validar tamanho mínimo
      if (end.length > 10) {
        console.log(`[OCR] Endereço extraído: ${end}`);
        return limparTexto(end);
      }
    }
  }
  
  return '';
}

function extrairNumero(texto: string, endereco: string): string {
  // Tentar extrair do endereço primeiro
  if (endereco) {
    const m = endereco.match(/[,\s](\d{1,5})\s*$/);
    if (m) return m[1];
    
    const m2 = endereco.match(/\s(\d{1,5})(?:\s|$)/);
    if (m2) return m2[1];
  }
  
  const padroes = [
    /N[°ºª]?\s*(\d{1,5})\b/i,
    /NUMERO[:\s]*(\d{1,5})\b/i,
    /,\s*(\d{1,5})\s/,
  ];
  
  for (const p of padroes) {
    const m = texto.match(p);
    if (m) return m[1];
  }
  
  return '';
}

function extrairBairroTexto(texto: string): string {
  const padroes = [
    // CHACARA MACHADINHO (específico)
    /\b(CHACARA\s+MACHADINHO(?:\s+II)?)\b/i,
    // BAIRRO: VILA SANTO ANTONIO ou BAIRRO/DISTRITO: xxx
    /BAIRRO[\/\s:]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{3,35})/i,
    // VILA SANTO ANTONIO (standalone)
    /\b(VILA\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{3,25})\b/i,
    // JARDIM xxx ou JD xxx
    /\b(JD\.?\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{3,25})\b/i,
    /\b(JARDIM\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{3,25})\b/i,
    // PARQUE xxx
    /\b(PARQUE\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{3,25})\b/i,
    // CENTRO
    /\b(CENTRO)\b/i,
  ];
  
  for (const p of padroes) {
    const m = texto.match(p);
    if (m) {
      let bairro = limparTexto(m[1]);
      // Remover sufixos
      bairro = bairro.replace(/\s*(CEP|MUNIC|CIDADE|UF|SP|RJ|MG).*$/i, '');
      if (bairro.length >= 3) return bairro;
    }
  }
  
  return '';
}

function extrairCidadeTexto(texto: string): string {
  const textoUpper = texto.toUpperCase();
  
  // Cidades conhecidas (prioridade) - inclui variações com erros de OCR
  const cidadesConhecidas = [
    'AMERICANA', 'AMER1CANA', 'AMERIC4NA',
    'CAMPINAS', 'CAMP1NAS',
    'SAO PAULO', 'SÃO PAULO', 'S4O PAULO',
    'LIMEIRA', 'L1MEIRA',
    'PIRACICABA', 'P1RACICABA',
    'SOROCABA', 'S0ROCABA',
    'JUNDIAI', 'JUNDIAÍ', 'JUNDIA1',
    'SANTOS', 'SANT0S',
    'GUARULHOS', 'GUARUL HOS',
    'OSASCO', '0SASCO',
    'SANTO ANDRE', 'SANTO ANDRÉ',
    'SAO BERNARDO', 'SÃO BERNARDO',
    'RIO DE JANEIRO',
    'BELO HORIZONTE',
    'CURITIBA', 'CUR1TIBA',
    'PORTO ALEGRE',
    'SALVADOR',
    'FORTALEZA',
    'RECIFE',
    'BRASILIA', 'BRASÍLIA',
    'MANAUS',
    'BELEM', 'BELÉM',
    'GOIANIA', 'GOIÂNIA',
    'SANTA BARBARA', 'SANTA BÁRBARA',
    'SUMARE', 'SUMARÉ',
    'NOVA ODESSA',
    'HORTOLANDIA', 'HORTOLÂNDIA',
    'PAULINIA', 'PAULÍNIA',
    'INDAIATUBA',
    'VALINHOS',
    'VINHEDO',
    'ITATIBA',
  ];
  
  // Buscar cidades conhecidas
  for (const cidade of cidadesConhecidas) {
    if (textoUpper.includes(cidade)) {
      // Normalizar para versão sem erros
      return cidade.replace(/[0-9]/g, (d) => {
        const map: Record<string, string> = {'0': 'O', '1': 'I', '4': 'A', '5': 'S'};
        return map[d] || d;
      });
    }
  }
  
  const padroes = [
    // MUNICÍPIO: AMERICANA
    /MUNIC[IÍ1]P[I1]O[:\s]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{3,25})/i,
    // CIDADE: xxx
    /CIDADE[:\s]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{3,25})/i,
    // CIDADE-UF pattern: AMERICANA-SP
    /([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ]{3,20})\s*[\-\/]\s*[A-Z]{2}\b/i,
    // Após CEP: 13465-770 AMERICANA
    /\d{5}-?\d{3}\s+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ]{3,20})/i,
  ];
  
  for (const p of padroes) {
    const m = texto.match(p);
    if (m) {
      let cidade = limparTexto(m[1]);
      cidade = cidade.replace(/\s*(UF|SP|RJ|MG|CEP).*$/i, '');
      if (cidade.length >= 3) return cidade;
    }
  }
  
  return '';
}

function extrairUFTexto(texto: string): string {
  const ufsValidas = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
                      'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
  
  const padroes = [
    /UF[:\s]+([A-Z]{2})\b/i,
    /ESTADO[:\s]+([A-Z]{2})\b/i,
    /[\/-]\s*([A-Z]{2})\s*(?:CEP|$|\n)/i,
    /\b([A-Z]{2})\s+\d{5}-?\d{3}/,
  ];
  
  for (const p of padroes) {
    const m = texto.toUpperCase().match(p);
    if (m && ufsValidas.includes(m[1])) {
      return m[1];
    }
  }
  
  // Buscar UF isolada
  const textoUpper = texto.toUpperCase();
  for (const uf of ufsValidas) {
    const regex = new RegExp(`[\\s\\/\\-]${uf}[\\s,\\.\\n]`);
    if (regex.test(textoUpper)) {
      return uf;
    }
  }
  
  return '';
}

function extrairCEPTexto(texto: string): string {
  const padroes = [
    // CEP: 13465.770 ou CEP: 13465-770 ou CEP 13465770
    /CEP[:\s]*([\d]{5})[.\-\s]?([\d]{3})/i,
    /CEP[:\s]*([\d]{8})/i,
    // Padrão solto 13465-770 ou 13465.770
    /([\d]{5})[.\-]([\d]{3})/,
    // CEP sem separador mas com 8 dígitos seguidos
    /\b([\d]{8})\b/,
  ];
  
  for (const p of padroes) {
    const m = texto.match(p);
    if (m) {
      let cep = (m[1] + (m[2] || '')).replace(/\D/g, '');
      if (cep.length === 8) {
        return `${cep.substring(0, 5)}-${cep.substring(5)}`;
      }
    }
  }
  
  return '';
}

/**
 * Resultado da extração de endereço incluindo fornecedor detectado e dados de caixa
 */
interface EnderecoExtraido {
  endereco?: OcrResult['endereco'];
  fornecedor?: string;
  caixa?: OcrResult['caixa'];
  destinatarioNome?: string;
}

/**
 * Extrai endereço do texto OCR usando patterns comuns de NF-e/DANFE
 * VERSÃO ROBUSTA - Portada do frontend Web
 * 
 * @pre texto não vazio
 * @post objeto com partes do endereço identificadas e fornecedor detectado
 */
function extrairEnderecoComFornecedor(texto: string): EnderecoExtraido {
  let endereco: OcrResult['endereco'] = {};
  let fornecedorDetectado: string | undefined;
  
  console.log('[OCR] Iniciando extração de endereço...');
  console.log(`[OCR] Texto para análise (primeiros 500 chars): ${texto.substring(0, 500)}`);
  
  // ==========================================
  // 0. PRIMEIRO: Tentar parser UNIVERSAL (todos os fornecedores)
  // ==========================================
  const dadosUniversal = extrairDadosUniversal(texto);
  
  // Se encontrou dados via parser específico de fornecedor
  if (dadosUniversal && (dadosUniversal.endereco || dadosUniversal.cidade)) {
    console.log(`[OCR] Usando dados extraídos via parser ${dadosUniversal.fornecedor || 'universal'}`);
    fornecedorDetectado = dadosUniversal.fornecedor;
    
    if (dadosUniversal.endereco) {
      endereco.logradouro = dadosUniversal.endereco;
    }
    if (dadosUniversal.numero) {
      endereco.numero = dadosUniversal.numero;
    }
    if (dadosUniversal.bairro) {
      endereco.bairro = dadosUniversal.bairro;
    }
    if (dadosUniversal.cidade) {
      endereco.cidade = dadosUniversal.cidade;
    }
    if (dadosUniversal.uf) {
      endereco.uf = dadosUniversal.uf;
    }
    if (dadosUniversal.cep) {
      endereco.cep = dadosUniversal.cep;
    }
    if (dadosUniversal.complemento) {
      endereco.complemento = dadosUniversal.complemento;
    }
    
    // Montar endereçoCompleto
    const partes = [
      endereco.logradouro,
      endereco.numero,
      endereco.complemento,
      endereco.bairro,
      endereco.cidade,
      endereco.uf,
      endereco.cep ? `CEP: ${endereco.cep}` : null
    ].filter(Boolean);
    
    if (partes.length >= 2) {
      endereco.enderecoCompleto = partes.join(', ');
      console.log(`[OCR] Endereço montado via ${dadosUniversal.fornecedor}: ${endereco.enderecoCompleto}`);
      
      // Incluir dados de caixa se disponíveis (etiqueta Natura)
      let caixaDados: OcrResult['caixa'] | undefined;
      if (dadosUniversal.pedido || dadosUniversal.remessa || dadosUniversal.caixaNumero) {
        caixaDados = {
          numero: dadosUniversal.caixaNumero,
          total: dadosUniversal.caixaTotal,
          itens: dadosUniversal.itens,
          pesoKg: dadosUniversal.pesoKg,
          pedido: dadosUniversal.pedido,
          remessa: dadosUniversal.remessa,
          subRota: dadosUniversal.subRota,
        };
        console.log(`[OCR] Dados de caixa extraídos: PED=${dadosUniversal.pedido}, REM=${dadosUniversal.remessa}, CX=${dadosUniversal.caixaNumero}/${dadosUniversal.caixaTotal}`);
      }
      
      return { 
        endereco, 
        fornecedor: fornecedorDetectado,
        caixa: caixaDados,
        destinatarioNome: dadosUniversal.nome
      };
    }
  }
  
  // ==========================================
  // 1. Extração genérica (fallback)
  // ==========================================
  console.log('[OCR] Usando extração genérica...');
  
  // 1. Extrair componentes usando funções especializadas
  const logradouroCompleto = extrairEnderecoCompleto(texto);
  const numero = extrairNumero(texto, logradouroCompleto);
  const bairro = extrairBairroTexto(texto);
  const cidade = extrairCidadeTexto(texto);
  const uf = extrairUFTexto(texto);
  const cep = extrairCEPTexto(texto);
  
  console.log(`[OCR] Componentes extraídos - Logradouro: ${logradouroCompleto || 'N/A'}, Número: ${numero || 'N/A'}, Bairro: ${bairro || 'N/A'}, Cidade: ${cidade || 'N/A'}, UF: ${uf || 'N/A'}, CEP: ${cep || 'N/A'}`);
  
  // 2. Montar objeto de endereço
  if (logradouroCompleto) {
    endereco.logradouro = logradouroCompleto;
    // Extrair número do logradouro se não encontrado separado
    if (!numero) {
      const numMatch = logradouroCompleto.match(/[,\s](\d{1,5})\s*$/);
      if (numMatch) {
        endereco.numero = numMatch[1];
      }
    } else {
      endereco.numero = numero;
    }
  }
  
  if (bairro) endereco.bairro = bairro;
  if (cidade) endereco.cidade = cidade;
  if (uf) endereco.uf = uf;
  if (cep) endereco.cep = cep;
  
  // 3. Fallback: buscar seção DESTINATÁRIO do DANFE
  if (!endereco.logradouro && !endereco.bairro) {
    console.log('[OCR] Tentando fallback de seção DESTINATÁRIO...');
    
    // Padrões para seção DESTINATÁRIO de DANFE
    const padroesDestinatario = [
      // Seção DESTINATÁRIO com endereço após
      /DESTINAT[ÁA]RIO[\s\S]{0,100}?(?:Endere[çc]o|Logradouro)?[:\s]*([^\n]+)/i,
      // Linha que começa com endereço após DESTINATÁRIO
      /REMETENTE[\s\S]{50,300}?DESTINAT[ÁA]RIO[\s\S]{0,50}?([A-ZÀ-Ú][\s\S]{10,80})\n/i,
      // Endereço genérico após identificador de seção
      /(?:DADOS DO DESTINAT|DEST\.|RECEBEDOR)[\s\S]{0,100}?([RUA|AV|ALAMEDA|TRAVESSA][^\n]+)/i,
    ];
    
    for (const p of padroesDestinatario) {
      const m = texto.match(p);
      if (m && m[1]) {
        let textoEnd = m[1].trim();
        // Limpar
        textoEnd = textoEnd.replace(/\s+/g, ' ').substring(0, 100);
        console.log(`[OCR] Fallback encontrou: ${textoEnd}`);
        
        if (textoEnd.length > 10 && !textoEnd.includes('REMETENTE') && !textoEnd.includes('EMITENTE')) {
          endereco.enderecoCompleto = textoEnd;
          break;
        }
      }
    }
  }
  
  // 4. Monta endereço completo se tiver informações
  if (endereco.logradouro || endereco.bairro || endereco.cidade) {
    const partes = [
      endereco.logradouro,
      endereco.numero && !endereco.logradouro?.includes(endereco.numero) ? endereco.numero : null,
      endereco.bairro,
      endereco.cidade,
      endereco.uf,
      endereco.cep ? `CEP: ${endereco.cep}` : null
    ].filter(Boolean);
    endereco.enderecoCompleto = partes.join(', ');
    console.log(`[OCR] Endereço montado: ${endereco.enderecoCompleto}`);
  }
  
  return { 
    endereco: Object.keys(endereco).length > 0 ? endereco : undefined,
    fornecedor: fornecedorDetectado
  };
}

/**
 * Extrai nome do destinatário do texto OCR
 * Suporta formatos de NFC-e e DANFE
 * 
 * @pre texto não vazio
 * @post nome do destinatário se encontrado
 */
function extrairDestinatario(texto: string): string | undefined {
  // Padrões ordenados por especificidade (mais específico primeiro)
  const patterns = [
    // DANFE: seção DESTINATÁRIO/REMETENTE com nome completo
    /DESTINAT[ÁA]RIO[\/\s]*REMETENTE[\s\S]*?Nome[\/\s]*Raz[ãa]o Social:?\s*([A-ZÀ-Ú\s]+)/i,
    /DESTINAT[ÁA]RIO[\s\S]*?Nome:?\s*([A-ZÀ-Ú\s]+)/i,
    // Nome após "DEST" ou "DESTINATARIO"
    /DEST(?:INAT[ÁA]RIO)?[:\s]+([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú\s]{5,40})/i,
    // Padrão comum NFC-e
    /CONSUMIDOR:?\s*([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú\s]+)/i,
    /CLIENTE:?\s*([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú\s]+)/i,
    // Nome genérico
    /NOME:?\s*([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú\s]{3,40})/i,
    // Fallback: nome próprio (primeira e última maiúsculas, com espaços)
    /\b([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú]+(?:\s+[A-ZÀ-Ú][A-ZÀ-Úa-zà-ú]+){1,5})\b/
  ];
  
  for (const pattern of patterns) {
    const match = texto.match(pattern);
    if (match && match[1]) {
      const nome = match[1].trim();
      // Valida: nome deve ter pelo menos 2 palavras e não ser termo comum
      const palavras = nome.split(/\s+/).filter(p => p.length > 1);
      const termosIgnorar = ['ENTRADA', 'SAIDA', 'DADOS', 'EMITENTE', 'NOTA', 'FISCAL', 'CONSULTA', 'AUTENTICIDADE'];
      
      if (palavras.length >= 2 && !termosIgnorar.some(t => nome.toUpperCase().includes(t))) {
        return nome.toUpperCase();
      }
    }
  }
  
  return undefined;
}

/**
 * Extrai dados de valor e data da NF-e
 */
function extrairDadosNota(texto: string): Partial<OcrResult['notaFiscal']> {
  const dados: Partial<OcrResult['notaFiscal']> = {};
  
  // Valor total (formato R$ 0.000,00 ou 0.000,00)
  const valorMatch = texto.match(/(?:R\$|VALOR:?|TOTAL:?)\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  if (valorMatch) {
    dados.valorTotal = parseFloat(valorMatch[1].replace(/\./g, '').replace(',', '.'));
  }
  
  // Data (formato DD/MM/YYYY)
  const dataMatch = texto.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (dataMatch) {
    dados.dataEmissao = dataMatch[1];
  }
  
  // Número da NF
  const numeroMatch = texto.match(/(?:NF-?e?|NOTA|N[º°]?):?\s*(\d+)/i);
  if (numeroMatch) {
    dados.numero = numeroMatch[1];
  }
  
  return dados;
}

/**
 * Analisa imagem de nota fiscal via OCR
 * 
 * @pre imagemBase64 é string base64 válida de uma imagem
 * @post OcrResult com dados extraídos ou erro
 * @invariant Usa Tesseract.js com idioma português
 * @throws Erro se imagem inválida ou OCR falhar
 */
export async function analisarImagemNota(imagemBase64: string): Promise<OcrResult> {
  try {
    console.log(`[OCR] Iniciando análise de imagem (tamanho: ${imagemBase64.length} chars)`);
    
    // Validação básica
    if (!imagemBase64 || imagemBase64.length < 100) {
      return {
        sucesso: false,
        erro: 'Imagem inválida ou muito pequena'
      };
    }
    
    // Prepara buffer da imagem
    let imageBuffer: Buffer;
    try {
      // Remove prefixo data:image se existir
      const base64Data = imagemBase64.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    } catch (e) {
      return {
        sucesso: false,
        erro: 'Falha ao decodificar imagem base64'
      };
    }
    
    console.log('[OCR] Pré-processando imagem com Sharp (EXIF + otimização)...');
    
    // PRÉ-PROCESSAMENTO COM SHARP v3.0 (Anti-Moiré):
    // 1. rotate() sem argumentos = aplica correção EXIF automaticamente
    // 2. blur(0.5) = remove moiré de fotos de tela/celular
    // 3. grayscale() = melhor para OCR
    // 4. normalize() = melhora contraste
    // 5. threshold(128) = binarização para texto mais nítido
    // 6. sharpen() = melhora nitidez do texto
    try {
      imageBuffer = await sharp(imageBuffer)
        .rotate() // Aplica orientação EXIF (crítico para fotos de iPhone/Android)
        .blur(0.5) // Anti-moiré: blur leve para remover padrões de interferência
        .grayscale() // Converte para escala de cinza
        .normalize() // Melhora contraste automaticamente
        .threshold(128) // Binarização: texto preto em fundo branco
        .sharpen({ sigma: 1.0 }) // Melhora nitidez do texto (menos agressivo com threshold)
        .png() // Formato sem perdas para OCR
        .toBuffer();
      
      console.log('[OCR] Pré-processamento concluído');
    } catch (sharpError) {
      console.warn('[OCR] Erro no pré-processamento Sharp, usando imagem original:', sharpError);
      // Continua com imagem original se Sharp falhar
    }
    
    console.log('[OCR] Executando Tesseract...');
    
    // Guarda buffer original para tentativas de rotação
    const bufferOriginal = imageBuffer;
    
    // Executa OCR com Tesseract
    let result = await executarOCR(imageBuffer);
    
    let textoExtraido = result.data.text;
    let confianca = result.data.confidence;
    
    console.log(`[OCR] Texto extraído (${textoExtraido.length} chars, confiança: ${confianca}%)`);
    
    // OTIMIZAÇÃO v3.1: Só tenta rotações se:
    // 1. Confiança baixa (< 30%) OU
    // 2. Não encontrou palavras-chave E texto muito curto
    const qualidadeRuim = !verificarQualidadeOCR(textoExtraido);
    const precisaRotacao = confianca < 30 || (qualidadeRuim && textoExtraido.length < 100);
    
    if (precisaRotacao) {
      console.log(`[OCR] Qualidade ruim (conf=${confianca}%, len=${textoExtraido.length}), tentando rotações...`);
      
      // Apenas 90° e 180° (mais comuns em fotos)
      const rotacoes = [90, 180];
      for (const graus of rotacoes) {
        console.log(`[OCR] Tentando rotação de ${graus}°...`);
        try {
          const bufferRotacionado = await rotacionarImagem(bufferOriginal, graus);
          const resultRot = await executarOCR(bufferRotacionado);
          const textoRot = resultRot.data.text;
          const confRot = resultRot.data.confidence;
          
          // Aceita se melhorou confiança OU encontrou palavras-chave
          if (confRot > confianca || verificarQualidadeOCR(textoRot)) {
            console.log(`[OCR] Rotação ${graus}° melhorou! (conf: ${confianca}% -> ${confRot}%)`);
            textoExtraido = textoRot;
            confianca = resultRot.data.confidence;
            break;
          }
        } catch (err) {
          console.warn(`[OCR] Erro na rotação ${graus}°:`, err);
        }
      }
    }
    
    if (!textoExtraido || textoExtraido.trim().length < 10) {
      return {
        sucesso: false,
        textoExtraido,
        confianca,
        erro: 'Não foi possível extrair texto legível da imagem'
      };
    }
    
    // LIMPEZA DE TEXTO OCR (v3.0 - Anti-Moiré)
    console.log('[OCR] Aplicando limpeza de texto OCR...');
    const textoOriginal = textoExtraido;
    textoExtraido = limparTextoOCR(textoExtraido);
    textoExtraido = corrigirCEP(textoExtraido);
    console.log(`[OCR] Texto limpo: ${textoExtraido.length} chars (original: ${textoOriginal.length})`);
    
    // Extrai chave de acesso
    const chaveAcesso = extrairChave44Digitos(textoExtraido);
    
    // Extrai endereço com fornecedor detectado, dados de caixa e nome
    const { 
      endereco: enderecoExtraido, 
      fornecedor, 
      caixa, 
      destinatarioNome 
    } = extrairEnderecoComFornecedor(textoExtraido);
    const endereco = validarEnderecoExtraido(enderecoExtraido) ? enderecoExtraido : undefined;
    
    // Extrai destinatário (usa nome do parser se disponível)
    const nomeDestinatario = destinatarioNome || extrairDestinatario(textoExtraido);
    
    // Extrai dados da nota
    const dadosNota = extrairDadosNota(textoExtraido);
    
    // Detecta tipo de documento
    let tipoDocumento = 'DESCONHECIDO';
    if (caixa?.pedido || caixa?.remessa) {
      tipoDocumento = 'ETIQUETA_CAIXA'; // Novo tipo para etiquetas
    } else if (textoExtraido.includes('NFC-E') || textoExtraido.includes('NFCE')) {
      tipoDocumento = 'NFC-e';
    } else if (textoExtraido.includes('NF-E') || textoExtraido.includes('NFE')) {
      tipoDocumento = 'NF-e';
    } else if (textoExtraido.includes('DANFE')) {
      tipoDocumento = 'DANFE';
    }
    
    console.log(`[OCR] Resultados - Tipo: ${tipoDocumento}, Fornecedor: ${fornecedor || 'genérico'}, Chave: ${chaveAcesso ? 'encontrada' : 'não encontrada'}, Endereço: ${endereco ? 'encontrado' : 'não encontrado'}, Caixa: ${caixa ? `PED=${caixa.pedido} REM=${caixa.remessa}` : 'N/A'}`);
    
    return {
      sucesso: true,
      textoExtraido: textoExtraido.substring(0, 2000), // Limita tamanho
      confianca,
      chaveAcesso: chaveAcesso || undefined,
      tipoDocumento,
      fornecedor, // Fornecedor detectado pelo parser
      destinatario: nomeDestinatario ? { nome: nomeDestinatario } : undefined,
      endereco,
      caixa, // Dados de etiqueta de caixa (se disponíveis)
      notaFiscal: {
        ...dadosNota,
        chaveAcesso: chaveAcesso || undefined
      },
      dadosAdicionais: {
        nomeDestinatario,
        enderecoDestinatario: endereco?.enderecoCompleto,
        valorTotal: dadosNota?.valorTotal,
        dataEmissao: dadosNota?.dataEmissao
      }
    };
    
  } catch (error) {
    console.error('[OCR] Erro:', error);
    const mensagem = error instanceof Error ? error.message : 'Erro desconhecido no OCR';
    return {
      sucesso: false,
      erro: mensagem
    };
  }
}
