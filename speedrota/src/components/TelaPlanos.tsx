/**
 * @fileoverview Tela de Planos e Upgrade
 */

import { useState, useEffect } from 'react';
import { pagamentoService, type PlanoInfo } from '../services/pagamentos';
import { useAuthStore } from '../store/authStore';
import './TelaPlanos.css';

interface TelaplanosProps {
  onClose: () => void;
}

export function TelaPlanos({ onClose }: TelaplanosProps) {
  const [planos, setPlanos] = useState<PlanoInfo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  
  const { user } = useAuthStore();
  
  useEffect(() => {
    carregarPlanos();
  }, []);
  
  const carregarPlanos = async () => {
    try {
      const data = await pagamentoService.listarPlanos();
      setPlanos(data);
    } catch (error: any) {
      setErro('Erro ao carregar planos');
    } finally {
      setCarregando(false);
    }
  };
  
  const handleUpgrade = async (planoId: string) => {
    if (planoId === 'FREE' || planoId === user?.plano) return;
    
    setProcessando(planoId);
    setErro(null);
    
    try {
      const { initPoint } = await pagamentoService.criarPreferencia(planoId as 'PRO' | 'FULL');
      
      // Redirecionar para o checkout do Mercado Pago
      window.location.href = initPoint;
    } catch (error: any) {
      setErro(error.message || 'Erro ao iniciar pagamento');
      setProcessando(null);
    }
  };
  
  const planoAtual = user?.plano || 'FREE';
  
  if (carregando) {
    return (
      <div className="planos-overlay">
        <div className="planos-modal">
          <div className="planos-loading">
            <span className="loading-spinner">⏳</span>
            <p>Carregando planos...</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="planos-overlay" onClick={onClose}>
      <div className="planos-modal" onClick={(e) => e.stopPropagation()}>
        <button className="planos-close" onClick={onClose}>✕</button>
        
        <div className="planos-header">
          <h2>🚀 Escolha seu Plano</h2>
          <p>Otimize mais entregas com o plano certo para você</p>
        </div>
        
        {erro && (
          <div className="planos-erro">
            ⚠️ {erro}
          </div>
        )}
        
        <div className="planos-grid">
          {planos.map((plano) => {
            const isAtual = plano.id === planoAtual;
            const isDowngrade = 
              (planoAtual === 'FULL' && plano.id !== 'FULL') ||
              (planoAtual === 'PRO' && plano.id === 'FREE');
            
            return (
              <div 
                key={plano.id} 
                className={`plano-card ${isAtual ? 'atual' : ''} ${plano.popular ? 'popular' : ''}`}
              >
                {plano.popular && <div className="plano-badge">⭐ Mais Popular</div>}
                {isAtual && <div className="plano-badge atual">✓ Seu Plano</div>}
                
                <h3 className="plano-nome">{plano.nome}</h3>
                
                <div className="plano-preco">
                  <span className="preco-valor">{plano.precoFormatado}</span>
                  {plano.preco > 0 && <span className="preco-periodo">/mês</span>}
                </div>
                
                <ul className="plano-recursos">
                  {plano.recursos.map((recurso, idx) => (
                    <li key={idx}>✓ {recurso}</li>
                  ))}
                </ul>
                
                <button
                  className={`plano-btn ${isAtual ? 'atual' : ''} ${isDowngrade ? 'downgrade' : ''}`}
                  onClick={() => handleUpgrade(plano.id)}
                  disabled={isAtual || isDowngrade || processando !== null}
                >
                  {processando === plano.id ? (
                    <span className="loading-spinner">⏳</span>
                  ) : isAtual ? (
                    'Plano Atual'
                  ) : isDowngrade ? (
                    'Não disponível'
                  ) : plano.id === 'FREE' ? (
                    'Plano Gratuito'
                  ) : (
                    `Assinar ${plano.nome}`
                  )}
                </button>
              </div>
            );
          })}
        </div>
        
        <div className="planos-footer">
          <p>💳 Pagamento seguro via Mercado Pago</p>
          <p>🔒 Cancele quando quiser</p>
        </div>
      </div>
    </div>
  );
}

export default TelaPlanos;
