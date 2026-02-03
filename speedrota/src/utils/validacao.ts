/**
 * @fileoverview Funções de validação com Design por Contrato
 * 
 * Cada validação retorna:
 * - { valido: true } se passou
 * - { valido: false, erro: string } se falhou
 * 
 * SANITY CHECKS implementados:
 * - Coordenadas dentro de ranges válidos
 * - Campos obrigatórios preenchidos
 * - Duplicatas detectadas
 */

import type { Origem, Destino, GeocodingResult } from '../types';

export interface ResultadoValidacao {
  valido: boolean;
  erro?: string;
  avisos?: string[];
}

// ==========================================
// VALIDAÇÕES DE COORDENADAS
// ==========================================

/**
 * Valida se latitude está no range válido (-90 a 90)
 */
export function validarLatitude(lat: number): ResultadoValidacao {
  if (typeof lat !== 'number' || isNaN(lat)) {
    return { valido: false, erro: 'Latitude inválida: não é um número' };
  }
  if (lat < -90 || lat > 90) {
    return { valido: false, erro: `Latitude fora do range: ${lat} (esperado: -90 a 90)` };
  }
  return { valido: true };
}

/**
 * Valida se longitude está no range válido (-180 a 180)
 */
export function validarLongitude(lng: number): ResultadoValidacao {
  if (typeof lng !== 'number' || isNaN(lng)) {
    return { valido: false, erro: 'Longitude inválida: não é um número' };
  }
  if (lng < -180 || lng > 180) {
    return { valido: false, erro: `Longitude fora do range: ${lng} (esperado: -180 a 180)` };
  }
  return { valido: true };
}

/**
 * Valida coordenadas completas (lat/lng)
 */
export function validarCoordenadas(lat: number, lng: number): ResultadoValidacao {
  const latResult = validarLatitude(lat);
  if (!latResult.valido) return latResult;
  
  const lngResult = validarLongitude(lng);
  if (!lngResult.valido) return lngResult;
  
  // Sanity check: coordenadas no Brasil (aproximadamente)
  const avisos: string[] = [];
  const NO_BRASIL = lat >= -34 && lat <= 5 && lng >= -74 && lng <= -32;
  
  if (!NO_BRASIL) {
    avisos.push('Coordenadas parecem estar fora do Brasil');
  }
  
  return { valido: true, avisos: avisos.length > 0 ? avisos : undefined };
}

// ==========================================
// VALIDAÇÕES DE ORIGEM
// ==========================================

/**
 * Valida objeto Origem completo
 * PRÉ-CONDIÇÕES:
 * - lat/lng válidos
 * - endereco não vazio
 * - fonte definida
 */
export function validarOrigem(origem: Partial<Origem>): ResultadoValidacao {
  if (!origem) {
    return { valido: false, erro: 'Origem não definida' };
  }
  
  // Validar coordenadas
  if (origem.lat === undefined || origem.lng === undefined) {
    return { valido: false, erro: 'Coordenadas da origem não definidas' };
  }
  
  const coordResult = validarCoordenadas(origem.lat, origem.lng);
  if (!coordResult.valido) return coordResult;
  
  // Validar endereço
  if (!origem.endereco?.trim()) {
    return { valido: false, erro: 'Endereço da origem não definido' };
  }
  
  // Validar fonte
  if (!['gps', 'manual'].includes(origem.fonte as string)) {
    return { valido: false, erro: 'Fonte da origem inválida (esperado: gps ou manual)' };
  }
  
  // Validar precisão GPS se aplicável
  if (origem.fonte === 'gps' && origem.precisao !== undefined) {
    if (origem.precisao < 0) {
      return { valido: false, erro: 'Precisão GPS não pode ser negativa' };
    }
    if (origem.precisao > 1000) {
      return { 
        valido: true, 
        avisos: [`Precisão GPS muito baixa: ${origem.precisao}m. Considere ajuste manual.`] 
      };
    }
  }
  
  return { valido: true, avisos: coordResult.avisos };
}

// ==========================================
// VALIDAÇÕES DE DESTINO
// ==========================================

/**
 * Valida objeto Destino completo
 */
