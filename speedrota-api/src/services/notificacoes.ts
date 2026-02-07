/**
 * @fileoverview Serviço de Notificações Push
 *
 * TIPOS DE NOTIFICAÇÃO:
 * 1. TRAFEGO_INTENSO - Congestionamento detectado
 * 2. CANCELAMENTO - Cliente cancelou entrega
 * 3. JANELA_EXPIRANDO - Janela de tempo próxima de expirar
 * 4. NOVO_PEDIDO - Novo pedido urgente adicionado
 * 5. ENTREGA_CONFIRMADA - POD registrado com sucesso
 * 6. ATRASO_DETECTADO - Rota atrasada
 * 7. ROTA_REOTIMIZADA - Rota foi recalculada
 *
 * DESIGN POR CONTRATO:
 * @pre Token de push válido registrado
 * @post Notificação enviada e salva no histórico
 * @invariant Notificações não lidas persistem até serem marcadas
 */

import { prisma } from '../lib/prisma.js';
import webpush from 'web-push';
import { env } from '../config/env.js';

// ==========================================
// CONFIGURAÇÃO WEB PUSH
// ==========================================

// Configurar VAPID keys (gerar uma vez e salvar no .env)
if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:contato@speedrota.com.br',
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );
}

// ==========================================
// TIPOS
// ==========================================

export type TipoNotificacao =
  | 'TRAFEGO_INTENSO'
  | 'CANCELAMENTO'
  | 'JANELA_EXPIRANDO'
  | 'NOVO_PEDIDO'
  | 'ENTREGA_CONFIRMADA'
  | 'ATRASO_DETECTADO'
  | 'ROTA_REOTIMIZADA'
  | 'SISTEMA';

export interface NotificacaoPayload {
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  icone?: string;
  dados?: Record<string, unknown>;
  rotaId?: string;
  paradaId?: string;
  acaoUrl?: string;
}

export interface TokenPush {
  userId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  platform: 'web' | 'android' | 'ios';
  deviceId?: string;
}

// ==========================================
// TEMPLATES DE NOTIFICAÇÃO
// ==========================================

const TEMPLATES: Record<TipoNotificacao, { titulo: string; icone: string }> = {
  TRAFEGO_INTENSO: {
    titulo: '🚗 Tráfego Intenso',
    icone: '🚗',
  },
  CANCELAMENTO: {
    titulo: '❌ Entrega Cancelada',
    icone: '❌',
  },
  JANELA_EXPIRANDO: {
    titulo: '⏰ Janela Expirando',
    icone: '⏰',
  },
  NOVO_PEDIDO: {
    titulo: '🚨 Novo Pedido Urgente',
    icone: '🚨',
  },
  ENTREGA_CONFIRMADA: {
    titulo: '✅ Entrega Confirmada',
    icone: '✅',
  },
  ATRASO_DETECTADO: {
    titulo: '⚠️ Atraso Detectado',
    icone: '⚠️',
  },
  ROTA_REOTIMIZADA: {
    titulo: '🔄 Rota Atualizada',
    icone: '🔄',
  },
  SISTEMA: {
    titulo: '📢 SpeedRota',
    icone: '📢',
  },
};

// ==========================================
// FUNÇÕES DE TOKEN
// ==========================================

/**
 * Registra token de push para um usuário
 *
 * @pre userId válido, subscription válida
 * @post Token salvo no banco
 */
export async function registrarToken(token: TokenPush): Promise<void> {
  await prisma.tokenPush.upsert({
    where: {
      userId_endpoint: {
        userId: token.userId,
        endpoint: token.endpoint,
      },
    },
    update: {
      p256dh: token.keys.p256dh,
      auth: token.keys.auth,
      platform: token.platform,
      deviceId: token.deviceId,
      updatedAt: new Date(),
    },
    create: {
      userId: token.userId,
      endpoint: token.endpoint,
      p256dh: token.keys.p256dh,
      auth: token.keys.auth,
      platform: token.platform,
      deviceId: token.deviceId,
    },
  });
}

/**
 * Remove token de push
 *
 * @pre endpoint existe
 * @post Token removido
 */
export async function removerToken(
  userId: string,
  endpoint: string
): Promise<void> {
  await prisma.tokenPush.deleteMany({
    where: { userId, endpoint },
  });
}

/**
 * Obtém todos os tokens de um usuário
 */
export async function obterTokensUsuario(userId: string) {
  return prisma.tokenPush.findMany({
    where: { userId },
  });
}

// ==========================================
// FUNÇÕES DE ENVIO
// ==========================================

