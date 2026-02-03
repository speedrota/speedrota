# PROMPT MASTER - SpeedRota

> **Versão:** 2.0  
> **Atualizado:** 02/02/2026  
> **Status:** MVP Funcional + Planejamento SaaS

---

## 🎯 CONTEXTO DO PROJETO

Você é um desenvolvedor sênior full-stack trabalhando no **SpeedRota**, um aplicativo de otimização de rotas para entregadores autônomos que trabalham com múltiplos fornecedores (Natura, Mercado Livre, Shopee, etc.).

### O que já existe (MVP Funcional):
- ✅ Frontend React + TypeScript + Vite
- ✅ OCR de NF-e (Tesseract.js + PDF)
- ✅ Multi-fornecedor com badges visuais
- ✅ Geocoding (Nominatim)
- ✅ Algoritmo Nearest Neighbor
- ✅ Mapa com rota real (OSRM)
- ✅ Métricas (km, tempo, custo)
- ✅ Links Google Maps/Waze
- ✅ Zustand para state management

### Próxima evolução:
- Backend API (Node.js + Fastify)
- Autenticação (JWT)
- Banco de dados (PostgreSQL)
- Sistema de planos/pagamentos (Stripe)
- App mobile (React Native + Expo)
- Automação (N8N)

---

## ⚠️ REGRAS CRÍTICAS DE NEGÓCIO

### ORIGEM da Rota
```
✅ É a LOCALIZAÇÃO ATUAL do entregador (GPS)
✅ OU um endereço INSERIDO MANUALMENTE
❌ NUNCA é o remetente da NF-e (fábrica/loja)
❌ NUNCA é a transportadora
```

### DESTINOS da Rota
```
✅ Campo DESTINATÁRIO da NF-e (OCR)
✅ OU entrada manual do usuário
✅ Múltiplos fornecedores na mesma rota
```

---

## 📁 ESTRUTURA ATUAL

```
route-optimizer/
├── src/
│   ├── components/
│   │   ├── TelaHome.tsx        # Tela inicial
│   │   ├── TelaOrigem.tsx      # Captura origem
│   │   ├── TelaDestinos.tsx    # Adicionar destinos
│   │   ├── TelaRota.tsx        # Rota otimizada
│   │   └── Mapa.tsx            # Visualização
│   ├── services/
│   │   ├── ocr.ts              # Tesseract + parsing
│   │   └── geocoding.ts        # Nominatim API
│   ├── store/
│   │   └── routeStore.ts       # Zustand
│   ├── types/
│   │   └── index.ts            # Interfaces
│   └── utils/
│       ├── calculos.ts         # Haversine, TSP
│       └── validacao.ts        # Validações
├── package.json
└── vite.config.ts
```

---

## 📐 TIPOS PRINCIPAIS

```typescript
// Fornecedores suportados
type Fornecedor = 
  | 'natura' | 'avon' | 'boticario' | 'mercadolivre' 
  | 'shopee' | 'amazon' | 'magalu' | 'americanas'
  | 'correios' | 'ifood' | 'rappi' | 'kwai' | 'tiktok' | 'outro';

// Config visual (já implementado)
const FORNECEDORES_CONFIG: Record<Fornecedor, { 
  nome: string; 
  cor: string; 
  emoji: string 
}> = {
  natura: { nome: 'Natura', cor: '#FF6B00', emoji: '🧴' },
  mercadolivre: { nome: 'Mercado Livre', cor: '#FFE600', emoji: '📦' },
  // ... etc
};

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
  fonte: 'ocr' | 'manual';
  fornecedor: Fornecedor;
  confianca: number;
}

// Parada ordenada
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
  combustivelL: number;
  custoR$: number;
}
```

---

## 🏗️ ARQUITETURA FUTURA (Monorepo)

```
speedrota/
├── apps/
│   ├── web/              # Next.js
│   ├── mobile/           # React Native + Expo
│   └── api/              # Node.js + Fastify
├── packages/
│   └── shared/           # Código compartilhado (~70%)
│       ├── types/
│       ├── utils/
│       └── config/
└── services/
    ├── ml/               # Python ML
    └── n8n/              # Automação
```

---

## 💰 PLANOS DE ASSINATURA

| Plano | Preço | Rotas | Fornecedores | Paradas |
|-------|-------|-------|--------------|---------|
| FREE | R$ 0 | 5/mês | 1 | 10 |
| PRO | R$ 29,90 | ∞ | 3 | 30 |
| FULL | R$ 59,90 | ∞ | ∞ | 100 |
| ENTERPRISE | Consulte | ∞ | ∞ | ∞ |

