/**
 * @fileoverview Tela de Histórico de Rotas
 * 
 * DESIGN POR CONTRATO:
 * @pre Usuário autenticado
 * @post Exibe histórico de rotas do usuário
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

export default function TelaHistorico({ onFechar, onCarregarRota }: TelaHistoricoProps) {
  const { rotasHistorico, carregarHistorico, carregando } = useRouteStore();
  const { isAuthenticated } = useAuthStore();
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  
  useEffect(() => {
    if (isAuthenticated) {
      carregarHistorico();
    }
  }, [isAuthenticated, carregarHistorico]);
  
  const rotasFiltradas = filtroStatus 
    ? rotasHistorico.filter(r => r.status === filtroStatus)
    : rotasHistorico;
  
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
          <select 
            value={filtroStatus} 
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="filtro-select"
          >
            <option value="">Todos os status</option>
            <option value="RASCUNHO">Rascunho</option>
            <option value="CALCULADA">Calculada</option>
            <option value="EM_ANDAMENTO">Em andamento</option>
            <option value="FINALIZADA">Finalizada</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
          
          <span className="total-rotas">
            {rotasFiltradas.length} rota{rotasFiltradas.length !== 1 ? 's' : ''}
          </span>
        </div>
        
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
