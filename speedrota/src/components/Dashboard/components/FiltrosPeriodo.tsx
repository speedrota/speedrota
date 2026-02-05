/**
 * @fileoverview FiltrosPeriodo - Seletor de período para filtros
 */

import type { PeriodoLabel } from '../../../types/analytics';

interface FiltrosPeriodoProps {
  periodo: PeriodoLabel;
  onChange: (periodo: PeriodoLabel) => void;
  opcoes?: PeriodoLabel[];
  disabled?: boolean;
}

const LABELS: Record<PeriodoLabel, string> = {
  '7d': '7 dias',
  '30d': '30 dias',
  '90d': '90 dias',
  '365d': '1 ano',
  'custom': 'Personalizado',
};

export function FiltrosPeriodo({
  periodo,
  onChange,
  opcoes = ['7d', '30d', '90d'],
  disabled = false,
}: FiltrosPeriodoProps) {
  return (
    <div className="filter-group">
      {opcoes.map((opt) => (
        <button
          key={opt}
          className={`filter-btn ${periodo === opt ? 'active' : ''}`}
          onClick={() => onChange(opt)}
          disabled={disabled}
        >
          {LABELS[opt]}
        </button>
      ))}
    </div>
  );
}

export default FiltrosPeriodo;
