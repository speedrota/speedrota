/**
 * @fileoverview Serviço de Capacidade de Veículo
 * 
 * FUNCIONALIDADES:
 * 1. Validação de carga vs capacidade do veículo
 * 2. Rastreamento de peso/volumes durante rota
 * 3. Alertas de sobrecarga
 * 
 * DESIGN POR CONTRATO:
 * @pre Veículo com capacidadeKg > 0 e capacidadeVolumes > 0
 * @pre Carga com peso >= 0 e volumes >= 0
 * @post Resultado indica se carga cabe ou não
 * @invariant Nunca permite sobrecarga (safety first)
 */

import { prisma } from '../lib/prisma.js';
import { TipoVeiculo } from '@prisma/client';

// ==========================================
// TIPOS
// ==========================================

export interface CapacidadeVeiculo {
  tipo: TipoVeiculo;
  capacidadeKg: number;
  capacidadeVolumes: number;
  capacidadeM3?: number;
}

export interface CargaAtual {
  pesoKg: number;
  volumes: number;
  m3?: number;
}

export interface ResultadoCapacidade {
  cabe: boolean;
  percentualPeso: number;
  percentualVolumes: number;
  percentualM3?: number;
  alertas: AlertaCapacidade[];
  margemPesoKg: number;
  margemVolumes: number;
}

export interface AlertaCapacidade {
  tipo: 'SOBRECARGA_PESO' | 'SOBRECARGA_VOLUME' | 'LIMITE_PROXIMO' | 'PESO_LEGAL_EXCEDIDO';
  mensagem: string;
  severidade: 'warning' | 'error';
}

export interface ItemCarga {
  paradaId: string;
  pesoKg: number;
  volumes: number;
  m3?: number;
}

// ==========================================
// CONSTANTES
// ==========================================

/**
 * Capacidades padrão por tipo de veículo
 * Fonte: Legislação brasileira + especificações técnicas
 */
export const CAPACIDADE_PADRAO: Record<TipoVeiculo, CapacidadeVeiculo> = {
  MOTO: {
    tipo: 'MOTO',
    capacidadeKg: 25,      // Limite legal para moto
    capacidadeVolumes: 8,
    capacidadeM3: 0.05
  },
  CARRO: {
    tipo: 'CARRO',
    capacidadeKg: 300,     // Sedan/Hatch comum
    capacidadeVolumes: 30,
    capacidadeM3: 0.5
  },
  VAN: {
    tipo: 'VAN',
    capacidadeKg: 1200,    // Fiorino/Kangoo/Doblo
    capacidadeVolumes: 150,
    capacidadeM3: 3.5
  },
  CAMINHAO_LEVE: {
    tipo: 'CAMINHAO_LEVE',
    capacidadeKg: 3500,    // VUC/3/4
    capacidadeVolumes: 300,
    capacidadeM3: 15
  },
  CAMINHAO: {
    tipo: 'CAMINHAO',
    capacidadeKg: 8000,    // Toco
    capacidadeVolumes: 500,
    capacidadeM3: 30
  },
  BIKE: {
    tipo: 'BIKE',
    capacidadeKg: 10,
    capacidadeVolumes: 4,
    capacidadeM3: 0.02
  }
};

/**
 * Limites legais de peso por eixo (Resolução CONTRAN 882)
 */
export const PESO_LEGAL_MAXIMO: Record<TipoVeiculo, number> = {
  MOTO: 30,              // kg - bagageiro
  BIKE: 15,              // kg - ciclista
  CARRO: 400,            // kg - peso útil
  VAN: 1500,             // kg - carga útil típica
  CAMINHAO_LEVE: 4000,   // kg - 3/4
  CAMINHAO: 10000        // kg - toco
};

// ==========================================
// FUNÇÕES DE VALIDAÇÃO
// ==========================================

/**
 * Valida se uma carga cabe no veículo
 * 
 * @pre veiculo.capacidadeKg > 0
 * @pre veiculo.capacidadeVolumes > 0
 * @pre carga.pesoKg >= 0
 * @pre carga.volumes >= 0
 * @post resultado.cabe === (percentualPeso <= 100 && percentualVolumes <= 100)
 * @invariant Nunca retorna cabe=true se houver sobrecarga
 */
