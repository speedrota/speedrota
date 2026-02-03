/**
 * @fileoverview Serviços de Geolocalização e Geocoding
 * 
 * ESTRATÉGIA DE GEOCODING (Fallback em Cascata):
 * 1. Cache local
 * 2. Nominatim (OpenStreetMap) - gratuito
 * 3. ViaCEP - para CEPs brasileiros
 * 
 * OBSERVABILIDADE:
 * - Logs de cada tentativa
 * - Métricas de sucesso/falha
 * - Tempo de resposta
 */

import type { Origem, GeocodingResult } from '../types';

// ==========================================
// CACHE DE GEOCODING
// ==========================================

const geocodingCache = new Map<string, GeocodingResult>();

/**
 * Gera hash do endereço para cache
 */
function gerarHashEndereco(endereco: string): string {
  return endereco.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Busca no cache local
 */
function buscarNoCache(endereco: string): GeocodingResult | null {
  const hash = gerarHashEndereco(endereco);
  return geocodingCache.get(hash) || null;
}

/**
 * Salva no cache local
 */
function salvarNoCache(endereco: string, resultado: GeocodingResult): void {
  const hash = gerarHashEndereco(endereco);
  geocodingCache.set(hash, resultado);
}

// ==========================================
// GPS: Captura de Localização
// ==========================================

export interface GPSOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

const DEFAULT_GPS_OPTIONS: GPSOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 60000,
};

/**
 * Verifica se geolocalização está disponível
 */
export function isGeolocationAvailable(): boolean {
  return 'geolocation' in navigator;
}

/**
 * Captura a localização atual via GPS
 * 
 * @throws Error se GPS não disponível ou permissão negada
 */
export async function capturarLocalizacaoGPS(
  options: GPSOptions = DEFAULT_GPS_OPTIONS
): Promise<Origem> {
  if (!isGeolocationAvailable()) {
    throw new Error('Geolocalização não disponível neste navegador');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        
        console.log(`[GPS] Localização capturada: ${latitude}, ${longitude} (precisão: ${accuracy}m)`);
        
        // Fazer reverse geocoding para obter endereço
        let endereco = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        
        try {
          const reverseResult = await reverseGeocode(latitude, longitude);
          if (reverseResult) {
            endereco = reverseResult;
          }
        } catch (error) {
          console.warn('[GPS] Reverse geocoding falhou, usando coordenadas como endereço');
        }
        
        resolve({
          lat: latitude,
          lng: longitude,
          endereco,
          fonte: 'gps',
          precisao: Math.round(accuracy),
          timestamp: new Date(),
        });
      },
      (error) => {
        console.error('[GPS] Erro:', error.message);
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('Permissão de localização negada. Habilite nas configurações do navegador.'));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Localização indisponível. Verifique se o GPS está ativo.'));
            break;
          case error.TIMEOUT:
            reject(new Error('Tempo esgotado ao obter localização. Tente novamente.'));
            break;
          default:
            reject(new Error('Erro ao obter localização'));
        }
      },
      {
        enableHighAccuracy: options.enableHighAccuracy,
        timeout: options.timeout,
        maximumAge: options.maximumAge,
      }
    );
  });
}

// ==========================================
// REVERSE GEOCODING
// ==========================================

/**
 * Converte coordenadas em endereço legível (Nominatim)
 */
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'RouteOptimizer/1.0',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.display_name) {
      return data.display_name;
    }
    
    return null;
  } catch (error) {
    console.error('[ReverseGeocode] Erro:', error);
    return null;
  }
}

// ==========================================
// GEOCODING: Endereço → Coordenadas
// ==========================================

/**
 * Converte endereço em coordenadas (com fallback em cascata)
 * 
 * 1. Cache local
 * 2. Nominatim (OpenStreetMap)
 * 3. ViaCEP + centroide
 */
export async function geocodificarEndereco(
  endereco: string,
  cidade?: string,
  uf?: string,
  cep?: string
): Promise<GeocodingResult> {
  const enderecoCompleto = [endereco, cidade, uf, 'Brasil']
    .filter(Boolean)
    .join(', ');
  
  console.log(`[Geocoding] Iniciando para: ${enderecoCompleto}`);
  
  // 1. Verificar cache
  const cached = buscarNoCache(enderecoCompleto);
  if (cached) {
    console.log('[Geocoding] Encontrado no cache');
    return { ...cached, fonte: 'cache' };
  }
  
  // 2. Tentar Nominatim
  try {
    const nominatimResult = await geocodificarViaNominatim(enderecoCompleto);
    if (nominatimResult) {
      salvarNoCache(enderecoCompleto, nominatimResult);
      return nominatimResult;
    }
  } catch (error) {
    console.warn('[Geocoding] Nominatim falhou:', error);
  }
  
  // 3. Tentar ViaCEP se tiver CEP
  if (cep) {
    try {
      const viaCepResult = await geocodificarViaCEP(cep);
      if (viaCepResult) {
        salvarNoCache(enderecoCompleto, viaCepResult);
        return viaCepResult;
      }
    } catch (error) {
      console.warn('[Geocoding] ViaCEP falhou:', error);
    }
  }
  
  // Fallback: erro
  throw new Error(`Não foi possível geocodificar o endereço: ${enderecoCompleto}`);
}

