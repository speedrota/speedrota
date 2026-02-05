/**
 * @fileoverview DashboardCompleto - Dashboard para planos FULL/ENTERPRISE
 *
 * Inclui:
 * - 8 KPI Cards com comparativos
 * - Todos os gráficos do PRO +
 *   - Heatmap (dias da semana vs horários)
 *   - Tabela de performance detalhada
 * - Filtro de período customizado
 * - Filtro por fornecedor
 * - Exportação PDF + CSV
 * - Insights automáticos
 */

import { useAnalytics } from '../../hooks/useAnalytics';
import { useRouteStore } from '../../store/routeStore';
import {
  KPICard,
  ChartPie,
  ChartLine,
  ChartBar,
  ChartHeatmap,
  FiltrosPeriodo,
  InsightsPanel,
  TabelaPerformance,
} from './components';
import '../../styles/Dashboard.css';

export function DashboardCompleto() {
  const { irPara } = useRouteStore();
  const {
    loading,
    error,
    overview,
    deliveries,
    trends,
    suppliers,
    heatmap,
    performance,
    insights,
    periodo,
    setPeriodo,
    fornecedor,
    setFornecedor,
    exportCSV,
    exportPDF,
  } = useAnalytics();

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
  const comp = overview?.comparativoAnterior;
  const plano = overview?.plano || 'FULL';

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="dashboard-back-btn" onClick={() => irPara('home')}>
            ← Voltar
          </button>
          <h1>Dashboard Analytics</h1>
          <span className={`plano-badge ${plano}`}>{plano}</span>
        </div>
        <div className="dashboard-header-actions">
          <div className="dashboard-filters">
            <FiltrosPeriodo
              periodo={periodo}
              onChange={setPeriodo}
              opcoes={['7d', '30d', '90d', '365d']}
            />
            {suppliers && suppliers.fornecedores.length > 0 && (
              <select
                className="filter-select"
                value={fornecedor || ''}
                onChange={(e) => setFornecedor(e.target.value || null)}
              >
                <option value="">Todos fornecedores</option>
                {suppliers.fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.emoji} {f.nome}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="export-buttons">
            <button className="export-btn csv" onClick={exportCSV}>
              📄 CSV
            </button>
            <button className="export-btn pdf" onClick={exportPDF}>
              📕 PDF
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards - 8 cards com comparativos */}
      <div className="kpi-grid">
        <KPICard
          label="Total de Rotas"
          value={kpis?.totalRotas || 0}
          icon="🗺️"
          color="blue"
          variacao={comp?.rotas}
        />
        <KPICard
          label="Rotas Finalizadas"
          value={kpis?.rotasFinalizadas || 0}
          icon="✓"
          color="green"
        />
        <KPICard
          label="Total de Paradas"
          value={kpis?.totalParadas || 0}
          icon="📦"
          color="orange"
        />
        <KPICard
          label="Km Rodados"
          value={kpis?.totalKm || 0}
          icon="📍"
          color="green"
          suffix=" km"
          variacao={comp?.km}
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
          variacao={comp?.custo}
        />
        <KPICard
          label="Km Médio/Rota"
          value={kpis?.kmMedio?.toFixed(1) || '0.0'}
          icon="📊"
          color="blue"
          suffix=" km"
        />
      </div>

      {/* Insights */}
      {insights && insights.insights.length > 0 && (
        <div className="chart-grid">
          <div className="chart-card">
            <div className="chart-card-header">
              <h3 className="chart-card-title">Insights</h3>
            </div>
            <InsightsPanel insights={insights.insights} />
          </div>
        </div>
      )}

      {/* Gráficos em Grid */}
      <div className="chart-grid chart-grid-2">
        {/* Status das Entregas */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <h3 className="chart-card-title">Status das Entregas</h3>
              <p className="chart-card-subtitle">
                {deliveries?.totais.total || 0} entregas |{' '}
                {deliveries?.totais.podsRegistrados || 0} PODs
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

      {/* Heatmap */}
      {heatmap && (
        <div className="chart-grid">
          <div className="chart-card">
            <div className="chart-card-header">
              <div>
                <h3 className="chart-card-title">Padrão de Entregas</h3>
                <p className="chart-card-subtitle">
                  Dia da semana vs Hora ({heatmap.totalEntregas} entregas)
                </p>
              </div>
            </div>
            <div className="chart-container large">
              <ChartHeatmap data={heatmap.heatmapData} />
            </div>
          </div>
        </div>
      )}

      {/* Tabela de Performance */}
      {performance && performance.performanceData.length > 0 && (
        <div className="chart-grid">
          <div className="chart-card">
            <div className="chart-card-header">
              <div>
                <h3 className="chart-card-title">Últimas Rotas</h3>
                <p className="chart-card-subtitle">Performance detalhada</p>
              </div>
            </div>
            <TabelaPerformance data={performance.performanceData} />
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardCompleto;
