/**
 * @fileoverview ChartBar - Gráfico de barras para fornecedores
 */

import { ResponsiveBar } from '@nivo/bar';
import type { BarChartDatum } from '../../../types/analytics';

interface ChartBarProps {
  data: BarChartDatum[];
  keys?: string[];
  indexBy?: string;
  layout?: 'horizontal' | 'vertical';
}

export function ChartBar({
  data,
  keys = ['totalParadas'],
  indexBy = 'fornecedor',
  layout = 'vertical',
}: ChartBarProps) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-empty">
        <p>Sem dados para exibir</p>
      </div>
    );
  }

  return (
    <ResponsiveBar
      data={data}
      keys={keys}
      indexBy={indexBy}
      layout={layout}
      margin={{ top: 20, right: 20, bottom: 50, left: 80 }}
      padding={0.3}
      valueScale={{ type: 'linear' }}
      indexScale={{ type: 'band', round: true }}
      colors={(d) => d.data.cor as string}
      borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
      axisTop={null}
      axisRight={null}
      axisBottom={{
        tickSize: 5,
        tickPadding: 5,
        tickRotation: -30,
        legend: '',
        legendPosition: 'middle',
        legendOffset: 40,
        truncateTickAt: 0,
      }}
      axisLeft={{
        tickSize: 5,
        tickPadding: 5,
        tickRotation: 0,
        legend: '',
        legendPosition: 'middle',
        legendOffset: -50,
        truncateTickAt: 0,
      }}
      labelSkipWidth={12}
      labelSkipHeight={12}
      labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
      enableLabel={true}
      animate={true}
      role="application"
      ariaLabel="Gráfico de barras por fornecedor"
      tooltip={({ id, value, indexValue, color }) => (
        <div
          style={{
            background: 'white',
            padding: '9px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <strong style={{ color }}>{indexValue}</strong>
          <br />
          <span>{id}: </span>
          <strong>{value}</strong>
        </div>
      )}
    />
  );
}

export default ChartBar;
