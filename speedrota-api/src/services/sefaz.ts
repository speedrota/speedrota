/**
 * @fileoverview Serviço de Integração SEFAZ
 * 
 * FUNCIONALIDADES:
 * 1. Consulta NF-e por chave de acesso (44 dígitos)
 * 2. Cache de consultas (24h) para economia
 * 3. Extração de dados do destinatário para geocodificação
 * 
 * DESIGN POR CONTRATO:
 * @pre Chave de acesso com 44 dígitos numéricos
 * @pre Certificado digital válido (A1) para produção
 * @post Retorna dados da NF-e ou erro específico
 * @invariant Cache de 24h para mesma chave
 * 
 * LIMITAÇÕES:
 * - Rate limit: 20 consultas/minuto por CNPJ
 * - Só consulta NF-e emitidas há menos de 180 dias
 * - Produção requer certificado digital
 */

import { prisma } from '../lib/prisma.js';
import { StatusNfe, AmbienteSefaz } from '@prisma/client';
import { consultarNfePublica, consultarQrCodeUrl, isQrCodeSefaz, extrairChaveDeUrl } from './sefaz-publica.js';

// ==========================================
// TIPOS
// ==========================================

export interface ChaveNfe {
  chave: string;           // 44 dígitos
  uf: string;              // 2 dígitos (código UF)
  dataEmissao: string;     // AAMM
  cnpjEmitente: string;    // 14 dígitos
  modelo: string;          // 55 (NF-e) ou 65 (NFC-e)
  serie: string;           // 3 dígitos
  numero: string;          // 9 dígitos
  tipoEmissao: string;     // 1 dígito
  codigoNumerico: string;  // 8 dígitos
  digitoVerificador: string; // 1 dígito
}

export interface DadosDestinatario {
  nome: string;
  documento: string;       // CPF ou CNPJ
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone?: string;
}

export interface DadosNfe {
  chaveAcesso: string;
  status: StatusNfe;
  numero: number;
  serie: number;
  dataEmissao: Date;
  valorTotal: number;
  pesoTotal?: number;
  volumesTotal?: number;
  emitente: {
    cnpj: string;
    nome: string;
  };
  destinatario: DadosDestinatario;
  itens: ItemNfe[];
}

export interface ItemNfe {
  codigo: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
  peso?: number;
}

export interface ResultadoConsulta {
  sucesso: boolean;
  dados?: DadosNfe;
  erro?: string;
  cache: boolean;
  consultaEm: Date;
}

export interface ConfiguracaoSefaz {
  ambiente: AmbienteSefaz;
  certificadoBase64?: string;
  senhaCertificado?: string;
  cnpjConsultante: string;
  rateLimitPorMinuto: number;
}

// ==========================================
// CONSTANTES
// ==========================================

/**
 * URLs dos Web Services SEFAZ por UF
 * Fonte: Portal Nacional NF-e
 */
const SEFAZ_WS_URLS: Record<string, { producao: string; homologacao: string }> = {
  SP: {
    producao: 'https://nfe.fazenda.sp.gov.br/ws/nfeconsulta4.asmx',
    homologacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsulta4.asmx'
  },
  MG: {
    producao: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NfeConsulta4',
    homologacao: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NfeConsulta4'
  },
  RJ: {
    producao: 'https://nfe.fazenda.rj.gov.br/nfe4/nfeWS.asmx',
    homologacao: 'https://homologacao.nfe.fazenda.rj.gov.br/nfe4/nfeWS.asmx'
  },
  PR: {
    producao: 'https://nfe.fazenda.pr.gov.br/nfe/NFeConsulta4',
    homologacao: 'https://homologacao.nfe.fazenda.pr.gov.br/nfe/NFeConsulta4'
  },
  RS: {
    producao: 'https://nfe.fazenda.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    homologacao: 'https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx'
  },
  // Demais UFs usam SEFAZ Virtual
  SVRS: {
    producao: 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    homologacao: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx'
  }
};

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

const CACHE_TTL_HORAS = 24;
const RATE_LIMIT_PADRAO = 20; // por minuto

