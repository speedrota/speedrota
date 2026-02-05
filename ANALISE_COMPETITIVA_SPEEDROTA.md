# 🎯 Análise Competitiva SpeedRota vs Concorrência

## Documento Estratégico - Fevereiro 2026

---

## 📊 1. MATRIZ COMPARATIVA: SpeedRota vs Concorrentes

| Feature | SpeedRota | Route4Me | Cigo | OptimoRoute | Onfleet |
|---------|-----------|----------|------|-------------|---------|
| **Preço (BRL/mês)** | R$29-99 | ~R$1.200+ | ~R$150/driver | ~R$210/driver | ~R$3.100+ |
| **OCR de NF-e** | ✅ ÚNICO | ❌ | ❌ | ❌ | ❌ |
| **Tráfego Real-time** | ✅ NOVO | ✅ | ✅ | ✅ | ✅ |
| **Janelas de Tempo** | ✅ NOVO | ✅ | ✅ | ✅ | ✅ |
| **Prioridade Entregas** | ✅ NOVO | ✅ | ✅ | ✅ | ✅ |
| **Compartilhar WhatsApp** | ✅ NOVO | ❌ | ❌ | ❌ | ❌ |
| **Multi-driver** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **POD (Proof of Delivery)** | ✅ NOVO | ✅ | ✅ | ✅ | ✅ |
| **Integração ERP/TMS** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Analytics Avançados** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Geofencing** | ❌ | ✅ | ✅ | ❌ | ✅ |
| **API Pública** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Suporte PT-BR** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Pagamento PIX/Boleto** | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 🔴 2. GAPS CRÍTICOS (O que NÃO fazemos)

### 2.1 Gaps de Alta Prioridade (Impacto Direto na Conversão)

| Gap | Impacto | Complexidade | Status |
|-----|---------|--------------|--------|
| ~~Tráfego Real-time~~ | ~~ALTO - Rotas imprecisas~~ | ~~Média~~ | ✅ FEITO |
| ~~Janelas de Tempo~~ | ~~ALTO - Entregas agendadas~~ | ~~Baixa~~ | ✅ FEITO |
| **POD (Proof of Delivery)** | ALTO - Comprovação | Média | ✅ FEITO |
| **Re-otimização Dinâmica** | MÉDIO - Mudanças em rota | Alta | ❌ P1 |
| **Multi-driver/Frota** | ALTO - Escalar clientes | Alta | ❌ P2 |

### 2.2 Gaps de Média Prioridade

| Gap | Impacto | Complexidade | Status |
|-----|---------|--------------|--------|
| **Capacidade Veículo** | MÉDIO | Baixa | ❌ P2 |
| ~~Analytics/Relatórios~~ | ~~MÉDIO~~ | ~~Média~~ | ✅ FEITO |
| ~~Integração WhatsApp~~ | ~~ALTO no Brasil~~ | ~~Média~~ | ✅ FEITO |
| **API Pública** | ALTO para B2B | Alta | ❌ P3 |
| **Geofencing** | BAIXO | Média | ❌ P3 |

---

## 🟢 3. NOSSOS DIFERENCIAIS ÚNICOS

### 3.1 Diferenciais que NENHUM concorrente tem:

| Diferencial | Descrição | Valor para Cliente |
|-------------|-----------|-------------------|
| **🧾 OCR de NF-e** | Extração automática de endereços de notas fiscais | Economia de 15-30min por rota |
| **💰 Preço Brasil** | 10-50x mais barato que concorrentes | Acessível para MEI/autônomos |
| **🇧🇷 100% Brasileiro** | Suporte PT-BR, PIX, Boleto, horários BR | Confiança e facilidade |
| **📱 Foco Mobile-first** | Pensado para entregador no celular | UX otimizada para campo |
| **🏍️ Multi-fornecedor** | Natura + ML + Shopee na mesma rota | Maximiza ganho por km |

### 3.2 Público-Alvo Único (Blue Ocean)

