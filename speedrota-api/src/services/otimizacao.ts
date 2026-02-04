/**
 * @fileoverview Serviço de Otimização de Rotas
 * 
 * ALGORITMOS IMPLEMENTADOS:
 * 1. Nearest Neighbor (heurística inicial)
 * 2. 2-opt (melhoria local)
 * 3. OSRM (distâncias reais via API)
 * 
 * DESIGN POR CONTRATO:
 * @pre Coordenadas válidas (-90≤lat≤90, -180≤lng≤180)
 * @post Rota otimizada com distância reduzida
 * @invariant Todas as paradas visitadas exatamente uma vez
 */

import { CONSTANTES } from '../config/env.js';

// ==========================================
// TIPOS
// ==========================================

export interface Ponto {
  id: string;
  lat: number;
  lng: number;
}

export interface ParadaOtimizada {
  id: string;
  ordem: number;
  distanciaAnterior: number;
  tempoAnterior: number;
}

export interface ResultadoOtimizacao {
  paradas: ParadaOtimizada[];
  distanciaTotal: number;
  tempoTotal: number;
  algoritmo: 'nearest-neighbor' | '2-opt' | 'osrm';
  melhoriaPercentual?: number;
}

export interface RotaOSRM {
  distanciaKm: number;
  duracaoMin: number;
}

// ==========================================
// HAVERSINE: Distância em Linha Reta
// ==========================================

/**
 * Calcula distância entre dois pontos usando Haversine
 */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Haversine com fator de correção urbana
 * Distância real ≈ 1.4x distância em linha reta
 */
export function haversineCorrigido(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return haversine(lat1, lng1, lat2, lng2) * CONSTANTES.FATOR_CORRECAO_URBANA;
}

// ==========================================
// OSRM: Distância Real via API
// ==========================================

const OSRM_BASE_URL = 'https://router.project-osrm.org';
const OSRM_TIMEOUT_MS = 10000;

// Cache de rotas OSRM
const cacheOSRM = new Map<string, RotaOSRM>();

/**
 * Gera chave única para cache
 */
function gerarChaveCache(lat1: number, lng1: number, lat2: number, lng2: number): string {
  return `${lat1.toFixed(5)},${lng1.toFixed(5)}-${lat2.toFixed(5)},${lng2.toFixed(5)}`;
}

/**
 * Busca rota real usando OSRM (Open Source Routing Machine)
 * Fallback para Haversine corrigido se falhar
 */
