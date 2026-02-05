/**
 * @fileoverview Serviço de Tráfego Real-time (Web)
 *
 * ESTRATÉGIA:
 * 1. Fatores de horário de pico (local, sem API)
 * 2. API para previsão e histórico (quando disponível)
 * 3. Zero custo adicional
 *
 * @pre Hora do sistema válida
 * @post Retorna fator de tráfego >= 0.8
 */

import { api } from './api';

// ==========================================
// CONSTANTES
// ==========================================

export const FATORES_TRAFEGO = {
  PICO_MANHA: 1.5,
  PICO_TARDE: 1.6,
  ALMOCO: 1.2,
  MADRUGADA: 0.8,
  NORMAL: 1.0,
} as const;

// ==========================================
// TIPOS
// ==========================================

export interface FatorTrafego {
  fator: number;
  periodo: string;
  descricao: string;
}

export interface ResumoTrafego {
  status: 'leve' | 'moderado' | 'intenso';
  emoji: string;
  descricao: string;
  fatorAtual: number;
}

export interface AjusteTempo {
  duracaoOriginal: number;
  duracaoAjustada: number;
  fatorAplicado: number;
  periodo: string;
}

export interface PrevisaoHora {
  hora: number;
  horaFormatada: string;
  fator: number;
  periodo: string;
  descricao: string;
}

// ==========================================
// FAIXAS DE HORÁRIO (mesmo da API)
// ==========================================

interface FaixaHorario {
  inicio: number;
  fim: number;
  fator: number;
  periodo: string;
  descricao: string;
}

const FAIXAS_HORARIO: FaixaHorario[] = [
  { inicio: 7, fim: 9, fator: FATORES_TRAFEGO.PICO_MANHA, periodo: 'pico_manha', descricao: 'Horário de pico manhã' },
  { inicio: 11, fim: 14, fator: FATORES_TRAFEGO.ALMOCO, periodo: 'almoco', descricao: 'Horário de almoço' },
  { inicio: 17, fim: 19, fator: FATORES_TRAFEGO.PICO_TARDE, periodo: 'pico_tarde', descricao: 'Horário de pico tarde' },
  { inicio: 22, fim: 24, fator: FATORES_TRAFEGO.MADRUGADA, periodo: 'madrugada', descricao: 'Madrugada' },
  { inicio: 0, fim: 5, fator: FATORES_TRAFEGO.MADRUGADA, periodo: 'madrugada', descricao: 'Madrugada' },
];

// ==========================================
// FUNÇÕES LOCAIS (sem API)
// ==========================================

/**
 * Obtém o fator de tráfego para uma hora específica (local)
 */
export function obterFatorTrafego(hora: number): FatorTrafego {
  const horaValida = Math.max(0, Math.min(23, Math.floor(hora)));

  for (const faixa of FAIXAS_HORARIO) {
    if (horaValida >= faixa.inicio && horaValida < faixa.fim) {
      return {
        fator: faixa.fator,
        periodo: faixa.periodo,
        descricao: faixa.descricao,
      };
    }
  }

  return {
    fator: FATORES_TRAFEGO.NORMAL,
    periodo: 'normal',
    descricao: 'Trânsito normal',
  };
}

/**
 * Obtém o fator de tráfego atual
 */
export function obterFatorTrafegoAtual(): FatorTrafego {
  return obterFatorTrafego(new Date().getHours());
}

/**
 * Ajusta duração com base no tráfego (local)
 */
export function ajustarDuracaoComTrafego(
  duracaoMinutos: number,
  hora?: number
): AjusteTempo {
  const horaCalculo = hora ?? new Date().getHours();
  const { fator, periodo } = obterFatorTrafego(horaCalculo);

  return {
    duracaoOriginal: duracaoMinutos,
    duracaoAjustada: Math.round(duracaoMinutos * fator),
    fatorAplicado: fator,
    periodo,
  };
}

/**
 * Obtém resumo do tráfego atual
 */
export function obterResumoTrafego(): ResumoTrafego {
  const { fator, descricao } = obterFatorTrafegoAtual();

  if (fator <= 0.9) {
    return { status: 'leve', emoji: '🟢', descricao: 'Trânsito leve', fatorAtual: fator };
  } else if (fator <= 1.3) {
    return { status: 'moderado', emoji: '🟡', descricao: 'Trânsito moderado', fatorAtual: fator };
  } else {
    return { status: 'intenso', emoji: '🔴', descricao: descricao || 'Trânsito intenso', fatorAtual: fator };
  }
}

/**
 * Formata tempo com indicador visual de tráfego
 */
export function formatarTempoComTrafego(duracaoMinutos: number): {
  texto: string;
  textoOriginal: string;
  emoji: string;
  cor: 'verde' | 'amarelo' | 'vermelho';
  fator: number;
} {
  const ajuste = ajustarDuracaoComTrafego(duracaoMinutos);

  let emoji = '🟢';
  let cor: 'verde' | 'amarelo' | 'vermelho' = 'verde';

  if (ajuste.fatorAplicado >= 1.5) {
    emoji = '🔴';
    cor = 'vermelho';
  } else if (ajuste.fatorAplicado >= 1.2) {
    emoji = '🟡';
    cor = 'amarelo';
  }

  const formatarTempo = (min: number) => {
    const horas = Math.floor(min / 60);
    const minutos = min % 60;
    return horas > 0 ? `${horas}h ${minutos}min` : `${minutos}min`;
  };

  return {
    texto: formatarTempo(ajuste.duracaoAjustada),
    textoOriginal: formatarTempo(ajuste.duracaoOriginal),
    emoji,
    cor,
    fator: ajuste.fatorAplicado,
  };
}

// ==========================================
// FUNÇÕES COM API
// ==========================================

/**
 * Obtém previsão de tráfego das próximas horas (via API)
 */
export async function obterPrevisaoTrafego(): Promise<PrevisaoHora[]> {
  try {
    const response = await api.get('/trafego/previsao');
    return response.data?.data?.previsao || [];
  } catch (error) {
    // Fallback local
    console.warn('[Trafego] Fallback local para previsão');
    const horaAtual = new Date().getHours();
    const previsao: PrevisaoHora[] = [];

    for (let i = 0; i < 12; i++) {
      const hora = (horaAtual + i) % 24;
      const fator = obterFatorTrafego(hora);
      previsao.push({
        hora,
        horaFormatada: `${hora.toString().padStart(2, '0')}:00`,
        ...fator,
      });
    }

    return previsao;
  }
}

/**
 * Obtém status atual do tráfego (via API)
 */
export async function obterStatusTrafegoAPI(): Promise<ResumoTrafego> {
  try {
    const response = await api.get('/trafego/atual');
    return response.data?.data || obterResumoTrafego();
  } catch (error) {
    return obterResumoTrafego();
  }
}

// ==========================================
// EXPORT DEFAULT
// ==========================================

export const trafegoService = {
  // Funções locais (sem API)
  obterFatorTrafego,
  obterFatorTrafegoAtual,
  ajustarDuracaoComTrafego,
  obterResumoTrafego,
  formatarTempoComTrafego,

  // Funções com API
  obterPrevisaoTrafego,
  obterStatusTrafegoAPI,

  // Constantes
  FATORES_TRAFEGO,
};

export default trafegoService;
