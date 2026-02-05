/**
 * @fileoverview Componentes de Notificações
 *
 * COMPONENTES:
 * - BadgeNotificacoes: Badge com contador
 * - CentralNotificacoes: Painel de notificações
 * - ItemNotificacao: Item individual
 * - ToggleNotificacoes: Switch para ativar/desativar
 *
 * DESIGN POR CONTRATO:
 * @pre Usuário autenticado
 * @post UI de notificações funcional
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Notificacao,
  listarNotificacoes,
  contarNaoLidas,
  marcarComoLida,
  marcarTodasComoLidas,
  registrarSubscription,
  removerSubscription,
  estaInscrito,
  obterPermissao,
  formatarDataRelativa,
  obterIconePorTipo,
} from '../services/notificacoes';
import './Notificacoes.css';

// ==========================================
// TIPOS
// ==========================================

interface BadgeNotificacoesProps {
  onClick: () => void;
}

interface CentralNotificacoesProps {
  isOpen: boolean;
  onClose: () => void;
  onNotificacaoClick?: (notificacao: Notificacao) => void;
}

interface ItemNotificacaoProps {
  notificacao: Notificacao;
  onClick: (notificacao: Notificacao) => void;
}

interface ToggleNotificacoesProps {
  onChange?: (ativo: boolean) => void;
}

// ==========================================
// BADGE DE NOTIFICAÇÕES
// ==========================================

/**
 * Badge com ícone de sino e contador
 */
export function BadgeNotificacoes({ onClick }: BadgeNotificacoesProps) {
  const [naoLidas, setNaoLidas] = useState(0);

  useEffect(() => {
    const carregar = async () => {
      try {
        const count = await contarNaoLidas();
        setNaoLidas(count);
      } catch {
        // Silently fail
      }
    };

    carregar();

    // Atualizar a cada 30 segundos
    const interval = setInterval(carregar, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <button className="badge-notificacoes" onClick={onClick} title="Notificações">
      <span className="icone">🔔</span>
      {naoLidas > 0 && (
        <span className="contador">{naoLidas > 99 ? '99+' : naoLidas}</span>
      )}
    </button>
  );
}

// ==========================================
// ITEM DE NOTIFICAÇÃO
// ==========================================

/**
 * Item individual de notificação
 */
export function ItemNotificacao({ notificacao, onClick }: ItemNotificacaoProps) {
  const icone = notificacao.icone || obterIconePorTipo(notificacao.tipo);

  return (
    <button
      className={`item-notificacao ${notificacao.lida ? 'lida' : 'nao-lida'}`}
      onClick={() => onClick(notificacao)}
    >
      <span className="icone">{icone}</span>
      <div className="conteudo">
        <span className="titulo">{notificacao.titulo}</span>
        <span className="mensagem">{notificacao.mensagem}</span>
        <span className="tempo">{formatarDataRelativa(notificacao.criadaEm)}</span>
      </div>
      {!notificacao.lida && <span className="indicador-nao-lida" />}
    </button>
  );
}

// ==========================================
// CENTRAL DE NOTIFICAÇÕES
// ==========================================

/**
 * Painel slide-in com lista de notificações
 */
export function CentralNotificacoes({
  isOpen,
  onClose,
  onNotificacaoClick,
}: CentralNotificacoesProps) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [naoLidas, setNaoLidas] = useState(0);

  const carregar = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const response = await listarNotificacoes({ limite: 50 });
      setNotificacoes(response.notificacoes);
      setNaoLidas(response.naoLidas);
    } catch {
      console.error('Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleClick = async (notificacao: Notificacao) => {
    if (!notificacao.lida) {
      await marcarComoLida(notificacao.id);
      setNotificacoes((prev) =>
        prev.map((n) => (n.id === notificacao.id ? { ...n, lida: true } : n))
      );
      setNaoLidas((prev) => Math.max(0, prev - 1));
    }
    onNotificacaoClick?.(notificacao);
  };

  const handleMarcarTodas = async () => {
    await marcarTodasComoLidas();
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
    setNaoLidas(0);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="overlay-notificacoes" onClick={onClose} />
      <div className="central-notificacoes">
        <header className="header-notificacoes">
          <h2>Notificações</h2>
          {naoLidas > 0 && (
            <button className="btn-marcar-todas" onClick={handleMarcarTodas}>
              Marcar todas como lidas
            </button>
          )}
          <button className="btn-fechar" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="lista-notificacoes">
          {loading ? (
            <div className="loading-notificacoes">
              <span className="spinner" />
              Carregando...
            </div>
          ) : notificacoes.length === 0 ? (
            <div className="vazio-notificacoes">
              <span className="icone">🔔</span>
              <p>Nenhuma notificação</p>
            </div>
          ) : (
            notificacoes.map((notificacao) => (
              <ItemNotificacao
                key={notificacao.id}
                notificacao={notificacao}
                onClick={handleClick}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ==========================================
// TOGGLE DE NOTIFICAÇÕES
// ==========================================

/**
 * Switch para ativar/desativar notificações
 */
export function ToggleNotificacoes({ onChange }: ToggleNotificacoesProps) {
  const [ativo, setAtivo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permissao, setPermissao] = useState<NotificationPermission>('default');

  useEffect(() => {
    const verificar = async () => {
      const perm = obterPermissao();
      setPermissao(perm);

      if (perm === 'granted') {
        const inscrito = await estaInscrito();
        setAtivo(inscrito);
      }
      setLoading(false);
    };

    verificar();
  }, []);

  const handleToggle = async () => {
    setLoading(true);

    try {
      if (ativo) {
        await removerSubscription();
        setAtivo(false);
        onChange?.(false);
      } else {
        const sucesso = await registrarSubscription();
        if (sucesso) {
          setAtivo(true);
          setPermissao('granted');
          onChange?.(true);
        }
      }
    } catch {
      console.error('Erro ao alterar notificações');
    } finally {
      setLoading(false);
    }
  };

  if (permissao === 'denied') {
    return (
      <div className="toggle-notificacoes disabled">
        <span className="icone">🔕</span>
        <span className="label">Notificações bloqueadas</span>
        <span className="hint">Ative nas configurações do navegador</span>
      </div>
    );
  }

  return (
    <div className="toggle-notificacoes">
      <span className="icone">{ativo ? '🔔' : '🔕'}</span>
      <span className="label">
        {ativo ? 'Notificações ativas' : 'Ativar notificações'}
      </span>
      <button
        className={`switch ${ativo ? 'ativo' : ''} ${loading ? 'loading' : ''}`}
        onClick={handleToggle}
        disabled={loading}
      >
        <span className="thumb" />
      </button>
    </div>
  );
}

// ==========================================
// HOOK useNotificacoes
// ==========================================

/**
 * Hook para gerenciar estado de notificações
 */
export function useNotificacoes() {
  const [isOpen, setIsOpen] = useState(false);
  const [naoLidas, setNaoLidas] = useState(0);

  const abrir = () => setIsOpen(true);
  const fechar = () => setIsOpen(false);
  const toggle = () => setIsOpen((prev) => !prev);

  const atualizarContador = useCallback(async () => {
    try {
      const count = await contarNaoLidas();
      setNaoLidas(count);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    atualizarContador();
    const interval = setInterval(atualizarContador, 30000);
    return () => clearInterval(interval);
  }, [atualizarContador]);

  return {
    isOpen,
    naoLidas,
    abrir,
    fechar,
    toggle,
    atualizarContador,
  };
}

export default {
  BadgeNotificacoes,
  CentralNotificacoes,
  ItemNotificacao,
  ToggleNotificacoes,
  useNotificacoes,
};