export async function calcularDistanciaOSRM(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): Promise<RotaOSRM> {
  const chave = gerarChaveCache(lat1, lng1, lat2, lng2);
  
  // Verificar cache
  if (cacheOSRM.has(chave)) {
    return cacheOSRM.get(chave)!;
  }
  
  try {
    // OSRM usa formato: lng,lat (invertido!)
    const url = `${OSRM_BASE_URL}/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`OSRM HTTP ${response.status}`);
    }
    
    const data = await response.json() as {
      code: string;
      routes?: Array<{ distance: number; duration: number }>;
    };
    
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('OSRM: rota não encontrada');
    }
    
    const result: RotaOSRM = {
      distanciaKm: Number((data.routes[0].distance / 1000).toFixed(2)),
      duracaoMin: Math.round(data.routes[0].duration / 60),
    };
    
    // Salvar no cache
    cacheOSRM.set(chave, result);
    
    return result;
  } catch (error) {
    console.warn('[OSRM] Fallback para Haversine:', error);
    
    // Fallback para Haversine corrigido
    const distancia = haversineCorrigido(lat1, lng1, lat2, lng2);
    return {
      distanciaKm: Number(distancia.toFixed(2)),
      duracaoMin: Math.round((distancia / CONSTANTES.VELOCIDADE_URBANA_KMH) * 60),
    };
  }
}

/**
 * Busca matriz de distâncias para múltiplos pontos via OSRM Table API
 * Muito mais eficiente que calcular par a par
 */
export async function calcularMatrizDistancias(
  pontos: Ponto[]
): Promise<{ distancias: number[][]; duracoes: number[][] }> {
  if (pontos.length < 2) {
    return { distancias: [[0]], duracoes: [[0]] };
  }
  
  try {
    // Construir coordenadas para OSRM: lng,lat;lng,lat;...
    const coords = pontos.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `${OSRM_BASE_URL}/table/v1/driving/${coords}?annotations=distance,duration`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`OSRM Table HTTP ${response.status}`);
    }
    
    const data = await response.json() as {
      code: string;
      distances?: number[][];
      durations?: number[][];
    };
    
    if (data.code !== 'Ok' || !data.distances || !data.durations) {
      throw new Error('OSRM Table: dados não encontrados');
    }
    
    // Converter de metros para km e segundos para minutos
    const distancias = data.distances.map(row => 
      row.map(d => Number((d / 1000).toFixed(2)))
    );
    const duracoes = data.durations.map(row => 
      row.map(d => Math.round(d / 60))
    );
    
    return { distancias, duracoes };
  } catch (error) {
    console.warn('[OSRM Table] Fallback para Haversine:', error);
    
    // Fallback: calcular matriz com Haversine
    const n = pontos.length;
    const distancias: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    const duracoes: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          const dist = haversineCorrigido(pontos[i].lat, pontos[i].lng, pontos[j].lat, pontos[j].lng);
          distancias[i][j] = Number(dist.toFixed(2));
          duracoes[i][j] = Math.round((dist / CONSTANTES.VELOCIDADE_URBANA_KMH) * 60);
        }
      }
    }
    
    return { distancias, duracoes };
  }
}

// ==========================================
// NEAREST NEIGHBOR: Heurística Inicial
// ==========================================

/**
 * Algoritmo Nearest Neighbor para TSP
 * Complexidade: O(n²)
 * Qualidade: ~25% pior que ótimo
 */
export function nearestNeighbor(
  origem: Ponto,
  paradas: Ponto[],
  matrizDistancias?: number[][]
): { ordem: string[]; distanciaTotal: number } {
  if (paradas.length === 0) {
    return { ordem: [], distanciaTotal: 0 };
  }
  
  const n = paradas.length;
  const visitados = new Set<number>();
  const ordem: string[] = [];
  let distanciaTotal = 0;
  
  // Se não temos matriz, criar uma
  if (!matrizDistancias) {
    // Matriz inclui origem como índice 0
    const todosOsPontos = [origem, ...paradas];
    matrizDistancias = Array(todosOsPontos.length).fill(null).map(() => 
      Array(todosOsPontos.length).fill(0)
    );
    
    for (let i = 0; i < todosOsPontos.length; i++) {
      for (let j = 0; j < todosOsPontos.length; j++) {
        if (i !== j) {
          matrizDistancias[i][j] = haversineCorrigido(
            todosOsPontos[i].lat, todosOsPontos[i].lng,
            todosOsPontos[j].lat, todosOsPontos[j].lng
          );
        }
      }
    }
  }
  
  // Começar da origem (índice 0)
  let atualIdx = 0;
  
  while (visitados.size < n) {
    let menorDist = Infinity;
    let proxIdx = -1;
    
    for (let i = 0; i < n; i++) {
      if (visitados.has(i)) continue;
      
      // Índice na matriz: origem é 0, paradas são 1..n
      const dist = matrizDistancias[atualIdx][i + 1];
      if (dist < menorDist) {
        menorDist = dist;
        proxIdx = i;
      }
    }
    
    if (proxIdx !== -1) {
      visitados.add(proxIdx);
      ordem.push(paradas[proxIdx].id);
      distanciaTotal += menorDist;
      atualIdx = proxIdx + 1; // +1 porque origem é 0
    }
  }
  
  return { ordem, distanciaTotal };
}

// ==========================================
// 2-OPT: Melhoria Local
// ==========================================

/**
 * Calcula distância total de uma rota usando matriz de distâncias
 */
function calcularDistanciaRota(
  origemIdx: number,
  rota: number[],
  matrizDistancias: number[][]
): number {
  if (rota.length === 0) return 0;
  
  let distancia = matrizDistancias[origemIdx][rota[0] + 1]; // origem -> primeiro
  
  for (let i = 0; i < rota.length - 1; i++) {
    distancia += matrizDistancias[rota[i] + 1][rota[i + 1] + 1];
  }
  
  return distancia;
}

/**
 * Algoritmo 2-opt para melhoria de rota
 * Troca pares de arestas para reduzir distância total
 * 
 * Complexidade: O(n²) por iteração, múltiplas iterações
 * Melhoria típica: 5-15% sobre Nearest Neighbor
 */
export function twoOpt(
  ordem: number[], // índices das paradas
  matrizDistancias: number[][],
  origemIdx: number = 0,
  maxIteracoes: number = 100
): { ordem: number[]; distanciaTotal: number; iteracoes: number } {
  if (ordem.length < 3) {
    return {
      ordem,
      distanciaTotal: calcularDistanciaRota(origemIdx, ordem, matrizDistancias),
      iteracoes: 0,
    };
  }
  
  let melhorRota = [...ordem];
  let melhorDistancia = calcularDistanciaRota(origemIdx, melhorRota, matrizDistancias);
  let melhorou = true;
  let iteracoes = 0;
  
  while (melhorou && iteracoes < maxIteracoes) {
    melhorou = false;
    iteracoes++;
    
    for (let i = 0; i < melhorRota.length - 1; i++) {
      for (let j = i + 1; j < melhorRota.length; j++) {
        // Criar nova rota com segmento i..j invertido
        const novaRota = [
          ...melhorRota.slice(0, i),
          ...melhorRota.slice(i, j + 1).reverse(),
          ...melhorRota.slice(j + 1),
        ];
        
        const novaDistancia = calcularDistanciaRota(origemIdx, novaRota, matrizDistancias);
        
        if (novaDistancia < melhorDistancia - 0.01) { // tolerância de 10m
          melhorRota = novaRota;
          melhorDistancia = novaDistancia;
          melhorou = true;
        }
      }
    }
  }
  
  return {
    ordem: melhorRota,
    distanciaTotal: melhorDistancia,
    iteracoes,
  };
}

// ==========================================
// FUNÇÃO PRINCIPAL DE OTIMIZAÇÃO
// ==========================================

/**
 * Otimiza rota usando OSRM + Nearest Neighbor + 2-opt
 * 
 * @param origem Ponto de origem
 * @param paradas Lista de paradas a visitar
 * @param incluirRetorno Se deve calcular retorno à origem
 * @returns Resultado otimizado com métricas
 */
export async function otimizarRotaCompleta(
  origem: Ponto,
  paradas: Ponto[],
  incluirRetorno: boolean = false
): Promise<ResultadoOtimizacao> {
  if (paradas.length === 0) {
    return {
      paradas: [],
      distanciaTotal: 0,
      tempoTotal: 0,
      algoritmo: 'nearest-neighbor',
    };
  }
  
  // 1. Obter matriz de distâncias via OSRM (ou fallback)
  const todosOsPontos = [origem, ...paradas];
  const { distancias: matrizDistancias, duracoes: matrizDuracoes } = 
    await calcularMatrizDistancias(todosOsPontos);
  
  // 2. Aplicar Nearest Neighbor para solução inicial
  const nnResult = nearestNeighbor(origem, paradas, matrizDistancias);
  const distanciaNN = nnResult.distanciaTotal;
  
  // Converter ordem de IDs para índices
  const ordemIndices = nnResult.ordem.map(id => 
    paradas.findIndex(p => p.id === id)
  );
  
  // 3. Melhorar com 2-opt
  const optResult = twoOpt(ordemIndices, matrizDistancias, 0);
  const distancia2opt = optResult.distanciaTotal;
  
  // 4. Construir resultado final
  const paradasOtimizadas: ParadaOtimizada[] = [];
  let tempoTotal = 0;
  let distanciaTotal = 0;
  let pontoAnteriorIdx = 0; // origem
  
  for (let i = 0; i < optResult.ordem.length; i++) {
    const paradaIdx = optResult.ordem[i];
    const parada = paradas[paradaIdx];
    
    const distancia = matrizDistancias[pontoAnteriorIdx][paradaIdx + 1];
    const duracao = matrizDuracoes[pontoAnteriorIdx][paradaIdx + 1];
    
    paradasOtimizadas.push({
      id: parada.id,
      ordem: i + 1,
      distanciaAnterior: Number(distancia.toFixed(2)),
      tempoAnterior: duracao,
    });
    
    distanciaTotal += distancia;
    tempoTotal += duracao;
    pontoAnteriorIdx = paradaIdx + 1;
  }
  
  // 5. Adicionar retorno se necessário
  if (incluirRetorno && optResult.ordem.length > 0) {
    const ultimaParadaIdx = optResult.ordem[optResult.ordem.length - 1] + 1;
    distanciaTotal += matrizDistancias[ultimaParadaIdx][0];
    tempoTotal += matrizDuracoes[ultimaParadaIdx][0];
  }
  
  // Calcular melhoria
  const melhoriaPercentual = distanciaNN > 0 
    ? Number((((distanciaNN - distancia2opt) / distanciaNN) * 100).toFixed(1))
    : 0;
  
  console.log(`[Otimização] NN: ${distanciaNN.toFixed(2)}km → 2-opt: ${distancia2opt.toFixed(2)}km (${melhoriaPercentual}% melhor)`);
  
  return {
    paradas: paradasOtimizadas,
    distanciaTotal: Number(distanciaTotal.toFixed(2)),
    tempoTotal,
    algoritmo: '2-opt',
    melhoriaPercentual,
  };
}
