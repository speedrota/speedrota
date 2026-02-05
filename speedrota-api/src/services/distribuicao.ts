/**
 * @fileoverview Serviço de Distribuição Inteligente de Entregas
 *
 * DESIGN POR CONTRATO:
 * @description Algoritmo avançado de distribuição de entregas para motoristas
 * @pre Empresa com motoristas e entregas cadastrados
 * @post Entregas distribuídas otimamente entre motoristas disponíveis
 * @invariant Respeita capacidade, zonas, janelas e jornada de trabalho
 *
 * ALGORITMO DE DISTRIBUIÇÃO:
 * 1. Coleta motoristas disponíveis
 * 2. Para cada entrega, calcula score de cada motorista
 * 3. Score considera: zona, distância, capacidade, performance, carga atual
 * 4. Atribui entrega ao motorista com maior score
 * 5. Atualiza carga do motorista
 * 6. Repete até todas entregas distribuídas
 *
 * FATORES DE SCORING:
 * - Zona de atuação: +50 pontos (zona preferida)
 * - Distância: -1 ponto por km
 * - Capacidade disponível: +20 pontos (se cabe)
 * - Performance: +10 * taxa_entrega
 * - Carga atual: -5 pontos por entrega já atribuída (balanceamento)
 * - Janela de tempo: +30 pontos (se compatível com rota atual)
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// ==========================================
// TIPOS
// ==========================================

export interface EntregaParaDistribuir {
  id: string;
  lat: number;
  lng: number;
  endereco: string;
  cidade: string;
  uf: string;
  bairro?: string;
  cep?: string;
  pesoKg?: number;
  volumes: number;
  janelaInicio?: string;
  janelaFim?: string;
  prioridade: 'ALTA' | 'MEDIA' | 'BAIXA';
  valor?: number;
}

export interface MotoristaDisponivel {
  id: string;
  nome: string;
  lat?: number;
  lng?: number;
  capacidadeKg: number;
  capacidadeVolumes: number;
  raioMaximoKm: number;
  taxaEntrega: number;
  tempoMedioEntrega: number;
  horaInicio?: string;
  horaFim?: string;
  zonasIds: string[];
  cargaAtualKg: number;
  cargaAtualVolumes: number;
  entregasAtribuidas: number;
  veiculoTipo?: string;
}

export interface ResultadoDistribuicao {
  motoristaId: string;
  motoristaNome: string;
  entregas: EntregaParaDistribuir[];
  totalKg: number;
  totalVolumes: number;
  distanciaEstimadaKm: number;
  tempoEstimadoMin: number;
  ordemOtimizada: string[]; // IDs na ordem otimizada
}

export interface DistribuicaoCompleta {
  timestamp: Date;
  empresaId: string;
  metodo: 'AUTOMATICO' | 'MANUAL' | 'HIBRIDO';
  totalEntregas: number;
  entregasDistribuidas: number;
  entregasNaoDistribuidas: EntregaParaDistribuir[];
  distribuicoes: ResultadoDistribuicao[];
  estatisticas: EstatisticasDistribuicao;
}

export interface EstatisticasDistribuicao {
  totalMotoristas: number;
  totalEntregas: number;
  entregasPorMotorista: { [motoristaId: string]: number };
  kmTotalEstimado: number;
  tempoTotalEstimado: number;
  balanceamentoCarga: number; // 0-1 (1 = perfeitamente balanceado)
  coberturaZonas: number; // 0-1 (1 = todas entregas em zonas cobertas)
}

export interface ConfiguracaoDistribuicao {
  respeitarZonas: boolean;
  balanceamentoAtivo: boolean;
  pesoZona: number;
  pesoDistancia: number;
  pesoCapacidade: number;
  pesoPerformance: number;
  pesoBalanceamento: number;
  pesoJanela: number;
  pesoPrioridade: number;
  maxEntregasPorMotorista?: number;
  maxKmPorMotorista?: number;
}

// Configuração padrão
const CONFIG_PADRAO: ConfiguracaoDistribuicao = {
  respeitarZonas: true,
  balanceamentoAtivo: true,
  pesoZona: 50,
  pesoDistancia: 1, // Negativo por km
  pesoCapacidade: 20,
  pesoPerformance: 10,
  pesoBalanceamento: 5, // Negativo por entrega já atribuída
  pesoJanela: 30,
  pesoPrioridade: 25,
};

// ==========================================
// HAVERSINE - Distância entre coordenadas
// ==========================================

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Raio da Terra em km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

/**
 * Verifica se entrega está na zona do motorista
 */
