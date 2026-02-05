/**
 * @fileoverview Componente QR Code Scanner para NF-e/NFC-e
 * 
 * Responsável por:
 * - Escanear QR Codes via câmera
 * - Input manual de QR Code/chave de acesso
 * - Consultar NF-e no SEFAZ
 * - Importar como parada na rota
 * 
 * @pre Usuário autenticado
 * @post QR Codes processados e importados como paradas
 * @invariant Formato de chave sempre validado antes de consulta
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouteStore } from '../store/routeStore';
import './QrCodeScanner.css';

// ==========================================
// TYPES
// ==========================================

interface NfeExtraida {
  chaveAcesso: string;
  tipoQrCode: string;
  nomeDestinatario?: string;
  endereco?: string;
  valor?: number;
  dataEmissao?: string;
}

interface ParadaImportada {
  id: string;
  chaveNfe: string;
  nome: string;
  endereco: string;
}

type ModoScanner = 'camera' | 'manual';

// ==========================================
// API SERVICE
// ==========================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Extrai dados do QR Code sem consultar SEFAZ
 * @pre conteudo é string não vazia
 * @post Retorna dados extraídos ou erro
 */
async function extrairQrCode(conteudo: string): Promise<{
  success: boolean;
  data?: {
    tipo: string;
    chaveAcesso: string;
    componentes: { uf: string; modelo: string };
  };
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/api/v1/sefaz/qrcode/extrair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conteudo })
  });
  return response.json();
}

/**
 * Consulta NF-e no SEFAZ via QR Code
 * @pre conteudo é QR Code válido
 * @post Retorna dados completos da NF-e
 */
async function consultarQrCode(conteudo: string): Promise<{
  success: boolean;
  data?: {
    nfe: {
      numero: number;
      valor: number;
      dataEmissao: string;
      emitente: { nome: string };
      destinatario: {
        nome: string;
        logradouro: string;
        numero: string;
        bairro: string;
        cidade: string;
        uf: string;
        cep: string;
      };
    };
    chaveAcesso: string;
    tipoQrCode: string;
    enderecoFormatado: string;
  };
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/api/v1/sefaz/qrcode/consultar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conteudo })
  });
  return response.json();
}

/**
 * Importa QR Code como parada na rota
 * @pre QR Code válido e rotaId existente
 * @post Parada criada com geocoding
 */
