# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.5.0] - 2025-01-XX

### Adicionado - POD (Proof of Delivery)

🎯 **Feature**: Comprovante de Entrega Opcional

Implementação completa de POD seguindo metodologia PDCA:

#### PLAN - Contrato Documentado
- [docs/POD_CONTRACT.md](docs/POD_CONTRACT.md) com interfaces, pré/pós-condições
- Design by Contract com `@pre`, `@post`, `@invariant` em todas as funções

#### DO - Implementação

**Backend (speedrota-api):**
- `prisma/schema.prisma`: Modelo `ProofOfDelivery` com relação 1:1 para Parada
- `src/routes/pod.routes.ts`: Endpoints REST
  - `POST /api/v1/pod` - Registrar POD
  - `GET /api/v1/pod/:paradaId` - Buscar POD de parada
  - `GET /api/v1/pod/rota/:rotaId` - Listar PODs de uma rota
  - `GET /api/v1/pod/verificar-plano` - Verificar se plano permite POD
- `src/utils/pod.utils.ts`: Funções utilitárias com Design by Contract
- `src/tests/pod.test.ts`: 25+ testes TDD

**Frontend Web (speedrota):**
- `src/hooks/usePOD.ts`: Hook React para operações POD
- `src/components/ModalPOD.tsx`: Modal de captura (foto/código)
- `src/components/ModalPOD.css`: Estilos responsivos
- `src/components/TelaRota.tsx`: Integração com botão "Confirmar Entrega"

**Android (speedrota-android):**
- `data/model/Models.kt`: Tipos TipoPOD, RegistrarPODRequest, PODData
- `data/api/SpeedRotaApi.kt`: Endpoints POD
- `data/repository/PODRepository.kt`: Repository com tratamento de erros
- `ui/screens/rota/PODBottomSheet.kt`: Bottom sheet para captura
- `ui/screens/rota/RotaViewModel.kt`: Estado e lógica POD
- `ui/screens/rota/RotaScreen.kt`: Integração UI
- `AndroidManifest.xml`: FileProvider para câmera
- `res/xml/file_paths.xml`: Configuração de caminhos

#### CHECK - Validação

- [x] TypeScript sem `any` em novos arquivos
- [x] Interfaces em `src/types/` (via schema Prisma)
- [x] Tratamento de erros com mensagens claras
- [x] Loading states implementados
- [x] Testes para regra principal (25+ casos)
- [x] Logs úteis (volume, tempo, etapas)
- [x] Input validado (fail fast)
- [x] Funções < 30 linhas (maioria)

#### ACT - Padronização

**Planos com POD habilitado:**
- FULL
- FROTA  
- ENTERPRISE

**Tipos de comprovante:**
- FOTO (câmera do dispositivo)
- CODIGO (código de entrega)
- ASSINATURA (futuro)

**Feature flag:**
```typescript
const PLANOS_COM_POD = ['FULL', 'FROTA', 'ENTERPRISE'];
```

### Tecnologia

| Componente | Tecnologia |
|------------|------------|
| Schema | Prisma 6.19 |
| API | Fastify 5 + TypeScript |
| Web | React 19 + Vite 7 |
| Android | Kotlin + Jetpack Compose |
| Storage | Base64 (preparado para S3/Cloudinary) |

---

## [1.4.0] - 2025-01-XX

### Adicionado - Quick Wins Competitivos

- Janela de tempo (`janelaInicio`, `janelaFim`) nas paradas
- Prioridade (`ALTA`, `MEDIA`, `BAIXA`) com ordenação no algoritmo
- Compartilhamento WhatsApp com resumo da rota
- Visual de prioridade com cores (vermelho/amarelo/verde)
- Ícones de janela de tempo ⏰ na lista de destinos

---

## [1.3.0] - 2025-01-XX

### Adicionado

- Tela de histórico de rotas
- Sistema de planos (FREE, PRO, FULL)
- Integração Stripe/MercadoPago
- App Android com Jetpack Compose

---

## [1.2.0] - 2024-12-XX

### Adicionado

- Otimização de rota com Nearest Neighbor + 2-opt
- Cálculo de custos (combustível)
- Predição de tempo com fator de tráfego
- Geocodificação via Nominatim + ViaCEP fallback

---

## [1.1.0] - 2024-12-XX

### Adicionado

- OCR de NF-e com Tesseract.js
- Extração de PDF com pdfjs-dist
- Extração de endereço do DESTINATÁRIO
- Suporte a múltiplos fornecedores

---

## [1.0.0] - 2024-12-XX

### Adicionado

- MVP inicial
- Captura de origem via GPS
- Input manual de destinos
- Navegação Google Maps e Waze
- Deploy Vercel (web) + Render (API)