function entregaNaZona(
  entrega: EntregaParaDistribuir,
  zona: any
): boolean {
  // Verificar por CEP
  if (zona.ceps && entrega.cep) {
    const cepsPrefixos = JSON.parse(zona.ceps) as string[];
    const cepEntrega = entrega.cep.replace(/\D/g, '');
    if (cepsPrefixos.some(prefixo => cepEntrega.startsWith(prefixo))) {
      return true;
    }
  }

  // Verificar por cidade
  if (zona.cidades && entrega.cidade) {
    const cidades = JSON.parse(zona.cidades) as string[];
    if (cidades.some(c => 
      c.toLowerCase() === entrega.cidade.toLowerCase()
    )) {
      return true;
    }
  }

  // Verificar por bairro
  if (zona.bairros && entrega.bairro) {
    const bairros = JSON.parse(zona.bairros) as string[];
    if (bairros.some(b => 
      b.toLowerCase() === entrega.bairro?.toLowerCase()
    )) {
      return true;
    }
  }

  // Verificar por raio do centro
  if (zona.centroLat && zona.centroLng && zona.raioKm) {
    const distancia = haversine(
      entrega.lat, entrega.lng,
      zona.centroLat, zona.centroLng
    );
    if (distancia <= zona.raioKm) {
      return true;
    }
  }

  // TODO: Verificar por polígono (GeoJSON)

  return false;
}

/**
 * Verifica se horário está dentro da jornada do motorista
 */
function dentroJornada(motorista: MotoristaDisponivel, horaAtual?: string): boolean {
  if (!motorista.horaInicio || !motorista.horaFim) return true;
  if (!horaAtual) {
    const now = new Date();
    horaAtual = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  }
  return horaAtual >= motorista.horaInicio && horaAtual <= motorista.horaFim;
}

/**
 * Verifica se motorista tem capacidade para entrega
 */
function temCapacidade(
  motorista: MotoristaDisponivel,
  entrega: EntregaParaDistribuir
): boolean {
  const pesoRestante = motorista.capacidadeKg - motorista.cargaAtualKg;
  const volumesRestantes = motorista.capacidadeVolumes - motorista.cargaAtualVolumes;
  
  const pesoNecessario = entrega.pesoKg || 0;
  const volumesNecessarios = entrega.volumes;
  
  return pesoNecessario <= pesoRestante && volumesNecessarios <= volumesRestantes;
}

/**
 * Calcula score de um motorista para uma entrega
 */
function calcularScore(
  motorista: MotoristaDisponivel,
  entrega: EntregaParaDistribuir,
  zonas: any[],
  config: ConfiguracaoDistribuicao
): number {
  let score = 0;

  // 1. ZONA DE ATUAÇÃO (+50 pontos se na zona preferida)
  if (config.respeitarZonas && motorista.zonasIds.length > 0) {
    const zonasMotorista = zonas.filter(z => motorista.zonasIds.includes(z.id));
    const naZona = zonasMotorista.some(zona => entregaNaZona(entrega, zona));
    if (naZona) {
      score += config.pesoZona;
    } else if (config.respeitarZonas) {
      // Penalidade severa se respeitar zonas está ativo e entrega não está na zona
      score -= config.pesoZona * 2;
    }
  }

  // 2. DISTÂNCIA (-1 ponto por km)
  if (motorista.lat && motorista.lng) {
    const distancia = haversine(motorista.lat, motorista.lng, entrega.lat, entrega.lng);
    score -= distancia * config.pesoDistancia;
    
    // Verificar raio máximo
    if (distancia > motorista.raioMaximoKm) {
      score -= 1000; // Penalidade severa
    }
  }

  // 3. CAPACIDADE (+20 pontos se tem capacidade)
  if (temCapacidade(motorista, entrega)) {
    score += config.pesoCapacidade;
  } else {
    score -= 1000; // Impossível atribuir
  }

  // 4. PERFORMANCE (+10 * taxa_entrega/100)
  score += config.pesoPerformance * (motorista.taxaEntrega / 100);

  // 5. BALANCEAMENTO (-5 pontos por entrega já atribuída)
  if (config.balanceamentoAtivo) {
    score -= motorista.entregasAtribuidas * config.pesoBalanceamento;
  }

  // 6. PRIORIDADE (+25 para ALTA, +10 para MEDIA)
  if (entrega.prioridade === 'ALTA') {
    score += config.pesoPrioridade;
  } else if (entrega.prioridade === 'MEDIA') {
    score += config.pesoPrioridade * 0.4;
  }

  // 7. JANELA DE TEMPO (compatibilidade)
  if (entrega.janelaInicio && dentroJornada(motorista, entrega.janelaFim)) {
    score += config.pesoJanela;
  }

  return score;
}

