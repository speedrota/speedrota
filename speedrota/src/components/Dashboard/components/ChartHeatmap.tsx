/**
 * @fileoverview ChartHeatmap - Heatmap de entregas (dia x hora)
 */

import { ResponsiveHeatMap } from '@nivo/heatmap';
import type { HeatmapRow } from '../../../types/analytics';

interface ChartHeatmapProps {
  data: HeatmapRow[];
}

export function ChartHeatmap({ data }: ChartHeatmapProps) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-empty">
        <p>Sem dados para exibir</p>
      </div>
    );
  }

  // Mapeamento de dias
  const diasLabels: Record<string, string> = {
    dom: 'Dom',
    seg: 'Seg',
    ter: 'Ter',
    qua: 'Qua',
    qui: 'Qui',
    sex: 'Sex',
    sab: 'Sab',
  };

  // Formatar dados para exibir labels corretos
  const formattedData = data.map((row) => ({
    ...row,
    id: diasLabels[row.id] || row.id,
  }));

  return (
    <ResponsiveHeatMap
      data={formattedData}
      margin={{ top: 30, right: 30, bottom: 30, left: 50 }}
      valueFormat=">-.0f"
      axisTop={{
        tickSize: 5,
        tickPadding: 5,
        tickRotation: 0,
        legend: 'Hora',
        legendPosition: 'middle',
        legendOffset: -20,
        truncateTickAt: 0,
      }}
      axisRight={null}
      axisBottom={null}
      axisLeft={{
        tickSize: 5,
        tickPadding: 5,
        tickRotation: 0,
        legend: '',
        legendPosition: 'middle',
        legendOffset: -40,
        truncateTickAt: 0,
      }}
      colors={{
        type: 'sequential',
        scheme: 'blues',
      }}
      emptyColor="#f3f4f6"
      borderRadius={2}
      borderWidth={1}
      borderColor="#ffffff"
      enableLabels={true}
      labelTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
      annotations={[]}
      legends={[
        {
          anchor: 'bottom',
          translateX: 0,
          translateY: 30,
          length: 200,
          thickness: 10,
          direction: 'row',
          tickPosition: 'after',
          tickSize: 3,
          tickSpacing: 4,
          tickOverlap: false,
          tickFormat: '>-.0f',
          title: 'Entregas',
          titleAlign: 'start',
          titleOffset: 4,
        },
      ]}
      tooltip={({ cell }) => (
        <div
          style={{
            background: 'white',
            padding: '9px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <strong>{cell.serieId}</strong> - {cell.data.x}h
          <br />
          <span>{cell.formattedValue} entregas</span>
        </div>
      )}
    />
  );
}

export default ChartHeatmap;
