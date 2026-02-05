/**
 * @file geofencing.test.ts
 * @description Testes unitários para Geofencing
 * 
 * TDD Light: 3 categorias de testes
 * 1. Caso normal (happy path)
 * 2. Casos de borda (limites)
 * 3. Casos de erro (validações)
 */

import { describe, it, expect } from 'vitest';
import {
  haversine,
  pontoEmPoligono,
  pontoEmCirculo,
  pontoEmGeometria,
  verificarZonas
} from '../services/geofencing.js';

// ==========================================
// 1. TESTES DE HAVERSINE
// ==========================================

describe('haversine', () => {
  it('deve calcular distância entre dois pontos conhecidos', () => {
    // São Paulo → Rio de Janeiro ≈ 357 km
    const sp = { lat: -23.5505, lng: -46.6333 };
    const rj = { lat: -22.9068, lng: -43.1729 };

    const distancia = haversine(sp, rj);

    expect(distancia).toBeGreaterThan(350);
    expect(distancia).toBeLessThan(365);
  });

  it('deve retornar 0 para mesmo ponto', () => {
    const ponto = { lat: -23.5505, lng: -46.6333 };

    const distancia = haversine(ponto, ponto);

    expect(distancia).toBe(0);
  });

  it('deve funcionar com coordenadas positivas e negativas', () => {
    // Nova York → Londres ≈ 5570 km
    const ny = { lat: 40.7128, lng: -74.0060 };
    const london = { lat: 51.5074, lng: -0.1278 };

    const distancia = haversine(ny, london);

    expect(distancia).toBeGreaterThan(5500);
    expect(distancia).toBeLessThan(5700);
  });
});

// ==========================================
// 2. TESTES DE PONTO EM POLÍGONO (Ray Casting)
// ==========================================

describe('pontoEmPoligono', () => {
  // Quadrado simples: (0,0), (0,10), (10,10), (10,0)
  const quadrado = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 10 },
    { lat: 10, lng: 10 },
    { lat: 10, lng: 0 }
  ];

  // --- CASO NORMAL ---
  describe('Caso Normal', () => {
    it('deve retornar true para ponto dentro do polígono', () => {
      const ponto = { lat: 5, lng: 5 };

      const resultado = pontoEmPoligono(ponto, quadrado);

      expect(resultado).toBe(true);
    });

    it('deve retornar false para ponto fora do polígono', () => {
      const ponto = { lat: 15, lng: 15 };

      const resultado = pontoEmPoligono(ponto, quadrado);

      expect(resultado).toBe(false);
    });
  });

  // --- CASOS DE BORDA ---
  describe('Casos de Borda', () => {
    it('deve funcionar com polígono triangular (3 vértices)', () => {
      const triangulo = [
        { lat: 0, lng: 0 },
        { lat: 10, lng: 5 },
        { lat: 0, lng: 10 }
      ];
      const dentro = { lat: 3, lng: 5 };
      const fora = { lat: -5, lng: 5 }; // Claramente fora (lat negativo)

      expect(pontoEmPoligono(dentro, triangulo)).toBe(true);
      expect(pontoEmPoligono(fora, triangulo)).toBe(false);
    });

    it('deve funcionar com polígono côncavo (formato L)', () => {
      // Polígono em L
      const formatoL = [
        { lat: 0, lng: 0 },
        { lat: 10, lng: 0 },
        { lat: 10, lng: 5 },
        { lat: 5, lng: 5 },
        { lat: 5, lng: 10 },
        { lat: 0, lng: 10 }
      ];
      const dentroDaBase = { lat: 2, lng: 7 };
      const noRecorte = { lat: 7, lng: 7 }; // Área do recorte (fora)

      expect(pontoEmPoligono(dentroDaBase, formatoL)).toBe(true);
      expect(pontoEmPoligono(noRecorte, formatoL)).toBe(false);
    });
  });

  // --- CASOS DE ERRO ---
  describe('Casos de Erro', () => {
    it('deve lançar erro para polígono com menos de 3 vértices', () => {
      const invalido = [
        { lat: 0, lng: 0 },
        { lat: 10, lng: 10 }
      ];
      const ponto = { lat: 5, lng: 5 };

      expect(() => pontoEmPoligono(ponto, invalido)).toThrow('pelo menos 3 vértices');
    });
  });
});

