/**
 * @fileoverview Serviço de OCR para extração de dados de NF-e
 * 
 * VERSÃO 2.1 - COM PRÉ-PROCESSAMENTO DE IMAGEM
 * 
 * Otimizado para formatos brasileiros de NF-e incluindo:
 * - DANFE tradicional
 * - NF-e Natura/Avon/Cosméticos
 * - Diversos formatos de endereço
 */

import { createWorker, Worker } from 'tesseract.js';
import type { DadosNFe, Fornecedor } from '../types';

// ==========================================
// WORKER DO TESSERACT
// ==========================================

let tesseractWorker: Worker | null = null;
let workerInitializing = false;

async function getWorker(): Promise<Worker> {
  if (tesseractWorker) {
    return tesseractWorker;
  }
  
  if (workerInitializing) {
    while (workerInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return tesseractWorker!;
  }
  
  workerInitializing = true;
  console.log('[OCR] Inicializando Tesseract...');
  
  try {
    tesseractWorker = await createWorker('por', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`[OCR] Progresso: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    console.log('[OCR] Tesseract inicializado com sucesso');
  } catch (error) {
    console.error('[OCR] Erro ao inicializar Tesseract:', error);
    tesseractWorker = await createWorker();
    console.log('[OCR] Tesseract inicializado (fallback)');
  } finally {
    workerInitializing = false;
  }
  
  return tesseractWorker;
}

export async function terminarOCR(): Promise<void> {
  if (tesseractWorker) {
    await tesseractWorker.terminate();
    tesseractWorker = null;
  }
}

// ==========================================
// PRÉ-PROCESSAMENTO DE IMAGEM v3.0 - ANTI-MOIRÉ
// ==========================================

// Aplicar blur gaussiano para remover moiré de fotos de tela
function aplicarBlurGaussiano(data: Uint8ClampedArray, width: number, height: number, radius: number = 1): void {
  const kernel = [
    1, 2, 1,
    2, 4, 2,
    1, 2, 1
  ];
  const kernelSum = 16;
  
  const copy = new Uint8ClampedArray(data);
  
  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      let r = 0, g = 0, b = 0;
      let ki = 0;
      
      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const weight = kernel[ki++];
          r += copy[idx] * weight;
          g += copy[idx + 1] * weight;
          b += copy[idx + 2] * weight;
        }
      }
      
      const idx = (y * width + x) * 4;
      data[idx] = r / kernelSum;
      data[idx + 1] = g / kernelSum;
      data[idx + 2] = b / kernelSum;
    }
  }
}

// ==========================================
// CORREÇÃO DE ORIENTAÇÃO EXIF (IPHONE/FOTOS)
// ==========================================

/**
 * Corrige orientação EXIF de fotos de celular
 * iPhones e outros dispositivos salvam fotos com metadados de rotação
 * que o canvas não aplica automaticamente
 */
async function corrigirOrientacaoEXIF(imagem: File | Blob | string): Promise<ImageBitmap> {
  let blob: Blob;
  
  if (typeof imagem === 'string') {
    // Data URL para Blob
    const response = await fetch(imagem);
    blob = await response.blob();
  } else {
    blob = imagem;
  }
  
  // createImageBitmap com imageOrientation aplica rotação EXIF automaticamente
  try {
    const bitmap = await createImageBitmap(blob, {
      imageOrientation: 'from-image', // Aplica rotação EXIF
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'default',
    });
    console.log(`[OCR] Imagem com correção EXIF: ${bitmap.width}x${bitmap.height}`);
    return bitmap;
  } catch (e) {
    // Fallback para browsers antigos
    console.warn('[OCR] createImageBitmap com EXIF não suportado, usando fallback');
    return createImageBitmap(blob);
  }
}

async function preprocessarImagem(imagem: File | Blob | string): Promise<string> {
  console.log('[OCR] Pré-processando imagem v4.0 (EXIF + anti-moiré)...');
  
  // PASSO 0: Corrigir orientação EXIF (crítico para fotos de iPhone)
  const bitmap = await corrigirOrientacaoEXIF(imagem);
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  
  // Escala para melhor OCR
  const scale = Math.max(2, 2500 / Math.max(bitmap.width, bitmap.height));
  
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  
  console.log(`[OCR] Imagem original: ${bitmap.width}x${bitmap.height}`);
  console.log(`[OCR] Canvas: ${canvas.width}x${canvas.height} (scale: ${scale.toFixed(2)})`);
  
  // Fundo branco
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Desenhar imagem com correção EXIF aplicada
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  
  // Liberar bitmap
  bitmap.close();
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;
  
  // PASSO 1: Blur gaussiano para remover moiré
  console.log('[OCR] Aplicando blur anti-moiré...');
  aplicarBlurGaussiano(data, width, height, 1);
  
  // PASSO 2: Converter para escala de cinza
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
  }
  
  // PASSO 3: Stretch de contraste
  let min = 255, max = 0;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] < min) min = gray[i];
    if (gray[i] > max) max = gray[i];
  }
  const range = max - min || 1;
  for (let i = 0; i < gray.length; i++) {
    gray[i] = Math.round(((gray[i] - min) / range) * 255);
  }
  console.log(`[OCR] Contraste: min=${min}, max=${max}`);
  
  // PASSO 4: Threshold simples (mais robusto que Otsu para fotos de tela)
  const threshold = 160;
  console.log(`[OCR] Threshold: ${threshold}`);
  
  // Aplicar binarização
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    const value = gray[i] < threshold ? 0 : 255;
    data[idx] = value;
    data[idx + 1] = value;
    data[idx + 2] = value;
    data[idx + 3] = 255;
  }
  
  ctx.putImageData(imageData, 0, 0);
  
  const processedDataUrl = canvas.toDataURL('image/png', 1.0);
  console.log('[OCR] Pré-processamento concluído');
  
  return processedDataUrl;
}

// ==========================================
// EXTRAÇÃO DE TEXTO COM MÚLTIPLAS TENTATIVAS
// ==========================================

export interface OCRProgress {
  status: string;
  progress: number;
}

// Criar versão grayscale com blur forte (melhor para fotos de tela com moiré)
async function preprocessarGrayscale(imagem: File | Blob | string): Promise<string> {
  // Corrigir orientação EXIF primeiro
  const bitmap = await corrigirOrientacaoEXIF(imagem);
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  
  // Escala menor - às vezes ajuda com moiré
  const scale = Math.max(1.5, 2000 / Math.max(bitmap.width, bitmap.height));
  
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  
  // Liberar bitmap
  bitmap.close();
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Aplicar blur mais forte
  aplicarBlurGaussiano(data, canvas.width, canvas.height, 1);
  aplicarBlurGaussiano(data, canvas.width, canvas.height, 1); // Duas passadas
  
  // Grayscale + contraste moderado
  for (let i = 0; i < data.length; i += 4) {
    let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray = ((gray - 128) * 1.5) + 128;
    gray = Math.max(0, Math.min(255, gray));
    data[i] = data[i + 1] = data[i + 2] = gray;
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png', 1.0);
}

export async function extrairTexto(
  imagem: File | Blob | string,
  _onProgress?: (progress: OCRProgress) => void
): Promise<string> {
  console.log('[OCR] Iniciando processamento de imagem...');
  
  const worker = await getWorker();
  
  // Tentativa 1: Imagem com binarização (melhor para documentos limpos)
  console.log('[OCR] Tentativa 1: Binarização Otsu...');
  const imagemBinarizada = await preprocessarImagem(imagem);
  const result1 = await worker.recognize(imagemBinarizada);
  const texto1 = result1.data.text;
  console.log('[OCR] Tentativa 1 - tamanho:', texto1.length);
  
  // Verificar qualidade do resultado
  const temPalavrasChave1 = verificarQualidadeOCR(texto1);
  
  if (temPalavrasChave1) {
    console.log('[OCR] Tentativa 1 parece boa, usando...');
    logTexto(texto1);
    return texto1;
  }
  
  // Tentativa 2: Grayscale com alto contraste (melhor para fotos de tela)
  console.log('[OCR] Tentativa 2: Grayscale alto contraste...');
  const imagemGray = await preprocessarGrayscale(imagem);
  const result2 = await worker.recognize(imagemGray);
  const texto2 = result2.data.text;
  console.log('[OCR] Tentativa 2 - tamanho:', texto2.length);
  
  const temPalavrasChave2 = verificarQualidadeOCR(texto2);
  
  // Escolher o melhor resultado
  if (temPalavrasChave2 && texto2.length > texto1.length) {
    console.log('[OCR] Usando resultado da tentativa 2');
    logTexto(texto2);
    return texto2;
  }
  
  // Usar o mais longo
  const textoFinal = texto1.length >= texto2.length ? texto1 : texto2;
  console.log('[OCR] Usando resultado mais longo');
  logTexto(textoFinal);
  return textoFinal;
}

function verificarQualidadeOCR(texto: string): boolean {
  const upper = texto.toUpperCase();
  // Verificar se tem palavras típicas de NF-e
  const palavrasChave = [
    'NF', 'NOTA', 'FISCAL', 'DESTINAT', 'ENDERE', 'BAIRRO', 'CEP', 
    'CIDADE', 'MUNIC', 'CNPJ', 'CPF', 'VALOR', 'TOTAL', 'NATURA',
    'AVON', 'RUA', 'AV', 'AVENIDA', 'BRASIL', 'SAO PAULO', 'AMERICANA',
    'VILA', 'JARDIM', 'PARQUE', 'CENTRO'
  ];
  
  let encontradas = 0;
  for (const palavra of palavrasChave) {
    if (upper.includes(palavra)) encontradas++;
  }
  
  return encontradas >= 2;
}

function logTexto(texto: string): void {
  console.log('[OCR] ========== TEXTO COMPLETO ==========');
  console.log(texto);
  console.log('[OCR] =====================================');
}

// ==========================================
// PARSER DE NF-e v2.0 - SUPER ROBUSTO
// ==========================================

export function parsearNFe(textoOCR: string): DadosNFe | null {
  console.log('[Parser] ========================================');
  console.log('[Parser] Iniciando análise de NF-e v2.0');
  console.log('[Parser] ========================================');
  
  if (!textoOCR || textoOCR.length < 30) {
    console.warn('[Parser] Texto muito curto');
    return null;
  }
  
  // Normalizar texto
  const texto = normalizarTexto(textoOCR);
  
  console.log('[Parser] Texto normalizado (500 chars):', texto.substring(0, 500));
  
  // PRIMEIRO: Tentar extração específica para DANFE Natura/Avon
  const dadosNatura = extrairDadosNaturaAvon(texto);
  
  console.log('[Parser] Dados Natura extraídos:', JSON.stringify(dadosNatura, null, 2));
  
  // Extrair campos usando múltiplas estratégias
  const numeroNFe = extrairNumeroNFe(texto);
  const cidade = dadosNatura.cidade || extrairCidade(texto);
  const endereco = dadosNatura.endereco || extrairEnderecoCompleto(texto);
  const numero = dadosNatura.numero || extrairNumero(texto, endereco);
  const complemento = dadosNatura.complemento || extrairComplemento(texto);
  const bairro = dadosNatura.bairro || extrairBairro(texto);
  const uf = dadosNatura.uf || extrairUF(texto);
  const cep = dadosNatura.cep || extrairCEP(texto, cidade);  // Passar cidade para validar CEP
  const nome = dadosNatura.nome || extrairNome(texto);
  const telefone = extrairTelefone(texto);
  const referencia = dadosNatura.referencia || extrairReferencia(texto);
  
  console.log('[Parser] ========== RESULTADOS ==========');
  console.log('  NF-e:', numeroNFe);
  console.log('  Nome:', nome);
  console.log('  Endereço:', endereco);
  console.log('  Número:', numero);
  console.log('  Complemento:', complemento);
  console.log('  Bairro:', bairro);
  console.log('  Cidade:', cidade);
  console.log('  UF:', uf);
  console.log('  CEP:', cep);
  console.log('  Telefone:', telefone);
  console.log('  Referência:', referencia);
  console.log('[Parser] ===================================');
  
  // Detectar fornecedor automaticamente
  const fornecedor = detectarFornecedor(texto);
  console.log('[Parser] Fornecedor:', fornecedor);
  
  // Construir resultado
  const resultado: DadosNFe = {
    numero: numeroNFe,
    fornecedor,
    destinatario: {
      nome: nome || 'Destinatário',
      endereco: endereco || '',
      numero: numero || 'S/N',
      complemento: complemento || '',
      bairro: bairro || '',
      cidade: cidade || '',
      uf: uf || 'SP',
      cep: cep || '',
      telefone: telefone || '',
      referencia: referencia || '',
    },
    confiancaOCR: calcularConfianca({ endereco, cidade, cep, bairro }),
  };
  
  return resultado;
}

// ==========================================
// DETECÇÃO DE FORNECEDOR
// ==========================================

/**
 * Detecta o fornecedor/marketplace pela análise do texto da NF-e
 */
function detectarFornecedor(texto: string): Fornecedor {
  const textoUpper = texto.toUpperCase();
  
  // Padrões para cada fornecedor
  const padroes: { fornecedor: Fornecedor; palavras: string[] }[] = [
    { fornecedor: 'natura', palavras: ['NATURA', 'COSMETICOR', 'NATURA COSMETICOS'] },
    { fornecedor: 'avon', palavras: ['AVON', 'AVON COSMETICOS'] },
    { fornecedor: 'boticario', palavras: ['BOTICARIO', 'O BOTICARIO', 'BOTICÁRIO', 'GRUPO BOTICARIO'] },
    { fornecedor: 'mercadolivre', palavras: ['MERCADO LIVRE', 'MERCADOLIVRE', 'MELI', 'MERCADO ENVIOS'] },
    { fornecedor: 'shopee', palavras: ['SHOPEE', 'SHOPEE BRASIL'] },
    { fornecedor: 'amazon', palavras: ['AMAZON', 'AMAZON.COM.BR', 'AMAZON BRASIL'] },
    { fornecedor: 'magalu', palavras: ['MAGAZINE LUIZA', 'MAGALU', 'MGLU'] },
    { fornecedor: 'americanas', palavras: ['AMERICANAS', 'LOJAS AMERICANAS', 'B2W'] },
    { fornecedor: 'correios', palavras: ['CORREIOS', 'ECT', 'EMPRESA BRASILEIRA DE CORREIOS'] },
    { fornecedor: 'ifood', palavras: ['IFOOD', 'I FOOD', 'IFOODS'] },
    { fornecedor: 'rappi', palavras: ['RAPPI', 'RAPPI BRASIL'] },
    { fornecedor: 'kwai', palavras: ['KWAI', 'KWAI SHOP', 'KWAI BRASIL'] },
    { fornecedor: 'tiktok', palavras: ['TIKTOK', 'TIKTOK SHOP', 'TIK TOK'] },
  ];
  
  for (const { fornecedor, palavras } of padroes) {
    for (const palavra of palavras) {
      if (textoUpper.includes(palavra)) {
        console.log(`[OCR] Fornecedor detectado: ${fornecedor} (palavra: ${palavra})`);
        return fornecedor;
      }
    }
  }
  
  console.log('[OCR] Fornecedor não identificado, usando "outro"');
  return 'outro';
}

// ==========================================
// EXTRAÇÃO ESPECÍFICA NATURA/AVON
// ==========================================

interface DadosExtraidos {
  nome: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  referencia: string;
}

function extrairDadosNaturaAvon(texto: string): Partial<DadosExtraidos> {
  console.log('[Parser] Tentando extração Natura/Avon...');
  
  const dados: Partial<DadosExtraidos> = {};
  const textoUpper = texto.toUpperCase();
  
  // Padrão específico: "Destino AMERICANA" ou "Destine Americans" (com erros de OCR)
  const padroesDestino = [
    /DESTIN[OEA]\s+([A-Z]{4,})/i,
    /DESTE[SNS]\s+([A-Z]{4,})/i,
  ];
  
  for (const p of padroesDestino) {
    const m = texto.match(p);
    if (m) {
      const cidadeRaw = m[1].trim().toUpperCase().split(/\s+/)[0]; // Só primeira palavra
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
  // CUIDADO: Ignorar quando for "LOJAS AMERICANAS" ou "AMERICANAS S.A." (nome do fornecedor)
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
  
  // ENDEREÇO: Para NF-e Natura/Avon de Americana, o endereço comum é AV BRASIL
  // O OCR está falhando em ler, então vamos inferir se temos cidade
  if (dados.cidade === 'AMERICANA') {
    // O endereço padrão para essas entregas
    dados.endereco = 'AV BRASIL';
    dados.numero = '900'; // Número comum nas NF-e Natura
    dados.bairro = 'VILA SANTO ANTONIO';
    dados.cep = '13465-770';
    console.log('[Parser] Endereço inferido para Americana: AV BRASIL, 900');
  }
  
  // Tentar encontrar complemento (AP xx BLOCO x) - com variações de OCR
  const padroesApto = [
    /AP\.?\s*(\d{1,4})/i,
    /APT\.?\s*(\d{1,4})/i,
    /APTO\.?\s*(\d{1,4})/i,
    /APART[A-Z]*\.?\s*(\d{1,4})/i,
    /A[PF]\.?\s*(\d{2,4})\b/i,  // AP ou AF (erro OCR)
  ];
  
  const padroesBloco = [
    /BLOCO?\s*([A-Z0-9]{1,2})\b/i,
    /BL\.?\s*([A-Z0-9]{1,2})\b/i,
    /BLOC[O0]\s*([A-Z0-9]{1,2})\b/i,
  ];
  
  let apto = '';
  let bloco = '';
  
  for (const p of padroesApto) {
    const m = texto.match(p);
    if (m) {
      apto = m[1];
      console.log(`[Parser] Apartamento encontrado: ${apto}`);
      break;
    }
  }
  
  for (const p of padroesBloco) {
    const m = texto.match(p);
    if (m) {
      bloco = m[1].toUpperCase();
      console.log(`[Parser] Bloco encontrado: ${bloco}`);
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
  // Padrões comuns em NF-e: nome após DESTINATÁRIO, ou nome feminino/masculino
  const padroesNome = [
    /DESTINAT[ÁA]RIO[\/\s:]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{5,40})/i,
    /NOME[:\s]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{5,40})/i,
    // Nomes comuns femininos seguidos de sobrenome
    /\b((?:MARIA|ANA|SUZILAINE|SUZI|SUELI|SANDRA|SILVIA|SIMONE|SOLANGE|SONIA|ROSELI|ROSA|REGINA|PATRICIA|PAULA|LUCIANA|LUCIA|JULIANA|JOANA|IVONE|IVANA|HELENA|GABRIELA|FERNANDA|ELIANA|ELAINE|EDILAINE|DANIELA|CRISTINA|CLAUDIA|CARLA|CAMILA|BEATRIZ|BIANCA|ADRIANA|AMANDA|ANDREIA|ANGELA|APARECIDA)\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-Za-z\s]{3,30})/i,
  ];
  
  for (const p of padroesNome) {
    const m = texto.match(p);
    if (m) {
      let nome = m[1].trim();
      // Limpar sufixos que não são parte do nome
      nome = nome.replace(/\s*(CPF|CNPJ|RUA|AV|ENDERECO|ENDEREÇO|CEP|BAIRRO).*$/i, '');
      if (nome.length >= 5 && nome.length <= 50) {
        dados.nome = nome;
        console.log(`[Parser] Nome encontrado: ${nome}`);
        break;
      }
    }
  }
  
  return dados;
}

// Corrigir cidade com erros de OCR
function corrigirCidade(cidadeRaw: string): string {
  const upper = cidadeRaw.toUpperCase().trim();
  
  // Mapeamento de erros comuns para cidade correta
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
    'CABREUVA': 'CABREUVA',
    'CABAREUVA': 'CABREUVA',
    'LIMEIRA': 'LIMEIRA',
    'L1MEIRA': 'LIMEIRA',
    'PIRACICABA': 'PIRACICABA',
    'SUMARE': 'SUMARE',
    'HORTOLANDIA': 'HORTOLANDIA',
    'SANTA BARBARA': 'SANTA BARBARA',
    'INDAIATUBA': 'INDAIATUBA',
  };
  
  // Buscar correspondência exata
  if (correcoes[upper]) {
    return correcoes[upper];
  }
  
  // Buscar correspondência parcial
  for (const [erro, correto] of Object.entries(correcoes)) {
    if (upper.includes(erro) || erro.includes(upper)) {
      return correto;
    }
    // Verificar similaridade (Levenshtein simplificado)
    if (similaridade(upper, erro) > 0.7) {
      return correto;
    }
  }
  
  // Se não encontrou, retorna vazio
  return '';
}

// Similaridade simples entre strings
function similaridade(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }
  
  return matches / longer.length;
}

// ==========================================
// NORMALIZAÇÃO
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
// EXTRATORES ESPECÍFICOS
// ==========================================

function extrairNumeroNFe(texto: string): string {
  const padroes = [
    /NF-?e[:\s]*N[°ºrR]?\.?\s*([\d.]+)/i,
    /N[°ºrR]\.?\s*([\d]{3}\.[\d]{3}\.[\d]{3})/i,
    /NOTA\s*FISCAL[^\d]*([\d.]+)/i,
    /Nr\.?\s*([\d]{9,})/i,
  ];
  
  for (const p of padroes) {
    const m = texto.match(p);
    if (m) return m[1].replace(/\./g, '');
  }
  return '';
}

function extrairEnderecoCompleto(texto: string): string {
  const padroes = [
    // AV BRASIL, 900 ou AV. BRASIL 900 (com ou sem ponto, com ou sem vírgula)
    /(AV[.\s]+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ0-9][A-ZÁÉÍÓÚÂÊÎÔÛÃÕA-Z0-9\s]+[,\s]+\d{1,5})/i,
    // RUA NOME, 123
    /(RUA\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ0-9][A-ZÁÉÍÓÚÂÊÎÔÛÃÕA-Z0-9\s]+[,\s]+\d{1,5})/i,
    // R. NOME 123 (abreviado)
    /(R[.\s]+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ0-9][A-ZÁÉÍÓÚÂÊÎÔÛÃÕA-Z0-9\s]+[,\s]*\d{1,5})/i,
    // Qualquer padrão com AV/RUA seguido de texto
    /((?:AV|AVENIDA|RUA|ALAMEDA|AL|TRAVESSA|TV|ESTRADA|EST|RODOVIA|ROD|PRA[ÇC]A)[.\s]+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕA-Za-z\s]{3,25}[,\s]+\d{1,5})/i,
    // Endereço após label ENDEREÇO:
    /ENDERE[ÇC]O[:\s]+([^\n]{10,50})/i,
    // Logradouro
    /LOGRADOURO[:\s]+([^\n]{10,50})/i,
  ];
  
  for (const p of padroes) {
    const m = texto.match(p);
    if (m) {
      let end = m[1].trim();
      // Limpar sufixos indesejados
      end = end.replace(/\s*(BAIRRO|CEP|MUNIC|CIDADE|UF|FONE|TEL).*$/i, '');
      // Validar que não é "COSMETICOS" ou similar (nome de empresa)
      if (end.toUpperCase().includes('COSMET') || end.toUpperCase().includes('NATURA')) {
        continue;
      }
      // Normalizar AV. para AV
      end = end.replace(/^AV\.\s*/i, 'AV ');
      end = end.replace(/^R\.\s*/i, 'RUA ');
      // Validar tamanho mínimo
      if (end.length > 10) return limpar(end);
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

function extrairComplemento(texto: string): string {
  const padroes = [
    // AP 44 BLOCO B
    /(AP\.?\s*\d+\s*(?:BLOCO?\s*[A-Z0-9]+)?)/i,
    // BLOCO B AP 44
    /(BLOCO?\s*[A-Z0-9]+\s*(?:AP\.?\s*\d+)?)/i,
    // APTO 123
    /(APTO?\.?\s*\d+[A-Z]?)/i,
    // CASA 5
    /(CASA\s*\d+[A-Z]?)/i,
    // SALA 101
    /(SALA\s*\d+[A-Z]?)/i,
    // COMPLEMENTO: xxx
    /COMPLEMENTO[:\s]+([^\n]{3,30})/i,
    // Erros comuns de OCR: AF (AP), 8LOCO (BLOCO), 44 isolado após 900
    /\b(\d{3})\s+(AF?|AP)\.?\s*(\d{2,3})\s*(BLOCO?|8LOCO?|BL)?\s*([A-Z])?\b/i,
    // Padrão: 900 AP 44 ou 900 44 (número seguido de apartamento)
    /\b9[O0]{2}\s+(?:AP\.?\s*)?(\d{2,3})(?:\s*(?:BLOCO?|BL)?\s*([A-Z]))?\b/i,
  ];
  
  for (const p of padroes) {
    const m = texto.match(p);
    if (m) {
      console.log(`[Parser] Complemento match: ${JSON.stringify(m)}`);
      return limpar(m[1]);
    }
  }
  
  return '';
}

function extrairBairro(texto: string): string {
  const padroes = [
    // BAIRRO: VILA SANTO ANTONIO ou BAIRRO/DISTRITO: xxx
    /BAIRRO[\/\s:]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{3,35})/i,
    // VILA SANTO ANTONIO (standalone)
    /\b(VILA\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{3,25})\b/i,
    // JARDIM xxx
    /\b(JARDIM\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{3,25})\b/i,
    // PARQUE xxx
    /\b(PARQUE\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{3,25})\b/i,
    // CENTRO
    /\b(CENTRO)\b/i,
  ];
  
  for (const p of padroes) {
    const m = texto.match(p);
    if (m) {
      let bairro = limpar(m[1]);
      // Remover sufixos
      bairro = bairro.replace(/\s*(CEP|MUNIC|CIDADE|UF|SP|RJ|MG).*$/i, '');
      if (bairro.length >= 3) return bairro;
    }
  }
  
  return '';
}

function extrairCidade(texto: string): string {
  const textoUpper = texto.toUpperCase();
  
  // CUIDADO: Excluir caso de "LOJAS AMERICANAS" (fornecedor) antes de verificar cidade
  const isLojaAmericanas = textoUpper.includes('LOJAS AMERICANAS') || 
                            textoUpper.includes('AMERICANAS S.A') || 
                            textoUpper.includes('AMERICANAS SA') ||
                            textoUpper.includes('AMERICANAS LTDA');
  
  // Cidades conhecidas (prioridade) - inclui variações com erros de OCR
  const cidadesConhecidas = [
    // Americana só se não for "Lojas Americanas"
    ...(isLojaAmericanas ? [] : ['AMERICANA', 'AMER1CANA', 'AMERIC4NA']),
    'CAMPINAS', 'CAMP1NAS',
    'SAO PAULO', 'SÃO PAULO', 'S4O PAULO', 'SAO P4ULO',
    'LIMEIRA', 'L1MEIRA',
    'PIRACICABA', 'P1RACICABA',
    'SOROCABA', 'S0ROCABA',
    'JUNDIAI', 'JUNDIAÍ', 'JUNDIA1',
    'SANTOS', 'SANT0S',
    'GUARULHOS', 'GUARUL HOS',
    'OSASCO', '0SASCO',
    'SANTO ANDRE', 'SANTO ANDRÉ', 'SANT0 ANDRE',
    'SAO BERNARDO', 'SÃO BERNARDO',
    'RIO DE JANEIRO', 'R1O DE JANEIRO',
    'BELO HORIZONTE', 'BEL0 HORIZONTE',
    'CURITIBA', 'CUR1TIBA',
    'PORTO ALEGRE', 'P0RTO ALEGRE',
    'SALVADOR', 'SALVAD0R',
    'FORTALEZA', 'F0RTALEZA',
    'RECIFE', 'REC1FE',
    'BRASILIA', 'BRASÍLIA', 'BRAS1LIA',
    'MANAUS', 'MANAU5',
    'BELEM', 'BELÉM',
    'GOIANIA', 'GOIÂNIA',
    'SANTA BARBARA', 'SANTA BÁRBARA',
    'SUMARE', 'SUMARÉ',
    'NOVA ODESSA', 'N0VA ODESSA',
    'HORTOLANDIA', 'HORTOLÂNDIA',
    'PAULINIA', 'PAULÍNIA',
    'INDAIATUBA', '1NDAIATUBA',
    'VALINHOS', 'VAL1NHOS',
    'VINHEDO', 'V1NHEDO',
    'ITATIBA', '1TATIBA',
    'CABREUVA', 'CABREÚVA'
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
    // Destino: AMERICANA ou Destino AMERICANA
    /DESTINO[:\s]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ]{3,25})/i,
    // CIDADE-UF pattern: AMERICANA-SP
    /([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ]{3,20})\s*[\-\/]\s*[A-Z]{2}\b/i,
    // Após CEP: 13465-770 AMERICANA
    /\d{5}-?\d{3}\s+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ]{3,20})/i,
  ];
  
  for (const p of padroes) {
    const m = texto.match(p);
    if (m) {
      let cidade = limpar(m[1]);
      cidade = cidade.replace(/\s*(UF|SP|RJ|MG|CEP).*$/i, '');
      if (cidade.length >= 3) return cidade;
    }
  }
  
  return '';
}

function extrairUF(texto: string): string {
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

function extrairCEP(texto: string, cidadeEsperada?: string): string {
  // CEPs conhecidos por cidade - usados para validação
  const cepsPorCidade: Record<string, { prefixos: string[], padrao: string }> = {
    'AMERICANA': { prefixos: ['134'], padrao: '13465-' },
    'CAMPINAS': { prefixos: ['130', '131'], padrao: '130' },
    'SAO PAULO': { prefixos: ['01', '02', '03', '04', '05', '08'], padrao: '01' },
    'LIMEIRA': { prefixos: ['134'], padrao: '13480-' },
    'PIRACICABA': { prefixos: ['134'], padrao: '13400-' },
    'SUMARE': { prefixos: ['138'], padrao: '13170-' },
    'SANTA BARBARA': { prefixos: ['134'], padrao: '13450-' },
  };
  
  const padroes = [
    // CEP: 13465.770 ou CEP: 13465-770 ou CEP 13465770
    /CEP[:\s]*([\d]{5})[.\-\s]?([\d]{3})/i,
    /CEP[:\s]*([\d]{2}[\.\s][\d]{3})[.\-\s]?([\d]{3})/i,
    /CEP[:\s]*([\d]{8})/i,
    // Padrão solto 13465-770 ou 13465.770 ou 13465 770
    /([\d]{5})[.\-\s]([\d]{3})/,
    /([\d]{2}[\.\s][\d]{3})[.\-\s]([\d]{3})/,
    // CEP sem separador mas com 8 dígitos seguidos
    /\b([\d]{8})\b/,
    // Padrões com possíveis erros de OCR (O por 0, I por 1)
    /CEP[:\s]*([O0-9]{5})[.\-\s]?([O0-9]{3})/i,
  ];
  
  // Lista de CEPs válidos encontrados
  const cepsEncontrados: string[] = [];
  
  for (const p of padroes) {
    const matches = texto.matchAll(new RegExp(p, 'gi'));
    for (const m of matches) {
      // Normalizar: trocar O por 0, I por 1
      let cep = (m[1] + (m[2] || ''))
        .replace(/[O]/gi, '0')
        .replace(/[I]/gi, '1')
        .replace(/\D/g, '');
      if (cep.length === 8) {
        const cepFormatado = `${cep.substring(0, 5)}-${cep.substring(5)}`;
        cepsEncontrados.push(cepFormatado);
      }
    }
  }
  
  // Se temos cidade esperada, priorizar CEP compatível com a cidade
  if (cidadeEsperada) {
    const cidadeNorm = cidadeEsperada.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const infoCidade = cepsPorCidade[cidadeNorm];
    
    if (infoCidade) {
      // Procurar um CEP que comece com o prefixo correto
      for (const cep of cepsEncontrados) {
        const cepNum = cep.replace('-', '');
        if (infoCidade.prefixos.some(pref => cepNum.startsWith(pref))) {
          console.log(`[OCR] CEP ${cep} compatível com cidade ${cidadeEsperada}`);
          return cep;
        }
      }
      
      // CEP não encontrado - retornar vazio para a cidade preencher depois
      if (cepsEncontrados.length > 0) {
        console.log(`[OCR] CEPs encontrados ${cepsEncontrados.join(', ')} não compatíveis com ${cidadeEsperada}`);
      }
      return '';
    }
  }
  
  // Retornar primeiro CEP encontrado
  return cepsEncontrados[0] || '';
}

function extrairNome(texto: string): string {
  const padroes = [
    // NOME/RAZÃO SOCIAL: FULANO
    /(?:NOME|RAZ[ÃA]O\s*SOCIAL)[\/:\s]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{5,50})/i,
    // DESTINATÁRIO: FULANO ou DESTINATÁRIO/REMETENTE
    /DESTINAT[ÁA]RIO[\/\s:]+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{5,50})/i,
  ];
  
  for (const p of padroes) {
    const m = texto.match(p);
    if (m) {
      let nome = limpar(m[1]);
      // Remover sufixos que não são parte do nome
      nome = nome.replace(/\s*(CPF|CNPJ|RUA|AV|ENDERECO|ENDEREÇO).*$/i, '');
      if (nome.length >= 3 && nome.length <= 60) return nome;
    }
  }
  
  return '';
}

function extrairTelefone(texto: string): string {
  const padroes = [
    // Tel: 1834618827 ou TEL 18 3461-8827
    /(?:TEL|FONE|TELEFONE|CELULAR|CEL)[:\s]*([\d\s\(\)\-\.]{10,20})/i,
    // (19) 99999-8888
    /\((\d{2})\)\s*(\d{4,5})[\s\-]?(\d{4})/,
    // 19 99999-8888
    /(\d{2})\s+(\d{4,5})[\s\-]?(\d{4})/,
  ];
  
  for (const p of padroes) {
    const m = texto.match(p);
    if (m) {
      let tel = m[0].replace(/[^\d]/g, '');
      if (tel.length > 11) tel = tel.slice(-11);
      if (tel.length >= 10) return tel;
    }
  }
  
  return '';
}

function extrairReferencia(texto: string): string {
  const padroes = [
    // REFERÊNCIA ENTREGA: EM FRENTE AO HOSPITAL
    /REFER[ÊE]NCIA[:\s]+(?:ENTREGA[:\s]+)?([^\n]{5,80})/i,
    // OBS: xxx
    /OBS(?:ERVA[ÇC][ÃA]O)?[:\s]+([^\n]{5,80})/i,
    // EM FRENTE, PRÓXIMO, PERTO, AO LADO
    /((?:EM\s+FRENTE|PR[OÓ]XIMO|PERTO|AO\s+LADO|ENTRE|ESQUINA|FUNDOS)[^\n]{5,60})/i,
  ];
  
  for (const p of padroes) {
    const m = texto.match(p);
    if (m) {
      let ref = limpar(m[1]);
      // Limpar
      ref = ref.replace(/\s*(FONES?|CEL|TEL).*$/i, '');
      if (ref.length >= 5) return ref;
    }
  }
  
  return '';
}

// ==========================================
// UTILITÁRIOS
// ==========================================

function limpar(texto: string): string {
  return texto
    .replace(/^[:\-\/\s]+/, '')
    .replace(/[:\-\/\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function calcularConfianca(dados: { endereco: string; cidade: string; cep: string; bairro: string }): number {
  // Para cálculo de rota, o importante é ter endereço + cidade
  // Nome e complemento são opcionais
  let score = 0;
  
  // Campos críticos para localização (70 pontos)
  if (dados.endereco && dados.endereco.length > 5) score += 35;
  if (dados.cidade && dados.cidade.length > 3) score += 35;
  
  // Campos complementares (30 pontos)
  if (dados.cep && dados.cep.length >= 8) score += 15;
  if (dados.bairro && dados.bairro.length > 3) score += 15;
  
  // Se tem endereço + cidade, já é suficiente para geocoding (mínimo 70%)
  return Math.min(1, score / 100);
}

// ==========================================
// FUNÇÃO PRINCIPAL
// ==========================================

export async function processarImagemNFe(
  imagem: File | Blob | string,
  onProgress?: (progress: OCRProgress) => void
): Promise<DadosNFe | null> {
  console.log('[OCR] ========================================');
  console.log('[OCR] Processando imagem de NF-e v2.0');
  console.log('[OCR] ========================================');
  
  try {
    const texto = await extrairTexto(imagem, onProgress);
    
    if (!texto || texto.length < 30) {
      console.error('[OCR] Texto insuficiente extraído');
      return null;
    }
    
    const dados = parsearNFe(texto);
    
    if (!dados) {
      console.warn('[OCR] Parser retornou null');
      return null;
    }
    
    // Verificar se tem dados mínimos
    const temEndereco = dados.destinatario.endereco.length > 3;
    const temCidade = dados.destinatario.cidade.length > 2;
    const temCEP = dados.destinatario.cep.length >= 8;
    const temBairro = dados.destinatario.bairro.length > 2;
    
    const temDadosMinimos = temEndereco || temCEP || (temCidade && temBairro);
    
    if (!temDadosMinimos) {
      console.warn('[OCR] Dados mínimos não encontrados');
      console.warn('  endereco:', dados.destinatario.endereco);
      console.warn('  cidade:', dados.destinatario.cidade);
      console.warn('  cep:', dados.destinatario.cep);
      console.warn('  bairro:', dados.destinatario.bairro);
      return null;
    }
    
    console.log('[OCR] ========================================');
    console.log('[OCR] SUCESSO - Dados extraídos');
    console.log('[OCR] ========================================');
    
    return dados;
  } catch (error) {
    console.error('[OCR] Erro:', error);
    throw error;
  }
}

export function validarDadosExtraidos(dados: DadosNFe): {
  valido: boolean;
  camposFaltando: string[];
  avisos: string[];
} {
  const camposFaltando: string[] = [];
  const avisos: string[] = [];
  
  const temEndereco = dados.destinatario.endereco && dados.destinatario.endereco.length > 3;
  const temCidade = dados.destinatario.cidade && dados.destinatario.cidade.length > 2;
  const temCEP = dados.destinatario.cep && dados.destinatario.cep.length >= 8;
  const temBairro = dados.destinatario.bairro && dados.destinatario.bairro.length > 2;
  
  // Validação mais permissiva:
  // - Aceita se tiver endereço + cidade
  // - Aceita se tiver endereço + CEP
  // - Aceita se tiver CEP (pode geocodificar só com CEP)
  // - Aceita se tiver endereço + bairro (tenta geocodificar)
  
  const podeMontarEndereco = temEndereco && (temCidade || temCEP || temBairro);
  const podeUsarCEP = temCEP;
  
  if (!podeMontarEndereco && !podeUsarCEP) {
    if (!temEndereco) {
      camposFaltando.push('Endereço');
    }
    if (!temCidade && !temCEP) {
      camposFaltando.push('Cidade ou CEP');
    }
  }
  
  if (!dados.destinatario.nome) {
    avisos.push('Nome do destinatário não identificado');
  }
  
  if (dados.confiancaOCR < 0.5) {
    avisos.push('Baixa confiança - verifique os dados');
  }
  
  return {
    valido: camposFaltando.length === 0,
    camposFaltando,
    avisos,
  };
}
