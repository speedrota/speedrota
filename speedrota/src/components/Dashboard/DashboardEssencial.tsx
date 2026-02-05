/**
 * @fileoverview DashboardEssencial - Dashboard Modo Simples para plano FREE
 *
 * Filosofia: Responder 3 perguntas do entregador:
 * 1. "Quanto eu economizei?" → CardEconomia (R$ em destaque)
 * 2. "Qual fornecedor paga melhor?" → CardRanking
 * 3. "Estou melhorando?" → CardMelhoria (setas, tendências)
 *
 * @design Foco em R$, emojis, linguagem simples
 * @target Entregadores que não são profissionais de dados
 */

import { useAnalytics } from '../../hooks/useAnalytics';
import { useRouteStore } from '../../store/routeStore';
import {
  CardEconomia,
  CardMelhoria,
  CardEntregas,
  CardRanking,
  CardDica,
  CardUpgrade,
} from './components/ModoSimples';
import '../../styles/Dashboard.css';
import './components/ModoSimples.css';

// Dicas contextuais baseadas nos dados
const getDicaDoDia = (economia: number, melhorFornecedor: string): { titulo: string; texto: string } => {
  if (economia > 100) {
    return {
      titulo: '🎯 Mandou bem!',
      texto: `Você economizou R$ ${economia.toFixed(0)} essa semana. Continue assim!`,
    };
  }
  if (melhorFornecedor) {
    return {
      titulo: '💡 Dica do dia',
      texto: `${melhorFornecedor} está pagando melhor. Priorize entregas deles!`,
    };
  }
  return {
    titulo: '🚀 Comece bem',
    texto: 'Faça suas primeiras entregas otimizadas e veja a economia!',
  };
};

export function DashboardEssencial() {
  const { irPara } = useRouteStore();
  const { loading, error, overview, deliveries, suppliers } = useAnalytics();

  const handleUpgrade = () => {
    irPara('home');
    // O modal de planos será aberto via TelaHome
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard-loading">
          <div className="dashboard-loading-spinner" />
          <p>Carregando seu resumo...</p>
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

  // Calcular dados para os cards
  const economiaTotal = overview?.kpis.economiaTotal || 0;
  const kmEconomizados = overview?.kpis.kmEconomizados || 0;
  const melhoriaPercentual = overview?.kpis.melhoriaPercentual || 0;
  const estaMelhorando = melhoriaPercentual >= 0;

  const entregasHoje = deliveries?.totais.hoje || 0;
  const entregasSemana = deliveries?.totais.semana || 0;
  const taxaSucesso = overview?.kpis.taxaSucesso || 0;

  // Ranking de fornecedores (top 3)
  const topFornecedores = (suppliers?.ranking || []).slice(0, 3).map((f, i) => ({
    posicao: i + 1,
    nome: f.nome,
    mediaValor: f.valorMedio,
  }));

  const melhorFornecedor = topFornecedores[0]?.nome || '';
  const dica = getDicaDoDia(economiaTotal, melhorFornecedor);

  return (
    <div className="dashboard dashboard-simples">
      <div className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="dashboard-back-btn" onClick={() => irPara('home')}>
            ← Voltar
          </button>
          <h1>Meu Resumo</h1>
          <span className="plano-badge FREE">FREE</span>
        </div>
        <div className="dashboard-header-actions">
          <span style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>
            📅 Esta semana
          </span>
        </div>
      </div>

      {/* Card Principal - Economia (responde "Quanto economizei?") */}
      <CardEconomia
        valorEconomizado={economiaTotal}
        kmEconomizados={kmEconomizados}
        periodo="esta semana"
      />

      {/* Grid de Cards Secundários */}
      <div className="modo-simples-grid">
        {/* Card Melhoria (responde "Estou melhorando?") */}
        <CardMelhoria
          percentual={Math.abs(melhoriaPercentual)}
          estaMelhorando={estaMelhorando}
          periodo="vs semana passada"
        />

        {/* Card Entregas */}
        <CardEntregas
          entregasHoje={entregasHoje}
          entregasSemana={entregasSemana}
          taxaSucesso={taxaSucesso}
        />
      </div>

      {/* Ranking de Fornecedores (responde "Qual paga melhor?") */}
      {topFornecedores.length > 0 && (
        <CardRanking fornecedores={topFornecedores} />
      )}

      {/* Dica do Dia */}
      <CardDica titulo={dica.titulo} texto={dica.texto} />

      {/* Upgrade Prompt */}
      <CardUpgrade
        texto="Quer ver gráficos e comparar períodos?"
        textoBotao="Ver Plano PRO"
        onUpgrade={handleUpgrade}
      />
    </div>
  );
}

export default DashboardEssencial;
