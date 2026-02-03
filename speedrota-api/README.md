# SpeedRota API

> Backend REST API para o SpeedRota - Otimizador de Rotas para Entregadores

## 🚀 Quick Start

### 1. Pré-requisitos

- Node.js 20+
- Docker e Docker Compose
- npm ou yarn

### 2. Configuração

```bash
# Instalar dependências
npm install

# Copiar variáveis de ambiente
cp .env.example .env

# Subir banco de dados (PostgreSQL)
docker-compose up -d

# Rodar migrations
npm run db:migrate

# Rodar seed (dados de teste)
npm run db:seed

# Iniciar servidor de desenvolvimento
npm run dev
```

### 3. Acessos

- **API:** http://localhost:3001
- **Documentação Swagger:** http://localhost:3001/docs
- **pgAdmin:** http://localhost:5050 (admin@speedrota.com / admin123)

## 📚 Endpoints

### Auth
- `POST /api/v1/auth/register` - Criar conta
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Renovar token
- `GET /api/v1/auth/me` - Dados do usuário logado

### Users
- `GET /api/v1/users/profile` - Perfil completo
- `PATCH /api/v1/users/profile` - Atualizar perfil
- `POST /api/v1/users/change-password` - Alterar senha
- `GET /api/v1/users/stats` - Estatísticas
- `DELETE /api/v1/users/account` - Deletar conta

### Rotas
- `GET /api/v1/rotas` - Listar rotas
- `GET /api/v1/rotas/:id` - Detalhes da rota
- `POST /api/v1/rotas` - Criar rota
- `POST /api/v1/rotas/:id/paradas` - Adicionar parada
- `POST /api/v1/rotas/:id/paradas/batch` - Adicionar múltiplas paradas
- `POST /api/v1/rotas/:id/calcular` - Calcular rota otimizada
- `PATCH /api/v1/rotas/:id/status` - Atualizar status
- `DELETE /api/v1/rotas/:id` - Deletar rota
- `DELETE /api/v1/rotas/:id/paradas/:paradaId` - Remover parada

### Stripe (Pagamentos)
- `GET /api/v1/stripe/plans` - Listar planos
- `POST /api/v1/stripe/create-checkout-session` - Criar checkout
- `POST /api/v1/stripe/create-portal-session` - Portal de billing
- `GET /api/v1/stripe/subscription` - Status da assinatura
- `POST /api/v1/stripe/webhook` - Webhook do Stripe

### Health
- `GET /api/v1/health` - Health check
- `GET /api/v1/health/db` - Health check com banco

## 🔐 Autenticação

Todas as rotas (exceto auth e webhook) requerem JWT Bearer token:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/v1/users/profile
```

## 👥 Usuários de Teste

| Email | Senha | Plano |
|-------|-------|-------|
| free@speedrota.com | 123456 | FREE |
| pro@speedrota.com | 123456 | PRO |
| full@speedrota.com | 123456 | FULL |

## 🛠️ Scripts

```bash
npm run dev        # Desenvolvimento com hot reload
npm run build      # Build para produção
npm run start      # Iniciar produção
npm run test       # Rodar testes
npm run db:migrate # Rodar migrations
npm run db:generate # Gerar Prisma Client
npm run db:studio  # Abrir Prisma Studio
npm run db:seed    # Popular banco com dados de teste
```

## 📁 Estrutura

```
speedrota-api/
├── prisma/
│   ├── schema.prisma    # Schema do banco
│   └── seed.ts          # Dados de teste
├── src/
│   ├── config/          # Configurações
│   ├── lib/             # Bibliotecas (Prisma)
│   ├── middlewares/     # Middlewares (auth)
│   ├── routes/          # Rotas da API
│   └── server.ts        # Servidor principal
├── docker-compose.yml   # PostgreSQL + pgAdmin
├── package.json
└── tsconfig.json
```

## 💰 Planos

| Plano | Preço | Rotas/mês | Paradas | Fornecedores |
|-------|-------|-----------|---------|--------------|
| FREE | R$ 0 | 5 | 10 | 1 |
| PRO | R$ 29,90 | ∞ | 30 | 3 |
| FULL | R$ 59,90 | ∞ | 100 | ∞ |
| ENTERPRISE | Consulte | ∞ | ∞ | ∞ |
