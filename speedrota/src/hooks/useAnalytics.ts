/**
 * @fileoverview Hook para gerenciamento de dados do Analytics
 *
 * DESIGN POR CONTRATO:
 * @pre Usuário autenticado
 * @post Retorna dados de analytics conforme plano do usuário
 * @invariant Dados são carregados sob demanda baseado no plano
 */

import { useState, useCallback, useEffect } from 'react';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { useAuthStore } from '../store/authStore';
import { analyticsService } from '../services/analytics';
import type {
  PeriodoLabel,
  OverviewData,
  DeliveriesData,
  TrendsData,
  SuppliersData,
  HeatmapData,
  PerformanceData,
  InsightsData,
  UseAnalyticsReturn,
} from '../types/analytics';

// ==========================================
// HOOK
// ==========================================

export function useAnalytics(): UseAnalyticsReturn {
  const { user } = useAuthStore();
  const plano = user?.plano || 'FREE';

  // Estado
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dados
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveriesData | null>(null);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [suppliers, setSuppliers] = useState<SuppliersData | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);

  // Filtros
  const [periodo, setPeriodo] = useState<PeriodoLabel>(plano === 'FREE' ? '7d' : '30d');
  const [dataInicio, setDataInicio] = useState<string | null>(null);
  const [dataFim, setDataFim] = useState<string | null>(null);
  const [fornecedor, setFornecedor] = useState<string | null>(null);

  /**
   * Carrega dados baseado no plano do usuário
   */
  const carregarDados = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = {
      periodo: plano === 'FREE' ? '7d' as const : periodo,
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
      fornecedor: fornecedor || undefined,
    };

    try {
      // Overview e Deliveries - todos os planos
      const [overviewData, deliveriesData] = await Promise.all([
        analyticsService.getOverview(params),
        analyticsService.getDeliveries(params),
      ]);

      setOverview(overviewData);
      setDeliveries(deliveriesData);

      // PRO+ - Trends e Suppliers
      if (plano !== 'FREE') {
        const [trendsData, suppliersData] = await Promise.all([
          analyticsService.getTrends({ periodo: params.periodo, groupBy: 'day' }),
          analyticsService.getSuppliers(params),
        ]);

        setTrends(trendsData);
        setSuppliers(suppliersData);
      }

      // FULL+ e FROTA - Heatmap, Performance, Insights
      const planosCompletos = ['FULL', 'ENTERPRISE', 'FROTA_START', 'FROTA_PRO', 'FROTA_ENTERPRISE'];
      if (planosCompletos.includes(plano)) {
        const [heatmapData, performanceData, insightsData] = await Promise.all([
          analyticsService.getHeatmap(params),
          analyticsService.getPerformance(params),
          analyticsService.getInsights(params),
        ]);

        setHeatmap(heatmapData);
        setPerformance(performanceData);
        setInsights(insightsData);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar analytics';
      setError(message);
      console.error('Erro ao carregar analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [plano, periodo, dataInicio, dataFim, fornecedor]);

  /**
   * Exportar dados em CSV
   */
  const exportCSV = useCallback(async () => {
    if (plano === 'FREE') {
      setError('Exportação CSV disponível a partir do plano PRO');
      return;
    }

    try {
      const blob = await analyticsService.exportCSV({
        periodo,
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
      });

      const hoje = new Date().toISOString().split('T')[0];
      saveAs(blob, `speedrota-analytics-${hoje}.csv`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao exportar CSV';
      setError(message);
    }
  }, [plano, periodo, dataInicio, dataFim]);

  /**
   * Exportar dados em PDF
   */
  const exportPDF = useCallback(async () => {
    if (plano !== 'FULL' && plano !== 'ENTERPRISE') {
      setError('Exportação PDF disponível a partir do plano FULL');
      return;
    }

    if (!overview) {
      setError('Carregue os dados antes de exportar');
      return;
    }

    try {
      const doc = new jsPDF();
      const hoje = new Date().toISOString().split('T')[0];

      // Título
      doc.setFontSize(20);
      doc.setTextColor(37, 99, 235); // primary blue
      doc.text('SpeedRota - Relatorio Analytics', 20, 20);

      // Período
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(
        `Periodo: ${overview.periodo.inicio.split('T')[0]} a ${overview.periodo.fim.split('T')[0]}`,
        20,
        35
      );

      // KPIs
      doc.setFontSize(14);
      doc.text('Indicadores Principais', 20, 50);

      doc.setFontSize(11);
      let y = 60;
      const kpis = overview.kpis;

      doc.text(`Total de Rotas: ${kpis.totalRotas}`, 20, y);
      y += 8;
      doc.text(`Rotas Finalizadas: ${kpis.rotasFinalizadas}`, 20, y);
      y += 8;
      doc.text(`Total de Paradas: ${kpis.totalParadas}`, 20, y);
      y += 8;
      doc.text(`Km Rodados: ${kpis.totalKm.toFixed(1)} km`, 20, y);
      y += 8;
      doc.text(`Taxa de Sucesso: ${kpis.taxaSucesso}%`, 20, y);
      y += 8;

      if (kpis.custoTotal !== undefined) {
        doc.text(`Custo Total: R$ ${kpis.custoTotal.toFixed(2)}`, 20, y);
        y += 8;
      }

      if (kpis.tempoTotalMin !== undefined) {
        doc.text(`Tempo Total: ${Math.round(kpis.tempoTotalMin)} min`, 20, y);
        y += 8;
      }

      // Comparativo (se disponível)
      if (overview.comparativoAnterior) {
        y += 10;
        doc.setFontSize(14);
        doc.text('Comparativo com Periodo Anterior', 20, y);
        y += 10;
        doc.setFontSize(11);

        const comp = overview.comparativoAnterior;
        const formatVariacao = (v: number) => (v >= 0 ? `+${v}%` : `${v}%`);

        doc.text(`Rotas: ${formatVariacao(comp.rotas)}`, 20, y);
        y += 8;
        doc.text(`Km: ${formatVariacao(comp.km)}`, 20, y);
        y += 8;
        doc.text(`Custo: ${formatVariacao(comp.custo)}`, 20, y);
        y += 8;
      }

      // Tabela de performance (se disponível)
      if (performance && performance.performanceData.length > 0) {
        y += 15;
        doc.setFontSize(14);
        doc.text('Ultimas Rotas', 20, y);
        y += 5;

        autoTable(doc, {
          startY: y,
          head: [['Data', 'Paradas', 'Entregues', 'Taxa', 'Km', 'Custo']],
          body: performance.performanceData.map((row) => [
            row.data,
            row.paradas,
            row.entregues,
            `${row.taxaSucesso}%`,
            row.km.toFixed(1),
            `R$ ${row.custo.toFixed(2)}`,
          ]),
          styles: { fontSize: 9 },
          headStyles: { fillColor: [37, 99, 235] },
        });
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `SpeedRota Analytics - Gerado em ${hoje} - Pagina ${i} de ${pageCount}`,
          20,
          doc.internal.pageSize.height - 10
        );
      }

      doc.save(`speedrota-relatorio-${hoje}.pdf`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao exportar PDF';
      setError(message);
    }
  }, [plano, overview, performance]);

  // Carregar dados ao montar ou quando filtros mudam
  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  return {
    // Estado
    loading,
    error,
    overview,
    deliveries,
    trends,
    suppliers,
    heatmap,
    performance,
    insights,

    // Filtros
    periodo,
    setPeriodo,
    dataInicio,
    setDataInicio,
    dataFim,
    setDataFim,
    fornecedor,
    setFornecedor,

    // Ações
    refresh: carregarDados,
    exportCSV,
    exportPDF,
  };
}

export default useAnalytics;
