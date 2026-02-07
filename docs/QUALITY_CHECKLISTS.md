# SpeedRota - Checklists de Qualidade de Produção

Este documento define os checklists obrigatórios para código e dados em produção.
Baseado no **Guia Consolidado de Técnicas para Evoluir Prompts, Código e BI**.

---

## 📋 Checklist 1: Código Pronto para Produção

Antes de fazer merge em `main`:

### Obrigatório
- [ ] **TypeScript sem `any`** - Tipos explícitos em todo código
- [ ] **Interfaces em `src/types/`** - Tipos compartilhados centralizados
- [ ] **Tratamento de erros claro** - Mensagens úteis ao usuário
- [ ] **Loading states implementados** - Feedback visual durante operações
- [ ] **Testes para regra principal** - Mínimo 3: normal, borda, erro
- [ ] **Logs úteis** - Volume, tempo, etapas (console.info/warn)
- [ ] **Input validado** - Fail fast com mensagens claras
- [ ] **Sem duplicação óbvia** - Extrair funções/componentes
- [ ] **Funções < 30 linhas** - Quebrar se maior

### Design por Contrato (JSDoc obrigatório)
```typescript
/**
 * @description O que faz
 * @pre Pré-condições (inputs válidos)
 * @post Pós-condições (garantias do output)
 * @invariant Invariantes (o que nunca muda)
 * @throws Quando falha
 */
```

---

## 📊 Checklist 2: BI/Analytics Confiável

Para qualquer KPI ou dashboard:

### Definição
- [ ] **KPI definido e documentado** - Regra de negócio clara
- [ ] **Grain (granularidade) correto** - "Qual a menor unidade de verdade?"
- [ ] **Fórmula explícita** - Cálculo documentado

### Sanity Checks (obrigatório)
- [ ] **Ranges válidos** - Percentuais 0-100, distâncias positivas
- [ ] **Soma consistente** - Status breakdown == total
- [ ] **Valores impossíveis** - Detectar negativos, datas futuras
- [ ] **Duplicatas** - IDs únicos verificados

### Quality Gates
- [ ] **Taxa sucesso**: 0-100%
- [ ] **Economia TSP**: 0-50% (limite matemático)
- [ ] **Coordenadas**: lat [-90,90], lng [-180,180]
- [ ] **KM por rota**: 0-500 (máximo razoável)

---

## 🔍 Checklist 3: Sem Dados Mocados em Produção

### Verificações
- [ ] **Nenhum `Math.random()`** para dados de negócio
- [ ] **Nenhum array hardcoded** de usuários/rotas/entregas
- [ ] **Fetch da API real** - Não de constantes
- [ ] **Environment correto** - `VITE_API_URL` apontando para produção

### Padrões Válidos (NÃO são mocks)
✅ `CONSTANTES` - Configurações globais (velocidade, custo)
✅ `FORNECEDORES_CONFIG` - Mapeamento de fornecedores
✅ `FATORES_TRAFEGO` - Fatores de horário/dia

### Padrões Inválidos (NUNCA em produção)
❌ `const mockUsers = [...]`
❌ `const sampleRoutes = [...]`
❌ `Math.random() * 100` para KPIs
❌ `// TODO: replace with real data`

---

## 🛠️ Checklist 4: Code Review

### Perguntas Obrigatórias
1. [ ] **Entendo em < 1 min?** - Código claro e documentado
2. [ ] **Nomes claros?** - Variáveis e funções auto-explicativas
3. [ ] **Casos de borda tratados?** - Null, vazio, overflow
4. [ ] **Testes existem?** - Cobertura de regra principal
5. [ ] **Logs informativos?** - Sem secrets, com contexto
6. [ ] **Sem duplicação?** - DRY aplicado
7. [ ] **Performance ok?** - Sem N+1, loops otimizados
8. [ ] **Segurança ok?** - Input sanitizado, tokens protegidos

---

## 📈 Implementação de Sanity Checks

### Onde Aplicar
1. **Analytics endpoints** - `validateAnalyticsKPIs()`
2. **Frota dashboard** - `validateFrotaDashboard()`
3. **Delivery data** - `validateDeliveryData()`
4. **Coordenadas** - `validateCoordinates()`

### Como Usar
```typescript
import {
  validateAnalyticsKPIs,
  logSanityResult,
  withSanityCheck,
} from '../utils/sanityChecks.js';

// No endpoint
const sanityResult = validateAnalyticsKPIs(kpis);
logSanityResult('analytics/overview', sanityResult);

return {
  success: true,
  data: withSanityCheck('analytics/overview', () => sanityResult, responseData),
};
```

### Output
```json
{
  "success": true,
  "data": {
    "kpis": { "taxaSucesso": 85, "totalKm": 250 },
    "_sanityWarnings": ["economiaPercent (60) acima do máximo esperado (50)"]
  }
}
```

---

## 🔄 PDCA para Qualidade

### Plan
- Definir objetivo claro
- Estabelecer critérios de qualidade (este documento)
- Identificar riscos

### Do
- Implementar versão 1
- Aplicar checklists durante desenvolvimento

### Check
- Rodar testes
- Verificar sanity checks no log
- Comparar com critérios

### Act
- Corrigir problemas encontrados
- Padronizar solução (adicionar ao checklist)
- Documentar aprendizado

---

## 📁 Arquivos de Sanity Checks

| Arquivo | Propósito |
|---------|-----------|
| `speedrota-api/src/utils/sanityChecks.ts` | Funções de validação |
| `speedrota-api/src/tests/sanityChecks.test.ts` | Testes das validações |
| `speedrota/src/utils/validacao.ts` | Validações de frontend |
| `speedrota/src/test/validacao.test.ts` | Testes do frontend |

---

## 🚀 Próximos Passos

1. **Adicionar sanity checks** em mais endpoints
2. **Criar dashboard de qualidade** - Visualizar warnings
3. **Alertas automáticos** - Notificar quando sanity check falha
4. **Métricas de quality gates** - % de requests com warnings

---

*Última atualização: Fevereiro 2026*
*Baseado no Guia Consolidado de Qualidade*
