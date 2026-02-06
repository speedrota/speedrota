/**
 * @fileoverview Modal de Confirmação/Edição de Dados OCR
 * 
 * Sempre mostra os dados extraídos pelo OCR (mesmo parciais)
 * Permite ao usuário editar antes de adicionar como destino
 * 
 * DESIGN POR CONTRATO:
 * @pre dadosOCR pode ter campos vazios
 * @post SEMPRE mostra algo para o usuário editar
 * @invariant Não permite adicionar com endereço E cidade vazios
 */

import { useState, useEffect } from 'react';
import type { DadosNFe, Fornecedor } from '../types';
import { FORNECEDORES_CONFIG } from '../types';

interface ModalConfirmarOCRProps {
  /** Dados extraídos pelo OCR (podem estar incompletos) */
  dados: DadosNFe | null;
  /** Texto bruto do OCR para referência */
  textoOCR?: string;
  /** Se está processando */
  processando: boolean;
  /** Callback quando confirmar */
  onConfirmar: (dados: DadosNFe) => void;
  /** Callback quando cancelar */
  onCancelar: () => void;
  /** Callback para pular e pegar próxima foto */
  onPular?: () => void;
  /** Quantas fotos restam na fila */
  fotosRestantes?: number;
}

export function ModalConfirmarOCR({
  dados,
  textoOCR,
  processando,
  onConfirmar,
  onCancelar,
  onPular,
  fotosRestantes = 0,
}: ModalConfirmarOCRProps) {
  // Estados editáveis
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('SP');
  const [cep, setCep] = useState('');
  const [fornecedor, setFornecedor] = useState<Fornecedor>('outro');
  const [mostrarTextoOCR, setMostrarTextoOCR] = useState(false);
  
  // Inicializar com dados do OCR
  useEffect(() => {
    if (dados) {
      setNome(dados.destinatario.nome || '');
      setEndereco(dados.destinatario.endereco || '');
      setNumero(dados.destinatario.numero || '');
      setComplemento(dados.destinatario.complemento || '');
      setBairro(dados.destinatario.bairro || '');
      setCidade(dados.destinatario.cidade || '');
      setUf(dados.destinatario.uf || 'SP');
      setCep(dados.destinatario.cep || '');
      setFornecedor(dados.fornecedor || 'outro');
    }
  }, [dados]);
  
  const handleConfirmar = () => {
    // Validar mínimo
    if (!endereco.trim() && !cidade.trim() && !cep.trim()) {
      alert('Preencha pelo menos o endereço, cidade ou CEP');
      return;
    }
    
    const dadosEditados: DadosNFe = {
      numero: dados?.numero || '',
      fornecedor,
      destinatario: {
        nome: nome.trim() || 'Destinatário',
        endereco: endereco.trim(),
        numero: numero.trim() || 'S/N',
        complemento: complemento.trim(),
        bairro: bairro.trim(),
        cidade: cidade.trim(),
        uf: uf.trim() || 'SP',
        cep: cep.trim(),
      },
      confiancaOCR: dados?.confiancaOCR || 0.5,
    };
    
    onConfirmar(dadosEditados);
  };
  
  // Calcular qualidade da extração
  const camposPreenchidos = [nome, endereco, bairro, cidade, cep].filter(Boolean).length;
  const qualidade = camposPreenchidos >= 4 ? 'boa' : camposPreenchidos >= 2 ? 'média' : 'baixa';
  const corQualidade = qualidade === 'boa' ? '#22c55e' : qualidade === 'média' ? '#f59e0b' : '#ef4444';
  
  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
    }}>
      <div className="modal-content" style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8fafc',
          borderRadius: '12px 12px 0 0',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
              📝 Confirmar Dados OCR
            </h3>
            {fotosRestantes > 0 && (
              <small style={{ color: '#6b7280' }}>
                +{fotosRestantes} foto(s) na fila
              </small>
            )}
          </div>
          <div style={{
            padding: '4px 12px',
            borderRadius: '12px',
            backgroundColor: corQualidade,
            color: 'white',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}>
            Extração {qualidade}
          </div>
        </div>
        
        {/* Processando */}
        {processando && (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
          }}>
            <div className="loading-spinner" style={{ 
              width: '40px', 
              height: '40px', 
              margin: '0 auto 1rem' 
            }}></div>
            <p>Processando OCR...</p>
          </div>
        )}
        
        {/* Form de edição */}
        {!processando && (
          <div style={{ padding: '1rem' }}>
            {/* Nome do destinatário */}
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.25rem', 
                fontWeight: 500,
                fontSize: '0.875rem',
              }}>
                👤 Nome do Destinatário
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do cliente"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '1rem',
                }}
              />
            </div>
            
            {/* Endereço */}
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.25rem', 
                fontWeight: 500,
                fontSize: '0.875rem',
                color: !endereco ? '#ef4444' : undefined,
              }}>
                📍 Endereço *
              </label>
              <input
                type="text"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, Avenida..."
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: `1px solid ${!endereco ? '#ef4444' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '1rem',
                }}
              />
            </div>
            
            {/* Número e Complemento */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.25rem', 
                  fontWeight: 500,
                  fontSize: '0.875rem',
                }}>
                  Nº
                </label>
                <input
                  type="text"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="123"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                  }}
                />
              </div>
              <div style={{ flex: 2 }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.25rem', 
                  fontWeight: 500,
                  fontSize: '0.875rem',
                }}>
                  Complemento
                </label>
                <input
                  type="text"
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                  placeholder="Apto, Bloco..."
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                  }}
                />
              </div>
            </div>
            
            {/* Bairro */}
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.25rem', 
                fontWeight: 500,
                fontSize: '0.875rem',
              }}>
                🏘️ Bairro
              </label>
              <input
                type="text"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                placeholder="Bairro"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                }}
              />
            </div>
            
            {/* Cidade e UF */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{ flex: 3 }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.25rem', 
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  color: !cidade && !cep ? '#ef4444' : undefined,
                }}>
                  🏙️ Cidade *
                </label>
                <input
                  type="text"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="Cidade"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: `1px solid ${!cidade && !cep ? '#ef4444' : '#d1d5db'}`,
                    borderRadius: '6px',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.25rem', 
                  fontWeight: 500,
                  fontSize: '0.875rem',
                }}>
                  UF
                </label>
                <select
                  value={uf}
                  onChange={(e) => setUf(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                  }}
                >
                  {['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'GO', 'DF', 'PE', 'CE', 'ES', 'MS', 'MT', 'PA', 'AM'].map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* CEP */}
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.25rem', 
                fontWeight: 500,
                fontSize: '0.875rem',
              }}>
                📮 CEP
              </label>
              <input
                type="text"
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                placeholder="00000-000"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                }}
              />
            </div>
            
            {/* Fornecedor */}
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.25rem', 
                fontWeight: 500,
                fontSize: '0.875rem',
              }}>
                🏷️ Fornecedor
              </label>
              <select
                value={fornecedor}
                onChange={(e) => setFornecedor(e.target.value as Fornecedor)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                }}
              >
                {Object.entries(FORNECEDORES_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.emoji} {config.nome}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Mostrar texto OCR bruto */}
            <button
              type="button"
              onClick={() => setMostrarTextoOCR(!mostrarTextoOCR)}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                fontSize: '0.75rem',
                cursor: 'pointer',
                padding: '0.25rem 0',
                marginBottom: '0.5rem',
              }}
            >
              {mostrarTextoOCR ? '▼' : '▶'} Ver texto OCR bruto
            </button>
            
            {mostrarTextoOCR && textoOCR && (
              <pre style={{
                background: '#f3f4f6',
                padding: '0.5rem',
                borderRadius: '6px',
                fontSize: '0.65rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '150px',
                overflow: 'auto',
                marginBottom: '0.75rem',
              }}>
                {textoOCR.substring(0, 1000)}
                {textoOCR.length > 1000 && '...'}
              </pre>
            )}
          </div>
        )}
        
        {/* Footer com botões */}
        {!processando && (
          <div style={{
            padding: '1rem',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}>
            <button
              onClick={onCancelar}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                background: 'white',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              ❌ Cancelar
            </button>
            
            {onPular && fotosRestantes > 0 && (
              <button
                onClick={onPular}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: '1px solid #f59e0b',
                  borderRadius: '8px',
                  background: '#fef3c7',
                  cursor: 'pointer',
                  fontWeight: 500,
                  color: '#92400e',
                }}
              >
                ⏭️ Pular
              </button>
            )}
            
            <button
              onClick={handleConfirmar}
              style={{
                flex: 2,
                padding: '0.75rem',
                border: 'none',
                borderRadius: '8px',
                background: '#2563eb',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              ✅ Confirmar e Adicionar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
