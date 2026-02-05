/**
 * @fileoverview ML Route Optimization Service
 * 
 * Otimização de rotas usando dados históricos e ML:
 * - Aprendizado de padrões de tráfego
 * - Ajuste de tempos baseado em histórico real
 * - Sugestões inteligentes de horários
 * - Reordenação baseada em dados passados
 * 
 * DESIGN POR CONTRATO:
 * @pre Histórico de entregas disponível
 * @post Rotas otimizadas com insights de ML
 * @invariant tempoEstimado >= 0, economia ∈ [0, 100]
 * 
 * @author SpeedRota Team
 * @version 1.0.0
 */

import { prisma } from '../lib/prisma.js';

// ==========================================
// TIPOS
// ==========================================

interface DestinoInput {
  id: string;
  endereco: string;
  lat: number;
  lng: number;
  cep?: string;
  fornecedor?: string;
  prioridade?: number;
}

interface OrigemInput {
  lat: number;
  lng: number;
  endereco: string;
}

interface OtimizacaoMLInput {
  origem: OrigemInput;
  destinos: DestinoInput[];
  horaPartida?: number; // 0-23
  considerarTrafego?: boolean;
  considerarHistorico?: boolean;
  fornecedor?: string;
}

interface OtimizacaoMLOutput {
  rotaOriginal: DestinoInput[];
  rotaOtimizada: DestinoInput[];
  economia: {
    tempo: number;       // minutos economizados
    distancia: number;   // km economizados
    percentual: number;  // % de economia
  };
  predicoes: {
    tempoTotalEstimado: number;     // minutos
    tempoMedioPorParada: number;    // minutos
    confianca: number;              // 0-1
    horarioRecomendado?: string;
    zonasMaisDemanda: string[];
  };
  ajustes: AjusteML[];
  insights: InsightOtimizacao[];
}

interface AjusteML {
  tipo: 'TEMPO' | 'ORDEM' | 'HORARIO';
  descricao: string;
  valorOriginal: number;
  valorAjustado: number;
  fatorConfianca: number;
}

interface InsightOtimizacao {
  tipo: 'ALERTA' | 'SUGESTAO' | 'TENDENCIA';
  titulo: string;
  descricao: string;
  acao?: string;
  prioridade: number; // 1-5
}

interface HistoricoZona {
  zona: string;
  tempoMedioEntrega: number;
  desvioPadrao: number;
  totalEntregas: number;
  ultimaEntrega: Date;
}

interface PadraoTrafego {
  horario: number;
  diaSemana: number;
  fatorAtraso: number;
  confianca: number;
}

// ==========================================
// CONSTANTES
// ==========================================

/**
 * Fatores de tráfego por horário
 * Baseado em médias de cidades brasileiras
 */
const FATORES_TRAFEGO_HORA: Record<number, number> = {
  0: 0.7, 1: 0.6, 2: 0.6, 3: 0.6, 4: 0.7, 5: 0.8,
  6: 1.0, 7: 1.4, 8: 1.6, 9: 1.3, 10: 1.1, 11: 1.2,
  12: 1.3, 13: 1.2, 14: 1.1, 15: 1.2, 16: 1.3, 17: 1.5,
  18: 1.7, 19: 1.5, 20: 1.2, 21: 1.0, 22: 0.9, 23: 0.8,
};

/**
 * Fatores de tráfego por dia da semana
 */
const FATORES_TRAFEGO_DIA: Record<number, number> = {
  0: 0.6, // Domingo
  1: 1.1, // Segunda
  2: 1.0, // Terça
  3: 1.0, // Quarta
  4: 1.0, // Quinta
  5: 1.2, // Sexta
  6: 0.8, // Sábado
};

/**
 * Tempo base por parada (minutos)
 */
const TEMPO_BASE_PARADA = 5;

/**
 * Velocidade base urbana (km/h)
 */
const VELOCIDADE_BASE = 30;

// ==========================================
// FUNÇÕES PRINCIPAIS
// ==========================================

