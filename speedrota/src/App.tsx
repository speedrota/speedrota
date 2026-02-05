/**
 * @fileoverview Componente App Principal
 */

import { useEffect, useState } from 'react';
import { useRouteStore } from './store/routeStore';
import { useAuthStore } from './store/authStore';
import { TelaAuth } from './components/TelaAuth';
import { TelaHome } from './components/TelaHome';
import { TelaOrigem } from './components/TelaOrigem';
import { TelaDestinos } from './components/TelaDestinos';
import { TelaRota } from './components/TelaRota';
import { TelaPlanos } from './components/TelaPlanos';
import { TelaPagamentoRetorno } from './components/TelaPagamentoRetorno';
import TelaHistorico from './components/TelaHistorico';
import { TelaDashboard } from './components/Dashboard';
import TelaFrota from './components/TelaFrota';
import './styles/global.css';
import './styles/frota.css';

const TITULOS: Record<string, string> = {
  home: 'SpeedRota',
  origem: 'Definir Origem',
  destinos: 'Adicionar Destinos',
  rota: 'Rota Otimizada',
  navegacao: 'Navegação',
  dashboard: 'Dashboard Analytics',
  frota: 'Gestão de Frota',
};

// Verificar se é página de retorno do pagamento
function getPagamentoStatus(): 'sucesso' | 'erro' | 'pendente' | null {
  const path = window.location.pathname;
  if (path.includes('/pagamento/sucesso')) return 'sucesso';
  if (path.includes('/pagamento/erro')) return 'erro';
  if (path.includes('/pagamento/pendente')) return 'pendente';
  return null;
}

export default function App() {
  const { etapaAtual, irPara, origem, carregarRota, sincronizando } = useRouteStore();
  const { isAuthenticated, user, logout, loadUser, isLoading } = useAuthStore();
  const [mostrarPlanos, setMostrarPlanos] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [pagamentoStatus, setPagamentoStatus] = useState<'sucesso' | 'erro' | 'pendente' | null>(getPagamentoStatus());
  
  // Carregar usuário ao iniciar
  useEffect(() => {
    loadUser();
  }, [loadUser]);
  
  const handleVoltar = () => {
    switch (etapaAtual) {
      case 'origem':
        irPara('home');
        break;
      case 'destinos':
        irPara('origem');
        break;
      case 'rota':
        irPara('destinos');
        break;
      default:
        irPara('home');
    }
  };
  
  const handleVoltarPagamento = () => {
    // Limpar URL e estado
    window.history.replaceState({}, '', '/');
    setPagamentoStatus(null);
  };
  
  const handleCarregarRota = async (rotaId: string) => {
    setMostrarHistorico(false);
    await carregarRota(rotaId);
  };
  
  // Tela de loading inicial
  if (isLoading && !user) {
    return (
      <div className="app-loading">
        <img src="/logo.png" alt="SpeedRota" style={{ width: 80, height: 80 }} />
        <p>Carregando...</p>
      </div>
    );
  }
  
  // Tela de autenticação
  if (!isAuthenticated) {
    return <TelaAuth />;
  }
  
  // Tela de retorno do pagamento
  if (pagamentoStatus) {
    return (
      <TelaPagamentoRetorno 
        status={pagamentoStatus} 
        onVoltar={handleVoltarPagamento} 
      />
    );
  }
  
  return (
    <div className="app">
      {/* Header */}
      {etapaAtual !== 'home' && etapaAtual !== 'dashboard' && (
        <header className="header">
          <button className="header-back" onClick={handleVoltar}>
            ←
          </button>
          <h1 className="header-title">{TITULOS[etapaAtual]}</h1>
        </header>
      )}
      
      {/* User info bar */}
      {etapaAtual === 'home' && user && (
        <div className="user-bar">
          <div className="user-info">
            <button 
              className="user-plano" 
              data-plano={user.plano}
              onClick={() => setMostrarPlanos(true)}
              title="Ver planos"
            >
              {user.plano === 'FREE' ? '🆓' : user.plano === 'PRO' ? '⭐' : '👑'} {user.plano}
            </button>
            <span className="user-nome">{user.nome}</span>
            {sincronizando && (
              <span className="sync-indicator" title="Sincronizando...">
                🔄
              </span>
            )}
          </div>
          <div className="user-actions">
            <button 
              className="btn-historico"
              onClick={() => setMostrarHistorico(true)}
              title="Histórico de rotas"
            >
              📜
            </button>
            {user.plano === 'FREE' && (
              <button 
                className="btn-upgrade"
                onClick={() => setMostrarPlanos(true)}
              >
                ⚡ Upgrade
              </button>
            )}
            <button className="btn-logout" onClick={logout} title="Sair">
              🚪
            </button>
          </div>
        </div>
      )}
      
      {/* Conteúdo principal */}
      <main className="main">
        {etapaAtual === 'home' && <TelaHome onAbrirHistorico={() => setMostrarHistorico(true)} />}
        {etapaAtual === 'origem' && <TelaOrigem />}
        {etapaAtual === 'destinos' && <TelaDestinos />}
        {etapaAtual === 'rota' && <TelaRota />}
        {etapaAtual === 'dashboard' && <TelaDashboard />}
        {etapaAtual === 'frota' && <TelaFrota />}
      </main>
      
      {/* Footer com info da origem (se definida e não na home) */}
      {origem && etapaAtual !== 'home' && etapaAtual !== 'origem' && (
        <footer style={{
          padding: '0.75rem 1.5rem',
          borderTop: '1px solid var(--gray-200)',
          background: 'var(--gray-50)',
          fontSize: '0.875rem',
          color: 'var(--gray-600)',
        }}>
          <strong>Origem:</strong> {origem.endereco}
        </footer>
      )}
      
      {/* Modal de Planos */}
      {mostrarPlanos && (
        <TelaPlanos onClose={() => setMostrarPlanos(false)} />
      )}
      
      {/* Modal de Histórico */}
      {mostrarHistorico && (
        <TelaHistorico 
          onFechar={() => setMostrarHistorico(false)}
          onCarregarRota={handleCarregarRota}
        />
      )}
    </div>
  );
}
