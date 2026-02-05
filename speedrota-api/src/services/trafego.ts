/**
 * @fileoverview Serviço de Tráfego Inteligente
 *
 * ESTRATÉGIA (Zero Custo):
 * 1. Fatores de horário de pico (rush manhã/tarde)
 * 2. Histórico de tempos reais do próprio usuário
 * 3. Aprendizado contínuo (real vs estimado)
 *
 * DESIGN POR CONTRATO:
 * @pre Horário válido (0-23h)
 * @post Fator de tráfego >= 0.8
 * @invariant Sem chamadas a APIs externas pagas
 */

import { FATORES_TRAFEGO } from '../config/env.js';

// ==========================================
// TIPOS
// ==========================================

export interface FatorTrafego {
  fator: number;
  periodo: string;
  descricao: string;
}

export interface HistoricoTempo {
  origem: string;
  destino: string;
  horario: string;
  tempoReal: number;
  tempoEstimado: number;
  fatorCorrecao: number;
}

export interface AjusteTempo {
  duracaoOriginal: number;
  duracaoAjustada: number;
  fatorAplicado: number;
  periodo: string;
}

// ==========================================
// FAIXAS DE HORÁRIO
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
  { inicio: 22, fim: 24, fator: FATORES_TRAFEGO.MADRUGADA, periodo: 'madrugada', descricao: 'Madrugada (trânsito leve)' },
  { inicio: 0, fim: 5, fator: FATORES_TRAFEGO.MADRUGADA, periodo: 'madrugada', descricao: 'Madrugada (trânsito leve)' },
];

// ==========================================
// FUNÇÕES PRINCIPAIS
// ==========================================

/**
 * Obtém o fator de tráfego para um horário específico
 *
 * @pre hora >= 0 && hora <= 23
 * @post resultado.fator >= 0.8
 *
 * @param hora - Hora do dia (0-23)
 * @returns Fator de tráfego com metadados
 */
export function obterFatorTrafego(hora: number): FatorTrafego {
  // Validar entrada
  const horaValida = Math.max(0, Math.min(23, Math.floor(hora)));

  // Buscar faixa correspondente
  for (const faixa of FAIXAS_HORARIO) {
    if (horaValida >= faixa.inicio && horaValida < faixa.fim) {
      return {
        fator: faixa.fator,
        periodo: faixa.periodo,
        descricao: faixa.descricao,
      };
    }
  }

  // Horário normal (fora das faixas especiais)
  return {
    fator: FATORES_TRAFEGO.NORMAL,
    periodo: 'normal',
    descricao: 'Trânsito normal',
  };
}

/**
 * Obtém o fator de tráfego atual (baseado na hora atual)
 */
export function obterFatorTrafegoAtual(): FatorTrafego {
  const horaAtual = new Date().getHours();
  return obterFatorTrafego(horaAtual);
}

/**
 * Ajusta duração estimada com base no fator de tráfego
 *
 * @pre duracaoMinutos > 0
 * @post resultado.duracaoAjustada >= duracaoMinutos * 0.8
 *
 * @param duracaoMinutos - Duração original em minutos
 * @param hora - Hora do dia (opcional, usa hora atual se omitido)
 * @returns Duração ajustada com metadados
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
 * Calcula fator de correção baseado no histórico
 *
 * @param historico - Array de registros históricos
 * @returns Fator médio de correção
 */
export function calcularFatorHistorico(historico: HistoricoTempo[]): number {
  if (historico.length === 0) {
    return 1.0;
  }

  // Média ponderada (registros mais recentes têm mais peso)
  let somaFatores = 0;
  let somaPesos = 0;

  historico.forEach((registro, index) => {
    const peso = index + 1; // Mais recente = maior peso
    somaFatores += registro.fatorCorrecao * peso;
    somaPesos += peso;
  });

  // Limitar entre 0.5 e 2.0 para evitar valores extremos
  const fatorMedio = somaFatores / somaPesos;
  return Math.max(0.5, Math.min(2.0, fatorMedio));
}

/**
 * Registra um tempo real vs estimado para aprendizado
 *
 * @param tempoReal - Tempo real em minutos
 * @param tempoEstimado - Tempo estimado em minutos
 * @returns Registro de histórico
 */
export function criarRegistroHistorico(
  origem: string,
  destino: string,
  tempoReal: number,
  tempoEstimado: number
): HistoricoTempo {
  const fatorCorrecao = tempoEstimado > 0 ? tempoReal / tempoEstimado : 1.0;
  const horaAtual = new Date().getHours();

  return {
    origem,
    destino,
    horario: `${horaAtual}:00`,
    tempoReal,
    tempoEstimado,
    fatorCorrecao: Number(fatorCorrecao.toFixed(2)),
  };
}

/**
 * Formata o tempo com indicador de tráfego para UI
 *
 * @param duracaoMinutos - Duração em minutos
 * @returns Objeto formatado para exibição
 */
export function formatarTempoComTrafego(duracaoMinutos: number): {
  texto: string;
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
  } else if (ajuste.fatorAplicado <= 0.9) {
    emoji = '🟢';
    cor = 'verde';
  }

  const horas = Math.floor(ajuste.duracaoAjustada / 60);
  const minutos = ajuste.duracaoAjustada % 60;
  const texto =
    horas > 0 ? `${horas}h ${minutos}min` : `${minutos}min`;

  return {
    texto,
    emoji,
    cor,
    fator: ajuste.fatorAplicado,
  };
}

/**
 * Obtém resumo de tráfego para a UI
 */
export function obterResumoTrafego(): {
  status: 'leve' | 'moderado' | 'intenso';
  emoji: string;
  descricao: string;
  fatorAtual: number;
} {
  const { fator, descricao } = obterFatorTrafegoAtual();

  if (fator <= 0.9) {
    return {
      status: 'leve',
      emoji: '🟢',
      descricao: 'Trânsito leve',
      fatorAtual: fator,
    };
  } else if (fator <= 1.3) {
    return {
      status: 'moderado',
      emoji: '🟡',
      descricao: 'Trânsito moderado',
      fatorAtual: fator,
    };
  } else {
    return {
      status: 'intenso',
      emoji: '🔴',
      descricao: descricao || 'Trânsito intenso',
      fatorAtual: fator,
    };
  }
}
