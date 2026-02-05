/**
 * @fileoverview Dashboard de Gestão de Frota Multi-motorista
 *
 * DESIGN POR CONTRATO:
 * @description Interface completa para gestão de frotas
 * @pre Usuário autenticado como gestor de empresa
 * @post Visualização e controle de motoristas, veículos, entregas
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

// ==========================================
// TIPOS
// ==========================================

interface Empresa {
  id: string;
  nome: string;
  modoDistribuicao: 'AUTOMATICO' | 'MANUAL' | 'HIBRIDO';
  baseLat?: number;
  baseLng?: number;
}

interface Motorista {
  id: string;
  nome: string;
  foto?: string;
  telefone: string;
  status: 'DISPONIVEL' | 'EM_ROTA' | 'PAUSADO' | 'INDISPONIVEL' | 'OFFLINE';
  taxaEntrega: number;
  ultimaLat?: number;
  ultimaLng?: number;
  veiculoAtual?: { placa: string; tipo: string };
  entregasHoje?: number;
}

interface Veiculo {
  id: string;
  placa: string;
  modelo: string;
  tipo: string;
  status: 'DISPONIVEL' | 'EM_USO' | 'MANUTENCAO' | 'RESERVADO' | 'INATIVO';
  capacidadeKg: number;
  capacidadeVolumes: number;
  motoristaAtual?: { id: string; nome: string };
}

interface DashboardData {
  empresa: Empresa;
  motoristas: {
    total: number;
    porStatus: { [key: string]: number };
  };
  entregas: {
    total: number;
    concluidas: number;
    pendentes: number;
    emAndamento: number;
    taxaSucesso: number;
  };
  metricas: {
    kmHoje: number;
    tempoHoje: number;
    rotasAtivas: number;
  };
  veiculos: {
    disponiveis: number;
    emUso: number;
  };
  topMotoristas: Array<{
    id: string;
    nome: string;
    foto?: string;
    taxaEntrega: number;
    status: string;
  }>;
}

interface Zona {
  id: string;
  nome: string;
  cor: string;
  cidades: string[];
  bairros: string[];
  _count: { motoristas: number };
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function TelaFrota() {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'dashboard' | 'motoristas' | 'veiculos' | 'zonas' | 'distribuir'>('dashboard');
  const [erro, setErro] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

  // Fetch empresas do gestor
  useEffect(() => {
    const fetchEmpresas = async () => {
      try {
        const res = await fetch(`${API_URL}/frota/empresas`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Erro ao buscar empresas');
        const data = await res.json();
        setEmpresas(data);
        if (data.length > 0) {
          setEmpresaId(data[0].id);
        }
      } catch (err: any) {
        setErro(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchEmpresas();
  }, [token]);

  // Fetch dashboard data quando empresa selecionada
  useEffect(() => {
    if (!empresaId) return;
    
    const fetchDashboard = async () => {
      try {
        const res = await fetch(`${API_URL}/frota/empresa/${empresaId}/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Erro ao buscar dashboard');
        setDashboard(await res.json());
      } catch (err: any) {
        setErro(err.message);
      }
    };

    const fetchMotoristas = async () => {
      try {
        const res = await fetch(`${API_URL}/frota/empresa/${empresaId}/motoristas`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Erro ao buscar motoristas');
        setMotoristas(await res.json());
      } catch (err: any) {
        console.error(err);
      }
    };

    const fetchVeiculos = async () => {
      try {
        const res = await fetch(`${API_URL}/frota/empresa/${empresaId}/veiculos`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Erro ao buscar veículos');
        setVeiculos(await res.json());
      } catch (err: any) {
        console.error(err);
      }
    };

    const fetchZonas = async () => {
      try {
        const res = await fetch(`${API_URL}/frota/empresa/${empresaId}/zonas`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Erro ao buscar zonas');
        setZonas(await res.json());
      } catch (err: any) {
        console.error(err);
      }
    };

    fetchDashboard();
    fetchMotoristas();
    fetchVeiculos();
    fetchZonas();

    // Atualizar a cada 30 segundos
    const interval = setInterval(() => {
      fetchDashboard();
      fetchMotoristas();
    }, 30000);

    return () => clearInterval(interval);
  }, [empresaId, token]);

  // ==========================================
  // HANDLERS
  // ==========================================

  const handleStatusMotorista = async (motoristaId: string, novoStatus: string) => {
    try {
      await fetch(`${API_URL}/frota/motorista/${motoristaId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: novoStatus }),
      });
      // Atualizar lista
      setMotoristas(prev =>
        prev.map(m => (m.id === motoristaId ? { ...m, status: novoStatus as any } : m))
      );
    } catch (err) {
      console.error('[Frota] Erro ao atualizar status:', err);
    }
  };

  // ==========================================
  // RENDER FUNCTIONS
  // ==========================================

  const getStatusColor = (status: string) => {
    const cores: { [key: string]: string } = {
      DISPONIVEL: '#22c55e',
      EM_ROTA: '#3b82f6',
      PAUSADO: '#f59e0b',
      INDISPONIVEL: '#ef4444',
      OFFLINE: '#6b7280',
      EM_USO: '#3b82f6',
      MANUTENCAO: '#f59e0b',
    };
    return cores[status] || '#6b7280';
  };

  const getStatusLabel = (status: string) => {
    const labels: { [key: string]: string } = {
      DISPONIVEL: 'Disponível',
      EM_ROTA: 'Em Rota',
      PAUSADO: 'Pausado',
      INDISPONIVEL: 'Indisponível',
      OFFLINE: 'Offline',
      EM_USO: 'Em Uso',
      MANUTENCAO: 'Manutenção',
      RESERVADO: 'Reservado',
    };
    return labels[status] || status;
  };

  const renderDashboard = () => {
    if (!dashboard) return <div className="frota-loading">Carregando...</div>;

    return (
      <div className="frota-dashboard">
        {/* Cards de resumo */}
        <div className="frota-cards">
          <div className="frota-card">
            <div className="frota-card-icon">🚚</div>
            <div className="frota-card-content">
              <h3>{dashboard.motoristas.total}</h3>
              <span>Motoristas</span>
              <div className="frota-card-detail">
                <span className="dot disponivel"></span>
                {dashboard.motoristas.porStatus.DISPONIVEL || 0} disponíveis
              </div>
            </div>
          </div>

          <div className="frota-card">
            <div className="frota-card-icon">📦</div>
            <div className="frota-card-content">
              <h3>{dashboard.entregas.total}</h3>
              <span>Entregas Hoje</span>
              <div className="frota-card-detail">
                {dashboard.entregas.concluidas} concluídas ({dashboard.entregas.taxaSucesso}%)
              </div>
            </div>
          </div>

          <div className="frota-card">
            <div className="frota-card-icon">📍</div>
            <div className="frota-card-content">
              <h3>{dashboard.metricas.kmHoje} km</h3>
              <span>Percorridos</span>
              <div className="frota-card-detail">
                {dashboard.metricas.rotasAtivas} rotas ativas
              </div>
            </div>
          </div>

          <div className="frota-card">
            <div className="frota-card-icon">🚗</div>
            <div className="frota-card-content">
              <h3>{dashboard.veiculos.disponiveis}</h3>
              <span>Veículos Livres</span>
              <div className="frota-card-detail">
                {dashboard.veiculos.emUso} em uso
              </div>
            </div>
          </div>
        </div>

        {/* Status dos motoristas */}
        <div className="frota-section">
          <h2>Status da Frota</h2>
          <div className="frota-status-grid">
            {['DISPONIVEL', 'EM_ROTA', 'PAUSADO', 'INDISPONIVEL', 'OFFLINE'].map(status => (
              <div
                key={status}
                className="frota-status-item"
                style={{ borderColor: getStatusColor(status) }}
              >
                <span
                  className="frota-status-dot"
                  style={{ backgroundColor: getStatusColor(status) }}
                />
                <span className="frota-status-label">{getStatusLabel(status)}</span>
                <span className="frota-status-count">
                  {dashboard.motoristas.porStatus[status] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top motoristas */}
        <div className="frota-section">
          <h2>Top Motoristas</h2>
          <div className="frota-top-list">
            {dashboard.topMotoristas.map((m, idx) => (
              <div key={m.id} className="frota-top-item">
                <span className="frota-top-rank">{idx + 1}º</span>
                <div className="frota-top-avatar">
                  {m.foto ? (
                    <img src={m.foto} alt={m.nome} />
                  ) : (
                    <span>{m.nome.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="frota-top-info">
                  <strong>{m.nome}</strong>
                  <span>{m.taxaEntrega.toFixed(1)}% entregas</span>
                </div>
                <span
                  className="frota-top-status"
                  style={{ backgroundColor: getStatusColor(m.status) }}
                >
                  {getStatusLabel(m.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderMotoristas = () => (
    <div className="frota-motoristas">
      <div className="frota-section-header">
        <h2>Motoristas ({motoristas.length})</h2>
        <button className="frota-btn-primary" onClick={() => navigate('/frota/motorista/novo')}>
          + Adicionar Motorista
        </button>
      </div>

      <div className="frota-table-container">
        <table className="frota-table">
          <thead>
            <tr>
              <th>Motorista</th>
              <th>Telefone</th>
              <th>Status</th>
              <th>Veículo</th>
              <th>Taxa Entrega</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {motoristas.map(m => (
              <tr key={m.id}>
                <td>
                  <div className="frota-motorista-cell">
                    <div className="frota-avatar-sm">
                      {m.foto ? (
                        <img src={m.foto} alt={m.nome} />
                      ) : (
                        <span>{m.nome.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <span>{m.nome}</span>
                  </div>
                </td>
                <td>{m.telefone}</td>
                <td>
                  <span
                    className="frota-status-badge"
                    style={{ backgroundColor: getStatusColor(m.status) }}
                  >
                    {getStatusLabel(m.status)}
                  </span>
                </td>
                <td>
                  {m.veiculoAtual ? (
                    <span>{m.veiculoAtual.placa} ({m.veiculoAtual.tipo})</span>
                  ) : (
                    <span className="frota-text-muted">Sem veículo</span>
                  )}
                </td>
                <td>
                  <div className="frota-progress">
                    <div
                      className="frota-progress-bar"
                      style={{
                        width: `${m.taxaEntrega}%`,
                        backgroundColor: m.taxaEntrega >= 95 ? '#22c55e' : m.taxaEntrega >= 80 ? '#f59e0b' : '#ef4444',
                      }}
                    />
                    <span>{m.taxaEntrega.toFixed(1)}%</span>
                  </div>
                </td>
                <td>
                  <div className="frota-actions">
                    <select
                      value={m.status}
                      onChange={(e) => handleStatusMotorista(m.id, e.target.value)}
                      className="frota-select-sm"
                    >
                      <option value="DISPONIVEL">Disponível</option>
                      <option value="PAUSADO">Pausado</option>
                      <option value="INDISPONIVEL">Indisponível</option>
                    </select>
                    <button
                      className="frota-btn-icon"
                      onClick={() => navigate(`/frota/motorista/${m.id}`)}
                      title="Ver detalhes"
                    >
                      👁️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderVeiculos = () => (
    <div className="frota-veiculos">
      <div className="frota-section-header">
        <h2>Veículos ({veiculos.length})</h2>
        <button className="frota-btn-primary" onClick={() => navigate('/frota/veiculo/novo')}>
          + Adicionar Veículo
        </button>
      </div>

      <div className="frota-veiculos-grid">
        {veiculos.map(v => (
          <div key={v.id} className="frota-veiculo-card">
            <div className="frota-veiculo-header">
              <span className="frota-veiculo-icon">
                {v.tipo === 'MOTO' ? '🏍️' : v.tipo === 'BICICLETA' ? '🚲' : v.tipo === 'VAN' ? '🚐' : '🚗'}
              </span>
              <div>
                <h3>{v.placa}</h3>
                <span>{v.modelo}</span>
              </div>
              <span
                className="frota-status-badge"
                style={{ backgroundColor: getStatusColor(v.status) }}
              >
                {getStatusLabel(v.status)}
              </span>
            </div>
            <div className="frota-veiculo-body">
              <div className="frota-veiculo-stat">
                <span>Capacidade</span>
                <strong>{v.capacidadeKg}kg / {v.capacidadeVolumes} vol</strong>
              </div>
              {v.motoristaAtual && (
                <div className="frota-veiculo-stat">
                  <span>Motorista</span>
                  <strong>{v.motoristaAtual.nome}</strong>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderZonas = () => (
    <div className="frota-zonas">
      <div className="frota-section-header">
        <h2>Zonas de Atuação ({zonas.length})</h2>
        <button className="frota-btn-primary" onClick={() => navigate('/frota/zona/nova')}>
          + Adicionar Zona
        </button>
      </div>

      <div className="frota-zonas-grid">
        {zonas.map(z => (
          <div key={z.id} className="frota-zona-card" style={{ borderLeftColor: z.cor }}>
            <h3>{z.nome}</h3>
            <div className="frota-zona-info">
              <p><strong>Cidades:</strong> {z.cidades.join(', ') || 'Nenhuma'}</p>
              <p><strong>Bairros:</strong> {z.bairros.length > 0 ? z.bairros.slice(0, 3).join(', ') + (z.bairros.length > 3 ? '...' : '') : 'Todos'}</p>
              <p><strong>Motoristas:</strong> {z._count.motoristas}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderDistribuir = () => (
    <div className="frota-distribuir">
      <div className="frota-section-header">
        <h2>Distribuição de Entregas</h2>
      </div>

      <div className="frota-distribuir-info">
        <p>
          <strong>Modo atual:</strong>{' '}
          {dashboard?.empresa.modoDistribuicao === 'AUTOMATICO'
            ? '🤖 Automático'
            : dashboard?.empresa.modoDistribuicao === 'MANUAL'
            ? '✋ Manual'
            : '🔄 Híbrido'}
        </p>
        <p>Configure as entregas do dia e distribua para sua frota.</p>
      </div>

      <div className="frota-distribuir-actions">
        <button className="frota-btn-primary" onClick={() => navigate('/frota/importar')}>
          📄 Importar Entregas (NF-e)
        </button>
        <button className="frota-btn-secondary" onClick={() => navigate('/frota/distribuir/manual')}>
          ✋ Distribuir Manualmente
        </button>
        <button className="frota-btn-success" onClick={() => navigate('/frota/distribuir/auto')}>
          🤖 Distribuição Automática
        </button>
      </div>
    </div>
  );

  // ==========================================
  // RENDER PRINCIPAL
  // ==========================================

  if (loading) {
    return (
      <div className="frota-container">
        <div className="frota-loading">Carregando...</div>
      </div>
    );
  }

  if (empresas.length === 0) {
    return (
      <div className="frota-container">
        <div className="frota-empty">
          <h2>Nenhuma empresa cadastrada</h2>
          <p>Crie sua empresa para começar a gerenciar sua frota.</p>
          <button className="frota-btn-primary" onClick={() => navigate('/frota/empresa/nova')}>
            + Criar Empresa
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="frota-container">
      {/* Header */}
      <div className="frota-header">
        <div className="frota-header-left">
          <h1>Gestão de Frota</h1>
          {empresas.length > 1 && (
            <select
              value={empresaId || ''}
              onChange={(e) => setEmpresaId(e.target.value)}
              className="frota-select"
            >
              {empresas.map(e => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          )}
        </div>
        <button className="frota-btn-icon" onClick={() => navigate('/')}>
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="frota-tabs">
        {[
          { key: 'dashboard', label: '📊 Dashboard', icon: '📊' },
          { key: 'motoristas', label: '🚚 Motoristas', icon: '🚚' },
          { key: 'veiculos', label: '🚗 Veículos', icon: '🚗' },
          { key: 'zonas', label: '📍 Zonas', icon: '📍' },
          { key: 'distribuir', label: '📦 Distribuir', icon: '📦' },
        ].map(t => (
          <button
            key={t.key}
            className={`frota-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key as any)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="frota-content">
        {erro && <div className="frota-error">{erro}</div>}
        {tab === 'dashboard' && renderDashboard()}
        {tab === 'motoristas' && renderMotoristas()}
        {tab === 'veiculos' && renderVeiculos()}
        {tab === 'zonas' && renderZonas()}
        {tab === 'distribuir' && renderDistribuir()}
      </div>
    </div>
  );
}
