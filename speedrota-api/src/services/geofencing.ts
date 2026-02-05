/**
 * @fileoverview Serviço de Geofencing
 * 
 * FUNCIONALIDADES:
 * 1. Detectar entrada/saída de zonas de atuação
 * 2. Gerar eventos de geofence
 * 3. Alertas configuráveis por zona
 * 
 * DESIGN POR CONTRATO:
 * @pre Coordenadas válidas (-90≤lat≤90, -180≤lng≤180)
 * @pre Polígono com ≥3 vértices ou círculo com raio>0
 * @post Evento gerado se houver mudança de estado
 * @invariant Debounce de 30s entre eventos duplicados
 */

import { prisma } from '../lib/prisma.js';
import { TipoEventoGeofence } from '@prisma/client';

// ==========================================
// TIPOS
// ==========================================

export interface Coordenada {
  lat: number;
  lng: number;
}

export interface Poligono {
  tipo: 'POLIGONO';
  vertices: Coordenada[];
}

export interface Circulo {
  tipo: 'CIRCULO';
  centro: Coordenada;
  raioKm: number;
}

export type Geometria = Poligono | Circulo;

export interface ZonaGeofence {
  id: string;
  nome: string;
  geometria: Geometria;
  configuracao?: ConfiguracaoZona;
}

export interface ConfiguracaoZona {
  alertaEntrada: boolean;
  alertaSaida: boolean;
  alertaTempoExcedido: boolean;
  tempoMaximoMin?: number;
  debounceSegundos: number;
  toleranciaMetros: number;
  webhookUrl?: string;
}

export interface EventoGeofence {
  tipo: TipoEventoGeofence;
  motoristaId: string;
  zonaId: string;
  lat: number;
  lng: number;
  timestamp: Date;
  dadosExtras?: Record<string, unknown>;
}

export interface ResultadoVerificacao {
  dentroZona: boolean;
  zona: ZonaGeofence;
  distanciaBorda?: number; // metros
}

// ==========================================
// CONSTANTES
// ==========================================

const RAIO_TERRA_KM = 6371;
const DEBOUNCE_PADRAO_SEGUNDOS = 30;
const TOLERANCIA_PADRAO_METROS = 50;

// ==========================================
// ALGORITMOS GEOMÉTRICOS
// ==========================================

/**
 * Calcula distância Haversine entre dois pontos
 * 
 * @pre lat1, lat2 ∈ [-90, 90]
 * @pre lng1, lng2 ∈ [-180, 180]
 * @post resultado >= 0
 */
export function haversine(p1: Coordenada, p2: Coordenada): number {
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(p1.lat * Math.PI / 180) * 
            Math.cos(p2.lat * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return RAIO_TERRA_KM * c;
}

/**
 * Ray Casting Algorithm - Verifica se ponto está dentro de polígono
 * 
 * @algorithm Ray casting: traça linha horizontal do ponto ao infinito
 *            e conta quantas vezes cruza as arestas do polígono.
 *            Ímpar = dentro, Par = fora
 * 
 * @pre vertices.length >= 3
 * @post resultado booleano sem ambiguidade
 * @invariant Funciona para polígonos côncavos e convexos
 */
export function pontoEmPoligono(ponto: Coordenada, vertices: Coordenada[]): boolean {
  if (vertices.length < 3) {
    throw new Error('Polígono precisa de pelo menos 3 vértices');
  }

  let dentro = false;
  const n = vertices.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const vi = vertices[i];
    const vj = vertices[j];

    // Verifica se o raio horizontal cruza a aresta
    if (
      ((vi.lng > ponto.lng) !== (vj.lng > ponto.lng)) &&
      (ponto.lat < (vj.lat - vi.lat) * (ponto.lng - vi.lng) / (vj.lng - vi.lng) + vi.lat)
    ) {
      dentro = !dentro;
    }
  }

  return dentro;
}