// ==========================================
// ALGORITMO TSP SIMPLIFICADO (Nearest Neighbor)
// ==========================================

function otimizarOrdem(
  entregas: EntregaParaDistribuir[],
  origemLat: number,
  origemLng: number
): string[] {
  if (entregas.length <= 1) {
    return entregas.map(e => e.id);
  }

  const ordem: string[] = [];
  const restantes = [...entregas];
  let atualLat = origemLat;
  let atualLng = origemLng;

  // Primeiro: paradas com janela de tempo que expira cedo
  const comJanela = restantes
    .filter(e => e.janelaFim)
    .sort((a, b) => (a.janelaFim! || '').localeCompare(b.janelaFim! || ''));

  for (const entrega of comJanela) {
    ordem.push(entrega.id);
    const idx = restantes.findIndex(e => e.id === entrega.id);
    if (idx >= 0) {
      atualLat = entrega.lat;
      atualLng = entrega.lng;
      restantes.splice(idx, 1);
    }
  }

  // Depois: Nearest Neighbor para o resto
  while (restantes.length > 0) {
    let menorDist = Infinity;
    let maisProximo: EntregaParaDistribuir | null = null;
    let indice = -1;

    for (let i = 0; i < restantes.length; i++) {
      const entrega = restantes[i];
      
      // Prioridade ALTA vai antes
      let distancia = haversine(atualLat, atualLng, entrega.lat, entrega.lng);
      if (entrega.prioridade === 'ALTA') {
        distancia *= 0.5; // Bonus de proximidade
      }
      
      if (distancia < menorDist) {
        menorDist = distancia;
        maisProximo = entrega;
        indice = i;
      }
    }

    if (maisProximo) {
      ordem.push(maisProximo.id);
      atualLat = maisProximo.lat;
      atualLng = maisProximo.lng;
      restantes.splice(indice, 1);
    }
  }

  return ordem;
}

/**
 * Calcula distância total de uma rota
 */
function calcularDistanciaTotal(
  entregas: EntregaParaDistribuir[],
  ordem: string[],
  origemLat: number,
  origemLng: number
): number {
  if (ordem.length === 0) return 0;

  let distanciaTotal = 0;
  let atualLat = origemLat;
  let atualLng = origemLng;

  for (const id of ordem) {
    const entrega = entregas.find(e => e.id === id);
    if (entrega) {
      distanciaTotal += haversine(atualLat, atualLng, entrega.lat, entrega.lng);
      atualLat = entrega.lat;
      atualLng = entrega.lng;
    }
  }

  // Retorno à origem
  distanciaTotal += haversine(atualLat, atualLng, origemLat, origemLng);

  return distanciaTotal;
}

// ==========================================
// FUNÇÃO PRINCIPAL DE DISTRIBUIÇÃO
// ==========================================

/**
 * Distribui entregas entre motoristas disponíveis
 *
 * @pre empresaId válido, entregas e motoristas existentes
 * @post Retorna distribuição otimizada
 */