/**
 * Otimiza rota usando ML e dados históricos
 * 
 * @pre origem e destinos válidos
 * @post Rota otimizada com predições
 */
export async function otimizarRotaComML(
  input: OtimizacaoMLInput
): Promise<OtimizacaoMLOutput> {
  const { 
    origem, 
    destinos, 
    horaPartida = new Date().getHours(),
    considerarTrafego = true,
    considerarHistorico = true,
    fornecedor
  } = input;

  // 1. Buscar histórico das zonas
  const historicoZonas = considerarHistorico 
    ? await buscarHistoricoZonas(destinos, fornecedor)
    : new Map<string, HistoricoZona>();

  // 2. Calcular padrão de tráfego atual
  const padraoTrafego = calcularPadraoTrafego(horaPartida);

  // 3. Ordenar destinos com ajustes ML
  const destinosOrdenados = ordenarComML(
    destinos, 
    origem, 
    historicoZonas, 
    padraoTrafego
  );

  // 4. Calcular tempos ajustados
  const ajustes = calcularAjustesML(
    destinos,
    destinosOrdenados,
    historicoZonas,
    padraoTrafego
  );

  // 5. Calcular economia
  const tempoOriginal = calcularTempoRota(destinos, origem, padraoTrafego, historicoZonas);
  const tempoOtimizado = calcularTempoRota(destinosOrdenados, origem, padraoTrafego, historicoZonas);
  
  const distanciaOriginal = calcularDistanciaRota(destinos, origem);
  const distanciaOtimizada = calcularDistanciaRota(destinosOrdenados, origem);

  // 6. Gerar insights
  const insights = gerarInsightsOtimizacao(
    destinos,
    destinosOrdenados,
    historicoZonas,
    padraoTrafego
  );

  // 7. Buscar zonas com mais demanda
  const zonasMaisDemanda = await buscarZonasMaisDemanda(destinos);

  // 8. Calcular horário recomendado
  const horarioRecomendado = calcularHorarioRecomendado(destinos, historicoZonas);

  return {
    rotaOriginal: destinos,
    rotaOtimizada: destinosOrdenados,
    economia: {
      tempo: Math.round(tempoOriginal - tempoOtimizado),
      distancia: Number((distanciaOriginal - distanciaOtimizada).toFixed(2)),
      percentual: Math.round(((tempoOriginal - tempoOtimizado) / tempoOriginal) * 100),
    },
    predicoes: {
      tempoTotalEstimado: Math.round(tempoOtimizado),
      tempoMedioPorParada: Math.round(tempoOtimizado / destinos.length),
      confianca: calcularConfiancaPredicao(historicoZonas, destinos.length),
      horarioRecomendado,
      zonasMaisDemanda,
    },
    ajustes,
    insights,
  };
}

/**
 * Busca histórico de entregas para zonas específicas
 * 
 * @pre destinos contém cep
 * @post Map com zona -> HistoricoZona
 */
async function buscarHistoricoZonas(
  destinos: DestinoInput[],
  fornecedor?: string
): Promise<Map<string, HistoricoZona>> {
  const historicoMap = new Map<string, HistoricoZona>();
  
  // Extrair zonas únicas (5 primeiros dígitos do CEP)
  const zonas = [...new Set(
    destinos
      .filter(d => d.cep)
      .map(d => d.cep!.replace(/\D/g, '').substring(0, 5))
  )];

  if (zonas.length === 0) return historicoMap;

  // Buscar agregações
  const agregacoes = await prisma.agregacaoDemanda.findMany({
    where: {
      zona: { in: zonas },
      ...(fornecedor && { fornecedor }),
    },
    orderBy: { periodoFim: 'desc' },
  });

  // Buscar tempos reais de entrega
  for (const zona of zonas) {
    const paradas = await prisma.parada.findMany({
      where: {
        cep: { startsWith: zona },
        status: 'ENTREGUE',
        tempoRealMinutos: { not: null },
      },
      select: {
        tempoRealMinutos: true,
        entregueEm: true,
      },
      orderBy: { entregueEm: 'desc' },
      take: 50, // Últimas 50 entregas
    });

    if (paradas.length > 0) {
      const tempos = paradas.map(p => p.tempoRealMinutos!);
      historicoMap.set(zona, {
        zona,
        tempoMedioEntrega: calcularMedia(tempos),
        desvioPadrao: calcularDesvioPadrao(tempos),
        totalEntregas: paradas.length,
        ultimaEntrega: paradas[0].entregueEm!,
      });
    }
  }

  return historicoMap;
}

