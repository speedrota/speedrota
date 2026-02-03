/**
 * @fileoverview Testes unitários para funções de cálculo
 * 
 * TDD Light: testando casos críticos
 * - Caso normal
 * - Casos de borda
 * - Casos de erro
 */

import { describe, it, expect } from 'vitest';
import {
  haversine,
  nearestNeighbor,
  calcularTempoViagem,
  obterFatorTrafego,
  calcularMetricas,
  formatarDistancia,
  formatarTempo,
  formatarMoeda,
} from '../utils/calculos';
import type { Origem, Destino } from '../types';
// import { CONSTANTES } from '../types'; // Valores usados diretamente

// ==========================================
// HAVERSINE: Distância entre coordenadas
// ==========================================

describe('haversine', () => {
  it('deve calcular distância zero para mesmas coordenadas', () => {
    const dist = haversine(-23.5505, -46.6333, -23.5505, -46.6333);
    expect(dist).toBe(0);
  });

  it('deve calcular distância aproximada São Paulo → Rio (~357km)', () => {
    const dist = haversine(-23.5505, -46.6333, -22.9068, -43.1729);
    expect(dist).toBeGreaterThan(350);
    expect(dist).toBeLessThan(370);
  });

  it('deve calcular distância aproximada Campinas → Americana (~30km)', () => {
    const dist = haversine(-22.9099, -47.0626, -22.7394, -47.3317);
    expect(dist).toBeGreaterThan(25);
    expect(dist).toBeLessThan(40);
  });

  it('deve retornar valor positivo sempre', () => {
    const dist = haversine(-22.9099, -47.0626, -23.5505, -46.6333);
    expect(dist).toBeGreaterThan(0);
  });
});

// ==========================================
// NEAREST NEIGHBOR: Algoritmo TSP
// ==========================================

describe('nearestNeighbor', () => {
  const origem: Origem = {
    lat: -23.5505,
    lng: -46.6333,
    endereco: 'São Paulo',
    fonte: 'manual',
    timestamp: new Date(),
  };

  it('deve retornar array vazio para lista vazia de destinos', () => {
    const resultado = nearestNeighbor(origem, []);
    expect(resultado).toEqual([]);
  });

  it('deve retornar único destino com ordem 1', () => {
    const destino: Destino = {
      id: '1',
      lat: -22.9068,
      lng: -43.1729,
      nome: 'Rio',
      endereco: 'Centro',
      cidade: 'Rio de Janeiro',
      uf: 'RJ',
      fonte: 'manual', fornecedor: 'outro',
      confianca: 1,
    };

    const resultado = nearestNeighbor(origem, [destino]);

    expect(resultado).toHaveLength(1);
    expect(resultado[0].ordem).toBe(1);
    expect(resultado[0].distanciaAnterior).toBeGreaterThan(0);
    expect(resultado[0].distanciaAcumulada).toBe(resultado[0].distanciaAnterior);
  });

  it('deve ordenar destinos pelo mais próximo', () => {
    const destinos: Destino[] = [
      // Destino longe (Rio)
      {
        id: '1',
        lat: -22.9068,
        lng: -43.1729,
        nome: 'Rio',
        endereco: 'Centro',
        cidade: 'Rio de Janeiro',
        uf: 'RJ',
        fonte: 'manual', fornecedor: 'outro',
        confianca: 1,
      },
      // Destino perto (Guarulhos)
      {
        id: '2',
        lat: -23.4538,
        lng: -46.5333,
        nome: 'Guarulhos',
        endereco: 'Centro',
        cidade: 'Guarulhos',
        uf: 'SP',
        fonte: 'manual', fornecedor: 'outro',
        confianca: 1,
      },
    ];

    const resultado = nearestNeighbor(origem, destinos);

    expect(resultado).toHaveLength(2);
    // Guarulhos (mais perto) deve ser primeiro
    expect(resultado[0].nome).toBe('Guarulhos');
    expect(resultado[1].nome).toBe('Rio');
  });

  it('deve calcular distâncias acumuladas corretamente', () => {
    const destinos: Destino[] = [
      {
        id: '1',
        lat: -22.9099,
        lng: -47.0626,
        nome: 'Campinas',
        endereco: 'Centro',
        cidade: 'Campinas',
        uf: 'SP',
        fonte: 'manual', fornecedor: 'outro',
        confianca: 1,
      },
      {
        id: '2',
        lat: -22.7394,
        lng: -47.3317,
        nome: 'Americana',
        endereco: 'Centro',
        cidade: 'Americana',
        uf: 'SP',
        fonte: 'manual', fornecedor: 'outro',
        confianca: 1,
      },
    ];

    const resultado = nearestNeighbor(origem, destinos);

    // Verificar que distância acumulada é soma das anteriores
    expect(resultado[1].distanciaAcumulada).toBeCloseTo(
      resultado[0].distanciaAcumulada + resultado[1].distanciaAnterior,
      1
    );
  });
});