/**
 * Envia notificação push para um usuário
 *
 * @pre userId tem tokens registrados
 * @post Notificação enviada e salva
 */
export async function enviarNotificacao(
  userId: string,
  payload: NotificacaoPayload
): Promise<{ enviadas: number; falhas: number }> {
  const tokens = await obterTokensUsuario(userId);
  const template = TEMPLATES[payload.tipo] || TEMPLATES.SISTEMA;

  let enviadas = 0;
  let falhas = 0;

  // Salvar notificação no banco
  const notificacao = await prisma.notificacao.create({
    data: {
      userId,
      tipo: payload.tipo,
      titulo: payload.titulo || template.titulo,
      mensagem: payload.mensagem,
      icone: payload.icone || template.icone,
      rotaId: payload.rotaId,
      paradaId: payload.paradaId,
      dados: payload.dados ? JSON.stringify(payload.dados) : null,
      acaoUrl: payload.acaoUrl,
    },
  });

  // Enviar para cada token
  for (const token of tokens) {
    try {
      const pushPayload = JSON.stringify({
        title: payload.titulo || template.titulo,
        body: payload.mensagem,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: `speedrota-${payload.tipo}-${notificacao.id}`,
        data: {
          notificacaoId: notificacao.id,
          tipo: payload.tipo,
          rotaId: payload.rotaId,
          paradaId: payload.paradaId,
          acaoUrl: payload.acaoUrl,
          ...payload.dados,
        },
        actions: obterAcoes(payload.tipo),
      });

      await webpush.sendNotification(
        {
          endpoint: token.endpoint,
          keys: {
            p256dh: token.p256dh,
            auth: token.auth,
          },
        },
        pushPayload
      );

      enviadas++;
    } catch (error: unknown) {
      console.error('Erro ao enviar push:', error);
      falhas++;

      // Se o endpoint não é mais válido, remover
      if (error && typeof error === 'object' && 'statusCode' in error) {
        const statusCode = (error as { statusCode: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await removerToken(userId, token.endpoint);
        }
      }
    }
  }

  return { enviadas, falhas };
}

/**
 * Envia notificação para múltiplos usuários
 */
export async function enviarNotificacaoEmMassa(
  userIds: string[],
  payload: NotificacaoPayload
): Promise<{ total: number; enviadas: number; falhas: number }> {
  let totalEnviadas = 0;
  let totalFalhas = 0;

  for (const userId of userIds) {
    const { enviadas, falhas } = await enviarNotificacao(userId, payload);
    totalEnviadas += enviadas;
    totalFalhas += falhas;
  }

  return {
    total: userIds.length,
    enviadas: totalEnviadas,
    falhas: totalFalhas,
  };
}

// ==========================================
// FUNÇÕES DE HISTÓRICO
// ==========================================

/**
 * Obtém notificações de um usuário
 */
export async function obterNotificacoes(
  userId: string,
  options: {
    limite?: number;
    apenasNaoLidas?: boolean;
    tipo?: TipoNotificacao;
  } = {}
): Promise<{
  notificacoes: Array<{
    id: string;
    tipo: string;
    titulo: string;
    mensagem: string;
    icone: string | null;
    read: boolean;
    createdAt: Date;
    rotaId: string | null;
    acaoUrl: string | null;
  }>;
  naoLidas: number;
}> {
  const { limite = 50, apenasNaoLidas = false, tipo } = options;

  const where: Record<string, unknown> = { userId };
  if (apenasNaoLidas) where.read = false;
  if (tipo) where.tipo = tipo;

  const [notificacoes, naoLidas] = await Promise.all([
    prisma.notificacao.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limite,
      select: {
        id: true,
        tipo: true,
        titulo: true,
        mensagem: true,
        icone: true,
        read: true,
        createdAt: true,
        rotaId: true,
        acaoUrl: true,
      },
    }),
    prisma.notificacao.count({
      where: { userId, read: false },
    }),
  ]);

  return { notificacoes, naoLidas };
}

/**
 * Marca notificação como lida
 */
export async function marcarComoLida(
  userId: string,
  notificacaoId: string
): Promise<void> {
  await prisma.notificacao.updateMany({
    where: { id: notificacaoId, userId },
    data: { read: true, readAt: new Date() },
  });
}

/**
 * Marca todas como lidas
 */
export async function marcarTodasComoLidas(userId: string): Promise<number> {
  const result = await prisma.notificacao.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() },
  });
  return result.count;
}

// ==========================================
// HELPERS DE NOTIFICAÇÃO
// ==========================================

/**
 * Obtém ações para tipo de notificação
 */
