# 📋 POD (Proof of Delivery) - Contrato de Feature

## 1. Objetivo
Permitir que entregadores comprovem entregas com foto, assinatura ou código, 
gerando evidência auditável para resolução de disputas com fornecedores.

## 2. Decisão que isso suporta
- Entregador: "Posso provar que entreguei"
- Fornecedor (futuro): "Tenho evidência de entrega"
- SpeedRota: "Upsell para plano FULL"

## 3. Contexto
- Feature OPCIONAL (habilitada por plano: FULL, FROTA)
- Deve funcionar OFFLINE (sincronizar depois)
- Preparada para integração futura com APIs de fornecedores
- Armazenamento: Base64 local → Upload S3/Cloudinary (futuro)

## 4. Regras de Negócio

### 4.1 Tipos de POD
| Tipo | Obrigatório | Quando usar |
|------|-------------|-------------|
| FOTO | Sim | Padrão para todas entregas |
| ASSINATURA | Não | Entregas de valor alto |
| CODIGO | Não | Quando cliente informa código |

### 4.2 Validações (Pré-condições)
- `paradaId` deve existir e pertencer ao usuário
- `tipo` ∈ ['FOTO', 'ASSINATURA', 'CODIGO']
- Se tipo=FOTO: `fotoBase64` obrigatório, tamanho < 5MB
- Se tipo=ASSINATURA: `assinaturaBase64` obrigatório (SVG/PNG)
- Se tipo=CODIGO: `codigo` obrigatório, 4-20 caracteres
- `latitude` ∈ [-90, 90], `longitude` ∈ [-180, 180]
- `timestamp` não pode ser futuro

### 4.3 Pós-condições (Garantias)
- POD salvo com ID único
- Parada atualizada para status=ENTREGUE
- `entregueEm` preenchido com timestamp do POD
- Retorno inclui URL do comprovante (ou base64 se offline)

### 4.4 Invariantes
- 1 Parada pode ter no máximo 1 POD ativo
- POD não pode ser deletado (apenas marcado como inválido)
- Geolocalização sempre registrada (mesmo se imprecisa)

## 5. Interfaces TypeScript

### 5.1 Modelo de Dados (Prisma)
```prisma
model ProofOfDelivery {
  id            String   @id @default(uuid())
  paradaId      String   @unique @map("parada_id")
  
  // Tipo de comprovação
  tipo          TipoPOD
  
  // Dados conforme tipo
  fotoUrl       String?  @map("foto_url")      // URL S3 ou base64
  assinaturaUrl String?  @map("assinatura_url") // URL ou base64 SVG
  codigo        String?                         // Código informado
  
  // Geolocalização da confirmação
  latitude      Float
  longitude     Float
  precisaoGps   Float?   @map("precisao_gps")  // metros
  
  // Metadados
  timestamp     DateTime @default(now())
  observacao    String?
  
  // Auditoria
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  
  // Relacionamentos
  parada        Parada   @relation(fields: [paradaId], references: [id])
  
  @@map("proof_of_delivery")
}

enum TipoPOD {
  FOTO
  ASSINATURA
  CODIGO
}
```

### 5.2 Interface de Request (API)
```typescript
/**
 * @description Payload para registrar comprovante de entrega
 * @pre paradaId existe e pertence ao usuário autenticado
 * @pre parada.statusEntrega !== 'ENTREGUE' (não pode registrar 2x)
 * @pre tipo é válido e dados correspondentes estão presentes
 * @post POD criado, parada marcada como ENTREGUE
 */
interface RegistrarPODRequest {
  paradaId: string;
  tipo: 'FOTO' | 'ASSINATURA' | 'CODIGO';
  
  // Dados conforme tipo (apenas um obrigatório)
  fotoBase64?: string;       // Se tipo=FOTO
  assinaturaBase64?: string; // Se tipo=ASSINATURA
  codigo?: string;           // Se tipo=CODIGO
  
  // Geolocalização (obrigatório)
  latitude: number;
  longitude: number;
  precisaoGps?: number;
  
  // Opcional
  observacao?: string;
}
```

### 5.3 Interface de Response
```typescript
interface RegistrarPODResponse {
  success: true;
  pod: {
    id: string;
    paradaId: string;
    tipo: 'FOTO' | 'ASSINATURA' | 'CODIGO';
    url?: string;        // URL do arquivo (se upload concluído)
    timestamp: string;   // ISO 8601
    latitude: number;
    longitude: number;
  };
  parada: {
    id: string;
    statusEntrega: 'ENTREGUE';
    entregueEm: string;
  };
}
```

### 5.4 Erros Esperados
```typescript
type PODError = 
  | { code: 'PARADA_NAO_ENCONTRADA'; message: string }
  | { code: 'PARADA_JA_ENTREGUE'; message: string }
  | { code: 'TIPO_INVALIDO'; message: string }
  | { code: 'DADOS_FALTANDO'; message: string }
  | { code: 'ARQUIVO_MUITO_GRANDE'; message: string }
  | { code: 'GEOLOCALIZACAO_INVALIDA'; message: string }
  | { code: 'PLANO_NAO_PERMITE'; message: string };
```

## 6. Restrições
- ❌ NÃO assumir conexão com internet (deve funcionar offline)
- ❌ NÃO enviar base64 > 5MB (comprimir antes)
- ❌ NÃO permitir POD sem geolocalização
- ❌ NÃO deletar PODs (apenas invalidar)
- ✅ PERGUNTAR se dados faltam (não assumir)

## 7. Formato de Resposta
- API: JSON com estrutura padronizada
- Erros: HTTP 400/401/403/404 com body `{ error: PODError }`
- Sucesso: HTTP 201 com body `RegistrarPODResponse`

## 8. Critérios de Qualidade (Definition of Done)
- [ ] Testes unitários para validações (3 casos: normal, borda, erro)
- [ ] Testes de integração para API (create, get, error)
- [ ] Funciona offline (salva local, sincroniza depois)
- [ ] Compressão de imagem < 500KB
- [ ] UI responsiva (Web + Android)
- [ ] Feature flag por plano (FULL, FROTA)
- [ ] Logs de auditoria

## 9. Validações a Implementar (Sanity Checks)
- [ ] Tamanho base64 < 5MB antes de processar
- [ ] Coordenadas dentro de range válido
- [ ] Timestamp não futuro (max 5min tolerância)
- [ ] Parada pertence ao usuário autenticado
- [ ] Plano permite POD

## 10. Integrações Futuras (preparar, não implementar)
```typescript
// Interface para integração com fornecedores
interface PODIntegration {
  fornecedor: 'natura' | 'mercadolivre' | 'shopee';
  webhookUrl?: string;
  apiKey?: string;
  
  // Método para enviar POD ao fornecedor
  enviarComprovante(pod: ProofOfDelivery): Promise<{
    sucesso: boolean;
    protocoloFornecedor?: string;
    erro?: string;
  }>;
}
```

---

## Checklist de Code Review (usar após implementação)

- [ ] Entendo o que faz em < 1 min?
- [ ] Nomes claros?
- [ ] Casos de borda tratados?
- [ ] Há testes para regra principal?
- [ ] Logs/erros informativos?
- [ ] Sem duplicação óbvia?
- [ ] Performance: algum "N+1", loop desnecessário?
- [ ] Segurança: input validado? Base64 sanitizado?
- [ ] Feature flag funcionando?
- [ ] Funciona offline?

---

*Documento criado em 04/02/2026 seguindo Guia de Boas Práticas*