/**
 * Calcula padrão de tráfego para horário específico
 */
function calcularPadraoTrafego(hora: number): PadraoTrafego {
  const diaSemana = new Date().getDay();
  const fatorHora = FATORES_TRAFEGO_HORA[hora] || 1.0;
  const fatorDia = FATORES_TRAFEGO_DIA[diaSemana] || 1.0;

  return {
    horario: hora,
    diaSemana,
    fatorAtraso: fatorHora * fatorDia,
    confianca: fatorHora > 1.2 ? 0.7 : 0.9, // Menor confiança em horários de pico
  };
}

/**
 * Ordena destinos usando ML e heurísticas
 * 
 * Combina:
 * - Nearest neighbor básico
 * - Ajuste por tempo histórico de entrega
 * - Priorização por janela ideal
 */
function ordenarComML(
  destinos: DestinoInput[],
  origem: OrigemInput,
  historicoZonas: Map<string, HistoricoZona>,
  padraoTrafego: PadraoTrafego
): DestinoInput[] {
  if (destinos.length <= 1) return [...destinos];

  const resultado: DestinoInput[] = [];
  const restantes = [...destinos];
  let posicaoAtual = { lat: origem.lat, lng: origem.lng };

  while (restantes.length > 0) {
    // Para cada destino restante, calcular score
    let melhorIdx = 0;
    let melhorScore = Infinity;

    for (let i = 0; i < restantes.length; i++) {
      const destino = restantes[i];
      const distancia = haversine(
        posicaoAtual.lat,
        posicaoAtual.lng,
        destino.lat,
        destino.lng
      );

      // Score base = distância
      let score = distancia;

      // Ajuste por histórico da zona
      const zona = destino.cep?.substring(0, 5);
      if (zona && historicoZonas.has(zona)) {
        const hist = historicoZonas.get(zona)!;
        // Se tempo médio da zona é alto, penaliza menos (entregar primeiro)
        score *= (1 + hist.tempoMedioEntrega / 60);
      }

      // Ajuste por prioridade (se definida)
      if (destino.prioridade) {
        score /= destino.prioridade;
      }

      if (score < melhorScore) {
        melhorScore = score;
        melhorIdx = i;
      }
    }

    // Adiciona o melhor ao resultado
    const escolhido = restantes.splice(melhorIdx, 1)[0];
    resultado.push(escolhido);
    posicaoAtual = { lat: escolhido.lat, lng: escolhido.lng };
  }

  return resultado;
}

/**
 * Calcula ajustes feitos pelo ML
 */
function calcularAjustesML(
  original: DestinoInput[],
  otimizado: DestinoInput[],
  historicoZonas: Map<string, HistoricoZona>,
  padraoTrafego: PadraoTrafego
): AjusteML[] {
  const ajustes: AjusteML[] = [];

  // Ajuste de tempo por tráfego
  if (padraoTrafego.fatorAtraso !== 1.0) {
    ajustes.push({
      tipo: 'TEMPO',
      descricao: `Ajuste por tráfego (${padraoTrafego.horario}h ${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][padraoTrafego.diaSemana]})`,
      valorOriginal: 1.0,
      valorAjustado: padraoTrafego.fatorAtraso,
      fatorConfianca: padraoTrafego.confianca,
    });
  }

  // Ajustes por zona com histórico
  for (const [zona, hist] of historicoZonas) {
    if (hist.totalEntregas >= 10) {
      const ajusteZona = hist.tempoMedioEntrega / TEMPO_BASE_PARADA;
      if (ajusteZona > 1.2 || ajusteZona < 0.8) {
        ajustes.push({
          tipo: 'TEMPO',
          descricao: `Tempo médio zona ${zona} (${hist.totalEntregas} entregas)`,
          valorOriginal: TEMPO_BASE_PARADA,
          valorAjustado: hist.tempoMedioEntrega,
          fatorConfianca: Math.min(0.95, 0.5 + hist.totalEntregas / 100),
        });
      }
    }
  }

  // Ajuste de ordem
  const mudancasOrdem = countOrdemMudancas(original, otimizado);
  if (mudancasOrdem > 0) {
    ajustes.push({
      tipo: 'ORDEM',
      descricao: `${mudancasOrdem} destinos reordenados para otimização`,
      valorOriginal: 0,
      valorAjustado: mudancasOrdem,
      fatorConfianca: 0.85,
    });
  }

  return ajustes;
}

