/**
 * @fileoverview Serviço de Consulta Pública SEFAZ
 * 
 * @description Consulta NF-e/NFC-e via portais públicos estaduais
 *              Não requer certificado digital
 * 
 * FUNCIONALIDADES:
 * 1. Consulta NFC-e via URL do QR Code
 * 2. Consulta NF-e via portal estadual
 * 3. Extração de dados do HTML retornado
 * 
 * @pre Chave de acesso com 44 dígitos válida
 * @post Dados da NF-e ou erro específico
 */

// ==========================================
// CONFIGURAÇÃO DE PORTAIS POR UF
// ==========================================

/**
 * URLs dos portais de consulta pública por UF
 * Formato: URL com {chave} como placeholder
 */
const PORTAIS_CONSULTA: Record<string, {
  nfce?: string;  // NFC-e (modelo 65)
  nfe?: string;   // NF-e (modelo 55)
  mobile?: string; // URL mobile (às vezes mais simples)
}> = {
  SP: {
    nfce: 'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p={chave}',
    nfe: 'https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=completa&tipoConteudo=XbSeqxE8PLY=&nfe={chave}',
  },
  MG: {
    nfce: 'https://nfce.fazenda.mg.gov.br/portalnfce/sistema/consultaarg.xhtml?p={chave}',
  },
  RJ: {
    nfce: 'https://www.fazenda.rj.gov.br/nfce/consulta?p={chave}',
  },
  PR: {
    nfce: 'http://www.sped.fazenda.pr.gov.br/nfce/consulta?p={chave}',
  },
  RS: {
    nfce: 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p={chave}',
  },
  SC: {
    nfce: 'https://sat.sef.sc.gov.br/nfce/consulta?p={chave}',
  },
  BA: {
    nfce: 'http://nfe.sefaz.ba.gov.br/servicos/nfce/modulos/geral/NFCEC_consulta_chave_acesso.aspx?p={chave}',
  },
  GO: {
    nfce: 'https://nfce.sefaz.go.gov.br/nfeweb/sites/nfce/consulta-qrcode?p={chave}',
  },
  PE: {
    nfce: 'http://nfce.sefaz.pe.gov.br/nfce/consulta?p={chave}',
  },
  CE: {
    nfce: 'http://nfce.sefaz.ce.gov.br/pages/consultaNota.jsf?p={chave}',
  },
  // SVRS - Sefaz Virtual RS (usado por vários estados menores)
  SVRS: {
    nfce: 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p={chave}',
  }
};

/**
 * Estados que usam SEFAZ Virtual RS
 */
const ESTADOS_SVRS = ['AC', 'AL', 'AP', 'DF', 'ES', 'PB', 'PI', 'RN', 'RO', 'RR', 'SE', 'TO'];

/**
 * Códigos UF IBGE
 */
const UF_CODIGO: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL',
  '28': 'SE', '29': 'BA',
  '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS',
  '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF'
};

// ==========================================
// TIPOS
// ==========================================

export interface DadosNfePublica {
  chaveAcesso: string;
  status: string;
  numero?: number;
  serie?: number;
  dataEmissao?: string;
  valorTotal?: number;
  emitente?: {
    cnpj?: string;
    nome?: string;
    endereco?: string;
  };
  destinatario?: {
    nome?: string;
    documento?: string;
    endereco?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
  };
  fonte: 'PORTAL_SEFAZ' | 'QR_CODE_URL' | 'CACHE';
}

export interface ResultadoConsultaPublica {
  sucesso: boolean;
  dados?: DadosNfePublica;
  erro?: string;
  urlConsultada?: string;
}

// ==========================================
// FUNÇÕES DE CONSULTA
// ==========================================

/**
 * Consulta NF-e/NFC-e via portal público SEFAZ
 * 
 * @pre chave tem 44 dígitos numéricos
 * @post dados da NF-e ou erro
 */