export function validarCapacidade(
  veiculo: CapacidadeVeiculo,
  carga: CargaAtual
): ResultadoCapacidade {
  // Pré-condições
  if (veiculo.capacidadeKg <= 0 || veiculo.capacidadeVolumes <= 0) {
    throw new Error('Capacidade do veículo deve ser positiva');
  }
  if (carga.pesoKg < 0 || carga.volumes < 0) {
    throw new Error('Carga não pode ser negativa');
  }

  const percentualPeso = (carga.pesoKg / veiculo.capacidadeKg) * 100;
  const percentualVolumes = (carga.volumes / veiculo.capacidadeVolumes) * 100;
  const percentualM3 = veiculo.capacidadeM3 && carga.m3 
    ? (carga.m3 / veiculo.capacidadeM3) * 100 
    : undefined;

  const alertas: AlertaCapacidade[] = [];

  // Verificar sobrecarga de peso
  if (percentualPeso > 100) {
    alertas.push({
      tipo: 'SOBRECARGA_PESO',
      mensagem: `Peso excede capacidade em ${(percentualPeso - 100).toFixed(1)}%`,
      severidade: 'error'
    });
  } else if (percentualPeso >= 90) {
    alertas.push({
      tipo: 'LIMITE_PROXIMO',
      mensagem: `Peso em ${percentualPeso.toFixed(1)}% da capacidade`,
      severidade: 'warning'
    });
  }

  // Verificar sobrecarga de volume
  if (percentualVolumes > 100) {
    alertas.push({
      tipo: 'SOBRECARGA_VOLUME',
      mensagem: `Volumes excedem capacidade em ${(percentualVolumes - 100).toFixed(1)}%`,
      severidade: 'error'
    });
  } else if (percentualVolumes >= 90) {
    alertas.push({
      tipo: 'LIMITE_PROXIMO',
      mensagem: `Volumes em ${percentualVolumes.toFixed(1)}% da capacidade`,
      severidade: 'warning'
    });
  }

  // Verificar limite legal
  const pesoLegal = PESO_LEGAL_MAXIMO[veiculo.tipo];
  if (carga.pesoKg > pesoLegal) {
    alertas.push({
      tipo: 'PESO_LEGAL_EXCEDIDO',
      mensagem: `Peso ${carga.pesoKg}kg excede limite legal de ${pesoLegal}kg`,
      severidade: 'error'
    });
  }

  const cabeNoPeso = percentualPeso <= 100;
  const cabeNoVolume = percentualVolumes <= 100;
  const cabeNoM3 = percentualM3 === undefined || percentualM3 <= 100;

  return {
    cabe: cabeNoPeso && cabeNoVolume && cabeNoM3,
    percentualPeso: Math.round(percentualPeso * 10) / 10,
    percentualVolumes: Math.round(percentualVolumes * 10) / 10,
    percentualM3: percentualM3 ? Math.round(percentualM3 * 10) / 10 : undefined,
    alertas,
    margemPesoKg: Math.max(0, veiculo.capacidadeKg - carga.pesoKg),
    margemVolumes: Math.max(0, veiculo.capacidadeVolumes - carga.volumes)
  };
}

/**
 * Valida se um conjunto de paradas cabe no veículo
 * 
 * @pre Todas as paradas têm peso e volumes >= 0
 * @post Soma de todos os itens não excede capacidade
 */
export function validarCargaRota(
  veiculo: CapacidadeVeiculo,
  itens: ItemCarga[]
): ResultadoCapacidade & { detalhes: { paradaId: string; acumulado: CargaAtual }[] } {
  let acumuladoPeso = 0;
  let acumuladoVolumes = 0;
  let acumuladoM3 = 0;

  const detalhes: { paradaId: string; acumulado: CargaAtual }[] = [];

  for (const item of itens) {
    acumuladoPeso += item.pesoKg;
    acumuladoVolumes += item.volumes;
    acumuladoM3 += item.m3 || 0;

    detalhes.push({
      paradaId: item.paradaId,
      acumulado: {
        pesoKg: acumuladoPeso,
        volumes: acumuladoVolumes,
        m3: acumuladoM3
      }
    });
  }

  const resultado = validarCapacidade(veiculo, {
    pesoKg: acumuladoPeso,
    volumes: acumuladoVolumes,
    m3: acumuladoM3 > 0 ? acumuladoM3 : undefined
  });

  return { ...resultado, detalhes };
}