/**
 * Gera insights sobre a otimização
 */
function gerarInsightsOtimizacao(
  original: DestinoInput[],
  otimizado: DestinoInput[],
  historicoZonas: Map<string, HistoricoZona>,
  padraoTrafego: PadraoTrafego
): InsightOtimizacao[] {
  const insights: InsightOtimizacao[] = [];

  // Insight de horário de pico
  if (padraoTrafego.fatorAtraso > 1.3) {
    insights.push({
      tipo: 'ALERTA',
      titulo: '🚦 Horário de pico detectado',
      descricao: `Tráfego ${Math.round((padraoTrafego.fatorAtraso - 1) * 100)}% acima do normal`,
      acao: 'Considere antecipar ou adiar a partida',
      prioridade: 1,
    });
  }

  // Insight de zonas problemáticas
  const zonasLentas = Array.from(historicoZonas.values())
    .filter(h => h.tempoMedioEntrega > TEMPO_BASE_PARADA * 1.5);
  
  if (zonasLentas.length > 0) {
    insights.push({
      tipo: 'TENDENCIA',
      titulo: '📍 Zonas com tempo elevado',
      descricao: `${zonasLentas.length} zona(s) têm tempo de entrega acima da média`,
      acao: 'Planeje tempo extra para: ' + zonasLentas.map(z => z.zona).join(', '),
      prioridade: 2,
    });
  }

  // Insight de economia
  const economiaEstimada = calcularEconomiaOrdem(original, otimizado);
  if (economiaEstimada > 0.1) {
    insights.push({
      tipo: 'SUGESTAO',
      titulo: '💡 Rota otimizada com sucesso',
      descricao: `Economia estimada de ${Math.round(economiaEstimada * 100)}% na distância`,
      prioridade: 3,
    });
  }

  // Insight de dados históricos
  const totalHistorico = Array.from(historicoZonas.values())
    .reduce((acc, h) => acc + h.totalEntregas, 0);
  
  if (totalHistorico > 50) {
    insights.push({
      tipo: 'TENDENCIA',
      titulo: '📊 Otimização baseada em dados reais',
      descricao: `Previsões baseadas em ${totalHistorico} entregas anteriores`,
      prioridade: 4,
    });
  } else if (totalHistorico === 0) {
    insights.push({
      tipo: 'ALERTA',
      titulo: '⚠️ Sem histórico disponível',
      descricao: 'Usando estimativas padrão. Dados melhoram com o uso.',
      prioridade: 2,
    });
  }

  return insights.sort((a, b) => a.prioridade - b.prioridade);
}

/**
 * Busca zonas com mais demanda prevista
 */
async function buscarZonasMaisDemanda(destinos: DestinoInput[]): Promise<string[]> {
  const zonas = [...new Set(
    destinos
      .filter(d => d.cep)
      .map(d => d.cep!.replace(/\D/g, '').substring(0, 5))
  )];

  if (zonas.length === 0) return [];

  const agregacoes = await prisma.agregacaoDemanda.findMany({
    where: { zona: { in: zonas } },
    orderBy: { mediaEntregasDia: 'desc' },
    take: 3,
    select: { zona: true },
  });

  return agregacoes.map(a => a.zona);
}

