/**
 * @fileoverview Componente Mapa com Leaflet
 * 
 * Exibe:
 * - Marcador de origem (azul)
 * - Marcadores de destinos numerados (verde)
 * - Linha da rota REAL pelas ruas (via OSRM)
 */

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Origem, ParadaOrdenada } from '../types';
import { useEffect, useState } from 'react';

// ==========================================
// ÍCONES CUSTOMIZADOS
// ==========================================

const criarIconeOrigem = () => L.divIcon({
  className: 'custom-marker',
  html: `<div style="
    background: #3b82f6;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 14px;
  ">📍</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const criarIconeDestino = (ordem: number) => L.divIcon({
  className: 'custom-marker',
  html: `<div style="
    background: #10b981;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 12px;
  ">${ordem}</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

// Ícone de retorno (reservado para uso futuro)
// const criarIconeRetorno = () => L.divIcon({ ... });

// ==========================================
// OSRM - ROTA REAL PELAS RUAS
// ==========================================

const OSRM_BASE_URL = 'https://router.project-osrm.org';

/**
 * Decodifica polyline encoded (formato OSRM/Google)
 */
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

/**
 * Busca rota real do OSRM
 */
async function buscarRotaOSRM(pontos: { lat: number; lng: number }[]): Promise<[number, number][]> {
  if (pontos.length < 2) return [];
  
  try {
    // Construir coordenadas (OSRM usa lng,lat)
    const coords = pontos.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `${OSRM_BASE_URL}/route/v1/driving/${coords}?overview=full&geometries=polyline`;
    
    console.log('[OSRM] Buscando geometria da rota...', url);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    console.log('[OSRM] Resposta:', data.code, data.routes?.length, 'rotas');
    
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('Rota não encontrada');
    }
    
    const geometry = data.routes[0].geometry;
    const pontosDeco = decodePolyline(geometry);
    
    console.log(`[OSRM] Rota decodificada: ${pontosDeco.length} pontos`);
    
    return pontosDeco;
  } catch (error) {
    console.warn('[OSRM] Falha ao buscar rota:', error);
    // Fallback: linha reta
    return pontos.map(p => [p.lat, p.lng] as [number, number]);
  }
}

// ==========================================
// COMPONENTE DE AUTO-FIT
// ==========================================

interface FitBoundsProps {
  origem: Origem;
  paradas: ParadaOrdenada[];
}

function FitBounds({ origem, paradas }: FitBoundsProps) {
  const map = useMap();
  
  useEffect(() => {
    if (paradas.length === 0) {
      map.setView([origem.lat, origem.lng], 14);
      return;
    }
    
    const bounds = L.latLngBounds([
      [origem.lat, origem.lng],
      ...paradas.map(p => [p.lat, p.lng] as [number, number])
    ]);
    
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [map, origem, paradas]);
  
  return null;
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

interface MapaRotaProps {
  origem: Origem;
  paradas: ParadaOrdenada[];
  incluiRetorno?: boolean;
}

export function MapaRota({ origem, paradas, incluiRetorno = false }: MapaRotaProps) {
  // Estado para a geometria real da rota
  const [rotaReal, setRotaReal] = useState<[number, number][]>([]);
  const [rotaRetorno, setRotaRetorno] = useState<[number, number][]>([]);
  const [carregando, setCarregando] = useState(true);
  
  // Buscar rota real do OSRM
  useEffect(() => {
    const buscarRota = async () => {
      setCarregando(true);
      
      // Pontos da rota principal
      const pontosRota = [
        { lat: origem.lat, lng: origem.lng },
        ...paradas.map(p => ({ lat: p.lat, lng: p.lng }))
      ];
      
      // Buscar geometria real
      const geometria = await buscarRotaOSRM(pontosRota);
      setRotaReal(geometria);
      
      // Rota de retorno (se habilitado)
      if (incluiRetorno && paradas.length > 0) {
        const ultimaParada = paradas[paradas.length - 1];
        const pontosRetorno = [
          { lat: ultimaParada.lat, lng: ultimaParada.lng },
          { lat: origem.lat, lng: origem.lng }
        ];
        const geometriaRetorno = await buscarRotaOSRM(pontosRetorno);
        setRotaRetorno(geometriaRetorno);
      } else {
        setRotaRetorno([]);
      }
      
      setCarregando(false);
    };
    
    buscarRota();
  }, [origem, paradas, incluiRetorno]);
  
  // Fallback: linha reta enquanto carrega
  const pontosRotaFallback: [number, number][] = [
    [origem.lat, origem.lng],
    ...paradas.map(p => [p.lat, p.lng] as [number, number])
  ];
  
  const pontosExibir = rotaReal.length > 0 ? rotaReal : pontosRotaFallback;
  
  return (
    <div className="mapa-container">
      <MapContainer
        center={[origem.lat, origem.lng]}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Auto-fit bounds */}
        <FitBounds origem={origem} paradas={paradas} />
        
        {/* Marcador de origem */}
        <Marker position={[origem.lat, origem.lng]} icon={criarIconeOrigem()}>
          <Popup>
            <strong>Origem</strong><br />
            {origem.endereco}
          </Popup>
        </Marker>
        
        {/* Marcadores de destinos */}
        {paradas.map((parada) => (
          <Marker
            key={parada.id}
            position={[parada.lat, parada.lng]}
            icon={criarIconeDestino(parada.ordem)}
          >
            <Popup>
              <strong>{parada.ordem}. {parada.nome}</strong><br />
              {parada.endereco}<br />
              <small>{parada.cidade}-{parada.uf}</small>
            </Popup>
          </Marker>
        ))}
        
        {/* Linha da rota principal - REAL pelas ruas */}
        {pontosExibir.length > 1 && (
          <Polyline
            positions={pontosExibir}
            color="#10b981"
            weight={5}
            opacity={0.8}
          />
        )}
        
        {/* Indicador de carregamento */}
        {carregando && pontosRotaFallback.length > 1 && (
          <Polyline
            positions={pontosRotaFallback}
            color="#d1d5db"
            weight={3}
            opacity={0.5}
            dashArray="5, 10"
          />
        )}
        
        {/* Linha de retorno (tracejada) */}
        {rotaRetorno.length > 0 && (
          <Polyline
            positions={rotaRetorno}
            color="#6b7280"
            weight={4}
            opacity={0.6}
            dashArray="10, 10"
          />
        )}
      </MapContainer>
    </div>
  );
}

// ==========================================
// MAPA SIMPLES (para seleção de origem)
// ==========================================

interface MapaSimpleProps {
  lat: number;
  lng: number;
  endereco?: string;
}

export function MapaSimples({ lat, lng, endereco }: MapaSimpleProps) {
  return (
    <div className="mapa-container" style={{ height: '200px' }}>
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <Marker position={[lat, lng]} icon={criarIconeOrigem()}>
          {endereco && (
            <Popup>{endereco}</Popup>
          )}
        </Marker>
      </MapContainer>
    </div>
  );
}