export async function distribuirEntregas(
  empresaId: string,
  entregas: EntregaParaDistribuir[],
  config: Partial<ConfiguracaoDistribuicao> = {}
): Promise<DistribuicaoCompleta> {
  const configFinal = { ...CONFIG_PADRAO, ...config };
  
  console.log(`[Distribuição] Iniciando para empresa ${empresaId}`);
  console.log(`[Distribuição] ${entregas.length} entregas para distribuir`);

  // 1. Buscar empresa e configurações
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    include: {
      zonasAtuacao: true,
    },
  });

  if (!empresa) {
    throw new Error('Empresa não encontrada');
  }

  // 2. Buscar motoristas disponíveis
  const motoristasDB = await prisma.motorista.findMany({
    where: {
      empresaId,
      ativo: true,
      status: { in: ['DISPONIVEL', 'EM_ROTA'] },
    },
    include: {
      zonasPreferidas: {
        include: { zona: true },
      },
      veiculoAtual: true,
    },
  });

  console.log(`[Distribuição] ${motoristasDB.length} motoristas disponíveis`);

  if (motoristasDB.length === 0) {
    return {
      timestamp: new Date(),
      empresaId,
      metodo: 'AUTOMATICO',
      totalEntregas: entregas.length,
      entregasDistribuidas: 0,
      entregasNaoDistribuidas: entregas,
      distribuicoes: [],
      estatisticas: {
        totalMotoristas: 0,
        totalEntregas: entregas.length,
        entregasPorMotorista: {},
        kmTotalEstimado: 0,
        tempoTotalEstimado: 0,
        balanceamentoCarga: 0,
        coberturaZonas: 0,
      },
    };
  }

  // 3. Preparar motoristas com dados calculados
  const motoristas: MotoristaDisponivel[] = motoristasDB.map(m => ({
    id: m.id,
    nome: m.nome,
    lat: m.ultimaLat ?? empresa.baseLat ?? undefined,
    lng: m.ultimaLng ?? empresa.baseLng ?? undefined,
    capacidadeKg: m.veiculoAtual?.capacidadeKg ?? m.capacidadeKg,
    capacidadeVolumes: m.veiculoAtual?.capacidadeVolumes ?? m.capacidadeVolumes,
    raioMaximoKm: m.raioMaximoKm,
    taxaEntrega: m.taxaEntrega,
    tempoMedioEntrega: m.tempoMedioEntrega,
    horaInicio: m.horaInicio ?? undefined,
    horaFim: m.horaFim ?? undefined,
    zonasIds: m.zonasPreferidas.map(zp => zp.zonaId),
    cargaAtualKg: 0,
    cargaAtualVolumes: 0,
    entregasAtribuidas: 0,
    veiculoTipo: m.veiculoAtual?.tipo,
  }));

  // 4. Ordenar entregas por prioridade (ALTA primeiro)
  const entregasOrdenadas = [...entregas].sort((a, b) => {
    const prioridadeOrdem = { 'ALTA': 0, 'MEDIA': 1, 'BAIXA': 2 };
    const ordA = prioridadeOrdem[a.prioridade];
    const ordB = prioridadeOrdem[b.prioridade];
    
    if (ordA !== ordB) return ordA - ordB;
    
    // Se mesma prioridade, ordenar por janela de tempo
    if (a.janelaFim && b.janelaFim) {
      return a.janelaFim.localeCompare(b.janelaFim);
    }
    if (a.janelaFim) return -1;
    if (b.janelaFim) return 1;
    
    return 0;
  });

  // 5. Distribuir entregas
  const distribuicaoMap: Map<string, EntregaParaDistribuir[]> = new Map();
  const entregasNaoDistribuidas: EntregaParaDistribuir[] = [];

  for (const entrega of entregasOrdenadas) {
    // Calcular score para cada motorista
    const scores: { motorista: MotoristaDisponivel; score: number }[] = [];

    for (const motorista of motoristas) {
      // Verificar se está dentro da jornada
      if (!dentroJornada(motorista)) continue;

      // Calcular score
      const score = calcularScore(
        motorista,
        entrega,
        empresa.zonasAtuacao,
        configFinal
      );

      scores.push({ motorista, score });
    }

    // Ordenar por score (maior primeiro)
    scores.sort((a, b) => b.score - a.score);

    // Atribuir ao motorista com maior score (se score razoável)
    const melhor = scores[0];
    if (melhor && melhor.score > -500) { // Threshold mínimo
      const motorista = melhor.motorista;
      
      // Atualizar carga do motorista
      motorista.cargaAtualKg += entrega.pesoKg || 0;
      motorista.cargaAtualVolumes += entrega.volumes;
      motorista.entregasAtribuidas++;

      // Atualizar posição do motorista para próxima iteração
      motorista.lat = entrega.lat;
      motorista.lng = entrega.lng;

      // Adicionar à distribuição
      const entregas = distribuicaoMap.get(motorista.id) || [];
      entregas.push(entrega);
      distribuicaoMap.set(motorista.id, entregas);

      console.log(
        `[Distribuição] Entrega ${entrega.id} → ${motorista.nome} (score: ${melhor.score.toFixed(1)})`
      );
    } else {
      entregasNaoDistribuidas.push(entrega);
      console.log(
        `[Distribuição] Entrega ${entrega.id} não distribuída (melhor score: ${melhor?.score.toFixed(1) || 'N/A'})`
      );
    }
  }

  // 6. Montar resultado com rotas otimizadas
  const distribuicoes: ResultadoDistribuicao[] = [];
  let kmTotalEstimado = 0;
  let tempoTotalEstimado = 0;

  for (const [motoristaId, entregasMotorista] of distribuicaoMap) {
    const motorista = motoristas.find(m => m.id === motoristaId)!;
    
    // Otimizar ordem das entregas
    const origemLat = empresa.baseLat || motorista.lat || 0;
    const origemLng = empresa.baseLng || motorista.lng || 0;
    const ordemOtimizada = otimizarOrdem(entregasMotorista, origemLat, origemLng);
    
    // Calcular métricas
    const distanciaKm = calcularDistanciaTotal(
      entregasMotorista,
      ordemOtimizada,
      origemLat,
      origemLng
    );
    
    const tempoMin = (distanciaKm / 30) * 60 + // Tempo em trânsito (30km/h média)
      entregasMotorista.length * motorista.tempoMedioEntrega; // Tempo nas entregas

    kmTotalEstimado += distanciaKm;
    tempoTotalEstimado += tempoMin;

    distribuicoes.push({
      motoristaId,
      motoristaNome: motorista.nome,
      entregas: entregasMotorista,
      totalKg: entregasMotorista.reduce((sum, e) => sum + (e.pesoKg || 0), 0),
      totalVolumes: entregasMotorista.reduce((sum, e) => sum + e.volumes, 0),
      distanciaEstimadaKm: Math.round(distanciaKm * 10) / 10,
      tempoEstimadoMin: Math.round(tempoMin),
      ordemOtimizada,
    });
  }

  // 7. Calcular estatísticas
  const entregasPorMotorista: { [key: string]: number } = {};
  for (const d of distribuicoes) {
    entregasPorMotorista[d.motoristaId] = d.entregas.length;
  }

  // Calcular balanceamento (0 = desbalanceado, 1 = perfeitamente balanceado)
  const entregasCounts = Object.values(entregasPorMotorista);
  const mediaEntregas = entregasCounts.reduce((a, b) => a + b, 0) / entregasCounts.length || 0;
  const variancia = entregasCounts.reduce((sum, c) => sum + Math.pow(c - mediaEntregas, 2), 0) / entregasCounts.length || 0;
  const desvioPadrao = Math.sqrt(variancia);
  const balanceamento = mediaEntregas > 0 ? Math.max(0, 1 - (desvioPadrao / mediaEntregas)) : 1;

  // Cobertura de zonas
  const entregasEmZona = entregas.filter(e => {
    return empresa.zonasAtuacao.some(z => entregaNaZona(e, z));
  }).length;
  const coberturaZonas = entregas.length > 0 ? entregasEmZona / entregas.length : 1;

  console.log(`[Distribuição] Concluída: ${entregas.length - entregasNaoDistribuidas.length}/${entregas.length} distribuídas`);
  console.log(`[Distribuição] Balanceamento: ${(balanceamento * 100).toFixed(1)}%`);

  return {
    timestamp: new Date(),
    empresaId,
    metodo: 'AUTOMATICO',
    totalEntregas: entregas.length,
    entregasDistribuidas: entregas.length - entregasNaoDistribuidas.length,
    entregasNaoDistribuidas,
    distribuicoes,
    estatisticas: {
      totalMotoristas: motoristas.length,
      totalEntregas: entregas.length,
      entregasPorMotorista,
      kmTotalEstimado: Math.round(kmTotalEstimado * 10) / 10,
      tempoTotalEstimado: Math.round(tempoTotalEstimado),
      balanceamentoCarga: Math.round(balanceamento * 100) / 100,
      coberturaZonas: Math.round(coberturaZonas * 100) / 100,
    },
  };
}

