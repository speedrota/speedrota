# 🚀 SpeedRota - Guia de Deploy para Produção

## 📋 Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                        USUÁRIOS                              │
│                           ↓                                  │
│              speedrota.com.br (Cloudflare DNS)              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND                                │
│              Vercel (speedrota.com.br)                       │
│              React + Vite (Static Site)                      │
│              ✓ CDN Global                                    │
│              ✓ HTTPS automático                              │
│              ✓ Deploy automático via GitHub                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                       BACKEND                                │
│              Railway (api.speedrota.com.br)                  │
│              Node.js + Fastify                               │
│              ✓ Auto-scaling                                  │
│              ✓ Logs centralizados                            │
│              ✓ Deploy via GitHub                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      DATABASE                                │
│              Neon (PostgreSQL Serverless)                    │
│              ✓ Gratuito até 3GB                              │
│              ✓ Branching para dev/staging                    │
│              ✓ Auto-suspend (economia)                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Comparativo de Plataformas

### Frontend (Sites Estáticos)

| Plataforma | Preço | Pros | Contras |
|------------|-------|------|---------|
| **Vercel** ⭐ | Grátis (hobby) | Deploy instantâneo, CDN global, preview deploys | Limites em serverless |
| Netlify | Grátis (starter) | Boa integração, forms grátis | Menos recursos que Vercel |
| Cloudflare Pages | Grátis | CDN mais rápido, unlimited bandwidth | Menos features |

**Recomendação: Vercel** - Melhor integração com React/Vite, preview por PR

### Backend (Node.js API)

| Plataforma | Preço | Pros | Contras |
|------------|-------|------|---------|
| **Railway** ⭐ | $5/mês (starter) | Fácil, PostgreSQL incluso, auto-deploy | Preço sobe com uso |
| Render | $7/mês | Simples, bom uptime | Cold starts no free |
| Fly.io | $0-5/mês | Edge computing, rápido | Mais complexo |
| DigitalOcean App | $5/mês | Confiável, previsível | Menos automação |

**Recomendação: Railway** - Melhor custo-benefício, PostgreSQL integrado, fácil de usar

### Banco de Dados (PostgreSQL)

| Plataforma | Preço | Pros | Contras |
|------------|-------|------|---------|
| **Neon** ⭐ | Grátis (3GB) | Serverless, branching, auto-suspend | Limites de conexão |
| Supabase | Grátis (500MB) | Auth incluso, realtime | Mais complexo |
| Railway PostgreSQL | Incluso | Junto com API | Menos features |
| PlanetScale | Grátis (5GB) | MySQL, branching | Não é PostgreSQL |

**Recomendação: Neon** - PostgreSQL serverless grátis, perfeito para começar

---

## 🛒 PASSO 1: Comprar Domínio

### Opções de Registradores

| Registrador | Preço .com.br | Pros |
|-------------|---------------|------|
| **Registro.br** ⭐ | R$ 40/ano | Oficial Brasil, confiável |
| Hostinger | R$ 35/ano | Mais barato |
| GoDaddy | R$ 50/ano | Internacional |

### Ação: Registrar no Registro.br

1. Acesse: https://registro.br
2. Pesquise: `speedrota.com.br`
3. Se disponível, registre (R$ 40/ano)
4. Alternativas se ocupado:
   - `usespeedrota.com.br`
   - `appspeedrota.com.br`
   - `speedrota.app` (internacional)

### Configuração DNS (após compra)

```
# Apontar para Cloudflare (recomendado) ou direto para Vercel
Tipo: NS
Valor: Usar nameservers do Cloudflare
```

---

## ☁️ PASSO 2: Configurar Cloudflare (DNS + CDN + SSL)

### Por que Cloudflare?
- ✅ DNS gratuito e rápido
- ✅ SSL/HTTPS automático
- ✅ Proteção DDoS
- ✅ Cache e CDN
- ✅ Analytics

### Ação: Criar conta e configurar

1. Acesse: https://cloudflare.com
2. Criar conta gratuita
3. Adicionar site: `speedrota.com.br`
4. Cloudflare vai dar 2 nameservers
5. No Registro.br, trocar nameservers para os do Cloudflare
6. Aguardar propagação (até 24h)