// ==========================================
// FUNÇÕES DE PERSISTÊNCIA
// ==========================================

/**
 * Salva estado da carga de uma rota
 */
export async function salvarCargaVeiculo(
  rotaId: string,
  carga: CargaAtual,
  capacidade: CapacidadeVeiculo
): Promise<void> {
  const validacao = validarCapacidade(capacidade, carga);

  await prisma.cargaVeiculo.upsert({
    where: { rotaEmpresaId: rotaId },
    create: {
      rotaEmpresaId: rotaId,
      pesoAtualKg: carga.pesoKg,
      volumesAtuais: carga.volumes,
      m3Atual: carga.m3,
      pesoMaxKg: capacidade.capacidadeKg,
      volumesMax: capacidade.capacidadeVolumes,
      m3Max: capacidade.capacidadeM3,
      percentualPeso: validacao.percentualPeso,
      percentualVolumes: validacao.percentualVolumes,
      alertas: JSON.stringify(validacao.alertas)
    },
    update: {
      pesoAtualKg: carga.pesoKg,
      volumesAtuais: carga.volumes,
      m3Atual: carga.m3,
      percentualPeso: validacao.percentualPeso,
      percentualVolumes: validacao.percentualVolumes,
      alertas: JSON.stringify(validacao.alertas),
      updatedAt: new Date()
    }
  });
}

/**
 * Atualiza carga após entrega (subtrai peso/volumes)
 */
export async function registrarEntrega(
  rotaId: string,
  item: ItemCarga
): Promise<ResultadoCapacidade | null> {
  const cargaAtual = await prisma.cargaVeiculo.findUnique({
    where: { rotaEmpresaId: rotaId }
  });

  if (!cargaAtual) return null;

  const novaCarga: CargaAtual = {
    pesoKg: Math.max(0, cargaAtual.pesoAtualKg - item.pesoKg),
    volumes: Math.max(0, cargaAtual.volumesAtuais - item.volumes),
    m3: cargaAtual.m3Atual && item.m3 
      ? Math.max(0, cargaAtual.m3Atual - item.m3) 
      : undefined
  };

  const capacidade: CapacidadeVeiculo = {
    tipo: 'VAN', // Será inferido da rota real
    capacidadeKg: cargaAtual.pesoMaxKg,
    capacidadeVolumes: cargaAtual.volumesMax,
    capacidadeM3: cargaAtual.m3Max || undefined
  };

  const resultado = validarCapacidade(capacidade, novaCarga);

  await prisma.cargaVeiculo.update({
    where: { rotaEmpresaId: rotaId },
    data: {
      pesoAtualKg: novaCarga.pesoKg,
      volumesAtuais: novaCarga.volumes,
      m3Atual: novaCarga.m3,
      percentualPeso: resultado.percentualPeso,
      percentualVolumes: resultado.percentualVolumes,
      alertas: JSON.stringify(resultado.alertas),
      updatedAt: new Date()
    }
  });

  return resultado;
}

/**
 * Obtém capacidade do veículo a partir do ID
 */
export async function obterCapacidadeVeiculo(veiculoId: string): Promise<CapacidadeVeiculo | null> {
  const veiculo = await prisma.veiculo.findUnique({
    where: { id: veiculoId },
    select: {
      tipo: true,
      capacidadeKg: true,
      capacidadeVolumes: true,
      capacidadeM3: true
    }
  });

  if (!veiculo) return null;

  return {
    tipo: veiculo.tipo,
    capacidadeKg: veiculo.capacidadeKg,
    capacidadeVolumes: veiculo.capacidadeVolumes,
    capacidadeM3: veiculo.capacidadeM3 || undefined
  };
}

/**
 * Obtém capacidade padrão por tipo de veículo
 */
export function obterCapacidadePadrao(tipo: TipoVeiculo): CapacidadeVeiculo {
  return CAPACIDADE_PADRAO[tipo] || CAPACIDADE_PADRAO.CARRO;
}
