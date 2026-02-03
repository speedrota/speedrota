# 🚀 SpeedRota - Documentação Técnica Completa

> **Versão:** 2.0  
> **Atualizado:** 02/02/2026  
> **Status:** MVP Funcional → Evolução para Produto SaaS

---

## 📌 1. VISÃO GERAL DO PRODUTO

### 1.1 O Que É

**SpeedRota** é um aplicativo de otimização de rotas para entregadores que:
- Captura **origem via GPS** ou entrada manual
- Extrai **destinos de NF-e** via OCR (foto/PDF) ou entrada manual
- Suporta **múltiplos fornecedores** (Natura, Mercado Livre, Shopee, etc.)
- Calcula a **rota mais eficiente** usando algoritmos de otimização
- Exibe **métricas de tempo, distância e custo**
- Oferece navegação integrada com **Google Maps e Waze**

### 1.2 Slogan
*"Suas entregas, uma rota inteligente"*

### 1.3 Problema Resolvido

Entregadores autônomos perdem tempo e dinheiro com:
- Planejamento manual de rotas
- Sequência de entregas não otimizada
- Digitação manual de endereços
- Múltiplos apps de diferentes fornecedores
- Falta de visibilidade de custos operacionais

### 1.4 Usuário-Alvo

| Persona | Descrição | Necessidades |
|---------|-----------|--------------|
| **Zé Entregador** | Autônomo, múltiplos fornecedores | Otimizar tempo, economizar combustível |
| **Maria Logística** | Pequena empresa, 5-10 entregadores | Gerenciar equipe, relatórios |
| **Carlos Frota** | Empresa média, 50+ veículos | Dashboards, API, integrações |

---

## 🎯 2. REGRAS DE NEGÓCIO CRÍTICAS

### 2.1 ORIGEM da Rota

```
✅ É a LOCALIZAÇÃO ATUAL do entregador (GPS)
✅ OU um endereço INSERIDO MANUALMENTE pelo usuário
❌ NÃO é o remetente da NF-e (ex: fábrica Natura)
❌ NÃO é a transportadora
```

### 2.2 DESTINOS da Rota

```
✅ Extraídos do campo DESTINATÁRIO da NF-e (OCR)
✅ OU inseridos manualmente pelo usuário
✅ Múltiplos destinos de diferentes fornecedores
✅ Badge visual por fornecedor (cor + emoji)
```

### 2.3 Fornecedores Suportados

| Fornecedor | Emoji | Cor | Detecção OCR |
|------------|-------|-----|--------------|
| Natura | 🧴 | #FF6B00 | NATURA, COSMETICOR |
| Avon | 💄 | #E91E8C | AVON |
| O Boticário | 🌸 | #006B3F | BOTICARIO, BOTICÁRIO |
| Mercado Livre | 📦 | #FFE600 | MERCADO LIVRE, MELI |
| Shopee | 🛒 | #EE4D2D | SHOPEE |
| Amazon | 📦 | #FF9900 | AMAZON |
| Magalu | 🛍️ | #0086FF | MAGAZINE LUIZA, MAGALU |
| Americanas | 🏪 | #E60014 | AMERICANAS, B2W |
| Correios | ✉️ | #FFCC00 | CORREIOS, ECT |
| iFood | 🍔 | #EA1D2C | IFOOD |
| Rappi | 🛵 | #FF441F | RAPPI |
| Kwai | 🎥 | #FF6A00 | KWAI |
| TikTok Shop | 🎵 | #000000 | TIKTOK |
| Outro | 📋 | #6B7280 | (fallback) |

---

## 💰 3. MODELO DE NEGÓCIO - PLANOS

### 3.1 Tabela de Planos

| Recurso | FREE | PRO | FULL | ENTERPRISE |
|---------|------|-----|------|------------|
| **Preço** | R$ 0 | R$ 29,90/mês | R$ 59,90/mês | Sob consulta |
| Rotas/mês | 5 | ∞ | ∞ | ∞ |
| Paradas/rota | 10 | 30 | 100 | ∞ |
| Fornecedores | 1 | 3 | ∞ | ∞ |
| OCR NF-e | ✅ Básico | ✅ Avançado | ✅ + IA | ✅ + IA |
| Upload PDF | ❌ | ✅ | ✅ | ✅ |
| Histórico | ❌ | 30 dias | 1 ano | ∞ |
| Relatórios | ❌ | Básicos | Completos | Custom |
| API REST | ❌ | ❌ | ✅ | ✅ |
| IA Preditiva | ❌ | ❌ | ✅ | ✅ |
| Multi-usuário | ❌ | ❌ | 5 | ∞ |
| Suporte | FAQ | Email | Chat + Tel | Dedicado |

