/**
 * @fileoverview Serviço de roteamento com cálculo de distâncias reais
 * 
 * Usa OSRM (Open Source Routing Machine) para calcular distâncias reais
 * pelas ruas, com fallback para Haversine + fator de correção.
 * 
 * OSRM Demo Server: https://router.project-osrm.org (grátis, sem limite)
 */

import { haversine } from '../utils/calculos';
import { ajustarDuracaoComTrafego } from './trafego';

// ==========================================
// TIPOS
// ==========================================

export interface RotaOSRM {
  distanciaKm: number;
  duracaoMin: number;
  duracaoComTrafego?: number;
  fatorTrafego?: number;
  geometria?: string; // Polyline encoded
}

export interface MatrizDistancias {
  distancias: number[][]; // [origem][destino] em km
  duracoes: number[][]; // [origem][destino] em minutos
}

// ==========================================
// CONFIGURAÇÕES
// ==========================================

// OSRM Demo Server (gratuito)
const OSRM_BASE_URL = 'https://router.project-osrm.org';

// Fator de correção urbano: distância real ≈ 1.4x distância em linha reta
// Baseado em estudos de mobilidade urbana brasileira
const FATOR_CORRECAO_URBANO = 1.4;

// Timeout para requisições OSRM
const OSRM_TIMEOUT_MS = 5000;

// Cache de rotas (evitar requisições repetidas)
const cacheRotas = new Map<string, RotaOSRM>();

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

/**
 * Gera chave única para cache
 */
function gerarChaveCache(lat1: number, lng1: number, lat2: number, lng2: number): string {
  return `${lat1.toFixed(5)},${lng1.toFixed(5)}-${lat2.toFixed(5)},${lng2.toFixed(5)}`;
}

/**
 * Calcula distância com fator de correção (fallback)
 */
export function calcularDistanciaCorrigida(
  lat1: number, lng1: number, 
  lat2: number, lng2: number
): RotaOSRM {
  const distanciaLinha = haversine(lat1, lng1, lat2, lng2);
  const distanciaCorrigida = distanciaLinha * FATOR_CORRECAO_URBANO;
  
  // Estimar tempo: 30km/h média urbana
  const duracaoBase = Math.round((distanciaCorrigida / 30) * 60);
  const ajuste = ajustarDuracaoComTrafego(duracaoBase);
  
  return {
    distanciaKm: Number(distanciaCorrigida.toFixed(2)),
    duracaoMin: duracaoBase,
    duracaoComTrafego: ajuste.duracaoAjustada,
    fatorTrafego: ajuste.fatorAplicado,
  };
}

// ==========================================
// OSRM API
// ==========================================

/**
 * Busca rota real usando OSRM
 * 
 * @param lat1 Latitude origem
 * @param lng1 Longitude origem
 * @param lat2 Latitude destino
 * @param lng2 Longitude destino
 * @returns Rota com distância e duração reais
 */
export async function calcularRotaOSRM(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): Promise<RotaOSRM> {
  const chave = gerarChaveCache(lat1, lng1, lat2, lng2);
  
  // Verificar cache
  if (cacheRotas.has(chave)) {
    console.log('[OSRM] Cache hit');
    return cacheRotas.get(chave)!;
  }
  
  try {
    // OSRM usa formato: lng,lat (invertido!)
    const url = `${OSRM_BASE_URL}/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`;
    
    console.log('[OSRM] Buscando rota real...');
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`OSRM HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('OSRM não encontrou rota');
    }
    
    const rota = data.routes[0];
    const duracaoBase = Math.round(rota.duration / 60); // segundos -> minutos
    const ajuste = ajustarDuracaoComTrafego(duracaoBase);
    
    const resultado: RotaOSRM = {
      distanciaKm: Number((rota.distance / 1000).toFixed(2)), // metros -> km
      duracaoMin: duracaoBase,
      duracaoComTrafego: ajuste.duracaoAjustada,
      fatorTrafego: ajuste.fatorAplicado,
    };
    
    // Salvar no cache
    cacheRotas.set(chave, resultado);
    
    console.log(`[OSRM] Rota encontrada: ${resultado.distanciaKm}km, ${resultado.duracaoMin}min`);
    
    return resultado;
    
  } catch (error) {
    console.warn('[OSRM] Falha, usando fallback:', error);
    
    // Fallback: Haversine + fator de correção
    return calcularDistanciaCorrigida(lat1, lng1, lat2, lng2);
  }
}

/**
 * Calcula matriz de distâncias entre múltiplos pontos
 * Usa OSRM Table Service para eficiência
 */
export async function calcularMatrizDistancias(
  pontos: { lat: number; lng: number }[]
): Promise<MatrizDistancias> {
  if (pontos.length < 2) {
    return { distancias: [], duracoes: [] };
  }
  
  try {
    // Construir coordenadas (OSRM usa lng,lat)
    const coords = pontos.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `${OSRM_BASE_URL}/table/v1/driving/${coords}?annotations=distance,duration`;
    
    console.log(`[OSRM] Calculando matriz ${pontos.length}x${pontos.length}...`);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS * 2);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`OSRM HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.code !== 'Ok') {
      throw new Error('OSRM table falhou');
    }
    
    // Converter metros -> km e segundos -> minutos
    const distancias = data.distances.map((row: number[]) => 
      row.map(d => Number((d / 1000).toFixed(2)))
    );
    
    const duracoes = data.durations.map((row: number[]) =>
      row.map(d => Math.round(d / 60))
    );
    
    console.log('[OSRM] Matriz calculada com sucesso');
    
    return { distancias, duracoes };
    
  } catch (error) {
    console.warn('[OSRM] Falha na matriz, calculando manualmente:', error);
    
    // Fallback: calcular cada par manualmente
    const n = pontos.length;
    const distancias: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    const duracoes: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          const rota = calcularDistanciaCorrigida(
            pontos[i].lat, pontos[i].lng,
            pontos[j].lat, pontos[j].lng
          );
          distancias[i][j] = rota.distanciaKm;
          duracoes[i][j] = rota.duracaoMin;
        }
      }
    }
    
    return { distancias, duracoes };
  }
}

/**
 * Limpa cache de rotas
 */
export function limparCacheRotas(): void {
  cacheRotas.clear();
  console.log('[OSRM] Cache limpo');
}

/**
 * Retorna estatísticas do cache
 */
export function estatisticasCache(): { tamanho: number } {
  return { tamanho: cacheRotas.size };
}