/**
 * Geocoding via Nominatim (OpenStreetMap)
 */
async function geocodificarViaNominatim(endereco: string): Promise<GeocodingResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(endereco)}&limit=1&addressdetails=1`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'RouteOptimizer/1.0',
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.length === 0) {
    return null;
  }
  
  const result = data[0];
  const importance = parseFloat(result.importance) || 0.5;
  
  // Determinar nível de confiança baseado na importância
  let confianca: 'alta' | 'media' | 'baixa';
  if (importance >= 0.6) {
    confianca = 'alta';
  } else if (importance >= 0.4) {
    confianca = 'media';
  } else {
    confianca = 'baixa';
  }
  
  console.log(`[Nominatim] Encontrado: ${result.display_name} (confiança: ${confianca})`);
  
  return {
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
    confianca,
    confiancaValor: importance,
    fonte: 'nominatim',
    enderecoFormatado: result.display_name,
  };
}

/**
 * Geocoding via ViaCEP + centroide aproximado
 * Usa tabela de coordenadas aproximadas por cidade
 */
async function geocodificarViaCEP(cep: string): Promise<GeocodingResult | null> {
  const cepLimpo = cep.replace(/\D/g, '');
  
  if (cepLimpo.length !== 8) {
    return null;
  }
  
  const url = `https://viacep.com.br/ws/${cepLimpo}/json/`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.erro) {
    return null;
  }
  
  // Usar coordenadas aproximadas de cidades conhecidas
  const coords = COORDENADAS_CIDADES[`${data.localidade}-${data.uf}`];
  
  if (!coords) {
    console.warn(`[ViaCEP] Cidade não encontrada na tabela: ${data.localidade}-${data.uf}`);
    return null;
  }
  
  console.log(`[ViaCEP] Usando centroide de ${data.localidade}-${data.uf}`);
  
  return {
    lat: coords.lat,
    lng: coords.lng,
    confianca: 'baixa',
    confiancaValor: 0.4,
    fonte: 'viacep',
    enderecoFormatado: `${data.logradouro || ''}, ${data.bairro || ''}, ${data.localidade}-${data.uf}, ${cep}`.trim(),
  };
}

// ==========================================
// COORDENADAS APROXIMADAS DE CIDADES
// ==========================================

const COORDENADAS_CIDADES: Record<string, { lat: number; lng: number }> = {
  // São Paulo e região
  'São Paulo-SP': { lat: -23.5505, lng: -46.6333 },
  'Campinas-SP': { lat: -22.9099, lng: -47.0626 },
  'Americana-SP': { lat: -22.7394, lng: -47.3317 },
  'Limeira-SP': { lat: -22.5640, lng: -47.4017 },
  'Piracicaba-SP': { lat: -22.7255, lng: -47.6492 },
  'Sorocaba-SP': { lat: -23.5015, lng: -47.4526 },
  'Jundiaí-SP': { lat: -23.1857, lng: -46.8978 },
  'Cabreúva-SP': { lat: -23.3078, lng: -47.1350 },
  'Santos-SP': { lat: -23.9608, lng: -46.3336 },
  'Guarulhos-SP': { lat: -23.4538, lng: -46.5333 },
  'Osasco-SP': { lat: -23.5324, lng: -46.7916 },
  'Santo André-SP': { lat: -23.6737, lng: -46.5432 },
  'São Bernardo do Campo-SP': { lat: -23.6944, lng: -46.5653 },
  
  // Rio de Janeiro
  'Rio de Janeiro-RJ': { lat: -22.9068, lng: -43.1729 },
  'Niterói-RJ': { lat: -22.8833, lng: -43.1038 },
  
  // Outras capitais
  'Belo Horizonte-MG': { lat: -19.9191, lng: -43.9386 },
  'Curitiba-PR': { lat: -25.4284, lng: -49.2733 },
  'Porto Alegre-RS': { lat: -30.0346, lng: -51.2177 },
  'Salvador-BA': { lat: -12.9714, lng: -38.5014 },
  'Fortaleza-CE': { lat: -3.7172, lng: -38.5434 },
  'Recife-PE': { lat: -8.0476, lng: -34.8770 },
  'Brasília-DF': { lat: -15.7942, lng: -47.8822 },
  'Manaus-AM': { lat: -3.1190, lng: -60.0217 },
};

// ==========================================
// EXPORTAÇÕES ADICIONAIS
// ==========================================

/**
 * Limpa o cache de geocoding
 */
export function limparCacheGeocode(): void {
  geocodingCache.clear();
  console.log('[Geocoding] Cache limpo');
}

/**
 * Retorna estatísticas do cache
 */
export function estatisticasCache(): { tamanho: number } {
  return { tamanho: geocodingCache.size };
}
