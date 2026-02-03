/**
 * @fileoverview Funções de cálculo geoespacial e otimização
 * 
 * ALGORITMOS IMPLEMENTADOS:
 * 1. Haversine: distância entre coordenadas
 * 2. Nearest Neighbor: TSP (Travelling Salesman Problem)
 * 
 * DESIGN POR CONTRATO:
 * - PRÉ: coordenadas válidas (-90≤lat≤90, -180≤lng≤180)
 * - PÓS: distâncias positivas, ordem válida
 */

import type { 
  Origem, 
  Destino, 
  ParadaOrdenada, 
  Metricas, 
  RotaOtimizada,
  Alerta,
  Predicoes,
  JanelaEntrega
} from '../types';
import { CONSTANTES, FATORES_TRAFEGO } from '../types';

// ==========================================
// HAVERSINE: Cálculo de Distância
// ==========================================

/**
 * Calcula a distância em km entre duas coordenadas usando a fórmula de Haversine
 * 
 * @param lat1 Latitude do ponto 1
 * @param lng1 Longitude do ponto 1
 * @param lat2 Latitude do ponto 2
 * @param lng2 Longitude do ponto 2
 * @returns Distância em quilômetros
 * 
 * @example
 * // Distância São Paulo → Rio de Janeiro ≈ 357km
 * haversine(-23.5505, -46.6333, -22.9068, -43.1729)
 */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Raio da Terra em km
  
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLng / 2) ** 2;
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Converte graus para radianos
 */
function toRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

// ==========================================
// FATOR DE CORREÇÃO URBANO
// ==========================================

/**
 * Fator de correção para converter distância em linha reta para distância real
 * Baseado em estudos de mobilidade urbana: distância real ≈ 1.3 a 1.5x linha reta
 */
const FATOR_CORRECAO_URBANO = 1.4;

/**
 * Calcula distância com fator de correção urbano
 * Mais preciso que Haversine puro para cálculos de rota em cidade
 */
export function haversineCorrigido(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const distanciaLinha = haversine(lat1, lng1, lat2, lng2);
  return distanciaLinha * FATOR_CORRECAO_URBANO;
}

// ==========================================
// NEAREST NEIGHBOR: Algoritmo TSP
// ==========================================

/**
 * Implementa o algoritmo Nearest Neighbor para o TSP
 * Encontra uma rota aproximadamente otimizada visitando sempre o ponto mais próximo
 * 
 * Complexidade: O(n²)
 * Qualidade: ~25% pior que o ótimo em média (aceitável para n<50)
 * 
 * NOTA: Usa haversineCorrigido para estimativas mais precisas de distância real
 * 
 * @param origem Ponto de partida
 * @param destinos Lista de destinos a visitar
 * @returns Lista ordenada de paradas com distâncias calculadas
 */
export function nearestNeighbor(
  origem: Origem, 
  destinos: Destino[]
): ParadaOrdenada[] {
  // PRÉ-CONDIÇÃO: pelo menos 1 destino
  if (destinos.length === 0) {
    return [];
  }
  
  const resultado: ParadaOrdenada[] = [];
  const naoVisitados = [...destinos];
  
  let pontoAtual = { lat: origem.lat, lng: origem.lng };
  let distanciaAcumulada = 0;
  let tempoAcumulado = 0;
  let ordem = 1;
  
  while (naoVisitados.length > 0) {
    // Encontrar o destino mais próximo do ponto atual
    // Usa Haversine puro para ordenação (mais rápido)
    let menorDistancia = Infinity;
    let indiceMaisProximo = 0;
    
    for (let i = 0; i < naoVisitados.length; i++) {
      const dist = haversine(
        pontoAtual.lat, pontoAtual.lng,
        naoVisitados[i].lat, naoVisitados[i].lng
      );
      if (dist < menorDistancia) {
        menorDistancia = dist;
        indiceMaisProximo = i;
      }
    }
    
    // Para métricas, usa distância corrigida (mais realista)
    const distanciaReal = haversineCorrigido(
      pontoAtual.lat, pontoAtual.lng,
      naoVisitados[indiceMaisProximo].lat, naoVisitados[indiceMaisProximo].lng
    );
    
    // Calcular tempo do trecho
    const tempoTrecho = calcularTempoViagem(distanciaReal);
    
    // Adicionar à rota
    const destino = naoVisitados[indiceMaisProximo];
    distanciaAcumulada += distanciaReal;
    tempoAcumulado += tempoTrecho;
    
    resultado.push({
      ...destino,
      ordem,
      distanciaAnterior: Number(distanciaReal.toFixed(2)),
      distanciaAcumulada: Number(distanciaAcumulada.toFixed(2)),
      tempoAnterior: Math.round(tempoTrecho),
      tempoAcumulado: Math.round(tempoAcumulado),
    });
    
    // Atualizar ponto atual e remover dos não visitados
    pontoAtual = { lat: destino.lat, lng: destino.lng };
    naoVisitados.splice(indiceMaisProximo, 1);
    ordem++;
  }
  
  // PÓS-CONDIÇÃO: todos os destinos visitados
  console.assert(resultado.length === destinos.length, 'Nem todos os destinos foram visitados');
  
  return resultado;
}