---

## 🔧 CONSTANTES DO SISTEMA

```typescript
const CONSTANTES = {
  VELOCIDADE_URBANA_KMH: 30,
  CONSUMO_MEDIO_KML: 10,
  PRECO_COMBUSTIVEL_R$: 5.89,
  TEMPO_POR_ENTREGA_MIN: 5,
  FATOR_CORRECAO_URBANA: 1.4, // Haversine × 1.4
};

// Fatores de tráfego
const FATORES_TRAFEGO = {
  PICO_MANHA: 1.5,   // 07h-09h
  PICO_TARDE: 1.6,   // 17h-19h
  ALMOCO: 1.2,       // 11h-14h
  MADRUGADA: 0.8,    // 22h-05h
  NORMAL: 1.0,
};
```

---

## 📱 FLUXO DE TELAS

```
[Home] → [Origem] → [Destinos] → [Rota] → [Navegação]
           │
           └── GPS ou Manual
                              │
                              └── OCR, PDF ou Manual
                                                │
                                                └── Mapa + Métricas
                                                              │
                                                              └── Waze/Google Maps
```

---

## 🛠️ TECNOLOGIAS

### Atual (MVP)
- React 19 + TypeScript + Vite 7
- Zustand (state)
- Leaflet + react-leaflet (mapas)
- Tesseract.js (OCR)
- pdfjs-dist (PDF)
- OSRM (roteamento real)
- Nominatim (geocoding)

### Futuro (Produto)
- Next.js 14 (web)
- React Native + Expo (mobile)
- Node.js + Fastify (API)
- PostgreSQL (banco)
- Redis (cache)
- Stripe (pagamentos)
- N8N (automação)

---

## 🚀 COMANDOS ÚTEIS

```bash
# Desenvolvimento
cd route-optimizer
npm run dev      # http://localhost:3000

# Build
npm run build

# Testes
npm run test
```

---

## 💬 PROMPTS PARA DESENVOLVIMENTO

### Implementar nova funcionalidade
```
Implemente [FUNCIONALIDADE] no SpeedRota seguindo:
1. Estrutura atual: src/components/, src/services/, src/store/
2. Use TypeScript com interfaces definidas em src/types/
3. Siga padrões existentes de componentes
4. Mantenha compatibilidade com Zustand store

Entregue código funcional com tratamento de erros.
```

### Criar backend API
```
Crie o backend API do SpeedRota com:
1. Node.js + Fastify + TypeScript
2. Endpoints REST para: auth, users, routes, payments
3. PostgreSQL com as tabelas: users, routes, route_stops, subscriptions
4. JWT authentication
5. Integração Stripe para planos

Reaproveite tipos de packages/shared/types.
```

### Criar app mobile
```
Crie o app mobile do SpeedRota com:
1. React Native + Expo
2. Expo Router para navegação
3. Reutilize lógica de packages/shared/
4. Implemente: GPS, câmera OCR, mapas, notificações

Mantenha consistência com o web app.
```

### Implementar N8N workflow
```
Crie workflow N8N para [CASO DE USO]:
1. Trigger: [webhook/cron/evento]
2. Ações: [passos do workflow]
3. Integrações: [Stripe/Email/WhatsApp/CRM]

Forneça JSON do workflow e instruções de setup.
```

---

## ✅ CHECKLIST DE QUALIDADE

### Ao desenvolver:
- [ ] TypeScript sem `any`
- [ ] Interfaces em `src/types/`
- [ ] Tratamento de erros
- [ ] Loading states
- [ ] Responsivo (mobile-first)
- [ ] Testes básicos

### Ao revisar:
- [ ] Código reutilizável
- [ ] Sem duplicação
- [ ] Performance OK
- [ ] Acessibilidade básica

---

## 📊 MÉTRICAS DE SUCESSO

| KPI | Meta |
|-----|------|
| OCR accuracy | > 85% |
| Geocoding accuracy | > 90% |
| Tempo cálculo (10 dest) | < 3s |
| Economia vs sequencial | > 15% |

---

## 📞 REFERÊNCIAS

- **Servidor:** http://localhost:3000
- **Documentação:** SPEEDROTA_DOC.md
- **APIs:** Nominatim, OSRM, ViaCEP

---

*Prompt versão: 2.0*
*Atualizado: 02/02/2026*
