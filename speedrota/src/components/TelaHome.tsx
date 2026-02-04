/**
 * @fileoverview Tela Home
 */

import { useRouteStore } from '../store/routeStore';

interface TelaHomeProps {
  onAbrirHistorico?: () => void;
}

export function TelaHome({ onAbrirHistorico }: TelaHomeProps) {
  const novaRota = useRouteStore((state) => state.novaRota);
  const carregarHistorico = useRouteStore((state) => state.carregarHistorico);
  
  const handleNovaRota = () => {
    novaRota();
  };
  
  const handleHistorico = () => {
    if (onAbrirHistorico) {
      onAbrirHistorico();
    } else {
      // Fallback: carregar histórico e mostrar na mesma página
      carregarHistorico();
    }
  };
  
  return (
    <div className="home-hero">
      <div className="home-brand">
        <img src="/logo.png" alt="SpeedRota" className="home-logo" />
      </div>
      <p className="home-subtitle">
        Suas entregas, uma rota inteligente
      </p>
      
      <div className="home-actions">
        <button className="btn btn-primary btn-lg" onClick={handleNovaRota}>
          ➕ Nova Rota
        </button>
        
        <button 
          className="btn btn-secondary" 
          onClick={handleHistorico}
        >
          📋 Histórico de Rotas
        </button>
      </div>
      
      <div className="mt-4 text-sm text-muted">
        <p>✓ Capture origem via GPS ou manualmente</p>
        <p>✓ Extraia destinos de NF-e via OCR</p>
        <p>✓ Calcule a rota mais eficiente</p>
      </div>
    </div>
  );
}
