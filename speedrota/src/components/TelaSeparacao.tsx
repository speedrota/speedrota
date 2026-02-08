/**
 * @component TelaSeparacao
 * @description Fluxo de separação Caixa ↔ NF-e para GESTOR_FROTA
 * 
 * FLUXO:
 * 1. STEP CAIXAS - Fotografar caixas/etiquetas
 * 2. STEP NOTAS - Fotografar NF-e/DANFEs
 * 3. MATCHING AUTOMÁTICO - OCR + PED/REM/SubRota
 * 4. RESULTADO - IDs visuais para cada par
 * 
 * @pre Motorista ou Empresa selecionada em TelaEscolhaCarga
 * @post Pares NF-e ↔ Caixa com tagVisual gerado
 */

import { useState, useRef } from 'react';
import { useRouteStore } from '../store/routeStore';
import { processarImagemNFe, extrairTexto } from '../services/ocr';
import { geocodificarEndereco } from '../services/geolocalizacao';
import { isPDF, pdfPrimeiraPaginaParaImagem } from '../services/pdf';
import type { Destino, DadosNFe } from '../types';
import './Separacao.css';

// ============================================================
// TIPOS
// ============================================================

type StepType = 'caixas' | 'notas' | 'matching' | 'resultado';

interface CaixaItem {
  id: string;
  thumb: string;
  status: 'pending' | 'processing' | 'ready' | 'error';
  data?: {
    pedido?: string;
    remessa?: string;
    subRota?: string;
    destinatario?: string;
    cep?: string;
    itens?: number;
    pesoKg?: number;
  };
  textoOCR?: string;
}

interface NotaItem {
  id: string;
  thumb: string;
  status: 'pending' | 'processing' | 'ready' | 'error';
  data?: DadosNFe;
  textoOCR?: string;
}

interface ParMatch {
  id: string;
  tagVisual: string;
  tagCor: number;
  matchScore: number;
  caixa: CaixaItem;
  nota: NotaItem;
  destino?: Destino;
  matchedBy: string[]; // 'PED', 'REM', 'SUB_ROTA', 'CEP', 'NOME'
}

// Cores para tags visuais
const CORES_TAG = [
  '#f97316', // 1 - Laranja
  '#22c55e', // 2 - Verde
  '#3b82f6', // 3 - Azul
  '#a855f7', // 4 - Roxo
  '#ec4899', // 5 - Pink
  '#eab308', // 6 - Amarelo
  '#14b8a6', // 7 - Teal
  '#f43f5e', // 8 - Vermelho
];

// ============================================================
// COMPONENT
// ============================================================

