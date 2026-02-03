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
import { prisma } from '../lib/prisma.js';

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
   * Solicitar recuperação de senha (placeholder)
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
    
    // TODO: Implementar envio de email
    // Por enquanto, apenas retorna sucesso (não revela se email existe)
    
    return {
      success: true,
      message: 'Se o email existir, você receberá instruções para recuperar a senha',
    };
  });
}
