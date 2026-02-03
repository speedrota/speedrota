/**
 * @fileoverview Tela de Adição de Destinos
 * 
 * Permite:
 * - Escanear NF-e via OCR (detecta fornecedor automaticamente)
 * - Adicionar destino manualmente
 * - Visualizar lista de destinos com badges de fornecedor
 */

import { useState, useRef } from 'react';
import { useRouteStore, usePodeCalcular, useTotalDestinos } from '../store/routeStore';
import { processarImagemNFe, validarDadosExtraidos } from '../services/ocr';
import { geocodificarEndereco } from '../services/geolocalizacao';
import { isPDF, pdfPrimeiraPaginaParaImagem } from '../services/pdf';
import type { Destino, Fornecedor } from '../types';
import { FORNECEDORES_CONFIG } from '../types';

export function TelaDestinos() {
  const { 
    destinos, 
    adicionarDestino, 
    adicionarDestinoDeNFe,
    removerDestino, 
    calcularRota,
    carregando,
    setCarregando,
    erro,
    setErro,
    irPara
  } = useRouteStore();
  
  const podeCalcular = usePodeCalcular();
  const totalDestinos = useTotalDestinos();
  
  const [modoManual, setModoManual] = useState(false);
  const [progressoOCR, setProgressoOCR] = useState<string>('');
  
  // Form manual
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('SP');
  const [telefone, setTelefone] = useState('');
  const [referencia, setReferencia] = useState('');
  const [fornecedorManual, setFornecedorManual] = useState<Fornecedor>('outro');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // ==========================================
  // OCR: Processar imagem de NF-e
  // ==========================================
  
  const handleSelecionarImagem = () => {
    fileInputRef.current?.click();
  };
  
  const handleImagemSelecionada = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setCarregando(true);
    setErro(null);
    setProgressoOCR('Inicializando...');
    
    try {
      let imagemParaOCR: string | File = file;
      
      // Se for PDF, converter para imagem primeiro
      if (isPDF(file)) {
        setProgressoOCR('Convertendo PDF...');
        console.log('[TelaDestinos] Arquivo PDF detectado, convertendo...');
        imagemParaOCR = await pdfPrimeiraPaginaParaImagem(file, 250);
        console.log('[TelaDestinos] PDF convertido para imagem');
      }
      
      setProgressoOCR('Processando OCR...');
      const dados = await processarImagemNFe(imagemParaOCR, (progress) => {
        setProgressoOCR(`${progress.status}: ${Math.round(progress.progress * 100)}%`);
      });
      
      if (!dados) {
        throw new Error('Não foi possível extrair dados da NF-e. Verifique a qualidade da imagem.');
      }
      
      // Validar dados extraídos
      const validacao = validarDadosExtraidos(dados);
      if (!validacao.valido) {
        throw new Error(`Campos faltando: ${validacao.camposFaltando.join(', ')}`);
      }
      
      setProgressoOCR('Geocodificando endereço...');
      await adicionarDestinoDeNFe(dados);
      
      setProgressoOCR('');
      
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao processar arquivo');
    } finally {
      setCarregando(false);
      setProgressoOCR('');
      // Limpar input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // ==========================================
  // MANUAL: Adicionar destino
  // ==========================================
  
  const handleAdicionarManual = async () => {
    if (!endereco.trim() || !cidade.trim()) {
      setErro('Preencha pelo menos Endereço e Cidade');
      return;
    }
    
    setCarregando(true);
    setErro(null);
    
    try {
      const geo = await geocodificarEndereco(endereco, cidade, uf);
      
      adicionarDestino({
        lat: geo.lat,
        lng: geo.lng,
        nome: nome.trim() || `Destino ${totalDestinos + 1}`,
        endereco: endereco.trim(),
        cidade: cidade.trim(),
        uf,
        telefone: telefone.trim() || undefined,
        referencia: referencia.trim() || undefined,
        fornecedor: fornecedorManual,
        fonte: 'manual',
        confianca: geo.confiancaValor,
      });
      
      // Limpar form
      setNome('');
      setEndereco('');
      setCidade('');
      setTelefone('');
      setReferencia('');
      setFornecedorManual('outro');
      setModoManual(false);
      
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao adicionar destino');
    } finally {
      setCarregando(false);
    }
  };
  
  // ==========================================
  // RENDER
  // ==========================================
  
  return (
    <div>
      {/* Erro */}
      {erro && (
        <div className="alerta alerta-error mb-2">
          <span className="alerta-icon">❌</span>
          <div className="alerta-content">
            <div className="alerta-mensagem">{erro}</div>
          </div>
        </div>
      )}
      
      {/* Progresso OCR */}
      {progressoOCR && (
        <div className="alerta alerta-info mb-2">
          <span className="loading-spinner" style={{ width: '1rem', height: '1rem' }}></span>
          <div className="alerta-content">
            <div className="alerta-mensagem">{progressoOCR}</div>
          </div>
        </div>
      )}
      
      {/* Input de arquivo oculto */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
        capture="environment"
        onChange={handleImagemSelecionada}
      />
      
      {/* Botões de adicionar */}
      {!modoManual && (
        <>
          <button 
            className="btn btn-primary mb-2"
            onClick={handleSelecionarImagem}
            disabled={carregando}
          >
            📷 Escanear NF-e (Imagem/PDF)
          </button>
          
          <p className="text-small text-muted" style={{ fontSize: '0.75rem', marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
            Formatos aceitos: PNG, JPG, JPEG, PDF
          </p>
          
          <button 
            className="btn btn-secondary mb-2"
            onClick={() => setModoManual(true)}
            disabled={carregando}
          >
            ✏️ Adicionar Manualmente
          </button>
        </>
      )}
      
      {/* Formulário manual */}
      {modoManual && (
        <div className="card mb-2">
          <div className="card-header">Adicionar Destino Manual</div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Nome/Identificação</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: João Silva"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Endereço *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Rua das Flores, 123"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Cidade *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Campinas"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">UF</label>
              <select
                className="form-input"
                value={uf}
                onChange={(e) => setUf(e.target.value)}
              >
                {['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'GO', 'DF', 'PE', 'CE'].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">Fornecedor</label>
              <select
                className="form-input"
                value={fornecedorManual}
                onChange={(e) => setFornecedorManual(e.target.value as Fornecedor)}
              >
                {Object.entries(FORNECEDORES_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.emoji} {config.nome}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">Telefone</label>
              <input
                type="tel"
                className="form-input"
                placeholder="Ex: 19999999999"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Referência</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Em frente ao mercado"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2">
              <button
                className="btn btn-primary"
                onClick={handleAdicionarManual}
                disabled={carregando}
              >
                {carregando ? 'Adicionando...' : '➕ Adicionar'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setModoManual(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Lista de destinos */}
      <div className="mt-4">
        <h3 className="mb-2">Entregas ({totalDestinos})</h3>
        
        {destinos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <div className="empty-state-text">
              Nenhum destino adicionado.<br />
              Escaneie uma NF-e ou adicione manualmente.
            </div>
          </div>
        ) : (
          <div className="destino-list">
            {destinos.map((destino, index) => (
              <DestinoItem 
                key={destino.id} 
                destino={destino} 
                index={index + 1}
                onRemover={() => removerDestino(destino.id)}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Botão calcular */}
      <div className="mt-4">
        <button
          className="btn btn-primary btn-lg"
          onClick={calcularRota}
          disabled={!podeCalcular || carregando}
        >
          🧭 Calcular Rota Otimizada
        </button>
        
        {!podeCalcular && totalDestinos === 0 && (
          <p className="text-sm text-muted text-center mt-1">
            Adicione pelo menos 1 destino para calcular
          </p>
        )}
      </div>
      
      {/* Voltar */}
      <button
        className="btn btn-secondary mt-2"
        onClick={() => irPara('origem')}
      >
        ← Alterar Origem
      </button>
    </div>
  );
}

// ==========================================
// COMPONENTE: Item de Destino
// ==========================================

interface DestinoItemProps {
  destino: Destino;
  index: number;
  onRemover: () => void;
}

function DestinoItem({ destino, index, onRemover }: DestinoItemProps) {
  const fornecedorConfig = FORNECEDORES_CONFIG[destino.fornecedor] || FORNECEDORES_CONFIG.outro;
  
  return (
    <div className="destino-item">
      <div className="destino-info">
        <div className="destino-nome">
          {index}. {destino.nome}
        </div>
        <div className="destino-endereco">
          {destino.endereco}, {destino.cidade}-{destino.uf}
        </div>
        <div className="destino-meta">
          {/* Badge do Fornecedor */}
          <span 
            className="destino-badge"
            style={{ 
              background: fornecedorConfig.cor,
              color: ['#FFE600', '#FFCC00'].includes(fornecedorConfig.cor) ? '#000' : '#fff'
            }}
          >
            {fornecedorConfig.emoji} {fornecedorConfig.nome}
          </span>
          <span className={`destino-badge ${destino.fonte === 'ocr' ? 'badge-ocr' : 'badge-manual'}`}>
            {destino.fonte === 'ocr' ? '📷' : '✏️'}
          </span>
          {destino.nfe && (
            <span className="destino-badge badge-ocr">
              NF-e {destino.nfe}
            </span>
          )}
          {destino.confianca < 0.7 && (
            <span className="destino-badge badge-warning">
              ⚠️ Verificar
            </span>
          )}
        </div>
        {destino.referencia && (
          <div className="text-sm text-muted mt-1">
            📍 {destino.referencia}
          </div>
        )}
      </div>
      <button className="destino-remove" onClick={onRemover} title="Remover">
        ✕
      </button>
    </div>
  );
}
