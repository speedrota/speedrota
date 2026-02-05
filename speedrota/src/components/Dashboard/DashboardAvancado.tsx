/**
 * @fileoverview DashboardAvancado - Dashboard para plano PRO
 *
 * Inclui:
 * - 5 KPI Cards (+ custo, tempo)
 * - Gráfico de pizza (status entregas)
 * - Gráfico de linha (tendências)
 * - Gráfico de barras (por fornecedor)
 * - Filtro de período (7d, 30d, 90d)
 * - Exportação CSV
 */

import { useAnalytics } from '../../hooks/useAnalytics';
import { useRouteStore } from '../../store/routeStore';
import {
  KPICard,
  ChartPie,
  ChartLine,
  ChartBar,
  FiltrosPeriodo,
  UpgradePrompt,
} from './components';
import '../../styles/Dashboard.css';

interface DashboardAvancadoProps {
  onAbrirPlanos?: () => void;
}

export function DashboardAvancado({ onAbrirPlanos }: DashboardAvancadoProps) {
  const { irPara } = useRouteStore();
  const {
    loading,
    error,
    overview,
    deliveries,
    trends,
    suppliers,
    periodo,
    setPeriodo,
    exportCSV,
  } = useAnalytics();

  const handleUpgrade = () => {
    if (onAbrirPlanos) {
      onAbrirPlanos();
    } else {
      irPara('home');
    }
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

  const kpis = overview?.kpis;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="dashboard-back-btn" onClick={() => irPara('home')}>
            ← Voltar
          </button>
          <h1>Dashboard Analytics</h1>
          <span className="plano-badge PRO">PRO</span>
        </div>
        <div className="dashboard-header-actions">
          <div className="dashboard-filters">
            <FiltrosPeriodo
              periodo={periodo}
              onChange={setPeriodo}
              opcoes={['7d', '30d', '90d']}
            />
          </div>
          <div className="export-buttons">
            <button className="export-btn csv" onClick={exportCSV}>
              📄 CSV
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <KPICard
          label="Total de Rotas"
          value={kpis?.totalRotas || 0}
          icon="🗺️"
          color="blue"
        />
        <KPICard
          label="Km Rodados"
          value={kpis?.totalKm || 0}
          icon="📍"
          color="green"
          suffix=" km"
        />
        <KPICard
          label="Taxa de Sucesso"
          value={kpis?.taxaSucesso || 0}
          icon="✅"
          color="cyan"
          suffix="%"
        />
        <KPICard
          label="Tempo Total"
          value={Math.round(kpis?.tempoTotalMin || 0)}
          icon="⏱️"
          color="orange"
          suffix=" min"
        />
        <KPICard
          label="Custo Total"
          value={kpis?.custoTotal?.toFixed(2) || '0.00'}
          icon="💰"
          color="purple"
          prefix="R$ "
        />
      </div>

      {/* Gráficos em Grid */}
      <div className="chart-grid chart-grid-2">
        {/* Status das Entregas */}
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

        {/* Por Fornecedor */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">Por Fornecedor</h3>
              <p className="chart-card-subtitle">
                {suppliers?.fornecedores.length || 0} fornecedores ativos
              </p>
            </div>
          </div>
          <div className="chart-container">
            <ChartBar data={suppliers?.barChartData || []} />
          </div>
        </div>
      </div>

      {/* Tendências */}
      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">Tendências</h3>
              <p className="chart-card-subtitle">Evolução ao longo do tempo</p>
            </div>
          </div>
          <div className="chart-container large">
            <ChartLine data={trends?.lineChartData || []} enableArea />
          </div>
        </div>
      </div>

      {/* Upgrade Prompt */}
      <div className="chart-grid">
        <UpgradePrompt
          planoAtual="PRO"
          recurso="heatmap, insights e exportação PDF"
          planoNecessario="FULL"
          onUpgrade={handleUpgrade}
        />
      </div>
    </div>
  );
}

export default DashboardAvancado;
