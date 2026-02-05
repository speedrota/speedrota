/**
 * @fileoverview Componente Indicador de Tráfego
 *
 * Mostra o status atual do tráfego com:
 * - Emoji visual (🟢🟡🔴)
 * - Descrição do período
 * - Fator de multiplicação
 */

import { obterResumoTrafego, type ResumoTrafego } from '../services/trafego';
import './IndicadorTrafego.css';

interface IndicadorTrafegoProps {
  /** Modo compacto (só emoji) */
  compacto?: boolean;
  /** Callback ao clicar */
  onClick?: () => void;
}

export function IndicadorTrafego({ compacto = false, onClick }: IndicadorTrafegoProps) {
  const resumo: ResumoTrafego = obterResumoTrafego();

  const getClasseStatus = () => {
    switch (resumo.status) {
      case 'leve':
        return 'indicador-trafego--leve';
      case 'moderado':
        return 'indicador-trafego--moderado';
      case 'intenso':
        return 'indicador-trafego--intenso';
      default:
        return '';
    }
  };

  if (compacto) {
    return (
      <div
        className={`indicador-trafego indicador-trafego--compacto ${getClasseStatus()}`}
        onClick={onClick}
        title={resumo.descricao}
      >
        <span className="indicador-trafego__emoji">{resumo.emoji}</span>
      </div>
    );
  }

  return (
    <div
      className={`indicador-trafego ${getClasseStatus()}`}
      onClick={onClick}
    >
      <span className="indicador-trafego__emoji">{resumo.emoji}</span>
      <div className="indicador-trafego__info">
        <span className="indicador-trafego__status">{resumo.descricao}</span>
        {resumo.fatorAtual !== 1.0 && (
          <span className="indicador-trafego__fator">
            {resumo.fatorAtual > 1 ? '+' : ''}
            {Math.round((resumo.fatorAtual - 1) * 100)}% tempo
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Badge pequeno para mostrar fator de tráfego
 */
interface BadgeTrafegoProps {
  fator: number;
  tamanho?: 'pequeno' | 'medio';
}

export function BadgeTrafego({ fator, tamanho = 'medio' }: BadgeTrafegoProps) {
  let emoji = '🟢';
  let classe = 'badge-trafego--leve';

  if (fator >= 1.5) {
    emoji = '🔴';
    classe = 'badge-trafego--intenso';
  } else if (fator >= 1.2) {
    emoji = '🟡';
    classe = 'badge-trafego--moderado';
  }

  return (
    <span className={`badge-trafego badge-trafego--${tamanho} ${classe}`}>
      {emoji}
    </span>
  );
}

/**
 * Tempo formatado com indicador de tráfego
 */
interface TempoComTrafegoProps {
  duracaoOriginal: number;
  duracaoAjustada: number;
  fator: number;
}

export function TempoComTrafego({
  duracaoOriginal,
  duracaoAjustada,
  fator,
}: TempoComTrafegoProps) {
  const formatarTempo = (min: number) => {
    const horas = Math.floor(min / 60);
    const minutos = min % 60;
    return horas > 0 ? `${horas}h ${minutos}min` : `${minutos}min`;
  };

  const temDiferenca = fator !== 1.0;

  return (
    <div className="tempo-com-trafego">
      <span className="tempo-com-trafego__principal">
        <BadgeTrafego fator={fator} tamanho="pequeno" />
        {formatarTempo(duracaoAjustada)}
      </span>
      {temDiferenca && (
        <span className="tempo-com-trafego__original">
          (sem tráfego: {formatarTempo(duracaoOriginal)})
        </span>
      )}
    </div>
  );
}

export default IndicadorTrafego;