async function importarQrCode(conteudo: string, rotaId: string): Promise<{
  success: boolean;
  data?: {
    paradaId: string;
    chaveNfe: string;
    nomeDestinatario?: string;
    endereco?: string;
  };
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/api/v1/sefaz/qrcode/importar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conteudo, rotaId })
  });
  return response.json();
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export function TelaQrCodeScanner() {
  const { irPara, destinos, adicionarDestino } = useRouteStore();
  
  const [modo, setModo] = useState<ModoScanner>('manual');
  const [inputQrCode, setInputQrCode] = useState('');
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<NfeExtraida | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [importados, setImportados] = useState<ParadaImportada[]>([]);
  
  // Camera state
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  /**
   * Inicia a câmera para escaneamento
   */
  const iniciarCamera = useCallback(async () => {
    try {
      setErroCamera(null);
      const constraints = {
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraAtiva(true);
      }
    } catch (err) {
      console.error('Erro ao acessar câmera:', err);
      setErroCamera('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  }, []);

  /**
   * Para a câmera
   */
  const pararCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraAtiva(false);
  }, []);

  /**
   * Alterna entre modos camera/manual
   */
  const alternarModo = (novoModo: ModoScanner) => {
    if (novoModo === 'camera' && modo !== 'camera') {
      iniciarCamera();
    } else if (novoModo !== 'camera' && modo === 'camera') {
      pararCamera();
    }
    setModo(novoModo);
    setResultado(null);
    setErro(null);
  };

  /**
   * Processa conteúdo QR Code (extrai e consulta)
   * @pre conteudo não vazio
   * @post resultado populado ou erro setado
   */
  const processarQrCode = async (conteudo: string) => {
    if (!conteudo.trim()) {
      setErro('Digite ou escaneie um QR Code');
      return;
    }

    setProcessando(true);
    setErro(null);
    setResultado(null);

    try {
      // Primeiro: extrai para validar formato
      const extracao = await extrairQrCode(conteudo);
      
      if (!extracao.success) {
        setErro(extracao.error || 'Formato de QR Code não reconhecido');
        return;
      }

      // Segundo: consulta SEFAZ para dados completos
      const consulta = await consultarQrCode(conteudo);
      
      if (!consulta.success) {
        // Se falhou consulta, mostra pelo menos os dados extraídos
        setResultado({
          chaveAcesso: extracao.data!.chaveAcesso,
          tipoQrCode: extracao.data!.tipo,
        });
        setErro(`Extração OK, mas consulta SEFAZ falhou: ${consulta.error}`);
        return;
      }

      // Sucesso completo
      const nfe = consulta.data!.nfe;
      setResultado({
        chaveAcesso: consulta.data!.chaveAcesso,
        tipoQrCode: consulta.data!.tipoQrCode,
        nomeDestinatario: nfe.destinatario.nome,
        endereco: consulta.data!.enderecoFormatado,
        valor: nfe.valor,
        dataEmissao: nfe.dataEmissao
      });

    } catch (err) {
      console.error('Erro ao processar QR Code:', err);
      setErro('Erro de conexão. Verifique sua internet.');
    } finally {
      setProcessando(false);
    }
  };

  /**
   * Importa NF-e atual como parada
   */
  const handleImportar = async () => {
    if (!resultado) return;

    setProcessando(true);
    
    try {
      // Por enquanto, adiciona localmente sem backend
      // TODO: Integrar com rotaId quando tiver rota ativa
      const novaParada: ParadaImportada = {
        id: `qr-${Date.now()}`,
        chaveNfe: resultado.chaveAcesso,
        nome: resultado.nomeDestinatario || 'Destinatário',
        endereco: resultado.endereco || 'Endereço não disponível'
      };

      // Adiciona ao store local
      addDestino({
        id: novaParada.id,
        endereco: novaParada.endereco,
        observacao: `NF-e: ${resultado.chaveAcesso.slice(-8)}`,
        fornecedor: 'outro'
      });

      setImportados(prev => [...prev, novaParada]);
      setResultado(null);
      setInputQrCode('');

    } catch (err) {
      console.error('Erro ao importar:', err);
      setErro('Erro ao importar parada');
    } finally {
      setProcessando(false);
    }
  };

  /**
   * Remove parada importada
   */
  const handleRemover = (id: string) => {
    setImportados(prev => prev.filter(p => p.id !== id));
    // TODO: Remover do store também
  };

  /**
   * Finaliza e vai para próxima tela
   */
  const handleFinalizar = () => {
    pararCamera();
    setEtapa('destinos');
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="qrcode-scanner">
      {/* Header */}
      <header className="qrcode-scanner__header">
        <button 
          className="qrcode-scanner__back"
          onClick={() => { pararCamera(); setEtapa('home'); }}
        >
          ←
        </button>
        <h1 className="qrcode-scanner__title">📱 Scanner QR Code NF-e</h1>
      </header>

      {/* Área Scanner */}
      <section className="scanner-area">
        {/* Toggle Modo */}
        <div className="scanner-area__mode-toggle">
          <button 
            className={`mode-button ${modo === 'camera' ? 'active' : ''}`}
            onClick={() => alternarModo('camera')}
          >
            📷 Câmera
          </button>
          <button 
            className={`mode-button ${modo === 'manual' ? 'active' : ''}`}
            onClick={() => alternarModo('manual')}
          >
            ⌨️ Digitar
          </button>
        </div>

        {/* Modo Câmera */}
        {modo === 'camera' && (
          <div className="camera-container">
            {erroCamera ? (
              <div className="camera-error">
                <span className="camera-error__icon">📵</span>
                <p className="camera-error__message">{erroCamera}</p>
                <button 
                  className="btn-processar" 
                  style={{ marginTop: '1rem' }}
                  onClick={iniciarCamera}
                >
                  🔄 Tentar Novamente
                </button>
              </div>
            ) : (
              <>
                <video 
                  ref={videoRef} 
                  className="camera-video"
                  playsInline
                  muted
                />
                <div className="camera-overlay">
                  <div className="scan-frame">
                    {cameraAtiva && (
                      <span className="scanning-indicator">
                        Aponte para o QR Code
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Modo Manual */}
        {modo === 'manual' && (
          <div className="manual-input">
            <div className="manual-input__field">
              <textarea
                className="manual-input__textarea"
                placeholder="Cole aqui o conteúdo do QR Code ou a chave de acesso (44 dígitos)...

Exemplos aceitos:
• Chave: 35240107418764000106550010000123451234567890
• URL: https://www.nfce.fazenda.sp.gov.br?chNFe=..."
                value={inputQrCode}
                onChange={(e) => setInputQrCode(e.target.value)}
                disabled={processando}
              />
              <p className="manual-input__hint">
                Aceita URL completa, chave de 44 dígitos ou código de barras
              </p>
            </div>

            <div className="manual-input__buttons">
              <button
                className="btn-processar"
                onClick={() => processarQrCode(inputQrCode)}
                disabled={processando || !inputQrCode.trim()}
              >
                {processando ? (
                  <>
                    <span className="spinner" />
                    Processando...
                  </>
                ) : (
                  <>
                    🔍 Processar QR Code
                  </>
                )}
              </button>
              
              {inputQrCode && (
                <button
                  className="btn-limpar"
                  onClick={() => { setInputQrCode(''); setResultado(null); setErro(null); }}
                  disabled={processando}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* Erro */}
        {erro && (
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            color: '#dc2626',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            marginTop: '1rem',
            fontSize: '0.875rem'
          }}>
            ⚠️ {erro}
          </div>
        )}
      </section>

      {/* Resultado */}
      {resultado && (
        <section className="scan-result">
          <div className="scan-result__header">
            <div className={`scan-result__icon ${resultado.nomeDestinatario ? 'success' : 'error'}`}>
              {resultado.nomeDestinatario ? '✅' : '⚠️'}
            </div>
            <div className="scan-result__info">
              <h3>{resultado.nomeDestinatario || 'Chave Extraída'}</h3>
              <p>Tipo: {resultado.tipoQrCode}</p>
            </div>
          </div>

          <div className="scan-result__details">
            <div className="scan-result__row">
              <span className="scan-result__label">Chave:</span>
              <span className="scan-result__value" style={{ fontFamily: 'monospace', fontSize: '0.6875rem' }}>
                {resultado.chaveAcesso}
              </span>
            </div>
            
            {resultado.endereco && (
              <div className="scan-result__row">
                <span className="scan-result__label">Endereço:</span>
                <span className="scan-result__value">{resultado.endereco}</span>
              </div>
            )}
            
            {resultado.valor && (
              <div className="scan-result__row">
                <span className="scan-result__label">Valor:</span>
                <span className="scan-result__value">
                  R$ {resultado.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            
            {resultado.dataEmissao && (
              <div className="scan-result__row">
                <span className="scan-result__label">Emissão:</span>
                <span className="scan-result__value">
                  {new Date(resultado.dataEmissao).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )}
          </div>

          <div className="scan-result__actions">
            <button 
              className="btn-importar"
              onClick={handleImportar}
              disabled={processando}
            >
              {processando ? (
                <span className="spinner" />
              ) : (
                <>📍 Adicionar à Rota</>
              )}
            </button>
            <button 
              className="btn-novo-scan"
              onClick={() => { setResultado(null); setInputQrCode(''); }}
            >
              🔄 Novo
            </button>
          </div>
        </section>
      )}

      {/* Lista de Importados */}
      {importados.length > 0 && (
        <section className="importados-lista">
          <div className="importados-lista__header">
            <h3>Paradas Importadas</h3>
            <span className="importados-lista__count">{importados.length}</span>
          </div>

          {importados.map((parada) => (
            <div key={parada.id} className="importado-card">
              <div className="importado-card__icon">📦</div>
              <div className="importado-card__info">
                <div className="importado-card__nome">{parada.nome}</div>
                <div className="importado-card__endereco">{parada.endereco}</div>
                <div className="importado-card__chave">
                  ...{parada.chaveNfe.slice(-12)}
                </div>
              </div>
              <button 
                className="importado-card__remover"
                onClick={() => handleRemover(parada.id)}
              >
                🗑️
              </button>
            </div>
          ))}

          <button 
            className="btn-finalizar"
            onClick={handleFinalizar}
          >
            ✅ Continuar para Destinos ({importados.length} paradas)
          </button>
        </section>
      )}

      {/* Empty State */}
      {importados.length === 0 && !resultado && (
        <section className="importados-lista">
          <div className="empty-state">
            <div className="empty-state__icon">📦</div>
            <p className="empty-state__text">
              Escaneie ou digite QR Codes de NF-e para adicionar paradas automaticamente
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

export default TelaQrCodeScanner;
