/**
 * @fileoverview Servidor principal Fastify
 * 
 * DESIGN POR CONTRATO:
 * @pre Variáveis de ambiente configuradas
 * @pre Banco de dados configurado
 * @post API REST disponível em http://localhost:3001
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { env } from './config/env.js';
import { authRoutes } from './routes/auth.routes.js';
import { userRoutes } from './routes/user.routes.js';
import { rotaRoutes } from './routes/rota.routes.js';
import { podRoutes } from './routes/pod.routes.js';
import { mercadoPagoRoutes } from './routes/mercadopago.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import { analyticsRoutes } from './routes/analytics.routes.js';
import { trafegoRoutes } from './routes/trafego.routes.js';
import reotimizacaoRoutes from './routes/reotimizacao.routes.js';

// ==========================================
// CRIAR SERVIDOR FASTIFY
// ==========================================

const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'development' ? 'info' : 'warn',
    transport: env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      }
    } : undefined,
  },
});

// ==========================================
// PLUGINS
// ==========================================

// CORS
await app.register(cors, {
  origin: [env.FRONTEND_URL, 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

// JWT
await app.register(jwt, {
  secret: env.JWT_SECRET,
  sign: {
    expiresIn: env.JWT_EXPIRES_IN,
  },
});

// Rate Limiting
await app.register(rateLimit, {
  max: env.RATE_LIMIT_MAX,
  timeWindow: env.RATE_LIMIT_WINDOW_MS,
});

// Swagger Documentation
await app.register(swagger, {
  openapi: {
    info: {
      title: 'SpeedRota API',
      description: 'API REST para otimização de rotas de entrega',
      version: '1.0.0',
    },
    servers: [
      { url: `http://localhost:${env.PORT}`, description: 'Development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
});

await app.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
  },
});

// ==========================================
// DECORATORS (para tipagem do JWT)
// ==========================================

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      userId: string;
      email: string;
      plano: string;
    };
    user: {
      userId: string;
      email: string;
      plano: string;
    };
  }
}

// ==========================================
// HOOKS GLOBAIS
// ==========================================

// Log de requisições
app.addHook('onRequest', async (request) => {
  request.log.info({ 
    method: request.method, 
    url: request.url,
    ip: request.ip,
  }, 'Requisição recebida');
});

// ==========================================
// ROTAS
// ==========================================

// Health check na raiz (para Render/monitoramento)
app.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: '1.0.0',
}));

// Rota raiz
app.get('/', async () => ({
  name: 'SpeedRota API',
  version: '1.0.0',
  docs: '/docs',
  health: '/health',
}));

// Rota /api/v1 (info)
app.get('/api/v1', async () => ({
  name: 'SpeedRota API',
  version: '1.0.0',
  status: 'online',
  endpoints: {
    auth: '/api/v1/auth',
    users: '/api/v1/users',
    rotas: '/api/v1/rotas',
    pagamentos: '/api/v1/pagamentos',
    analytics: '/api/v1/analytics',
    trafego: '/api/v1/trafego',
  },
}));

// Prefixo /api/v1
app.register(healthRoutes, { prefix: '/api/v1' });
app.register(authRoutes, { prefix: '/api/v1/auth' });
app.register(userRoutes, { prefix: '/api/v1/users' });
app.register(rotaRoutes, { prefix: '/api/v1/rotas' });
app.register(podRoutes, { prefix: '/api/v1/pod' });
app.register(mercadoPagoRoutes, { prefix: '/api/v1/pagamentos' });
app.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
app.register(trafegoRoutes, { prefix: '/api/v1/trafego' });
app.register(reotimizacaoRoutes, { prefix: '/api/v1/reotimizar' });

// ==========================================
// ERROR HANDLER GLOBAL
// ==========================================

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  
  // Erro de validação Zod
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      error: 'Dados inválidos',
      details: error.validation,
    });
  }
  
  // Erro JWT
  if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
    return reply.status(401).send({
      success: false,
      error: 'Token não fornecido',
    });
  }
  
  if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
    return reply.status(401).send({
      success: false,
      error: 'Token inválido',
    });
  }
  
  // Erro genérico
  const statusCode = error.statusCode || 500;
  return reply.status(statusCode).send({
    success: false,
    error: env.NODE_ENV === 'production' 
      ? 'Erro interno do servidor' 
      : error.message,
  });
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================

const start = async () => {
  try {
    await app.listen({ 
      port: env.PORT, 
      host: env.HOST,
    });
    
    console.log(`
╔════════════════════════════════════════════╗
║                                            ║
║   🚀 SpeedRota API v1.0.0                  ║
║                                            ║
║   Server: http://localhost:${env.PORT}           ║
║   Docs:   http://localhost:${env.PORT}/docs      ║
║   Env:    ${env.NODE_ENV.padEnd(28)}║
║                                            ║
╚════════════════════════════════════════════╝
    `);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

export { app };
