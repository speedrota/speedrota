/**
 * @fileoverview Componente App Principal
 */

import { useRouteStore } from './store/routeStore';
import { TelaHome } from './components/TelaHome';
import { TelaOrigem } from './components/TelaOrigem';
import { TelaDestinos } from './components/TelaDestinos';
import { TelaRota } from './components/TelaRota';
import './styles/global.css';

const TITULOS: Record<string, string> = {
  home: 'SpeedRota',
  origem: 'Definir Origem',
  destinos: 'Adicionar Destinos',
  rota: 'Rota Otimizada',
  navegacao: 'Navegação',
};

export default function App() {
  const { etapaAtual, irPara, origem } = useRouteStore();
  
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
  
  return (
    <div className="app">
      {/* Header */}
      {etapaAtual !== 'home' && (
        <header className="header">
          <button className="header-back" onClick={handleVoltar}>
            ←
          </button>
          <h1 className="header-title">{TITULOS[etapaAtual]}</h1>
        </header>
      )}
      
      {/* Conteúdo principal */}
      <main className="main">
        {etapaAtual === 'home' && <TelaHome />}
        {etapaAtual === 'origem' && <TelaOrigem />}
        {etapaAtual === 'destinos' && <TelaDestinos />}
        {etapaAtual === 'rota' && <TelaRota />}
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
    </div>
  );
}