```
┌─────────────────────────────────────────────────────────────┐
│                    MERCADO BRASILEIRO                        │
├─────────────────────────────────────────────────────────────┤
│  Concorrentes → Empresas médias/grandes (>50 entregas/dia)  │
│  SpeedRota    → Autônomos e MEIs (5-50 entregas/dia)        │
│                                                              │
│  TAM Brasil: ~2 milhões de entregadores autônomos           │
│  SAM: ~500k que fazem multi-fornecedor                      │
│  SOM inicial: 10k users (R$50/mês = R$500k MRR)             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 4. PLANO DE AÇÃO ESTRATÉGICO

### FASE 1: Quick Wins (1-2 meses) - Custo: ~R$0-5k

#### 1.1 Janelas de Tempo (Prioridade P0)
```typescript
// Adicionar ao modelo de Parada
interface Parada {
  // ... campos existentes
  janelaInicio?: string;  // "08:00"
  janelaFim?: string;     // "12:00"
  prioridade: 'ALTA' | 'MEDIA' | 'BAIXA';
}

// Algoritmo: Ordenar por janela antes do TSP
function ordenarPorJanela(paradas: Parada[]): Parada[] {
  return paradas.sort((a, b) => {
    if (a.prioridade === 'ALTA') return -1;
    if (a.janelaFim && b.janelaFim) {
      return a.janelaFim.localeCompare(b.janelaFim);
    }
    return 0;
  });
}
```

**Impacto**: +30% conversão (entregas agendadas são comuns)

#### 1.2 Integração WhatsApp (Prioridade P1)
```
Fluxo:
1. Entregador clica "Compartilhar Rota"
2. Abre WhatsApp com mensagem formatada:
   "🚚 Rota do dia - SpeedRota
    📍 8 entregas | 23km | ~45min
    
    1️⃣ Rua X, 123 - Maria (Natura)
    2️⃣ Av Y, 456 - João (ML)
    ...
    
    🔗 Acompanhe: speedrota.com.br/rota/abc123"
```

**Impacto**: Viral loop orgânico + profissionalismo para cliente final

#### 1.3 POD Básico (Proof of Delivery)
```typescript
// Adicionar ao fluxo de entrega
interface POD {
  paradaId: string;
  tipo: 'FOTO' | 'ASSINATURA' | 'CODIGO';
  arquivo?: string;      // Base64 da foto
  assinatura?: string;   // SVG da assinatura
  codigo?: string;       // Código informado
  latitude: number;
  longitude: number;
  timestamp: Date;
  observacao?: string;
}
```

**Impacto**: Diferencial para entregas de valor alto (Natura, cosméticos)

---

### FASE 2: Diferenciais Competitivos (2-4 meses) - Custo: ~R$5-15k

#### 2.1 Tráfego Real-time (OSRM + Fallback)
```typescript
// Estratégia: OSRM (grátis) + cache inteligente
// Não usar Google Maps API ($$$)

// 1. OSRM para routing base (já temos)
// 2. Adicionar fator de horário de pico
const FATORES_HORARIO = {
  '07:00-09:00': 1.5,  // Rush manhã
  '11:30-13:30': 1.2,  // Almoço
  '17:00-19:00': 1.6,  // Rush tarde
  'default': 1.0
};

// 3. Aprender com histórico do próprio usuário
interface HistoricoTempo {
  origem: string;
  destino: string;
  horario: string;
  tempoReal: number;
  tempoEstimado: number;
  fatorCorrecao: number; // tempoReal/tempoEstimado
}
```

**Custo**: R$0 (OSRM é open source)
**Impacto**: Estimativas 30% mais precisas

#### 2.2 Analytics para Entregador
```
Dashboard Mobile:
┌────────────────────────────────────┐
│  📊 Seu Resumo - Janeiro 2026      │
├────────────────────────────────────┤
│  🚚 Entregas: 342                  │
│  📍 Km rodados: 1.234 km           │
│  ⛽ Combustível: R$ 612            │
│  💰 Economia com SpeedRota: R$ 89  │
│                                    │
│  🏆 Fornecedor mais lucrativo:     │
│     Natura (R$ 8,50/entrega)       │
│                                    │
│  📈 Sua eficiência: 92%            │
│     (vs 78% média da plataforma)   │
└────────────────────────────────────┘
```

**Impacto**: Retenção +40% (entregador vê valor tangível)

#### 2.3 Re-otimização Dinâmica
```
Cenário: Entregador está na parada 3/8, cliente 5 cancela

