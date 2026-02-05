/**
 * @fileoverview Componentes de Status em Tempo Real
 *
 * DESIGN POR CONTRATO:
 * @description UI para tracking de entregas em tempo real
 * @pre Rota existente, usuário autenticado
 * @post Exibe status atualizado via SSE
 *
 * COMPONENTES:
 * - BarraProgresso: Progresso visual da rota
 * - CardMetricas: Métricas em tempo real
 * - ListaParadas: Lista de paradas com status
 * - BotaoAcaoParada: Botões de ação rápida
 * - MapaTracking: Mapa com posição atual
 * - PainelTracking: Painel completo de tracking
 */

import { useEffect, useState, useCallback } from 'react';
import {
  conectarSSE,
  desconectarSSE,
  adicionarEventListener,
  obterStatusRota,
  iniciarRota,
  pausarRota,
  finalizarRota,
  atualizarStatusParada,
  iniciarTracking,
  pararTracking,
  formatarStatus,
  corPorStatus,
  emojiPorStatus,
  formatarMotivoFalha,
  StatusParada,
  StatusRota,
  MotivoFalha,
} from '../services/statusTempoReal';
import type { MetricasTempoReal, Posicao } from '../services/statusTempoReal';
import './StatusTempoReal.css';

// ==========================================
// HOOK: useStatusTempoReal
// ==========================================

interface UseStatusTempoRealReturn {
  metricas: MetricasTempoReal | null;
  paradas: any[];
  statusRota: StatusRota | null;
  posicaoAtual: Posicao | null;
  loading: boolean;
  erro: string | null;
  conectado: boolean;
  iniciar: () => Promise<void>;
  pausar: () => Promise<void>;
  finalizar: () => Promise<void>;
  atualizarParada: (paradaId: string, status: StatusParada, dados?: any) => Promise<void>;
}

