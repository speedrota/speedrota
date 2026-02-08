/**
 * @fileoverview Tela de Adição de Destinos
 * 
 * Permite:
 * - Escanear NF-e via OCR (detecta fornecedor automaticamente)
 * - Processar múltiplas fotos em lote (fila)
 * - Confirmar/editar dados antes de adicionar
 * - Adicionar destino manualmente
 * - Visualizar lista de destinos com badges de fornecedor
 */

import { useState, useRef } from 'react';
import { useRouteStore, usePodeCalcular, useTotalDestinos } from '../store/routeStore';
import { processarImagemNFe } from '../services/ocr';
import { geocodificarEndereco } from '../services/geolocalizacao';
import { isPDF, pdfPrimeiraPaginaParaImagem } from '../services/pdf';
import type { Destino, Fornecedor, DadosNFe } from '../types';
import { FORNECEDORES_CONFIG } from '../types';
import { ModalConfirmarOCR } from './ModalConfirmarOCR';

// Interface para item na fila de processamento
interface FilaItem {
  arquivo: File;
  status: 'pendente' | 'processando' | 'aguardando' | 'concluido' | 'erro';
  dados?: DadosNFe | null;
  textoOCR?: string;
  erro?: string;
}

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
  
  // NOVO: Fila de processamento de fotos
  const [filaFotos, setFilaFotos] = useState<FilaItem[]>([]);
  const [itemAtual, setItemAtual] = useState<FilaItem | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  
  // Form manual
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('SP');
  const [telefone, setTelefone] = useState('');
  const [referencia, setReferencia] = useState('');
  const [fornecedorManual, setFornecedorManual] = useState<Fornecedor>('outro');
  // Novos campos - janela de tempo e prioridade
  const [janelaInicio, setJanelaInicio] = useState('');
  const [janelaFim, setJanelaFim] = useState('');
  const [prioridade, setPrioridade] = useState<'ALTA' | 'MEDIA' | 'BAIXA'>('MEDIA');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputMultiRef = useRef<HTMLInputElement>(null);
  
  // ==========================================
  // OCR: Processar imagem de NF-e (MODO LOTE)
  // ==========================================
  
  const handleSelecionarImagem = () => {
    fileInputRef.current?.click();
  };
  
  const handleSelecionarMultiplas = () => {
    fileInputMultiRef.current?.click();
  };
  
  // Processar uma única imagem e mostrar modal de confirmação
  const handleImagemSelecionada = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    await processarArquivoComModal(file);
    
    // Limpar input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Processar múltiplas imagens em lote
  const handleMultiplasSelecionadas = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    // Adicionar todos à fila
    const novosItens: FilaItem[] = Array.from(files).map(arquivo => ({
      arquivo,
      status: 'pendente' as const,
    }));
    
    setFilaFotos(novosItens);
    
    // Processar o primeiro
    await processarProximoDaFila(novosItens);
    
    // Limpar input
    if (fileInputMultiRef.current) {
      fileInputMultiRef.current.value = '';
    }
  };
  
  // Processar arquivo e mostrar modal
  const processarArquivoComModal = async (file: File) => {
    setCarregando(true);
    setErro(null);
    setProgressoOCR('Inicializando...');
    
    const item: FilaItem = { arquivo: file, status: 'processando' };
    setItemAtual(item);
    setMostrarModal(true);
    
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
      
      // OCR via API backend (produção) - NÃO usar Tesseract local
      // A API retorna textoExtraido junto com os dados parseados
      let textoOCR = '';
      
      setProgressoOCR('Analisando dados...');
      const dados = await processarImagemNFe(imagemParaOCR, (progress) => {
        setProgressoOCR(`${progress.status}: ${Math.round(progress.progress * 100)}%`);
      });
      
      // SEMPRE mostrar modal, mesmo com dados nulos
      // O usuário pode editar manualmente
      const dadosComFallback: DadosNFe = dados || {
        numero: '',
        fornecedor: 'outro',
        destinatario: {
          nome: '',
          endereco: '',
          numero: '',
          bairro: '',
          cidade: '',
          uf: 'SP',
          cep: '',
        },
        confiancaOCR: 0.1,
      };
      
      item.dados = dadosComFallback;
      item.textoOCR = textoOCR;
      item.status = 'aguardando';
      setItemAtual({ ...item });
      setProgressoOCR('');
      
    } catch (error) {
      console.error('[TelaDestinos] Erro:', error);
      // Mesmo com erro, mostrar modal para entrada manual
      item.status = 'erro';
      item.erro = error instanceof Error ? error.message : 'Erro ao processar';
      item.dados = {
        numero: '',
        fornecedor: 'outro',
        destinatario: {
          nome: '',
          endereco: '',
          numero: '',
          bairro: '',
          cidade: '',
          uf: 'SP',
          cep: '',
        },
        confiancaOCR: 0,
      };
      setItemAtual({ ...item });
      setProgressoOCR('');
    } finally {
      setCarregando(false);
    }
  };
  
  // Processar próximo item da fila
  const processarProximoDaFila = async (fila: FilaItem[]) => {
    const pendente = fila.find(i => i.status === 'pendente');
    if (!pendente) {
      setFilaFotos([]);
      return;
    }
    
    pendente.status = 'processando';
    setFilaFotos([...fila]);
    
    await processarArquivoComModal(pendente.arquivo);
  };
  
  // Quando confirmar dados no modal
  const handleConfirmarOCR = async (dados: DadosNFe) => {
    setCarregando(true);
    setProgressoOCR('Geocodificando endereço...');
    
    try {
      await adicionarDestinoDeNFe(dados);
      
      // Marcar item atual como concluído
      if (itemAtual) {
        itemAtual.status = 'concluido';
      }
      
      // Verificar se tem mais na fila
      if (filaFotos.length > 0) {
        const filaAtualizada = filaFotos.map(i => 
          i.arquivo === itemAtual?.arquivo ? { ...i, status: 'concluido' as const } : i
        );
        setFilaFotos(filaAtualizada);
        
        // Processar próximo
        const pendentes = filaAtualizada.filter(i => i.status === 'pendente');
        if (pendentes.length > 0) {
          await processarProximoDaFila(filaAtualizada);
          return;
        }
      }
      
      // Fechar modal
      setMostrarModal(false);
      setItemAtual(null);
      setFilaFotos([]);
      
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao adicionar destino');
    } finally {
      setCarregando(false);
      setProgressoOCR('');
    }
  };
  
  // Cancelar modal
  const handleCancelarModal = () => {
    setMostrarModal(false);
    setItemAtual(null);
    setFilaFotos([]);
    setCarregando(false);
    setProgressoOCR('');
  };
  
  // Pular foto atual e ir para próxima
  const handlePularFoto = async () => {
    if (filaFotos.length === 0) {
      handleCancelarModal();
      return;
    }
    
    const filaAtualizada = filaFotos.map(i => 
      i.arquivo === itemAtual?.arquivo ? { ...i, status: 'concluido' as const } : i
    );
    setFilaFotos(filaAtualizada);
    
    const pendentes = filaAtualizada.filter(i => i.status === 'pendente');
    if (pendentes.length > 0) {
      await processarProximoDaFila(filaAtualizada);
    } else {
      handleCancelarModal();
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
        // Novos campos - janela de tempo e prioridade
        janelaInicio: janelaInicio || undefined,
        janelaFim: janelaFim || undefined,
        prioridade,
      });
      
      // Limpar form
      setNome('');
      setEndereco('');
      setCidade('');
      setTelefone('');
      setReferencia('');
      setFornecedorManual('outro');
      setJanelaInicio('');
      setJanelaFim('');
      setPrioridade('MEDIA');
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
      
      {/* Input de arquivo oculto (único) */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
        capture="environment"
        onChange={handleImagemSelecionada}
      />
      
      {/* Input de arquivos múltiplos (lote) */}
      <input
        type="file"
        ref={fileInputMultiRef}
        style={{ display: 'none' }}
        accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
        multiple
        onChange={handleMultiplasSelecionadas}
      />
      
      {/* Modal de confirmação OCR */}
      {mostrarModal && (
        <ModalConfirmarOCR
          dados={itemAtual?.dados || null}
          textoOCR={itemAtual?.textoOCR}
          processando={itemAtual?.status === 'processando'}
          onConfirmar={handleConfirmarOCR}
          onCancelar={handleCancelarModal}
          onPular={handlePularFoto}
          fotosRestantes={filaFotos.filter(f => f.status === 'pendente').length}
        />
      )}
      
      {/* Botões de adicionar */}
      {!modoManual && (
        <>
          <button 
            className="btn btn-primary mb-2"
            onClick={handleSelecionarImagem}
            disabled={carregando}
          >
            📷 Tirar Foto da Nota
          </button>
          
          <button 
            className="btn btn-primary mb-2"
            onClick={handleSelecionarMultiplas}
            disabled={carregando}
            style={{ marginLeft: '0.5rem', background: '#059669' }}
          >
            📁 Várias Notas (Lote)
          </button>
          
          <p className="text-small text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
            💡 Tire foto OU selecione várias notas de uma vez
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
            
            {/* Janela de tempo */}
            <div className="form-group">
              <label className="form-label">⏰ Janela de Entrega (opcional)</label>
              <div className="flex gap-2">
                <input
                  type="time"
                  className="form-input"
                  placeholder="Início"
                  value={janelaInicio}
                  onChange={(e) => setJanelaInicio(e.target.value)}
                  style={{ flex: 1 }}
                />
                <span style={{ alignSelf: 'center' }}>até</span>
                <input
                  type="time"
                  className="form-input"
                  placeholder="Fim"
                  value={janelaFim}
                  onChange={(e) => setJanelaFim(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
              <small className="text-muted">Ex: 08:00 até 12:00</small>
            </div>
            
            {/* Prioridade */}
            <div className="form-group">
              <label className="form-label">🎯 Prioridade</label>
              <select
                className="form-input"
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value as 'ALTA' | 'MEDIA' | 'BAIXA')}
              >
                <option value="ALTA">🔴 Alta (entregar primeiro)</option>
                <option value="MEDIA">🟡 Média (normal)</option>
                <option value="BAIXA">🟢 Baixa (pode esperar)</option>
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
        
        {/* Botão Matching */}
        {totalDestinos > 0 && (
          <button
            className="btn btn-secondary btn-lg mt-2"
            onClick={() => irPara('matching')}
            style={{ 
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              color: '#fff',
              border: 'none'
            }}
          >
            🔗 Match Caixa ↔ NF-e
          </button>
        )}
        
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
