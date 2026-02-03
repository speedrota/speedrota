/**
 * @fileoverview Rotas de Pagamento com Mercado Pago
 * 
 * DESIGN POR CONTRATO:
 * @pre Usuário autenticado
 * @post Pagamento processado e plano atualizado
 */

import { FastifyInstance } from 'fastify';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { env, PRECOS_PLANOS, LIMITES_PLANOS } from '../config/env.js';
import { authenticate } from '../middlewares/auth.middleware.js';

// Configurar Mercado Pago
const mpClient = new MercadoPagoConfig({ 
  accessToken: env.MP_ACCESS_TOKEN,
});

const preferenceClient = new Preference(mpClient);
const paymentClient = new Payment(mpClient);

// ==========================================
// SCHEMAS
// ==========================================

const createPreferenceSchema = z.object({
  plano: z.enum(['PRO', 'FULL']),
});

// ==========================================
// ROTAS
// ==========================================

export async function mercadoPagoRoutes(app: FastifyInstance) {
  // ----------------------------------------
  // LISTAR PLANOS DISPONÍVEIS
  // ----------------------------------------
  
  app.get('/plans', async () => {
    return {
      success: true,
      data: [
        {
          id: 'FREE',
          nome: 'Gratuito',
          preco: 0,
          precoFormatado: 'Grátis',
          recursos: [
            '5 rotas por mês',
            'Até 10 paradas por rota',
            '1 fornecedor',
            'OCR de notas fiscais',
            'Otimização básica',
          ],
          limites: LIMITES_PLANOS.FREE,
          popular: false,
        },
        {
          id: 'PRO',
          nome: 'Pro',
          preco: PRECOS_PLANOS.PRO / 100,
          precoFormatado: `R$ ${(PRECOS_PLANOS.PRO / 100).toFixed(2).replace('.', ',')}`,
          recursos: [
            'Rotas ilimitadas',
            'Até 30 paradas por rota',
            '3 fornecedores',
            'Upload de PDF',
            'Histórico de 30 dias',
            'Suporte prioritário',
          ],
          limites: LIMITES_PLANOS.PRO,
          popular: true,
        },
        {
          id: 'FULL',
          nome: 'Full',
          preco: PRECOS_PLANOS.FULL / 100,
          precoFormatado: `R$ ${(PRECOS_PLANOS.FULL / 100).toFixed(2).replace('.', ',')}`,
          recursos: [
            'Tudo do Pro',
            'Até 100 paradas por rota',
            'Fornecedores ilimitados',
            'Histórico de 1 ano',
            'Acesso à API',
            'Relatórios avançados',
          ],
          limites: LIMITES_PLANOS.FULL,
          popular: false,
        },
      ],
    };
  });

  // ----------------------------------------
  // CRIAR PREFERÊNCIA DE PAGAMENTO
  // ----------------------------------------
  
  app.post('/create-preference', { 
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { plano } = createPreferenceSchema.parse(request.body);
    const userId = request.user.userId;
    
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
    
    // Verificar se já tem o plano
    if (user.plano === plano) {
      return reply.status(400).send({
        success: false,
        error: 'Você já possui este plano',
      });
    }
    
    const preco = PRECOS_PLANOS[plano] / 100;
    const nomeDoPlano = plano === 'PRO' ? 'SpeedRota Pro' : 'SpeedRota Full';
    
    try {
      // URLs de callback - em dev usamos localhost, MP não redireciona automaticamente
      const baseUrl = env.FRONTEND_URL || 'http://localhost:3000';
      const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
      
      // Criar preferência no Mercado Pago
      const preferenceBody: any = {
        items: [
          {
            id: `speedrota-${plano.toLowerCase()}`,
            title: nomeDoPlano,
            description: `Assinatura mensal do plano ${nomeDoPlano}`,
            quantity: 1,
            currency_id: 'BRL',
            unit_price: preco,
          },
        ],
        payer: {
          email: user.email,
          name: user.nome,
        },
        // Habilitar todos os métodos de pagamento incluindo PIX
        payment_methods: {
          excluded_payment_methods: [],
          excluded_payment_types: [],
          installments: 12, // Até 12x no cartão
          default_installments: 1,
        },
        external_reference: JSON.stringify({
          userId: user.id,
          plano,
          email: user.email,
        }),
        statement_descriptor: 'SPEEDROTA',
      };
      
      // Só adicionar back_urls e auto_return se não for localhost
      // MP requer URLs públicas válidas para auto_return
      if (!isLocalhost) {
        preferenceBody.back_urls = {
          success: `${baseUrl}/pagamento/sucesso?plano=${plano}`,
          failure: `${baseUrl}/pagamento/erro`,
          pending: `${baseUrl}/pagamento/pendente`,
        };
        preferenceBody.auto_return = 'approved';
        preferenceBody.notification_url = `${baseUrl}/api/mercadopago/webhook`;
      }
      
      const preference = await preferenceClient.create({ body: preferenceBody });
      
      // Registrar tentativa de pagamento
      await prisma.pagamento.create({
        data: {
          userId: user.id,
          plano,
          valorCentavos: PRECOS_PLANOS[plano],
          moeda: 'BRL',
          status: 'PENDENTE',
          mpPreferenceId: preference.id,
        },
      });
      
      return {
        success: true,
        data: {
          preferenceId: preference.id,
          initPoint: preference.init_point,
          sandboxInitPoint: preference.sandbox_init_point,
        },
      };
    } catch (error: any) {
      console.error('Erro ao criar preferência:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erro ao iniciar pagamento',
        details: error.message,
      });
    }
  });

  // ----------------------------------------
  // WEBHOOK DO MERCADO PAGO
  // ----------------------------------------
  
  app.post('/webhook', async (request, reply) => {
    const { type, data } = request.body as any;
    
    console.log('📩 Webhook Mercado Pago:', { type, data });
    
    if (type === 'payment') {
      try {
        // Buscar detalhes do pagamento
        const payment = await paymentClient.get({ id: data.id });
        
        console.log('💰 Pagamento recebido:', {
          id: payment.id,
          status: payment.status,
          external_reference: payment.external_reference,
        });
        
        if (payment.status === 'approved' && payment.external_reference) {
          const ref = JSON.parse(payment.external_reference);
          const { userId, plano } = ref;
          
          // Atualizar plano do usuário
          await prisma.user.update({
            where: { id: userId },
            data: {
              plano,
              mpCustomerId: payment.payer?.id?.toString(),
              planoExpiraEm: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 dias
            },
          });
          
          // Atualizar registro de pagamento
          await prisma.pagamento.updateMany({
            where: {
              userId,
              status: 'PENDENTE',
              plano,
            },
            data: {
              status: 'PAGO',
              mpPaymentId: payment.id?.toString(),
              pagoEm: new Date(),
            },
          });
          
          console.log(`✅ Plano atualizado: ${userId} -> ${plano}`);
        }
      } catch (error) {
        console.error('❌ Erro no webhook:', error);
      }
    }
    
    // Sempre retornar 200 para o MP
    return reply.status(200).send({ received: true });
  });

  // ----------------------------------------
  // VERIFICAR STATUS DO PAGAMENTO
  // ----------------------------------------
  
  app.get('/payment-status/:paymentId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { paymentId } = request.params as { paymentId: string };
    
    try {
      const payment = await paymentClient.get({ id: paymentId });
      
      return {
        success: true,
        data: {
          id: payment.id,
          status: payment.status,
          statusDetail: payment.status_detail,
          approved: payment.status === 'approved',
        },
      };
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: 'Pagamento não encontrado',
      });
    }
  });

  // ----------------------------------------
  // CONFIRMAR UPGRADE (após retorno do MP)
  // ----------------------------------------
  
  app.post('/confirm-upgrade', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { plano, paymentId } = request.body as { plano: string; paymentId?: string };
    const userId = request.user.userId;
    
    try {
      // Verificar se existe pagamento aprovado recente
      const pagamento = await prisma.pagamento.findFirst({
        where: {
          userId,
          plano: plano as any,
          status: 'PAGO',
          pagoEm: {
            gte: new Date(Date.now() - 60 * 60 * 1000), // Última hora
          },
        },
        orderBy: { pagoEm: 'desc' },
      });
      
      if (pagamento) {
        // Atualizar plano do usuário se ainda não foi atualizado
        const user = await prisma.user.update({
          where: { id: userId },
          data: {
            plano: plano as any,
            planoExpiraEm: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
        
        return {
          success: true,
          data: {
            plano: user.plano,
            mensagem: `Parabéns! Seu plano foi atualizado para ${plano}!`,
          },
        };
      }
      
      // Se não encontrou pagamento, verificar diretamente no MP
      if (paymentId) {
        const payment = await paymentClient.get({ id: paymentId });
        
        if (payment.status === 'approved') {
          const user = await prisma.user.update({
            where: { id: userId },
            data: {
              plano: plano as any,
              planoExpiraEm: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });
          
          // Registrar pagamento
          await prisma.pagamento.create({
            data: {
              userId,
              plano: plano as any,
              valorCentavos: PRECOS_PLANOS[plano as keyof typeof PRECOS_PLANOS] || 0,
              moeda: 'BRL',
              status: 'PAGO',
              mpPaymentId: paymentId,
              pagoEm: new Date(),
            },
          });
          
          return {
            success: true,
            data: {
              plano: user.plano,
              mensagem: `Parabéns! Seu plano foi atualizado para ${plano}!`,
            },
          };
        }
      }
      
      return reply.status(400).send({
        success: false,
        error: 'Pagamento não confirmado. Tente novamente em alguns minutos.',
      });
    } catch (error: any) {
      console.error('Erro ao confirmar upgrade:', error);
      return reply.status(500).send({
        success: false,
        error: 'Erro ao confirmar upgrade',
      });
    }
  });

  // ----------------------------------------
  // OBTER ASSINATURA ATUAL
  // ----------------------------------------
  
  app.get('/subscription', {
    preHandler: [authenticate],
  }, async (request) => {
    const userId = request.user.userId;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        plano: true,
        planoExpiraEm: true,
        rotasNoMes: true,
      },
    });
    
    const limites = LIMITES_PLANOS[user?.plano || 'FREE'];
    
    return {
      success: true,
      data: {
        plano: user?.plano || 'FREE',
        expiraEm: user?.planoExpiraEm,
        ativo: !user?.planoExpiraEm || user.planoExpiraEm > new Date(),
        rotasNoMes: user?.rotasNoMes || 0,
        limites,
      },
    };
  });

  // ----------------------------------------
  // PUBLIC KEY (para frontend)
  // ----------------------------------------
  
  app.get('/public-key', async () => {
    return {
      success: true,
      data: {
        publicKey: env.MP_PUBLIC_KEY,
      },
    };
  });
}

export default mercadoPagoRoutes;
