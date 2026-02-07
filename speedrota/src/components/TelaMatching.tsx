/**
 * @component TelaMatching
 * @description Tela de matching Caixa ↔ NF-e
 * 
 * Fluxo:
 * 1. 📸 Fotografar caixas (etiquetas)
 * 2. 📄 NF-e já carregadas na rota
 * 3. 🔄 Executar matching automático
 * 4. 🏷️ Visualizar IDs visuais para identificação rápida
 * 
 * @pre Destinos já adicionados à rota
 * @post Caixas pareadas com NF-e via tagVisual
 */

import { useState, useRef } from 'react';
import { useRouteStore } from '../store/routeStore';
import { processarImagemNFe } from '../services/ocr';
import './Matching.css';

// Tipos
interface CaixaItem {
  id: string;
  thumb: string;
  status: 'pending' | 'processing' | 'ready' | 'error';
  data?: {
    pedido?: string;
    remessa?: string;
    destinatario?: string;
    cep?: string;
    itens?: number;
    pesoKg?: number;
  };
}

interface MatchResult {
  paradaId: string;
  tagVisual: string;
  tagCor: number;
  matchScore: number;
  destinatario: string;
  endereco: string;
  cep?: string;
  ordem?: number;
  itens?: number;
  pesoKg?: number;
}

type TabType = 'boxes' | 'invoices' | 'results';

// Cores para tags
const CORES = [
  '#f97316', // 1 - Laranja
  '#22c55e', // 2 - Verde
  '#3b82f6', // 3 - Azul
  '#a855f7', // 4 - Roxo
  '#ec4899', // 5 - Pink
  '#eab308', // 6 - Amarelo
  '#14b8a6', // 7 - Teal
  '#f43f5e', // 8 - Vermelho
];

