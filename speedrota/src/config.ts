/**
 * @fileoverview Configuração global do SpeedRota
 * 
 * DESIGN POR CONTRATO:
 * @pre Environment variables configuradas (VITE_*)
 * @post Exports de configuração disponíveis para toda a aplicação
 */

// ==========================================
// API CONFIGURATION
// ==========================================

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';
export const API_BASE_URL = API_URL;

// ==========================================
// APPLICATION CONFIG
// ==========================================

export const CONFIG = {
  // API
  API_URL,
  API_TIMEOUT: 30000, // 30 segundos
  
  // Maps
  MAP_TILE_URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  MAP_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  
  // OCR
  OCR_CONFIDENCE_MIN: 0.85,
  OCR_TIMEOUT: 60000, // 1 minuto
  
  // Geocoding
  NOMINATIM_URL: 'https://nominatim.openstreetmap.org',
  VIACEP_URL: 'https://viacep.com.br/ws',
  
  // Push Notifications
  VAPID_PUBLIC_KEY: import.meta.env.VITE_VAPID_PUBLIC_KEY || '',
  
  // Feature Flags
  ENABLE_PUSH_NOTIFICATIONS: true,
  ENABLE_POD: true,
  ENABLE_ML_PREVIEW: true,
  ENABLE_GAMIFICATION: true,
};

// ==========================================
// PLANOS
// ==========================================

export const PLANOS_COM_POD = ['FULL', 'FROTA', 'ENTERPRISE'];
export const PLANOS_COM_ML = ['PRO', 'FULL', 'FROTA', 'ENTERPRISE'];
export const PLANOS_COM_API = ['FULL', 'FROTA', 'ENTERPRISE'];

export default CONFIG;
