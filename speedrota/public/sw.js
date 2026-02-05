/**
 * @fileoverview Service Worker para Push Notifications
 * 
 * FUNCIONALIDADES:
 * - Recebe push notifications
 * - Exibe notificações nativas
 * - Gerencia ações de clique
 * - Cache offline básico
 * 
 * @design_contract
 * @pre Browser suporta Service Worker e Push API
 * @post Notificações exibidas e ações processadas
 */

// Nome do cache
const CACHE_NAME = 'speedrota-v1';

// Arquivos para cache offline
const OFFLINE_URLS = [
  '/',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/badge-72.png',
];

// ==========================================
// INSTALL EVENT
// ==========================================

self.addEventListener('install', (event) => {
  console.log('[SW] Install');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching offline files');
      return cache.addAll(OFFLINE_URLS);
    })
  );
  
  // Ativa imediatamente
  self.skipWaiting();
});

// ==========================================
// ACTIVATE EVENT
// ==========================================

self.addEventListener('activate', (event) => {
  console.log('[SW] Activate');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  
  // Toma controle de todas as páginas
  self.clients.claim();
});

// ==========================================
// PUSH EVENT - Recebe Notificação
// ==========================================

self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  
  if (!event.data) {
    console.log('[SW] Push sem dados');
    return;
  }
  
  try {
    const data = event.data.json();
    console.log('[SW] Push data:', data);
    
    const options = {
      body: data.body || 'Nova notificação do SpeedRota',
      icon: data.icon || '/icons/icon-192.png',
      badge: data.badge || '/icons/badge-72.png',
      tag: data.tag || 'speedrota-notification',
      data: data.data || {},
      vibrate: [200, 100, 200],
      requireInteraction: shouldRequireInteraction(data.data?.tipo),
      actions: data.actions || [],
      silent: false,
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'SpeedRota', options)
    );
  } catch (error) {
    console.error('[SW] Erro ao processar push:', error);
    
    // Fallback para notificação simples
    event.waitUntil(
      self.registration.showNotification('SpeedRota', {
        body: event.data.text() || 'Nova notificação',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
      })
    );
  }
});

// ==========================================
// NOTIFICATION CLICK - Ação de Clique
// ==========================================

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event.action);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  const action = event.action;
  
  // Determinar URL baseado na ação
  let targetUrl = '/';
  
  if (action === 'reotimizar' && data.rotaId) {
    targetUrl = `/rota/${data.rotaId}?action=reotimizar`;
  } else if (action === 'ver_rota' && data.rotaId) {
    targetUrl = `/rota/${data.rotaId}`;
  } else if (action === 'navegar' && data.rotaId) {
    targetUrl = `/rota/${data.rotaId}?action=navegar`;
  } else if (action === 'aceitar' && data.rotaId) {
    targetUrl = `/rota/${data.rotaId}?action=aceitar_pedido`;
  } else if (data.acaoUrl) {
    targetUrl = data.acaoUrl;
  } else if (data.rotaId) {
    targetUrl = `/rota/${data.rotaId}`;
  }
  
  // Marcar notificação como lida via API
  if (data.notificacaoId) {
    fetch(`/api/v1/notificacoes/${data.notificacaoId}/lida`, {
      method: 'PATCH',
      credentials: 'include',
    }).catch(console.error);
  }
  
  // Abrir ou focar na janela
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Verifica se já tem uma janela aberta
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        
        // Abre nova janela
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ==========================================
// NOTIFICATION CLOSE
// ==========================================

self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
  
  const data = event.notification.data || {};
  
  // Analytics: notificação descartada
  if (data.notificacaoId) {
    // Poderia enviar analytics aqui
  }
});

// ==========================================
// PUSH SUBSCRIPTION CHANGE
// ==========================================

self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed');
  
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        // A chave pública será injetada via build ou config
        self.__VAPID_PUBLIC_KEY__ || ''
      ),
    }).then((subscription) => {
      // Re-registrar no servidor
      return fetch('/api/v1/notificacoes/subscribe', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))),
            auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')))),
          },
          platform: 'web',
        }),
      });
    })
  );
});

// ==========================================
// FETCH - Cache Offline (básico)
// ==========================================

self.addEventListener('fetch', (event) => {
  // Apenas para requests de navegação
  if (event.request.mode !== 'navigate') {
    return;
  }
  
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match('/offline.html');
    })
  );
});

// ==========================================
// HELPERS
// ==========================================

/**
 * Determina se notificação deve persistir até interação
 */
function shouldRequireInteraction(tipo) {
  const tiposUrgentes = [
    'TRAFEGO_INTENSO',
    'ATRASO_DETECTADO',
    'JANELA_EXPIRANDO',
    'NOVO_PEDIDO',
  ];
  return tiposUrgentes.includes(tipo);
}

/**
 * Converte chave VAPID de base64 para Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
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
// MESSAGE EVENT - Comunicação com página
// ==========================================

self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'SET_VAPID_KEY') {
    self.__VAPID_PUBLIC_KEY__ = event.data.key;
  }
});
