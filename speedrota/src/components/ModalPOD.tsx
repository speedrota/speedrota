/**
 * @file ModalPOD.tsx
 * @description Modal para registrar Proof of Delivery (comprovante de entrega)
 * 
 * Design por Contrato:
 * @pre parada válida passada como prop
 * @pre usuário com plano que permite POD
 * @post POD registrado e parada marcada como entregue
 */

import { useState, useEffect } from 'react';
import { usePOD, type TipoPOD } from '../hooks/usePOD';
import './ModalPOD.css';

// ==========================================
// TIPOS
// ==========================================

interface Parada {
  id: string;
  nome: string;
  endereco: string;
  cidade: string;
  uf: string;
}

interface ModalPODProps {
  parada: Parada;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (paradaId: string) => void;
}

// ==========================================
// COMPONENTE
// ==========================================

export function ModalPOD({ parada, isOpen, onClose, onSuccess }: ModalPODProps) {
  const { 
    loading, 
    error, 
    registrarPOD, 
    capturarFoto,
    obterGeolocalizacao 
  } = usePOD();

  // Estado local
  const [tipo, setTipo] = useState<TipoPOD>('FOTO');
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [geolocalizacao, setGeolocalizacao] = useState<{
    latitude: number;
    longitude: number;
    precisaoGps: number;
  } | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Obter geolocalização ao abrir modal
  useEffect(() => {
    if (isOpen) {
      setLoadingGeo(true);
      obterGeolocalizacao().then((geo) => {
        setGeolocalizacao(geo);
        setLoadingGeo(false);
      });
    }
  }, [isOpen, obterGeolocalizacao]);

  // Limpar estado ao fechar
  useEffect(() => {
    if (!isOpen) {
      setTipo('FOTO');
      setFotoBase64(null);
      setCodigo('');
      setObservacao('');
      setLocalError(null);
    }
  }, [isOpen]);

  // Handlers
  const handleCapturarFoto = async () => {
    const foto = await capturarFoto();
    if (foto) {
      setFotoBase64(foto);
      setLocalError(null);
    }
  };

  const handleSubmit = async () => {
    setLocalError(null);

    // Validações
    if (!geolocalizacao) {
      setLocalError('Aguarde a obtenção da localização');
      return;
    }

    if (tipo === 'FOTO' && !fotoBase64) {
      setLocalError('Tire uma foto da entrega');
      return;
    }

    if (tipo === 'CODIGO' && (!codigo || codigo.length < 4)) {
      setLocalError('Digite o código de entrega (mínimo 4 caracteres)');
      return;
    }

    // Registrar POD
    const resultado = await registrarPOD({
      paradaId: parada.id,
      tipo,
      fotoBase64: tipo === 'FOTO' ? fotoBase64! : undefined,
      codigo: tipo === 'CODIGO' ? codigo : undefined,
      latitude: geolocalizacao.latitude,
      longitude: geolocalizacao.longitude,
      precisaoGps: geolocalizacao.precisaoGps,
      observacao: observacao || undefined,
    });

    if (resultado) {
      onSuccess(parada.id);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-pod" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-pod-header">
          <h3>📸 Comprovante de Entrega</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Parada Info */}
        <div className="modal-pod-parada">
          <div className="pod-parada-nome">{parada.nome}</div>
          <div className="pod-parada-endereco">
            {parada.endereco}, {parada.cidade}-{parada.uf}
          </div>
        </div>

        {/* Tipo de POD */}
        <div className="pod-tipo-selector">
          <button
            className={`pod-tipo-btn ${tipo === 'FOTO' ? 'active' : ''}`}
            onClick={() => setTipo('FOTO')}
          >
            📷 Foto
          </button>
          <button
            className={`pod-tipo-btn ${tipo === 'CODIGO' ? 'active' : ''}`}
            onClick={() => setTipo('CODIGO')}
          >
            🔢 Código
          </button>
        </div>

        {/* Conteúdo baseado no tipo */}
        <div className="pod-content">
          {tipo === 'FOTO' && (
            <div className="pod-foto-section">
              {fotoBase64 ? (
                <div className="pod-foto-preview">
                  <img src={fotoBase64} alt="Comprovante" />
                  <button 
                    className="pod-foto-refazer"
                    onClick={handleCapturarFoto}
                  >
                    📷 Tirar outra foto
                  </button>
                </div>
              ) : (
                <button 
                  className="pod-foto-capturar"
                  onClick={handleCapturarFoto}
                >
                  <span className="pod-foto-icon">📷</span>
                  <span>Tirar foto da entrega</span>
                </button>
              )}
            </div>
          )}

          {tipo === 'CODIGO' && (
            <div className="pod-codigo-section">
              <label className="form-label">Código de confirmação:</label>
              <input
                type="text"
                className="form-control"
                placeholder="Digite o código informado pelo cliente"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                maxLength={20}
              />
              <small className="form-hint">
                Mínimo 4 caracteres
              </small>
            </div>
          )}

          {/* Observação */}
          <div className="pod-observacao-section">
            <label className="form-label">Observação (opcional):</label>
            <textarea
              className="form-control"
              placeholder="Ex: Entregue ao porteiro"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>

          {/* Status da geolocalização */}
          <div className="pod-geo-status">
            {loadingGeo ? (
              <span className="geo-loading">📍 Obtendo localização...</span>
            ) : geolocalizacao ? (
              <span className="geo-ok">
                ✅ Localização obtida (precisão: {Math.round(geolocalizacao.precisaoGps)}m)
              </span>
            ) : (
              <span className="geo-error">❌ Não foi possível obter localização</span>
            )}
          </div>
        </div>

        {/* Erros */}
        {(error || localError) && (
          <div className="pod-error">
            ⚠️ {error || localError}
          </div>
        )}

        {/* Footer */}
        <div className="modal-pod-footer">
          <button 
            className="btn btn-secondary" 
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button 
            className="btn btn-success"
            onClick={handleSubmit}
            disabled={loading || loadingGeo || !geolocalizacao}
          >
            {loading ? 'Registrando...' : '✅ Confirmar Entrega'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModalPOD;
