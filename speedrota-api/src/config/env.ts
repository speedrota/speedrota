/**
 * @fileoverview Configuração centralizada da API
 * 
 * DESIGN POR CONTRATO:
 * @pre Variáveis de ambiente definidas em .env
 * @post Objeto config tipado e validado
 * @invariant Valores sensíveis não expostos em logs
 */

import { z } from 'zod';
import 'dotenv/config';

// Schema de validação das variáveis de ambiente
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  
  // Database
  DATABASE_URL: z.string(),
  
  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  
  // Mercado Pago
  MP_PUBLIC_KEY: z.string(),
  MP_ACCESS_TOKEN: z.string(),
  
  // CORS
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  
  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  
  // SMTP (Zoho Mail) - Mantido para compatibilidade
  SMTP_HOST: z.string().optional().default('smtp.zoho.com'),
  SMTP_PORT: z.coerce.number().optional().default(465),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  
  // Resend (Email API - alternativa)
  RESEND_API_KEY: z.string().optional().default(''),
  
  // ZeptoMail (Zoho - recomendado)
  ZEPTOMAIL_TOKEN: z.string().optional().default(''),
  
  // Web Push (VAPID keys)
  VAPID_PUBLIC_KEY: z.string().optional().default(''),
  VAPID_PRIVATE_KEY: z.string().optional().default(''),
});

// Parse e valida
const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Variáveis de ambiente inválidas:');
  console.error(_env.error.format());
  process.exit(1);
}

export const env = _env.data;

// ==========================================
// CONSTANTES DO SISTEMA (mesmas do frontend)
// ==========================================

export const CONSTANTES = {
  VELOCIDADE_URBANA_KMH: 30,
  CONSUMO_MEDIO_KML: 10,
  PRECO_COMBUSTIVEL: 5.89,
  TEMPO_POR_ENTREGA_MIN: 5,
  FATOR_CORRECAO_URBANA: 1.4,
} as const;

export const FATORES_TRAFEGO = {
  PICO_MANHA: 1.5,   // 07h-09h
  PICO_TARDE: 1.6,   // 17h-19h
  ALMOCO: 1.2,       // 11h-14h
  MADRUGADA: 0.8,    // 22h-05h
  NORMAL: 1.0,
} as const;

// ==========================================
// LIMITES DOS PLANOS
// ==========================================

export const LIMITES_PLANOS = {
  FREE: {
    rotasPorMes: 5,
    paradasPorRota: 10,
    fornecedores: 1,
    historicosDias: 0,
    pdfUpload: false,
    apiAccess: false,
  },
  PRO: {
    rotasPorMes: Infinity,
    paradasPorRota: 30,
    fornecedores: 3,
    historicosDias: 30,
    pdfUpload: true,
    apiAccess: false,
  },
  FULL: {
    rotasPorMes: Infinity,
    paradasPorRota: 100,
    fornecedores: Infinity,
    historicosDias: 365,
    pdfUpload: true,
    apiAccess: true,
  },
  ENTERPRISE: {
    rotasPorMes: Infinity,
    paradasPorRota: Infinity,
    fornecedores: Infinity,
    historicosDias: Infinity,
    pdfUpload: true,
    apiAccess: true,
  },
} as const;

// ==========================================
// PREÇOS DOS PLANOS (em centavos)
// ==========================================

export const PRECOS_PLANOS = {
  FREE: 0,
  PRO: 2990,      // R$ 29,90
  FULL: 5990,     // R$ 59,90
  ENTERPRISE: 0,  // Sob consulta
} as const;
