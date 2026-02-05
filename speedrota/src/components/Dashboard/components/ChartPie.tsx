/**
 * @fileoverview ChartPie - Gráfico de pizza para status de entregas
 */

import { ResponsivePie } from '@nivo/pie';
import type { PieChartDatum } from '../../../types/analytics';

interface ChartPieProps {
  data: PieChartDatum[];
  innerRadius?: number;
  showLabels?: boolean;
}

export function ChartPie({ data, innerRadius = 0.5, showLabels = true }: ChartPieProps) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-empty">
        <p>Sem dados para exibir</p>
      </div>
    );
  }

  return (
    <ResponsivePie
      data={data}
      margin={{ top: 20, right: 80, bottom: 20, left: 80 }}
      innerRadius={innerRadius}
      padAngle={0.7}
      cornerRadius={3}
      activeOuterRadiusOffset={8}
      colors={{ datum: 'data.color' }}
      borderWidth={1}
      borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
      arcLinkLabelsSkipAngle={10}
      arcLinkLabelsTextColor="#333333"
      arcLinkLabelsThickness={2}
      arcLinkLabelsColor={{ from: 'color' }}
      arcLabelsSkipAngle={10}
      arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
      enableArcLinkLabels={showLabels}
      enableArcLabels={showLabels}
      legends={[
        {
          anchor: 'bottom',
          direction: 'row',
          justify: false,
          translateX: 0,
          translateY: 20,
          itemsSpacing: 10,
          itemWidth: 80,
          itemHeight: 18,
          itemTextColor: '#666',
          itemDirection: 'left-to-right',
          itemOpacity: 1,
          symbolSize: 12,
          symbolShape: 'circle',
        },
      ]}
    />
  );
}

export default ChartPie;
