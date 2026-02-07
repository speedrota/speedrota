/**
 * @fileoverview Sanity Checks - Validações de Qualidade de Dados
 *
 * DESIGN POR CONTRATO:
 * @description Funções para validar qualidade de dados antes de retornar ao cliente
 * @pre Dados vêm do banco de dados
 * @post Dados validados com alertas de inconsistência
 * @invariant Nunca bloqueia retorno - apenas loga avisos
 *
 * BASEADO NO GUIA:
 * - 4.1 Sanity Checks (checagens de sanidade)
 * - 4.3 Data Quality Gates
 */

// ==========================================
// TIPOS
// ==========================================

export interface SanityResult {
  passed: boolean;
  warnings: string[];
  errors: string[];
}

export interface RangeCheck {
  field: string;
  value: number | null | undefined;
  min?: number;
  max?: number;
  label?: string;
}

// ==========================================
// RANGE CHECKS
// ==========================================

/**
 * Valida se valores numéricos estão dentro de ranges esperados
 *
 * @pre valor numérico ou null
 * @post SanityResult com avisos se fora do range
 *
 * @example
 * checkRange({ field: 'taxaSucesso', value: 150, min: 0, max: 100 })
 * // => { passed: false, warnings: ['taxaSucesso (150) fora do range [0, 100]'] }
 */
export function checkRange(check: RangeCheck): SanityResult {
  const result: SanityResult = { passed: true, warnings: [], errors: [] };
  const { field, value, min, max, label } = check;
  const displayName = label || field;

  if (value === null || value === undefined) {
    return result; // Null é válido
  }

  if (typeof value !== 'number' || isNaN(value)) {
    result.passed = false;
    result.errors.push(`${displayName}: valor não numérico`);
    return result;
  }

  if (min !== undefined && value < min) {
    result.passed = false;
    result.warnings.push(`${displayName} (${value}) abaixo do mínimo esperado (${min})`);
  }

  if (max !== undefined && value > max) {
    result.passed = false;
    result.warnings.push(`${displayName} (${value}) acima do máximo esperado (${max})`);
  }

  return result;
}

/**
 * Valida múltiplos ranges de uma vez
 */
export function checkRanges(checks: RangeCheck[]): SanityResult {
  const combined: SanityResult = { passed: true, warnings: [], errors: [] };

  for (const check of checks) {
    const result = checkRange(check);
    if (!result.passed) {
      combined.passed = false;
    }
    combined.warnings.push(...result.warnings);
    combined.errors.push(...result.errors);
  }

  return combined;
}

// ==========================================
// DATA QUALITY GATES
// ==========================================

/**
 * Quality Gate para KPIs de Analytics
 *
 * Ranges esperados:
 * - taxaSucesso: 0-100%
 * - totalKm: 0-10000 (máximo razoável por período)
 * - economiaPercent: 0-50% (baseado em estudos TSP)
 * - tempoMedio: 0-480 min (máximo 8h por rota)
 */
export function validateAnalyticsKPIs(kpis: Record<string, number | null>): SanityResult {
  return checkRanges([
    { field: 'taxaSucesso', value: kpis.taxaSucesso, min: 0, max: 100, label: 'Taxa de Sucesso (%)' },
    { field: 'totalKm', value: kpis.totalKm, min: 0, max: 10000, label: 'Total KM' },
    { field: 'economiaPercent', value: kpis.economiaPercent, min: 0, max: 50, label: 'Economia (%)' },
    { field: 'tempoMedio', value: kpis.tempoMedio, min: 0, max: 480, label: 'Tempo Médio (min)' },
    { field: 'kmMedio', value: kpis.kmMedio, min: 0, max: 500, label: 'KM Médio' },
    { field: 'custoTotal', value: kpis.custoTotal, min: 0, max: 100000, label: 'Custo Total (R$)' },
  ]);
}

/**
 * Quality Gate para Dashboard de Frota
 */