export async function consultarNfePublica(chave: string): Promise<ResultadoConsultaPublica> {
  try {
    // Limpa a chave
    const chaveClean = chave.replace(/\D/g, '');
    
    if (chaveClean.length !== 44) {
      return {
        sucesso: false,
        erro: `Chave deve ter 44 dígitos, recebido: ${chaveClean.length}`
      };
    }

    // Identifica UF e modelo
    const codigoUf = chaveClean.substring(0, 2);
    const modelo = chaveClean.substring(20, 22);
    const uf = UF_CODIGO[codigoUf];

    if (!uf) {
      return {
        sucesso: false,
        erro: `Código UF inválido: ${codigoUf}`
      };
    }

    console.log(`[SEFAZ Pública] Consultando chave ${chaveClean.substring(0, 10)}... UF: ${uf}, Modelo: ${modelo}`);

    // Determina qual portal usar
    let portalUf = uf;
    if (ESTADOS_SVRS.includes(uf)) {
      portalUf = 'SVRS';
    }

    const portal = PORTAIS_CONSULTA[portalUf] || PORTAIS_CONSULTA['SVRS'];
    const tipoNota = modelo === '65' ? 'nfce' : 'nfe';
    
    // Monta URL
    const urlTemplate = portal[tipoNota] || portal.nfce;
    if (!urlTemplate) {
      // Se não tem URL de consulta, tenta extrair dados da própria chave
      return extrairDadosDaChave(chaveClean);
    }

    const url = urlTemplate.replace('{chave}', chaveClean);
    
    console.log(`[SEFAZ Pública] URL: ${url.substring(0, 80)}...`);

    // Faz a requisição
    const response = await fetchComTimeout(url, 10000);
    
    if (!response.ok) {
      console.log(`[SEFAZ Pública] Erro HTTP: ${response.status}`);
      // Fallback: extrai dados da chave
      return extrairDadosDaChave(chaveClean);
    }

    const html = await response.text();
    
    // Extrai dados do HTML
    const dados = extrairDadosDoHtml(html, chaveClean);
    
    if (dados) {
      return {
        sucesso: true,
        dados,
        urlConsultada: url
      };
    }

    // Se não conseguiu extrair do HTML, usa dados da chave
    return extrairDadosDaChave(chaveClean);

  } catch (error) {
    console.error('[SEFAZ Pública] Erro:', error);
    
    // Fallback: pelo menos extrai dados da própria chave
    const chaveClean = chave.replace(/\D/g, '');
    if (chaveClean.length === 44) {
      return extrairDadosDaChave(chaveClean);
    }
    
    return {
      sucesso: false,
      erro: error instanceof Error ? error.message : 'Erro na consulta pública'
    };
  }
}

/**
 * Consulta NFC-e diretamente da URL do QR Code
 * A URL do QR Code já contém todos os parâmetros necessários
 * 
 * @pre url é URL válida de QR Code NFC-e
 * @post dados da NFC-e ou erro
 */
export async function consultarQrCodeUrl(url: string): Promise<ResultadoConsultaPublica> {
  try {
    console.log(`[SEFAZ Pública] Consultando QR Code URL: ${url.substring(0, 60)}...`);

    // Extrai chave da URL
    const chaveMatch = url.match(/[?&](?:p|chNFe|chave)=(\d{44})/i);
    const chave = chaveMatch ? chaveMatch[1] : null;

    // Faz a requisição
    const response = await fetchComTimeout(url, 10000);
    
    if (!response.ok) {
      if (chave) {
        return extrairDadosDaChave(chave);
      }
      return {
        sucesso: false,
        erro: `Erro HTTP: ${response.status}`
      };
    }

    const html = await response.text();
    
    // Extrai dados do HTML
    const dados = extrairDadosDoHtml(html, chave || '');
    
    if (dados) {
      return {
        sucesso: true,
        dados,
        urlConsultada: url
      };
    }

    // Fallback
    if (chave) {
      return extrairDadosDaChave(chave);
    }

    return {
      sucesso: false,
      erro: 'Não foi possível extrair dados do QR Code'
    };

  } catch (error) {
    console.error('[SEFAZ Pública] Erro QR Code:', error);
    return {
      sucesso: false,
      erro: error instanceof Error ? error.message : 'Erro na consulta QR Code'
    };
  }
}

/**
 * Fetch com timeout
 */
async function fetchComTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
      }
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extrai dados do HTML retornado pelo portal SEFAZ
 * Cada estado tem formato ligeiramente diferente
 */
