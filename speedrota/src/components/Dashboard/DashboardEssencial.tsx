/**
 * @fileoverview DashboardEssencial - Dashboard para plano FREE
 *
 * Inclui:
 * - 3 KPI Cards (rotas, km, entregas)
 * - 1 Gráfico de pizza (status entregas)
 * - Período fixo: últimos 7 dias
 * - Sem exportação
 */

import { useAnalytics } from '../../hooks/useAnalytics';
import { useRouteStore } from '../../store/routeStore';
import { KPICard, ChartPie, UpgradePrompt } from './components';
import '../../styles/Dashboard.css';

export function DashboardEssencial() {
  const { irPara } = useRouteStore();
  const { loading, error, overview, deliveries } = useAnalytics();

  const handleUpgrade = () => {
    irPara('home');
    // O modal de planos será aberto via TelaHome
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard-loading">
          <div className="dashboard-loading-spinner" />
          <p>Carregando analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="dashboard-error">
          <p>Erro ao carregar dados: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="dashboard-back-btn" onClick={() => irPara('home')}>
            ← Voltar
          </button>
          <h1>Dashboard Analytics</h1>
          <span className="plano-badge FREE">FREE</span>
        </div>
        <div className="dashboard-header-actions">
          <span style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>
            Últimos 7 dias
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <KPICard
          label="Total de Rotas"
          value={overview?.kpis.totalRotas || 0}
          icon="🗺️"
          color="blue"
        />
        <KPICard
          label="Km Rodados"
          value={overview?.kpis.totalKm || 0}
          icon="📍"
          color="green"
          suffix=" km"
        />
        <KPICard
          label="Taxa de Sucesso"
          value={overview?.kpis.taxaSucesso || 0}
          icon="✅"
          color="cyan"
          suffix="%"
        />
      </div>

      {/* Gráfico de Pizza */}
      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">Status das Entregas</h3>
              <p className="chart-card-subtitle">
                {deliveries?.totais.total || 0} entregas no período
              </p>
            </div>
          </div>
          <div className="chart-container">
            <ChartPie data={deliveries?.pieChartData || []} />
          </div>
        </div>
      </div>

      {/* Upgrade Prompt */}
      <div className="chart-grid">
        <UpgradePrompt
          planoAtual="FREE"
          recurso="mais gráficos e filtros"
          planoNecessario="PRO"
          onUpgrade={handleUpgrade}
        />
      </div>
    </div>
  );
}

export default DashboardEssencial;
