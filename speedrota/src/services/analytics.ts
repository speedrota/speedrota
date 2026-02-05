/**
 * @fileoverview Serviço de Analytics - Chamadas à API
 *
 * DESIGN POR CONTRATO:
 * @pre Usuário autenticado com token válido
 * @pre Plano do usuário determina endpoints acessíveis
 * @post Retorna dados formatados para os gráficos
 */

import { api } from './api';
import type {
  OverviewData,
  DeliveriesData,
  TrendsData,
  SuppliersData,
  HeatmapData,
  PerformanceData,
  InsightsData,
  AnalyticsQueryParams,
  TrendsQueryParams,
} from '../types/analytics';

// ==========================================
// HELPERS
// ==========================================

/**
 * Constrói query string a partir de parâmetros
 */
function buildQueryString(params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, value);
    }
  }

  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

// ==========================================
// SERVICE
// ==========================================

export const analyticsService = {
  /**
   * GET /analytics/overview
   * @description KPIs principais - disponível para todos os planos
   */
  async getOverview(params?: AnalyticsQueryParams): Promise<OverviewData> {
    const query = buildQueryString({
      periodo: params?.periodo,
      dataInicio: params?.dataInicio,
      dataFim: params?.dataFim,
    });

    return api.get<OverviewData>(`/analytics/overview${query}`);
  },

  /**
   * GET /analytics/deliveries
   * @description Análise de status de entregas
   */
  async getDeliveries(params?: AnalyticsQueryParams): Promise<DeliveriesData> {
    const query = buildQueryString({
      periodo: params?.periodo,
      dataInicio: params?.dataInicio,
      dataFim: params?.dataFim,
    });

    return api.get<DeliveriesData>(`/analytics/deliveries${query}`);
  },

  /**
   * GET /analytics/trends
   * @description Tendências temporais - PRO+
   */
  async getTrends(params?: TrendsQueryParams): Promise<TrendsData> {
    const query = buildQueryString({
      periodo: params?.periodo,
      groupBy: params?.groupBy,
    });

    return api.get<TrendsData>(`/analytics/trends${query}`);
  },

  /**
   * GET /analytics/suppliers
   * @description Métricas por fornecedor - PRO+
   */
  async getSuppliers(params?: AnalyticsQueryParams): Promise<SuppliersData> {
    const query = buildQueryString({
      periodo: params?.periodo,
      dataInicio: params?.dataInicio,
      dataFim: params?.dataFim,
      fornecedor: params?.fornecedor,
    });

    return api.get<SuppliersData>(`/analytics/suppliers${query}`);
  },

  /**
   * GET /analytics/heatmap
   * @description Heatmap de entregas - FULL+
   */
  async getHeatmap(params?: AnalyticsQueryParams): Promise<HeatmapData> {
    const query = buildQueryString({
      periodo: params?.periodo,
      dataInicio: params?.dataInicio,
      dataFim: params?.dataFim,
    });

    return api.get<HeatmapData>(`/analytics/heatmap${query}`);
  },

  /**
   * GET /analytics/performance
   * @description Tabela de performance - FULL+
   */
  async getPerformance(params?: AnalyticsQueryParams): Promise<PerformanceData> {
    const query = buildQueryString({
      periodo: params?.periodo,
      dataInicio: params?.dataInicio,
      dataFim: params?.dataFim,
    });

    return api.get<PerformanceData>(`/analytics/performance${query}`);
  },

  /**
   * GET /analytics/insights
   * @description Insights automáticos - FULL+
   */
  async getInsights(params?: AnalyticsQueryParams): Promise<InsightsData> {
    const query = buildQueryString({
      periodo: params?.periodo,
      dataInicio: params?.dataInicio,
      dataFim: params?.dataFim,
    });

    return api.get<InsightsData>(`/analytics/insights${query}`);
  },

  /**
   * GET /analytics/export/csv
   * @description Exportar dados em CSV - PRO+
   * @returns Blob do arquivo CSV
   */
  async exportCSV(params?: AnalyticsQueryParams): Promise<Blob> {
    const query = buildQueryString({
      periodo: params?.periodo,
      dataInicio: params?.dataInicio,
      dataFim: params?.dataFim,
    });

    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';
    const token = localStorage.getItem('speedrota_token');

    const response = await fetch(`${API_BASE_URL}/analytics/export/csv${query}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Erro ao exportar CSV');
    }

    return response.blob();
  },
};

export default analyticsService;