### 3.2 Projeção de Receita

| Métrica | Mês 6 | Mês 12 | Mês 24 |
|---------|-------|--------|--------|
| Usuários FREE | 5,000 | 20,000 | 100,000 |
| Usuários PRO | 150 | 800 | 5,000 |
| Usuários FULL | 50 | 300 | 2,000 |
| **MRR Total** | **R$ 7.480** | **R$ 41.890** | **R$ 269.300** |

---

## 🏗️ 4. ARQUITETURA TÉCNICA

### 4.1 Stack Atual (MVP Funcional)

```
┌─────────────────────────────────────────────────────────────────┐
│                    MVP ATUAL (route-optimizer)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Frontend: React 19 + TypeScript + Vite 7                       │
│  Estado: Zustand                                                 │
│  Mapas: Leaflet + react-leaflet                                 │
│  OCR: Tesseract.js + pdfjs-dist                                 │
│  Roteamento: OSRM (router.project-osrm.org)                     │
│  Geocoding: Nominatim (OpenStreetMap)                           │
│  Algoritmo: Nearest Neighbor (TSP)                              │
│  Navegação: Google Maps + Waze (deep links)                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Estrutura de Pastas Atual

```
route-optimizer/
├── src/
│   ├── components/
│   │   ├── TelaHome.tsx        # Tela inicial
│   │   ├── TelaOrigem.tsx      # Captura origem (GPS/manual)
│   │   ├── TelaDestinos.tsx    # Adicionar destinos (OCR/manual)
│   │   ├── TelaRota.tsx        # Rota otimizada + métricas
│   │   └── Mapa.tsx            # Visualização do mapa
│   ├── services/
│   │   ├── ocr.ts              # Tesseract + parsing NF-e
│   │   └── geocoding.ts        # Nominatim API
│   ├── store/
│   │   └── routeStore.ts       # Zustand state management
│   ├── types/
│   │   └── index.ts            # Interfaces TypeScript
│   ├── utils/
│   │   ├── calculos.ts         # Haversine, nearest neighbor
│   │   └── validacao.ts        # Validações
│   └── test/
│       └── *.test.ts           # Testes unitários
├── package.json
├── vite.config.ts
└── tsconfig.json
```

### 4.3 Arquitetura Futura (Monorepo)

```
speedrota/
├── apps/
│   ├── web/                    # Next.js (landing + dashboard)
│   │   ├── app/
│   │   │   ├── (marketing)/    # Landing, preços, blog
│   │   │   └── (dashboard)/    # Área logada
│   │   └── components/
│   │
│   ├── mobile/                 # React Native + Expo
│   │   ├── app/                # Expo Router
│   │   └── components/
│   │
│   └── api/                    # Node.js + Fastify
│       ├── routes/
│       └── services/
│
├── packages/
│   └── shared/                 # Código compartilhado (~70%)
│       ├── types/              # ← src/types/
│       ├── utils/              # ← src/utils/
│       ├── validations/        # ← src/utils/validacao.ts
│       └── config/             # ← FORNECEDORES_CONFIG
│
├── services/
│   ├── ml/                     # Python ML service
│   └── n8n/                    # Workflows automação
│
├── infra/
│   ├── docker/
│   └── terraform/
│
├── docker-compose.yml
└── turbo.json
```

### 4.4 Ambientes e Custos

| Ambiente | Stack | Custo/mês |
|----------|-------|-----------|
| **Local** | Docker Compose (PG, Redis, MinIO, N8N) | R$ 0 |
| **Homologação** | Vercel + Railway + Supabase + Upstash | ~R$ 150 |
| **Produção Startup** | Railway Pro + Supabase Pro | ~R$ 1.000 |
| **Produção Growth** | AWS ECS + RDS + ElastiCache | ~R$ 2.750 |
| **Produção Scale** | AWS EKS + Multi-AZ | ~R$ 11.000 |

---

## 📱 5. ESTRATÉGIA MOBILE

### 5.1 Tecnologia: React Native + Expo

**Por quê:**
- Código compartilhado com Web (~70%)
- Uma codebase para Android + iOS
- OTA Updates (sem passar pela store)
- Acesso a GPS, câmera, notificações

### 5.2 Custos de Publicação

| Item | Custo |
|------|-------|
| Apple Developer | R$ 500/ano |
| Google Play | R$ 125 (única vez) |
| EAS Build | Grátis (free tier) |
| **Total Ano 1** | **~R$ 625** |

### 5.3 Funcionalidades Mobile

- 📍 GPS em tempo real (background)
- 📷 Câmera para OCR de NF-e
- 🗺️ Mapas offline (cache)
- 🔔 Push notifications
- 📲 Deep links para Waze/Google Maps

---

## 🤖 6. INTELIGÊNCIA ARTIFICIAL

### 6.1 Algoritmos de Otimização

| Algoritmo | Qualidade | Velocidade | Plano |
|-----------|-----------|------------|-------|
| Nearest Neighbor | 85% | 1ms | FREE |
| 2-Opt | 92% | 10ms | PRO |
| Genetic Algorithm | 97% | 100ms | FULL |
| Ant Colony (ACO) | 98% | 200ms | FULL |
| Deep RL | 99%+ | 50ms* | ENTERPRISE |

### 6.2 IA Preditiva (Plano FULL+)

- **Predição de Tráfego**: LSTM neural network
- **Clustering de Entregas**: DBSCAN por região
- **OCR Avançado**: TrOCR + modelo custom NF-e

### 6.3 Fatores de Tráfego

| Horário | Fator |
|---------|-------|
| 07h-09h (pico manhã) | 1.5x |
| 17h-19h (pico tarde) | 1.6x |
| 11h-14h (almoço) | 1.2x |
| 22h-05h (madrugada) | 0.8x |
| Outros | 1.0x |

---

## ⚙️ 7. AUTOMAÇÃO COM N8N

### 7.1 Workflows Principais

| Workflow | Trigger | Ação |
|----------|---------|------|
| **Onboarding** | Novo cadastro | Welcome email + CRM |
| **Pagamento** | Stripe webhook | Ativar plano + email |
| **Recuperação** | Checkout abandonado | Email 1h + 24h |
| **Reengajamento** | Inativo 30 dias | Email + oferta |
| **Marketing** | Cron semanal | WhatsApp + Email |
| **Alertas** | Limite de rotas | Upsell + notificação |

### 7.2 Integrações

- Stripe (pagamentos)
- SendGrid/Resend (emails)
- Z-API (WhatsApp)
- HubSpot (CRM)
- Slack (alertas internos)

---

## 📐 8. ESTRUTURAS DE DADOS

### 8.1 Interfaces TypeScript (Atuais)

```typescript
// Fornecedor
type Fornecedor = 
  | 'natura' | 'avon' | 'boticario' | 'mercadolivre' 
  | 'shopee' | 'amazon' | 'magalu' | 'americanas'
  | 'correios' | 'ifood' | 'rappi' | 'kwai' | 'tiktok' | 'outro';