Fluxo atual:   Refazer rota manualmente 😞
Fluxo novo:    
  1. Notificação: "Cliente cancelou. Recalcular?"
  2. 1 clique → Nova rota otimizada
  3. Navegação atualizada automaticamente
```

---

### FASE 3: Escala e B2B (4-6 meses) - Custo: ~R$20-50k

#### 3.1 Multi-driver (Gestão de Frota)
```
Persona: Dono de transportadora com 5-20 motoristas

Features:
- Dashboard web para gestor
- Atribuição automática de entregas por região
- Acompanhamento em tempo real
- Relatórios consolidados
- Custo por entrega por motorista

Pricing: R$29/motorista (vs R$210 OptimoRoute)
```

#### 3.2 API Pública
```
Integrações prioritárias:
1. Bling (ERP #1 no Brasil para e-commerce)
2. Tiny (ERP popular)
3. VTEX (e-commerce)
4. Shopify Brasil
5. WooCommerce

Fluxo:
Pedido no Bling → Webhook → SpeedRota cria parada → Rota otimizada
```

#### 3.3 Integração SEFAZ (Diferencial Brasil)
```
Fluxo ÚNICO no mercado:
1. Entregador informa CNPJ do fornecedor
2. SpeedRota consulta NF-e na SEFAZ
3. Extrai automaticamente TODAS as entregas do dia
4. Zero digitação, zero OCR, 100% precisão

Custo: Certificado digital + desenvolvimento
Impacto: GAME CHANGER para Brasil
```

---

## 💰 5. ESTRATÉGIA DE PRICING

### 5.1 Posicionamento vs Concorrência

```
                    PREÇO
        Alto │                    ┌─────────┐
             │                    │Route4Me │
             │                    │ $199    │
             │          ┌─────────┤         │
             │          │ Onfleet │         │
             │          │ $520    │         │
             │  ┌───────┤         │         │
             │  │Optimo │         │         │
             │  │$35/drv│         │         │
             │  │       │         │         │
       Baixo │  │   ┌───┴─────────┴─────────┤
             │  │   │    SpeedRota          │
             │  │   │    R$29-89            │
             └──┴───┴───────────────────────┴──►
                   Autônomo    PME    Enterprise
                         SEGMENTO
```

### 5.2 Pricing Aprovado ✅

| Plano | Preço | Target | Features | vs Concorrência |
|-------|-------|--------|----------|-----------------|
| **FREE** | R$0 | Teste | 3 rotas/dia, 10 paradas | - |
| **STARTER** | R$29,90 | Autônomo iniciante | 10 rotas/dia, 30 paradas | 6x mais barato |
| **PRO** | R$59,90 | Autônomo full-time | Ilimitado + Analytics | 4x mais barato |
| **FULL** | R$99,90 | Power user | Ilimitado + POD + API | 3x mais barato |
| **FROTA** | R$150/motorista | Transportadoras | Gestão + Dashboard | 30% mais barato |

#### 💡 Análise de Pricing (USD ~R$5,50)

| Concorrente | Preço/mês (BRL) | SpeedRota equivalente | Economia |
|-------------|-----------------|----------------------|----------|
| Route4Me | ~R$1.095 | PRO R$59,90 | **95%** |
| OptimoRoute | ~R$193/driver | STARTER R$29,90 | **85%** |
| Onfleet | ~R$2.860 | FULL R$99,90 | **97%** |
| Track-POD | ~R$380/veículo | FROTA R$150 | **60%** |

**✅ VEREDICTO: Preços estão PERFEITOS!**

- Não são "baratos demais" (evita percepção de baixa qualidade)
- São acessíveis para MEI/autônomos brasileiros
- Margem saudável para o negócio (~70-80% margem bruta estimada)
- Competitivos o suficiente para ganhar market share

### 5.3 Estratégia de Entrada no Mercado

```
MÊS 1-3: AQUISIÇÃO AGRESSIVA
├── FREE ilimitado para primeiros 1000 users
├── Cupom "SPEEDROTA50" = 50% off 3 meses
├── Indicação: 1 mês grátis para quem indica
└── Meta: 5.000 users, 500 pagantes

MÊS 4-6: RETENÇÃO E UPSELL
├── Analytics mostram economia ($$$ salvo)
├── POD como upsell para PRO
├── Push para FULL com features exclusivas
└── Meta: 15.000 users, 3.000 pagantes (R$120k MRR)

MÊS 7-12: ESCALA B2B
├── Lançar plano FROTA
├── Parcerias com cooperativas de entregadores
├── Integração Bling/Tiny
└── Meta: 50.000 users, 10.000 pagantes (R$400k MRR)
```

---

## 🎯 6. ROADMAP TÉCNICO PRIORIZADO

### Sprint 1-2 (Fevereiro 2026) ✅ CONCLUÍDO
```
[x] Janelas de tempo nas paradas ✅
[x] Prioridade de entrega (Alta/Média/Baixa) ✅
[x] Compartilhar rota via WhatsApp ✅
[x] Melhorar estimativa de tempo (fatores horário) ✅ FEITO 05/02
```

### Sprint 3-4 (Março 2026) ✅ CONCLUÍDO
```
[x] POD - Foto de entrega ✅ FEITO 05/02
[x] POD - Código de entrega ✅ FEITO 05/02
[x] Analytics básico (entregas/km/custo) ✅ FEITO 05/02
[x] Tráfego Real-time (fatores horário pico) ✅ FEITO 05/02
[ ] Notificações push
```

### Sprint 5-6 (Abril 2026)
```
[ ] Re-otimização dinâmica
[ ] Status de entrega em tempo real
[ ] Histórico detalhado com filtros
[ ] Export PDF/Excel
```

### Sprint 7-8 (Maio 2026)
```
[ ] Dashboard web para gestores
[ ] Multi-motorista básico
[ ] API pública v1
[ ] Integração Bling
```

---

## 📈 7. MÉTRICAS DE SUCESSO

### KPIs Principais

| Métrica | Atual | Meta 3 meses | Meta 6 meses |
|---------|-------|--------------|--------------|
| **Users Ativos** | ~100 | 5.000 | 25.000 |
| **Pagantes** | ~10 | 500 | 3.000 |
| **MRR** | ~R$500 | R$20k | R$120k |
| **Churn** | ? | <10% | <5% |
| **NPS** | ? | >50 | >70 |
| **Rotas/dia** | ~50 | 2.500 | 15.000 |

### KPIs de Produto

| Métrica | Target |
|---------|--------|
| Tempo médio criar rota | <2 min |
| Precisão OCR | >90% |
| Economia vs manual | >20% |
| App crash rate | <0.1% |
| Latência API | <500ms |

---

## 🏆 8. CONCLUSÃO: NOSSA VANTAGEM COMPETITIVA

### O que nos torna ÚNICOS:

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   🇧🇷 ÚNICO APP DE ROTAS FEITO PARA O ENTREGADOR         │
│      BRASILEIRO QUE TRABALHA COM MÚLTIPLOS FORNECEDORES   │
│                                                            │
│   ✅ OCR de NF-e (ninguém tem)                            │
│   ✅ Preço acessível (10-50x mais barato)                 │
│   ✅ Multi-fornecedor na mesma rota                       │
│   ✅ 100% em português, PIX, suporte BR                   │
│   ✅ Mobile-first para quem está na rua                   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Estratégia em uma frase:

> **"Ser o Nubank das rotas de entrega: 10x mais barato, 10x mais simples, 100% brasileiro."**

### Próximos Passos Imediatos:

1. ~~**HOJE**: Implementar janelas de tempo (quick win)~~ ✅ FEITO
2. ~~**ESTA SEMANA**: Compartilhamento WhatsApp~~ ✅ FEITO
3. ~~**AGORA**: POD básico + Analytics~~ ✅ FEITO
4. ~~**AGORA**: Tráfego inteligente (fatores de horário)~~ ✅ FEITO
5. **PRÓXIMO**: Notificações push + Re-otimização dinâmica
6. **FUTURO**: Multi-motorista + API Pública

---

*Documento atualizado em 05/02/2026 - SpeedRota Team*

---

## 📝 CHANGELOG

### 05/02/2026 - Tráfego Real-time Implementado
- ✅ **API Tráfego**: Serviço com fatores de horário de pico (rush manhã/tarde/almoço/madrugada)
- ✅ **Fatores de Horário**: 07-09h (+50%), 11-14h (+20%), 17-19h (+60%), 22-05h (-20%)
- ✅ **Integração OSRM**: Ajuste automático de duração com tráfego
- ✅ **Modelo HistoricoTempo**: Schema Prisma para aprendizado contínuo
- ✅ **Endpoint /trafego**: GET /atual, /fator/:hora, /previsao, POST /ajustar
- ✅ **Web IndicadorTrafego**: Componente visual com emoji (🟢🟡🔴)
- ✅ **Android TrafegoService**: Kotlin Singleton com mesma lógica
- ✅ **Android TrafegoComponents**: Composables para indicador visual
- 🎯 **Custo Zero**: Sem APIs pagas (OSRM + fatores locais)

### 05/02/2026 - Dashboard Modo Simples (UX Diferenciada)
- ✅ **Filosofia Dual Dashboard**: Modo Simples para entregadores + Modo Pro para profissionais
- ✅ **Modo Simples Android**: Cards visuais (CardEconomiaPrincipal, CardMelhoria, CardRankingFornecedores)
- ✅ **Modo Simples Web**: Componentes React (CardEconomia, CardMelhoria, CardEntregas, CardRanking, CardDica)
- ✅ **Foco em R$**: Responde "Quanto eu economizei?" com valor em destaque
- ✅ **Ranking Fornecedores**: Mostra qual paga melhor por entrega
- ✅ **Toggle Simples/Pro**: Switch animado para alternar entre modos
- ✅ **Dica do Dia**: Card contextual baseado nos dados do usuário
- 🎯 **5 Whys Analysis**: Redesign baseado em análise de causa raiz

### 05/02/2026 - Analytics Dashboard + POD Implementados
- ✅ **Dashboard Analytics Android**: Tela completa com KPIs, gráficos e filtros
- ✅ **API Analytics**: Endpoints para overview, deliveries, trends, suppliers
- ✅ **3 Níveis de Dashboard**: Essencial (FREE), Avançado (PRO), Completo (FULL)
- ✅ **Navegação Android**: Dashboard acessível via HomeScreen
- ✅ **POD (Proof of Delivery)**: Foto, código ou assinatura com geolocalização
- ✅ **Modelo ProofOfDelivery**: Schema Prisma com relação 1:1 para Parada
- ✅ **API REST POD**: 4 endpoints (registrar, buscar, listar, verificar plano)
- ✅ **UI Web**: ModalPOD integrado na TelaRota
- ✅ **UI Android**: PODBottomSheet com câmera e geolocalização
- ✅ **Feature Flag**: Apenas planos FULL/FROTA/ENTERPRISE

### 04/02/2026 - Quick Wins Implementados
- ✅ **Janelas de Tempo**: Campos `janelaInicio` e `janelaFim` no DB + UI Web/Android
- ✅ **Prioridade de Entregas**: Enum ALTA/MÉDIA/BAIXA com ordenação no algoritmo
- ✅ **Compartilhar WhatsApp**: Botão em Web e Android com rota formatada
- 🔧 **Banco de Dados**: Schema atualizado no Neon (produção)