// ==========================================
// REDISTRIBUIÇÃO DINÂMICA
// ==========================================

export interface ProblemaRedistribuicao {
  tipo: 'MOTORISTA_INDISPONIVEL' | 'CAPACIDADE_EXCEDIDA' | 'ATRASO_CRITICO' | 'ZONA_DESCOBERTA';
  motoristaId?: string;
  entregasAfetadas: string[];
  motivo: string;
}

/**
 * Redistribui entregas de um motorista para outros
 *
 * @pre Motorista com entregas atribuídas
 * @post Entregas redistribuídas para outros motoristas
 */
export async function redistribuirDeMotorista(
  empresaId: string,
  motoristaId: string,
  motivo: string
): Promise<DistribuicaoCompleta> {
  console.log(`[Redistribuição] Removendo entregas do motorista ${motoristaId}`);

  // Buscar entregas atuais do motorista
  const rotasMotorista = await prisma.rotaEmpresa.findMany({
    where: {
      empresaId,
      motoristaId,
      status: { in: ['RASCUNHO', 'CALCULADA'] },
    },
    include: {
      paradasEmpresa: {
        where: { status: 'PENDENTE' },
      },
    },
  });

  const entregasParaRedistribuir: EntregaParaDistribuir[] = [];

  for (const rota of rotasMotorista) {
    for (const parada of rota.paradasEmpresa) {
      entregasParaRedistribuir.push({
        id: parada.id,
        lat: parada.lat,
        lng: parada.lng,
        endereco: parada.endereco,
        cidade: parada.cidade,
        uf: parada.uf,
        bairro: parada.bairro ?? undefined,
        cep: parada.cep ?? undefined,
        pesoKg: parada.pesoKg ?? undefined,
        volumes: parada.volumes,
        janelaInicio: parada.janelaInicio ?? undefined,
        janelaFim: parada.janelaFim ?? undefined,
        prioridade: parada.prioridade as 'ALTA' | 'MEDIA' | 'BAIXA',
        valor: parada.valor ?? undefined,
      });
    }

    // Remover atribuição atual
    await prisma.rotaEmpresa.update({
      where: { id: rota.id },
      data: {
        motoristaId: null,
        statusAtribuicao: 'REATRIBUIDO',
      },
    });
  }

  if (entregasParaRedistribuir.length === 0) {
    console.log('[Redistribuição] Nenhuma entrega para redistribuir');
    return {
      timestamp: new Date(),
      empresaId,
      metodo: 'AUTOMATICO',
      totalEntregas: 0,
      entregasDistribuidas: 0,
      entregasNaoDistribuidas: [],
      distribuicoes: [],
      estatisticas: {
        totalMotoristas: 0,
        totalEntregas: 0,
        entregasPorMotorista: {},
        kmTotalEstimado: 0,
        tempoTotalEstimado: 0,
        balanceamentoCarga: 1,
        coberturaZonas: 1,
      },
    };
  }

  // Marcar motorista como indisponível
  await prisma.motorista.update({
    where: { id: motoristaId },
    data: {
      status: 'INDISPONIVEL',
      motivoIndisponivel: motivo,
      statusAtualizadoEm: new Date(),
    },
  });

  // Registrar histórico
  await prisma.atribuicaoHistorico.create({
    data: {
      motoristaId,
      acao: 'REATRIBUIDO',
      motivo,
      metodoAtribuicao: 'AUTOMATICO',
    },
  });

  // Redistribuir
  return distribuirEntregas(empresaId, entregasParaRedistribuir);
}

