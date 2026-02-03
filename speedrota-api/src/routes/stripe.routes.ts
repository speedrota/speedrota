/**
 * @fileoverview Rotas de Pagamento (Stripe)
 * 
 * DESIGN POR CONTRATO:
 * @pre Usuário autenticado
 * @pre STRIPE_SECRET_KEY configurada
 * @post Checkout session criada ou webhook processado
 */

import { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { env, PRECOS_PLANOS } from '../config/env.js';

// Inicializar Stripe
const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

// ==========================================
// ROTAS
// ==========================================

export async function stripeRoutes(app: FastifyInstance) {

  /**
   * POST /stripe/create-checkout-session
   * Criar sessão de checkout para upgrade de plano
   */
  app.post('/create-checkout-session', {
    onRequest: [authenticate],
  }, async (request, reply) => {
    const { userId, email } = request.user;
    
    const { plano } = request.body as { plano: 'PRO' | 'FULL' };
    
    if (!plano || !['PRO', 'FULL'].includes(plano)) {
      return reply.status(400).send({
        success: false,
        error: 'Plano inválido. Escolha PRO ou FULL',
      });
    }
    
    // Buscar ou criar customer no Stripe
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    let customerId = user?.stripeCustomerId;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          userId,
        },
      });
      
      customerId = customer.id;
      
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }
    
    // Obter price ID do plano
    const priceId = plano === 'PRO' ? env.STRIPE_PRICE_PRO : env.STRIPE_PRICE_FULL;
    
    // Criar checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${env.FRONTEND_URL}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.FRONTEND_URL}/pagamento/cancelado`,
      metadata: {
        userId,
        plano,
      },
    });
    
    return {
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
      },
    };
  });

  /**
   * POST /stripe/create-portal-session
   * Criar sessão do portal de billing (gerenciar assinatura)
   */
  app.post('/create-portal-session', {
    onRequest: [authenticate],
  }, async (request, reply) => {
    const { userId } = request.user;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user?.stripeCustomerId) {
      return reply.status(400).send({
        success: false,
        error: 'Você não tem uma assinatura ativa',
      });
    }
    
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${env.FRONTEND_URL}/perfil`,
    });
    
    return {
      success: true,
      data: {
        url: session.url,
      },
    };
  });

  /**
   * GET /stripe/plans
   * Listar planos disponíveis
   */
  app.get('/plans', async () => {
    return {
      success: true,
      data: [
        {
          id: 'FREE',
          nome: 'Gratuito',
          preco: 0,
          precoFormatado: 'R$ 0',
          features: [
            '5 rotas por mês',
            '10 paradas por rota',
            '1 fornecedor',
            'OCR básico',
          ],
        },
        {
          id: 'PRO',
          nome: 'Profissional',
          preco: PRECOS_PLANOS.PRO,
          precoFormatado: 'R$ 29,90/mês',
          features: [
            'Rotas ilimitadas',
            '30 paradas por rota',
            '3 fornecedores',
            'OCR avançado',
            'Upload de PDF',
            'Histórico 30 dias',
          ],
          popular: true,
        },
        {
          id: 'FULL',
          nome: 'Completo',
          preco: PRECOS_PLANOS.FULL,
          precoFormatado: 'R$ 59,90/mês',
          features: [
            'Rotas ilimitadas',
            '100 paradas por rota',
            'Fornecedores ilimitados',
            'OCR + IA',
            'Upload de PDF',
            'Histórico 1 ano',
            'Acesso à API',
            '5 usuários',
          ],
        },
        {
          id: 'ENTERPRISE',
          nome: 'Empresarial',
          preco: null,
          precoFormatado: 'Sob consulta',
          features: [
            'Tudo do plano FULL',
            'Paradas ilimitadas',
            'Usuários ilimitados',
            'Suporte prioritário',
            'SLA garantido',
            'Integrações customizadas',
          ],
        },
      ],
    };
  });

  /**
   * POST /stripe/webhook
   * Webhook do Stripe (sem autenticação JWT)
   */
  app.post('/webhook', {
    config: {
      rawBody: true,
    },
  }, async (request, reply) => {
    const signature = request.headers['stripe-signature'] as string;
    
    if (!signature) {
      return reply.status(400).send({
        success: false,
        error: 'Assinatura não encontrada',
      });
    }
    
    let event: Stripe.Event;
    
    try {
      // @ts-ignore - rawBody é adicionado pelo plugin
      event = stripe.webhooks.constructEvent(
        request.rawBody as string,
        signature,
        env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return reply.status(400).send({
        success: false,
        error: 'Assinatura inválida',
      });
    }
    
    // Processar evento
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const plano = session.metadata?.plano as 'PRO' | 'FULL';
        
        if (userId && plano) {
          // Atualizar plano do usuário
          await prisma.user.update({
            where: { id: userId },
            data: {
              plano,
              stripeSubscriptionId: session.subscription as string,
              // Plano expira em 30 dias (renovação automática)
              planoExpiraEm: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });
          
          // Registrar pagamento
          await prisma.pagamento.create({
            data: {
              userId,
              plano,
              stripePaymentIntentId: session.payment_intent as string,
              valorCentavos: PRECOS_PLANOS[plano],
              status: 'PAGO',
              pagoEm: new Date(),
            },
          });
          
          console.log(`✅ Usuário ${userId} fez upgrade para ${plano}`);
        }
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        
        // Voltar para plano FREE
        await prisma.user.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            plano: 'FREE',
            stripeSubscriptionId: null,
            planoExpiraEm: null,
          },
        });
        
        console.log(`⚠️ Assinatura ${subscription.id} cancelada`);
        break;
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        
        console.error(`❌ Pagamento falhou para invoice ${invoice.id}`);
        // TODO: Enviar email para o usuário
        break;
      }
      
      default:
        console.log(`Evento não tratado: ${event.type}`);
    }
    
    return { received: true };
  });

  /**
   * GET /stripe/subscription
   * Status da assinatura atual
   */
  app.get('/subscription', {
    onRequest: [authenticate],
  }, async (request, reply) => {
    const { userId } = request.user;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        plano: true,
        stripeSubscriptionId: true,
        planoExpiraEm: true,
      },
    });
    
    if (!user) {
      return reply.status(404).send({
        success: false,
        error: 'Usuário não encontrado',
      });
    }
    
    let subscriptionDetails = null;
    
    if (user.stripeSubscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        subscriptionDetails = {
          status: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        };
      } catch (err) {
        console.error('Erro ao buscar assinatura:', err);
      }
    }
    
    return {
      success: true,
      data: {
        plano: user.plano,
        planoExpiraEm: user.planoExpiraEm,
        subscription: subscriptionDetails,
      },
    };
  });
}