// Configuração visual
const FORNECEDORES_CONFIG: Record<Fornecedor, { 
  nome: string; 
  cor: string; 
  emoji: string 
}>;

// Origem
interface Origem {
  lat: number;
  lng: number;
  endereco: string;
  fonte: 'gps' | 'manual';
  precisao?: number;
  timestamp: Date;
}

// Destino
interface Destino {
  id: string;
  lat: number;
  lng: number;
  nome: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep?: string;
  telefone?: string;
  referencia?: string;
  nfe?: string;
  fonte: 'ocr' | 'manual';
  fornecedor: Fornecedor;
  confianca: number;
}

// Parada Ordenada (após otimização)
interface ParadaOrdenada extends Destino {
  ordem: number;
  distanciaAnterior: number;
  distanciaAcumulada: number;
  tempoAnterior: number;
  tempoAcumulado: number;
}

// Métricas
interface Metricas {
  distanciaTotalKm: number;
  tempoViagemMin: number;
  tempoEntregasMin: number;
  tempoTotalMin: number;
  combustivelL: number;
  custoR$: number;
}

// Dados extraídos da NF-e
interface DadosNFe {
  numero: string;
  destinatario: {
    nome: string;
    endereco: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
    telefone?: string;
    referencia?: string;
  };
  fornecedor: Fornecedor;
  confiancaOCR: number;
}
```

### 8.2 Schema do Banco (PostgreSQL)

```sql
-- Usuários
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    document_type VARCHAR(4) CHECK (document_type IN ('CPF', 'CNPJ')),
    document VARCHAR(18) NOT NULL,
    phone VARCHAR(20),
    plan VARCHAR(20) DEFAULT 'free',
    plan_expires_at TIMESTAMP,
    routes_used_month INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Rotas
CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    name VARCHAR(255),
    origin_lat DECIMAL(10, 8),
    origin_lng DECIMAL(11, 8),
    origin_address TEXT,
    total_distance_km DECIMAL(10, 2),
    total_time_min INT,
    total_stops INT,
    created_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'created'
);

