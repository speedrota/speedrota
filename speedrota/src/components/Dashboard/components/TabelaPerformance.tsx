/**
 * @fileoverview TabelaPerformance - Tabela de performance detalhada
 */

import type { PerformanceRow } from '../../../types/analytics';

interface TabelaPerformanceProps {
  data: PerformanceRow[];
}

export function TabelaPerformance({ data }: TabelaPerformanceProps) {
  if (!data || data.length === 0) {
    return (
      <div className="table-empty">
        <p>Sem dados de performance disponíveis</p>
      </div>
    );
  }

  const getTaxaClass = (taxa: number): string => {
    if (taxa >= 90) return 'alta';
    if (taxa >= 70) return 'media';
    return 'baixa';
  };

  return (
    <table className="performance-table">
      <thead>
        <tr>
          <th>Data</th>
          <th>Paradas</th>
          <th>Entregues</th>
          <th>Taxa</th>
          <th>Km</th>
          <th>Tempo</th>
          <th>Custo</th>
          <th>Km/Parada</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.id}>
            <td>{row.data}</td>
            <td>{row.paradas}</td>
            <td>{row.entregues}</td>
            <td>
              <span className={`taxa-badge ${getTaxaClass(row.taxaSucesso)}`}>
                {row.taxaSucesso}%
              </span>
            </td>
            <td>{row.km.toFixed(1)}</td>
            <td>{row.tempo} min</td>
            <td>R$ {row.custo.toFixed(2)}</td>
            <td>{row.kmPorParada.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default TabelaPerformance;