// ==========================================
// SUGESTÃO DE ATRIBUIÇÃO (MODO HÍBRIDO)
// ==========================================

export interface SugestaoAtribuicao {
  entregaId: string;
  sugestoes: {
    motoristaId: string;
    motoristaNome: string;
    score: number;
    razoes: string[];
  }[];
}

/**
 * Sugere motoristas para cada entrega (modo híbrido)
 * Gestor confirma ou altera
 */
export async function sugerirAtribuicoes(
  empresaId: string,
  entregas: EntregaParaDistribuir[]
): Promise<SugestaoAtribuicao[]> {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    include: { zonasAtuacao: true },
  });

  if (!empresa) throw new Error('Empresa não encontrada');

  const motoristasDB = await prisma.motorista.findMany({
    where: {
      empresaId,
      ativo: true,
      status: { in: ['DISPONIVEL', 'EM_ROTA'] },
    },
    include: {
      zonasPreferidas: true,
      veiculoAtual: true,
    },
  });

  const motoristas: MotoristaDisponivel[] = motoristasDB.map(m => ({
    id: m.id,
    nome: m.nome,
    lat: m.ultimaLat ?? undefined,
    lng: m.ultimaLng ?? undefined,
    capacidadeKg: m.veiculoAtual?.capacidadeKg ?? m.capacidadeKg,
    capacidadeVolumes: m.veiculoAtual?.capacidadeVolumes ?? m.capacidadeVolumes,
    raioMaximoKm: m.raioMaximoKm,
    taxaEntrega: m.taxaEntrega,
    tempoMedioEntrega: m.tempoMedioEntrega,
    horaInicio: m.horaInicio ?? undefined,
    horaFim: m.horaFim ?? undefined,
    zonasIds: m.zonasPreferidas.map(zp => zp.zonaId),
    cargaAtualKg: 0,
    cargaAtualVolumes: 0,
    entregasAtribuidas: 0,
  }));

  const sugestoes: SugestaoAtribuicao[] = [];

  for (const entrega of entregas) {
    const scoredMotoristas = motoristas.map(motorista => {
      const score = calcularScore(motorista, entrega, empresa.zonasAtuacao, CONFIG_PADRAO);
      const razoes: string[] = [];

      // Explicar score
      const zonasMotorista = empresa.zonasAtuacao.filter(z => 
        motorista.zonasIds.includes(z.id)
      );
      const naZona = zonasMotorista.some(z => entregaNaZona(entrega, z));
      if (naZona) razoes.push('Zona de atuação preferida');
      
      if (motorista.lat && motorista.lng) {
        const dist = haversine(motorista.lat, motorista.lng, entrega.lat, entrega.lng);
        if (dist < 5) razoes.push(`Próximo (${dist.toFixed(1)} km)`);
      }

      if (motorista.taxaEntrega >= 95) razoes.push('Alta taxa de sucesso');
      if (temCapacidade(motorista, entrega)) razoes.push('Capacidade disponível');

      return { motorista, score, razoes };
    });

    // Ordenar por score e pegar top 3
    scoredMotoristas.sort((a, b) => b.score - a.score);
    
    sugestoes.push({
      entregaId: entrega.id,
      sugestoes: scoredMotoristas.slice(0, 3).map(s => ({
        motoristaId: s.motorista.id,
        motoristaNome: s.motorista.nome,
        score: Math.round(s.score),
        razoes: s.razoes,
      })),
    });
  }

  return sugestoes;
}

// ==========================================
// EXPORTS
// ==========================================

export default {
  distribuirEntregas,
  redistribuirDeMotorista,
  sugerirAtribuicoes,
  // Helpers exportados para testes
  haversine,
  entregaNaZona,
  temCapacidade,
  calcularScore,
  otimizarOrdem,
};
