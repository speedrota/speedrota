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
 * @pre endereço extraído
 * @post true se parece um endereço real
 */
function validarEnderecoExtraido(endereco: OcrResult['endereco']): boolean {
  if (!endereco) return false;
  
  // Deve ter pelo menos logradouro OU cep OU cidade
  const temLogradouro = endereco.logradouro && endereco.logradouro.length > 5;
  const temCep = endereco.cep && /^\d{5}-?\d{3}$/.test(endereco.cep);
  const temCidade = endereco.cidade && endereco.cidade.length > 2;
  
  if (!temLogradouro && !temCep && !temCidade) {
    console.log('[OCR] Endereço rejeitado: sem dados mínimos');
    return false;
  }
  
  // Verificar se logradouro não é lixo
  if (temLogradouro) {
    const logUpper = endereco.logradouro!.toUpperCase();
    
    // Padrões de lixo comuns
    const padroesLixo = [
      /^[A-Z]{1,2}\s+[A-Z]{1,2}\s+[A-Z]{1,2}/,  // "E E EA" - letras soltas
      /ASTRA|VOS\b|ASS\s+CS/i,                   // palavras sem sentido
      /DISTRITO\s+CEP\s+DATA/i,                  // texto de cabeçalho
      /SAIDA|ENTRADA|EMISSAO/i,                  // campos do DANFE, não endereço
      /^\s*[|=\[\]{}]+/,                         // caracteres de ruído
    ];
    
    for (const padrao of padroesLixo) {
      if (padrao.test(logUpper)) {
        console.log(`[OCR] Endereço rejeitado: padrão lixo detectado - ${logUpper}`);
        return false;
      }
    }
    
    // Verificar se tem palavras válidas (não só ruído)
    const palavras = logUpper.split(/\s+/).filter(p => p.length > 1);
    const palavrasValidas = palavras.filter(p => /^[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ]+$/.test(p));
    
    // Pelo menos 50% das palavras devem ser válidas
    if (palavras.length > 0 && palavrasValidas.length / palavras.length < 0.5) {
      console.log(`[OCR] Endereço rejeitado: muitas palavras inválidas - ${palavrasValidas.length}/${palavras.length}`);
      return false;
    }
  }
  
  // Verificar coerência CEP/UF se ambos existem
  if (temCep && endereco.uf) {
    const cepPrefix = endereco.cep!.substring(0, 2);
    const cepUfMap: Record<string, string[]> = {
      'SP': ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19'],
      'RJ': ['20', '21', '22', '23', '24', '25', '26', '27', '28'],
      'ES': ['29'],
      'MG': ['30', '31', '32', '33', '34', '35', '36', '37', '38', '39'],
      'BA': ['40', '41', '42', '43', '44', '45', '46', '47', '48'],
      'SE': ['49'],
      'PE': ['50', '51', '52', '53', '54', '55', '56'],
      'AL': ['57'],
      'PB': ['58'],
      'RN': ['59'],
      'CE': ['60', '61', '62', '63'],
      'PI': ['64'],
      'MA': ['65'],
      'PA': ['66', '67', '68'],
      'AP': ['68'],
      'AM': ['69'],
      'AC': ['69'],
      'RO': ['76', '78'],
      'RR': ['69'],
      'DF': ['70', '71', '72', '73'],
      'GO': ['74', '75', '76'],
      'TO': ['77'],
      'MT': ['78'],
      'MS': ['79'],
      'PR': ['80', '81', '82', '83', '84', '85', '86', '87'],
      'SC': ['88', '89'],
      'RS': ['90', '91', '92', '93', '94', '95', '96', '97', '98', '99'],
    };
    
    const ufValidos = cepUfMap[endereco.uf];
    if (ufValidos && !ufValidos.includes(cepPrefix)) {
      console.log(`[OCR] Endereço rejeitado: CEP ${endereco.cep} não corresponde a UF ${endereco.uf}`);
      return false;
    }
  }
  
  console.log('[OCR] Endereço validado com sucesso');
  return true;
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

/**
 * Extrai endereço do texto OCR usando patterns comuns de NF-e/DANFE
 * 
 * @pre texto não vazio
 * @post objeto com partes do endereço identificadas
 */
function extrairEndereco(texto: string): OcrResult['endereco'] {
  const linhas = texto.split('\n').map(l => l.trim()).filter(l => l);
  
  let endereco: OcrResult['endereco'] = {};
  
  // Procura CEP (formato 00000-000 ou 00000000)
  const cepMatch = texto.match(/(\d{5})-?(\d{3})/);
  if (cepMatch) {
    endereco.cep = `${cepMatch[1]}-${cepMatch[2]}`;
  }
  
  // Procura UF (2 letras maiúsculas no contexto de endereço)
  const ufMatch = texto.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i);
  if (ufMatch) {
    endereco.uf = ufMatch[1].toUpperCase();
  }
  
  // Procura padrões de rua/avenida (melhorado para DANFE)
  const logradouroPatterns = [
    // Padrão DANFE: "R DOUTOR JOAO ZANAGA , 600" (R sem ponto)
    /\b(R\s+(?:DOUTOR|DR\.?|PROFESSOR|PROF\.?|MAJOR|CORONEL|CAP)?\s*[A-ZÀ-Ú][A-ZÀ-Ú0-9\s]{3,40})[,\s]+(\d{1,5})\b/i,
    // Padrão com ponto: "R. DOUTOR JOAO DANIEL, 809"
    /(R\.|RUA|AV\.|AV\s|AVENIDA|AL\.|ALAMEDA|TV\.|TRAVESSA|EST\.|ESTRADA|ROD\.|RODOVIA)\s*[A-ZÀ-Ú0-9\s]+[,\s]+(\d+)/i,
    // Padrão com número separado
    /(RUA|R\.|AV\.|AVENIDA|ALAMEDA|AL\.|TRAVESSA|TV\.)\s+[A-ZÀ-Ú\s]+/i,
    // Qualquer endereço com número
    /([A-ZÀ-Ú\s]+),?\s*(\d{1,5})\s*[-,]?\s*([A-ZÀ-Ú\s]*)/i
  ];
  
  for (const pattern of logradouroPatterns) {
    const match = texto.match(pattern);
    if (match && match[0].length > 10) {
      let logradouro = match[0].trim();
      // Ignorar se for endereço do remetente (Natura/Cabreúva)
      if (logradouro.toUpperCase().includes('TOLEDO') || logradouro.toUpperCase().includes('CABREUVA')) {
        continue;
      }
      endereco.logradouro = logradouro;
      // Extrai número se presente
      const numMatch = match[0].match(/[,\s]+(\d{1,5})\b/);
      if (numMatch) {
        endereco.numero = numMatch[1];
      }
      console.log(`[OCR] Logradouro extraído: ${logradouro}, número: ${endereco.numero}`);
      break;
    }
  }
  
  // Procura bairro (CHACARA MACHADINHO, JD xxx, VILA xxx, etc)
  const bairroPatterns = [
    /\b(CHACARA\s+MACHADINHO(?:\s+II)?)\b/i,
    /\b(JD\.?\s+[A-ZÀ-Ú]+)\b/i,
    /\b(JARDIM\s+[A-ZÀ-Ú]+)\b/i,
    /\b(VILA\s+[A-ZÀ-Ú]+)\b/i,
    /\b(PARQUE\s+[A-ZÀ-Ú]+)\b/i,
    /BAIRRO:?\s*([A-ZÀ-Ú\s]+)/i,
  ];
  
  for (const pattern of bairroPatterns) {
    const match = texto.match(pattern);
    if (match && match[1] && match[1].trim().length > 2) {
      endereco.bairro = match[1].trim();
      break;
    }
  }
  
  // Procura cidade (antes da UF)
  if (endereco.uf) {
    const cidadePatterns = [
      new RegExp(`([A-ZÀ-Ú\\s]{3,30})\\s*[-\\/]?\\s*${endereco.uf}`, 'i'),
      new RegExp(`Município:?\\s*([A-ZÀ-Ú\\s]+)`, 'i'),
      new RegExp(`Cidade:?\\s*([A-ZÀ-Ú\\s]+)`, 'i')
    ];
    
    for (const pattern of cidadePatterns) {
      const match = texto.match(pattern);
      if (match && match[1] && match[1].trim().length > 2) {
        endereco.cidade = match[1].trim();
        break;
      }
    }
  }
  
  // Tenta extrair endereço completo de DANFE (seção DESTINATÁRIO)
  const danfeDestMatch = texto.match(/DESTINAT[ÁA]RIO[\s\S]*?(?:Endere[çc]o|Logradouro)?:?\s*([^\n]+)/i);
  if (danfeDestMatch && danfeDestMatch[1]) {
    const endCompleto = danfeDestMatch[1].trim();
    if (endCompleto.length > 10 && !endereco.logradouro) {
      endereco.logradouro = endCompleto;
    }
  }
  
  // Monta endereço completo se tiver informações
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
