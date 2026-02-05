/**
 * @fileoverview Componentes de Re-otimização Dinâmica
 *
 * COMPONENTES:
 * - ModalReotimizacao: Modal com opções de re-otimização
 * - BotaoReotimizar: Botão de ação rápida
 * - AcoesParada: Menu de ações por parada
 * - AlertaReotimizacao: Alerta inteligente
 *
 * DESIGN POR CONTRATO:
 * @pre Rota em andamento
 * @post UI para ações de re-otimização
 */

import { useState, useEffect } from 'react';
import {
  MotivoReotimizacao,
  CenarioInfo,
  ReotimizacaoResult,
  acoes,
  listarCenarios,
  verificarTrafego,
  verificarAtrasos,
} from '../services/reotimizacao';
import './Reotimizacao.css';

// ==========================================
// TIPOS
// ==========================================

interface ModalReotimizacaoProps {
  rotaId: string;
  paradaId?: string;
  paradaNome?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: ReotimizacaoResult) => void;
}

interface BotaoReotimizarProps {
  onClick: () => void;
  variant?: 'primary' | 'danger' | 'warning';
}

interface AcoesParadaProps {
  rotaId: string;
  paradaId: string;
  paradaNome: string;
  onSuccess: (result: ReotimizacaoResult) => void;
}

interface AlertaReotimizacaoProps {
  rotaId: string;
  onReotimizar: (motivo: MotivoReotimizacao) => void;
}

// ==========================================
// COMPONENTES
// ==========================================

/**
 * Modal de Re-otimização com opções
 */