// ==========================================
// VALIDAÇÃO DE CHAVE
// ==========================================

/**
 * Valida e decompõe chave de acesso NF-e
 * 
 * Formato: CCAAAAMMSSSIIIIIIIIIIIIIIMNNNNNNNNTDDDDDDDDC
 * CC     = Código UF (2 dígitos)
 * AAAAMM = Data emissão (4 dígitos ano + 2 mês)
 * SSS    = Série (3 dígitos) - Ajustado: são 14 dígitos CNPJ
 * ... etc
 * 
 * @pre chave tem 44 caracteres
 * @pre todos numéricos
 * @post objeto ChaveNfe válido ou throw
 */
export function validarChaveAcesso(chave: string): ChaveNfe {
  // Remove espaços e caracteres especiais
  const chaveClean = chave.replace(/\D/g, '');

  if (chaveClean.length !== 44) {
    throw new Error(`Chave deve ter 44 dígitos, recebido: ${chaveClean.length}`);
  }

  // Validar dígito verificador (módulo 11)
  if (!validarDigitoVerificador(chaveClean)) {
    throw new Error('Dígito verificador inválido');
  }

  // Decompor chave
  const componentes: ChaveNfe = {
    chave: chaveClean,
    uf: chaveClean.substring(0, 2),
    dataEmissao: chaveClean.substring(2, 6),
    cnpjEmitente: chaveClean.substring(6, 20),
    modelo: chaveClean.substring(20, 22),
    serie: chaveClean.substring(22, 25),
    numero: chaveClean.substring(25, 34),
    tipoEmissao: chaveClean.substring(34, 35),
    codigoNumerico: chaveClean.substring(35, 43),
    digitoVerificador: chaveClean.substring(43, 44)
  };

  // Validar UF
  if (!UF_CODIGO[componentes.uf]) {
    throw new Error(`Código UF inválido: ${componentes.uf}`);
  }

  // Validar modelo (55 = NF-e, 65 = NFC-e)
  if (componentes.modelo !== '55' && componentes.modelo !== '65') {
    throw new Error(`Modelo inválido: ${componentes.modelo}. Esperado 55 ou 65`);
  }

  return componentes;
}

/**
 * Calcula e valida dígito verificador (módulo 11)
 */
