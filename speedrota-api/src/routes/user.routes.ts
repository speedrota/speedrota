/**
 * @fileoverview Rotas de Usuário
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { LIMITES_PLANOS } from '../config/env.js';

// ==========================================
// SCHEMAS
// ==========================================

const updateProfileSchema = z.object({
  nome: z.string().min(2).optional(),
  telefone: z.string().optional(),
});

const changePasswordSchema = z.object({
  senhaAtual: z.string().min(1),
  novaSenha: z.string().min(6),
});

// ==========================================
// ROTAS
// ==========================================

export async function userRoutes(app: FastifyInstance) {
  
  // Todas as rotas requerem autenticação
  app.addHook('onRequest', authenticate);

  /**
   * GET /users/profile
   * Perfil completo do usuário
   */
  app.get('/profile', async (request) => {
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
        _count: {
          select: {
            rotas: true,
          },
        },
      },
    });
    
    // Calcular limites do plano
    const limites = LIMITES_PLANOS[user!.plano as keyof typeof LIMITES_PLANOS];
    
    return {
      success: true,
      data: {
        ...user,
        limites: {
          ...limites,
          rotasRestantes: limites.rotasPorMes === Infinity 
            ? Infinity 
            : limites.rotasPorMes - user!.rotasNoMes,
        },
      },
    };
  });

  /**
   * PATCH /users/profile
   * Atualizar perfil
   */
  app.patch('/profile', async (request, reply) => {
    const { userId } = request.user;
    
    const body = updateProfileSchema.safeParse(request.body);
    
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: 'Dados inválidos',
        details: body.error.flatten().fieldErrors,
      });
    }
    
    const user = await prisma.user.update({
      where: { id: userId },
      data: body.data,
      select: {
        id: true,
        email: true,
        nome: true,
        telefone: true,
        plano: true,
      },
    });
    
    return {
      success: true,
      data: user,
    };
  });

  /**
   * POST /users/change-password
   * Alterar senha
   */
  app.post('/change-password', async (request, reply) => {
    const { userId } = request.user;
    
    const body = changePasswordSchema.safeParse(request.body);
    
    if (!body.success) {
      return reply.status(400).send({
        success: false,
        error: 'Dados inválidos',
        details: body.error.flatten().fieldErrors,
      });
    }
    
    const { senhaAtual, novaSenha } = body.data;
    
    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      return reply.status(404).send({
        success: false,
        error: 'Usuário não encontrado',
      });
    }
    
    // Verificar senha atual
    const senhaCorreta = await bcrypt.compare(senhaAtual, user.passwordHash);
    
    if (!senhaCorreta) {
      return reply.status(401).send({
        success: false,
        error: 'Senha atual incorreta',
      });
    }
    
    // Atualizar senha
    const newPasswordHash = await bcrypt.hash(novaSenha, 10);
    
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });
    
    return {
      success: true,
      message: 'Senha alterada com sucesso',
    };
  });

  /**
   * DELETE /users/account
   * Deletar conta (soft delete)
   */
  app.delete('/account', async (request) => {
    const { userId } = request.user;
    
    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });
    
    return {
      success: true,
      message: 'Conta deletada com sucesso',
    };
  });

  /**
   * GET /users/stats
   * Estatísticas do usuário
   */
  app.get('/stats', async (request) => {
    const { userId } = request.user;
    
    // Buscar estatísticas agregadas
    const [totalRotas, rotasEsteMes, totalParadas] = await Promise.all([
      prisma.rota.count({
        where: { userId },
      }),
      prisma.rota.count({
        where: {
          userId,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      prisma.parada.count({
        where: {
          rota: { userId },
        },
      }),
    ]);
    
    // Métricas agregadas das rotas finalizadas
    const metricas = await prisma.rota.aggregate({
      where: {
        userId,
        status: 'FINALIZADA',
      },
      _sum: {
        distanciaTotalKm: true,
        tempoViagemMin: true,
        custoR: true,
      },
      _avg: {
        distanciaTotalKm: true,
        tempoViagemMin: true,
      },
    });
    
    return {
      success: true,
      data: {
        totalRotas,
        rotasEsteMes,
        totalParadas,
        totais: {
          kmRodados: metricas._sum.distanciaTotalKm || 0,
          minutosViagem: metricas._sum.tempoViagemMin || 0,
          custoTotal: metricas._sum.custoR || 0,
        },
        medias: {
          kmPorRota: metricas._avg.distanciaTotalKm || 0,
          minutosPorRota: metricas._avg.tempoViagemMin || 0,
        },
      },
    };
  });
}
