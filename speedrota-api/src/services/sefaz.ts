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

    // 4. Montar requisição SOAP
    // NOTA: Implementação simplificada para demonstração
    // Produção requer assinatura digital e bibliotecas SOAP
    
    if (ambiente === 'PRODUCAO' && !config?.certificadoBase64) {
      return {
        sucesso: false,
        erro: 'Certificado digital obrigatório para ambiente de produção',
        cache: false,
        consultaEm: new Date()
      };
    }

    // Simulação de consulta (substituir por SOAP real em produção)
    const dadosSimulados = await simularConsultaSefaz(chaveInfo);
    
    // 5. Salvar no cache
    if (dadosSimulados) {
      await salvarCache(dadosSimulados);
    }

    return {
      sucesso: true,
      dados: dadosSimulados,
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
 * Simulação de consulta SEFAZ para testes/homologação
 * Em produção, substituir por chamada SOAP real
 */
async function simularConsultaSefaz(chave: ChaveNfe): Promise<DadosNfe> {
  // Simular latência de rede
  await new Promise(resolve => setTimeout(resolve, 500));

  const uf = UF_CODIGO[chave.uf];
  
  return {
    chaveAcesso: chave.chave,
    status: 'AUTORIZADA',
    numero: parseInt(chave.numero),
    serie: parseInt(chave.serie),
    dataEmissao: new Date(),
    valorTotal: 299.90,
    pesoTotal: 2.5,
    volumesTotal: 1,
    emitente: {
      cnpj: chave.cnpjEmitente,
      nome: 'NATURA COSMETICOS SA'
    },
    destinatario: {
      nome: 'JOÃO DA SILVA',
      documento: '12345678900',
      endereco: 'RUA DAS FLORES, 123',
      bairro: 'CENTRO',
      cidade: 'SÃO PAULO',
      uf: uf,
      cep: '01234567'
    },
    itens: [
      {
        codigo: 'NAT001',
        descricao: 'Perfume Natura',
        quantidade: 2,
        unidade: 'UN',
        valorUnitario: 149.95,
        valorTotal: 299.90,
        peso: 1.25
      }
    ]
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