export function useStatusTempoReal(rotaId: string | null): UseStatusTempoRealReturn {
  const [metricas, setMetricas] = useState<MetricasTempoReal | null>(null);
  const [paradas, setParadas] = useState<any[]>([]);
  const [statusRota, setStatusRota] = useState<StatusRota | null>(null);
  const [posicaoAtual, setPosicaoAtual] = useState<Posicao | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conectado, setConectado] = useState(false);

  // Carregar status inicial
  useEffect(() => {
    if (!rotaId) return;

    const carregar = async () => {
      setLoading(true);
      try {
        const data = await obterStatusRota(rotaId);
        setMetricas(data.metricas);
        setParadas(data.paradas);
        setStatusRota(data.rota.status as StatusRota);
        setErro(null);
      } catch (e: any) {
        setErro(e.message);
      } finally {
        setLoading(false);
      }
    };

    carregar();
  }, [rotaId]);

  // Conectar SSE
  useEffect(() => {
    if (!rotaId) return;

    const source = conectarSSE(rotaId);
    if (source) {
      setConectado(true);
    }

    // Listeners
    const removerMetricas = adicionarEventListener('METRICAS', (evento) => {
      setMetricas(evento.dados.metricas || null);
      if (evento.dados.status) {
        setStatusRota(evento.dados.status as StatusRota);
      }
    });

    const removerStatus = adicionarEventListener('STATUS_PARADA', (evento) => {
      setMetricas(evento.dados.metricas || null);
      setParadas((prev) =>
        prev.map((p) =>
          p.id === evento.paradaId
            ? { ...p, status: evento.dados.status }
            : p
        )
      );
    });

    const removerRota = adicionarEventListener('STATUS_ROTA', (evento) => {
      if (evento.dados.status) {
        setStatusRota(evento.dados.status as StatusRota);
      }
      if (evento.dados.metricas) {
        setMetricas(evento.dados.metricas);
      }
    });

    const removerPosicao = adicionarEventListener('POSICAO', (evento) => {
      if (evento.dados.posicao) {
        setPosicaoAtual(evento.dados.posicao as Posicao);
      }
    });

    return () => {
      removerMetricas();
      removerStatus();
      removerRota();
      removerPosicao();
      desconectarSSE();
      setConectado(false);
    };
  }, [rotaId]);

  // Ações
  const iniciar = useCallback(async () => {
    if (!rotaId) return;
    setLoading(true);
    try {
      const result = await iniciarRota(rotaId);
      setStatusRota(StatusRota.EM_ANDAMENTO);
      setMetricas(result.metricas);
      // Iniciar tracking de posição
      iniciarTracking(rotaId, setPosicaoAtual);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [rotaId]);

  const pausar = useCallback(async () => {
    if (!rotaId) return;
    setLoading(true);
    try {
      await pausarRota(rotaId);
      setStatusRota(StatusRota.PAUSADA);
      pararTracking();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [rotaId]);

  const finalizarCallback = useCallback(async () => {
    if (!rotaId) return;
    setLoading(true);
    try {
      const result = await finalizarRota(rotaId);
      setStatusRota(StatusRota.CONCLUIDA);
      setMetricas(result.metricas);
      pararTracking();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [rotaId]);

  const atualizarParada = useCallback(
    async (paradaId: string, status: StatusParada, dados?: any) => {
      try {
        const result = await atualizarStatusParada(paradaId, status, dados);
        setMetricas(result.metricas);
        setParadas((prev) =>
          prev.map((p) => (p.id === paradaId ? { ...p, status } : p))
        );
      } catch (e: any) {
        setErro(e.message);
        throw e;
      }
    },
    []
  );

  return {
    metricas,
    paradas,
    statusRota,
    posicaoAtual,
    loading,
    erro,
    conectado,
    iniciar,
    pausar,
    finalizar: finalizarCallback,
    atualizarParada,
  };
}

// ==========================================
// COMPONENTE: BarraProgresso
// ==========================================

interface BarraProgressoProps {
  progresso: number;
  entregues: number;
  total: number;
}

export function BarraProgresso({ progresso, entregues, total }: BarraProgressoProps) {
  return (
    <div className="barra-progresso-container">
      <div className="barra-progresso-info">
        <span className="barra-progresso-texto">
          {entregues} de {total} entregas
        </span>
        <span className="barra-progresso-porcentagem">{progresso}%</span>
      </div>
      <div className="barra-progresso-track">
        <div
          className="barra-progresso-fill"
          style={{ width: `${progresso}%` }}
        />
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTE: CardMetricas
// ==========================================

interface CardMetricasProps {
  metricas: MetricasTempoReal;
}

export function CardMetricas({ metricas }: CardMetricasProps) {
  const formatarTempo = (minutos: number): string => {
    if (minutos < 60) return `${minutos} min`;
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return `${horas}h ${mins}m`;
  };

  return (
    <div className="card-metricas">
      <div className="metricas-grid">
        <div className="metrica-item">
          <span className="metrica-valor">{metricas.entregues}</span>
          <span className="metrica-label">Entregues</span>
        </div>
        <div className="metrica-item">
          <span className="metrica-valor">{metricas.pendentes}</span>
          <span className="metrica-label">Pendentes</span>
        </div>
        <div className="metrica-item falha">
          <span className="metrica-valor">{metricas.falhas}</span>
          <span className="metrica-label">Falhas</span>
        </div>
        <div className="metrica-item">
          <span className="metrica-valor">{formatarTempo(metricas.tempoDecorrido)}</span>
          <span className="metrica-label">Tempo</span>
        </div>
        <div className="metrica-item">
          <span className="metrica-valor">{metricas.kmPercorridos}</span>
          <span className="metrica-label">Km Percorridos</span>
        </div>
        <div className="metrica-item">
          <span className="metrica-valor">{formatarTempo(metricas.tempoEstimadoRestante)}</span>
          <span className="metrica-label">Restante</span>
        </div>
      </div>

      {metricas.proximaParada && (
        <div className="proxima-parada">
          <span className="proxima-label">Próxima:</span>
          <span className="proxima-endereco">{metricas.proximaParada.endereco}</span>
          <span className="proxima-eta">~{metricas.proximaParada.etaMinutos} min</span>
        </div>
      )}
    </div>
  );
}

// ==========================================
// COMPONENTE: ItemParada
// ==========================================

interface ItemParadaProps {
  parada: any;
  onAtualizarStatus: (status: StatusParada, dados?: any) => void;
  emAndamento: boolean;
}

export function ItemParada({ parada, onAtualizarStatus, emAndamento }: ItemParadaProps) {
  const [expandido, setExpandido] = useState(false);
  const [motivoFalha, setMotivoFalha] = useState<MotivoFalha | null>(null);
  const [observacao, setObservacao] = useState('');

  const status = parada.status as StatusParada;
  const podeAtualizar = emAndamento && status !== StatusParada.ENTREGUE && status !== StatusParada.CANCELADO;

  const handleEntregue = () => {
    onAtualizarStatus(StatusParada.ENTREGUE);
  };

  const handleFalha = () => {
    if (motivoFalha) {
      onAtualizarStatus(StatusParada.FALHA, { motivoFalha, observacao });
      setExpandido(false);
      setMotivoFalha(null);
      setObservacao('');
    }
  };

  const handleEmTransito = () => {
    onAtualizarStatus(StatusParada.EM_TRANSITO);
  };

  return (
    <div className={`item-parada ${status.toLowerCase()}`}>
      <div className="parada-header" onClick={() => setExpandido(!expandido)}>
        <div className="parada-ordem">{parada.ordem}</div>
        <div className="parada-info">
          <span className="parada-nome">{parada.nome || 'Destinatário'}</span>
          <span className="parada-endereco">{parada.endereco}</span>
        </div>
        <div className="parada-status" style={{ backgroundColor: corPorStatus(status) }}>
          {emojiPorStatus(status)} {formatarStatus(status)}
        </div>
      </div>

      {expandido && podeAtualizar && (
        <div className="parada-acoes">
          {status === StatusParada.PENDENTE && (
            <button className="btn-acao em-transito" onClick={handleEmTransito}>
              🚗 Indo para lá
            </button>
          )}
          
          {(status === StatusParada.EM_TRANSITO || status === StatusParada.CHEGOU) && (
            <>
              <button className="btn-acao entregue" onClick={handleEntregue}>
                ✅ Entregar
              </button>
              
              <div className="falha-form">
                <select
                  value={motivoFalha || ''}
                  onChange={(e) => setMotivoFalha(e.target.value as MotivoFalha)}
                >
                  <option value="">Motivo da falha...</option>
                  {Object.values(MotivoFalha).map((m) => (
                    <option key={m} value={m}>
                      {formatarMotivoFalha(m)}
                    </option>
                  ))}
                </select>
                
                {motivoFalha && (
                  <>
                    <input
                      type="text"
                      placeholder="Observação (opcional)"
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                    />
                    <button className="btn-acao falha" onClick={handleFalha}>
                      ❌ Registrar Falha
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {status === StatusParada.FALHA && (
            <button className="btn-acao retentar" onClick={handleEmTransito}>
              🔄 Tentar Novamente
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// COMPONENTE: ListaParadas
// ==========================================

interface ListaParadasProps {
  paradas: any[];
  onAtualizarStatus: (paradaId: string, status: StatusParada, dados?: any) => void;
  emAndamento: boolean;
}

export function ListaParadas({ paradas, onAtualizarStatus, emAndamento }: ListaParadasProps) {
  return (
    <div className="lista-paradas">
      {paradas
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
        .map((parada) => (
          <ItemParada
            key={parada.id}
            parada={parada}
            onAtualizarStatus={(status, dados) =>
              onAtualizarStatus(parada.id, status, dados)
            }
            emAndamento={emAndamento}
          />
        ))}
    </div>
  );
}

// ==========================================
// COMPONENTE: ControlesRota
// ==========================================

interface ControlesRotaProps {
  statusRota: StatusRota | null;
  loading: boolean;
  onIniciar: () => void;
  onPausar: () => void;
  onFinalizar: () => void;
}

export function ControlesRota({
  statusRota,
  loading,
  onIniciar,
  onPausar,
  onFinalizar,
}: ControlesRotaProps) {
  return (
    <div className="controles-rota">
      {(statusRota === StatusRota.PLANEJADA || statusRota === StatusRota.PAUSADA) && (
        <button
          className="btn-controle iniciar"
          onClick={onIniciar}
          disabled={loading}
        >
          {statusRota === StatusRota.PAUSADA ? '▶️ Retomar' : '🚀 Iniciar Rota'}
        </button>
      )}

      {statusRota === StatusRota.EM_ANDAMENTO && (
        <>
          <button
            className="btn-controle pausar"
            onClick={onPausar}
            disabled={loading}
          >
            ⏸️ Pausar
          </button>
          <button
            className="btn-controle finalizar"
            onClick={onFinalizar}
            disabled={loading}
          >
            🏁 Finalizar
          </button>
        </>
      )}

      {statusRota === StatusRota.CONCLUIDA && (
        <div className="rota-concluida">
          🎉 Rota Concluída!
        </div>
      )}
    </div>
  );
}

// ==========================================
// COMPONENTE: IndicadorConexao
// ==========================================

interface IndicadorConexaoProps {
  conectado: boolean;
}

export function IndicadorConexao({ conectado }: IndicadorConexaoProps) {
  return (
    <div className={`indicador-conexao ${conectado ? 'conectado' : 'desconectado'}`}>
      <span className="conexao-dot"></span>
      <span className="conexao-texto">
        {conectado ? 'Conectado' : 'Reconectando...'}
      </span>
    </div>
  );
}

// ==========================================
// COMPONENTE: PainelTracking (Principal)
// ==========================================

interface PainelTrackingProps {
  rotaId: string;
}

export function PainelTracking({ rotaId }: PainelTrackingProps) {
  const {
    metricas,
    paradas,
    statusRota,
    posicaoAtual,
    loading,
    erro,
    conectado,
    iniciar,
    pausar,
    finalizar,
    atualizarParada,
  } = useStatusTempoReal(rotaId);

  const emAndamento = statusRota === StatusRota.EM_ANDAMENTO;

  if (loading && !metricas) {
    return <div className="painel-tracking loading">Carregando...</div>;
  }

  if (erro) {
    return <div className="painel-tracking erro">Erro: {erro}</div>;
  }

  return (
    <div className="painel-tracking">
      <div className="tracking-header">
        <h2>
          {emojiPorStatus(statusRota || StatusRota.PLANEJADA)}{' '}
          {formatarStatus(statusRota || StatusRota.PLANEJADA)}
        </h2>
        <IndicadorConexao conectado={conectado} />
      </div>

      {metricas && (
        <>
          <BarraProgresso
            progresso={metricas.progresso}
            entregues={metricas.entregues}
            total={metricas.totalParadas}
          />
          <CardMetricas metricas={metricas} />
        </>
      )}

      <ControlesRota
        statusRota={statusRota}
        loading={loading}
        onIniciar={iniciar}
        onPausar={pausar}
        onFinalizar={finalizar}
      />

      <ListaParadas
        paradas={paradas}
        onAtualizarStatus={atualizarParada}
        emAndamento={emAndamento}
      />

      {posicaoAtual && (
        <div className="posicao-atual">
          📍 Posição: {posicaoAtual.lat.toFixed(6)}, {posicaoAtual.lng.toFixed(6)}
          {posicaoAtual.velocidade && (
            <span className="velocidade"> • {posicaoAtual.velocidade.toFixed(0)} km/h</span>
          )}
        </div>
      )}
    </div>
  );
}

export default PainelTracking;