// ==========================================
// CÁLCULO DE TEMPO
// ==========================================

describe('calcularTempoViagem', () => {
  it('deve calcular tempo baseado na velocidade urbana padrão', () => {
    // 30km a 30km/h = 1 hora = 60 minutos
    const tempo = calcularTempoViagem(30);
    expect(tempo).toBe(60);
  });

  it('deve retornar zero para distância zero', () => {
    const tempo = calcularTempoViagem(0);
    expect(tempo).toBe(0);
  });
});

// ==========================================
// FATOR DE TRÁFEGO
// ==========================================

describe('obterFatorTrafego', () => {
  it('deve retornar 1.5 para horário de pico manhã (8h)', () => {
    const fator = obterFatorTrafego(8);
    expect(fator).toBe(1.5);
  });

  it('deve retornar 1.6 para horário de pico tarde (18h)', () => {
    const fator = obterFatorTrafego(18);
    expect(fator).toBe(1.6);
  });

  it('deve retornar 1.2 para horário de almoço (12h)', () => {
    const fator = obterFatorTrafego(12);
    expect(fator).toBe(1.2);
  });

  it('deve retornar 0.8 para madrugada (3h)', () => {
    const fator = obterFatorTrafego(3);
    expect(fator).toBe(0.8);
  });

  it('deve retornar 1.0 para horário normal (10h)', () => {
    const fator = obterFatorTrafego(10);
    expect(fator).toBe(1.0);
  });
});

// ==========================================
// MÉTRICAS
// ==========================================

describe('calcularMetricas', () => {
  it('deve retornar métricas zeradas para lista vazia', () => {
    const metricas = calcularMetricas([]);
    
    expect(metricas.distanciaTotalKm).toBe(0);
    expect(metricas.tempoViagemMin).toBe(0);
    expect(metricas.tempoEntregasMin).toBe(0);
    expect(metricas.combustivelL).toBe(0);
    expect(metricas.custoR$).toBe(0);
  });

  it('deve calcular combustível corretamente', () => {
    const paradas = [{
      id: '1',
      lat: 0,
      lng: 0,
      nome: 'Test',
      endereco: 'Test',
      cidade: 'Test',
      uf: 'SP',
      fonte: 'manual' as const,
      fornecedor: 'outro' as const,
      confianca: 1,
      ordem: 1,
      distanciaAnterior: 100, // 100km
      distanciaAcumulada: 100,
      tempoAnterior: 200,
      tempoAcumulado: 200,
    }];

    const metricas = calcularMetricas(paradas);
    
    // 100km / 10km/l = 10 litros
    expect(metricas.combustivelL).toBe(10);
    // 10 litros * R$ 5.89 = R$ 58.90
    expect(metricas.custoR$).toBeCloseTo(58.9, 1);
  });

  it('deve incluir distância de retorno quando especificado', () => {
    const paradas = [{
      id: '1',
      lat: 0,
      lng: 0,
      nome: 'Test',
      endereco: 'Test',
      cidade: 'Test',
      uf: 'SP',
      fonte: 'manual' as const,
      fornecedor: 'outro' as const,
      confianca: 1,
      ordem: 1,
      distanciaAnterior: 50,
      distanciaAcumulada: 50,
      tempoAnterior: 100,
      tempoAcumulado: 100,
    }];

    const metricasSemRetorno = calcularMetricas(paradas, 0);
    const metricasComRetorno = calcularMetricas(paradas, 50);
    
    expect(metricasComRetorno.distanciaTotalKm).toBe(metricasSemRetorno.distanciaTotalKm + 50);
  });
});

// ==========================================
// FORMATAÇÃO
// ==========================================

describe('formatarDistancia', () => {
  it('deve formatar distâncias menores que 1km em metros', () => {
    expect(formatarDistancia(0.5)).toBe('500 m');
    expect(formatarDistancia(0.1)).toBe('100 m');
  });

  it('deve formatar distâncias maiores que 1km em km', () => {
    expect(formatarDistancia(5)).toBe('5.0 km');
    expect(formatarDistancia(32.5)).toBe('32.5 km');
  });
});

describe('formatarTempo', () => {
  it('deve formatar minutos quando menor que 60', () => {
    expect(formatarTempo(30)).toBe('30 min');
    expect(formatarTempo(45)).toBe('45 min');
  });

  it('deve formatar horas e minutos quando maior que 60', () => {
    expect(formatarTempo(90)).toBe('1h 30min');
    expect(formatarTempo(120)).toBe('2h');
    expect(formatarTempo(150)).toBe('2h 30min');
  });
});

describe('formatarMoeda', () => {
  it('deve formatar valor em reais', () => {
    const resultado = formatarMoeda(58.9);
    expect(resultado).toContain('58,90');
    expect(resultado).toContain('R$');
  });
});
