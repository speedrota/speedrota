/**
 * @fileoverview Tela de Definição de Origem e Ponto de Retorno
 * 
 * REGRA DE NEGÓCIO:
 * - Origem = localização atual do entregador (GPS) OU entrada manual
 * - Ponto de Retorno = onde voltar após última entrega (pode ser diferente da origem)
 * - NUNCA usar remetente da NF-e como origem
 */

import { useState } from 'react';
import { useRouteStore } from '../store/routeStore';
import { capturarLocalizacaoGPS, isGeolocationAvailable, geocodificarEndereco } from '../services/geolocalizacao';
import { MapaSimples } from './Mapa';
import type { Origem } from '../types';

export function TelaOrigem() {
  const { 
    origem, 
    pontoRetorno,
    definirOrigem, 
    definirPontoRetorno,
    irPara, 
    carregando, 
    setCarregando, 
    erro, 
    setErro 
  } = useRouteStore();
  
  const [etapa, setEtapa] = useState<'origem' | 'retorno'>('origem');
  const [modoManual, setModoManual] = useState(false);
  const [enderecoManual, setEnderecoManual] = useState('');
  const [cidadeManual, setCidadeManual] = useState('');
  const [ufManual, setUfManual] = useState('SP');
  const [origemTemp, setOrigemTemp] = useState<Origem | null>(origem);
  const [retornoTemp, setRetornoTemp] = useState<Origem | null>(pontoRetorno);
  const [usarOrigemComoRetorno, setUsarOrigemComoRetorno] = useState(pontoRetorno === null);
  
  // Capturar GPS
  const handleCapturarGPS = async () => {
    if (!isGeolocationAvailable()) {
      setErro('Geolocalização não disponível neste navegador');
      return;
    }
    
    setCarregando(true);
    setErro(null);
    
    try {
      const localizacao = await capturarLocalizacaoGPS();
      if (etapa === 'origem') {
        setOrigemTemp(localizacao);
      } else {
        setRetornoTemp(localizacao);
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao capturar localização');
    } finally {
      setCarregando(false);
    }
  };
  
  // Geocodificar endereço manual
  const handleGeocodificarManual = async () => {
    if (!enderecoManual.trim()) {
      setErro('Digite o endereço');
      return;
    }
    
    setCarregando(true);
    setErro(null);
    
    try {
      const resultado = await geocodificarEndereco(enderecoManual, cidadeManual, ufManual);
      
      const novoPonto: Origem = {
        lat: resultado.lat,
        lng: resultado.lng,
        endereco: resultado.enderecoFormatado || `${enderecoManual}, ${cidadeManual}-${ufManual}`,
        fonte: 'manual',
        timestamp: new Date(),
      };
      
      if (etapa === 'origem') {
        setOrigemTemp(novoPonto);
      } else {
        setRetornoTemp(novoPonto);
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao geocodificar endereço');
    } finally {
      setCarregando(false);
    }
  };
  
  // Confirmar origem e ir para retorno
  const handleConfirmarOrigem = () => {
    if (!origemTemp) {
      setErro('Defina a origem antes de continuar');
      return;
    }
    
    definirOrigem(origemTemp);
    setEtapa('retorno');
    setModoManual(false);
    setEnderecoManual('');
    setCidadeManual('');
  };
  
  // Finalizar configuração
  const handleFinalizar = () => {
    if (usarOrigemComoRetorno) {
      definirPontoRetorno(origemTemp!);
    } else if (retornoTemp) {
      definirPontoRetorno(retornoTemp);
    } else {
      setErro('Defina o ponto de retorno');
      return;
    }
    
    irPara('destinos');
  };
  
  // ==========================================
  // RENDER ETAPA ORIGEM
  // ==========================================
  
  if (etapa === 'origem') {
    return (
      <div>
        <h2 className="text-center mb-2">📍 Etapa 1: Ponto de Partida</h2>
        
        {/* Alerta de regra de negócio */}
        <div className="alerta alerta-info mb-2">
          <span className="alerta-icon">ℹ️</span>
          <div className="alerta-content">
            <div className="alerta-mensagem">
              A origem é sua localização atual, não o remetente da NF-e
            </div>
          </div>
        </div>
        
        {/* Erro */}
        {erro && (
          <div className="alerta alerta-error mb-2">
            <span className="alerta-icon">❌</span>
            <div className="alerta-content">
              <div className="alerta-mensagem">{erro}</div>
            </div>
          </div>
        )}
        
        {/* Opções de captura */}
        {!modoManual ? (
          <>
            <button 
              className="btn btn-primary btn-lg mb-2"
              onClick={handleCapturarGPS}
              disabled={carregando}
            >
              {carregando ? (
                <>
                  <span className="loading-spinner" style={{ width: '1rem', height: '1rem' }}></span>
                  Obtendo localização...
                </>
              ) : (
                <>📍 Usar minha localização (GPS)</>
              )}
            </button>
            
            <div className="divider">ou</div>
            
            <button 
              className="btn btn-secondary"
              onClick={() => setModoManual(true)}
            >
              ✏️ Digitar endereço manualmente
            </button>
          </>
        ) : (
          <FormularioEndereco 
            enderecoManual={enderecoManual}
            setEnderecoManual={setEnderecoManual}
            cidadeManual={cidadeManual}
            setCidadeManual={setCidadeManual}
            ufManual={ufManual}
            setUfManual={setUfManual}
            onBuscar={handleGeocodificarManual}
            onVoltar={() => setModoManual(false)}
            carregando={carregando}
          />
        )}
        
        {/* Preview da origem selecionada */}
        {origemTemp && (
          <PreviewPonto 
            ponto={origemTemp}
            titulo="✅ Origem Selecionada"
            onConfirmar={handleConfirmarOrigem}
            textoBotao="Próximo: Definir Ponto de Retorno →"
          />
        )}
      </div>
    );
  }
  
  // ==========================================
  // RENDER ETAPA RETORNO
  // ==========================================
  
  return (
    <div>
      <h2 className="text-center mb-2">🏁 Etapa 2: Ponto de Retorno</h2>
      
      {/* Info */}
      <div className="alerta alerta-info mb-2">
        <span className="alerta-icon">ℹ️</span>
        <div className="alerta-content">
          <div className="alerta-mensagem">
            Para onde você vai após a última entrega?
          </div>
        </div>
      </div>
      
      {/* Erro */}
      {erro && (
        <div className="alerta alerta-error mb-2">
          <span className="alerta-icon">❌</span>
          <div className="alerta-content">
            <div className="alerta-mensagem">{erro}</div>
          </div>
        </div>
      )}
      
      {/* Opção: usar origem como retorno */}
      <div className="card mb-2">
        <div className="card-body">
          <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={usarOrigemComoRetorno}
              onChange={(e) => setUsarOrigemComoRetorno(e.target.checked)}
              style={{ width: '20px', height: '20px' }}
            />
            <span>Retornar ao mesmo local da partida</span>
          </label>
          {usarOrigemComoRetorno && origemTemp && (
            <div className="text-sm text-muted mt-1">
              📍 {origemTemp.endereco}
            </div>
          )}
        </div>
      </div>
      
      {/* Se não usar origem como retorno */}
      {!usarOrigemComoRetorno && (
        <>
          {!modoManual ? (
            <>
              <button 
                className="btn btn-primary btn-lg mb-2"
                onClick={handleCapturarGPS}
                disabled={carregando}
              >
                {carregando ? 'Obtendo localização...' : '📍 Usar GPS'}
              </button>
              
              <div className="divider">ou</div>
              
              <button 
                className="btn btn-secondary"
                onClick={() => setModoManual(true)}
              >
                ✏️ Digitar endereço
              </button>
            </>
          ) : (
            <FormularioEndereco 
              enderecoManual={enderecoManual}
              setEnderecoManual={setEnderecoManual}
              cidadeManual={cidadeManual}
              setCidadeManual={setCidadeManual}
              ufManual={ufManual}
              setUfManual={setUfManual}
              onBuscar={handleGeocodificarManual}
              onVoltar={() => setModoManual(false)}
              carregando={carregando}
            />
          )}
          
          {/* Preview do retorno */}
          {retornoTemp && (
            <PreviewPonto 
              ponto={retornoTemp}
              titulo="🏁 Ponto de Retorno"
            />
          )}
        </>
      )}
      
      {/* Botões de ação */}
      <div className="mt-4">
        <button 
          className="btn btn-primary btn-lg mb-2"
          onClick={handleFinalizar}
          disabled={!usarOrigemComoRetorno && !retornoTemp}
        >
          Confirmar e Adicionar Destinos →
        </button>
        
        <button 
          className="btn btn-secondary"
          onClick={() => {
            setEtapa('origem');
            setModoManual(false);
          }}
        >
          ← Voltar para Origem
        </button>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTES AUXILIARES
// ==========================================

interface FormularioEnderecoProps {
  enderecoManual: string;
  setEnderecoManual: (v: string) => void;
  cidadeManual: string;
  setCidadeManual: (v: string) => void;
  ufManual: string;
  setUfManual: (v: string) => void;
  onBuscar: () => void;
  onVoltar: () => void;
  carregando: boolean;
}

function FormularioEndereco({
  enderecoManual,
  setEnderecoManual,
  cidadeManual,
  setCidadeManual,
  ufManual,
  setUfManual,
  onBuscar,
  onVoltar,
  carregando
}: FormularioEnderecoProps) {
  return (
    <>
      <div className="card mb-2">
        <div className="card-body">
          <div className="form-group">
            <label className="form-label">Endereço</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: Av. Paulista, 1000"
              value={enderecoManual}
              onChange={(e) => setEnderecoManual(e.target.value)}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Cidade</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: São Paulo"
              value={cidadeManual}
              onChange={(e) => setCidadeManual(e.target.value)}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">UF</label>
            <select
              className="form-input"
              value={ufManual}
              onChange={(e) => setUfManual(e.target.value)}
            >
              {['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'GO', 'DF', 'PE', 'CE'].map(uf => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>
          
          <button
            className="btn btn-primary"
            onClick={onBuscar}
            disabled={carregando}
          >
            {carregando ? 'Buscando...' : '🔍 Buscar endereço'}
          </button>
        </div>
      </div>
      
      <button 
        className="btn btn-secondary"
        onClick={onVoltar}
      >
        ← Voltar para GPS
      </button>
    </>
  );
}

interface PreviewPontoProps {
  ponto: Origem;
  titulo: string;
  onConfirmar?: () => void;
  textoBotao?: string;
}

function PreviewPonto({ ponto, titulo, onConfirmar, textoBotao }: PreviewPontoProps) {
  return (
    <div className="mt-4">
      <div className="card">
        <div className="card-header">{titulo}</div>
        <div className="card-body">
          <p><strong>{ponto.endereco}</strong></p>
          <p className="text-sm text-muted">
            Coordenadas: {ponto.lat.toFixed(6)}, {ponto.lng.toFixed(6)}
          </p>
          {ponto.fonte === 'gps' && ponto.precisao && (
            <p className="text-sm text-muted">
              Precisão: {ponto.precisao}m
            </p>
          )}
          <p className="text-sm">
            <span className={`destino-badge ${ponto.fonte === 'gps' ? 'badge-ocr' : 'badge-manual'}`}>
              {ponto.fonte === 'gps' ? '📡 GPS' : '✏️ Manual'}
            </span>
          </p>
        </div>
      </div>
      
      {/* Mini mapa */}
      <div className="mt-2">
        <MapaSimples 
          lat={ponto.lat} 
          lng={ponto.lng} 
          endereco={ponto.endereco}
        />
      </div>
      
      {onConfirmar && (
        <button 
          className="btn btn-primary btn-lg mt-2"
          onClick={onConfirmar}
        >
          {textoBotao || 'Confirmar'}
        </button>
      )}
    </div>
  );
}
