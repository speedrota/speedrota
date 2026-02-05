/**
 * @fileoverview Componentes de Gamificação
 * 
 * DESIGN POR CONTRATO:
 * @pre Usuário autenticado
 * @post Exibe badges, ranking, conquistas e progresso
 * 
 * @author SpeedRota Team
 * @version 1.0.0
 */

import { useState, useEffect } from 'react';
import './Gamificacao.css';

// ==========================================
// TIPOS
// ==========================================

interface Badge {
  codigo: string;
  nome: string;
  descricao: string;
  icone: string;
  tipo: string;
  pontos: number;
  raridade: string;
  conquistado: boolean;
  progressoAtual: number;
  requisito: number;
  dataConquista?: string;
}

interface PerfilGamificacao {
  usuarioId: string;
  nivel: number;
  pontosAtuais: number;
  pontosProximoNivel: number;
  progressoNivel: number;
  totalBadges: number;
  badgesConquistados: number;
  posicaoRanking: number;
  sequenciaAtual: number;
  melhorSequencia: number;
  totalEntregas: number;
  totalKm: number;
  ultimaAtualizacao: string;
}

interface RankingItem {
  posicao: number;
  usuarioId: string;
  nome: string;
  pontos: number;
  nivel: number;
  badgesCount: number;
  entregasSemana: number;
}

interface ResumoSemanal {
  entregasSemana: number;
  kmSemana: number;
  pontosGanhos: number;
  novosConquistas: number;
  posicaoMelhorou: boolean;
  variacaoPosicao: number;
  destaque: string;
  meta: {
    entregas: { atual: number; meta: number; progresso: number };
    km: { atual: number; meta: number; progresso: number };
  };
}