export function ModalReotimizacao({
  rotaId,
  paradaId,
  paradaNome,
  isOpen,
  onClose,
  onSuccess,
}: ModalReotimizacaoProps) {
  const [cenarios, setCenarios] = useState<CenarioInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ReotimizacaoResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      listarCenarios().then(setCenarios);
    }
  }, [isOpen]);

  const handleAcao = async (motivo: MotivoReotimizacao) => {
    setLoading(true);
    setErro(null);
    setResultado(null);

    try {
      let result: ReotimizacaoResult;

      switch (motivo) {
        case 'CANCELAMENTO':
          if (!paradaId) throw new Error('Parada não selecionada');
          result = await acoes.cancelar(rotaId, paradaId);
          break;
        case 'CLIENTE_AUSENTE':
          if (!paradaId) throw new Error('Parada não selecionada');
          result = await acoes.clienteAusente(rotaId, paradaId);
          break;
        case 'ENDERECO_INCORRETO':
          if (!paradaId) throw new Error('Parada não selecionada');
          result = await acoes.enderecoIncorreto(rotaId, paradaId);
          break;
        case 'TRAFEGO_INTENSO':
          result = await acoes.trafego(rotaId);
          break;
        case 'ATRASO_ACUMULADO':
          result = await acoes.atraso(rotaId);
          break;
        default:
          throw new Error('Ação não implementada');
      }

      setResultado(result);
      onSuccess(result);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Filtrar cenários baseado em ter paradaId ou não
  const cenariosDisponiveis = paradaId
    ? cenarios
    : cenarios.filter(c => !c.requerParadaId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-reotimizacao" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Re-otimizar Rota</h2>
          <button className="btn-fechar" onClick={onClose}>
            ✕
          </button>
        </header>

        {paradaNome && (
          <div className="parada-selecionada">
            <span className="label">Parada:</span>
            <span className="nome">{paradaNome}</span>
          </div>
        )}

        {resultado ? (
          <div className="resultado-container">
            <div className={`resultado ${resultado.success ? 'sucesso' : 'erro'}`}>
              <span className="icone">{resultado.success ? '✅' : '❌'}</span>
              <div className="detalhes">
                <p className="mensagem">{resultado.mensagem}</p>
                <p className="acao">{resultado.acaoTomada}</p>
                {resultado.economiaKm && resultado.economiaKm > 0 && (
                  <p className="economia">
                    Economia: {resultado.economiaKm.toFixed(1)} km / {resultado.economiaMin?.toFixed(0)} min
                  </p>
                )}
              </div>
            </div>
            <button className="btn-fechar-modal" onClick={onClose}>
              Fechar
            </button>
          </div>
        ) : (
          <div className="cenarios-lista">
            {erro && <div className="erro-mensagem">{erro}</div>}

            {cenariosDisponiveis.map(cenario => (
              <button
                key={cenario.motivo}
                className={`cenario-btn ${loading ? 'disabled' : ''}`}
                onClick={() => handleAcao(cenario.motivo)}
                disabled={loading}
              >
                <span className="icone">{cenario.icone}</span>
                <div className="info">
                  <span className="nome">{cenario.nome}</span>
                  <span className="descricao">{cenario.descricao}</span>
                </div>
                <span className="seta">→</span>
              </button>
            ))}

            {loading && (
              <div className="loading">
                <span className="spinner" />
                Recalculando rota...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Botão de re-otimização rápida
 */
export function BotaoReotimizar({
  onClick,
  variant = 'primary',
}: BotaoReotimizarProps) {
  return (
    <button className={`btn-reotimizar ${variant}`} onClick={onClick}>
      🔄 Recalcular Rota
    </button>
  );
}

/**
 * Menu de ações para uma parada específica
 */
export function AcoesParada({
  rotaId,
  paradaId,
  paradaNome,
  onSuccess,
}: AcoesParadaProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAcaoRapida = async (
    acao: 'cancelar' | 'ausente' | 'endereco'
  ) => {
    setLoading(true);
    try {
      let result: ReotimizacaoResult;
      switch (acao) {
        case 'cancelar':
          result = await acoes.cancelar(rotaId, paradaId);
          break;
        case 'ausente':
          result = await acoes.clienteAusente(rotaId, paradaId);
          break;
        case 'endereco':
          result = await acoes.enderecoIncorreto(rotaId, paradaId);
          break;
      }
      onSuccess(result);
    } catch (error) {
      console.error('Erro na ação rápida:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="acoes-parada">
      <button
        className="btn-acao cancelar"
        onClick={() => handleAcaoRapida('cancelar')}
        disabled={loading}
        title="Cancelar entrega"
      >
        ❌
      </button>
      <button
        className="btn-acao ausente"
        onClick={() => handleAcaoRapida('ausente')}
        disabled={loading}
        title="Cliente ausente"
      >
        🏠
      </button>
      <button
        className="btn-acao mais"
        onClick={() => setIsModalOpen(true)}
        disabled={loading}
        title="Mais opções"
      >
        ⋮
      </button>

      <ModalReotimizacao
        rotaId={rotaId}
        paradaId={paradaId}
        paradaNome={paradaNome}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={result => {
          setIsModalOpen(false);
          onSuccess(result);
        }}
      />
    </div>
  );
}

/**
 * Alerta inteligente de re-otimização
 * Verifica tráfego e atrasos automaticamente
 */
export function AlertaReotimizacao({
  rotaId,
  onReotimizar,
}: AlertaReotimizacaoProps) {
  const [alerta, setAlerta] = useState<{
    tipo: 'trafego' | 'atraso' | null;
    mensagem: string;
  } | null>(null);

  useEffect(() => {
    const verificar = async () => {
      try {
        // Verificar tráfego
        const trafego = await verificarTrafego(rotaId);
        if (trafego.requerReotimizacao) {
          setAlerta({
            tipo: 'trafego',
            mensagem: trafego.sugestao,
          });
          return;
        }

        // Verificar atrasos
        const atrasos = await verificarAtrasos(rotaId);
        if (atrasos.requerReotimizacao) {
          setAlerta({
            tipo: 'atraso',
            mensagem: atrasos.sugestao,
          });
          return;
        }

        setAlerta(null);
      } catch (error) {
        console.error('Erro na verificação:', error);
      }
    };

    // Verificar a cada 5 minutos
    verificar();
    const interval = setInterval(verificar, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [rotaId]);

  if (!alerta) return null;

  return (
    <div className={`alerta-reotimizacao ${alerta.tipo}`}>
      <span className="icone">{alerta.tipo === 'trafego' ? '🚗' : '⏰'}</span>
      <span className="mensagem">{alerta.mensagem}</span>
      <button
        className="btn-reotimizar-alerta"
        onClick={() =>
          onReotimizar(
            alerta.tipo === 'trafego' ? 'TRAFEGO_INTENSO' : 'ATRASO_ACUMULADO'
          )
        }
      >
        Recalcular
      </button>
      <button className="btn-fechar-alerta" onClick={() => setAlerta(null)}>
        ✕
      </button>
    </div>
  );
}

export default {
  ModalReotimizacao,
  BotaoReotimizar,
  AcoesParada,
  AlertaReotimizacao,
};