function obterAcoes(tipo: TipoNotificacao): Array<{ action: string; title: string }> {
  switch (tipo) {
    case 'TRAFEGO_INTENSO':
    case 'ATRASO_DETECTADO':
      return [
        { action: 'reotimizar', title: 'Recalcular Rota' },
        { action: 'ignorar', title: 'Ignorar' },
      ];
    case 'CANCELAMENTO':
      return [
        { action: 'ver_rota', title: 'Ver Rota' },
        { action: 'ok', title: 'OK' },
      ];
    case 'JANELA_EXPIRANDO':
      return [
        { action: 'navegar', title: 'Navegar Agora' },
        { action: 'adiar', title: 'Adiar' },
      ];
    case 'NOVO_PEDIDO':
      return [
        { action: 'aceitar', title: 'Aceitar' },
        { action: 'recusar', title: 'Recusar' },
      ];
    default:
      return [{ action: 'ver', title: 'Ver Detalhes' }];
  }
}

// ==========================================
// NOTIFICAÇÕES AUTOMÁTICAS
// ==========================================

/**
 * Notifica tráfego intenso
 */
export async function notificarTrafegoIntenso(
  userId: string,
  rotaId: string,
  fatorTrafego: number
): Promise<void> {
  await enviarNotificacao(userId, {
    tipo: 'TRAFEGO_INTENSO',
    titulo: '🚗 Tráfego Intenso Detectado',
    mensagem: `Trânsito ${fatorTrafego >= 1.5 ? 'pesado' : 'moderado'} na sua rota. Deseja recalcular?`,
    rotaId,
    acaoUrl: `/rota/${rotaId}`,
    dados: { fatorTrafego },
  });
}

/**
 * Notifica cancelamento de entrega
 */
export async function notificarCancelamento(
  userId: string,
  rotaId: string,
  paradaId: string,
  nomeCliente: string
): Promise<void> {
  await enviarNotificacao(userId, {
    tipo: 'CANCELAMENTO',
    titulo: '❌ Entrega Cancelada',
    mensagem: `Cliente "${nomeCliente}" cancelou. Rota foi atualizada automaticamente.`,
    rotaId,
    paradaId,
    acaoUrl: `/rota/${rotaId}`,
  });
}

/**
 * Notifica janela expirando
 */
export async function notificarJanelaExpirando(
  userId: string,
  rotaId: string,
  paradaId: string,
  nomeCliente: string,
  minutosRestantes: number
): Promise<void> {
  await enviarNotificacao(userId, {
    tipo: 'JANELA_EXPIRANDO',
    titulo: '⏰ Janela de Tempo',
    mensagem: `Entrega para "${nomeCliente}" expira em ${minutosRestantes} minutos!`,
    rotaId,
    paradaId,
    acaoUrl: `/rota/${rotaId}`,
    dados: { minutosRestantes },
  });
}

/**
 * Notifica novo pedido urgente
 */
export async function notificarNovoPedido(
  userId: string,
  rotaId: string,
  endereco: string
): Promise<void> {
  await enviarNotificacao(userId, {
    tipo: 'NOVO_PEDIDO',
    titulo: '🚨 Novo Pedido Urgente',
    mensagem: `Nova entrega adicionada: ${endereco}`,
    rotaId,
    acaoUrl: `/rota/${rotaId}`,
  });
}

/**
 * Notifica entrega confirmada
 */
export async function notificarEntregaConfirmada(
  userId: string,
  rotaId: string,
  paradaId: string,
  nomeCliente: string,
  restantes: number
): Promise<void> {
  await enviarNotificacao(userId, {
    tipo: 'ENTREGA_CONFIRMADA',
    titulo: '✅ Entrega Confirmada',
    mensagem: `Entrega para "${nomeCliente}" registrada. Faltam ${restantes} entregas.`,
    rotaId,
    paradaId,
    acaoUrl: `/rota/${rotaId}`,
    dados: { restantes },
  });
}

/**
 * Notifica rota re-otimizada
 */
export async function notificarRotaReotimizada(
  userId: string,
  rotaId: string,
  motivo: string,
  economiaKm?: number
): Promise<void> {
  let mensagem = `Sua rota foi recalculada: ${motivo}`;
  if (economiaKm && economiaKm > 0) {
    mensagem += `. Economia de ${economiaKm.toFixed(1)} km!`;
  }

  await enviarNotificacao(userId, {
    tipo: 'ROTA_REOTIMIZADA',
    titulo: '🔄 Rota Atualizada',
    mensagem,
    rotaId,
    acaoUrl: `/rota/${rotaId}`,
    dados: { motivo, economiaKm },
  });
}