export default function TelaMatching() {
  const { destinos, irPara } = useRouteStore();
  
  const [tab, setTab] = useState<TabType>('boxes');
  const [caixas, setCaixas] = useState<CaixaItem[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // ============================================================
  // HANDLERS
  // ============================================================
  
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const thumb = e.target?.result as string;
        const id = `caixa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Adicionar caixa em status pendente
        setCaixas(prev => [...prev, {
          id,
          thumb,
          status: 'processing'
        }]);
        
        // Processar OCR
        try {
          const resultado = await processarImagemNFe(thumb);
          
          setCaixas(prev => prev.map(c => 
            c.id === id ? {
              ...c,
              status: 'ready',
              data: {
                pedido: undefined, // Será extraído via API
                remessa: undefined,
                destinatario: resultado?.destinatario?.nome,
                cep: resultado?.destinatario?.cep,
                itens: resultado?.volumes,
                pesoKg: resultado?.peso
              }
            } : c
          ));
        } catch (error) {
          console.error('[Matching] Erro OCR:', error);
          setCaixas(prev => prev.map(c => 
            c.id === id ? { ...c, status: 'error' } : c
          ));
        }
      };
      reader.readAsDataURL(file);
    }
    
    // Limpar input
    if (event.target) event.target.value = '';
  };
  
  const handleRemoveCaixa = (id: string) => {
    setCaixas(prev => prev.filter(c => c.id !== id));
  };
  
  const handleExecutarMatch = async () => {
    if (caixas.length === 0 || destinos.length === 0) return;
    
    setIsProcessing(true);
    setProgress(0);
    setProgressText('Iniciando matching...');
    
    const readyCaixas = caixas.filter(c => c.status === 'ready' && c.data);
    const results: MatchResult[] = [];
    const usedDestinos = new Set<string>();
    let colorIndex = 0;
    
    for (let i = 0; i < readyCaixas.length; i++) {
      const caixa = readyCaixas[i];
      setProgress(((i + 1) / readyCaixas.length) * 100);
      setProgressText(`Analisando ${i + 1}/${readyCaixas.length}: ${caixa.data?.destinatario || 'caixa'}`);
      
      let bestMatch: { destino: typeof destinos[0]; score: number } | null = null;
      
      for (const destino of destinos) {
        if (usedDestinos.has(destino.id)) continue;
        
        const score = calcularScore(caixa.data!, destino);
        
        if (score >= 30 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { destino, score };
        }
      }
      
      if (bestMatch) {
        usedDestinos.add(bestMatch.destino.id);
        
        const tagVisual = gerarTagVisual(
          caixa.data?.destinatario || bestMatch.destino.nome,
          caixa.data?.cep || bestMatch.destino.cep || '',
          caixa.data?.itens || 0
        );
        
        colorIndex++;
        const tagCor = (colorIndex % 8) + 1;
        
        results.push({
          paradaId: bestMatch.destino.id,
          tagVisual,
          tagCor,
          matchScore: bestMatch.score,
          destinatario: bestMatch.destino.nome,
          endereco: bestMatch.destino.endereco,
          cep: bestMatch.destino.cep,
          ordem: i + 1,
          itens: caixa.data?.itens,
          pesoKg: caixa.data?.pesoKg
        });
      }
      
      // Delay para animação
      await new Promise(r => setTimeout(r, 200));
    }
    
    setMatches(results);
    setIsProcessing(false);
    setTab('results');
  };
  
  // ============================================================
  // FUNÇÕES AUXILIARES
  // ============================================================
  
  function calcularScore(caixa: NonNullable<CaixaItem['data']>, destino: typeof destinos[0]): number {
    let score = 0;
    
    // CEP match (30 pontos)
    if (caixa.cep && destino.cep) {
      const cepCaixa = caixa.cep.replace(/\D/g, '');
      const cepDest = destino.cep.replace(/\D/g, '');
      if (cepCaixa === cepDest) score += 30;
      else if (cepCaixa.substring(0, 5) === cepDest.substring(0, 5)) score += 15;
    }
    
    // Nome fuzzy (40 pontos)
    if (caixa.destinatario && destino.nome) {
      const nameScore = fuzzyNameMatch(caixa.destinatario, destino.nome);
      score += nameScore * 40;
    }
    
    // Pedido/Remessa (30 pontos) - se tiver nos dados do destino
    // Este match seria mais preciso com dados da API
    
    return score;
  }
  
  function fuzzyNameMatch(a: string, b: string): number {
    const wordsA = a.toUpperCase().replace(/[^A-Z\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    const wordsB = b.toUpperCase().replace(/[^A-Z\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    
    if (!wordsA.length || !wordsB.length) return 0;
    
    let matches = 0;
    for (const wa of wordsA) {
      for (const wb of wordsB) {
        if (wa === wb) matches += 1;
        else if (wa.startsWith(wb) || wb.startsWith(wa)) matches += 0.7;
      }
    }
    
    return Math.min(1, matches / Math.max(wordsA.length, wordsB.length));
  }
  
  function gerarTagVisual(nome: string, cep: string, itens: number): string {
    const nome3 = (nome || 'XXX').replace(/[^A-Z]/gi, '').substring(0, 3).toUpperCase().padEnd(3, 'X');
    const cep3 = (cep || '000').replace(/\D/g, '').slice(-3).padStart(3, '0');
    const itens2 = String(itens || 0).padStart(2, '0');
    
    return `${nome3}-${cep3}-${itens2}`;
  }
  
  function getConfidenceLabel(score: number): { text: string; emoji: string } {
    if (score >= 70) return { text: 'Alta', emoji: '🟢' };
    if (score >= 50) return { text: 'Média', emoji: '🟡' };
    return { text: 'Baixa', emoji: '🟠' };
  }
  
  // ============================================================
  // RENDER
  // ============================================================
  
  const readyCaixas = caixas.filter(c => c.status === 'ready');
  const canMatch = readyCaixas.length > 0 && destinos.length > 0 && !isProcessing;
  
  return (
    <div className="matching-container">
      {/* HEADER */}
      <div className="matching-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="matching-back-btn" onClick={() => irPara('destinos')}>
            ←
          </button>
          <h1>🔗 Matching</h1>
        </div>
        <div className="matching-badge">📦 {destinos.length} NF-e</div>
      </div>
      
      {/* TABS */}
      <div className="matching-tabs">
        <button 
          className={`matching-tab ${tab === 'boxes' ? 'active' : ''}`}
          onClick={() => setTab('boxes')}
        >
          📦 Caixas 
          <span className="matching-tab-count">{caixas.length}</span>
        </button>
        <button 
          className={`matching-tab ${tab === 'invoices' ? 'active' : ''}`}
          onClick={() => setTab('invoices')}
        >
          📄 NF-e 
          <span className="matching-tab-count">{destinos.length}</span>
        </button>
        <button 
          className={`matching-tab ${tab === 'results' ? 'active' : ''}`}
          onClick={() => setTab('results')}
        >
          🔗 Match 
          <span className="matching-tab-count">{matches.length}</span>
        </button>
      </div>
      
      {/* TAB: CAIXAS */}
      <div className={`matching-section ${tab === 'boxes' ? 'active' : ''}`}>
        <div className="matching-scan-area">
          <div className="icon">📦</div>
          <h3>Fotografar Caixas</h3>
          <p>Tire fotos das etiquetas ou selecione imagens</p>
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            multiple 
            ref={fileInputRef}
            onChange={handleFileSelect}
          />
        </div>
        
        {caixas.length > 0 ? (
          <div className="matching-card-list">
            {caixas.map(caixa => (
              <div key={caixa.id} className="matching-card">
                <img className="matching-card-thumb" src={caixa.thumb} alt="" />
                <div className="matching-card-info">
                  <h4>
                    {caixa.status === 'ready' && caixa.data?.destinatario
                      ? caixa.data.destinatario
                      : caixa.status === 'processing' 
                        ? 'Processando OCR...'
                        : caixa.status === 'error'
                          ? 'Erro no OCR'
                          : 'Aguardando...'}
                  </h4>
                  <div className="meta">
                    {caixa.status === 'ready' && caixa.data ? (
                      <>
                        {caixa.data.pedido && `PED ${caixa.data.pedido} · `}
                        {caixa.data.itens && `${caixa.data.itens} itens · `}
                        {caixa.data.pesoKg && `${caixa.data.pesoKg}kg`}
                        {caixa.data.cep && ` · CEP ${caixa.data.cep}`}
                      </>
                    ) : 'Extraindo dados...'}
                  </div>
                </div>
                <span className={`matching-card-status ${
                  caixa.status === 'ready' ? 'status-matched' : 
                  caixa.status === 'error' ? 'status-error' : 'status-pending'
                }`}>
                  {caixa.status === 'ready' ? 'OK' : caixa.status === 'error' ? '❌' : '⏳'}
                </span>
                <button 
                  className="matching-card-remove" 
                  onClick={() => handleRemoveCaixa(caixa.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="matching-empty-state">
            <div className="icon">📷</div>
            <h3>Nenhuma caixa escaneada</h3>
            <p>Fotografe as etiquetas das caixas da rota</p>
          </div>
        )}
      </div>
      
      {/* TAB: NF-e (Destinos) */}
      <div className={`matching-section ${tab === 'invoices' ? 'active' : ''}`}>
        {destinos.length > 0 ? (
          <div className="matching-card-list">
            {destinos.map((destino, i) => (
              <div key={destino.id} className="matching-card">
                <div 
                  className="matching-card-thumb" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontSize: '24px',
                    background: 'var(--surface-hover)'
                  }}
                >
                  📄
                </div>
                <div className="matching-card-info">
                  <h4>{destino.nome}</h4>
                  <div className="meta">
                    {destino.endereco} · {destino.cidade}/{destino.uf}
                    {destino.cep && ` · CEP ${destino.cep}`}
                  </div>
                </div>
                <span className="matching-card-status status-matched">
                  #{i + 1}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="matching-empty-state">
            <div className="icon">📋</div>
            <h3>Nenhuma NF-e carregada</h3>
            <p>Volte para a tela de destinos e adicione NF-e via OCR</p>
          </div>
        )}
      </div>
      
      {/* TAB: RESULTADOS */}
      <div className={`matching-section ${tab === 'results' ? 'active' : ''}`}>
        {matches.length > 0 ? (
          <>
            <div className="matching-summary-bar">
              <div className="matching-summary-item">
                <div className="num" style={{ color: '#22c55e' }}>{matches.length}</div>
                <div className="label">Pareados</div>
              </div>
              <div className="matching-summary-item">
                <div className="num" style={{ color: '#eab308' }}>
                  {Math.max(0, caixas.filter(c => c.status === 'ready').length - matches.length)}
                </div>
                <div className="label">Pendentes</div>
              </div>
              <div className="matching-summary-item">
                <div className="num" style={{ color: '#ef4444' }}>
                  {Math.max(0, destinos.length - matches.length)}
                </div>
                <div className="label">Sem match</div>
              </div>
            </div>
            
            {matches.map((match, i) => {
              const confidence = getConfidenceLabel(match.matchScore);
              const cor = CORES[(match.tagCor - 1) % CORES.length];
              
              return (
                <div key={match.paradaId} className="matching-result-card">
                  <div className="matching-result-header">
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                        ENTREGA #{i + 1}
                      </div>
                      <div className="matching-result-id" style={{ color: cor }}>
                        {match.tagVisual}
                      </div>
                    </div>
                    <div 
                      className="matching-result-color" 
                      style={{ background: cor }}
                    >
                      #{i + 1}
                    </div>
                  </div>
                  
                  <div className="matching-result-body">
                    <div className="matching-result-row">
                      <span className="matching-result-label">Destinatário</span>
                      <span className="matching-result-value">{match.destinatario}</span>
                    </div>
                    <div className="matching-result-row">
                      <span className="matching-result-label">Endereço</span>
                      <span className="matching-result-value">{match.endereco}</span>
                    </div>
                    {match.cep && (
                      <div className="matching-result-row">
                        <span className="matching-result-label">CEP</span>
                        <span className="matching-result-value">{match.cep}</span>
                      </div>
                    )}
                    {match.itens && (
                      <div className="matching-result-row">
                        <span className="matching-result-label">Itens / Peso</span>
                        <span className="matching-result-value">
                          {match.itens} itens {match.pesoKg && `· ${match.pesoKg}kg`}
                        </span>
                      </div>
                    )}
                    <div className="matching-result-row">
                      <span className="matching-result-label">Confiança</span>
                      <span className="matching-result-value">
                        {confidence.emoji} {confidence.text} ({match.matchScore}pts)
                      </span>
                    </div>
                  </div>
                  
                  <div className="matching-result-tag-area">
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '4px' }}>
                        ETIQUETA DA CAIXA
                      </div>
                      <div className="matching-big-tag" style={{ color: cor }}>
                        {match.tagVisual}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            <button className="matching-print-btn">
              🖨️ Gerar Etiquetas PDF
            </button>
          </>
        ) : (
          <div className="matching-empty-state">
            <div className="icon">🔗</div>
            <h3>Nenhum match realizado</h3>
            <p>Escaneie caixas e clique em "Fazer Matching"</p>
          </div>
        )}
      </div>
      
      {/* MATCH BUTTON */}
      {tab !== 'results' && (
        <>
          <button 
            className="matching-btn"
            onClick={handleExecutarMatch}
            disabled={!canMatch}
            style={{ margin: '16px' }}
          >
            {isProcessing ? (
              <>
                <span className="matching-spinner"></span>
                Processando...
              </>
            ) : (
              <>🔍 Fazer Matching</>
            )}
          </button>
          
          {isProcessing && (
            <>
              <div className="matching-progress-bar active" style={{ margin: '0 16px' }}>
                <div 
                  className="matching-progress-fill" 
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="matching-progress-text active" style={{ margin: '0 16px' }}>
                {progressText}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
