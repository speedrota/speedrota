/**
 * @fileoverview Tipos e interfaces do SpeedRota
 * 
 * DESIGN POR CONTRATO:
 * - Pré-condições: valores validados antes de criar objetos
 * - Pós-condições: resultados dentro de ranges esperados
 * - Invariantes: IDs únicos, coordenadas válidas
 */

// ==========================================
// PLANOS DE ASSINATURA
// ==========================================

/**
 * Planos disponíveis baseado em análise competitiva (Fev/2026)
 * 
 * INDIVIDUAIS (autônomos, MEI):
 * - FREE: Teste, 3 rotas/dia
 * - STARTER: R$29,90 - MEI/Autônomo iniciante
 * - PRO: R$59,90 - Autônomo full-time
 * - FULL: R$99,90 - Power user
 * 
 * FROTA (transportadoras, PME):
 * - FROTA_START: R$299/mês - Até 5 motoristas
 * - FROTA_PRO: R$599/mês - Até 15 motoristas
 * - FROTA_ENTERPRISE: R$999/mês - Ilimitado
 * 
 * @see SpeedRota_Pricing_Brasil_Revisado.docx
 */
export type Plano = 
  | 'FREE' 
  | 'STARTER'
  | 'PRO' 
  | 'FULL' 
  | 'FROTA_START'
  | 'FROTA_PRO'
  | 'FROTA_ENTERPRISE'
  | 'ENTERPRISE'; // legacy

/**
 * Tipo de usuário - define quais funcionalidades são exibidas
 * 
 * REGRA DE NEGÓCIO:
 * - ENTREGADOR: Foco em rotas, OCR, QR Code, Dashboard pessoal
 * - GESTOR_FROTA: Foco em gestão de motoristas, veículos, distribuição
 */
export type TipoUsuario = 'ENTREGADOR' | 'GESTOR_FROTA';

export const PLANOS_CONFIG: Record<Plano, { 
  nome: string; 
  preco: number; // R$
  rotasPorMes: number; 
  paradasPorRota: number;
  fornecedores: number;
  maxMotoristas?: number; // para planos frota
  features: string[];
}> = {
  // Planos Individuais
  FREE: { 
    nome: 'Gratuito', 
    preco: 0,
    rotasPorMes: 3, 
    paradasPorRota: 10, 
    fornecedores: 3,
    features: ['Roteirização básica', '3 rotas/dia', '10 paradas/rota']
  },
  STARTER: { 
    nome: 'Starter', 
    preco: 29.90,
    rotasPorMes: 10, 
    paradasPorRota: 30, 
    fornecedores: 5,
    features: ['OCR de NF-e', 'WhatsApp Share', '10 rotas/dia', '30 paradas/rota']
  },
  PRO: { 
    nome: 'Pro', 
    preco: 59.90,
    rotasPorMes: 999, 
    paradasPorRota: 50, 
    fornecedores: 8,
    features: ['Rotas ilimitadas', 'Analytics', 'SEFAZ QR Code', 'Histórico completo']
  },
  FULL: { 
    nome: 'Full', 
    preco: 99.90,
    rotasPorMes: 9999, 
    paradasPorRota: 100, 
    fornecedores: 14,
    features: ['POD (Comprovante)', 'API Access', 'ML Previsão', 'Suporte prioritário']
  },
  
  // Planos Frota (B2B)
  FROTA_START: { 
    nome: 'Frota Start', 
    preco: 299,
    rotasPorMes: 9999, 
    paradasPorRota: 100, 
    fornecedores: 14,
    maxMotoristas: 5,
    features: ['Dashboard Gestor', 'Tracking tempo real', 'Até 5 motoristas', 'Distribuição automática']
  },
  FROTA_PRO: { 
    nome: 'Frota Pro', 
    preco: 599,
    rotasPorMes: 99999, 
    paradasPorRota: 200, 
    fornecedores: 14,
    maxMotoristas: 15,
    features: ['Até 15 motoristas', 'API + POD', 'Geofencing', 'Analytics avançado']
  },
  FROTA_ENTERPRISE: { 
    nome: 'Frota Enterprise', 
    preco: 999,
    rotasPorMes: 999999, 
    paradasPorRota: 500, 
    fornecedores: 14,
    maxMotoristas: 999,
    features: ['Motoristas ilimitados', 'ML Otimização', 'VTEX/Shopify', 'Suporte dedicado']
  },
  
  // Legacy
  ENTERPRISE: { 
    nome: 'Enterprise', 
    preco: 999,
    rotasPorMes: 999999, 
    paradasPorRota: 500, 
    fornecedores: 14,
    features: ['Legado - migrar para FROTA_ENTERPRISE']
  },
};

