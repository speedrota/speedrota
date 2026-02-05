/**
 * @fileoverview KPICard - Card de indicador principal
 */

interface KPICardProps {
  label: string;
  value: string | number;
  icon: string;
  color: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'cyan';
  suffix?: string;
  prefix?: string;
  variacao?: number | null;
}

export function KPICard({
  label,
  value,
  icon,
  color,
  suffix,
  prefix,
  variacao,
}: KPICardProps) {
  const formatValue = () => {
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return value.toLocaleString('pt-BR');
      }
      return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    }
    return value;
  };

  return (
    <div className="kpi-card">
      <div className="kpi-header">
        <div className={`kpi-icon ${color}`}>
          {icon}
        </div>
        {variacao !== null && variacao !== undefined && (
          <div className={`kpi-variacao ${variacao >= 0 ? 'positiva' : 'negativa'}`}>
            {variacao >= 0 ? '↑' : '↓'} {Math.abs(variacao)}%
          </div>
        )}
      </div>
      <div className="kpi-value">
        {prefix}{formatValue()}{suffix}
      </div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

export default KPICard;
