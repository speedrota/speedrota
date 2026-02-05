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
};