/**
 * Promoções ativas
 */
export const PROMOCOES = {
  FROTA60: {
    codigo: 'FROTA60',
    nome: '60% OFF nos primeiros 3 meses',
    desconto: 60,
    meses: 3,
    planosAplicaveis: ['FROTA_START', 'FROTA_PRO', 'FROTA_ENTERPRISE'] as Plano[],
    ativo: true
  },
  MIGRACAOVUUPT: {
    codigo: 'MIGRACAOVUUPT',
    nome: 'Migração Vuupt - 3 meses grátis',
    desconto: 100,
    meses: 3,
    planosAplicaveis: ['FROTA_START', 'FROTA_PRO', 'FROTA_ENTERPRISE'] as Plano[],
    ativo: true
  },
  ANUAL25: {
    codigo: 'ANUAL25',
    nome: '25% de desconto no plano anual',
    desconto: 25,
    meses: 12,
    planosAplicaveis: ['STARTER', 'PRO', 'FULL', 'FROTA_START', 'FROTA_PRO', 'FROTA_ENTERPRISE'] as Plano[],
    ativo: true
  }
};

// ==========================================
// ORIGEM (Ponto de Partida)
// ==========================================

/**
 * Representa a origem da rota
 * 
 * REGRA DE NEGÓCIO CRÍTICA:
 * - SEMPRE é a localização atual do entregador (GPS) ou entrada manual
 * - NUNCA é o remetente da NF-e (fábrica)
 * - NUNCA é a transportadora
 */
export interface Origem {
  /** Latitude (range: -90 a 90) */
  lat: number;
  /** Longitude (range: -180 a 180) */
  lng: number;
  /** Endereço formatado para exibição */
  endereco: string;
  /** Fonte da origem */
  fonte: 'gps' | 'manual';
  /** Precisão do GPS em metros (apenas se fonte='gps') */
  precisao?: number;
  /** Timestamp da captura */
  timestamp: Date;
}

// ==========================================
// FORNECEDORES
// ==========================================

/**
 * Fornecedores/Marketplaces suportados
 */
export type Fornecedor = 
  | 'natura'
  | 'avon'
  | 'boticario'
  | 'mercadolivre'
  | 'shopee'
  | 'amazon'
  | 'magalu'
  | 'americanas'
  | 'correios'
  | 'ifood'
  | 'rappi'
  | 'kwai'
  | 'tiktok'
  | 'outro';

/**
 * Configuração visual de cada fornecedor
 */
export const FORNECEDORES_CONFIG: Record<Fornecedor, { nome: string; cor: string; emoji: string }> = {
  natura: { nome: 'Natura', cor: '#FF6B00', emoji: '🧴' },
  avon: { nome: 'Avon', cor: '#E91E8C', emoji: '💄' },
  boticario: { nome: 'O Boticário', cor: '#006B3F', emoji: '🌸' },
  mercadolivre: { nome: 'Mercado Livre', cor: '#FFE600', emoji: '📦' },
  shopee: { nome: 'Shopee', cor: '#EE4D2D', emoji: '🛒' },
  amazon: { nome: 'Amazon', cor: '#FF9900', emoji: '📦' },
  magalu: { nome: 'Magalu', cor: '#0086FF', emoji: '🛍️' },
  americanas: { nome: 'Americanas', cor: '#E60014', emoji: '🏪' },
  correios: { nome: 'Correios', cor: '#FFCC00', emoji: '✉️' },
  ifood: { nome: 'iFood', cor: '#EA1D2C', emoji: '🍔' },
  rappi: { nome: 'Rappi', cor: '#FF441F', emoji: '🛵' },
  kwai: { nome: 'Kwai', cor: '#FF6A00', emoji: '🎥' },
  tiktok: { nome: 'TikTok Shop', cor: '#000000', emoji: '🎵' },
  outro: { nome: 'Outro', cor: '#6B7280', emoji: '📋' },
};