// ==========================================
// 3. TESTES DE PONTO EM CÍRCULO
// ==========================================

describe('pontoEmCirculo', () => {
  const centro = { lat: -23.5505, lng: -46.6333 }; // SP centro
  const raioKm = 10;

  // --- CASO NORMAL ---
  it('deve retornar true para ponto dentro do círculo', () => {
    // Ponto a ~5km do centro
    const ponto = { lat: -23.5705, lng: -46.6533 };

    const resultado = pontoEmCirculo(ponto, centro, raioKm);

    expect(resultado).toBe(true);
  });

  it('deve retornar false para ponto fora do círculo', () => {
    // Ponto a ~20km do centro
    const ponto = { lat: -23.7505, lng: -46.8333 };

    const resultado = pontoEmCirculo(ponto, centro, raioKm);

    expect(resultado).toBe(false);
  });

  // --- CASOS DE BORDA ---
  it('deve retornar true para ponto exatamente no centro', () => {
    const resultado = pontoEmCirculo(centro, centro, raioKm);

    expect(resultado).toBe(true);
  });

  // --- CASOS DE ERRO ---
  it('deve lançar erro para raio negativo', () => {
    const ponto = { lat: -23.5505, lng: -46.6333 };

    expect(() => pontoEmCirculo(ponto, centro, -5)).toThrow('Raio deve ser positivo');
  });

  it('deve lançar erro para raio zero', () => {
    const ponto = centro;

    expect(() => pontoEmCirculo(ponto, centro, 0)).toThrow('Raio deve ser positivo');
  });
});

// ==========================================
// 4. TESTES DE GEOMETRIA UNIFICADA
// ==========================================

describe('pontoEmGeometria', () => {
  it('deve funcionar com tipo CIRCULO', () => {
    const geometria = {
      tipo: 'CIRCULO' as const,
      centro: { lat: -23.55, lng: -46.63 },
      raioKm: 5
    };
    const pontoDentro = { lat: -23.55, lng: -46.63 };

    expect(pontoEmGeometria(pontoDentro, geometria)).toBe(true);
  });

  it('deve funcionar com tipo POLIGONO', () => {
    const geometria = {
      tipo: 'POLIGONO' as const,
      vertices: [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 10 },
        { lat: 10, lng: 10 },
        { lat: 10, lng: 0 }
      ]
    };
    const pontoDentro = { lat: 5, lng: 5 };
    const pontoFora = { lat: 15, lng: 15 };

    expect(pontoEmGeometria(pontoDentro, geometria)).toBe(true);
    expect(pontoEmGeometria(pontoFora, geometria)).toBe(false);
  });
});

// ==========================================
// 5. TESTES DE VERIFICAÇÃO DE MÚLTIPLAS ZONAS
// ==========================================

describe('verificarZonas', () => {
  const zonas = [
    {
      id: 'zona1',
      nome: 'Zona Centro',
      geometria: {
        tipo: 'CIRCULO' as const,
        centro: { lat: -23.55, lng: -46.63 },
        raioKm: 5
      }
    },
    {
      id: 'zona2',
      nome: 'Zona Sul',
      geometria: {
        tipo: 'CIRCULO' as const,
        centro: { lat: -23.65, lng: -46.66 },
        raioKm: 8
      }
    }
  ];

  it('deve identificar em quais zonas o ponto está', () => {
    const pontoNoCentro = { lat: -23.55, lng: -46.63 };

    const resultados = verificarZonas(pontoNoCentro, zonas);

    expect(resultados[0].dentroZona).toBe(true);
    expect(resultados[0].zona.nome).toBe('Zona Centro');
  });

  it('deve ordenar resultados com zonas ativas primeiro', () => {
    const pontoNoSul = { lat: -23.65, lng: -46.66 };

    const resultados = verificarZonas(pontoNoSul, zonas);

    // Zona Sul deve vir primeiro (está dentro)
    expect(resultados[0].dentroZona).toBe(true);
  });

  it('deve retornar array vazio para lista vazia de zonas', () => {
    const ponto = { lat: 0, lng: 0 };

    const resultados = verificarZonas(ponto, []);

    expect(resultados).toHaveLength(0);
  });
});
