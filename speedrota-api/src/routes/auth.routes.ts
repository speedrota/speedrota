/**
 * @fileoverview Rotas de Autenticação
 * 
 * DESIGN POR CONTRATO:
 * @pre Body com email e senha válidos
 * @post JWT token retornado
 * @throws 400 se dados inválidos
 * @throws 401 se credenciais incorretas
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { enviarEmailRecuperacao, enviarEmailBoasVindas } from '../services/email.js';

// ==========================================
// SCHEMAS DE VALIDAÇÃO
// ==========================================

const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  telefone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(1, 'Senha é obrigatória'),
});

// ==========================================
// ROTAS
// ==========================================

export async function authRoutes(app: FastifyInstance) {
  
  /**
   * POST /auth/register
   * Criar nova conta
   */
  app.post('/register', async (request, reply) => {
    const body = registerSchema.safeParse(request.body);
    
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: 'Dados inválidos',
        details: body.error.flatten().fieldErrors,
      });
    }
    
    const { email, senha, nome, telefone } = body.data;
    
    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    
    if (existingUser) {
      return reply.status(409).send({
        success: false,
        error: 'Email já cadastrado',
      });
    }
    
    // Hash da senha
    const passwordHash = await bcrypt.hash(senha, 10);
    
    // Criar usuário
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        nome,
        telefone,
        plano: 'FREE',
        mesAtual: new Date().getMonth() + 1,
      },
      select: {
        id: true,
        email: true,
        nome: true,
        plano: true,
        createdAt: true,
      },
    });
    
    // Gerar token
    const token = app.jwt.sign({
      userId: user.id,
      email: user.email,
      plano: user.plano,
    });
    
    return reply.status(201).send({
      success: true,
      data: {
        user,
        token,
      },
    });
  });

  /**
   * POST /auth/login
   * Fazer login
   */
  app.post('/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: 'Dados inválidos',
        details: body.error.flatten().fieldErrors,
      });
    }
    
    const { email, senha } = body.data;
    
    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email, deletedAt: null },
    });
    
    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'Email ou senha incorretos',
      });
    }
    
    // Verificar senha
    const senhaCorreta = await bcrypt.compare(senha, user.passwordHash);
    
    if (!senhaCorreta) {
      return reply.status(401).send({
        success: false,
        error: 'Email ou senha incorretos',
      });
    }
    
    // Gerar token
    const token = app.jwt.sign({
      userId: user.id,
      email: user.email,
      plano: user.plano,
    });
    
    // Atualizar mês se necessário (para resetar contador de rotas)
    const mesAtual = new Date().getMonth() + 1;
    if (user.mesAtual !== mesAtual) {
      await prisma.user.update({
        where: { id: user.id },
        data: { mesAtual, rotasNoMes: 0 },
      });
    }
    
    return {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          nome: user.nome,
          plano: user.plano,
          rotasNoMes: mesAtual !== user.mesAtual ? 0 : user.rotasNoMes,
        },
        token,
      },
    };
  });

  /**
   * POST /auth/refresh
   * Renovar token
   */
  app.post('/refresh', {
    onRequest: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.send(err);
      }
    }],
  }, async (request) => {
    const { userId, email, plano } = request.user;
    
    const newToken = app.jwt.sign({
      userId,
      email,
      plano,
    });
    
    return {
      success: true,
      data: { token: newToken },
    };
  });

  /**
   * GET /auth/me
   * Dados do usuário logado
   */
  app.get('/me', {
    onRequest: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.send(err);
      }
    }],
  }, async (request, reply) => {
    const { userId } = request.user;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nome: true,
        telefone: true,
        plano: true,
        rotasNoMes: true,
        planoExpiraEm: true,
        createdAt: true,
      },
    });
    
    if (!user) {
      return reply.status(404).send({
        success: false,
        error: 'Usuário não encontrado',
      });
    }
    
    return {
      success: true,
      data: user,
    };
  });

  /**
   * POST /auth/forgot-password
   * Solicitar recuperação de senha
   * Gera um token e retorna (em produção enviaria por email)
   */
  app.post('/forgot-password', async (request, reply) => {
    const schema = z.object({
      email: z.string().email(),
    });
    
    const body = schema.safeParse(request.body);
    
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: 'Email inválido',
      });
    }
    
    const { email } = body.data;
    
    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email, deletedAt: null },
    });
    
    // Sempre retorna sucesso para não revelar se email existe
    if (!user) {
      return {
        success: true,
        message: 'Se o email existir, você receberá um código de recuperação',
      };
    }
    
    // Invalidar tokens anteriores
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    
    // Gerar código de 6 dígitos
    const resetCode = crypto.randomInt(100000, 999999).toString();
    
    // Token expira em 15 minutos
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    
    // Salvar token
    await prisma.passwordResetToken.create({
      data: {
        token: resetCode,
        userId: user.id,
        email: user.email,
        expiresAt,
      },
    });
    
    console.log(`📧 Código de recuperação para ${email}: ${resetCode}`);
    
    // Enviar email com código de recuperação
    const emailEnviado = await enviarEmailRecuperacao(
      user.email,
      user.nome,
      resetCode
    );
    
    if (!emailEnviado) {
      console.warn(`⚠️ Falha ao enviar email para ${email}, mas código foi gerado`);
    }
    
    return {
      success: true,
      message: 'Se o email existir, você receberá um código de recuperação',
      // Em desenvolvimento, retorna o código diretamente
      ...(process.env.NODE_ENV !== 'production' && { resetCode }),
    };
  });

  /**
   * POST /auth/verify-reset-code
   * Verificar se o código de recuperação é válido
   */
  app.post('/verify-reset-code', async (request, reply) => {
    const schema = z.object({
      email: z.string().email(),
      code: z.string().length(6),
    });
    
    const body = schema.safeParse(request.body);
    
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: 'Dados inválidos',
      });
    }
    
    const { email, code } = body.data;
    
    // Buscar token válido
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        email,
        token: code,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    
    if (!resetToken) {
      return reply.status(400).send({
        success: false,
        error: 'Código inválido ou expirado',
      });
    }
    
    return {
      success: true,
      message: 'Código válido',
    };
  });

  /**
   * POST /auth/reset-password
   * Redefinir senha usando código de recuperação
   */
  app.post('/reset-password', async (request, reply) => {
    const schema = z.object({
      email: z.string().email(),
      code: z.string().length(6),
      novaSenha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
    });
    
    const body = schema.safeParse(request.body);
    
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: 'Dados inválidos',
        details: body.error.flatten().fieldErrors,
      });
    }
    
    const { email, code, novaSenha } = body.data;
    
    // Buscar token válido
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        email,
        token: code,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    
    if (!resetToken) {
      return reply.status(400).send({
        success: false,
        error: 'Código inválido ou expirado',
      });
    }
    
    // Hash da nova senha
    const passwordHash = await bcrypt.hash(novaSenha, 10);
    
    // Atualizar senha e marcar token como usado
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);
    
    console.log(`✅ Senha redefinida para ${email}`);
    
    return {
      success: true,
      message: 'Senha redefinida com sucesso! Faça login com a nova senha.',
    };
  });
}
