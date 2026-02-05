/**
 * @fileoverview Serviço de Gamificação - Badges e Ranking
 * 
 * DESIGN POR CONTRATO:
 * @pre Usuário com entregas completadas
 * @post Badges desbloqueados, pontos calculados, ranking atualizado
 * @invariant Pontos >= 0, progresso >= 0
 * 
 * REGRAS:
 * - Badges são desbloqueados automaticamente ao atingir requisito
 * - Ranking atualizado a cada entrega concluída
 * - Streak quebra se passar 24h sem entrega
 * 
 * @author SpeedRota Team
 * @version 1.0.0
 */

import { prisma } from '../lib/prisma.js';
import type { TipoBadge, Raridade, PeriodoRanking, TipoConquista } from '@prisma/client';

// ==========================================
// TIPOS E INTERFACES
// ==========================================

interface PerfilGamificacao {
  userId: string;
  pontosTotais: number;
  nivel: number;
  badgesDesbloqueados: number;
  badgesTotal: number;
  streakAtual: number;
  maiorStreak: number;
  posicaoRanking: number | null;
  proximoBadge: {
    nome: string;
    progressoAtual: number;
    requisito: number;
    percentual: number;
  } | null;
}

interface BadgeDetalhado {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  icone: string;
  tipo: TipoBadge;
  requisito: number;
  pontos: number;
  raridade: Raridade;
  desbloqueado: boolean;
  progressoAtual: number;
  percentualProgresso: number;
  desbloqueadoEm: Date | null;
}

interface RankingEntry {
  posicao: number;
  userId: string;
  nome: string;
  pontos: number;
  totalEntregas: number;
  streakAtual: number;
  badges: number;
  isCurrentUser: boolean;
}

// ==========================================
// CONSTANTES - BADGES DISPONÍVEIS
// ==========================================

