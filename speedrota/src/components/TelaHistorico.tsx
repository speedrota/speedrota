/**
 * @fileoverview Tela de Histórico de Rotas
 * 
 * DESIGN POR CONTRATO:
 * @description Modal de histórico com filtros avançados e exportação
 * @pre Usuário autenticado
 * @post Exibe histórico de rotas com métricas e permite export PDF/Excel
 */

import { useEffect, useState } from 'react';
import { useRouteStore } from '../store/routeStore';
import { useAuthStore } from '../store/authStore';
import { FORNECEDORES_CONFIG, type Fornecedor } from '../types';
import type { RotaAPI } from '../services/rotas';
import './TelaHistorico.css';

interface TelaHistoricoProps {
  onFechar: () => void;
  onCarregarRota: (rotaId: string) => void;
}

interface ResumoAPI {
  totais: {
    rotas: number;
    paradas: number;
    entregasRealizadas: number;
    taxaSucesso: number;
  };
  distancia: { totalKm: number };
  tempo: { totalMin: number };
  custo: { totalR: number };
}

export default function TelaHistorico({ onFechar, onCarregarRota }: TelaHistoricoProps) {
  const { rotasHistorico, carregarHistorico, carregando } = useRouteStore();
  const { isAuthenticated, token } = useAuthStore();
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  const [filtroFornecedor, setFiltroFornecedor] = useState<string>('');
  const [dataInicio, setDataInicio] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dataFim, setDataFim] = useState<string>(() => 
    new Date().toISOString().split('T')[0]
  );
  const [resumo, setResumo] = useState<ResumoAPI | null>(null);
  const [exportando, setExportando] = useState<'pdf' | 'excel' | null>(null);
  const [fornecedores, setFornecedores] = useState<string[]>([]);
  
  useEffect(() => {
    if (isAuthenticated) {
      carregarHistorico();
      carregarFornecedores();
      carregarResumo();
    }
  }, [isAuthenticated, carregarHistorico]);
  
  // Aplicar todos os filtros
  const rotasFiltradas = rotasHistorico.filter(r => {
    // Filtro por status
    if (filtroStatus && r.status !== filtroStatus) return false;
    // Filtro por fornecedor
    if (filtroFornecedor) {
      const fornecedoresRota = r.paradas.map(p => p.fornecedor);
      if (!fornecedoresRota.includes(filtroFornecedor as string)) return false;
    }
    // Filtro por data
    const rotaData = new Date(r.createdAt);
    if (dataInicio && rotaData < new Date(dataInicio)) return false;
    if (dataFim && rotaData > new Date(dataFim + 'T23:59:59')) return false;
    return true;
  });

  // Carregar lista de fornecedores únicos
  async function carregarFornecedores() {
    try {
      const res = await fetch('/api/v1/historico/fornecedores', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setFornecedores(data.data.fornecedores);
      }
    } catch (err) {
      console.error('Erro ao carregar fornecedores:', err);
    }
  }

  // Carregar resumo do período
  async function carregarResumo() {
    try {
      const params = new URLSearchParams({ dataInicio, dataFim });
      const res = await fetch(`/api/v1/historico/resumo?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setResumo(data.data);
      }
    } catch (err) {
      console.error('Erro ao carregar resumo:', err);
    }
  }

  // Exportar para PDF
  async function exportarPDF() {
    setExportando('pdf');
    try {
      const params = new URLSearchParams({ dataInicio, dataFim });
      if (filtroFornecedor) params.append('fornecedor', filtroFornecedor);
      
      const res = await fetch(`/api/v1/historico/export/pdf?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) throw new Error('Erro ao gerar PDF');
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `speedrota-relatorio-${dataInicio}-${dataFim}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      alert('Erro ao gerar PDF');
    } finally {
      setExportando(null);
    }
  }

  // Exportar para Excel
  async function exportarExcel() {
    setExportando('excel');
    try {
      const params = new URLSearchParams({ dataInicio, dataFim });
      if (filtroFornecedor) params.append('fornecedor', filtroFornecedor);
      
      const res = await fetch(`/api/v1/historico/export/excel?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) throw new Error('Erro ao gerar Excel');
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `speedrota-historico-${dataInicio}-${dataFim}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      alert('Erro ao gerar Excel');
    } finally {
      setExportando(null);
    }
  }

  // Função auxiliar para formatar tempo (reservada para uso futuro)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _formatarTempo = (minutos: number): string => {
    if (minutos < 60) return `${Math.round(minutos)}min`;
    const h = Math.floor(minutos / 60);
    const m = Math.round(minutos % 60);
    return `${h}h${m}m`;
  };
  
  const formatarData = (dataStr: string) => {
    const data = new Date(dataStr);
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  const getStatusLabel = (status: string) => {
    const labels: Record<string, { texto: string; cor: string }> = {
      RASCUNHO: { texto: 'Rascunho', cor: '#6b7280' },
      CALCULADA: { texto: 'Calculada', cor: '#3b82f6' },
      EM_ANDAMENTO: { texto: 'Em andamento', cor: '#f59e0b' },
      FINALIZADA: { texto: 'Finalizada', cor: '#10b981' },
      CANCELADA: { texto: 'Cancelada', cor: '#ef4444' },
    };
    return labels[status] || { texto: status, cor: '#6b7280' };
  };
  
  const getFornecedoresRota = (rota: RotaAPI): Fornecedor[] => {
    const fornecedores = new Set<Fornecedor>();
    rota.paradas.forEach(p => {
      if (p.fornecedor) fornecedores.add(p.fornecedor);
    });
    return Array.from(fornecedores);
  };
  
  if (!isAuthenticated) {
    return (
      <div className="historico-overlay">
        <div className="historico-modal">
          <header className="historico-header">
            <h2>📜 Histórico de Rotas</h2>
            <button className="btn-fechar" onClick={onFechar}>✕</button>
          </header>
          <div className="historico-vazio">
            <p>🔒 Faça login para ver seu histórico de rotas</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="historico-overlay">
      <div className="historico-modal">
        <header className="historico-header">
          <h2>📜 Histórico de Rotas</h2>
          <button className="btn-fechar" onClick={onFechar}>✕</button>
        </header>
        
        {/* Filtros */}
        <div className="historico-filtros">
          <div className="filtros-linha">
            <div className="filtro-grupo">
              <label>Data Início</label>
              <input 
                type="date" 
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="filtro-input"
              />
            </div>
            <div className="filtro-grupo">
              <label>Data Fim</label>
              <input 
                type="date" 
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="filtro-input"
              />
            </div>
            <div className="filtro-grupo">
              <label>Status</label>
              <select 
                value={filtroStatus} 
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="filtro-select"
              >
                <option value="">Todos</option>
                <option value="CALCULADA">Calculada</option>
                <option value="EM_ANDAMENTO">Em andamento</option>
                <option value="FINALIZADA">Finalizada</option>
                <option value="CANCELADA">Cancelada</option>
              </select>
            </div>
            <div className="filtro-grupo">
              <label>Fornecedor</label>
              <select 
                value={filtroFornecedor} 
                onChange={(e) => setFiltroFornecedor(e.target.value)}
                className="filtro-select"
              >
                <option value="">Todos</option>
                {fornecedores.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="filtros-acoes">
            <button 
              className="btn-export btn-pdf" 
              onClick={exportarPDF}
              disabled={exportando !== null}
            >
              {exportando === 'pdf' ? '⏳' : '📄'} PDF
            </button>
            <button 
              className="btn-export btn-excel" 
              onClick={exportarExcel}
              disabled={exportando !== null}
            >
              {exportando === 'excel' ? '⏳' : '📊'} Excel
            </button>
            <span className="total-rotas">
              {rotasFiltradas.length} rota{rotasFiltradas.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        
        {/* Resumo do Período */}
        {resumo && (
          <div className="historico-resumo">
            <div className="resumo-card">
              <span className="resumo-icon">🚚</span>
              <span className="resumo-valor">{resumo.totais.rotas}</span>
              <span className="resumo-label">Rotas</span>
            </div>
            <div className="resumo-card">
              <span className="resumo-icon">📦</span>
              <span className="resumo-valor">{resumo.totais.entregasRealizadas}</span>
              <span className="resumo-label">Entregas</span>
            </div>
            <div className="resumo-card">
              <span className="resumo-icon">✅</span>
              <span className="resumo-valor">{resumo.totais.taxaSucesso}%</span>
              <span className="resumo-label">Sucesso</span>
            </div>
            <div className="resumo-card">
              <span className="resumo-icon">📍</span>
              <span className="resumo-valor">{resumo.distancia.totalKm.toFixed(0)}</span>
              <span className="resumo-label">Km</span>
            </div>
            <div className="resumo-card destaque">
              <span className="resumo-icon">💰</span>
              <span className="resumo-valor">R$ {resumo.custo.totalR.toFixed(0)}</span>
              <span className="resumo-label">Custo</span>
            </div>
          </div>
        )}
        
        {/* Lista */}
        <div className="historico-lista">
          {carregando ? (
            <div className="historico-loading">
              <div className="spinner" />
              <p>Carregando rotas...</p>
            </div>
          ) : rotasFiltradas.length === 0 ? (
            <div className="historico-vazio">
              <p>📭 Nenhuma rota encontrada</p>
              {!filtroStatus && (
                <p className="texto-secundario">
                  Crie sua primeira rota para começar!
                </p>
              )}
            </div>
          ) : (
            rotasFiltradas.map((rota) => {
              const status = getStatusLabel(rota.status);
              const fornecedores = getFornecedoresRota(rota);
              
              return (
                <article 
                  key={rota.id} 
                  className="historico-card"
                  onClick={() => onCarregarRota(rota.id)}
                >
                  <div className="card-header">
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: status.cor }}
                    >
                      {status.texto}
                    </span>
                    <time className="data-criacao">
                      {formatarData(rota.createdAt)}
                    </time>
                  </div>
                  
                  <div className="card-body">
                    <p className="origem-texto" title={rota.origemEndereco}>
                      📍 {rota.origemEndereco.substring(0, 50)}
                      {rota.origemEndereco.length > 50 ? '...' : ''}
                    </p>
                    
                    <div className="metricas-resumo">
                      <span>🚐 {rota.paradas.length} parada{rota.paradas.length !== 1 ? 's' : ''}</span>
                      {rota.distanciaTotalKm && (
                        <span>📏 {rota.distanciaTotalKm.toFixed(1)} km</span>
                      )}
                      {rota.tempoViagemMin && (
                        <span>⏱️ {Math.round(rota.tempoViagemMin)} min</span>
                      )}
                    </div>
                    
                    {fornecedores.length > 0 && (
                      <div className="fornecedores-lista">
                        {fornecedores.slice(0, 5).map((f) => {
                          const config = FORNECEDORES_CONFIG[f];
                          return (
                            <span 
                              key={f}
                              className="fornecedor-tag"
                              style={{ backgroundColor: config?.cor || '#6b7280' }}
                              title={config?.nome || f}
                            >
                              {config?.emoji || '📦'}
                            </span>
                          );
                        })}
                        {fornecedores.length > 5 && (
                          <span className="fornecedor-mais">
                            +{fornecedores.length - 5}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="card-footer">
                    <button className="btn-abrir">
                      Abrir →
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