/**
 * Verifica se ponto está dentro de círculo
 * 
 * @pre raioKm > 0
 * @post true se distância <= raio
 */
export function pontoEmCirculo(ponto: Coordenada, centro: Coordenada, raioKm: number): boolean {
  if (raioKm <= 0) {
    throw new Error('Raio deve ser positivo');
  }

  const distancia = haversine(ponto, centro);
  return distancia <= raioKm;
}

/**
 * Verifica se ponto está dentro de uma geometria
 * 
 * @pre Geometria válida (polígono com ≥3 vértices ou círculo com raio>0)
 * @post Resultado determinístico
 */
export function pontoEmGeometria(ponto: Coordenada, geometria: Geometria): boolean {
  if (geometria.tipo === 'CIRCULO') {
    return pontoEmCirculo(ponto, geometria.centro, geometria.raioKm);
  } else {
    return pontoEmPoligono(ponto, geometria.vertices);
  }
}

/**
 * Calcula distância do ponto até a borda mais próxima
 * (aproximação para alertas de proximidade)
 */
export function distanciaAteBorda(ponto: Coordenada, geometria: Geometria): number {
  if (geometria.tipo === 'CIRCULO') {
    const distCentro = haversine(ponto, geometria.centro);
    return Math.abs(distCentro - geometria.raioKm) * 1000; // metros
  } else {
    // Aproximação: distância até o vértice mais próximo
    let menorDist = Infinity;
    for (const v of geometria.vertices) {
      const dist = haversine(ponto, v);
      if (dist < menorDist) menorDist = dist;
    }
    return menorDist * 1000; // metros
  }
}

// ==========================================
// VERIFICAÇÃO DE ZONAS
// ==========================================

/**
 * Verifica posição contra múltiplas zonas
 * 
 * @pre zonas.length > 0
 * @post Lista de resultados ordenada por proximidade
 */
export function verificarZonas(
  ponto: Coordenada,
  zonas: ZonaGeofence[]
): ResultadoVerificacao[] {
  const resultados: ResultadoVerificacao[] = [];

  for (const zona of zonas) {
    const dentroZona = pontoEmGeometria(ponto, zona.geometria);
    const distBorda = distanciaAteBorda(ponto, zona.geometria);

    resultados.push({
      dentroZona,
      zona,
      distanciaBorda: Math.round(distBorda)
    });
  }

  // Ordenar por proximidade (zonas onde está dentro primeiro)
  return resultados.sort((a, b) => {
    if (a.dentroZona !== b.dentroZona) {
      return a.dentroZona ? -1 : 1;
    }
    return (a.distanciaBorda || 0) - (b.distanciaBorda || 0);
  });
}

// ==========================================
// GERENCIAMENTO DE EVENTOS
// ==========================================

/**
 * Verifica se deve criar evento (respeita debounce)
 */