const BADGES_CONFIG: Array<{
  codigo: string;
  nome: string;
  descricao: string;
  icone: string;
  tipo: TipoBadge;
  requisito: number;
  pontos: number;
  raridade: Raridade;
}> = [
  // ENTREGAS
  { codigo: 'PRIMEIRA_ENTREGA', nome: 'Primeira Entrega', descricao: 'Completou sua primeira entrega', icone: '🎯', tipo: 'ENTREGAS', requisito: 1, pontos: 10, raridade: 'COMUM' },
  { codigo: 'ENTREGADOR_10', nome: 'Entregador Iniciante', descricao: '10 entregas completadas', icone: '📦', tipo: 'ENTREGAS', requisito: 10, pontos: 25, raridade: 'COMUM' },
  { codigo: 'ENTREGADOR_50', nome: 'Entregador Dedicado', descricao: '50 entregas completadas', icone: '🚀', tipo: 'ENTREGAS', requisito: 50, pontos: 50, raridade: 'INCOMUM' },
  { codigo: 'ENTREGADOR_100', nome: 'Centenário', descricao: '100 entregas completadas', icone: '💯', tipo: 'ENTREGAS', requisito: 100, pontos: 100, raridade: 'INCOMUM' },
  { codigo: 'ENTREGADOR_500', nome: 'Mestre das Entregas', descricao: '500 entregas completadas', icone: '🏆', tipo: 'ENTREGAS', requisito: 500, pontos: 250, raridade: 'RARO' },
  { codigo: 'ENTREGADOR_1000', nome: 'Lenda das Entregas', descricao: '1000 entregas completadas', icone: '👑', tipo: 'ENTREGAS', requisito: 1000, pontos: 500, raridade: 'EPICO' },
  { codigo: 'ENTREGADOR_5000', nome: 'Titã', descricao: '5000 entregas completadas', icone: '⚡', tipo: 'ENTREGAS', requisito: 5000, pontos: 1000, raridade: 'LENDARIO' },

  // STREAK
  { codigo: 'STREAK_3', nome: 'Consistente', descricao: '3 dias consecutivos entregando', icone: '🔥', tipo: 'STREAK', requisito: 3, pontos: 15, raridade: 'COMUM' },
  { codigo: 'STREAK_7', nome: 'Semana Perfeita', descricao: '7 dias consecutivos entregando', icone: '🔥', tipo: 'STREAK', requisito: 7, pontos: 50, raridade: 'INCOMUM' },
  { codigo: 'STREAK_14', nome: 'Duas Semanas de Fogo', descricao: '14 dias consecutivos', icone: '🔥🔥', tipo: 'STREAK', requisito: 14, pontos: 100, raridade: 'RARO' },
  { codigo: 'STREAK_30', nome: 'Mês de Ouro', descricao: '30 dias consecutivos', icone: '🌟', tipo: 'STREAK', requisito: 30, pontos: 250, raridade: 'EPICO' },

  // DISTÂNCIA
  { codigo: 'KM_100', nome: 'Explorador Local', descricao: '100 km rodados', icone: '🚗', tipo: 'DISTANCIA', requisito: 100, pontos: 30, raridade: 'COMUM' },
  { codigo: 'KM_500', nome: 'Viajante', descricao: '500 km rodados', icone: '🗺️', tipo: 'DISTANCIA', requisito: 500, pontos: 75, raridade: 'INCOMUM' },
  { codigo: 'KM_1000', nome: 'Maratonista', descricao: '1000 km rodados', icone: '🏃', tipo: 'DISTANCIA', requisito: 1000, pontos: 150, raridade: 'RARO' },

  // VELOCIDADE
  { codigo: 'RAPIDO_5MIN', nome: 'Relâmpago', descricao: 'Entrega em menos de 5 minutos', icone: '⚡', tipo: 'VELOCIDADE', requisito: 5, pontos: 20, raridade: 'INCOMUM' },
  { codigo: 'MEDIA_10', nome: 'Eficiente', descricao: 'Média de 10 entregas/hora', icone: '⏱️', tipo: 'VELOCIDADE', requisito: 10, pontos: 100, raridade: 'RARO' },

  // PRECISÃO
  { codigo: 'PRECISAO_100', nome: 'Perfeito', descricao: '100% de entregas sem falha (mín 20)', icone: '✅', tipo: 'PRECISAO', requisito: 100, pontos: 200, raridade: 'EPICO' },
  { codigo: 'SEM_ATRASO_10', nome: 'Pontual', descricao: '10 entregas sem atraso', icone: '⏰', tipo: 'PRECISAO', requisito: 10, pontos: 50, raridade: 'INCOMUM' },

  // FORNECEDOR
  { codigo: 'NATURA_50', nome: 'Especialista Natura', descricao: '50 entregas Natura', icone: '🌿', tipo: 'FORNECEDOR', requisito: 50, pontos: 75, raridade: 'INCOMUM' },
  { codigo: 'ML_50', nome: 'Especialista Mercado Livre', descricao: '50 entregas ML', icone: '🛒', tipo: 'FORNECEDOR', requisito: 50, pontos: 75, raridade: 'INCOMUM' },
  { codigo: 'SHOPEE_50', nome: 'Especialista Shopee', descricao: '50 entregas Shopee', icone: '🧡', tipo: 'FORNECEDOR', requisito: 50, pontos: 75, raridade: 'INCOMUM' },
  { codigo: 'MULTI_3', nome: 'Multitarefa', descricao: '3+ fornecedores na mesma rota', icone: '🎭', tipo: 'FORNECEDOR', requisito: 3, pontos: 50, raridade: 'RARO' },

  // ESPECIAIS
  { codigo: 'MADRUGADOR', nome: 'Madrugador', descricao: 'Entrega antes das 7h', icone: '🌅', tipo: 'ESPECIAL', requisito: 1, pontos: 25, raridade: 'INCOMUM' },
  { codigo: 'NOTURNO', nome: 'Coruja', descricao: 'Entrega após as 22h', icone: '🦉', tipo: 'ESPECIAL', requisito: 1, pontos: 25, raridade: 'INCOMUM' },
  { codigo: 'FIM_DE_SEMANA', nome: 'Guerreiro de Fim de Semana', descricao: '20 entregas em fins de semana', icone: '🎉', tipo: 'ESPECIAL', requisito: 20, pontos: 75, raridade: 'RARO' },
];

// Pontos por nível
const PONTOS_POR_NIVEL = [
  0,      // Nível 1
  100,    // Nível 2
  250,    // Nível 3
  500,    // Nível 4
  1000,   // Nível 5
  2000,   // Nível 6
  3500,   // Nível 7
  5500,   // Nível 8
  8000,   // Nível 9
  12000,  // Nível 10
];

// ==========================================
// FUNÇÕES PRINCIPAIS
// ==========================================

/**
 * Inicializa badges no banco de dados
 * 
 * @pre Banco de dados acessível
 * @post Todos os badges BADGES_CONFIG criados/atualizados
 */
export async function inicializarBadges(): Promise<{ criados: number; atualizados: number }> {
  let criados = 0;
  let atualizados = 0;

  for (const badge of BADGES_CONFIG) {
    const existente = await prisma.badge.findUnique({
      where: { codigo: badge.codigo },
    });

    if (existente) {
      await prisma.badge.update({
        where: { codigo: badge.codigo },
        data: badge,
      });
      atualizados++;
    } else {
      await prisma.badge.create({
        data: badge,
      });
      criados++;
    }
  }

  return { criados, atualizados };
}

/**
 * Obtém perfil de gamificação do usuário
 * 
 * @pre userId válido
 * @post PerfilGamificacao completo
 */
