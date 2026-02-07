/**
 * @fileoverview Testes para Sanity Checks
 *
 * TDD Light (seção 3.1 do guia):
 * - 3 testes por função: caso normal, borda, erro
 */

import { describe, it, expect } from 'vitest';
import {
  checkRange,
  checkRanges,
  validateAnalyticsKPIs,
  validateFrotaDashboard,
  validateCoordinates,
  validateDeliveryData,
} from '../utils/sanityChecks.js';

describe('checkRange', () => {
  it('deve passar para valor dentro do range', () => {
    const result = checkRange({ field: 'test', value: 50, min: 0, max: 100 });
    expect(result.passed).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('deve passar para valor null', () => {
    const result = checkRange({ field: 'test', value: null, min: 0, max: 100 });
    expect(result.passed).toBe(true);
  });

  it('deve falhar para valor acima do máximo', () => {
    const result = checkRange({ field: 'taxaSucesso', value: 150, min: 0, max: 100 });
    expect(result.passed).toBe(false);
    expect(result.warnings).toContain('taxaSucesso (150) acima do máximo esperado (100)');
  });

  it('deve falhar para valor abaixo do mínimo', () => {
    const result = checkRange({ field: 'km', value: -10, min: 0, max: 100 });
    expect(result.passed).toBe(false);
    expect(result.warnings).toContain('km (-10) abaixo do mínimo esperado (0)');
  });

  it('deve usar label customizado se fornecido', () => {
    const result = checkRange({ field: 'ts', value: 200, min: 0, max: 100, label: 'Taxa de Sucesso' });
    expect(result.warnings[0]).toContain('Taxa de Sucesso');
  });
});

describe('checkRanges', () => {
  it('deve passar se todos os ranges passarem', () => {
    const result = checkRanges([
      { field: 'a', value: 50, min: 0, max: 100 },
      { field: 'b', value: 25, min: 0, max: 50 },
    ]);
    expect(result.passed).toBe(true);
  });

  it('deve acumular warnings de múltiplas falhas', () => {
    const result = checkRanges([
      { field: 'a', value: 150, min: 0, max: 100 },
      { field: 'b', value: -5, min: 0, max: 50 },
    ]);
    expect(result.passed).toBe(false);
    expect(result.warnings).toHaveLength(2);
  });
});

describe('validateAnalyticsKPIs', () => {
  it('deve passar para KPIs válidos', () => {
    const result = validateAnalyticsKPIs({
      taxaSucesso: 95.5,
      totalKm: 250,
      economiaPercent: 28,
      tempoMedio: 45,
      kmMedio: 12.5,
      custoTotal: 1500,
    });
    expect(result.passed).toBe(true);
  });

  it('deve detectar taxa de sucesso acima de 100%', () => {
    const result = validateAnalyticsKPIs({
      taxaSucesso: 105,
      totalKm: 100,
      economiaPercent: null,
      tempoMedio: null,
      kmMedio: null,
      custoTotal: null,
    });
    expect(result.passed).toBe(false);
    expect(result.warnings.some((w) => w.includes('Taxa de Sucesso'))).toBe(true);
  });

  it('deve detectar economia impossível (>50%)', () => {
    const result = validateAnalyticsKPIs({
      taxaSucesso: 80,
      totalKm: 100,
      economiaPercent: 60, // TSP não consegue economizar mais que ~50%
      tempoMedio: null,
      kmMedio: null,
      custoTotal: null,
    });
    expect(result.passed).toBe(false);
    expect(result.warnings.some((w) => w.includes('Economia'))).toBe(true);
  });
});

describe('validateFrotaDashboard', () => {
  it('deve passar para dados consistentes', () => {
    const result = validateFrotaDashboard({
      motoristas: { total: 10, porStatus: { DISPONIVEL: 5, EM_ROTA: 3, PAUSADO: 2 } },
      entregas: { total: 100, concluidas: 80, taxaSucesso: 80 },
      metricas: { kmHoje: 250, tempoHoje: 480 },
    });
    expect(result.passed).toBe(true);
  });

  it('deve detectar concluídas > total (inconsistência)', () => {
    const result = validateFrotaDashboard({
      motoristas: { total: 5, porStatus: { DISPONIVEL: 5 } },
      entregas: { total: 50, concluidas: 60, taxaSucesso: 120 }, // 60 > 50
      metricas: { kmHoje: 100, tempoHoje: 60 },
    });
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes('Inconsistência'))).toBe(true);
  });

  it('deve detectar soma status != total', () => {
    const result = validateFrotaDashboard({
      motoristas: { total: 10, porStatus: { DISPONIVEL: 5, EM_ROTA: 3 } }, // soma = 8, total = 10
      entregas: { total: 50, concluidas: 40, taxaSucesso: 80 },
      metricas: { kmHoje: 100, tempoHoje: 60 },
    });
    expect(result.passed).toBe(false);
    expect(result.warnings.some((w) => w.includes('soma dos status'))).toBe(true);
  });
});

describe('validateCoordinates', () => {
  it('deve passar para coordenadas no Brasil', () => {
    const result = validateCoordinates(-23.5505, -46.6333); // São Paulo
    expect(result.passed).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('deve avisar para coordenadas fora do Brasil', () => {
    const result = validateCoordinates(40.7128, -74.006); // New York
    expect(result.passed).toBe(true); // Válido globalmente
    expect(result.warnings.some((w) => w.includes('fora do Brasil'))).toBe(true);
  });

  it('deve falhar para latitude inválida', () => {
    const result = validateCoordinates(-100, -46); // -100 é inválido
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes('Latitude inválida'))).toBe(true);
  });

  it('deve falhar para longitude inválida', () => {
    const result = validateCoordinates(-23, -200); // -200 é inválido
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes('Longitude inválida'))).toBe(true);
  });
});

describe('validateDeliveryData', () => {
  it('deve passar para dados consistentes', () => {
    const result = validateDeliveryData({
      statusBreakdown: { ENTREGUE: 80, PENDENTE: 15, AUSENTE: 5 },
      totais: { total: 100, taxaSucesso: 80 },
    });
    expect(result.passed).toBe(true);
  });

  it('deve detectar soma status != total', () => {
    const result = validateDeliveryData({
      statusBreakdown: { ENTREGUE: 50, PENDENTE: 30 }, // soma = 80
      totais: { total: 100, taxaSucesso: 50 }, // total = 100
    });
    expect(result.passed).toBe(false);
    expect(result.warnings.some((w) => w.includes('Inconsistência'))).toBe(true);
  });
});