// ==========================================
// CÁLCULO DE MÉTRICAS
// ==========================================

/**
 * Calcula o tempo de viagem em minutos baseado na distância
 */
export function calcularTempoViagem(distanciaKm: number): number {
  return (distanciaKm / CONSTANTES.VELOCIDADE_URBANA_KMH) * 60;
}

/**
 * Obtém o fator de tráfego baseado no horário atual
 */
export function obterFatorTrafego(hora?: number): number {
  const h = hora ?? new Date().getHours();
  
  // Pico manhã
  if (h >= FATORES_TRAFEGO.PICO_MANHA.inicio && h < FATORES_TRAFEGO.PICO_MANHA.fim) {
    return FATORES_TRAFEGO.PICO_MANHA.fator;
  }
  
  // Pico tarde
  if (h >= FATORES_TRAFEGO.PICO_TARDE.inicio && h < FATORES_TRAFEGO.PICO_TARDE.fim) {
    return FATORES_TRAFEGO.PICO_TARDE.fator;
  }
  
  // Horário de almoço
  if (h >= FATORES_TRAFEGO.ALMOCO.inicio && h < FATORES_TRAFEGO.ALMOCO.fim) {
    return FATORES_TRAFEGO.ALMOCO.fator;
  }
  
  // Madrugada
  if (h >= FATORES_TRAFEGO.MADRUGADA.inicio || h < FATORES_TRAFEGO.MADRUGADA.fim) {
    return FATORES_TRAFEGO.MADRUGADA.fator;
  }
  
  return FATORES_TRAFEGO.NORMAL.fator;
}

/**
 * Calcula todas as métricas da rota
 */
export function calcularMetricas(
  paradas: ParadaOrdenada[],
  distanciaRetorno: number = 0
): Metricas {
  const distanciaTotalKm = paradas.length > 0 
    ? paradas[paradas.length - 1].distanciaAcumulada + distanciaRetorno
    : 0;
  
  const tempoViagemMin = calcularTempoViagem(distanciaTotalKm);
  const tempoEntregasMin = paradas.length * CONSTANTES.TEMPO_POR_ENTREGA_MIN;
  const tempoTotalMin = tempoViagemMin + tempoEntregasMin;
  
  const fatorTrafego = obterFatorTrafego();
  const tempoAjustadoMin = tempoTotalMin * fatorTrafego;
  
  const combustivelL = distanciaTotalKm / CONSTANTES.CONSUMO_MEDIO_KML;
  const custoRS = combustivelL * CONSTANTES.PRECO_COMBUSTIVEL_RS;
  
  return {
    distanciaTotalKm: Number(distanciaTotalKm.toFixed(2)),
    tempoViagemMin: Math.round(tempoViagemMin),
    tempoEntregasMin,
    tempoTotalMin: Math.round(tempoTotalMin),
    tempoAjustadoMin: Math.round(tempoAjustadoMin),
    combustivelL: Number(combustivelL.toFixed(2)),
    custoR$: Number(custoRS.toFixed(2)),
    fatorTrafego,
  };
}

// ==========================================
// PREDIÇÕES E ALERTAS
// ==========================================

/**
 * Gera predições de horários de chegada
 */
