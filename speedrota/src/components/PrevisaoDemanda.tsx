/**
 * @fileoverview Componentes de Machine Learning - Previsão de Demanda
 * 
 * DESIGN POR CONTRATO:
 * @pre Usuário autenticado
 * @post Exibe previsões, mapa de calor e insights
 * 
 * @author SpeedRota Team
 * @version 1.0.0
 */

import { useState, useEffect } from 'react';
import './PrevisaoDemanda.css';

// ==========================================
// TIPOS
// ==========================================

interface Previsao {
  zona: string;
  data: string;
  horaInicio: number;
  horaFim: number;
  demandaPrevista: number;
  confianca: number;
  limiteInferior: number;
  limiteSuperior: number;
  fatores: {
    diaSemana: number;
    horario: number;
    sazonalidade: number;
    tendencia: number;
  };
  insights: Insight[];
}

interface Insight {
  tipo: string;
  titulo: string;
  descricao: string;
  valor: number;
  acao: string;
  prioridade: number;
}

interface ZonaCalor {
  zona: string;
  demandaPrevista: number;
  intensidade: number;
  melhorHorario: string;
}

interface MetricasML {
  totalPrevisoes: number;
  erroMedioAbsoluto: string;
  mape: string;
  taxaAcerto: string;
  confiancaMedia: string;
}