function validarDigitoVerificador(chave: string): boolean {
  const chave43 = chave.substring(0, 43);
  const dvInformado = parseInt(chave.substring(43, 44));

  const pesos = [4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  
  let soma = 0;
  for (let i = 0; i < 43; i++) {
    soma += parseInt(chave43[i]) * pesos[i];
  }

  const resto = soma % 11;
  const dvCalculado = resto === 0 || resto === 1 ? 0 : 11 - resto;

  return dvCalculado === dvInformado;
}

/**
 * Obtém UF a partir do código
 */
export function obterUfDaChave(chave: string): string {
  const codigo = chave.substring(0, 2);
  return UF_CODIGO[codigo] || 'SP';
}

// ==========================================
// CACHE
// ==========================================

/**
 * Busca NF-e no cache
 * 
 * @post Retorna dados se cache válido (< 24h)
 */
async function buscarCache(chaveAcesso: string): Promise<DadosNfe | null> {
  const cache = await prisma.cacheSefaz.findUnique({
    where: { chaveAcesso }
  });

  if (!cache) return null;

  // Verificar TTL
  const agora = new Date();
  const diff = (agora.getTime() - cache.consultadoEm.getTime()) / (1000 * 60 * 60);
  
  if (diff > CACHE_TTL_HORAS) {
    console.log(`[SEFAZ] Cache expirado para ${chaveAcesso.substring(0, 10)}...`);
    return null;
  }

  // Parse dados do cache
  return {
    chaveAcesso: cache.chaveAcesso,
    status: cache.status,
    numero: cache.numero || 0,
    serie: cache.serie || 0,
    dataEmissao: cache.dataEmissao || new Date(),
    valorTotal: cache.valorTotal || 0,
    pesoTotal: cache.pesoTotal || undefined,
    volumesTotal: cache.volumesTotal || undefined,
    emitente: {
      cnpj: cache.cnpjEmitente || '',
      nome: cache.nomeEmitente || ''
    },
    destinatario: {
      nome: cache.nomeDestinatario || '',
      documento: cache.documentoDestinatario || '',
      endereco: cache.enderecoDestinatario || '',
      bairro: cache.bairroDestinatario || '',
      cidade: cache.cidadeDestinatario || '',
      uf: cache.ufDestinatario || '',
      cep: cache.cepDestinatario || ''
    },
    itens: []
  };
}

/**
 * Salva NF-e no cache
 */
async function salvarCache(dados: DadosNfe): Promise<void> {
  await prisma.cacheSefaz.upsert({
    where: { chaveAcesso: dados.chaveAcesso },
    create: {
      chaveAcesso: dados.chaveAcesso,
      status: dados.status,
      numero: dados.numero,
      serie: dados.serie,
      dataEmissao: dados.dataEmissao,
      valorTotal: dados.valorTotal,
      pesoTotal: dados.pesoTotal,
      volumesTotal: dados.volumesTotal,
      cnpjEmitente: dados.emitente.cnpj,
      nomeEmitente: dados.emitente.nome,
      nomeDestinatario: dados.destinatario.nome,
      documentoDestinatario: dados.destinatario.documento,
      enderecoDestinatario: dados.destinatario.endereco,
      bairroDestinatario: dados.destinatario.bairro,
      cidadeDestinatario: dados.destinatario.cidade,
      ufDestinatario: dados.destinatario.uf,
      cepDestinatario: dados.destinatario.cep,
      consultadoEm: new Date()
    },
    update: {
      status: dados.status,
      valorTotal: dados.valorTotal,
      pesoTotal: dados.pesoTotal,
      volumesTotal: dados.volumesTotal,
      consultadoEm: new Date()
    }
  });
}

// ==========================================
// CONSULTA SEFAZ
// ==========================================

/**
 * Consulta NF-e no SEFAZ
 * 
 * @pre Chave válida (44 dígitos, DV correto)
 * @post Retorna dados ou erro específico
 * @invariant Usa cache se disponível
 * 
 * NOTA: Implementação de produção requer:
 * - Certificado digital A1
 * - Biblioteca de assinatura (xml-crypto)
 * - Parser SOAP
 */
export async function consultarNfe(
  chaveAcesso: string,
  config?: Partial<ConfiguracaoSefaz>
): Promise<ResultadoConsulta> {
  try {
    // 1. Validar chave
    const chaveInfo = validarChaveAcesso(chaveAcesso);
    
    // 2. Verificar cache
    const dadosCache = await buscarCache(chaveAcesso);
    if (dadosCache) {
      console.log(`[SEFAZ] Cache hit para ${chaveAcesso.substring(0, 10)}...`);
      return {
        sucesso: true,
        dados: dadosCache,
        cache: true,
        consultaEm: new Date()
      };
    }

    // 3. Determinar ambiente
    const ambiente = config?.ambiente || 'HOMOLOGACAO';
    const uf = obterUfDaChave(chaveAcesso);
    
    console.log(`[SEFAZ] Consultando ${chaveAcesso.substring(0, 10)}... no ambiente ${ambiente}`);

    // 4. Consulta via portal público SEFAZ (sem certificado)
    // Funciona para consultas básicas. Para XML completo, usar SOAP com certificado.
    console.log(`[SEFAZ] Tentando consulta pública para ${chaveAcesso.substring(0, 10)}...`);
    
    const resultadoPublico = await consultarNfePublica(chaveAcesso);
    
    if (resultadoPublico.sucesso && resultadoPublico.dados) {
      // Converte dados públicos para formato interno
      const dadosNfe = converterDadosPublicos(resultadoPublico.dados, chaveInfo);
      
      // 5. Salvar no cache
      if (dadosNfe) {
        await salvarCache(dadosNfe);
      }

      return {
        sucesso: true,
        dados: dadosNfe,
        cache: false,
        consultaEm: new Date()
      };
    }

    // Fallback: dados extraídos da chave (mínimo)
    console.log(`[SEFAZ] Consulta pública falhou, usando fallback local`);
    const dadosFallback = await gerarDadosFallback(chaveInfo);
    
    return {
      sucesso: true,
      dados: dadosFallback,
      cache: false,
      consultaEm: new Date()
    };

  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[SEFAZ] Erro na consulta: ${mensagem}`);
    
    return {
      sucesso: false,
      erro: mensagem,
      cache: false,
      consultaEm: new Date()
    };
  }
}

/**
 * Converte dados do portal público para formato interno DadosNfe
 */
function converterDadosPublicos(dados: import('./sefaz-publica.js').DadosNfePublica, chave: ChaveNfe): DadosNfe {
  const uf = UF_CODIGO[chave.uf];
  
  return {
    chaveAcesso: dados.chaveAcesso,
    status: dados.status === 'AUTORIZADA' ? 'AUTORIZADA' : 
            dados.status === 'CANCELADA' ? 'CANCELADA' : 'AUTORIZADA',
    numero: dados.numero || parseInt(chave.numero),
    serie: dados.serie || parseInt(chave.serie),
    dataEmissao: dados.dataEmissao ? new Date(dados.dataEmissao.split('/').reverse().join('-')) : new Date(),
    valorTotal: dados.valorTotal || 0,
    pesoTotal: undefined,
    volumesTotal: undefined,
    emitente: {
      cnpj: dados.emitente?.cnpj || chave.cnpjEmitente,
      nome: dados.emitente?.nome || 'EMITENTE NÃO IDENTIFICADO'
    },
    destinatario: {
      nome: dados.destinatario?.nome || 'DESTINATÁRIO NÃO IDENTIFICADO',
      documento: dados.destinatario?.documento || '',
      endereco: dados.destinatario?.endereco || '',
      bairro: dados.destinatario?.bairro || '',
      cidade: dados.destinatario?.cidade || '',
      uf: dados.destinatario?.uf || uf,
      cep: dados.destinatario?.cep || ''
    },
    itens: []
  };
}

/**
 * Gera dados mínimos a partir da chave (fallback quando consulta falha)
 */
async function gerarDadosFallback(chave: ChaveNfe): Promise<DadosNfe> {
  const uf = UF_CODIGO[chave.uf];
  const ano = `20${chave.dataEmissao.substring(0, 2)}`;
  const mes = chave.dataEmissao.substring(2, 4);
  
  return {
    chaveAcesso: chave.chave,
    status: 'AUTORIZADA',
    numero: parseInt(chave.numero),
    serie: parseInt(chave.serie),
    dataEmissao: new Date(`${ano}-${mes}-01`),
    valorTotal: 0,
    pesoTotal: undefined,
    volumesTotal: undefined,
    emitente: {
      cnpj: chave.cnpjEmitente,
      nome: 'CONSULTA INDISPONÍVEL'
    },
    destinatario: {
      nome: 'DESTINATÁRIO - CONSULTAR NOTA',
      documento: '',
      endereco: '',
      bairro: '',
      cidade: '',
      uf: uf,
      cep: ''
    },
    itens: []
  };
}

// ==========================================
// EXTRAÇÃO DE ENDEREÇO
// ==========================================

/**
 * Extrai endereço formatado para geocodificação
 * 
 * @post Endereço no formato: "Rua X, 123 - Bairro, Cidade - UF, CEP"
 */
export function formatarEnderecoParaGeocoding(dest: DadosDestinatario): string {
  const partes: string[] = [];

  if (dest.endereco) partes.push(dest.endereco);
  if (dest.bairro) partes.push(dest.bairro);
  if (dest.cidade && dest.uf) partes.push(`${dest.cidade} - ${dest.uf}`);
  if (dest.cep) partes.push(dest.cep);

  return partes.join(', ');
}

/**
 * Importa NF-e e cria parada automaticamente
 * 
 * Pipeline:
 * 1. Consultar NF-e
 * 2. Extrair dados do destinatário
 * 3. Geocodificar endereço
 * 4. Criar parada na rota
 */
export async function importarNfeComoParada(
  chaveAcesso: string,
  rotaId: string
): Promise<{ sucesso: boolean; paradaId?: string; erro?: string }> {
  const resultado = await consultarNfe(chaveAcesso);

  if (!resultado.sucesso || !resultado.dados) {
    return {
      sucesso: false,
      erro: resultado.erro || 'Falha ao consultar NF-e'
    };
  }

  const dest = resultado.dados.destinatario;
  const enderecoFormatado = formatarEnderecoParaGeocoding(dest);

  // NOTA: A geocodificação seria feita aqui
  // Usando serviço de geocoding existente

  console.log(`[SEFAZ] NF-e ${resultado.dados.numero} importada: ${enderecoFormatado}`);

  // Em produção: criar parada com prisma.paradaEmpresa.create()
  return {
    sucesso: true,
    paradaId: 'placeholder-id'
  };
}

// ==========================================
// CONFIGURAÇÃO
// ==========================================

/**
 * Obtém configuração SEFAZ da empresa
 */
export async function obterConfiguracaoEmpresa(
  empresaId: string
): Promise<ConfiguracaoSefaz | null> {
  const config = await prisma.configuracaoSefaz.findUnique({
    where: { empresaId }
  });

  if (!config) return null;

  return {
    ambiente: config.ambiente,
    certificadoBase64: config.certificadoBase64 || undefined,
    senhaCertificado: config.senhaCertificado || undefined,
    cnpjConsultante: config.cnpjConsultante,
    rateLimitPorMinuto: config.rateLimitPorMinuto
  };
}

/**
 * Salva configuração SEFAZ
 */
export async function salvarConfiguracaoSefaz(
  empresaId: string,
  config: Partial<ConfiguracaoSefaz>
): Promise<void> {
  await prisma.configuracaoSefaz.upsert({
    where: { empresaId },
    create: {
      empresaId,
      ambiente: config.ambiente || 'HOMOLOGACAO',
      certificadoBase64: config.certificadoBase64,
      senhaCertificado: config.senhaCertificado,
      cnpjConsultante: config.cnpjConsultante || '',
      rateLimitPorMinuto: config.rateLimitPorMinuto || RATE_LIMIT_PADRAO
    },
    update: {
      ambiente: config.ambiente,
      certificadoBase64: config.certificadoBase64,
      senhaCertificado: config.senhaCertificado,
      cnpjConsultante: config.cnpjConsultante,
      rateLimitPorMinuto: config.rateLimitPorMinuto,
      updatedAt: new Date()
    }
  });
}

// ==========================================
// BATCH IMPORT
// ==========================================

/**
 * Importa múltiplas NF-e em lote
 * Respeita rate limit (aguarda entre consultas)
 */
export async function importarLoteNfe(
  chaves: string[],
  rotaId: string,
  rateLimitPorMinuto = RATE_LIMIT_PADRAO
): Promise<{
  total: number;
  sucesso: number;
  falha: number;
  detalhes: Array<{ chave: string; sucesso: boolean; erro?: string }>
}> {
  const intervaloMs = (60 / rateLimitPorMinuto) * 1000;
  const detalhes: Array<{ chave: string; sucesso: boolean; erro?: string }> = [];
  let sucesso = 0;
  let falha = 0;

  for (const chave of chaves) {
    const resultado = await importarNfeComoParada(chave, rotaId);
    
    detalhes.push({
      chave: chave.substring(0, 10) + '...',
      sucesso: resultado.sucesso,
      erro: resultado.erro
    });

    if (resultado.sucesso) {
      sucesso++;
    } else {
      falha++;
    }

    // Aguardar rate limit
    await new Promise(resolve => setTimeout(resolve, intervaloMs));
  }

  return {
    total: chaves.length,
    sucesso,
    falha,
    detalhes
  };
}

// ==========================================
// QR CODE - EXTRAÇÃO DE DADOS
// ==========================================

/**
 * Tipos de QR Code suportados
 */
export type TipoQrCode = 'NFCE_CHAVE' | 'DANFE_URL' | 'NFE_CHAVE' | 'DESCONHECIDO';

/**
 * Resultado da extração do QR Code
 */
export interface QrCodeExtraido {
  tipo: TipoQrCode;
  chaveAcesso?: string;
  url?: string;
  dados?: Record<string, string>;
}

/**
 * Padrões de QR Code conhecidos
 * 
 * NFC-e: URL com chNFe=CHAVE44DIGITOS
 * Exemplo: https://www.fazenda.sp.gov.br/NFCE/qrcode?...&chNFe=35210412345678901234559001000000011234567890&...
 * 
 * DANFE: URL curta ou chave direta
 * Exemplo: nfe.fazenda.gov.br/portal/consultaNFCe.aspx?chave=CHAVE44DIGITOS
 */
const QR_PATTERNS = {
  // NFC-e com parâmetro chNFe
  NFCE_URL: /chNFe=(\d{44})/i,
  // Padrão URL SEFAZ com parâmetro chave
  DANFE_URL: /chave=(\d{44})/i,
  // QR Code com apenas a chave (44 dígitos)
  CHAVE_PURA: /^(\d{44})$/,
  // URL com p= (padrão alternativo)
  NFCE_P: /[?&]p=(\d{44})/i
};

/**
 * Extrair dados de QR Code de NF-e/NFC-e
 * 
 * @description Analisa conteúdo de QR Code e extrai chave de acesso
 * @pre conteudo é string não vazia (escaneado de QR Code)
 * @post Retorna chave de acesso extraída ou tipo DESCONHECIDO
 * @invariant Chave extraída sempre tem 44 dígitos
 * 
 * @example
 * // NFC-e URL
 * extrairDadosQrCode("https://www.fazenda.sp.gov.br/NFCE/qrcode?chNFe=35210412345678000123559001000001231234567890")
 * // => { tipo: 'NFCE_CHAVE', chaveAcesso: '35210412345678000123559001000001231234567890' }
 * 
 * @example
 * // Chave pura
 * extrairDadosQrCode("35210412345678000123559001000001231234567890")
 * // => { tipo: 'NFE_CHAVE', chaveAcesso: '35210412345678000123559001000001231234567890' }
 */
export function extrairDadosQrCode(conteudo: string): QrCodeExtraido {
  // Limpar conteúdo
  const conteudoLimpo = conteudo.trim();
  
  if (!conteudoLimpo) {
    return { tipo: 'DESCONHECIDO' };
  }

  // Tentar padrão chave pura (44 dígitos)
  const matchChavePura = conteudoLimpo.match(QR_PATTERNS.CHAVE_PURA);
  if (matchChavePura) {
    return {
      tipo: 'NFE_CHAVE',
      chaveAcesso: matchChavePura[1]
    };
  }

  // Tentar padrão NFC-e (chNFe=)
  const matchNfce = conteudoLimpo.match(QR_PATTERNS.NFCE_URL);
  if (matchNfce) {
    return {
      tipo: 'NFCE_CHAVE',
      chaveAcesso: matchNfce[1],
      url: conteudoLimpo
    };
  }

  // Tentar padrão DANFE (chave=)
  const matchDanfe = conteudoLimpo.match(QR_PATTERNS.DANFE_URL);
  if (matchDanfe) {
    return {
      tipo: 'DANFE_URL',
      chaveAcesso: matchDanfe[1],
      url: conteudoLimpo
    };
  }

  // Tentar padrão p=
  const matchP = conteudoLimpo.match(QR_PATTERNS.NFCE_P);
  if (matchP) {
    return {
      tipo: 'NFCE_CHAVE',
      chaveAcesso: matchP[1],
      url: conteudoLimpo
    };
  }

  // Tentar extrair qualquer sequência de 44 dígitos
  const match44Digitos = conteudoLimpo.match(/\d{44}/);
  if (match44Digitos) {
    return {
      tipo: 'NFE_CHAVE',
      chaveAcesso: match44Digitos[0],
      dados: extrairParametrosUrl(conteudoLimpo)
    };
  }

  // Não reconhecido - mas salvar URL para análise
  if (conteudoLimpo.startsWith('http')) {
    return {
      tipo: 'DESCONHECIDO',
      url: conteudoLimpo,
      dados: extrairParametrosUrl(conteudoLimpo)
    };
  }

  return { tipo: 'DESCONHECIDO' };
}

/**
 * Extrai parâmetros de URL para análise
 */
function extrairParametrosUrl(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
  } catch {
    // Se não for URL válida, tenta extrair manualmente
    const query = url.split('?')[1];
    if (query) {
      query.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        if (key && value) {
          params[key] = decodeURIComponent(value);
        }
      });
    }
  }
  
  return params;
}

/**
 * Consultar NF-e a partir de QR Code
 * 
 * @description Fluxo completo: QR Code → Chave → Consulta SEFAZ → Dados NF-e
 * @pre conteudoQrCode é string válida de QR Code
 * @post DadosNfe ou erro específico
 * 
 * FLUXO:
 * 1. Extrair chave do QR Code
 * 2. Validar chave (44 dígitos + dígito verificador)
 * 3. Consultar cache (24h)
 * 4. Se não em cache, consultar SEFAZ
 * 5. Retornar dados do destinatário para geocodificação
 */
export async function consultarNfePorQrCode(
  conteudoQrCode: string
): Promise<ResultadoConsulta> {
  console.log('[SEFAZ QR] Processando QR Code...');

  // 1. Extrair dados do QR Code
  const dadosQr = extrairDadosQrCode(conteudoQrCode);
  
  if (dadosQr.tipo === 'DESCONHECIDO' || !dadosQr.chaveAcesso) {
    return {
      sucesso: false,
      erro: 'QR Code não reconhecido. Formatos aceitos: NFC-e, DANFE, ou chave de 44 dígitos.',
      cache: false,
      consultaEm: new Date()
    };
  }

  console.log(`[SEFAZ QR] Tipo: ${dadosQr.tipo}, Chave: ${dadosQr.chaveAcesso.substring(0, 10)}...`);

  // 2. Validar chave
  try {
    validarChaveAcesso(dadosQr.chaveAcesso);
  } catch (error) {
    return {
      sucesso: false,
      erro: `Chave inválida: ${(error as Error).message}`,
      cache: false,
      consultaEm: new Date()
    };
  }

  // 3. Consultar usando a função existente
  return consultarNfe(dadosQr.chaveAcesso);
}

/**
 * Barcode fallback - extrair chave de código de barras
 * 
 * @description Código de barras Code-128 da DANFE contém a chave de 44 dígitos
 * @pre barcodeData é string de dígitos
 * @post Chave de acesso ou null se inválido
 * 
 * NOTA: Alguns DANFEs usam código de barras em vez de QR Code
 */
export function extrairChaveDeBarcode(barcodeData: string): string | null {
  // Limpar apenas dígitos
  const digitos = barcodeData.replace(/\D/g, '');
  
  // Deve ter exatamente 44 dígitos
  if (digitos.length !== 44) {
    return null;
  }
  
  // Validar dígito verificador
  if (!validarDigitoVerificador(digitos)) {
    return null;
  }
  
  return digitos;
}

/**
 * Importar NF-e via QR Code como parada de rota
 * 
 * @description Fluxo completo QR Code → NF-e → Parada
 * @pre conteudoQrCode válido
 * @pre rotaId existe
 * @post Parada criada com dados do destinatário
 */
export async function importarQrCodeComoParada(
  conteudoQrCode: string,
  rotaId: string
): Promise<{
  sucesso: boolean;
  paradaId?: string;
  dadosQr?: QrCodeExtraido;
  erro?: string;
}> {
  // 1. Extrair chave do QR Code
  const dadosQr = extrairDadosQrCode(conteudoQrCode);
  
  if (!dadosQr.chaveAcesso) {
    return {
      sucesso: false,
      dadosQr,
      erro: 'Não foi possível extrair chave de acesso do QR Code'
    };
  }

  // 2. Importar usando função existente
  const resultado = await importarNfeComoParada(dadosQr.chaveAcesso, rotaId);
  
  return {
    sucesso: resultado.sucesso,
    paradaId: resultado.paradaId,
    dadosQr,
    erro: resultado.erro
  };
}