function extrairDadosDoHtml(html: string, chave: string): DadosNfePublica | null {
  try {
    // Padrões comuns nos portais SEFAZ
    const dados: DadosNfePublica = {
      chaveAcesso: chave,
      status: 'CONSULTADA',
      fonte: 'PORTAL_SEFAZ'
    };

    // Status da nota
    if (html.includes('Autorizado') || html.includes('AUTORIZADA') || html.includes('100 - Autorizado')) {
      dados.status = 'AUTORIZADA';
    } else if (html.includes('Cancelada') || html.includes('CANCELADA')) {
      dados.status = 'CANCELADA';
    } else if (html.includes('Denegada') || html.includes('DENEGADA')) {
      dados.status = 'DENEGADA';
    }

    // Nome do emitente (vários padrões)
    const emitentePatterns = [
      /(?:Emitente|Razão Social|Nome[\s\/]*Razão)[:\s]*([^<\n]+)/i,
      /<(?:td|span|div)[^>]*>([A-ZÀ-Ú\s]+(?:LTDA|S\.?A\.?|ME|EPP|EIRELI)[^<]*)</i,
      /class="(?:txtTopo|nomeEmitente|razaoSocial)"[^>]*>([^<]+)</i
    ];
    for (const pattern of emitentePatterns) {
      const match = html.match(pattern);
      if (match && match[1].trim().length > 5) {
        dados.emitente = { nome: match[1].trim().toUpperCase() };
        break;
      }
    }

    // CNPJ emitente
    const cnpjEmitenteMatch = html.match(/CNPJ[:\s]*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i);
    if (cnpjEmitenteMatch && dados.emitente) {
      dados.emitente.cnpj = cnpjEmitenteMatch[1].replace(/\D/g, '');
    }

    // Nome do destinatário
    const destPatterns = [
      /(?:Destinatário|Consumidor|Cliente)[:\s]*([A-ZÀ-Ú\s]+)/i,
      /Dest(?:inatário)?[^>]*>([^<]+)</i,
      /Nome[:\s]+([A-ZÀ-Ú\s]{5,})/i
    ];
    for (const pattern of destPatterns) {
      const match = html.match(pattern);
      if (match && match[1].trim().length > 3) {
        dados.destinatario = { nome: match[1].trim() };
        break;
      }
    }

    // Endereço do destinatário
    const endPatterns = [
      /Endere[çc]o[:\s]*([^<\n]+(?:,\s*\d+)?)/i,
      /Logradouro[:\s]*([^<\n]+)/i,
      /((?:RUA|AV\.|AVENIDA|ALAMEDA|TRAVESSA)[^<\n,]+,?\s*\d*)/i
    ];
    for (const pattern of endPatterns) {
      const match = html.match(pattern);
      if (match && match[1].trim().length > 5) {
        if (dados.destinatario) {
          dados.destinatario.endereco = match[1].trim();
        } else {
          dados.destinatario = { endereco: match[1].trim() };
        }
        break;
      }
    }

    // Bairro
    const bairroMatch = html.match(/Bairro[:\s]*([^<\n]+)/i);
    if (bairroMatch && dados.destinatario) {
      dados.destinatario.bairro = bairroMatch[1].trim();
    }

    // Cidade
    const cidadeMatch = html.match(/(?:Cidade|Município)[:\s]*([^<\n]+)/i);
    if (cidadeMatch && dados.destinatario) {
      dados.destinatario.cidade = cidadeMatch[1].trim();
    }

    // UF do destinatário
    const ufDestMatch = html.match(/\b([A-Z]{2})\b(?=\s*(?:\d{5}-?\d{3}|CEP|<))/);
    if (ufDestMatch && dados.destinatario) {
      const uf = ufDestMatch[1].toUpperCase();
      if (Object.values(UF_CODIGO).includes(uf)) {
        dados.destinatario.uf = uf;
      }
    }

    // CEP
    const cepMatch = html.match(/CEP[:\s]*(\d{5}-?\d{3})|(\d{5}-\d{3})/i);
    if (cepMatch && dados.destinatario) {
      dados.destinatario.cep = (cepMatch[1] || cepMatch[2]).replace(/\D/g, '');
    }

    // Valor total
    const valorPatterns = [
      /(?:Valor\s*Total|Total\s*da\s*Nota|TOTAL)[:\s]*R?\$?\s*([\d.,]+)/i,
      />([\d.]+,\d{2})</
    ];
    for (const pattern of valorPatterns) {
      const match = html.match(pattern);
      if (match) {
        const valorStr = match[1].replace(/\./g, '').replace(',', '.');
        const valor = parseFloat(valorStr);
        if (!isNaN(valor) && valor > 0) {
          dados.valorTotal = valor;
          break;
        }
      }
    }

    // Número da nota
    const numeroMatch = html.match(/(?:Número|N[°º])[:\s]*(\d+)/i);
    if (numeroMatch) {
      dados.numero = parseInt(numeroMatch[1], 10);
    }

    // Série
    const serieMatch = html.match(/S[ée]rie[:\s]*(\d+)/i);
    if (serieMatch) {
      dados.serie = parseInt(serieMatch[1], 10);
    }

    // Data emissão
    const dataMatch = html.match(/(?:Data|Emiss[ãa]o)[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
    if (dataMatch) {
      dados.dataEmissao = dataMatch[1];
    }

    // Verifica se conseguiu extrair informações úteis
    if (dados.emitente || dados.destinatario || dados.valorTotal) {
      return dados;
    }

    return null;

  } catch (error) {
    console.error('[SEFAZ Pública] Erro ao extrair HTML:', error);
    return null;
  }
}

/**
 * Extrai dados básicos da própria chave de acesso
 * Usado como fallback quando consulta online falha
 */
function extrairDadosDaChave(chave: string): ResultadoConsultaPublica {
  try {
    const codigoUf = chave.substring(0, 2);
    const anoMes = chave.substring(2, 6);
    const cnpjEmitente = chave.substring(6, 20);
    const modelo = chave.substring(20, 22);
    const serie = chave.substring(22, 25);
    const numero = chave.substring(25, 34);

    const uf = UF_CODIGO[codigoUf] || 'XX';
    const ano = `20${anoMes.substring(0, 2)}`;
    const mes = anoMes.substring(2, 4);

    const dados: DadosNfePublica = {
      chaveAcesso: chave,
      status: 'CHAVE_VALIDA',
      numero: parseInt(numero, 10),
      serie: parseInt(serie, 10),
      dataEmissao: `01/${mes}/${ano}`, // Aproximado
      emitente: {
        cnpj: cnpjEmitente
      },
      fonte: 'CACHE'
    };

    // Adiciona UF no destinatário como pista
    dados.destinatario = {
      uf: uf
    };

    console.log(`[SEFAZ Pública] Dados extraídos da chave: NF-e ${numero}, Série ${serie}, UF ${uf}`);

    return {
      sucesso: true,
      dados,
      erro: 'Consulta online indisponível. Dados extraídos da chave.'
    };

  } catch (error) {
    return {
      sucesso: false,
      erro: 'Falha ao extrair dados da chave'
    };
  }
}

/**
 * Valida se URL é de QR Code SEFAZ válida
 */
export function isQrCodeSefaz(url: string): boolean {
  const patterns = [
    /nfce\.fazenda/i,
    /nfe\.fazenda/i,
    /sefaz/i,
    /sat\.sef/i,
    /nfce\.set/i,
    /nfce\.sefin/i,
    /portalsped/i,
    /[?&]p=\d{44}/,
    /[?&]chNFe=\d{44}/i
  ];

  return patterns.some(p => p.test(url));
}

/**
 * Extrai chave de 44 dígitos de URL de QR Code
 */
export function extrairChaveDeUrl(url: string): string | null {
  // Padrão 1: p=CHAVE ou chNFe=CHAVE
  const paramMatch = url.match(/[?&](?:p|chNFe|chave)=(\d{44})/i);
  if (paramMatch) {
    return paramMatch[1];
  }

  // Padrão 2: chave na URL (sequência de 44 dígitos)
  const digitsMatch = url.match(/\d{44}/);
  if (digitsMatch) {
    return digitsMatch[0];
  }

  return null;
}
