# SpeedRota - Copilot Instructions

## 🎯 Product Overview

**SpeedRota** is a route optimization app for delivery drivers working with multiple suppliers (Natura, Mercado Livre, Shopee, etc.). Extracts addresses from NF-e invoices via OCR, optimizes routes using TSP algorithms, and provides navigation links.

## ⚠️ Critical Business Rules

```
✅ ORIGIN = Driver's current location (GPS) or manually entered address
❌ ORIGIN ≠ NF-e sender (factory/warehouse) - NEVER extract from invoice
❌ ORIGIN ≠ Shipping company
✅ DESTINATIONS = Extracted from NF-e RECIPIENT field via OCR
```

## 🏗️ Architecture

```
src/
├── components/    # React components (TelaHome, TelaOrigem, TelaDestinos, TelaRota, Mapa)
├── services/      # External integrations (OCR, geocoding, routing, PDF)
├── store/         # Zustand global state (routeStore.ts)
├── types/         # TypeScript interfaces + FORNECEDORES_CONFIG
├── utils/         # Pure functions (calculos.ts, validacao.ts)
└── styles/        # CSS variables in global.css
```

### Key Patterns

- **Design by Contract**: All functions have pre/post conditions documented in JSDoc
- **Zustand Store**: Single source of truth at `src/store/routeStore.ts`
- **Flow Stages**: `home → origem → destinos → rota → navegacao` (type: `EtapaFluxo`)

## 🔧 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19 + TypeScript + Vite 7 |
| State | Zustand |
| Maps | Leaflet + react-leaflet |
| OCR | Tesseract.js (Portuguese) |
| PDF | pdfjs-dist |
| Geocoding | Nominatim (OSM) + ViaCEP fallback |
| Routing | OSRM (router.project-osrm.org) |

## � Design by Contract (OBRIGATÓRIO)

Toda função DEVE ter:
```typescript
/**
 * @description O que faz
 * @pre Pré-condições (inputs válidos)
 * @post Pós-condições (garantias do output)
 * @invariant Invariantes (o que nunca muda)
 * @throws Quando falha
 */
```

Exemplo:
```typescript
/**
 * Calcula distância entre dois pontos
 * @pre lat1, lat2 ∈ [-90, 90], lng1, lng2 ∈ [-180, 180]
 * @post resultado >= 0 (distância nunca negativa)
 * @invariant Fórmula Haversine com R=6371km
 */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number
```

## 🧪 TDD Light (Testes Obrigatórios)

Antes de implementar regra de negócio:
1. Escreva 3 testes: caso normal, borda, erro
2. Implemente para passar
3. Refatore

```bash
npm test          # Watch mode
npm run test:run  # Single run
```

## ✅ Quality Checklist (usar em TODO código)

### Código Pronto para Produção
- [ ] TypeScript sem `any`
- [ ] Interfaces em `src/types/`
- [ ] Tratamento de erros com mensagens claras
- [ ] Loading states implementados
- [ ] Testes para regra principal
- [ ] Logs úteis (volume, tempo, etapas)
- [ ] Input validado (fail fast)
- [ ] Sem duplicação óbvia
- [ ] Funções < 30 linhas

### BI/Métricas Confiáveis
- [ ] KPI definido e documentado
- [ ] Sanity checks (ranges, nulos, duplicados)
- [ ] Reconciliação com fonte

## 📦 Suppliers (Fornecedores)

Always use the `Fornecedor` type from `src/types/index.ts`:

```typescript
import { FORNECEDORES_CONFIG, type Fornecedor } from '../types';
const config = FORNECEDORES_CONFIG['natura']; // { nome, cor, emoji }
```

## 🧮 Constants (NUNCA hardcode)

```typescript
import { CONSTANTES, FATORES_TRAFEGO } from '../types';

// CONSTANTES.VELOCIDADE_URBANA_KMH = 30
// CONSTANTES.CONSUMO_MEDIO_KML = 10
// CONSTANTES.PRECO_COMBUSTIVEL = 5.89
// CONSTANTES.TEMPO_POR_ENTREGA_MIN = 5
// CONSTANTES.FATOR_CORRECAO_URBANA = 1.4
```

## 🗺️ Navigation Links

```typescript
// Google Maps
`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`

// Waze
`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
```

## 📊 KPIs de Qualidade

| Métrica | Meta | Validação |
|---------|------|-----------|
| OCR accuracy | > 85% | `confianca >= 0.85` |
| Geocoding accuracy | > 90% | Endereço encontrado |
| Tempo cálculo (10 dest) | < 3s | Performance test |
| Economia vs sequencial | > 15% | Comparar rotas |

## 🔄 PDCA Workflow

1. **Plan**: Definir objetivo + critérios de qualidade (Definition of Done)
2. **Do**: Implementar versão 1
3. **Check**: Testar contra critérios + evidências
4. **Act**: Padronizar (template, checklist) e melhorar

## 🐛 Debugging (OODA Loop)

1. **Observe**: Logs, inputs, outputs
2. **Orient**: Hipóteses ordenadas por probabilidade
3. **Decide**: Teste que mais reduz incerteza
4. **Act**: Execute e capture evidências

## 📝 Code Style

- CSS variables in `src/styles/global.css` (`--primary: #2563eb`)
- Portuguese for user-facing text, English for code/comments
- Components: `Tela{ScreenName}.tsx`
- Services: `{domain}.ts` (ocr.ts, geolocalizacao.ts)
- Utils: Pure functions only

## 🚀 Development

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # Production build
```

## 📁 Future Architecture (Monorepo)

```
speedrota/
├── apps/
│   ├── web/              # Next.js (atual MVP migrado)
│   ├── mobile/           # React Native + Expo
│   └── api/              # Node.js + Fastify
├── packages/
│   └── shared/           # Código compartilhado (~70%)
│       ├── types/        # Interfaces
│       ├── utils/        # calculos.ts, validacao.ts
│       └── config/       # CONSTANTES, FORNECEDORES
└── services/
    ├── ml/               # Python ML (futuro)
    └── n8n/              # Automação
```