export async function getPerfilGamificacao(userId: string): Promise<PerfilGamificacao> {
  // Buscar badges do usuário
  const [badges, usuarioBadges, ranking] = await Promise.all([
    prisma.badge.count({ where: { ativo: true } }),
    prisma.usuarioBadge.findMany({
      where: { userId },
      include: { badge: true },
    }),
    prisma.ranking.findFirst({
      where: { userId, periodo: 'SEMANAL' },
      orderBy: { dataInicio: 'desc' },
    }),
  ]);

  const badgesDesbloqueados = usuarioBadges.filter(ub => ub.desbloqueadoEm !== null).length;
  const pontosTotais = usuarioBadges
    .filter(ub => ub.desbloqueadoEm)
    .reduce((acc, ub) => acc + ub.badge.pontos, 0);

  // Calcular nível
  let nivel = 1;
  for (let i = PONTOS_POR_NIVEL.length - 1; i >= 0; i--) {
    if (pontosTotais >= PONTOS_POR_NIVEL[i]) {
      nivel = i + 1;
      break;
    }
  }

  // Encontrar próximo badge mais próximo
  const badgesEmProgresso = usuarioBadges
    .filter(ub => !ub.desbloqueadoEm)
    .sort((a, b) => {
      const percA = a.progressoAtual / a.badge.requisito;
      const percB = b.progressoAtual / b.badge.requisito;
      return percB - percA;
    });

  const proximoBadge = badgesEmProgresso[0] ? {
    nome: badgesEmProgresso[0].badge.nome,
    progressoAtual: badgesEmProgresso[0].progressoAtual,
    requisito: badgesEmProgresso[0].badge.requisito,
    percentual: (badgesEmProgresso[0].progressoAtual / badgesEmProgresso[0].badge.requisito) * 100,
  } : null;

  return {
    userId,
    pontosTotais,
    nivel,
    badgesDesbloqueados,
    badgesTotal: badges,
    streakAtual: ranking?.streakAtual || 0,
    maiorStreak: ranking?.maiorStreak || 0,
    posicaoRanking: ranking?.posicao || null,
    proximoBadge,
  };
}

/**
 * Lista todos os badges com progresso do usuário
 * 
 * @pre userId válido
 * @post Lista de BadgeDetalhado ordenada por tipo
 */
export async function getBadgesUsuario(userId: string): Promise<BadgeDetalhado[]> {
  const [badges, usuarioBadges] = await Promise.all([
    prisma.badge.findMany({
      where: { ativo: true },
      orderBy: [{ tipo: 'asc' }, { requisito: 'asc' }],
    }),
    prisma.usuarioBadge.findMany({
      where: { userId },
    }),
  ]);

  const progressoMap = new Map(usuarioBadges.map(ub => [ub.badgeId, ub]));

  return badges.map(badge => {
    const progresso = progressoMap.get(badge.id);
    const progressoAtual = progresso?.progressoAtual || 0;

    return {
      id: badge.id,
      codigo: badge.codigo,
      nome: badge.nome,
      descricao: badge.descricao,
      icone: badge.icone,
      tipo: badge.tipo,
      requisito: badge.requisito,
      pontos: badge.pontos,
      raridade: badge.raridade,
      desbloqueado: progresso?.desbloqueadoEm !== null && progresso?.desbloqueadoEm !== undefined,
      progressoAtual,
      percentualProgresso: Math.min(100, (progressoAtual / badge.requisito) * 100),
      desbloqueadoEm: progresso?.desbloqueadoEm || null,
    };
  });
}

/**
 * Atualiza progresso de badges após entrega
 * 
 * @pre userId válido, entrega concluída
 * @post Progresso atualizado, badges desbloqueados se requisito atingido
 */