// ==========================================
// API SERVICE
// ==========================================

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function fetchPrevisao(zona: string, data?: string): Promise<Previsao> {
  const params = new URLSearchParams();
  if (data) params.append('data', data);
  
  const response = await fetch(`${API_URL}/api/v1/ml/previsao/${zona}?${params}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function fetchMapaCalor(data?: string): Promise<ZonaCalor[]> {
  const params = new URLSearchParams();
  if (data) params.append('data', data);
  
  const response = await fetch(`${API_URL}/api/v1/ml/mapa-calor?${params}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data.zonas;
}

async function fetchInsights(zona?: string): Promise<Insight[]> {
  const params = new URLSearchParams();
  if (zona) params.append('zona', zona);
  
  const response = await fetch(`${API_URL}/api/v1/ml/insights?${params}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function fetchMetricas(): Promise<MetricasML> {
  const response = await fetch(`${API_URL}/api/v1/ml/metricas`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

// ==========================================
// COMPONENTES
// ==========================================

/**
 * Card de Insight individual
 */
export function CardInsight({ insight }: { insight: Insight }) {
  const getCorPrioridade = (prioridade: number) => {
    switch (prioridade) {
      case 1: return 'var(--danger)';
      case 2: return 'var(--warning)';
      default: return 'var(--primary)';
    }
  };

  const getIconeTipo = (tipo: string) => {
    switch (tipo) {
      case 'PICO_DEMANDA': return '📈';
      case 'MELHOR_HORARIO': return '⏰';
      case 'TENDENCIA': return '📊';
      case 'ZONA_EVITAR': return '⚠️';
      case 'FORNECEDOR_PICO': return '🏭';
      case 'OPORTUNIDADE': return '💡';
      default: return '🎯';
    }
  };

  return (
    <div 
      className="card-insight" 
      style={{ borderLeftColor: getCorPrioridade(insight.prioridade) }}
    >
      <div className="insight-header">
        <span className="insight-icone">{getIconeTipo(insight.tipo)}</span>
        <span className="insight-titulo">{insight.titulo}</span>
      </div>
      <p className="insight-descricao">{insight.descricao}</p>
      <div className="insight-acao">
        <strong>💡 Ação:</strong> {insight.acao}
      </div>
    </div>
  );
}

/**
 * Card de Previsão para uma zona
 */
export function CardPrevisao({ previsao }: { previsao: Previsao }) {
  const getCorConfianca = (confianca: number) => {
    if (confianca >= 0.8) return 'var(--success)';
    if (confianca >= 0.6) return 'var(--warning)';
    return 'var(--danger)';
  };

  return (
    <div className="card-previsao">
      <div className="previsao-header">
        <span className="previsao-zona">📍 {previsao.zona}</span>
        <span 
          className="previsao-confianca"
          style={{ color: getCorConfianca(previsao.confianca) }}
        >
          {Math.round(previsao.confianca * 100)}% confiança
        </span>
      </div>

      <div className="previsao-principal">
        <div className="previsao-numero">
          <span className="previsao-valor">{previsao.demandaPrevista}</span>
          <span className="previsao-label">entregas previstas</span>
        </div>
        <div className="previsao-intervalo">
          <span className="previsao-range">
            {previsao.limiteInferior} - {previsao.limiteSuperior}
          </span>
          <span className="previsao-label">intervalo 95%</span>
        </div>
      </div>

      <div className="previsao-fatores">
        <div className="fator">
          <span className="fator-label">📅 Dia</span>
          <span className="fator-valor">{previsao.fatores.diaSemana.toFixed(2)}x</span>
        </div>
        <div className="fator">
          <span className="fator-label">⏰ Horário</span>
          <span className="fator-valor">{previsao.fatores.horario.toFixed(2)}x</span>
        </div>
        <div className="fator">
          <span className="fator-label">📊 Sazonalidade</span>
          <span className="fator-valor">{previsao.fatores.sazonalidade.toFixed(2)}x</span>
        </div>
        <div className="fator">
          <span className="fator-label">📈 Tendência</span>
          <span className="fator-valor">{previsao.fatores.tendencia.toFixed(2)}x</span>
        </div>
      </div>

      {previsao.insights.length > 0 && (
        <div className="previsao-insights">
          {previsao.insights.slice(0, 2).map((insight, index) => (
            <CardInsight key={index} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Mapa de Calor de Demanda
 */
export function MapaCalorDemanda() {
  const [zonas, setZonas] = useState<ZonaCalor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataSelecionada, setDataSelecionada] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );

  useEffect(() => {
    loadMapaCalor();
  }, [dataSelecionada]);

  const loadMapaCalor = async () => {
    try {
      setLoading(true);
      const data = await fetchMapaCalor(dataSelecionada);
      setZonas(data);
    } catch (error) {
      console.error('Erro ao carregar mapa de calor:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCorIntensidade = (intensidade: number) => {
    if (intensidade >= 0.8) return '#ef4444'; // Vermelho
    if (intensidade >= 0.6) return '#f97316'; // Laranja
    if (intensidade >= 0.4) return '#eab308'; // Amarelo
    if (intensidade >= 0.2) return '#22c55e'; // Verde
    return '#94a3b8'; // Cinza
  };

  return (
    <div className="mapa-calor-container">
      <div className="mapa-calor-header">
        <h3>🗺️ Mapa de Calor - Demanda por Zona</h3>
        <input
          type="date"
          value={dataSelecionada}
          onChange={(e) => setDataSelecionada(e.target.value)}
          className="input-data"
        />
      </div>

      {loading ? (
        <div className="loading">Carregando...</div>
      ) : (
        <>
          <div className="zonas-grid">
            {zonas.map((zona, index) => (
              <div 
                key={index} 
                className="zona-card"
                style={{ 
                  backgroundColor: getCorIntensidade(zona.intensidade),
                  opacity: 0.7 + (zona.intensidade * 0.3)
                }}
              >
                <span className="zona-nome">{zona.zona}</span>
                <span className="zona-demanda">{zona.demandaPrevista} entregas</span>
                <span className="zona-horario">🕐 {zona.melhorHorario}</span>
              </div>
            ))}
          </div>

          <div className="legenda">
            <span className="legenda-item" style={{ backgroundColor: '#ef4444' }}>Alta</span>
            <span className="legenda-item" style={{ backgroundColor: '#f97316' }}>Média-Alta</span>
            <span className="legenda-item" style={{ backgroundColor: '#eab308' }}>Média</span>
            <span className="legenda-item" style={{ backgroundColor: '#22c55e' }}>Baixa</span>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Painel de Insights
 */
export function PainelInsights({ zona }: { zona?: string }) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInsights();
  }, [zona]);

  const loadInsights = async () => {
    try {
      setLoading(true);
      const data = await fetchInsights(zona);
      setInsights(data);
    } catch (error) {
      console.error('Erro ao carregar insights:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Carregando insights...</div>;

  if (insights.length === 0) {
    return (
      <div className="painel-insights vazio">
        <p>📊 Nenhum insight disponível no momento.</p>
        <p>Continue fazendo entregas para gerar previsões!</p>
      </div>
    );
  }

  return (
    <div className="painel-insights">
      <h3>💡 Insights para Você</h3>
      <div className="insights-lista">
        {insights.map((insight, index) => (
          <CardInsight key={index} insight={insight} />
        ))}
      </div>
    </div>
  );
}

/**
 * Métricas do Modelo ML
 */
export function MetricasModelo() {
  const [metricas, setMetricas] = useState<MetricasML | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetricas();
  }, []);

  const loadMetricas = async () => {
    try {
      setLoading(true);
      const data = await fetchMetricas();
      setMetricas(data);
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Carregando métricas...</div>;

  if (!metricas || metricas.totalPrevisoes === 0) {
    return (
      <div className="metricas-modelo vazio">
        <p>📊 Sem dados suficientes para métricas</p>
      </div>
    );
  }

  return (
    <div className="metricas-modelo">
      <h4>📈 Qualidade do Modelo</h4>
      <div className="metricas-grid">
        <div className="metrica">
          <span className="metrica-valor">{metricas.totalPrevisoes}</span>
          <span className="metrica-label">Previsões</span>
        </div>
        <div className="metrica">
          <span className="metrica-valor">{metricas.taxaAcerto}</span>
          <span className="metrica-label">Acurácia</span>
        </div>
        <div className="metrica">
          <span className="metrica-valor">{metricas.mape}</span>
          <span className="metrica-label">Erro %</span>
        </div>
        <div className="metrica">
          <span className="metrica-valor">{metricas.confiancaMedia}</span>
          <span className="metrica-label">Confiança</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Componente Principal - Tela de Previsão de Demanda
 */
export function TelaPrevisaoDemanda() {
  const [zona, setZona] = useState('');
  const [previsao, setPrevisao] = useState<Previsao | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const buscarPrevisao = async () => {
    if (!zona || zona.length < 5) {
      setErro('Informe um CEP válido (mínimo 5 dígitos)');
      return;
    }

    try {
      setLoading(true);
      setErro(null);
      const data = await fetchPrevisao(zona.substring(0, 5));
      setPrevisao(data);
    } catch (error: any) {
      setErro(error.message || 'Erro ao buscar previsão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tela-previsao-demanda">
      <header className="previsao-header-principal">
        <h1>🔮 Previsão de Demanda</h1>
        <p>Descubra onde e quando haverá mais entregas</p>
      </header>

      <section className="busca-previsao">
        <div className="busca-form">
          <input
            type="text"
            placeholder="Digite um CEP ou zona (ex: 01310)"
            value={zona}
            onChange={(e) => setZona(e.target.value.replace(/\D/g, ''))}
            maxLength={8}
          />
          <button onClick={buscarPrevisao} disabled={loading}>
            {loading ? 'Buscando...' : '🔍 Buscar Previsão'}
          </button>
        </div>
        {erro && <p className="erro">{erro}</p>}
      </section>

      {previsao && (
        <section className="resultado-previsao">
          <CardPrevisao previsao={previsao} />
        </section>
      )}

      <section className="mapa-calor-section">
        <MapaCalorDemanda />
      </section>

      <section className="insights-section">
        <PainelInsights zona={zona.substring(0, 5)} />
      </section>

      <section className="metricas-section">
        <MetricasModelo />
      </section>
    </div>
  );
}

export default TelaPrevisaoDemanda;
