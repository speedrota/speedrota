/**
 * @fileoverview Serviço de OCR para extração de dados de notas fiscais
 * 
 * @description Usa Tesseract.js para extrair texto de imagens e identificar
 *              chaves de acesso de 44 dígitos e endereços.
 * 
 * @pre Imagem em base64 válida (JPEG, PNG)
 * @post Texto extraído + chave de acesso (se encontrada)
 */

import Tesseract from 'tesseract.js';

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
 * Extrai endereço do texto OCR usando patterns comuns de NF-e
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
  
  // Procura padrões de rua/avenida
  const logradouroMatch = texto.match(/(RUA|R\.|AV\.|AVENIDA|ALAMEDA|AL\.|TRAVESSA|TV\.)\s+[A-ZÀ-Ú\s]+,?\s*(\d+)?/i);
  if (logradouroMatch) {
    endereco.logradouro = logradouroMatch[0];
  }
  
  // Procura bairro (geralmente após "BAIRRO:" ou antes do CEP)
  const bairroMatch = texto.match(/BAIRRO:?\s*([A-ZÀ-Ú\s]+)/i);
  if (bairroMatch) {
    endereco.bairro = bairroMatch[1].trim();
  }
  
  // Procura cidade (geralmente antes da UF)
  if (endereco.uf) {
    const cidadeMatch = texto.match(new RegExp(`([A-ZÀ-Ú\\s]+)\\s*[-/]?\\s*${endereco.uf}`, 'i'));
    if (cidadeMatch) {
      endereco.cidade = cidadeMatch[1].trim();
    }
  }
  
  // Monta endereço completo se tiver informações
  if (endereco.logradouro || endereco.bairro || endereco.cidade) {
    const partes = [
      endereco.logradouro,
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
 * 
 * @pre texto não vazio
 * @post nome do destinatário se encontrado
 */
function extrairDestinatario(texto: string): string | undefined {
  // Procura padrões comuns de destinatário em NF-e
  const patterns = [
    /DEST(?:INATARIO)?:?\s*([A-ZÀ-Ú\s]+)/i,
    /NOME:?\s*([A-ZÀ-Ú\s]+)/i,
    /CLIENTE:?\s*([A-ZÀ-Ú\s]+)/i,
    /PARA:?\s*([A-ZÀ-Ú\s]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = texto.match(pattern);
    if (match && match[1].length > 3) {
      return match[1].trim();
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
    
    console.log('[OCR] Executando Tesseract...');
    
    // Executa OCR com Tesseract
    const result = await Tesseract.recognize(
      imageBuffer,
      'por', // Português
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`[OCR] Progresso: ${Math.round((m.progress || 0) * 100)}%`);
          }
        }
      }
    );
    
    const textoExtraido = result.data.text;
    const confianca = result.data.confidence;
    
    console.log(`[OCR] Texto extraído (${textoExtraido.length} chars, confiança: ${confianca}%)`);
    
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
    
    // Extrai endereço
    const endereco = extrairEndereco(textoExtraido);
    
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
        valorTotal: dadosNota.valorTotal,
        dataEmissao: dadosNota.dataEmissao
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