// ==========================================
// DESTINO (Ponto de Entrega)
// ==========================================

/**
 * Representa um destino de entrega
 */
export interface Destino {
  /** ID único (UUID) */
  id: string;
  /** Latitude */
  lat: number;
  /** Longitude */
  lng: number;
  /** Nome do destinatário */
  nome: string;
  /** Endereço completo */
  endereco: string;
  /** Cidade */
  cidade: string;
  /** Estado (UF) */
  uf: string;
  /** CEP */
  cep?: string;
  /** Telefone de contato */
  telefone?: string;
  /** Referência/observação para entrega */
  referencia?: string;
  /** Número da NF-e (se extraído via OCR) */
  nfe?: string;
  /** Valor da entrega em R$ */
  valor?: number;
  /** Peso em kg */
  peso?: number;
  /** Fornecedor/Marketplace de origem */
  fornecedor: Fornecedor;
  /** Fonte do dado */
  fonte: 'ocr' | 'manual' | 'pdf';
  /** Confiança do geocoding (0-1) */
  confianca: number;
  /** Janela de tempo - início (HH:MM) */
  janelaInicio?: string;
  /** Janela de tempo - fim (HH:MM) */
  janelaFim?: string;
  /** Prioridade da entrega */
  prioridade?: 'ALTA' | 'MEDIA' | 'BAIXA';
}

// ==========================================
// ROTA OTIMIZADA
// ==========================================

/**
 * Parada ordenada na rota (Destino com informações de sequência)
 */
export interface ParadaOrdenada extends Destino {
  /** Ordem na sequência (1, 2, 3...) */
  ordem: number;
  /** Distância do ponto anterior em km */
  distanciaAnterior: number;
  /** Distância acumulada desde a origem em km */
  distanciaAcumulada: number;
  /** Tempo estimado do ponto anterior em minutos */
  tempoAnterior: number;
  /** Tempo acumulado desde a origem em minutos */
  tempoAcumulado: number;
  /** Horário previsto de chegada */
  horarioChegada?: string;
}

/**
 * Métricas calculadas da rota
 */
export interface Metricas {
  /** Distância total em km */
  distanciaTotalKm: number;
  /** Tempo de viagem estimado em minutos */
  tempoViagemMin: number;
  /** Tempo gasto em entregas em minutos (nº entregas × 5min) */
  tempoEntregasMin: number;
  /** Tempo total (viagem + entregas) em minutos */
  tempoTotalMin: number;
  /** Tempo ajustado considerando tráfego em minutos */
  tempoAjustadoMin: number;
  /** Combustível estimado em litros */
  combustivelL: number;
  /** Custo estimado em R$ */
  custoR$: number;
  /** Fator de tráfego aplicado */
  fatorTrafego: number;
}

/**
 * Predições de tempo e eficiência
 */
export interface Predicoes {
  /** Janelas de entrega previstas */
  janelas: JanelaEntrega[];
  /** Índice de eficiência da rota (0-100%) */
  eficiencia: number;
  /** Alertas e recomendações */
  alertas: Alerta[];
}

/**
 * Janela de entrega prevista para cada parada
 */
export interface JanelaEntrega {
  /** Ordem da parada */
  ordem: number;
  /** Nome/identificação do local */
  local: string;
  /** Horário previsto de chegada (HH:mm) */
  chegadaPrevista: string;
  /** Horário limite com buffer (HH:mm) */
  chegadaAte: string;
  /** Nível de confiança (0-100%) */
  confianca: number;
}

/**
 * Alerta/recomendação do sistema
 */
export interface Alerta {
  /** Tipo do alerta */
  tipo: 'info' | 'warning' | 'error';
  /** Mensagem do alerta */
  mensagem: string;
  /** Ação sugerida */
  acao?: string;
}

/**
 * Rota otimizada completa
 */
