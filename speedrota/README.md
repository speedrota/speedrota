# 🚚 Route Optimizer - MVP

> Aplicativo de otimização de rotas para entregadores

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Instalação](#instalação)
- [Uso](#uso)
- [Testes](#testes)
- [Estrutura do Projeto](#estrutura-do-projeto)

---

## 🎯 Visão Geral

O Route Optimizer é uma aplicação web PWA que ajuda entregadores a:

- **Capturar origem** via GPS ou entrada manual
- **Extrair destinos** de imagens de NF-e via OCR
- **Calcular rotas otimizadas** usando algoritmo TSP (Nearest Neighbor)
- **Visualizar métricas** de distância, tempo e custo

### ⚠️ Regra de Negócio Crítica

```
❌ ORIGEM ≠ Remetente da NF-e (fábrica)
❌ ORIGEM ≠ Transportadora
✅ ORIGEM = Localização atual do entregador (GPS ou manual)
```

---

## ✨ Funcionalidades

### Módulo 1: Captura de Origem
- [x] GPS automático com reverse geocoding
- [x] Entrada manual com geocoding
- [x] Visualização no mapa
- [x] Validação de coordenadas

### Módulo 2: Captura de Destinos
- [x] OCR de NF-e (Tesseract.js)
- [x] Entrada manual com formulário
- [x] Geocoding (Nominatim + ViaCEP)
- [x] Lista editável de destinos

### Módulo 3: Otimização de Rota
- [x] Algoritmo Nearest Neighbor (TSP)
- [x] Fórmula de Haversine para distâncias
- [x] Ordenação de paradas
- [x] Opção de retorno à origem

### Módulo 4: Métricas
- [x] Distância total (km)
- [x] Tempo de viagem (com fator de tráfego)
- [x] Combustível estimado (litros)
- [x] Custo estimado (R$)
- [x] Janelas de entrega previstas

### Módulo 5: Visualização
- [x] Mapa interativo (Leaflet)
- [x] Marcadores numerados
- [x] Linha da rota
- [x] Lista de paradas ordenadas

---

## 🏗️ Arquitetura

### Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 19 + TypeScript |
| Build | Vite 7 |
| Estado | Zustand |
| Mapas | Leaflet + react-leaflet |
| OCR | Tesseract.js |
| Geocoding | Nominatim (OSM) + ViaCEP |
| Testes | Vitest |

### Padrões Aplicados

- **Design por Contrato**: Pré/pós-condições em todas as funções
- **Clean Code**: Funções pequenas, nomes descritivos
- **Separação de Responsabilidades**: Services, Utils, Store, Components
- **TDD Light**: Testes para regras críticas
- **PDCA**: Planejamento → Execução → Verificação → Ajuste

---

## 🚀 Instalação

```bash
# Clonar ou navegar para o projeto
cd route-optimizer

# Instalar dependências
npm install

# Iniciar desenvolvimento
npm run dev

# Executar testes
npm run test

# Build para produção
npm run build
```

---

## 📱 Uso

### 1. Definir Origem

```
Home → Nova Rota → Definir Origem
```

Opções:
- **GPS**: Clique em "Usar minha localização"
- **Manual**: Digite o endereço e confirme

### 2. Adicionar Destinos

```
Definir Origem → Adicionar Destinos
```

Opções:
- **OCR**: Clique em "Escanear NF-e" e capture a imagem
- **Manual**: Preencha o formulário

### 3. Calcular Rota

```
Adicionar Destinos → Calcular Rota Otimizada
```

O sistema irá:
1. Ordenar destinos pelo mais próximo (Nearest Neighbor)
2. Calcular métricas (km, tempo, custo)
3. Exibir mapa com rota

### 4. Navegar

```
Rota Otimizada → Iniciar Navegação
```

Abre o Google Maps com a rota calculada.

---

## 🧪 Testes

```bash
# Executar todos os testes
npm run test:run

# Modo watch
npm run test
```

### Cobertura de Testes

| Módulo | Testes | Status |
|--------|--------|--------|
| Haversine | 4 | ✅ |
| Nearest Neighbor | 4 | ✅ |
| Fator de Tráfego | 5 | ✅ |
| Métricas | 3 | ✅ |
| Formatação | 6 | ✅ |
| Validação Coordenadas | 7 | ✅ |
| Validação Origem | 5 | ✅ |
| Validação Destino | 6 | ✅ |
| Validação Lista | 3 | ✅ |
| Validação Cálculo | 3 | ✅ |
| **TOTAL** | **47** | ✅ |

---

## 📁 Estrutura do Projeto

```
route-optimizer/
├── src/
│   ├── components/          # Componentes React
│   │   ├── Mapa.tsx         # Mapa Leaflet
│   │   ├── TelaHome.tsx     # Tela inicial
│   │   ├── TelaOrigem.tsx   # Captura de origem
│   │   ├── TelaDestinos.tsx # Lista de destinos
│   │   └── TelaRota.tsx     # Resultado da rota
│   │
│   ├── services/            # Serviços externos
│   │   ├── geolocalizacao.ts # GPS e Geocoding
│   │   └── ocr.ts           # OCR de NF-e
│   │
│   ├── store/               # Estado global
│   │   └── routeStore.ts    # Zustand store
│   │
│   ├── types/               # TypeScript types
│   │   └── index.ts         # Interfaces e constantes
│   │
│   ├── utils/               # Funções utilitárias
│   │   ├── calculos.ts      # Haversine, TSP, métricas
│   │   └── validacao.ts     # Validações e sanity checks
│   │
│   ├── test/                # Testes
│   │   ├── setup.ts
│   │   ├── calculos.test.ts
│   │   └── validacao.test.ts
│   │
│   ├── styles/
│   │   └── global.css       # Estilos globais
│   │
│   ├── App.tsx              # Componente principal
│   └── main.tsx             # Entry point
│
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

---

## 📊 Métricas de Qualidade

### Checklist BI/KPI

- [x] **Grain definido**: 1 rota = 1 origem + N destinos
- [x] **Regras documentadas**: Constantes em `types/index.ts`
- [x] **Sanity checks**: Validações em `utils/validacao.ts`
- [x] **Quality gates**: Testes unitários

### Checklist Código

- [x] **Testes existem**: 47 testes passando
- [x] **Tratamento de erro**: Try/catch em todas as operações async
- [x] **Logs úteis**: Console.log com prefixos [Store], [GPS], etc
- [x] **Input validado**: Validações antes de processar
- [x] **Funções pequenas**: < 50 linhas cada

---

## 🔧 Constantes Configuráveis

```typescript
// src/types/index.ts

const CONSTANTES = {
  VELOCIDADE_URBANA_KMH: 30,    // Velocidade média
  CONSUMO_MEDIO_KML: 10,        // Consumo do veículo
  PRECO_COMBUSTIVEL_RS: 5.89,   // Preço do litro
  TEMPO_POR_ENTREGA_MIN: 5,     // Tempo em cada parada
  BUFFER_TEMPO_MIN: 15,         // Buffer de atraso
  ALERTA_DISTANCIA_KM: 100,     // Alerta de rota longa
};

const FATORES_TRAFEGO = {
  PICO_MANHA: { inicio: 7, fim: 9, fator: 1.5 },
  PICO_TARDE: { inicio: 17, fim: 19, fator: 1.6 },
  ALMOCO: { inicio: 11, fim: 14, fator: 1.2 },
  MADRUGADA: { inicio: 22, fim: 5, fator: 0.8 },
};
```

---

## 📝 Próximos Passos (Roadmap)

### Fase 2: Melhorias OCR
- [ ] Pré-processamento de imagem
- [ ] Templates de NF-e por emissor
- [ ] Validação de CNPJ/CPF

### Fase 3: Backend
- [ ] API REST com Node.js
- [ ] Banco PostgreSQL + PostGIS
- [ ] Cache Redis para geocoding
- [ ] Autenticação de usuários

### Fase 4: Produção
- [ ] PWA completo (offline)
- [ ] Push notifications
- [ ] Histórico de rotas
- [ ] Exportar para Excel/PDF

---

## 📄 Licença

MIT

---

*Desenvolvido seguindo as técnicas do Guia Consolidado de Evolução de Prompts, Código e BI*