export function validarDestino(destino: Partial<Destino>): ResultadoValidacao {
  const avisos: string[] = [];
  
  if (!destino) {
    return { valido: false, erro: 'Destino não definido' };
  }
  
  // ID obrigatório
  if (!destino.id?.trim()) {
    return { valido: false, erro: 'ID do destino não definido' };
  }
  
  // Validar coordenadas
  if (destino.lat === undefined || destino.lng === undefined) {
    return { valido: false, erro: 'Coordenadas do destino não definidas' };
  }
  
  const coordResult = validarCoordenadas(destino.lat, destino.lng);
  if (!coordResult.valido) return coordResult;
  if (coordResult.avisos) avisos.push(...coordResult.avisos);
  
  // Validar campos obrigatórios
  if (!destino.nome?.trim()) {
    return { valido: false, erro: 'Nome do destinatário não definido' };
  }
  
  if (!destino.endereco?.trim()) {
    return { valido: false, erro: 'Endereço do destino não definido' };
  }
  
  if (!destino.cidade?.trim()) {
    return { valido: false, erro: 'Cidade do destino não definida' };
  }
  
  if (!destino.uf?.trim() || destino.uf.length !== 2) {
    return { valido: false, erro: 'UF inválida (esperado: 2 caracteres)' };
  }
  
  // Validar fonte
  if (!['ocr', 'manual'].includes(destino.fonte as string)) {
    return { valido: false, erro: 'Fonte do destino inválida (esperado: ocr ou manual)' };
  }
  
  // Validar confiança
  if (destino.confianca === undefined || destino.confianca < 0 || destino.confianca > 1) {
    return { valido: false, erro: 'Confiança do geocoding inválida (esperado: 0 a 1)' };
  }
  
  // Avisos de baixa confiança
  if (destino.confianca < 0.5) {
    avisos.push(`Geocoding com baixa confiança: ${(destino.confianca * 100).toFixed(0)}%`);
  }
  
  return { valido: true, avisos: avisos.length > 0 ? avisos : undefined };
}

// ==========================================
// VALIDAÇÕES DE LISTA
// ==========================================

/**
 * Valida lista de destinos para cálculo de rota
 * REGRAS:
 * - Mínimo 1 destino
 * - Sem duplicatas (mesmas coordenadas)
 * - Todos os destinos válidos
 */
export function validarListaDestinos(destinos: Destino[]): ResultadoValidacao {
  const avisos: string[] = [];
  
  if (!destinos || destinos.length === 0) {
    return { valido: false, erro: 'Adicione pelo menos 1 destino para calcular a rota' };
  }
  
  // Validar cada destino
  for (let i = 0; i < destinos.length; i++) {
    const result = validarDestino(destinos[i]);
    if (!result.valido) {
      return { valido: false, erro: `Destino ${i + 1}: ${result.erro}` };
    }
    if (result.avisos) {
      avisos.push(...result.avisos.map(a => `Destino ${i + 1}: ${a}`));
    }
  }
  
  // Verificar duplicatas (coordenadas muito próximas)
  const duplicatas = encontrarDuplicatas(destinos);
  if (duplicatas.length > 0) {
    avisos.push(`Possíveis destinos duplicados: ${duplicatas.join(', ')}`);
  }
  
  return { valido: true, avisos: avisos.length > 0 ? avisos : undefined };
}

/**
 * Encontra destinos com coordenadas muito próximas (< 50m)
 */
function encontrarDuplicatas(destinos: Destino[]): string[] {
  const duplicatas: string[] = [];
  const LIMITE_METROS = 50;
  
  for (let i = 0; i < destinos.length; i++) {
    for (let j = i + 1; j < destinos.length; j++) {
      const distancia = calcularDistanciaMetros(
        destinos[i].lat, destinos[i].lng,
        destinos[j].lat, destinos[j].lng
      );
      if (distancia < LIMITE_METROS) {
        duplicatas.push(`${destinos[i].nome} ↔ ${destinos[j].nome}`);
      }
    }
  }
  
  return duplicatas;
}

/**
 * Calcula distância em metros entre duas coordenadas (Haversine simplificado)
 */
function calcularDistanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Raio da Terra em metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ==========================================
// VALIDAÇÕES DE GEOCODING
// ==========================================

/**
 * Valida resultado de geocoding
 */
export function validarGeocodingResult(result: GeocodingResult): ResultadoValidacao {
  const coordResult = validarCoordenadas(result.lat, result.lng);
  if (!coordResult.valido) return coordResult;
  
  if (!['alta', 'media', 'baixa'].includes(result.confianca)) {
    return { valido: false, erro: 'Nível de confiança inválido' };
  }
  
  if (result.confiancaValor < 0 || result.confiancaValor > 1) {
    return { valido: false, erro: 'Valor de confiança fora do range (0-1)' };
  }
  
  return { valido: true, avisos: coordResult.avisos };
}

// ==========================================
// VALIDAÇÃO COMPLETA PARA CÁLCULO DE ROTA
// ==========================================

/**
 * Valida se é possível calcular a rota
 * PRÉ-CONDIÇÕES para otimização:
 * - Origem válida
 * - Pelo menos 1 destino válido
 * - Sem coordenadas inválidas
 */
export function validarParaCalculo(origem: Origem | null, destinos: Destino[]): ResultadoValidacao {
  // Validar origem
  if (!origem) {
    return { valido: false, erro: 'Defina a origem da rota antes de calcular' };
  }
  
  const origemResult = validarOrigem(origem);
  if (!origemResult.valido) {
    return { valido: false, erro: `Origem: ${origemResult.erro}` };
  }
  
  // Validar destinos
  const destinosResult = validarListaDestinos(destinos);
  if (!destinosResult.valido) {
    return destinosResult;
  }
  
  // Coletar todos os avisos
  const avisos: string[] = [];
  if (origemResult.avisos) avisos.push(...origemResult.avisos);
  if (destinosResult.avisos) avisos.push(...destinosResult.avisos);
  
  return { valido: true, avisos: avisos.length > 0 ? avisos : undefined };
}