async function deveGerarEvento(
  motoristaId: string,
  zonaId: string,
  tipo: TipoEventoGeofence,
  debounceSegundos: number
): Promise<boolean> {
  const ultimoEvento = await prisma.eventoGeofence.findFirst({
    where: {
      motoristaId,
      zonaId,
      tipo
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!ultimoEvento) return true;

  const agora = new Date();
  const diff = (agora.getTime() - ultimoEvento.createdAt.getTime()) / 1000;

  return diff >= debounceSegundos;
}

/**
 * Registra evento de geofence
 * 
 * @pre motoristaId e zonaId válidos
 * @post Evento criado no banco
 * @throws Se debounce não foi respeitado
 */
export async function registrarEvento(
  evento: EventoGeofence,
  debounceSegundos = DEBOUNCE_PADRAO_SEGUNDOS
): Promise<string | null> {
  const podeGerar = await deveGerarEvento(
    evento.motoristaId,
    evento.zonaId,
    evento.tipo,
    debounceSegundos
  );

  if (!podeGerar) {
    console.log(`[Geofence] Debounce ativo para ${evento.tipo} zona ${evento.zonaId}`);
    return null;
  }

  const novoEvento = await prisma.eventoGeofence.create({
    data: {
      motoristaId: evento.motoristaId,
      zonaId: evento.zonaId,
      tipo: evento.tipo,
      lat: evento.lat,
      lng: evento.lng,
      dadosExtras: evento.dadosExtras || {}
    }
  });

  console.log(`[Geofence] Evento ${evento.tipo} criado: ${novoEvento.id}`);

  return novoEvento.id;
}

/**
 * Processa atualização de posição e detecta eventos
 * 
 * Pipeline:
 * 1. Obtém zonas do motorista
 * 2. Verifica estado atual (dentro/fora)
 * 3. Compara com último estado
 * 4. Gera eventos se houve mudança
 */
export async function processarPosicao(
  motoristaId: string,
  posicao: Coordenada
): Promise<EventoGeofence[]> {
  // 1. Buscar zonas do motorista
  const motoristaZonas = await prisma.motoristaZona.findMany({
    where: { motoristaId },
    include: { zona: true }
  });

  if (motoristaZonas.length === 0) {
    return [];
  }

  const eventosGerados: EventoGeofence[] = [];

  // 2. Para cada zona, verificar estado
  for (const mz of motoristaZonas) {
    const zona = mz.zona;
    
    // Parse geometria da zona (assumindo poligono armazenado como JSON)
    let geometria: Geometria;
    if (zona.tipo === 'CIRCULAR' && zona.centroLat && zona.centroLng && zona.raioKm) {
      geometria = {
        tipo: 'CIRCULO',
        centro: { lat: zona.centroLat, lng: zona.centroLng },
        raioKm: zona.raioKm
      };
    } else if (zona.poligono) {
      geometria = {
        tipo: 'POLIGONO',
        vertices: zona.poligono as Coordenada[]
      };
    } else {
      continue; // Zona sem geometria válida
    }

    const estaDentro = pontoEmGeometria(posicao, geometria);

    // 3. Buscar último evento para comparar
    const ultimoEvento = await prisma.eventoGeofence.findFirst({
      where: {
        motoristaId,
        zonaId: zona.id,
        tipo: { in: ['ENTRADA', 'SAIDA'] }
      },
      orderBy: { createdAt: 'desc' }
    });

    const estadoAnterior = ultimoEvento?.tipo === 'ENTRADA';

    // 4. Detectar mudança de estado
    if (estaDentro && !estadoAnterior) {
      // ENTRADA na zona
      const evento: EventoGeofence = {
        tipo: 'ENTRADA',
        motoristaId,
        zonaId: zona.id,
        lat: posicao.lat,
        lng: posicao.lng,
        timestamp: new Date()
      };
      
      const eventoId = await registrarEvento(evento);
      if (eventoId) eventosGerados.push(evento);

    } else if (!estaDentro && estadoAnterior) {
      // SAÍDA da zona
      const evento: EventoGeofence = {
        tipo: 'SAIDA',
        motoristaId,
        zonaId: zona.id,
        lat: posicao.lat,
        lng: posicao.lng,
        timestamp: new Date()
      };
      
      const eventoId = await registrarEvento(evento);
      if (eventoId) eventosGerados.push(evento);
    }
  }

  return eventosGerados;
}

// ==========================================
// CONFIGURAÇÃO DE ALERTAS
// ==========================================

/**
 * Obtém configuração de geofence de uma zona
 */
export async function obterConfiguracao(
  zonaId: string
): Promise<ConfiguracaoZona | null> {
  const config = await prisma.configuracaoGeofence.findUnique({
    where: { zonaId }
  });

  if (!config) return null;

  return {
    alertaEntrada: config.alertaEntrada,
    alertaSaida: config.alertaSaida,
    alertaTempoExcedido: config.alertaTempoExcedido,
    tempoMaximoMin: config.tempoMaximoMin || undefined,
    debounceSegundos: config.debounceSegundos,
    toleranciaMetros: config.toleranciaMetros,
    webhookUrl: config.webhookUrl || undefined
  };
}

/**
 * Salva/atualiza configuração de geofence
 */
export async function salvarConfiguracao(
  zonaId: string,
  config: Partial<ConfiguracaoZona>
): Promise<void> {
  await prisma.configuracaoGeofence.upsert({
    where: { zonaId },
    create: {
      zonaId,
      alertaEntrada: config.alertaEntrada ?? true,
      alertaSaida: config.alertaSaida ?? true,
      alertaTempoExcedido: config.alertaTempoExcedido ?? false,
      tempoMaximoMin: config.tempoMaximoMin,
      debounceSegundos: config.debounceSegundos ?? DEBOUNCE_PADRAO_SEGUNDOS,
      toleranciaMetros: config.toleranciaMetros ?? TOLERANCIA_PADRAO_METROS,
      webhookUrl: config.webhookUrl
    },
    update: {
      alertaEntrada: config.alertaEntrada,
      alertaSaida: config.alertaSaida,
      alertaTempoExcedido: config.alertaTempoExcedido,
      tempoMaximoMin: config.tempoMaximoMin,
      debounceSegundos: config.debounceSegundos,
      toleranciaMetros: config.toleranciaMetros,
      webhookUrl: config.webhookUrl,
      updatedAt: new Date()
    }
  });
}

// ==========================================
// HISTÓRICO E CONSULTAS
// ==========================================

/**
 * Lista eventos de um motorista em período
 */
export async function listarEventos(
  motoristaId: string,
  inicio: Date,
  fim: Date
): Promise<EventoGeofence[]> {
  const eventos = await prisma.eventoGeofence.findMany({
    where: {
      motoristaId,
      createdAt: {
        gte: inicio,
        lte: fim
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return eventos.map(e => ({
    tipo: e.tipo,
    motoristaId: e.motoristaId,
    zonaId: e.zonaId,
    lat: e.lat,
    lng: e.lng,
    timestamp: e.createdAt,
    dadosExtras: e.dadosExtras as Record<string, unknown>
  }));
}

/**
 * Verifica se motorista está na zona atribuída
 */
export async function verificarConformidade(
  motoristaId: string
): Promise<{ conforme: boolean; zonasAtribuidas: string[]; zonaAtual?: string }> {
  // Buscar última posição
  const motorista = await prisma.motorista.findUnique({
    where: { id: motoristaId },
    select: {
      ultimaLat: true,
      ultimaLng: true,
      zonasPreferidas: {
        include: { zona: true }
      }
    }
  });

  if (!motorista?.ultimaLat || !motorista?.ultimaLng) {
    return { conforme: false, zonasAtribuidas: [] };
  }

  const posicao: Coordenada = {
    lat: motorista.ultimaLat,
    lng: motorista.ultimaLng
  };

  const zonasAtribuidas: string[] = [];
  let zonaAtual: string | undefined;

  for (const mz of motorista.zonasPreferidas) {
    zonasAtribuidas.push(mz.zona.nome);

    const zona = mz.zona;
    let geometria: Geometria | null = null;

    if (zona.tipo === 'CIRCULAR' && zona.centroLat && zona.centroLng && zona.raioKm) {
      geometria = {
        tipo: 'CIRCULO',
        centro: { lat: zona.centroLat, lng: zona.centroLng },
        raioKm: zona.raioKm
      };
    } else if (zona.poligono) {
      geometria = {
        tipo: 'POLIGONO',
        vertices: zona.poligono as Coordenada[]
      };
    }

    if (geometria && pontoEmGeometria(posicao, geometria)) {
      zonaAtual = zona.nome;
    }
  }

  return {
    conforme: zonaAtual !== undefined,
    zonasAtribuidas,
    zonaAtual
  };
}