// ==========================================
// API SERVICE
// ==========================================

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function fetchPerfil(): Promise<PerfilGamificacao> {
  const response = await fetch(`${API_URL}/api/v1/gamificacao/perfil`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function fetchBadges(tipo?: string): Promise<Badge[]> {
  const url = tipo 
    ? `${API_URL}/api/v1/gamificacao/badges/${tipo}`
    : `${API_URL}/api/v1/gamificacao/badges`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function fetchRanking(): Promise<RankingItem[]> {
  const response = await fetch(`${API_URL}/api/v1/gamificacao/ranking`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function fetchResumoSemanal(): Promise<ResumoSemanal> {
  const response = await fetch(`${API_URL}/api/v1/gamificacao/resumo-semanal`, {
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
 * Card de Badge
 */
export function CardBadge({ badge }: { badge: Badge }) {
  const getCorRaridade = (raridade: string) => {
    switch (raridade) {
      case 'LENDARIO': return '#f59e0b'; // Dourado
      case 'EPICO': return '#8b5cf6'; // Roxo
      case 'RARO': return '#3b82f6'; // Azul
      case 'INCOMUM': return '#22c55e'; // Verde
      default: return '#94a3b8'; // Cinza
    }
  };

  const progresso = Math.min(100, (badge.progressoAtual / badge.requisito) * 100);

  return (
    <div 
      className={`card-badge ${badge.conquistado ? 'conquistado' : 'bloqueado'}`}
      style={{ borderColor: getCorRaridade(badge.raridade) }}
    >
      <div className="badge-icone-container">
        <span className={`badge-icone ${badge.conquistado ? '' : 'grayscale'}`}>
          {badge.icone}
        </span>
        {badge.conquistado && (
          <span className="badge-check">✅</span>
        )}
      </div>
      
      <div className="badge-info">
        <h4 className="badge-nome">{badge.nome}</h4>
        <p className="badge-descricao">{badge.descricao}</p>
        
        {!badge.conquistado && (
          <div className="badge-progresso">
            <div className="progresso-bar">
              <div 
                className="progresso-fill"
                style={{ 
                  width: `${progresso}%`,
                  backgroundColor: getCorRaridade(badge.raridade)
                }}
              />
            </div>
            <span className="progresso-texto">
              {badge.progressoAtual}/{badge.requisito}
            </span>
          </div>
        )}
        
        <div className="badge-footer">
          <span 
            className="badge-raridade"
            style={{ color: getCorRaridade(badge.raridade) }}
          >
            {badge.raridade}
          </span>
          <span className="badge-pontos">⭐ {badge.pontos} pts</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Perfil de Gamificação (Header)
 */
export function PerfilHeader() {
  const [perfil, setPerfil] = useState<PerfilGamificacao | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPerfil();
  }, []);

  const loadPerfil = async () => {
    try {
      setLoading(true);
      const data = await fetchPerfil();
      setPerfil(data);
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Carregando perfil...</div>;
  if (!perfil) return null;

  return (
    <div className="perfil-header">
      <div className="perfil-nivel">
        <span className="nivel-numero">{perfil.nivel}</span>
        <span className="nivel-label">Nível</span>
      </div>
      
      <div className="perfil-info">
        <div className="perfil-progresso">
          <div className="progresso-nivel-bar">
            <div 
              className="progresso-nivel-fill"
              style={{ width: `${perfil.progressoNivel * 100}%` }}
            />
          </div>
          <span className="progresso-nivel-texto">
            {perfil.pontosAtuais} / {perfil.pontosProximoNivel} pts
          </span>
        </div>
        
        <div className="perfil-stats">
          <span className="stat">
            🏆 {perfil.badgesConquistados}/{perfil.totalBadges} badges
          </span>
          <span className="stat">
            📍 #{perfil.posicaoRanking} ranking
          </span>
          <span className="stat">
            🔥 {perfil.sequenciaAtual} dias
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Lista de Badges por Categoria
 */
export function ListaBadges() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [categoria, setCategoria] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const categorias = [
    { id: '', label: 'Todos' },
    { id: 'ENTREGAS', label: '📦 Entregas' },
    { id: 'STREAK', label: '🔥 Sequência' },
    { id: 'DISTANCIA', label: '🛣️ Distância' },
    { id: 'VELOCIDADE', label: '⚡ Velocidade' },
    { id: 'PRECISAO', label: '🎯 Precisão' },
    { id: 'FORNECEDOR', label: '🏭 Fornecedor' },
    { id: 'ESPECIAL', label: '⭐ Especial' },
  ];

  useEffect(() => {
    loadBadges();
  }, [categoria]);

  const loadBadges = async () => {
    try {
      setLoading(true);
      const data = await fetchBadges(categoria || undefined);
      setBadges(data);
    } catch (error) {
      console.error('Erro ao carregar badges:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lista-badges-container">
      <div className="badges-filtros">
        {categorias.map((cat) => (
          <button
            key={cat.id}
            className={`filtro-btn ${categoria === cat.id ? 'ativo' : ''}`}
            onClick={() => setCategoria(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">Carregando badges...</div>
      ) : (
        <div className="badges-grid">
          {badges.map((badge) => (
            <CardBadge key={badge.codigo} badge={badge} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Ranking Semanal
 */
export function RankingSemanal() {
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRanking();
  }, []);

  const loadRanking = async () => {
    try {
      setLoading(true);
      const data = await fetchRanking();
      setRanking(data);
    } catch (error) {
      console.error('Erro ao carregar ranking:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMedalha = (posicao: number) => {
    switch (posicao) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${posicao}`;
    }
  };

  if (loading) return <div className="loading">Carregando ranking...</div>;

  return (
    <div className="ranking-container">
      <h3>🏆 Ranking Semanal</h3>
      
      <div className="ranking-lista">
        {ranking.map((item) => (
          <div 
            key={item.usuarioId}
            className={`ranking-item ${item.posicao <= 3 ? 'destaque' : ''}`}
          >
            <span className="ranking-posicao">{getMedalha(item.posicao)}</span>
            <div className="ranking-info">
              <span className="ranking-nome">{item.nome}</span>
              <span className="ranking-nivel">Nível {item.nivel}</span>
            </div>
            <div className="ranking-stats">
              <span className="ranking-pontos">{item.pontos} pts</span>
              <span className="ranking-entregas">{item.entregasSemana} entregas</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Resumo Semanal
 */
export function ResumoSemanalCard() {
  const [resumo, setResumo] = useState<ResumoSemanal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResumo();
  }, []);

  const loadResumo = async () => {
    try {
      setLoading(true);
      const data = await fetchResumoSemanal();
      setResumo(data);
    } catch (error) {
      console.error('Erro ao carregar resumo:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Carregando resumo...</div>;
  if (!resumo) return null;

  return (
    <div className="resumo-semanal">
      <h3>📊 Seu Resumo Semanal</h3>
      
      <div className="resumo-destaque">
        <span className="destaque-emoji">🌟</span>
        <span className="destaque-texto">{resumo.destaque}</span>
      </div>

      <div className="resumo-grid">
        <div className="resumo-stat">
          <span className="stat-valor">{resumo.entregasSemana}</span>
          <span className="stat-label">📦 Entregas</span>
        </div>
        <div className="resumo-stat">
          <span className="stat-valor">{resumo.kmSemana.toFixed(1)}</span>
          <span className="stat-label">🛣️ Km rodados</span>
        </div>
        <div className="resumo-stat">
          <span className="stat-valor">+{resumo.pontosGanhos}</span>
          <span className="stat-label">⭐ Pontos</span>
        </div>
        <div className="resumo-stat">
          <span className="stat-valor">{resumo.novosConquistas}</span>
          <span className="stat-label">🏆 Conquistas</span>
        </div>
      </div>

      <div className="resumo-metas">
        <h4>🎯 Suas Metas</h4>
        <div className="meta-item">
          <span className="meta-label">Entregas</span>
          <div className="meta-bar">
            <div 
              className="meta-fill"
              style={{ width: `${Math.min(100, resumo.meta.entregas.progresso * 100)}%` }}
            />
          </div>
          <span className="meta-valor">
            {resumo.meta.entregas.atual}/{resumo.meta.entregas.meta}
          </span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Km</span>
          <div className="meta-bar">
            <div 
              className="meta-fill"
              style={{ width: `${Math.min(100, resumo.meta.km.progresso * 100)}%` }}
            />
          </div>
          <span className="meta-valor">
            {resumo.meta.km.atual.toFixed(0)}/{resumo.meta.km.meta}
          </span>
        </div>
      </div>

      {resumo.posicaoMelhorou && (
        <div className="resumo-posicao-up">
          📈 Você subiu {resumo.variacaoPosicao} posições no ranking!
        </div>
      )}
    </div>
  );
}

/**
 * Componente Principal - Tela de Gamificação
 */
export function TelaGamificacao() {
  const [aba, setAba] = useState<'badges' | 'ranking' | 'resumo'>('badges');

  return (
    <div className="tela-gamificacao">
      <header className="gamificacao-header">
        <h1>🎮 Conquistas</h1>
        <p>Ganhe pontos e desbloqueie badges!</p>
      </header>

      <section className="perfil-section">
        <PerfilHeader />
      </section>

      <nav className="gamificacao-tabs">
        <button
          className={`tab-btn ${aba === 'badges' ? 'ativo' : ''}`}
          onClick={() => setAba('badges')}
        >
          🏆 Badges
        </button>
        <button
          className={`tab-btn ${aba === 'ranking' ? 'ativo' : ''}`}
          onClick={() => setAba('ranking')}
        >
          📊 Ranking
        </button>
        <button
          className={`tab-btn ${aba === 'resumo' ? 'ativo' : ''}`}
          onClick={() => setAba('resumo')}
        >
          📋 Resumo
        </button>
      </nav>

      <main className="gamificacao-content">
        {aba === 'badges' && <ListaBadges />}
        {aba === 'ranking' && <RankingSemanal />}
        {aba === 'resumo' && <ResumoSemanalCard />}
      </main>
    </div>
  );
}

export default TelaGamificacao;