export function validateFrotaDashboard(data: {
  motoristas: { total: number; porStatus: Record<string, number> };
  entregas: { total: number; concluidas: number; taxaSucesso: number };
  metricas: { kmHoje: number; tempoHoje: number };
}): SanityResult {
  const result = checkRanges([
    { field: 'motoristas.total', value: data.motoristas.total, min: 0, max: 1000, label: 'Total Motoristas' },
    { field: 'entregas.total', value: data.entregas.total, min: 0, max: 10000, label: 'Total Entregas' },
    { field: 'entregas.taxaSucesso', value: data.entregas.taxaSucesso, min: 0, max: 100, label: 'Taxa Sucesso (%)' },
    { field: 'metricas.kmHoje', value: data.metricas.kmHoje, min: 0, max: 5000, label: 'KM Hoje' },
    { field: 'metricas.tempoHoje', value: data.metricas.tempoHoje, min: 0, max: 1440, label: 'Tempo Hoje (min)' },
  ]);

  // Check consistência: concluídas <= total
  if (data.entregas.concluidas > data.entregas.total) {
    result.passed = false;
    result.errors.push(`Inconsistência: concluídas (${data.entregas.concluidas}) > total (${data.entregas.total})`);
  }

  // Check: soma dos status == total
  const somaStatus = Object.values(data.motoristas.porStatus).reduce((a, b) => a + b, 0);
  if (somaStatus !== data.motoristas.total) {
    result.passed = false;
    result.warnings.push(
      `Aviso: soma dos status (${somaStatus}) != total motoristas (${data.motoristas.total})`
    );
  }

  return result;
}

/**
 * Quality Gate para Coordenadas
 */
export function validateCoordinates(lat: number, lng: number): SanityResult {
  const result: SanityResult = { passed: true, warnings: [], errors: [] };

  // Range válido global
  if (lat < -90 || lat > 90) {
    result.passed = false;
    result.errors.push(`Latitude inválida: ${lat} (range: -90 a 90)`);
  }

  if (lng < -180 || lng > 180) {
    result.passed = false;
    result.errors.push(`Longitude inválida: ${lng} (range: -180 a 180)`);
  }

  // Sanity: dentro do Brasil
  const NO_BRASIL = lat >= -34 && lat <= 5 && lng >= -74 && lng <= -32;
  if (!NO_BRASIL) {
    result.warnings.push(`Coordenadas (${lat}, ${lng}) parecem estar fora do Brasil`);
  }

  return result;
}

/**
 * Quality Gate para Entregas
 */
export function validateDeliveryData(data: {
  statusBreakdown: Record<string, number>;
  totais: { total: number; taxaSucesso: number };
}): SanityResult {
  const result: SanityResult = { passed: true, warnings: [], errors: [] };

  // Soma dos status deve ser igual ao total
  const somaStatus = Object.values(data.statusBreakdown).reduce((a, b) => a + b, 0);
  if (somaStatus !== data.totais.total) {
    result.passed = false;
    result.warnings.push(
      `Inconsistência: soma status (${somaStatus}) != total declarado (${data.totais.total})`
    );
  }

  // Taxa sucesso no range válido
  const rangeCheck = checkRange({
    field: 'taxaSucesso',
    value: data.totais.taxaSucesso,
    min: 0,
    max: 100,
    label: 'Taxa Sucesso (%)',
  });

  if (!rangeCheck.passed) {
    result.passed = false;
    result.warnings.push(...rangeCheck.warnings);
    result.errors.push(...rangeCheck.errors);
  }

  return result;
}

// ==========================================
// LOGGING E MONITORAMENTO
// ==========================================

/**
 * Loga resultado de sanity check (production-safe)
 *
 * OBSERVABILIDADE (seção 3.6 do guia):
 * - Loga contagem de linhas por etapa
 * - % falhas
 * - Top warnings para análise
 */
export function logSanityResult(context: string, result: SanityResult): void {
  if (!result.passed) {
    console.warn(`[SanityCheck] ${context}:`, {
      warnings: result.warnings.length,
      errors: result.errors.length,
      details: [...result.errors, ...result.warnings.slice(0, 3)],
    });
  }
}

/**
 * Wrapper que valida e loga antes de retornar dados
 *
 * @example
 * return withSanityCheck('analytics/overview', () => validateAnalyticsKPIs(kpis), data);
 */
export function withSanityCheck<T extends object>(
  context: string,
  validator: () => SanityResult,
  data: T
): T & { _sanityWarnings?: string[] } {
  const result = validator();
  logSanityResult(context, result);

  if (result.warnings.length > 0 || result.errors.length > 0) {
    return {
      ...data,
      _sanityWarnings: [...result.errors, ...result.warnings],
    };
  }

  return { ...data };
}
