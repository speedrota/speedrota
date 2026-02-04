/**
 * @fileoverview Serviço de Email usando ZeptoMail API (Zoho)
 * 
 * DESIGN POR CONTRATO:
 * @pre ZEPTOMAIL_TOKEN configurado no ambiente
 * @post Email enviado com sucesso via API HTTP
 * @throws Erro se API falhar
 * 
 * NOTA: Render bloqueia portas SMTP. ZeptoMail usa API HTTP.
 */

import { env } from '../config/env.js';

// ==========================================
// CONFIGURAÇÃO ZEPTOMAIL
// ==========================================

const ZEPTOMAIL_API_URL = 'https://api.zeptomail.com/v1.1/email';
const FROM_EMAIL = 'noreply@speedrota.com.br';
const FROM_NAME = 'SpeedRota';
const BOUNCE_ADDRESS = 'bounce-zem@speedrota.com.br';

// ==========================================
// TEMPLATES DE EMAIL
// ==========================================

function getPasswordResetTemplate(code: string, nome: string) {
  return {
    subject: '🔐 SpeedRota - Código de Recuperação de Senha',
    htmlbody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperação de Senha</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1e293b; border-radius: 16px; overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🚀 SpeedRota</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Otimização de Rotas</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #f1f5f9; margin: 0 0 20px 0; font-size: 22px;">Olá, ${nome}!</h2>
              <p style="color: #94a3b8; margin: 0 0 30px 0; font-size: 16px; line-height: 1.6;">
                Você solicitou a recuperação de senha da sua conta SpeedRota. 
                Use o código abaixo para redefinir sua senha:
              </p>
              <div style="background-color: #0f172a; border-radius: 12px; padding: 25px; text-align: center; margin-bottom: 30px;">
                <p style="color: #64748b; margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Seu código de recuperação</p>
                <p style="color: #3b82f6; margin: 0; font-size: 42px; font-weight: bold; letter-spacing: 8px; font-family: monospace;">${code}</p>
              </div>
              <p style="color: #64748b; margin: 0 0 20px 0; font-size: 14px;">
                ⏱️ Este código expira em <strong style="color: #f1f5f9;">15 minutos</strong>.
              </p>
              <p style="color: #64748b; margin: 0; font-size: 14px;">
                Se você não solicitou esta recuperação, pode ignorar este email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #0f172a; padding: 20px 30px; text-align: center; border-top: 1px solid #334155;">
              <p style="color: #64748b; margin: 0; font-size: 12px;">
                © 2025 SpeedRota. Todos os direitos reservados.<br>
                <a href="https://speedrota.com.br" style="color: #3b82f6; text-decoration: none;">speedrota.com.br</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
    textbody: `SpeedRota - Recuperação de Senha\n\nOlá, ${nome}!\n\nSeu código de recuperação: ${code}\n\nEste código expira em 15 minutos.\n\n---\nSpeedRota - https://speedrota.com.br`,
  };
}

function getWelcomeTemplate(nome: string) {
  return {
    subject: '🎉 Bem-vindo ao SpeedRota!',
    htmlbody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1e293b; border-radius: 16px; overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🚀 SpeedRota</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #f1f5f9; margin: 0 0 20px 0;">Bem-vindo, ${nome}! 🎉</h2>
              <p style="color: #94a3b8; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
                Sua conta SpeedRota foi criada com sucesso! Agora você pode otimizar suas rotas de entrega e economizar tempo e combustível.
              </p>
              <p style="color: #94a3b8; margin: 0; font-size: 16px;">
                <strong style="color: #f1f5f9;">Plano atual:</strong> Gratuito (5 rotas/mês)
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #0f172a; padding: 20px 30px; text-align: center;">
              <p style="color: #64748b; margin: 0; font-size: 12px;">
                © 2025 SpeedRota | <a href="https://speedrota.com.br" style="color: #3b82f6;">speedrota.com.br</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
    textbody: `Bem-vindo ao SpeedRota, ${nome}! Sua conta foi criada com sucesso.`,
  };
}

// ==========================================
// FUNÇÃO DE ENVIO VIA ZEPTOMAIL API
// ==========================================

async function sendZeptoEmail(
  toEmail: string,
  toName: string,
  subject: string,
  htmlbody: string,
  textbody: string
): Promise<boolean> {
  let token = env.ZEPTOMAIL_TOKEN;
  
  if (!token) {
    console.warn('⚠️ ZEPTOMAIL_TOKEN não configurado');
    return false;
  }
  
  // Garantir formato correto do token (remover espaços extras)
  token = token.trim();
  
  // Log para debug (primeiros 20 chars)
  console.log(`📧 ZeptoMail token (início): ${token.substring(0, 30)}...`);
  
  const payload = {
    bounce_address: BOUNCE_ADDRESS,
    from: {
      address: FROM_EMAIL,
      name: FROM_NAME,
    },
    to: [
      {
        email_address: {
          address: toEmail,
          name: toName,
        },
      },
    ],
    subject,
    htmlbody,
    textbody,
  };
  
  console.log(`📧 Enviando para: ${toEmail}, From: ${FROM_EMAIL}`);
  
  try {
    const response = await fetch(ZEPTOMAIL_API_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': token,
      },
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`❌ ZeptoMail erro (${response.status}):`, data);
      return false;
    }
    
    console.log(`✅ Email enviado via ZeptoMail para ${toEmail}:`, data);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao enviar email via ZeptoMail:`, error);
    return false;
  }
}

// ==========================================
// FUNÇÕES EXPORTADAS
// ==========================================

/**
 * Envia email de recuperação de senha
 */
export async function enviarEmailRecuperacao(
  email: string,
  nome: string,
  codigo: string
): Promise<boolean> {
  if (!env.ZEPTOMAIL_TOKEN) {
    console.log(`📧 [DEV] Código de recuperação para ${email}: ${codigo}`);
    return false;
  }
  
  const template = getPasswordResetTemplate(codigo, nome);
  return sendZeptoEmail(email, nome, template.subject, template.htmlbody, template.textbody);
}

/**
 * Envia email de boas-vindas
 */
export async function enviarEmailBoasVindas(
  email: string,
  nome: string
): Promise<boolean> {
  if (!env.ZEPTOMAIL_TOKEN) {
    console.log(`📧 [DEV] Email de boas-vindas para ${email}`);
    return false;
  }
  
  const template = getWelcomeTemplate(nome);
  return sendZeptoEmail(email, nome, template.subject, template.htmlbody, template.textbody);
}

/**
 * Verifica se o serviço está configurado
 */
export function emailConfigurado(): boolean {
  return !!env.ZEPTOMAIL_TOKEN;
}