### Registros DNS no Cloudflare

```
# Frontend (Vercel)
Tipo: CNAME
Nome: @
Destino: cname.vercel-dns.com
Proxy: ✅ Ativado

# Backend API (Railway)
Tipo: CNAME
Nome: api
Destino: [seu-app].up.railway.app
Proxy: ✅ Ativado

# WWW redirect
Tipo: CNAME
Nome: www
Destino: speedrota.com.br
Proxy: ✅ Ativado
```

---

## 🗄️ PASSO 3: Configurar Banco de Dados (Neon)

### Ação: Criar banco PostgreSQL

1. Acesse: https://neon.tech
2. Criar conta (GitHub login)
3. Criar projeto: `speedrota-prod`
4. Região: São Paulo (sa-east-1) se disponível, ou US East
5. Copiar a Connection String:

```
postgresql://user:password@ep-xxx.sa-east-1.aws.neon.tech/speedrota?sslmode=require
```

### Configurar Prisma para produção

O Prisma já está configurado. Só precisa da variável de ambiente.

---

## ⚙️ PASSO 4: Deploy do Backend (Railway)

### Ação: Criar projeto no Railway

1. Acesse: https://railway.app
2. Login com GitHub
3. "New Project" → "Deploy from GitHub repo"
4. Selecionar: `seu-usuario/speedrota` (pasta `speedrota-api`)
5. Railway detecta Node.js automaticamente

### Configurar Variáveis de Ambiente

No Railway, vá em "Variables" e adicione:

```env
# Banco de Dados (Neon)
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/speedrota?sslmode=require

# JWT
JWT_SECRET=gerar-string-segura-de-64-caracteres-aqui
JWT_EXPIRES_IN=7d

# Ambiente
NODE_ENV=production
PORT=3001

# Frontend URL (será atualizado após deploy Vercel)
FRONTEND_URL=https://speedrota.com.br

# Mercado Pago (PRODUÇÃO - usar credenciais de produção!)
MP_PUBLIC_KEY=APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MP_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Gerar JWT_SECRET seguro

```bash
# No terminal:
openssl rand -base64 64
# Ou:
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

### Configurar Start Command

No Railway, em Settings:
```
Build Command: npm install && npx prisma generate && npx prisma db push
Start Command: npm start
```

### Atualizar package.json do backend

Verificar se tem script `start`:
```json
{
  "scripts": {
    "start": "node --import tsx src/server.ts",
    "dev": "tsx watch src/server.ts"
  }
}
```

### Configurar Domínio Customizado

1. Em Railway → Settings → Domains
2. Adicionar: `api.speedrota.com.br`
3. Railway dará um CNAME para configurar no Cloudflare

---

## 🌐 PASSO 5: Deploy do Frontend (Vercel)

### Ação: Criar projeto na Vercel

1. Acesse: https://vercel.com
2. Login com GitHub
3. "Import Project" → Selecionar repositório
4. Root Directory: `speedrota`
5. Framework: Vite (auto-detectado)

### Configurar Variáveis de Ambiente

Na Vercel, vá em Settings → Environment Variables:

```env
VITE_API_URL=https://api.speedrota.com.br/api/v1
```

### Configurar Domínio Customizado

1. Em Vercel → Settings → Domains
2. Adicionar: `speedrota.com.br`
3. Adicionar: `www.speedrota.com.br`
4. Vercel dará instruções de DNS (já configuramos no Cloudflare)

---

## 💳 PASSO 6: Mercado Pago Produção

### IMPORTANTE: Credenciais de Produção

As credenciais de desenvolvimento (APP_USR) **NÃO funcionam** em produção!

### Ação: Obter credenciais de produção

1. Acesse: https://www.mercadopago.com.br/developers
2. Vá em "Suas integrações" → Sua aplicação
3. Mude para **"Produção"** (não Sandbox)
4. Copie:
   - Public Key de produção
   - Access Token de produção

### Configurar Webhooks de Produção

