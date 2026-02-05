/**
 * @fileoverview ChartLine - Gráfico de linha para tendências
 */

import { ResponsiveLine } from '@nivo/line';
import type { LineChartSeries } from '../../../types/analytics';

interface ChartLineProps {
  data: LineChartSeries[];
  showPoints?: boolean;
  curve?: 'linear' | 'monotoneX' | 'catmullRom';
  enableArea?: boolean;
}

export function ChartLine({
  data,
  showPoints = true,
  curve = 'monotoneX',
  enableArea = false,
}: ChartLineProps) {
  if (!data || data.length === 0 || data.every(s => s.data.length === 0)) {
    return (
      <div className="chart-empty">
        <p>Sem dados para exibir</p>
      </div>
    );
  }

  return (
    <ResponsiveLine
      data={data}
      margin={{ top: 20, right: 110, bottom: 50, left: 60 }}
      xScale={{ type: 'point' }}
      yScale={{
        type: 'linear',
        min: 'auto',
        max: 'auto',
        stacked: false,
        reverse: false,
      }}
      curve={curve}
      axisTop={null}
      axisRight={null}
      axisBottom={{
        tickSize: 5,
        tickPadding: 5,
        tickRotation: -45,
        legend: '',
        legendOffset: 36,
        legendPosition: 'middle',
        truncateTickAt: 0,
      }}
      axisLeft={{
        tickSize: 5,
        tickPadding: 5,
        tickRotation: 0,
        legend: '',
        legendOffset: -40,
        legendPosition: 'middle',
        truncateTickAt: 0,
      }}
      colors={{ datum: 'color' }}
      enablePoints={showPoints}
      pointSize={8}
      pointColor={{ theme: 'background' }}
      pointBorderWidth={2}
      pointBorderColor={{ from: 'serieColor' }}
      pointLabel="y"
      pointLabelYOffset={-12}
      enableArea={enableArea}
      areaOpacity={0.15}
      useMesh={true}
      enableGridX={false}
      legends={[
        {
          anchor: 'bottom-right',
          direction: 'column',
          justify: false,
          translateX: 100,
          translateY: 0,
          itemsSpacing: 0,
          itemDirection: 'left-to-right',
          itemWidth: 80,
          itemHeight: 20,
          itemOpacity: 0.75,
          symbolSize: 12,
          symbolShape: 'circle',
          symbolBorderColor: 'rgba(0, 0, 0, .5)',
        },
      ]}
      tooltip={({ point }) => (
        <div
          style={{
            background: 'white',
            padding: '9px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <strong style={{ color: point.serieColor }}>{point.serieId}</strong>
          <br />
          <span>{point.data.xFormatted}: </span>
          <strong>{point.data.yFormatted}</strong>
        </div>
      )}
    />
  );
}

export default ChartLine;
