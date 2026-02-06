/**
 * @fileoverview Tela de Planos e Upgrade
 * 
 * Atualizado com novos planos conforme análise competitiva (Fev/2026)
 * - Planos Individuais: FREE, STARTER, PRO, FULL
 * - Planos Frota: FROTA_START, FROTA_PRO, FROTA_ENTERPRISE
 * - Sistema de promoções (FROTA60, MIGRACAOVUUPT, ANUAL25)
 * 
 * @see SpeedRota_Pricing_Brasil_Revisado.docx
 */

import { useState } from 'react';
import { pagamentoService } from '../services/pagamentos';
import { useAuthStore } from '../store/authStore';
import { PLANOS_CONFIG, PROMOCOES, type Plano } from '../types';
import './TelaPlanos.css';

interface TelaplanosProps {
  onClose: () => void;
}

type CategoriaPlano = 'individual' | 'frota';

export function TelaPlanos({ onClose }: TelaplanosProps) {
  const [categoria, setCategoria] = useState<CategoriaPlano>('individual');
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [cupomCodigo, setCupomCodigo] = useState('');
  const [cupomAplicado, setCupomAplicado] = useState<string | null>(null);
  const [descontoAtivo, setDescontoAtivo] = useState<number>(0);
  
  const { user } = useAuthStore();
  
  // Planos organizados por categoria
  const planosIndividuais: Plano[] = ['FREE', 'STARTER', 'PRO', 'FULL'];
  const planosFrota: Plano[] = ['FROTA_START', 'FROTA_PRO', 'FROTA_ENTERPRISE'];
  
  const planosAtuais = categoria === 'individual' ? planosIndividuais : planosFrota;
  
  const aplicarCupom = () => {
    const promo = Object.values(PROMOCOES).find(p => 
      p.codigo.toUpperCase() === cupomCodigo.toUpperCase() && p.ativo
    );
    
    if (promo) {
      setCupomAplicado(promo.codigo);
      setDescontoAtivo(promo.desconto);
      setErro(null);
    } else {
      setErro('Cupom inválido ou expirado');
      setCupomAplicado(null);
      setDescontoAtivo(0);
    }
  };
  
  const calcularPrecoComDesconto = (preco: number): number => {
    if (descontoAtivo > 0) {
      return preco * (1 - descontoAtivo / 100);
    }
    return preco;
  };
  
  const handleUpgrade = async (planoId: Plano) => {
    if (planoId === 'FREE' || planoId === user?.plano) return;
    
    setProcessando(planoId);
    setErro(null);
    
    try {
      const { initPoint } = await pagamentoService.criarPreferencia(planoId as any);
      window.location.href = initPoint;
    } catch (error: any) {
      setErro(error.message || 'Erro ao iniciar pagamento');
      setProcessando(null);
    }
  };
  
  const planoAtual = (user?.plano || 'FREE') as Plano;
  
  return (
    <div className="planos-overlay" onClick={onClose}>
      <div className="planos-modal planos-modal--large" onClick={(e) => e.stopPropagation()}>
        <button className="planos-close" onClick={onClose}>✕</button>
        
        <div className="planos-header">
          <h2>🚀 Escolha seu Plano</h2>
          <p>60-70% mais barato que qualquer concorrente brasileiro</p>
        </div>
        
        {/* Tabs de categoria */}
        <div className="planos-tabs">
          <button 
            className={`planos-tab ${categoria === 'individual' ? 'active' : ''}`}
            onClick={() => setCategoria('individual')}
          >
            🏍️ Para Entregadores
          </button>
          <button 
            className={`planos-tab ${categoria === 'frota' ? 'active' : ''}`}
            onClick={() => setCategoria('frota')}
          >
            🚚 Para Transportadoras
          </button>
        </div>
        
        {/* Banner de promoção para Frota */}
        {categoria === 'frota' && (
          <div className="promo-banner">
            <span className="promo-badge">🔥 LANÇAMENTO</span>
            <strong>FROTA60:</strong> 60% OFF nos primeiros 3 meses!
            <span className="promo-code">Use: FROTA60</span>
          </div>
        )}
        
        {erro && (
          <div className="planos-erro">
            ⚠️ {erro}
          </div>
        )}
        
        {/* Cupom de desconto */}
        <div className="cupom-section">
          <input 
            type="text" 
            placeholder="Código promocional"
            value={cupomCodigo}
            onChange={(e) => setCupomCodigo(e.target.value.toUpperCase())}
            className="cupom-input"
          />
          <button onClick={aplicarCupom} className="cupom-btn">
            Aplicar
          </button>
          {cupomAplicado && (
            <span className="cupom-sucesso">✓ {descontoAtivo}% de desconto aplicado!</span>
          )}
        </div>
        
        <div className="planos-grid">
          {planosAtuais.map((planoId) => {
            const config = PLANOS_CONFIG[planoId];
            const isAtual = planoId === planoAtual;
            const precoOriginal = config.preco;
            const precoFinal = calcularPrecoComDesconto(precoOriginal);
            const temDesconto = precoFinal < precoOriginal;
            
            // Determinar destaque
            const isPopular = planoId === 'PRO' || planoId === 'FROTA_PRO';
            const isMelhorValor = planoId === 'FULL' || planoId === 'FROTA_ENTERPRISE';
            
            return (
              <div 
                key={planoId} 
                className={`plano-card ${isAtual ? 'atual' : ''} ${isPopular ? 'popular' : ''} ${isMelhorValor ? 'melhor-valor' : ''}`}
              >
                {isPopular && <div className="plano-badge">⭐ Mais Popular</div>}
                {isMelhorValor && <div className="plano-badge melhor">💎 Melhor Custo-Benefício</div>}
                {isAtual && <div className="plano-badge atual">✓ Seu Plano</div>}
                
                <h3 className="plano-nome">{config.nome}</h3>
                
                <div className="plano-preco">
                  {temDesconto && (
                    <span className="preco-riscado">R$ {precoOriginal.toFixed(2)}</span>
                  )}
                  <span className="preco-valor">
                    {precoFinal === 0 ? 'Grátis' : `R$ ${precoFinal.toFixed(2)}`}
                  </span>
                  {precoFinal > 0 && <span className="preco-periodo">/mês</span>}
                </div>
                
                {config.maxMotoristas && (
                  <div className="plano-motoristas">
                    👥 Até {config.maxMotoristas === 999 ? 'ilimitados' : config.maxMotoristas} motoristas
                  </div>
                )}
                
                <ul className="plano-recursos">
                  {config.features.map((recurso, idx) => (
                    <li key={idx}>✓ {recurso}</li>
                  ))}
                </ul>
                
                <button
                  className={`plano-btn ${isAtual ? 'atual' : ''}`}
                  onClick={() => handleUpgrade(planoId)}
                  disabled={isAtual || planoId === 'FREE' || processando !== null}
                >
                  {processando === planoId ? (
                    <span className="loading-spinner">⏳</span>
                  ) : isAtual ? (
                    'Plano Atual'
                  ) : planoId === 'FREE' ? (
                    'Plano Gratuito'
                  ) : (
                    `Assinar ${config.nome}`
                  )}
                </button>
              </div>
            );
          })}
        </div>
        
        {/* Comparativo com concorrentes para Frota */}
        {categoria === 'frota' && (
          <div className="comparativo-section">
            <h4>💰 Compare com a concorrência</h4>
            <table className="comparativo-table">
              <thead>
                <tr>
                  <th>5 motoristas</th>
                  <th>SpeedRota</th>
                  <th>Vuupt</th>
                  <th>Economia</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Preço/mês</td>
                  <td className="destaque">R$ 299</td>
                  <td>R$ 1.000+</td>
                  <td className="economia">70% OFF</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        
        <div className="planos-footer">
          <p>💳 Pagamento seguro via Mercado Pago (PIX, Cartão, Boleto)</p>
          <p>🔒 Cancele quando quiser • 30 dias de garantia</p>
          <p>📞 Dúvidas? contato@speedrota.com.br</p>
        </div>
      </div>
    </div>
  );
}

export default TelaPlanos;
