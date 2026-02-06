/**
 * @fileoverview Serviço de OCR para extração de dados de notas fiscais
 * 
 * @description Usa Tesseract.js para extrair texto de imagens e identificar
 *              chaves de acesso de 44 dígitos e endereços.
 *              Versão 2.0 com extração robusta portada do frontend Web.
 * 
 * @pre Imagem em base64 válida (JPEG, PNG)
 * @post Texto extraído + chave de acesso (se encontrada)
 */

import Tesseract from 'tesseract.js';
import sharp from 'sharp';

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
  erro?: string;
}

// ==========================================
// VERIFICAÇÃO DE QUALIDADE OCR
// ==========================================

const PALAVRAS_CHAVE_NFE = [
  'destinatario',
  'rua',
  'avenida',
  'bairro',
  'cidade',
  'cep',
  'danfe',
  'nota fiscal',
  'endereco',
  'valor total',
  'chave de acesso'
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
 */
async function executarOCR(imageBuffer: Buffer): Promise<Tesseract.RecognizeResult> {
  return Tesseract.recognize(
    imageBuffer,
    'por',
    {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`[OCR] Progresso: ${Math.round((m.progress || 0) * 100)}%`);
        }
      }
    }
  );
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
    /\b(R(?:UA)?\.?\s+(?:DOUTOR|DR\.?|PROFESSOR|PROF\.?|MAJOR|CORONEL|CAP)?\s*[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{3,40})[,\s]+(\d{1,5})\b/i,
    // AV/AVENIDA seguido de nome e número
    /\b(AV(?:ENIDA)?\.?\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{3,40})[,\s]+(\d{1,5})\b/i,
    // Qualquer logradouro genérico
    /\b((?:ALAMEDA|TRAVESSA|PRAÇA|ESTRADA|RODOVIA|VIA)\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕa-záéíóúâêîôûãõ\s]{3,40})[,\s]+(\d{1,5})\b/i,
  ];
  
  for (const p of padroesEndereco) {
    const m = texto.match(p);
    if (m) {
      const enderecoExtraido = m[1].trim().toUpperCase();
      const numeroExtraido = m[2];
      // Verificar se não é o endereço do remetente (NATURA)
      if (!enderecoExtraido.includes('TOLEDO') && !enderecoExtraido.includes('CABREUVA')) {
        dados.endereco = enderecoExtraido;
        dados.numero = numeroExtraido;
        console.log(`[Parser] Endereço extraído: ${enderecoExtraido}, ${numeroExtraido}`);
        break;
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
 * Extrai endereço do texto OCR usando patterns comuns de NF-e/DANFE
 * VERSÃO ROBUSTA - Portada do frontend Web
 * 
 * @pre texto não vazio
 * @post objeto com partes do endereço identificadas
 */
function extrairEndereco(texto: string): OcrResult['endereco'] {
  let endereco: OcrResult['endereco'] = {};
  
  console.log('[OCR] Iniciando extração de endereço...');
  console.log(`[OCR] Texto para análise (primeiros 500 chars): ${texto.substring(0, 500)}`);
  
  // ==========================================
  // 0. PRIMEIRO: Tentar extração específica Natura/Avon
  // ==========================================
  const dadosNatura = extrairDadosNaturaAvon(texto);
  
  // Se encontrou dados específicos Natura/Avon, usar como base
  if (dadosNatura.endereco || dadosNatura.cidade) {
    console.log('[OCR] Usando dados extraídos via Natura/Avon parser');
    
    if (dadosNatura.endereco) {
      endereco.logradouro = dadosNatura.endereco;
    }
    if (dadosNatura.numero) {
      endereco.numero = dadosNatura.numero;
    }
    if (dadosNatura.bairro) {
      endereco.bairro = dadosNatura.bairro;
    }
    if (dadosNatura.cidade) {
      endereco.cidade = dadosNatura.cidade;
    }
    if (dadosNatura.uf) {
      endereco.uf = dadosNatura.uf;
    }
    if (dadosNatura.cep) {
      endereco.cep = dadosNatura.cep;
    }
    if (dadosNatura.complemento) {
      endereco.complemento = dadosNatura.complemento;
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
      console.log(`[OCR] Endereço Natura montado: ${endereco.enderecoCompleto}`);
      return endereco;
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
  
  return Object.keys(endereco).length > 0 ? endereco : undefined;
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
    
    // PRÉ-PROCESSAMENTO COM SHARP:
    // 1. rotate() sem argumentos = aplica correção EXIF automaticamente
    // 2. grayscale() = melhor para OCR
    // 3. normalize() = melhora contraste
    // 4. sharpen() = melhora nitidez do texto
    try {
      imageBuffer = await sharp(imageBuffer)
        .rotate() // Aplica orientação EXIF (crítico para fotos de iPhone/Android)
        .grayscale() // Converte para escala de cinza
        .normalize() // Melhora contraste automaticamente
        .sharpen({ sigma: 1.5 }) // Melhora nitidez do texto
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
    
    // Se não encontrou palavras-chave, tentar rotações
    if (!verificarQualidadeOCR(textoExtraido)) {
      console.log('[OCR] Qualidade ruim, tentando rotações...');
      
      const rotacoes = [90, 270, 180];
      for (const graus of rotacoes) {
        console.log(`[OCR] Tentando rotação de ${graus}°...`);
        try {
          const bufferRotacionado = await rotacionarImagem(bufferOriginal, graus);
          const resultRot = await executarOCR(bufferRotacionado);
          const textoRot = resultRot.data.text;
          
          if (verificarQualidadeOCR(textoRot)) {
            console.log(`[OCR] Rotação ${graus}° encontrou texto válido!`);
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
    
    // Extrai chave de acesso
    const chaveAcesso = extrairChave44Digitos(textoExtraido);
    
    // Extrai endereço e valida
    const enderecoExtraido = extrairEndereco(textoExtraido);
    const endereco = validarEnderecoExtraido(enderecoExtraido) ? enderecoExtraido : undefined;
    
    // Extrai destinatário
    const nomeDestinatario = extrairDestinatario(textoExtraido);
    
    // Extrai dados da nota
    const dadosNota = extrairDadosNota(textoExtraido);
    
    // Detecta tipo de documento
    let tipoDocumento = 'DESCONHECIDO';
    if (textoExtraido.includes('NFC-E') || textoExtraido.includes('NFCE')) {
      tipoDocumento = 'NFC-e';
    } else if (textoExtraido.includes('NF-E') || textoExtraido.includes('NFE')) {
      tipoDocumento = 'NF-e';
    } else if (textoExtraido.includes('DANFE')) {
      tipoDocumento = 'DANFE';
    }
    
    console.log(`[OCR] Resultados - Tipo: ${tipoDocumento}, Chave: ${chaveAcesso ? 'encontrada' : 'não encontrada'}, Endereço: ${endereco ? 'encontrado' : 'não encontrado'}`);
    
    return {
      sucesso: true,
      textoExtraido: textoExtraido.substring(0, 2000), // Limita tamanho
      confianca,
      chaveAcesso: chaveAcesso || undefined,
      tipoDocumento,
      destinatario: nomeDestinatario ? { nome: nomeDestinatario } : undefined,
      endereco,
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