-- Paradas
CREATE TABLE route_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    order_num INT NOT NULL,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    address TEXT,
    city VARCHAR(100),
    state CHAR(2),
    recipient_name VARCHAR(255),
    provider VARCHAR(50),
    delivered_at TIMESTAMP
);

-- Assinaturas
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    stripe_subscription_id VARCHAR(255),
    plan VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    current_period_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔄 9. FLUXO DE TELAS

```
[Splash] → [Home] → [Origem] → [Destinos] → [Rota] → [Navegação]
              │
              ├── [Histórico]
              ├── [Perfil/Conta]
              └── [Assinatura/Pagamento]
```

### Tela: Home
- "Nova Rota" (botão principal)
- Rotas recentes
- Contador de rotas (FREE: 3/5 restantes)

### Tela: Origem
- "Usar minha localização" (GPS)
- Campo de busca com autocomplete
- Mini mapa de confirmação

### Tela: Destinos
- "Escanear NF-e" (câmera)
- "Upload PDF"
- "Adicionar manual"
- Lista de destinos com badges de fornecedor
- "Calcular Rota"

### Tela: Rota Otimizada
- Mapa com rota OSRM
- Métricas (km, tempo, custo)
- Lista de paradas ordenadas
- "Abrir no Waze" / "Abrir no Google Maps"

---

## 📅 10. ROADMAP

### ✅ Fase 1: MVP (Concluído)
- [x] Captura GPS/manual de origem
- [x] OCR de NF-e (Tesseract.js)
- [x] Upload de PDF
- [x] Multi-fornecedor com badges
- [x] Algoritmo Nearest Neighbor
- [x] Visualização no mapa (Leaflet)
- [x] Métricas (km, tempo, custo)
- [x] Links Waze/Google Maps
- [x] Rota real OSRM

### 🔄 Fase 2: Produto (4 semanas)
- [ ] Sistema de cadastro (CPF/CNPJ)
- [ ] Autenticação (JWT)
- [ ] Banco de dados (PostgreSQL)
- [ ] Integração Stripe
- [ ] Sistema de planos/limites
- [ ] Landing page marketing

### 📱 Fase 3: Mobile (6 semanas)
- [ ] App React Native + Expo
- [ ] Câmera nativa para OCR
- [ ] GPS em background
- [ ] Push notifications
- [ ] Publicação nas stores

### 🤖 Fase 4: IA (4 semanas)
- [ ] Algoritmo genético
- [ ] Predição de tráfego
- [ ] OCR com IA (TrOCR)
- [ ] API REST pública

### 🏢 Fase 5: Enterprise (8 semanas)
- [ ] Multi-usuário/equipes
- [ ] Dashboard analytics
- [ ] White label
- [ ] SDK/Libraries

---

## 💰 11. INVESTIMENTO INICIAL

| Item | Custo |
|------|-------|
| Domínio speedrota.com.br | R$ 40 |
| Apple Developer | R$ 500 |
| Google Play | R$ 125 |
| Logo profissional | R$ 500 |
| Landing page design | R$ 1.000 |
| **TOTAL** | **R$ 2.165** |

---

## 🔐 12. SEGURANÇA

- [x] HTTPS obrigatório
- [ ] JWT com refresh tokens
- [ ] Rate limiting
- [ ] Validação de entrada
- [ ] Senhas com bcrypt/argon2
- [ ] 2FA opcional
- [ ] Logs de auditoria
- [ ] LGPD compliance
- [ ] PCI DSS (via Stripe)

---

## 📊 13. KPIs DE SUCESSO

| Métrica | Meta |
|---------|------|
| Taxa de extração OCR | > 85% |
| Precisão geocoding | > 90% |
| Tempo de cálculo (10 destinos) | < 3s |
| Economia estimada vs sequencial | > 15% |
| NPS usuários | > 40 |
| Conversão FREE → PRO | > 3% |
| Churn mensal | < 5% |

---

## 📞 14. RECURSOS

- **Servidor local:** http://localhost:3000
- **Repositório:** route-optimizer/
- **Documentação:** Este arquivo

### APIs Utilizadas

| API | Uso | Limite |
|-----|-----|--------|
| Nominatim | Geocoding | 1 req/s |
| OSRM | Roteamento | Ilimitado |
| Tesseract.js | OCR local | Ilimitado |
| ViaCEP | CEP → endereço | Ilimitado |

---

*Documento consolidado em: 02/02/2026*
*Versão: 2.0*