export async function atualizarProgressoAposEntrega(
  userId: string,
  dadosEntrega: {
    tempoMinutos: number;
    kmPercorridos: number;
    fornecedor: string;
    horaEntrega: number;
    diaSemana: number;
  }
): Promise<{ badgesDesbloqueados: BadgeDetalhado[] }> {
  const badgesDesbloqueados: BadgeDetalhado[] = [];

  // Buscar todos os badges e progresso atual
  const badges = await prisma.badge.findMany({ where: { ativo: true } });

  // Calcular métricas do usuário
  const [totalEntregas, totalKm, entregas] = await Promise.all([
    prisma.parada.count({
      where: {
        rota: { userId },
        status: 'ENTREGUE',
      },
    }),
    prisma.rota.aggregate({
      where: { userId },
      _sum: { distanciaTotalKm: true },
    }),
    prisma.parada.findMany({
      where: {
        rota: { userId },
        status: 'ENTREGUE',
      },
      select: { fornecedor: true, entregueEm: true },
    }),
  ]);

  // Contar por fornecedor
  const entregasPorFornecedor = new Map<string, number>();
  for (const e of entregas) {
    const fornecedor = e.fornecedor || 'outros';
    entregasPorFornecedor.set(fornecedor, (entregasPorFornecedor.get(fornecedor) || 0) + 1);
  }

  // Calcular streak
  const streakAtual = await calcularStreak(userId);

  for (const badge of badges) {
    let progressoAtual = 0;

    // Calcular progresso baseado no tipo
    switch (badge.tipo) {
      case 'ENTREGAS':
        progressoAtual = totalEntregas;
        break;

      case 'STREAK':
        progressoAtual = streakAtual;
        break;

      case 'DISTANCIA':
        progressoAtual = Math.floor(totalKm._sum.distanciaTotalKm || 0);
        break;

      case 'VELOCIDADE':
        if (badge.codigo === 'RAPIDO_5MIN') {
          progressoAtual = dadosEntrega.tempoMinutos < 5 ? 1 : 0;
        }
        break;

      case 'FORNECEDOR':
        if (badge.codigo.startsWith('NATURA')) {
          progressoAtual = entregasPorFornecedor.get('natura') || 0;
        } else if (badge.codigo.startsWith('ML')) {
          progressoAtual = entregasPorFornecedor.get('mercadolivre') || 0;
        } else if (badge.codigo.startsWith('SHOPEE')) {
          progressoAtual = entregasPorFornecedor.get('shopee') || 0;
        } else if (badge.codigo === 'MULTI_3') {
          progressoAtual = entregasPorFornecedor.size;
        }
        break;

      case 'ESPECIAL':
        if (badge.codigo === 'MADRUGADOR' && dadosEntrega.horaEntrega < 7) {
          progressoAtual = 1;
        } else if (badge.codigo === 'NOTURNO' && dadosEntrega.horaEntrega >= 22) {
          progressoAtual = 1;
        } else if (badge.codigo === 'FIM_DE_SEMANA') {
          const entregasFds = entregas.filter(e => {
            const dia = e.entregueEm?.getDay();
            return dia === 0 || dia === 6;
          }).length;
          progressoAtual = entregasFds;
        }
        break;
    }

    // Verificar/criar registro de progresso
    const registro = await prisma.usuarioBadge.upsert({
      where: {
        userId_badgeId: { userId, badgeId: badge.id },
      },
      create: {
        userId,
        badgeId: badge.id,
        progressoAtual,
      },
      update: {
        progressoAtual: Math.max(progressoAtual, 0),
      },
    });

    // Verificar se desbloqueou
    if (!registro.desbloqueadoEm && progressoAtual >= badge.requisito) {
      await prisma.usuarioBadge.update({
        where: { id: registro.id },
        data: { desbloqueadoEm: new Date() },
      });

      // Criar conquista
      await prisma.conquista.create({
        data: {
          userId,
          tipo: 'NOVO_BADGE',
          valor: badge.pontos,
          descricao: `Desbloqueou badge: ${badge.nome}`,
          pontosGanhos: badge.pontos,
        },
      });

      badgesDesbloqueados.push({
        id: badge.id,
        codigo: badge.codigo,
        nome: badge.nome,
        descricao: badge.descricao,
        icone: badge.icone,
        tipo: badge.tipo,
        requisito: badge.requisito,
        pontos: badge.pontos,
        raridade: badge.raridade,
        desbloqueado: true,
        progressoAtual,
        percentualProgresso: 100,
        desbloqueadoEm: new Date(),
      });
    }
  }

  // Atualizar ranking
  await atualizarRanking(userId);

  return { badgesDesbloqueados };
}

/**
 * Obtém ranking semanal
 * 
 * @pre userId para destacar posição do usuário
 * @post Lista de RankingEntry top 50
 */
export async function getRankingSemanal(userId: string): Promise<RankingEntry[]> {
  const inicioSemana = new Date();
  inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
  inicioSemana.setHours(0, 0, 0, 0);

  const rankings = await prisma.ranking.findMany({
    where: {
      periodo: 'SEMANAL',
      dataInicio: { gte: inicioSemana },
    },
    orderBy: { pontos: 'desc' },
    take: 50,
  });

  // Buscar nomes dos usuários
  const userIds = rankings.map(r => r.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, nome: true },
  });
  const userMap = new Map(users.map(u => [u.id, u.nome]));

  // Buscar badges desbloqueados
  const badgesCounts = await prisma.usuarioBadge.groupBy({
    by: ['userId'],
    where: {
      userId: { in: userIds },
      desbloqueadoEm: { not: null },
    },
    _count: true,
  });
  const badgesMap = new Map(badgesCounts.map(b => [b.userId, b._count]));

  return rankings.map((r, index) => ({
    posicao: index + 1,
    userId: r.userId,
    nome: userMap.get(r.userId) || 'Anônimo',
    pontos: r.pontos,
    totalEntregas: r.totalEntregas,
    streakAtual: r.streakAtual,
    badges: badgesMap.get(r.userId) || 0,
    isCurrentUser: r.userId === userId,
  }));
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

