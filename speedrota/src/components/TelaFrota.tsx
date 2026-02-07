/**
 * @fileoverview Dashboard de Gestão de Frota Multi-motorista
 *
 * DESIGN POR CONTRATO:
 * @description Interface completa para gestão de frotas
 * @pre Usuário autenticado como gestor de empresa
 * @post Visualização e controle de motoristas, veículos, entregas
 */

import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useRouteStore } from '../store/routeStore';
import './TelaFrota.css';

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
  motoristasUsando?: Array<{ id: string; nome: string; status: string }>;
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
  _count: { motoristasZona: number };
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function TelaFrota() {
  const { irPara } = useRouteStore();
  const { token } = useAuthStore();
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);

  // Estados para modal de criar empresa
  const [showCriarEmpresa, setShowCriarEmpresa] = useState(false);
  const [novaEmpresa, setNovaEmpresa] = useState({
    nome: '',
    cnpj: '',
    baseEndereco: '',
    modoDistribuicao: 'AUTOMATICO' as 'AUTOMATICO' | 'MANUAL' | 'HIBRIDO',
  });
  const [criandoEmpresa, setCriandoEmpresa] = useState(false);

  // Estados para modal de criar motorista
  const [showCriarMotorista, setShowCriarMotorista] = useState(false);
  const [novoMotorista, setNovoMotorista] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    tipoMotorista: 'VINCULADO' as 'VINCULADO' | 'AUTONOMO' | 'AUTONOMO_PARCEIRO',
  });
  const [criandoMotorista, setCriandoMotorista] = useState(false);

  // Helper para funcionalidades ainda não implementadas
  const handleComingSoon = (feature: string) => {
    alert(`${feature} - Em breve!`);
  };

  // Handler para criar motorista
  const handleCriarMotorista = async () => {
    if (!novoMotorista.nome.trim() || !novoMotorista.email.trim() || !novoMotorista.telefone.trim()) {
      alert('Nome, email e telefone são obrigatórios');
      return;
    }

    setCriandoMotorista(true);
    try {
      let url: string;
      let body: object;

      if (novoMotorista.tipoMotorista === 'VINCULADO') {
        // Motorista vinculado a empresa
        if (!empresaId) {
          alert('Selecione uma empresa primeiro');
          setCriandoMotorista(false);
          return;
        }
        url = `${API_URL}/frota/empresa/${empresaId}/motorista`;
        body = {
          nome: novoMotorista.nome,
          email: novoMotorista.email,
          telefone: novoMotorista.telefone,
          cpf: novoMotorista.cpf || undefined,
        };
      } else {
        // Motorista autônomo
        url = `${API_URL}/frota/motorista/autonomo`;
        body = {
          nome: novoMotorista.nome,
          email: novoMotorista.email,
          telefone: novoMotorista.telefone,
          cpf: novoMotorista.cpf || undefined,
          tipoMotorista: novoMotorista.tipoMotorista,
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao criar motorista');
      }

      const motorista = await res.json();
      setMotoristas(prev => [...prev, motorista]);
      setShowCriarMotorista(false);
      setNovoMotorista({ nome: '', email: '', telefone: '', cpf: '', tipoMotorista: 'VINCULADO' });
      alert('Motorista criado com sucesso!');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCriandoMotorista(false);
    }
  };

  // Handler para criar empresa
  const handleCriarEmpresa = async () => {
    if (!novaEmpresa.nome.trim()) {
      alert('Nome da empresa é obrigatório');
      return;
    }
    setCriandoEmpresa(true);
    try {
      const res = await fetch(`${API_URL}/frota/empresa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(novaEmpresa),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao criar empresa');
      }
      const empresa = await res.json();
      setEmpresas(prev => [...prev, empresa]);
      setEmpresaId(empresa.id);
      setShowCriarEmpresa(false);
      setNovaEmpresa({ nome: '', cnpj: '', baseEndereco: '', modoDistribuicao: 'AUTOMATICO' });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCriandoEmpresa(false);
    }
  };
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
        <button className="frota-btn-primary" onClick={() => setShowCriarMotorista(true)}>
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
                      onClick={() => handleComingSoon('Detalhes do motorista')}
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
        <button className="frota-btn-primary" onClick={() => handleComingSoon('Adicionar veículo')}>
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
              {v.motoristasUsando && v.motoristasUsando.length > 0 && (
                <div className="frota-veiculo-stat">
                  <span>Motorista</span>
                  <strong>{v.motoristasUsando[0].nome}</strong>
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
        <button className="frota-btn-primary" onClick={() => handleComingSoon('Criar zona')}>
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
              <p><strong>Motoristas:</strong> {z._count.motoristasZona}</p>
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
        <button className="frota-btn-primary" onClick={() => handleComingSoon('Importar entregas')}>
          📄 Importar Entregas (NF-e)
        </button>
        <button className="frota-btn-secondary" onClick={() => handleComingSoon('Distribuição manual')}>
          ✋ Distribuir Manualmente
        </button>
        <button className="frota-btn-success" onClick={() => handleComingSoon('Distribuição automática')}>
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
          <h2>Gestão de Frota</h2>
          <p>Escolha uma opção para começar:</p>
          
          <div className="frota-opcoes-iniciais">
            <button className="frota-btn-opcao" onClick={() => setShowCriarEmpresa(true)}>
              <span className="frota-btn-emoji">🏢</span>
              <span className="frota-btn-titulo">Criar Empresa</span>
              <span className="frota-btn-desc">Cadastre sua empresa para gerenciar motoristas vinculados</span>
            </button>
            
            <button className="frota-btn-opcao" onClick={() => {
              setNovoMotorista(prev => ({ ...prev, tipoMotorista: 'AUTONOMO' }));
              setShowCriarMotorista(true);
            }}>
              <span className="frota-btn-emoji">🚴</span>
              <span className="frota-btn-titulo">Motorista Autônomo</span>
              <span className="frota-btn-desc">Cadastre motorista autônomo sem vínculo empresarial</span>
            </button>
          </div>
        </div>

        {/* Modal Criar Empresa */}
        {showCriarEmpresa && (
          <div className="frota-modal-overlay" onClick={() => setShowCriarEmpresa(false)}>
            <div className="frota-modal" onClick={e => e.stopPropagation()}>
              <h2>🏢 Criar Nova Empresa</h2>
              
              <div className="frota-form-group">
                <label>Nome da Empresa *</label>
                <input
                  type="text"
                  value={novaEmpresa.nome}
                  onChange={e => setNovaEmpresa(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Transportadora XYZ"
                />
              </div>

              <div className="frota-form-group">
                <label>CNPJ</label>
                <input
                  type="text"
                  value={novaEmpresa.cnpj}
                  onChange={e => setNovaEmpresa(prev => ({ ...prev, cnpj: e.target.value }))}
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div className="frota-form-group">
                <label>Endereço Base</label>
                <input
                  type="text"
                  value={novaEmpresa.baseEndereco}
                  onChange={e => setNovaEmpresa(prev => ({ ...prev, baseEndereco: e.target.value }))}
                  placeholder="Rua, número, bairro, cidade"
                />
              </div>

              <div className="frota-form-group">
                <label>Modo de Distribuição</label>
                <select
                  value={novaEmpresa.modoDistribuicao}
                  onChange={e => setNovaEmpresa(prev => ({ ...prev, modoDistribuicao: e.target.value as any }))}
                >
                  <option value="AUTOMATICO">Automático (IA distribui)</option>
                  <option value="MANUAL">Manual (você distribui)</option>
                  <option value="HIBRIDO">Híbrido (IA sugere, você confirma)</option>
                </select>
              </div>

              <div className="frota-modal-actions">
                <button 
                  className="frota-btn-secondary" 
                  onClick={() => setShowCriarEmpresa(false)}
                  disabled={criandoEmpresa}
                >
                  Cancelar
                </button>
                <button 
                  className="frota-btn-primary" 
                  onClick={handleCriarEmpresa}
                  disabled={criandoEmpresa}
                >
                  {criandoEmpresa ? 'Criando...' : 'Criar Empresa'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Criar Motorista */}
        {showCriarMotorista && (
          <div className="frota-modal-overlay" onClick={() => setShowCriarMotorista(false)}>
            <div className="frota-modal" onClick={e => e.stopPropagation()}>
              <h2>🚚 Adicionar Motorista</h2>
              
              <div className="frota-form-group">
                <label>Tipo de Motorista *</label>
                <select
                  value={novoMotorista.tipoMotorista}
                  onChange={e => setNovoMotorista(prev => ({ ...prev, tipoMotorista: e.target.value as any }))}
                >
                  <option value="VINCULADO">Vinculado à Empresa</option>
                  <option value="AUTONOMO">Autônomo</option>
                  <option value="AUTONOMO_PARCEIRO">Autônomo Parceiro</option>
                </select>
                <small className="frota-form-hint">
                  {novoMotorista.tipoMotorista === 'VINCULADO' 
                    ? 'Motorista que trabalha exclusivamente para sua empresa'
                    : novoMotorista.tipoMotorista === 'AUTONOMO'
                    ? 'Motorista independente que faz entregas avulsas'
                    : 'Motorista autônomo com parceria preferencial'}
                </small>
              </div>

              {novoMotorista.tipoMotorista === 'VINCULADO' && !empresaId && (
                <div className="frota-alert frota-alert-warning">
                  ⚠️ Você precisa criar uma empresa primeiro para adicionar motoristas vinculados.
                  <button 
                    className="frota-btn-link"
                    onClick={() => {
                      setShowCriarMotorista(false);
                      setShowCriarEmpresa(true);
                    }}
                  >
                    Criar Empresa
                  </button>
                </div>
              )}

              <div className="frota-form-group">
                <label>Nome *</label>
                <input
                  type="text"
                  value={novoMotorista.nome}
                  onChange={e => setNovoMotorista(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome completo"
                />
              </div>

              <div className="frota-form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={novoMotorista.email}
                  onChange={e => setNovoMotorista(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                />
              </div>

              <div className="frota-form-group">
                <label>Telefone *</label>
                <input
                  type="tel"
                  value={novoMotorista.telefone}
                  onChange={e => setNovoMotorista(prev => ({ ...prev, telefone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div className="frota-form-group">
                <label>CPF</label>
                <input
                  type="text"
                  value={novoMotorista.cpf}
                  onChange={e => setNovoMotorista(prev => ({ ...prev, cpf: e.target.value }))}
                  placeholder="000.000.000-00"
                />
              </div>

              <div className="frota-modal-actions">
                <button 
                  className="frota-btn-secondary" 
                  onClick={() => setShowCriarMotorista(false)}
                  disabled={criandoMotorista}
                >
                  Cancelar
                </button>
                <button 
                  className="frota-btn-primary" 
                  onClick={handleCriarMotorista}
                  disabled={criandoMotorista || (novoMotorista.tipoMotorista === 'VINCULADO' && !empresaId)}
                >
                  {criandoMotorista ? 'Criando...' : 'Adicionar Motorista'}
                </button>
              </div>
            </div>
          </div>
        )}
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
        <button className="frota-btn-icon" onClick={() => irPara('home')}>
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