1. No painel Mercado Pago → Webhooks
2. Adicionar URL: `https://api.speedrota.com.br/api/v1/pagamentos/webhook`
3. Eventos: `payment`, `subscription`

### Testar Integração

Antes de ir ao ar, faça um pagamento real de R$ 1,00 para testar.

---

## 📁 PASSO 7: Preparar Repositório

### Estrutura recomendada

```
speedrota/
├── .github/
│   └── workflows/
│       └── deploy.yml (opcional - CI/CD)
├── speedrota/           # Frontend
│   ├── package.json
│   ├── vercel.json      # Config Vercel
│   └── ...
├── speedrota-api/       # Backend
│   ├── package.json
│   ├── railway.json     # Config Railway
│   └── ...
└── README.md
```

### Criar vercel.json (Frontend)

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Criar railway.json (Backend)

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npx prisma generate"
  },
  "deploy": {
    "startCommand": "npx prisma db push && npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

## ✅ PASSO 8: Checklist Pré-Produção

### Segurança
- [ ] JWT_SECRET é único e forte (64+ chars)
- [ ] DATABASE_URL usa SSL (`?sslmode=require`)
- [ ] Credenciais MP são de PRODUÇÃO
- [ ] CORS configurado apenas para domínio real
- [ ] Rate limiting ativado
- [ ] Logs não expõem dados sensíveis

### Performance
- [ ] Build de produção (`npm run build`)
- [ ] Imagens otimizadas
- [ ] Lazy loading implementado
- [ ] Gzip/Brotli ativado (Cloudflare faz)

### Funcionalidade
- [ ] Login/registro funcionando
- [ ] Pagamento processando
- [ ] OCR funcionando
- [ ] Rotas sendo salvas
- [ ] Emails transacionais (se tiver)

### Monitoramento
- [ ] Logs configurados (Railway tem built-in)
- [ ] Alertas de erro (Sentry - opcional)
- [ ] Uptime monitoring (UptimeRobot - grátis)

---

## 💰 Custos Estimados (Mensal)

### Cenário Inicial (0-1000 usuários)

| Serviço | Custo |
|---------|-------|
| Domínio .com.br | R$ 3,33/mês (R$ 40/ano) |
| Cloudflare | R$ 0 (free) |
| Vercel | R$ 0 (hobby) |
| Railway | R$ 25 (~$5 USD) |
| Neon PostgreSQL | R$ 0 (free tier) |
| **TOTAL** | **~R$ 28/mês** |

### Cenário Crescimento (1000-10000 usuários)

| Serviço | Custo |
|---------|-------|
| Domínio | R$ 3,33/mês |
| Cloudflare Pro | R$ 100/mês (opcional) |
| Vercel Pro | R$ 100/mês |
| Railway Pro | R$ 100/mês |
| Neon Pro | R$ 100/mês |
| **TOTAL** | **~R$ 400/mês** |

---

## 🚀 PASSO 9: Go Live!

### Ordem de execução

```
1. ✅ Comprar domínio (Registro.br)
2. ✅ Configurar Cloudflare
3. ✅ Criar banco Neon
4. ✅ Deploy backend Railway
5. ✅ Deploy frontend Vercel
6. ✅ Configurar DNS no Cloudflare
7. ✅ Configurar MP produção
8. ✅ Testar tudo
9. ✅ Anunciar! 🎉
```

### Tempo estimado: 2-4 horas

---

## 📞 Suporte e Documentação

- **Vercel Docs**: https://vercel.com/docs
- **Railway Docs**: https://docs.railway.app
- **Neon Docs**: https://neon.tech/docs
- **Cloudflare Docs**: https://developers.cloudflare.com
- **Mercado Pago Docs**: https://www.mercadopago.com.br/developers

---

## 🔄 Deploy Contínuo (Automático)

Após configurar tudo, cada `git push` para `main`:

1. **Frontend (Vercel)**: Deploy automático em ~1 min
2. **Backend (Railway)**: Deploy automático em ~2-3 min

```bash
# Para fazer deploy, basta:
git add .
git commit -m "feat: nova funcionalidade"
git push origin main
# 🎉 Deploy automático!
```
