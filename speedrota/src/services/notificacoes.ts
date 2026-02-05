/**
 * @fileoverview Serviço de Notificações Push (Web)
 *
 * FUNCIONALIDADES:
 * - Registrar/remover subscription
 * - Listar notificações
 * - Marcar como lida
 * - Verificar permissão
 *
 * DESIGN POR CONTRATO:
 * @pre Browser suporta Push API e Service Worker
 * @post Notificações gerenciadas via API
 */

import api from './api';

// ==========================================
// TIPOS
// ==========================================

export interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  icone: string | null;
  lida: boolean;
  criadaEm: string;
  rotaId: string | null;
  acaoUrl: string | null;
}

export interface NotificacoesResponse {
  success: boolean;
  notificacoes: Notificacao[];
  naoLidas: number;
}

// ==========================================
// CONSTANTES
// ==========================================

const SW_PATH = '/sw.js';

// ==========================================
// SERVICE WORKER
// ==========================================

/**
 * Registra o Service Worker
 * @pre Browser suporta Service Worker
 * @post SW registrado e pronto
 */
export async function registrarServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker não suportado');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_PATH);
    console.log('Service Worker registrado:', registration.scope);
    return registration;
  } catch (error) {
    console.error('Erro ao registrar SW:', error);
    return null;
  }
}

/**
 * Obtém chave VAPID pública do servidor
 */
async function obterVapidKey(): Promise<string | null> {
  try {
    const response = await api.get<{ success: boolean; publicKey: string | null }>(
      '/notificacoes/vapid-public-key'
    );
    return response.publicKey;
  } catch {
    console.error('Erro ao obter VAPID key');
    return null;
  }
}

/**
 * Converte VAPID key de base64 para Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

// ==========================================
// PUSH SUBSCRIPTION
// ==========================================

/**
 * Verifica suporte a Push
 */
export function suportaPush(): boolean {
  return 'PushManager' in window && 'serviceWorker' in navigator;
}

/**
 * Verifica permissão atual
 */
export function obterPermissao(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

/**
 * Solicita permissão para notificações
 */
export async function solicitarPermissao(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Registra subscription no servidor
 * @pre Permissão concedida, SW registrado
 * @post Subscription salva no backend
 */
export async function registrarSubscription(): Promise<boolean> {
  try {
    const permission = await solicitarPermissao();
    if (permission !== 'granted') {
      console.warn('Permissão negada');
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const vapidKey = await obterVapidKey();

    if (!vapidKey) {
      console.error('VAPID key não disponível');
      return false;
    }

    // Obter ou criar subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const serverKey = urlBase64ToUint8Array(vapidKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: serverKey.buffer as ArrayBuffer,
      });
    }

    // Enviar para o servidor
    const p256dh = subscription.getKey('p256dh');
    const auth = subscription.getKey('auth');

    if (!p256dh || !auth) {
      console.error('Keys não disponíveis');
      return false;
    }

    await api.post('/notificacoes/subscribe', {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dh))),
        auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
      },
      platform: 'web',
    });

    console.log('Subscription registrada com sucesso');
    return true;
  } catch (error) {
    console.error('Erro ao registrar subscription:', error);
    return false;
  }
}

/**
 * Remove subscription
 */
export async function removerSubscription(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // Remover do servidor (endpoint como parâmetro de query)
      const encodedEndpoint = encodeURIComponent(subscription.endpoint);
      await api.delete(`/notificacoes/unsubscribe?endpoint=${encodedEndpoint}`);

      // Cancelar localmente
      await subscription.unsubscribe();
    }

    return true;
  } catch (error) {
    console.error('Erro ao remover subscription:', error);
    return false;
  }
}

/**
 * Verifica se está inscrito
 */
export async function estaInscrito(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

// ==========================================
// API DE NOTIFICAÇÕES
// ==========================================

/**
 * Lista notificações do usuário
 */
export async function listarNotificacoes(options: {
  limite?: number;
  apenasNaoLidas?: boolean;
  tipo?: string;
} = {}): Promise<NotificacoesResponse> {
  const params = new URLSearchParams();
  if (options.limite) params.set('limite', String(options.limite));
  if (options.apenasNaoLidas) params.set('apenasNaoLidas', 'true');
  if (options.tipo) params.set('tipo', options.tipo);

  const query = params.toString();
  const endpoint = query ? `/notificacoes?${query}` : '/notificacoes';

  return api.get<NotificacoesResponse>(endpoint);
}

/**
 * Conta notificações não lidas
 */
export async function contarNaoLidas(): Promise<number> {
  const response = await api.get<{ success: boolean; naoLidas: number }>(
    '/notificacoes/nao-lidas'
  );
  return response.naoLidas;
}

/**
 * Marca notificação como lida
 */
export async function marcarComoLida(id: string): Promise<void> {
  await api.patch(`/notificacoes/${id}/lida`);
}

/**
 * Marca todas como lidas
 */
export async function marcarTodasComoLidas(): Promise<number> {
  const response = await api.patch<{ total: number }>('/notificacoes/todas-lidas');
  return response.total;
}

// ==========================================
// NOTIFICAÇÃO LOCAL (fallback)
// ==========================================

/**
 * Exibe notificação local (quando push não disponível)
 */
export function exibirNotificacaoLocal(
  titulo: string,
  mensagem: string,
  options?: NotificationOptions
): void {
  if (obterPermissao() !== 'granted') {
    console.warn('Permissão não concedida para notificações');
    return;
  }

  new Notification(titulo, {
    body: mensagem,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    ...options,
  });
}

// ==========================================
// HELPERS
// ==========================================

/**
 * Formata data relativa (ex: "há 5 minutos")
 */
export function formatarDataRelativa(data: string): string {
  const agora = new Date();
  const dataNotif = new Date(data);
  const diffMs = agora.getTime() - dataNotif.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHoras = Math.floor(diffMin / 60);
  const diffDias = Math.floor(diffHoras / 24);

  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffHoras < 24) return `há ${diffHoras}h`;
  if (diffDias < 7) return `há ${diffDias} dia${diffDias > 1 ? 's' : ''}`;

  return dataNotif.toLocaleDateString('pt-BR');
}

/**
 * Obtém ícone por tipo de notificação
 */
export function obterIconePorTipo(tipo: string): string {
  const icones: Record<string, string> = {
    TRAFEGO_INTENSO: '🚗',
    CANCELAMENTO: '❌',
    JANELA_EXPIRANDO: '⏰',
    NOVO_PEDIDO: '🚨',
    ENTREGA_CONFIRMADA: '✅',
    ATRASO_DETECTADO: '⚠️',
    ROTA_REOTIMIZADA: '🔄',
    SISTEMA: '📢',
  };

  return icones[tipo] || '📢';
}