export interface RotaOtimizada {
  /** Origem da rota */
  origem: Origem;
  /** Ponto de retorno (se diferente da origem) */
  pontoRetorno: Origem | null;
  /** Paradas ordenadas */
  paradas: ParadaOrdenada[];
  /** Métricas calculadas */
  metricas: Metricas;
  /** Predições (opcional) */
  predicoes?: Predicoes;
  /** Inclui retorno */
  incluiRetorno: boolean;
  /** Distância do retorno em km */
  distanciaRetornoKm: number;
  /** Timestamp do cálculo */
  calculadoEm: Date;
}

// ==========================================
// DADOS EXTRAÍDOS DE NF-e
// ==========================================

/**
 * Dados extraídos de uma NF-e via OCR
 */
export interface DadosNFe {
  /** Número da NF-e */
  numero: string;
  /** Série */
  serie?: string;
  /** Data de emissão */
  dataEmissao?: string;
  /** Fornecedor detectado automaticamente */
  fornecedor: Fornecedor;
  /** Dados do destinatário (USAR COMO DESTINO) */
  destinatario: {
    nome: string;
    endereco: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
    telefone?: string;
    referencia?: string;
  };
  /** Valor total */
  valor?: number;
  /** Peso em kg */
  peso?: number;
  /** Número de volumes */
  volumes?: number;
  /** Confiança da extração OCR (0-1) */
  confiancaOCR: number;
}

// ==========================================
// GEOCODING
// ==========================================

/**
 * Resultado do geocoding
 */
export interface GeocodingResult {
  /** Latitude */
  lat: number;
  /** Longitude */
  lng: number;
  /** Nível de confiança */
  confianca: 'alta' | 'media' | 'baixa';
  /** Valor numérico de confiança (0-1) */
  confiancaValor: number;
  /** Fonte do geocoding */
  fonte: 'cache' | 'nominatim' | 'viacep' | 'manual';
  /** Endereço formatado retornado */
  enderecoFormatado: string;
}

// ==========================================
// ESTADO DA APLICAÇÃO
// ==========================================

/**
 * Etapas do fluxo
 */
export type EtapaFluxo = 'home' | 'origem' | 'escolha-carga' | 'destinos' | 'rota' | 'navegacao' | 'dashboard' | 'frota' | 'previsao' | 'gamificacao' | 'ecommerce' | 'qrcode' | 'matching';

/**
 * Estado global da aplicação
 */
export interface AppState {
  /** Etapa atual do fluxo */
  etapaAtual: EtapaFluxo;
  /** Origem definida */
  origem: Origem | null;
  /** Ponto de retorno (pode ser diferente da origem) */
  pontoRetorno: Origem | null;
  /** Lista de destinos adicionados */
  destinos: Destino[];
  /** Rota otimizada calculada */
  rotaOtimizada: RotaOtimizada | null;
  /** Carregando operação */
  carregando: boolean;
  /** Mensagem de erro */
  erro: string | null;
  /** Incluir retorno à origem no cálculo */
  incluirRetorno: boolean;
}

// ==========================================
// CONSTANTES DE NEGÓCIO
// ==========================================

export const CONSTANTES = {
  /** Velocidade média urbana em km/h */
  VELOCIDADE_URBANA_KMH: 30,
  /** Consumo médio em km/l */
  CONSUMO_MEDIO_KML: 10,
  /** Preço do combustível em R$/l */
  PRECO_COMBUSTIVEL_RS: 5.89,
  /** Tempo médio por entrega em minutos */
  TEMPO_POR_ENTREGA_MIN: 5,
  /** Buffer de tempo em minutos */
  BUFFER_TEMPO_MIN: 15,
  /** Limite de alerta de distância em km */
  ALERTA_DISTANCIA_KM: 100,
  /** Limite de eficiência para reagrupamento */
  LIMITE_EFICIENCIA: 0.65,
} as const;

/**
 * Fatores de tráfego por horário
 */
export const FATORES_TRAFEGO = {
  PICO_MANHA: { inicio: 7, fim: 9, fator: 1.5 },
  PICO_TARDE: { inicio: 17, fim: 19, fator: 1.6 },
  ALMOCO: { inicio: 11, fim: 14, fator: 1.2 },
  MADRUGADA: { inicio: 22, fim: 5, fator: 0.8 },
  NORMAL: { fator: 1.0 },
} as const;