export function gerarPredicoes(
  paradas: ParadaOrdenada[],
  horaPartida: Date = new Date()
): Predicoes {
  const janelas: JanelaEntrega[] = [];
  const alertas: Alerta[] = [];
  
  let horaAtual = new Date(horaPartida);
  
  for (const parada of paradas) {
    // Adicionar tempo de viagem + entrega anterior
    horaAtual = new Date(horaAtual.getTime() + parada.tempoAnterior * 60000);
    
    const chegadaPrevista = formatarHora(horaAtual);
    
    // Adicionar buffer
    const horaComBuffer = new Date(horaAtual.getTime() + CONSTANTES.BUFFER_TEMPO_MIN * 60000);
    const chegadaAte = formatarHora(horaComBuffer);
    
    // Calcular confiança (diminui com distância e tráfego)
    let confianca = 100;
    confianca -= parada.distanciaAcumulada * 0.5; // -0.5% por km
    confianca -= (obterFatorTrafego() - 1) * 20;  // penalidade por tráfego
    if (parada.confianca < 0.8) confianca -= 15;  // penalidade por geocoding
    confianca = Math.max(30, Math.min(100, confianca));
    
    janelas.push({
      ordem: parada.ordem,
      local: parada.nome,
      chegadaPrevista,
      chegadaAte,
      confianca: Math.round(confianca),
    });
    
    // Adicionar tempo de entrega
    horaAtual = new Date(horaAtual.getTime() + CONSTANTES.TEMPO_POR_ENTREGA_MIN * 60000);
  }
  
  // Gerar alertas
  const ultimaParada = paradas[paradas.length - 1];
  
  if (ultimaParada && ultimaParada.distanciaAcumulada > CONSTANTES.ALERTA_DISTANCIA_KM) {
    alertas.push({
      tipo: 'warning',
      mensagem: `Rota longa: ${ultimaParada.distanciaAcumulada.toFixed(1)} km`,
      acao: 'Considere dividir as entregas em dois dias',
    });
  }
  
  const fator = obterFatorTrafego();
  if (fator >= 1.5) {
    alertas.push({
      tipo: 'warning',
      mensagem: 'Horário de pico - trânsito intenso',
      acao: 'Considere sair após as 19h ou antes das 7h',
    });
  }
  
  // Calcular eficiência (distância real vs distância em linha reta)
  const distanciaLinhaReta = paradas.length > 0
    ? haversine(paradas[0].lat, paradas[0].lng, ultimaParada?.lat ?? 0, ultimaParada?.lng ?? 0)
    : 0;
  const eficiencia = distanciaLinhaReta > 0 
    ? Math.min(100, (distanciaLinhaReta / (ultimaParada?.distanciaAcumulada ?? 1)) * 100)
    : 100;
  
  if (eficiencia < CONSTANTES.LIMITE_EFICIENCIA * 100) {
    alertas.push({
      tipo: 'info',
      mensagem: `Eficiência baixa: ${eficiencia.toFixed(0)}%`,
      acao: 'Considere reagrupar entregas por região',
    });
  }
  
  return {
    janelas,
    eficiencia: Number(eficiencia.toFixed(1)),
    alertas,
  };
}

/**
 * Formata hora no padrão HH:mm
 */
function formatarHora(data: Date): string {
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ==========================================
// FUNÇÃO PRINCIPAL: Otimizar Rota
// ==========================================

/**
 * Função principal que calcula a rota otimizada completa
 * 
 * @param origem Ponto de partida
 * @param destinos Lista de destinos
 * @param incluirRetorno Se deve incluir retorno
 * @param pontoRetorno Ponto de retorno (se null, usa origem)
 * @returns Rota otimizada com métricas e predições
 */
export function otimizarRota(
  origem: Origem,
  destinos: Destino[],
  incluirRetorno: boolean = false,
  pontoRetorno: Origem | null = null
): RotaOtimizada {
  // Aplicar algoritmo Nearest Neighbor
  const paradas = nearestNeighbor(origem, destinos);
  
  // Calcular distância de retorno (se aplicável) - com correção urbana
  let distanciaRetorno = 0;
  const destinoRetorno = pontoRetorno || origem;
  
  if (incluirRetorno && paradas.length > 0) {
    const ultimaParada = paradas[paradas.length - 1];
    // Usar distância corrigida para estimativa mais realista
    distanciaRetorno = haversineCorrigido(ultimaParada.lat, ultimaParada.lng, destinoRetorno.lat, destinoRetorno.lng);
  }
  
  // Calcular métricas
  const metricas = calcularMetricas(paradas, distanciaRetorno);
  
  // Adicionar horários previstos às paradas
  const horaPartida = new Date();
  let horaAtual = new Date(horaPartida);
  
  for (const parada of paradas) {
    horaAtual = new Date(horaAtual.getTime() + parada.tempoAnterior * 60000);
    parada.horarioChegada = formatarHora(horaAtual);
    horaAtual = new Date(horaAtual.getTime() + CONSTANTES.TEMPO_POR_ENTREGA_MIN * 60000);
  }
  
  // Gerar predições
  const predicoes = gerarPredicoes(paradas, horaPartida);
  
  return {
    origem,
    pontoRetorno,
    paradas,
    metricas,
    predicoes,
    incluiRetorno: incluirRetorno,
    distanciaRetornoKm: Number(distanciaRetorno.toFixed(2)),
    calculadoEm: new Date(),
  };
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

/**
 * Formata distância para exibição
 */
export function formatarDistancia(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

/**
 * Formata tempo para exibição
 */
export function formatarTempo(minutos: number): string {
  if (minutos < 60) {
    return `${minutos} min`;
  }
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  return mins > 0 ? `${horas}h ${mins}min` : `${horas}h`;
}

/**
 * Formata valor monetário
 */
export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