/**
 * Calcula melhor horário baseado no histórico
 */
function calcularHorarioRecomendado(
  destinos: DestinoInput[],
  historicoZonas: Map<string, HistoricoZona>
): string {
  // Por padrão, evitar horários de pico
  // Melhor horário: 09:00-11:00 ou 14:00-16:00
  const horaAtual = new Date().getHours();
  
  if (horaAtual < 9) {
    return '09:00 - 11:00';
  } else if (horaAtual < 14) {
    return '14:00 - 16:00';
  } else {
    return 'Amanhã 09:00 - 11:00';
  }
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcularTempoRota(
  destinos: DestinoInput[],
  origem: OrigemInput,
  padraoTrafego: PadraoTrafego,
  historicoZonas: Map<string, HistoricoZona>
): number {
  let tempoTotal = 0;
  let posAtual = { lat: origem.lat, lng: origem.lng };

  for (const destino of destinos) {
    const dist = haversine(posAtual.lat, posAtual.lng, destino.lat, destino.lng);
    const tempoViagem = (dist / VELOCIDADE_BASE) * 60 * padraoTrafego.fatorAtraso;
    
    const zona = destino.cep?.substring(0, 5);
    const tempoParada = zona && historicoZonas.has(zona)
      ? historicoZonas.get(zona)!.tempoMedioEntrega
      : TEMPO_BASE_PARADA;

    tempoTotal += tempoViagem + tempoParada;
    posAtual = { lat: destino.lat, lng: destino.lng };
  }

  return tempoTotal;
}

function calcularDistanciaRota(destinos: DestinoInput[], origem: OrigemInput): number {
  let distTotal = 0;
  let posAtual = { lat: origem.lat, lng: origem.lng };

  for (const destino of destinos) {
    distTotal += haversine(posAtual.lat, posAtual.lng, destino.lat, destino.lng);
    posAtual = { lat: destino.lat, lng: destino.lng };
  }

  return distTotal;
}

function countOrdemMudancas(original: DestinoInput[], otimizado: DestinoInput[]): number {
  let mudancas = 0;
  for (let i = 0; i < original.length; i++) {
    if (original[i].id !== otimizado[i]?.id) {
      mudancas++;
    }
  }
  return mudancas;
}

function calcularEconomiaOrdem(original: DestinoInput[], otimizado: DestinoInput[]): number {
  if (original.length < 2) return 0;
  
  const distOriginal = calcularDistanciaTotal(original);
  const distOtimizada = calcularDistanciaTotal(otimizado);
  
  return (distOriginal - distOtimizada) / distOriginal;
}

function calcularDistanciaTotal(destinos: DestinoInput[]): number {
  let total = 0;
  for (let i = 0; i < destinos.length - 1; i++) {
    total += haversine(
      destinos[i].lat, destinos[i].lng,
      destinos[i + 1].lat, destinos[i + 1].lng
    );
  }
  return total;
}

function calcularMedia(valores: number[]): number {
  if (valores.length === 0) return 0;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

function calcularDesvioPadrao(valores: number[]): number {
  if (valores.length < 2) return 0;
  const media = calcularMedia(valores);
  const somaQuadrados = valores.reduce((acc, v) => acc + (v - media) ** 2, 0);
  return Math.sqrt(somaQuadrados / valores.length);
}

function calcularConfiancaPredicao(
  historicoZonas: Map<string, HistoricoZona>,
  numDestinos: number
): number {
  const totalHistorico = Array.from(historicoZonas.values())
    .reduce((acc, h) => acc + h.totalEntregas, 0);
  
  // Confiança base pelo número de dados históricos
  let confianca = Math.min(0.95, 0.5 + (totalHistorico / (numDestinos * 20)));
  
  // Penaliza se há zonas sem histórico
  const zonasComHistorico = historicoZonas.size;
  if (zonasComHistorico < numDestinos * 0.5) {
    confianca *= 0.8;
  }
  
  return Number(confianca.toFixed(2));
}

// ==========================================
// EXPORT
// ==========================================

export default {
  otimizarRotaComML,
};
