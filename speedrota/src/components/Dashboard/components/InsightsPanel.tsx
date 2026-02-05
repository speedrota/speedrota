/**
 * @fileoverview InsightsPanel - Painel de insights automáticos
 */

import type { Insight } from '../../../types/analytics';

interface InsightsPanelProps {
  insights: Insight[];
}

const ICONS: Record<string, string> = {
  info: 'ℹ️',
  alerta: '⚠️',
  sucesso: '✅',
};

export function InsightsPanel({ insights }: InsightsPanelProps) {
  if (!insights || insights.length === 0) {
    return (
      <div className="insights-empty">
        <p>Nenhum insight disponível no momento</p>
      </div>
    );
  }

  return (
    <div className="insights-panel">
      {insights.map((insight, index) => (
        <div key={index} className={`insight-card ${insight.tipo}`}>
          <div className="insight-icon">{ICONS[insight.tipo]}</div>
          <div className="insight-content">
            <div className="insight-titulo">{insight.titulo}</div>
            <div className="insight-descricao">{insight.descricao}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default InsightsPanel;