async function calcularStreak(userId: string): Promise<number> {
  // Buscar últimas entregas ordenadas por data
  const ultimasEntregas = await prisma.parada.findMany({
    where: {
      rota: { userId },
      status: 'ENTREGUE',
      entregueEm: { not: null },
    },
    orderBy: { entregueEm: 'desc' },
    select: { entregueEm: true },
    take: 100,
  });

  if (ultimasEntregas.length === 0) return 0;

  // Extrair datas únicas
  const datasUnicas = new Set<string>();
  for (const e of ultimasEntregas) {
    if (e.entregueEm) {
      datasUnicas.add(e.entregueEm.toISOString().split('T')[0]);
    }
  }

  const datas = Array.from(datasUnicas).sort().reverse();
  if (datas.length === 0) return 0;

  // Verificar se a última entrega foi hoje ou ontem
  const hoje = new Date().toISOString().split('T')[0];
  const ontem = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (datas[0] !== hoje && datas[0] !== ontem) {
    return 0; // Streak quebrado
  }

  // Contar dias consecutivos
  let streak = 1;
  for (let i = 0; i < datas.length - 1; i++) {
    const atual = new Date(datas[i]);
    const anterior = new Date(datas[i + 1]);
    const diffDias = Math.floor((atual.getTime() - anterior.getTime()) / 86400000);

    if (diffDias === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

async function atualizarRanking(userId: string): Promise<void> {
  const inicioSemana = new Date();
  inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
  inicioSemana.setHours(0, 0, 0, 0);

  const fimSemana = new Date(inicioSemana);
  fimSemana.setDate(fimSemana.getDate() + 6);
  fimSemana.setHours(23, 59, 59, 999);

  // Buscar métricas da semana
  const [entregas, rotas, badges] = await Promise.all([
    prisma.parada.count({
      where: {
        rota: { userId },
        status: 'ENTREGUE',
        entregueEm: { gte: inicioSemana, lte: fimSemana },
      },
    }),
    prisma.rota.aggregate({
      where: {
        userId,
        createdAt: { gte: inicioSemana, lte: fimSemana },
      },
      _sum: { distanciaTotalKm: true },
    }),
    prisma.usuarioBadge.count({
      where: {
        userId,
        desbloqueadoEm: { not: null },
      },
    }),
  ]);

  const streakAtual = await calcularStreak(userId);
  const pontos = (entregas * 10) + (badges * 25) + (streakAtual * 5);

  await prisma.ranking.upsert({
    where: {
      userId_periodo_dataInicio: {
        userId,
        periodo: 'SEMANAL',
        dataInicio: inicioSemana,
      },
    },
    create: {
      userId,
      periodo: 'SEMANAL',
      dataInicio: inicioSemana,
      dataFim: fimSemana,
      totalEntregas: entregas,
      totalKm: rotas._sum.distanciaTotalKm || 0,
      pontos,
      streakAtual,
      maiorStreak: streakAtual,
    },
    update: {
      totalEntregas: entregas,
      totalKm: rotas._sum.distanciaTotalKm || 0,
      pontos,
      streakAtual,
      maiorStreak: { increment: 0 }, // Será recalculado
    },
  });

  // Atualizar posições
  const todosRankings = await prisma.ranking.findMany({
    where: { periodo: 'SEMANAL', dataInicio: inicioSemana },
    orderBy: { pontos: 'desc' },
  });

  for (let i = 0; i < todosRankings.length; i++) {
    await prisma.ranking.update({
      where: { id: todosRankings[i].id },
      data: { posicao: i + 1 },
    });
  }
}

// ==========================================
// EXPORT DEFAULT
// ==========================================

export default {
  inicializarBadges,
  getPerfilGamificacao,
  getBadgesUsuario,
  atualizarProgressoAposEntrega,
  getRankingSemanal,
  getEventosSazonais,
  getTodosEventosSazonais,
  getDesafiosSazonais,
  atualizarProgressoDesafio,
  verificarBonusSazonal,
};

// ==========================================
// EVENTOS SAZONAIS
// ==========================================

/**
 * Configuração de eventos sazonais
 * Cada evento tem multiplicadores e badges especiais
 */
interface EventoSazonal {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  dataInicio: Date;
  dataFim: Date;
  multiplicadorPontos: number;
  multiplicadorXP: number;
  badgeEspecial?: {
    codigo: string;
    nome: string;
    descricao: string;
    icone: string;
    requisito: number; // entregas durante o evento
    pontos: number;
  };
  desafios: DesafioSazonal[];
  ativo: boolean;
}

interface DesafioSazonal {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  tipo: 'ENTREGAS' | 'DISTANCIA' | 'STREAK' | 'TEMPO';
  requisito: number;
  premio: number; // pontos
  progressoAtual?: number;
  completado?: boolean;
}

/**
 * Calendário de eventos sazonais do ano
 * @pre Datas em formato Date
 * @post Lista de eventos configurados
 */
const EVENTOS_SAZONAIS: EventoSazonal[] = [
  {
    id: 'carnaval-2025',
    nome: 'Maratona de Carnaval',
    descricao: 'Entregue durante o Carnaval e ganhe pontos extras!',
    icone: '🎭',
    dataInicio: new Date('2025-02-28'),
    dataFim: new Date('2025-03-05'),
    multiplicadorPontos: 2.0,
    multiplicadorXP: 1.5,
    badgeEspecial: {
      codigo: 'CARNAVAL_2025',
      nome: 'Folião das Entregas',
      descricao: '50 entregas durante o Carnaval 2025',
      icone: '🎭',
      requisito: 50,
      pontos: 200,
    },
    desafios: [
      { id: 'carnaval-10', nome: '10 Entregas de Carnaval', descricao: 'Complete 10 entregas', icone: '🎉', tipo: 'ENTREGAS', requisito: 10, premio: 50 },
      { id: 'carnaval-50', nome: 'Maratonista do Carnaval', descricao: 'Complete 50 entregas', icone: '🏃', tipo: 'ENTREGAS', requisito: 50, premio: 200 },
    ],
    ativo: true,
  },
  {
    id: 'pascoa-2025',
    nome: 'Caça aos Ovos',
    descricao: 'Entregue "ovos de Páscoa" e colecione prêmios!',
    icone: '🐰',
    dataInicio: new Date('2025-04-17'),
    dataFim: new Date('2025-04-21'),
    multiplicadorPontos: 1.8,
    multiplicadorXP: 1.5,
    badgeEspecial: {
      codigo: 'PASCOA_2025',
      nome: 'Coelho da Páscoa',
      descricao: '30 entregas durante a Páscoa 2025',
      icone: '🐰',
      requisito: 30,
      pontos: 150,
    },
    desafios: [
      { id: 'pascoa-15', nome: 'Caçador de Ovos', descricao: '15 entregas = 15 ovos', icone: '🥚', tipo: 'ENTREGAS', requisito: 15, premio: 75 },
      { id: 'pascoa-streak', nome: 'Coelho Persistente', descricao: '5 dias consecutivos', icone: '🐇', tipo: 'STREAK', requisito: 5, premio: 100 },
    ],
    ativo: true,
  },
  {
    id: 'dia-maes-2025',
    nome: 'Especial Dia das Mães',
    descricao: 'O dia mais movimentado do ano - pontos em dobro!',
    icone: '💐',
    dataInicio: new Date('2025-05-08'),
    dataFim: new Date('2025-05-12'),
    multiplicadorPontos: 2.5,
    multiplicadorXP: 2.0,
    badgeEspecial: {
      codigo: 'DIA_MAES_2025',
      nome: 'Herói das Mães',
      descricao: '100 entregas na semana do Dia das Mães',
      icone: '💐',
      requisito: 100,
      pontos: 500,
    },
    desafios: [
      { id: 'maes-50', nome: 'Entregador Dedicado', descricao: '50 entregas', icone: '📦', tipo: 'ENTREGAS', requisito: 50, premio: 150 },
      { id: 'maes-100', nome: 'Super Entregador', descricao: '100 entregas', icone: '🦸', tipo: 'ENTREGAS', requisito: 100, premio: 350 },
      { id: 'maes-rapido', nome: 'Presente a Tempo', descricao: '20 entregas sem atraso', icone: '⏰', tipo: 'TEMPO', requisito: 20, premio: 100 },
    ],
    ativo: true,
  },
  {
    id: 'dia-namorados-2025',
    nome: 'Entrega com Amor',
    descricao: 'Dia dos Namorados - espalhe amor!',
    icone: '💕',
    dataInicio: new Date('2025-06-10'),
    dataFim: new Date('2025-06-13'),
    multiplicadorPontos: 1.8,
    multiplicadorXP: 1.5,
    badgeEspecial: {
      codigo: 'DIA_NAMORADOS_2025',
      nome: 'Cupido das Entregas',
      descricao: '40 entregas no Dia dos Namorados',
      icone: '💕',
      requisito: 40,
      pontos: 150,
    },
    desafios: [
      { id: 'namorados-20', nome: 'Mensageiro do Amor', descricao: '20 entregas', icone: '💘', tipo: 'ENTREGAS', requisito: 20, premio: 80 },
    ],
    ativo: true,
  },
  {
    id: 'dia-pais-2025',
    nome: 'Especial Dia dos Pais',
    descricao: 'Honre os pais com entregas rápidas!',
    icone: '👔',
    dataInicio: new Date('2025-08-07'),
    dataFim: new Date('2025-08-11'),
    multiplicadorPontos: 2.0,
    multiplicadorXP: 1.8,
    badgeEspecial: {
      codigo: 'DIA_PAIS_2025',
      nome: 'Orgulho do Pai',
      descricao: '75 entregas no Dia dos Pais',
      icone: '👔',
      requisito: 75,
      pontos: 300,
    },
    desafios: [
      { id: 'pais-40', nome: 'Presente do Filho', descricao: '40 entregas', icone: '🎁', tipo: 'ENTREGAS', requisito: 40, premio: 120 },
      { id: 'pais-75', nome: 'Super Filho', descricao: '75 entregas', icone: '💪', tipo: 'ENTREGAS', requisito: 75, premio: 250 },
    ],
    ativo: true,
  },
  {
    id: 'black-friday-2025',
    nome: 'Black Friday Marathon',
    descricao: 'A maior maratona de entregas do ano!',
    icone: '🖤',
    dataInicio: new Date('2025-11-24'),
    dataFim: new Date('2025-12-01'),
    multiplicadorPontos: 3.0,
    multiplicadorXP: 2.5,
    badgeEspecial: {
      codigo: 'BLACK_FRIDAY_2025',
      nome: 'Sobrevivente Black Friday',
      descricao: '200 entregas na Black Friday Week',
      icone: '🖤',
      requisito: 200,
      pontos: 1000,
    },
    desafios: [
      { id: 'bf-100', nome: 'Black Friday 100', descricao: 'Complete 100 entregas', icone: '💯', tipo: 'ENTREGAS', requisito: 100, premio: 300 },
      { id: 'bf-200', nome: 'Black Friday Master', descricao: 'Complete 200 entregas', icone: '🏆', tipo: 'ENTREGAS', requisito: 200, premio: 750 },
      { id: 'bf-streak', nome: 'Semana Perfeita BF', descricao: '7 dias consecutivos', icone: '🔥', tipo: 'STREAK', requisito: 7, premio: 200 },
      { id: 'bf-km', nome: 'Maratonista BF', descricao: '500km rodados', icone: '🏃', tipo: 'DISTANCIA', requisito: 500, premio: 400 },
    ],
    ativo: true,
  },
  {
    id: 'natal-2025',
    nome: 'Natal Mágico',
    descricao: 'Seja o Papai Noel das entregas!',
    icone: '🎄',
    dataInicio: new Date('2025-12-15'),
    dataFim: new Date('2025-12-26'),
    multiplicadorPontos: 2.5,
    multiplicadorXP: 2.0,
    badgeEspecial: {
      codigo: 'NATAL_2025',
      nome: 'Papai Noel 2025',
      descricao: '150 entregas no período natalino',
      icone: '🎅',
      requisito: 150,
      pontos: 600,
    },
    desafios: [
      { id: 'natal-75', nome: 'Ajudante do Noel', descricao: '75 presentes entregues', icone: '🎁', tipo: 'ENTREGAS', requisito: 75, premio: 250 },
      { id: 'natal-150', nome: 'Rena Oficial', descricao: '150 presentes entregues', icone: '🦌', tipo: 'ENTREGAS', requisito: 150, premio: 500 },
      { id: 'natal-vespera', nome: 'Véspera Perfeita', descricao: '30 entregas em 24/12', icone: '✨', tipo: 'ENTREGAS', requisito: 30, premio: 300 },
    ],
    ativo: true,
  },
];

/**
 * Obtém eventos sazonais ativos
 * 
 * @pre Data atual disponível
 * @post Lista de eventos em andamento
 */
export function getEventosSazonais(data: Date = new Date()): EventoSazonal[] {
  return EVENTOS_SAZONAIS.filter(evento => {
    const agora = data.getTime();
    return evento.ativo && 
           agora >= evento.dataInicio.getTime() && 
           agora <= evento.dataFim.getTime();
  });
}

/**
 * Obtém todos os eventos do ano (ativos e futuros)
 */
export function getTodosEventosSazonais(): EventoSazonal[] {
  const agora = new Date();
  return EVENTOS_SAZONAIS.filter(evento => {
    return evento.ativo && evento.dataFim.getTime() >= agora.getTime();
  }).sort((a, b) => a.dataInicio.getTime() - b.dataInicio.getTime());
}

/**
 * Obtém desafios sazonais com progresso do usuário
 * 
 * @pre userId válido, evento ativo
 * @post Lista de desafios com progresso
 */
export async function getDesafiosSazonais(
  userId: string,
  eventoId?: string
): Promise<DesafioSazonal[]> {
  const eventosAtivos = eventoId 
    ? EVENTOS_SAZONAIS.filter(e => e.id === eventoId)
    : getEventosSazonais();
  
  const desafios: DesafioSazonal[] = [];
  
  for (const evento of eventosAtivos) {
    // Buscar entregas do usuário durante o evento
    const entregas = await prisma.parada.count({
      where: {
        rota: { userId },
        status: 'ENTREGUE',
        entregueEm: {
          gte: evento.dataInicio,
          lte: evento.dataFim,
        },
      },
    });
    
    // Buscar km rodados
    const kmRodados = await prisma.rota.aggregate({
      where: {
        userId,
        status: 'FINALIZADA',
        finalizadaEm: {
          gte: evento.dataInicio,
          lte: evento.dataFim,
        },
      },
      _sum: { distanciaTotalKm: true },
    });
    
    // Calcular streak durante o evento
    // (simplificado - usa o streak atual)
    const ranking = await prisma.ranking.findFirst({
      where: { userId },
      orderBy: { dataInicio: 'desc' },
    });
    
    for (const desafio of evento.desafios) {
      let progresso = 0;
      
      switch (desafio.tipo) {
        case 'ENTREGAS':
          progresso = entregas;
          break;
        case 'DISTANCIA':
          progresso = Math.round(kmRodados._sum.distanciaTotalKm || 0);
          break;
        case 'STREAK':
          progresso = ranking?.streakAtual || 0;
          break;
        case 'TEMPO':
          // Entregas sem atraso é mais complexo, usar entregas por ora
          progresso = Math.round(entregas * 0.9); // Assume 90% no tempo
          break;
      }
      
      desafios.push({
        ...desafio,
        progressoAtual: progresso,
        completado: progresso >= desafio.requisito,
      });
    }
  }
  
  return desafios;
}

/**
 * Atualiza progresso de desafio sazonal
 * (Chamado após cada entrega)
 * 
 * @pre userId e entrega válidos
 * @post Desafios verificados e pontos creditados se completados
 */
export async function atualizarProgressoDesafio(
  userId: string,
  dadosEntrega: { kmPercorridos: number }
): Promise<{ desafiosCompletados: DesafioSazonal[]; pontosGanhos: number }> {
  const eventosAtivos = getEventosSazonais();
  const desafiosCompletados: DesafioSazonal[] = [];
  let pontosGanhos = 0;
  
  for (const evento of eventosAtivos) {
    const desafiosComProgresso = await getDesafiosSazonais(userId, evento.id);
    
    for (const desafio of desafiosComProgresso) {
      if (desafio.completado && !await desafioJaRecompensado(userId, desafio.id)) {
        // Marcar como recompensado e creditar pontos
        await marcarDesafioRecompensado(userId, desafio.id);
        pontosGanhos += desafio.premio;
        desafiosCompletados.push(desafio);
      }
    }
  }
  
  return { desafiosCompletados, pontosGanhos };
}

/**
 * Verifica se usuário tem bônus de evento sazonal ativo
 * 
 * @pre userId válido
 * @post Multiplicador aplicável ou 1.0 se sem evento
 */
export function verificarBonusSazonal(): { 
  multiplicadorPontos: number; 
  multiplicadorXP: number;
  eventoAtivo: string | null 
} {
  const eventosAtivos = getEventosSazonais();
  
  if (eventosAtivos.length === 0) {
    return { multiplicadorPontos: 1.0, multiplicadorXP: 1.0, eventoAtivo: null };
  }
  
  // Usar o maior multiplicador se houver múltiplos eventos
  const maiorMultPontos = Math.max(...eventosAtivos.map(e => e.multiplicadorPontos));
  const maiorMultXP = Math.max(...eventosAtivos.map(e => e.multiplicadorXP));
  const eventoNome = eventosAtivos.find(e => e.multiplicadorPontos === maiorMultPontos)?.nome || null;
  
  return {
    multiplicadorPontos: maiorMultPontos,
    multiplicadorXP: maiorMultXP,
    eventoAtivo: eventoNome,
  };
}

// Funções auxiliares para persistência de desafios
async function desafioJaRecompensado(userId: string, desafioId: string): Promise<boolean> {
  // Verificar no perfil ou tabela separada
  // Por ora, retorna false (sempre pode completar)
  // TODO: Implementar persistência de desafios completados
  return false;
}

async function marcarDesafioRecompensado(userId: string, desafioId: string): Promise<void> {
  // Salvar desafio como completado
  // TODO: Implementar persistência
  console.log(`Desafio ${desafioId} completado pelo usuário ${userId}`);
}
