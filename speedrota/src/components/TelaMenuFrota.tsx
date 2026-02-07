/**
 * @fileoverview Menu intermediário de Gestão de Frota
 * 
 * DESIGN POR CONTRATO:
 * @pre Usuário autenticado como GESTOR_FROTA
 * @post Exibe menu com 4 opções: Adicionar/Acessar Empresa/Motorista
 */

import { useState } from 'react';
import { useRouteStore } from '../store/routeStore';
import { useAuthStore } from '../store/authStore';
import { API_URL } from '../config';
import '../styles/menu-frota.css';

type TipoMotorista = 'AUTONOMO' | 'VINCULADO';

interface Empresa {
  id: string;
  nome: string;
  cnpj?: string;
  email: string;
}

interface Motorista {
  id: string;
  nome: string;
  email: string;
  tipoMotorista: TipoMotorista;
  empresa?: { nome: string };
}

export default function TelaMenuFrota() {
  const irPara = useRouteStore((state) => state.irPara);
  const { user } = useAuthStore();
  
  // Estados para modais
  const [modalAdicionarEmpresa, setModalAdicionarEmpresa] = useState(false);
  const [modalAdicionarMotorista, setModalAdicionarMotorista] = useState(false);
  const [modalAcessarEmpresa, setModalAcessarEmpresa] = useState(false);
  const [modalAcessarMotorista, setModalAcessarMotorista] = useState(false);
  
  // Estados do formulário de empresa
  const [empresaNome, setEmpresaNome] = useState('');
  const [empresaCnpj, setEmpresaCnpj] = useState('');
  const [empresaEmail, setEmpresaEmail] = useState('');
  const [empresaTelefone, setEmpresaTelefone] = useState('');
  
  // Estados do formulário de motorista
  const [motoristaNome, setMotoristaNome] = useState('');
  const [motoristaEmail, setMotoristaEmail] = useState('');
  const [motoristaTelefone, setMotoristaTelefone] = useState('');
  const [motoristaTipo, setMotoristaTipo] = useState<TipoMotorista>('AUTONOMO');
  const [motoristaEmpresaId, setMotoristaEmpresaId] = useState('');
  
  // Estados de listagem
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  
  // Empresas para select do motorista vinculado
  const [empresasSelect, setEmpresasSelect] = useState<Empresa[]>([]);

  const handleVoltar = () => {
    irPara('home');
  };

  // ================================
  // ADICIONAR EMPRESA
  // ================================
  const handleAbrirAdicionarEmpresa = () => {
    setEmpresaNome('');
    setEmpresaCnpj('');
    setEmpresaEmail(user?.email || '');
    setEmpresaTelefone('');
    setErro(null);
    setSucesso(null);
    setModalAdicionarEmpresa(true);
  };

  const handleCriarEmpresa = async () => {
    if (!empresaNome.trim() || !empresaEmail.trim()) {
      setErro('Nome e email são obrigatórios');
      return;
    }

    setCarregando(true);
    setErro(null);

    try {
      const token = localStorage.getItem('speedrota_token');
      const response = await fetch(`${API_URL}/frota/empresa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome: empresaNome.trim(),
          cnpj: empresaCnpj.trim() || undefined,
          email: empresaEmail.trim(),
          telefone: empresaTelefone.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar empresa');
      }

      setSucesso(`Empresa "${data.nome}" criada com sucesso!`);
      setTimeout(() => {
        setModalAdicionarEmpresa(false);
        setSucesso(null);
      }, 2000);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar empresa');
    } finally {
      setCarregando(false);
    }
  };

  // ================================
  // ADICIONAR MOTORISTA
  // ================================
  const handleAbrirAdicionarMotorista = async () => {
    setMotoristaNome('');
    setMotoristaEmail('');
    setMotoristaTelefone('');
    setMotoristaTipo('AUTONOMO');
    setMotoristaEmpresaId('');
    setErro(null);
    setSucesso(null);
    setModalAdicionarMotorista(true);
    
    // Carregar empresas para o select
    try {
      const token = localStorage.getItem('speedrota_token');
      const response = await fetch(`${API_URL}/frota/empresas`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setEmpresasSelect(data);
      }
    } catch (err) {
      console.error('Erro ao carregar empresas:', err);
    }
  };

  const handleCriarMotorista = async () => {
    if (!motoristaNome.trim() || !motoristaEmail.trim() || !motoristaTelefone.trim()) {
      setErro('Nome, email e telefone são obrigatórios');
      return;
    }

    if (motoristaTipo === 'VINCULADO' && !motoristaEmpresaId) {
      setErro('Selecione uma empresa para motorista vinculado');
      return;
    }

    setCarregando(true);
    setErro(null);

    try {
      const token = localStorage.getItem('speedrota_token');
      const endpoint = motoristaTipo === 'AUTONOMO' 
        ? `${API_URL}/frota/motorista/autonomo`
        : `${API_URL}/frota/empresa/${motoristaEmpresaId}/motorista`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome: motoristaNome.trim(),
          email: motoristaEmail.trim(),
          telefone: motoristaTelefone.trim(),
          tipoMotorista: motoristaTipo,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar motorista');
      }

      const tipo = motoristaTipo === 'AUTONOMO' ? 'autônomo' : 'vinculado';
      setSucesso(`Motorista ${tipo} "${data.nome}" criado com sucesso!`);
      setTimeout(() => {
        setModalAdicionarMotorista(false);
        setSucesso(null);
      }, 2000);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar motorista');
    } finally {
      setCarregando(false);
    }
  };

  // ================================
  // ACESSAR EMPRESA
  // ================================
  const handleAbrirAcessarEmpresa = async () => {
    setErro(null);
    setModalAcessarEmpresa(true);
    setCarregando(true);

    try {
      const token = localStorage.getItem('speedrota_token');
      const response = await fetch(`${API_URL}/frota/empresas`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar empresas');
      }

      const data = await response.json();
      setEmpresas(data);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar empresas');
    } finally {
      setCarregando(false);
    }
  };

  const handleSelecionarEmpresa = (empresaId: string) => {
    // Salvar empresa selecionada e ir para dashboard de frota
    localStorage.setItem('speedrota_empresa_selecionada', empresaId);
    setModalAcessarEmpresa(false);
    irPara('frota');
  };

  // ================================
  // ACESSAR MOTORISTA
  // ================================
  const handleAbrirAcessarMotorista = async () => {
    setErro(null);
    setModalAcessarMotorista(true);
    setCarregando(true);

    try {
      const token = localStorage.getItem('speedrota_token');
      // Buscar todos motoristas (autônomos e vinculados)
      const response = await fetch(`${API_URL}/frota/motoristas/todos`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar motoristas');
      }

      const data = await response.json();
      setMotoristas(data);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar motoristas');
    } finally {
      setCarregando(false);
    }
  };

  const handleSelecionarMotorista = (motoristaId: string) => {
    // Salvar motorista selecionado e ir para dashboard
    localStorage.setItem('speedrota_motorista_selecionado', motoristaId);
    setModalAcessarMotorista(false);
    irPara('dashboard');
  };

  return (
    <div className="menu-frota-container">
      {/* Header */}
      <header className="menu-frota-header">
        <button className="btn-voltar" onClick={handleVoltar}>
          ← Voltar
        </button>
        <h1>Gestão de Frota</h1>
      </header>

      {/* Cards de Menu */}
      <div className="menu-frota-grid">
        {/* Adicionar Empresa */}
        <div className="menu-card" onClick={handleAbrirAdicionarEmpresa}>
          <div className="menu-card-icon">🏢</div>
          <h3>Adicionar Empresa</h3>
          <p>Cadastrar nova empresa de transporte</p>
        </div>

        {/* Adicionar Motorista */}
        <div className="menu-card" onClick={handleAbrirAdicionarMotorista}>
          <div className="menu-card-icon">👤</div>
          <h3>Adicionar Motorista</h3>
          <p>Cadastrar motorista autônomo ou vinculado</p>
        </div>

        {/* Acessar Empresa */}
        <div className="menu-card" onClick={handleAbrirAcessarEmpresa}>
          <div className="menu-card-icon">🏭</div>
          <h3>Acessar Empresa</h3>
          <p>Gerenciar empresa existente</p>
        </div>

        {/* Acessar Motorista */}
        <div className="menu-card" onClick={handleAbrirAcessarMotorista}>
          <div className="menu-card-icon">🚚</div>
          <h3>Acessar Motorista</h3>
          <p>Visualizar motorista autônomo ou vinculado</p>
        </div>
      </div>

      {/* ================================ */}
      {/* MODAL: Adicionar Empresa */}
      {/* ================================ */}
      {modalAdicionarEmpresa && (
        <div className="modal-overlay" onClick={() => setModalAdicionarEmpresa(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🏢 Adicionar Empresa</h2>
              <button className="btn-fechar" onClick={() => setModalAdicionarEmpresa(false)}>×</button>
            </div>
            
            <div className="modal-body">
              {erro && <div className="alert alert-error">{erro}</div>}
              {sucesso && <div className="alert alert-success">{sucesso}</div>}
              
              <div className="form-group">
                <label>Nome da Empresa *</label>
                <input
                  type="text"
                  value={empresaNome}
                  onChange={(e) => setEmpresaNome(e.target.value)}
                  placeholder="Ex: Transportes Rápido Ltda"
                />
              </div>
              
              <div className="form-group">
                <label>CNPJ</label>
                <input
                  type="text"
                  value={empresaCnpj}
                  onChange={(e) => setEmpresaCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={empresaEmail}
                  onChange={(e) => setEmpresaEmail(e.target.value)}
                  placeholder="contato@empresa.com.br"
                />
              </div>
              
              <div className="form-group">
                <label>Telefone</label>
                <input
                  type="tel"
                  value={empresaTelefone}
                  onChange={(e) => setEmpresaTelefone(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setModalAdicionarEmpresa(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleCriarEmpresa}
                disabled={carregando}
              >
                {carregando ? 'Criando...' : 'Criar Empresa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================ */}
      {/* MODAL: Adicionar Motorista */}
      {/* ================================ */}
      {modalAdicionarMotorista && (
        <div className="modal-overlay" onClick={() => setModalAdicionarMotorista(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>👤 Adicionar Motorista</h2>
              <button className="btn-fechar" onClick={() => setModalAdicionarMotorista(false)}>×</button>
            </div>
            
            <div className="modal-body">
              {erro && <div className="alert alert-error">{erro}</div>}
              {sucesso && <div className="alert alert-success">{sucesso}</div>}
              
              {/* Tipo de Motorista */}
              <div className="form-group">
                <label>Tipo de Motorista *</label>
                <div className="radio-group">
                  <label className={`radio-option ${motoristaTipo === 'AUTONOMO' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="tipoMotorista"
                      value="AUTONOMO"
                      checked={motoristaTipo === 'AUTONOMO'}
                      onChange={() => setMotoristaTipo('AUTONOMO')}
                    />
                    <span className="radio-label">🚗 Autônomo</span>
                    <span className="radio-desc">Motorista independente</span>
                  </label>
                  
                  <label className={`radio-option ${motoristaTipo === 'VINCULADO' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="tipoMotorista"
                      value="VINCULADO"
                      checked={motoristaTipo === 'VINCULADO'}
                      onChange={() => setMotoristaTipo('VINCULADO')}
                    />
                    <span className="radio-label">🏢 Vinculado a Empresa</span>
                    <span className="radio-desc">Faz parte de uma frota</span>
                  </label>
                </div>
              </div>
              
              {/* Empresa (só para vinculado) */}
              {motoristaTipo === 'VINCULADO' && (
                <div className="form-group">
                  <label>Empresa *</label>
                  <select
                    value={motoristaEmpresaId}
                    onChange={(e) => setMotoristaEmpresaId(e.target.value)}
                  >
                    <option value="">Selecione uma empresa...</option>
                    {empresasSelect.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.nome}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="form-group">
                <label>Nome Completo *</label>
                <input
                  type="text"
                  value={motoristaNome}
                  onChange={(e) => setMotoristaNome(e.target.value)}
                  placeholder="Ex: João da Silva"
                />
              </div>
              
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={motoristaEmail}
                  onChange={(e) => setMotoristaEmail(e.target.value)}
                  placeholder="motorista@email.com"
                />
              </div>
              
              <div className="form-group">
                <label>Telefone *</label>
                <input
                  type="tel"
                  value={motoristaTelefone}
                  onChange={(e) => setMotoristaTelefone(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setModalAdicionarMotorista(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleCriarMotorista}
                disabled={carregando}
              >
                {carregando ? 'Criando...' : 'Criar Motorista'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================ */}
      {/* MODAL: Acessar Empresa */}
      {/* ================================ */}
      {modalAcessarEmpresa && (
        <div className="modal-overlay" onClick={() => setModalAcessarEmpresa(false)}>
          <div className="modal-content modal-lista" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🏭 Selecionar Empresa</h2>
              <button className="btn-fechar" onClick={() => setModalAcessarEmpresa(false)}>×</button>
            </div>
            
            <div className="modal-body">
              {erro && <div className="alert alert-error">{erro}</div>}
              
              {carregando ? (
                <div className="loading">Carregando empresas...</div>
              ) : empresas.length === 0 ? (
                <div className="empty-state">
                  <p>Nenhuma empresa cadastrada.</p>
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      setModalAcessarEmpresa(false);
                      handleAbrirAdicionarEmpresa();
                    }}
                  >
                    Adicionar Primeira Empresa
                  </button>
                </div>
              ) : (
                <div className="lista-items">
                  {empresas.map((empresa) => (
                    <div 
                      key={empresa.id}
                      className="lista-item"
                      onClick={() => handleSelecionarEmpresa(empresa.id)}
                    >
                      <div className="item-icon">🏢</div>
                      <div className="item-info">
                        <strong>{empresa.nome}</strong>
                        <span>{empresa.cnpj || empresa.email}</span>
                      </div>
                      <div className="item-arrow">→</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================ */}
      {/* MODAL: Acessar Motorista */}
      {/* ================================ */}
      {modalAcessarMotorista && (
        <div className="modal-overlay" onClick={() => setModalAcessarMotorista(false)}>
          <div className="modal-content modal-lista" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🚚 Selecionar Motorista</h2>
              <button className="btn-fechar" onClick={() => setModalAcessarMotorista(false)}>×</button>
            </div>
            
            <div className="modal-body">
              {erro && <div className="alert alert-error">{erro}</div>}
              
              {carregando ? (
                <div className="loading">Carregando motoristas...</div>
              ) : motoristas.length === 0 ? (
                <div className="empty-state">
                  <p>Nenhum motorista cadastrado.</p>
                  <button 
                    className="btn btn-primary"
                    onClick={() => {
                      setModalAcessarMotorista(false);
                      handleAbrirAdicionarMotorista();
                    }}
                  >
                    Adicionar Primeiro Motorista
                  </button>
                </div>
              ) : (
                <div className="lista-items">
                  {motoristas.map((motorista) => (
                    <div 
                      key={motorista.id}
                      className="lista-item"
                      onClick={() => handleSelecionarMotorista(motorista.id)}
                    >
                      <div className="item-icon">
                        {motorista.tipoMotorista === 'AUTONOMO' ? '🚗' : '🚚'}
                      </div>
                      <div className="item-info">
                        <strong>{motorista.nome}</strong>
                        <span>
                          {motorista.tipoMotorista === 'AUTONOMO' 
                            ? 'Autônomo' 
                            : `Vinculado: ${motorista.empresa?.nome || '—'}`}
                        </span>
                      </div>
                      <div className="item-badge">
                        {motorista.tipoMotorista === 'AUTONOMO' ? '🚗' : '🏢'}
                      </div>
                      <div className="item-arrow">→</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
