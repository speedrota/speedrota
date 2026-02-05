/**
 * @fileoverview Tipos para o módulo de Analytics
 *
 * DESIGN POR CONTRATO:
 * @invariant Todos os dados de analytics são read-only
 * @invariant Período sempre tem inicio e fim válidos
 */

// ==========================================
// TIPOS BASE
// ==========================================

export type DashboardNivel = 'essencial' | 'avancado' | 'completo';

export type PeriodoLabel = '7d' | '30d' | '90d' | '365d' | 'custom';

export type GroupBy = 'day' | 'week' | 'month';

export interface Periodo {
  inicio: string;
  fim: string;
  label?: PeriodoLabel;
}

export interface FeaturesDisponiveis {
  filtrosPeriodo: boolean;
  filtrosFornecedor: boolean;
  exportCSV: boolean;
  exportPDF: boolean;
  heatmap: boolean;
  insights: boolean;
  trends: boolean;
  suppliers: boolean;
}

// ==========================================
// OVERVIEW (todos os planos)
// ==========================================

export interface KPIs {
  totalRotas: number;
  rotasFinalizadas: number;
  totalParadas: number;
  totalKm: number;
  taxaSucesso: number;
  // PRO+
  tempoTotalMin?: number;
  custoTotal?: number;
  kmMedio?: number;
  tempoMedio?: number;
  // FULL+
  paradasEntregues?: number;
  economiaPercent?: number;
}

export interface ComparativoAnterior {
  rotas: number;
  km: number;
  custo: number;
}

export interface OverviewData {
  plano: string;
  dashboardNivel: DashboardNivel;
  periodo: Periodo;
  kpis: KPIs;
  comparativoAnterior: ComparativoAnterior | null;
  featuresDisponiveis: FeaturesDisponiveis;
}

export interface OverviewResponse {
  success: boolean;
  data: OverviewData;
}

// ==========================================
// DELIVERIES (status de entregas)
// ==========================================

export interface StatusBreakdown {
  ENTREGUE: number;
  PENDENTE: number;
  AUSENTE: number;
  RECUSADA: number;
  REAGENDADA: number;
}

export interface PieChartDatum {
  id: string;
  value: number;
  color: string;
}

export interface DeliveriesTotais {
  total: number;
  podsRegistrados: number;
  alertasDistancia: number;
  taxaSucesso: number;
}

export interface DeliveriesData {
  periodo: Periodo;
  statusBreakdown: StatusBreakdown;
  pieChartData: PieChartDatum[];
  totais: DeliveriesTotais;
}

export interface DeliveriesResponse {
  success: boolean;
  data: DeliveriesData;
}

// ==========================================
// TRENDS (PRO+)
// ==========================================

export interface TrendPoint {
  data: string;
  rotas: number;
  km: number;
  paradas: number;
  custo: number;
  tempo: number;
}

export interface LineChartSeries {
  id: string;
  color: string;
  data: Array<{ x: string; y: number }>;
}

export interface TrendsData {
  periodo: Periodo;
  agregacao: GroupBy;
  series: TrendPoint[];
  lineChartData: LineChartSeries[];
}

export interface TrendsResponse {
  success: boolean;
  data: TrendsData;
}

// ==========================================
// SUPPLIERS (PRO+)
// ==========================================

export interface SupplierData {
  id: string;
  nome: string;
  cor: string;
  emoji: string;
  totalParadas: number;
  entregues: number;
  ausentes: number;
  recusadas: number;
  reagendadas: number;
  taxaSucesso: number;
  distanciaTotal: number;
}

export interface BarChartDatum {
  fornecedor: string;
  totalParadas: number;
  entregues: number;
  cor: string;
}

export interface SuppliersData {
  periodo: Periodo;
  fornecedores: SupplierData[];
  barChartData: BarChartDatum[];
}

export interface SuppliersResponse {
  success: boolean;
  data: SuppliersData;
}

// ==========================================
// HEATMAP (FULL+)
// ==========================================

export interface HeatmapCell {
  x: string;
  y: number;
}

export interface HeatmapRow {
  id: string;
  data: HeatmapCell[];
}

export interface HeatmapData {
  periodo: Periodo;
  heatmapData: HeatmapRow[];
  totalEntregas: number;
}

export interface HeatmapResponse {
  success: boolean;
  data: HeatmapData;
}

// ==========================================
// PERFORMANCE (FULL+)
// ==========================================

export interface PerformanceRow {
  id: string;
  data: string;
  paradas: number;
  entregues: number;
  taxaSucesso: number;
  km: number;
  tempo: number;
  custo: number;
  kmPorParada: number;
}

export interface PerformanceData {
  periodo: Periodo;
  performanceData: PerformanceRow[];
}

export interface PerformanceResponse {
  success: boolean;
  data: PerformanceData;
}

// ==========================================
// INSIGHTS (FULL+)
// ==========================================

export type InsightTipo = 'info' | 'alerta' | 'sucesso';

export interface Insight {
  tipo: InsightTipo;
  titulo: string;
  descricao: string;
}

export interface InsightsData {
  periodo: Periodo;
  insights: Insight[];
}

export interface InsightsResponse {
  success: boolean;
  data: InsightsData;
}

// ==========================================
// PARÂMETROS DE QUERY
// ==========================================

export interface AnalyticsQueryParams {
  periodo?: PeriodoLabel;
  dataInicio?: string;
  dataFim?: string;
  fornecedor?: string;
}

export interface TrendsQueryParams {
  periodo?: PeriodoLabel;
  groupBy?: GroupBy;
}

// ==========================================
// ESTADO DO HOOK
// ==========================================

export interface UseAnalyticsState {
  loading: boolean;
  error: string | null;
  overview: OverviewData | null;
  deliveries: DeliveriesData | null;
  trends: TrendsData | null;
  suppliers: SuppliersData | null;
  heatmap: HeatmapData | null;
  performance: PerformanceData | null;
  insights: InsightsData | null;
}

export interface UseAnalyticsActions {
  periodo: PeriodoLabel;
  setPeriodo: (periodo: PeriodoLabel) => void;
  dataInicio: string | null;
  setDataInicio: (data: string | null) => void;
  dataFim: string | null;
  setDataFim: (data: string | null) => void;
  fornecedor: string | null;
  setFornecedor: (fornecedor: string | null) => void;
  refresh: () => Promise<void>;
  exportCSV: () => Promise<void>;
  exportPDF: () => Promise<void>;
}

export type UseAnalyticsReturn = UseAnalyticsState & UseAnalyticsActions;

// ==========================================
// CONFIGURAÇÃO DE KPI CARDS
// ==========================================

export interface KPICardConfig {
  id: string;
  label: string;
  value: number | string;
  icon: string;
  color: string;
  suffix?: string;
  prefix?: string;
  variacao?: number | null;
  planoMinimo: 'FREE' | 'PRO' | 'FULL';
}

// ==========================================
// EXPORTAÇÃO PDF
// ==========================================

export interface PDFReportData {
  titulo: string;
  periodo: Periodo;
  kpis: KPIs;
  series?: TrendPoint[];
  fornecedores?: SupplierData[];
}