export default function TelaSeparacao() {
  const { 
    irPara, 
    motoristaSelecionado, 
    empresaSelecionada,
    adicionarDestino,
    setCarregando 
  } = useRouteStore();
  
  // Estado do fluxo
  const [step, setStep] = useState<StepType>('caixas');
  const [caixas, setCaixas] = useState<CaixaItem[]>([]);
  const [notas, setNotas] = useState<NotaItem[]>([]);
  const [pares, setPares] = useState<ParMatch[]>([]);
  const [naoPareados, setNaoPareados] = useState<{ caixas: CaixaItem[], notas: NotaItem[] }>({ caixas: [], notas: [] });
  
  // Estado de processamento
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [progressoTexto, setProgressoTexto] = useState('');
  
  const fileInputCaixaRef = useRef<HTMLInputElement>(null);
  const fileInputCaixaLoteRef = useRef<HTMLInputElement>(null);
  const fileInputNotaRef = useRef<HTMLInputElement>(null);
  const fileInputNotaLoteRef = useRef<HTMLInputElement>(null);
  
  // Info do destino selecionado
  const destinoInfo = motoristaSelecionado 
    ? `🚗 ${motoristaSelecionado.nome}` 
    : empresaSelecionada 
      ? `🏢 ${empresaSelecionada.nome}` 
      : '';
  
  // ============================================================
  // STEP 1: CAIXAS - Handlers
  // ============================================================
  
  const handleFotoCaixa = () => {
    if (fileInputCaixaRef.current) {
      fileInputCaixaRef.current.click();
    }
  };
  
  const handleLoteCaixas = () => {
    if (fileInputCaixaLoteRef.current) {
      fileInputCaixaLoteRef.current.click();
    }
  };
  
  const processarArquivoCaixa = async (file: File): Promise<CaixaItem> => {
    const id = `caixa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Ler arquivo
    const thumb = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    
    const item: CaixaItem = { id, thumb, status: 'processing' };
    setCaixas(prev => [...prev, item]);
    
    try {
      // OCR para extrair dados da etiqueta
      const texto = await extrairTexto(thumb);
      
      // Extrair campos relevantes (PED, REM, SUB_ROTA)
      const pedido = extrairCampo(texto, /(?:PED|PEDIDO)[:\s]*(\d+)/i);
      const remessa = extrairCampo(texto, /(?:REM|REMESSA|SHIPMENT)[:\s]*(\d+)/i);
      const subRota = extrairCampo(texto, /(?:SUB[_\-\s]?ROTA|SUBROTA|SR)[:\s]*([A-Z0-9\-]+)/i);
      const cep = extrairCampo(texto, /CEP[:\s]*(\d{5}[-]?\d{3})/i) || 
                  extrairCampo(texto, /(\d{5}[-]\d{3})/);
      const destinatario = extrairCampo(texto, /(?:DEST|DESTINAT[ÁA]RIO)[:\s]*([A-Za-zÀ-ú\s]+)/i);
      const itens = parseInt(extrairCampo(texto, /(?:QTD|ITENS|VOL)[:\s]*(\d+)/i) || '0');
      const peso = parseFloat(extrairCampo(texto, /(?:PESO)[:\s]*([\d,\.]+)/i)?.replace(',', '.') || '0');
      
      return {
        ...item,
        status: 'ready',
        textoOCR: texto,
        data: {
          pedido,
          remessa,
          subRota,
          cep,
          destinatario,
          itens: itens || undefined,
          pesoKg: peso || undefined
        }
      };
    } catch (error) {
      console.error('[Separacao] Erro OCR caixa:', error);
      return { ...item, status: 'error' };
    }
  };
  
  const handleArquivosCaixa = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    
    setProcessando(true);
    
    for (let i = 0; i < files.length; i++) {
      setProgressoTexto(`Processando caixa ${i + 1}/${files.length}...`);
      setProgresso(((i + 1) / files.length) * 100);
      
      const result = await processarArquivoCaixa(files[i]);
      setCaixas(prev => prev.map(c => c.id === result.id ? result : c));
    }
    
    setProcessando(false);
    setProgresso(0);
    setProgressoTexto('');
    
    // Limpar input
    if (event.target) event.target.value = '';
  };
  
  const removerCaixa = (id: string) => {
    setCaixas(prev => prev.filter(c => c.id !== id));
  };
  
  // ============================================================
  // STEP 2: NOTAS - Handlers
  // ============================================================
  
  const handleFotoNota = () => {
    if (fileInputNotaRef.current) {
      fileInputNotaRef.current.click();
    }
  };
  
  const handleLoteNotas = () => {
    if (fileInputNotaLoteRef.current) {
      fileInputNotaLoteRef.current.click();
    }
  };
  
  const processarArquivoNota = async (file: File): Promise<NotaItem> => {
    const id = `nota-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Verificar se é PDF
    let imagemData: string;
    if (isPDF(file)) {
      imagemData = await pdfPrimeiraPaginaParaImagem(file);
    } else {
      imagemData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
    
    const item: NotaItem = { id, thumb: imagemData, status: 'processing' };
    setNotas(prev => [...prev, item]);
    
    try {
      // OCR completo da NF-e
      const dados = await processarImagemNFe(imagemData);
      const texto = await extrairTexto(imagemData);
      
      // Extrair PED/REM/SubRota do texto para matching
      const pedido = extrairCampo(texto, /(?:PED|PEDIDO)[:\s]*(\d+)/i);
      const remessa = extrairCampo(texto, /(?:REM|REMESSA)[:\s]*(\d+)/i);
      const subRota = extrairCampo(texto, /(?:SUB[_\-\s]?ROTA|SUBROTA|SR)[:\s]*([A-Z0-9\-]+)/i);
      
      return {
        ...item,
        status: 'ready',
        textoOCR: texto,
        data: dados ? {
          ...dados,
          pedido: pedido || dados.pedido,
          remessa: remessa || dados.remessa,
          subRota: subRota
        } : undefined
      };
    } catch (error) {
      console.error('[Separacao] Erro OCR nota:', error);
      return { ...item, status: 'error' };
    }
  };
  
  const handleArquivosNota = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    
    setProcessando(true);
    
    for (let i = 0; i < files.length; i++) {
      setProgressoTexto(`Processando nota ${i + 1}/${files.length}...`);
      setProgresso(((i + 1) / files.length) * 100);
      
      const result = await processarArquivoNota(files[i]);
      setNotas(prev => prev.map(n => n.id === result.id ? result : n));
    }
    
    setProcessando(false);
    setProgresso(0);
    setProgressoTexto('');
    
    // Limpar input
    if (event.target) event.target.value = '';
  };
  
  const removerNota = (id: string) => {
    setNotas(prev => prev.filter(n => n.id !== id));
  };
  
  // ============================================================
  // STEP 3: MATCHING - Algoritmo
  // ============================================================
  
  const executarMatching = async () => {
    setStep('matching');
    setProcessando(true);
    setProgresso(0);
    setProgressoTexto('Iniciando matching automático...');
    
    const caixasReady = caixas.filter(c => c.status === 'ready' && c.data);
    const notasReady = notas.filter(n => n.status === 'ready' && n.data);
    
    const paresEncontrados: ParMatch[] = [];
    const caixasUsadas = new Set<string>();
    const notasUsadas = new Set<string>();
    let colorIndex = 0;
    
    // MATCHING PASS 1: PED exato (50 pts)
    setProgressoTexto('Matching por PEDIDO...');
    setProgresso(10);
    for (const caixa of caixasReady) {
      if (!caixa.data?.pedido || caixasUsadas.has(caixa.id)) continue;
      
      for (const nota of notasReady) {
        if (notasUsadas.has(nota.id)) continue;
        
        if (nota.data?.pedido && caixa.data.pedido === nota.data.pedido) {
          const par = criarPar(caixa, nota, 50, ['PED'], colorIndex++);
          paresEncontrados.push(par);
          caixasUsadas.add(caixa.id);
          notasUsadas.add(nota.id);
          break;
        }
      }
    }
    
    // MATCHING PASS 2: REM exato (50 pts)
    setProgressoTexto('Matching por REMESSA...');
    setProgresso(30);
    await delay(200);
    for (const caixa of caixasReady) {
      if (!caixa.data?.remessa || caixasUsadas.has(caixa.id)) continue;
      
      for (const nota of notasReady) {
        if (notasUsadas.has(nota.id)) continue;
        
        if (nota.data?.remessa && caixa.data.remessa === nota.data.remessa) {
          const par = criarPar(caixa, nota, 50, ['REM'], colorIndex++);
          paresEncontrados.push(par);
          caixasUsadas.add(caixa.id);
          notasUsadas.add(nota.id);
          break;
        }
      }
    }
    
    // MATCHING PASS 3: SUB_ROTA exato (40 pts)
    setProgressoTexto('Matching por SUB-ROTA...');
    setProgresso(50);
    await delay(200);
    for (const caixa of caixasReady) {
      if (!caixa.data?.subRota || caixasUsadas.has(caixa.id)) continue;
      
      for (const nota of notasReady) {
        if (notasUsadas.has(nota.id)) continue;
        
        const notaSubRota = nota.data?.subRota;
        if (notaSubRota && caixa.data.subRota.toUpperCase() === notaSubRota.toUpperCase()) {
          const par = criarPar(caixa, nota, 40, ['SUB_ROTA'], colorIndex++);
          paresEncontrados.push(par);
          caixasUsadas.add(caixa.id);
          notasUsadas.add(nota.id);
          break;
        }
      }
    }
    
    // MATCHING PASS 4: CEP + Nome fuzzy (30 pts)
    setProgressoTexto('Matching por CEP + Nome...');
    setProgresso(70);
    await delay(200);
    for (const caixa of caixasReady) {
      if (caixasUsadas.has(caixa.id)) continue;
      
      let melhorMatch: { nota: NotaItem; score: number; by: string[] } | null = null;
      
      for (const nota of notasReady) {
        if (notasUsadas.has(nota.id)) continue;
        
        let score = 0;
        const by: string[] = [];
        
        // CEP match
        if (caixa.data?.cep && nota.data?.destinatario?.cep) {
          const cepCaixa = caixa.data.cep.replace(/\D/g, '');
          const cepNota = nota.data.destinatario.cep.replace(/\D/g, '');
          if (cepCaixa === cepNota) {
            score += 15;
            by.push('CEP');
          }
        }
        
        // Nome fuzzy
        if (caixa.data?.destinatario && nota.data?.destinatario?.nome) {
          const nomeScore = fuzzyNameMatch(caixa.data.destinatario, nota.data.destinatario.nome);
          if (nomeScore >= 0.5) {
            score += Math.round(nomeScore * 20);
            by.push('NOME');
          }
        }
        
        if (score >= 15 && (!melhorMatch || score > melhorMatch.score)) {
          melhorMatch = { nota, score, by };
        }
      }
      
      if (melhorMatch) {
        const par = criarPar(caixa, melhorMatch.nota, melhorMatch.score, melhorMatch.by, colorIndex++);
        paresEncontrados.push(par);
        caixasUsadas.add(caixa.id);
        notasUsadas.add(melhorMatch.nota.id);
      }
    }
    
    // Geocodificar destinos e adicionar à rota
    setProgressoTexto('Geocodificando endereços...');
    setProgresso(85);
    await delay(200);
    
    for (const par of paresEncontrados) {
      if (par.nota.data?.destinatario) {
        const end = par.nota.data.destinatario;
        const enderecoCompleto = `${end.endereco}, ${end.numero}, ${end.bairro}, ${end.cidade} - ${end.uf}`;
        
        try {
          const geo = await geocodificarEndereco(enderecoCompleto);
          if (geo) {
            const destino: Destino = {
              id: `dest-${par.id}`,
              nome: end.nome,
              endereco: enderecoCompleto,
              lat: geo.lat,
              lng: geo.lng,
              cidade: end.cidade,
              uf: end.uf,
              cep: end.cep,
              tagVisual: par.tagVisual,
              tagCor: par.tagCor,
              fornecedor: par.nota.data.fornecedorDetectado || par.nota.data.fornecedor || 'outro',
              fonte: 'ocr',
              confianca: par.matchScore / 100
            };
            par.destino = destino;
          }
        } catch (e) {
          console.error('[Separacao] Erro geocoding:', e);
        }
      }
    }
    
    // Identificar não pareados
    const caixasNaoPareadas = caixasReady.filter(c => !caixasUsadas.has(c.id));
    const notasNaoPareadas = notasReady.filter(n => !notasUsadas.has(n.id));
    
    setPares(paresEncontrados);
    setNaoPareados({ caixas: caixasNaoPareadas, notas: notasNaoPareadas });
    
    setProgresso(100);
    setProgressoTexto('Matching concluído!');
    await delay(500);
    
    setProcessando(false);
    setStep('resultado');
  };
  
  function criarPar(caixa: CaixaItem, nota: NotaItem, score: number, by: string[], colorIndex: number): ParMatch {
    const tagVisual = gerarTagVisual(
      nota.data?.destinatario?.nome || caixa.data?.destinatario || 'XXX',
      nota.data?.destinatario?.cep || caixa.data?.cep || '00000',
      caixa.data?.itens || 1
    );
    
    return {
      id: `par-${caixa.id}-${nota.id}`,
      tagVisual,
      tagCor: (colorIndex % 8) + 1,
      matchScore: score,
      caixa,
      nota,
      matchedBy: by
    };
  }
  
  // ============================================================
  // STEP 4: RESULTADO - Gerar output
  // ============================================================
  
  const gerarRotaParaMotorista = async () => {
    setCarregando(true);
    
    // Adicionar destinos pareados à rota
    for (const par of pares) {
      if (par.destino) {
        adicionarDestino(par.destino);
      }
    }
    
    setCarregando(false);
    
    // GESTOR: Ir para rota visualizar
    // ENTREGADOR: Ir para calcular rota
    irPara('rota');
  };
  
  const gerarArquivoSeparacao = () => {
    // Gerar arquivo TXT/PDF com as separações para o motorista
    const linhas: string[] = [
      '═══════════════════════════════════════════════════',
      `      SEPARAÇÃO DE CARGA - ${new Date().toLocaleDateString('pt-BR')}`,
      '═══════════════════════════════════════════════════',
      '',
      `Destino: ${destinoInfo}`,
      `Total de Pares: ${pares.length}`,
      '',
      '───────────────────────────────────────────────────',
    ];
    
    pares.forEach((par, idx) => {
      linhas.push('');
      linhas.push(`📦 ${idx + 1}. TAG: ${par.tagVisual}`);
      linhas.push(`   Cor: ${par.tagCor} | Score: ${par.matchScore}pts`);
      linhas.push(`   Match: ${par.matchedBy.join(' + ')}`);
      if (par.nota.data?.destinatario) {
        linhas.push(`   Para: ${par.nota.data.destinatario.nome}`);
        linhas.push(`   End: ${par.nota.data.destinatario.endereco}, ${par.nota.data.destinatario.numero}`);
        linhas.push(`   ${par.nota.data.destinatario.bairro} - ${par.nota.data.destinatario.cidade}/${par.nota.data.destinatario.uf}`);
        linhas.push(`   CEP: ${par.nota.data.destinatario.cep}`);
      }
      linhas.push('───────────────────────────────────────────────────');
    });
    
    if (naoPareados.caixas.length > 0) {
      linhas.push('');
      linhas.push('⚠️ CAIXAS NÃO PAREADAS:');
      naoPareados.caixas.forEach(c => {
        linhas.push(`   - ${c.data?.pedido ? `PED ${c.data.pedido}` : c.id}`);
      });
    }
    
    if (naoPareados.notas.length > 0) {
      linhas.push('');
      linhas.push('⚠️ NOTAS NÃO PAREADAS:');
      naoPareados.notas.forEach(n => {
        linhas.push(`   - ${n.data?.destinatario?.nome || n.id}`);
      });
    }
    
    // Download
    const blob = new Blob([linhas.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `separacao_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // ============================================================
  // HELPERS
  // ============================================================
  
  function extrairCampo(texto: string, regex: RegExp): string | undefined {
    const match = texto.match(regex);
    return match?.[1]?.trim();
  }
  
  function fuzzyNameMatch(a: string, b: string): number {
    const wordsA = a.toUpperCase().replace(/[^A-ZÁÉÍÓÚÀÂÊÔÃÕÇ\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    const wordsB = b.toUpperCase().replace(/[^A-ZÁÉÍÓÚÀÂÊÔÃÕÇ\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    
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
  
  function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // ============================================================
  // RENDER
  // ============================================================
  
  const caixasReady = caixas.filter(c => c.status === 'ready');
  const notasReady = notas.filter(n => n.status === 'ready');
  const podeAvancarParaNotas = caixasReady.length > 0;
  const podeExecutarMatching = notasReady.length > 0;
  
  return (
    <div className="separacao-container">
      {/* HEADER */}
      <header className="separacao-header">
        <button className="separacao-back" onClick={() => irPara('escolha-carga')}>
          ←
        </button>
        <div className="separacao-header-info">
          <h1>📦 Separação de Carga</h1>
          {destinoInfo && <span className="separacao-destino">{destinoInfo}</span>}
        </div>
      </header>
      
      {/* PROGRESS BAR */}
      <div className="separacao-steps">
        <div className={`separacao-step ${step === 'caixas' ? 'active' : caixas.length > 0 ? 'done' : ''}`}>
          <span className="step-number">1</span>
          <span className="step-label">Caixas</span>
        </div>
        <div className="separacao-step-line" />
        <div className={`separacao-step ${step === 'notas' ? 'active' : notas.length > 0 ? 'done' : ''}`}>
          <span className="step-number">2</span>
          <span className="step-label">Notas</span>
        </div>
        <div className="separacao-step-line" />
        <div className={`separacao-step ${step === 'matching' ? 'active' : step === 'resultado' ? 'done' : ''}`}>
          <span className="step-number">3</span>
          <span className="step-label">Match</span>
        </div>
        <div className="separacao-step-line" />
        <div className={`separacao-step ${step === 'resultado' ? 'active' : ''}`}>
          <span className="step-number">4</span>
          <span className="step-label">Resultado</span>
        </div>
      </div>
      
      {/* PROGRESS OVERLAY */}
      {processando && (
        <div className="separacao-progress-overlay">
          <div className="separacao-progress-modal">
            <div className="separacao-progress-bar">
              <div className="separacao-progress-fill" style={{ width: `${progresso}%` }} />
            </div>
            <p>{progressoTexto}</p>
          </div>
        </div>
      )}
      
      {/* STEP 1: CAIXAS */}
      {step === 'caixas' && (
        <div className="separacao-content">
          <div className="separacao-scan-area">
            <div className="scan-icon">📦</div>
            <h2>Fotografar Caixas</h2>
            <p>Tire fotos das etiquetas para leitura automática</p>
            
            <div className="separacao-buttons">
              <button className="btn-primary" onClick={handleFotoCaixa}>
                📷 Tirar Foto da Caixa
              </button>
              <button className="btn-secondary" onClick={handleLoteCaixas}>
                📁 Várias Caixas (Lote)
              </button>
            </div>
            
            {/* Hidden inputs */}
            <input 
              type="file" 
              accept="image/*" 
              capture="environment"
              ref={fileInputCaixaRef}
              onChange={handleArquivosCaixa}
              style={{ display: 'none' }}
            />
            <input 
              type="file" 
              accept="image/*" 
              multiple
              ref={fileInputCaixaLoteRef}
              onChange={handleArquivosCaixa}
              style={{ display: 'none' }}
            />
          </div>
          
          {/* Lista de caixas */}
          {caixas.length > 0 && (
            <div className="separacao-lista">
              <h3>📦 Caixas Escaneadas ({caixas.length})</h3>
              <div className="separacao-cards">
                {caixas.map(caixa => (
                  <div key={caixa.id} className={`separacao-card ${caixa.status}`}>
                    <img src={caixa.thumb} alt="" className="card-thumb" />
                    <div className="card-info">
                      <h4>
                        {caixa.status === 'ready' 
                          ? (caixa.data?.pedido ? `PED ${caixa.data.pedido}` : caixa.data?.destinatario || 'Caixa')
                          : caixa.status === 'processing' 
                            ? 'Processando...' 
                            : 'Erro OCR'}
                      </h4>
                      {caixa.status === 'ready' && caixa.data && (
                        <div className="card-meta">
                          {caixa.data.remessa && <span>REM: {caixa.data.remessa}</span>}
                          {caixa.data.subRota && <span>SR: {caixa.data.subRota}</span>}
                          {caixa.data.cep && <span>CEP: {caixa.data.cep}</span>}
                        </div>
                      )}
                    </div>
                    <button className="card-remove" onClick={() => removerCaixa(caixa.id)}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Botão avançar */}
          <div className="separacao-footer">
            <button 
              className="btn-avancar"
              disabled={!podeAvancarParaNotas}
              onClick={() => setStep('notas')}
            >
              Próxima Etapa: Notas →
            </button>
            <p className="separacao-hint">
              {caixasReady.length > 0 
                ? `${caixasReady.length} caixa(s) pronta(s)` 
                : 'Escaneie pelo menos 1 caixa para continuar'}
            </p>
          </div>
        </div>
      )}
      
      {/* STEP 2: NOTAS */}
      {step === 'notas' && (
        <div className="separacao-content">
          <div className="separacao-scan-area">
            <div className="scan-icon">📄</div>
            <h2>Fotografar Notas</h2>
            <p>Tire fotos das NF-e/DANFE para fazer o matching</p>
            
            <div className="separacao-buttons">
              <button className="btn-primary" onClick={handleFotoNota}>
                📷 Tirar Foto da Nota
              </button>
              <button className="btn-secondary" onClick={handleLoteNotas}>
                📁 Várias Notas (Lote)
              </button>
            </div>
            
            {/* Hidden inputs */}
            <input 
              type="file" 
              accept="image/*,application/pdf" 
              capture="environment"
              ref={fileInputNotaRef}
              onChange={handleArquivosNota}
              style={{ display: 'none' }}
            />
            <input 
              type="file" 
              accept="image/*,application/pdf" 
              multiple
              ref={fileInputNotaLoteRef}
              onChange={handleArquivosNota}
              style={{ display: 'none' }}
            />
          </div>
          
          {/* Lista de notas */}
          {notas.length > 0 && (
            <div className="separacao-lista">
              <h3>📄 Notas Escaneadas ({notas.length})</h3>
              <div className="separacao-cards">
                {notas.map(nota => (
                  <div key={nota.id} className={`separacao-card ${nota.status}`}>
                    <img src={nota.thumb} alt="" className="card-thumb" />
                    <div className="card-info">
                      <h4>
                        {nota.status === 'ready' 
                          ? nota.data?.destinatario?.nome || 'NF-e'
                          : nota.status === 'processing' 
                            ? 'Processando...' 
                            : 'Erro OCR'}
                      </h4>
                      {nota.status === 'ready' && nota.data?.destinatario && (
                        <div className="card-meta">
                          <span>{nota.data.destinatario.cidade}/{nota.data.destinatario.uf}</span>
                          {nota.data.destinatario.cep && <span>CEP: {nota.data.destinatario.cep}</span>}
                        </div>
                      )}
                    </div>
                    <button className="card-remove" onClick={() => removerNota(nota.id)}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Resumo */}
          <div className="separacao-resumo">
            <div className="resumo-item">
              <span className="resumo-label">📦 Caixas</span>
              <span className="resumo-value">{caixasReady.length}</span>
            </div>
            <div className="resumo-item">
              <span className="resumo-label">📄 Notas</span>
              <span className="resumo-value">{notasReady.length}</span>
            </div>
          </div>
          
          {/* Botões */}
          <div className="separacao-footer">
            <button className="btn-voltar" onClick={() => setStep('caixas')}>
              ← Voltar para Caixas
            </button>
            <button 
              className="btn-matching"
              disabled={!podeExecutarMatching}
              onClick={executarMatching}
            >
              🔍 Fazer Matching
            </button>
          </div>
        </div>
      )}
      
      {/* STEP 3: MATCHING (loading state handled by overlay) */}
      {step === 'matching' && !processando && (
        <div className="separacao-content">
          <div className="separacao-loading">
            <div className="loading-spinner" />
            <p>Executando matching...</p>
          </div>
        </div>
      )}
      
      {/* STEP 4: RESULTADO */}
      {step === 'resultado' && (
        <div className="separacao-content">
          <div className="separacao-resultado-header">
            <h2>✅ Matching Concluído!</h2>
            <div className="resultado-stats">
              <span className="stat pareados">✓ {pares.length} pareados</span>
              {(naoPareados.caixas.length > 0 || naoPareados.notas.length > 0) && (
                <span className="stat nao-pareados">
                  ⚠ {naoPareados.caixas.length + naoPareados.notas.length} não pareados
                </span>
              )}
            </div>
          </div>
          
          {/* Lista de pares */}
          <div className="separacao-pares">
            {pares.map((par, idx) => (
              <div 
                key={par.id} 
                className="par-card"
                style={{ borderLeftColor: CORES_TAG[(par.tagCor - 1) % 8] }}
              >
                <div className="par-tag" style={{ backgroundColor: CORES_TAG[(par.tagCor - 1) % 8] }}>
                  {par.tagVisual}
                </div>
                <div className="par-info">
                  <div className="par-numero">#{idx + 1}</div>
                  <div className="par-destinatario">
                    {par.nota.data?.destinatario?.nome || 'Destino'}
                  </div>
                  <div className="par-endereco">
                    {par.nota.data?.destinatario?.endereco}, {par.nota.data?.destinatario?.numero}
                    <br />
                    {par.nota.data?.destinatario?.bairro} - {par.nota.data?.destinatario?.cidade}/{par.nota.data?.destinatario?.uf}
                  </div>
                  <div className="par-match-info">
                    <span className="match-by">Match: {par.matchedBy.join(' + ')}</span>
                    <span className="match-score">{par.matchScore}pts</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Não pareados */}
          {(naoPareados.caixas.length > 0 || naoPareados.notas.length > 0) && (
            <div className="separacao-nao-pareados">
              <h3>⚠️ Itens Não Pareados</h3>
              {naoPareados.caixas.length > 0 && (
                <div className="nao-pareado-grupo">
                  <h4>📦 Caixas ({naoPareados.caixas.length})</h4>
                  {naoPareados.caixas.map(c => (
                    <div key={c.id} className="nao-pareado-item">
                      {c.data?.pedido ? `PED ${c.data.pedido}` : c.data?.destinatario || c.id}
                    </div>
                  ))}
                </div>
              )}
              {naoPareados.notas.length > 0 && (
                <div className="nao-pareado-grupo">
                  <h4>📄 Notas ({naoPareados.notas.length})</h4>
                  {naoPareados.notas.map(n => (
                    <div key={n.id} className="nao-pareado-item">
                      {n.data?.destinatario?.nome || n.id}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Ações */}
          <div className="separacao-footer resultado">
            <button className="btn-download" onClick={gerarArquivoSeparacao}>
              📥 Baixar Arquivo
            </button>
            <button className="btn-rota" onClick={gerarRotaParaMotorista}>
              🗺️ Gerar Rota
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
