# Guia de Publicação na Google Play Store

## Arquivo de Release
- **Arquivo AAB:** `speedrota-v1.0.0.aab`
- **Version Code:** 1
- **Version Name:** 1.0.0
- **Data de Build:** Fevereiro 2026

## Pré-requisitos para Publicação

### 1. Conta de Desenvolvedor Google Play
- Acesse: https://play.google.com/console
- Taxa única de inscrição: $25 USD
- Preencha os dados de contato e aceite os termos

### 2. Informações Necessárias para o Cadastro

#### Dados do Aplicativo:
- **Nome:** SpeedRota
- **Descrição curta:** Otimize suas rotas de entrega com IA
- **Descrição completa:** 
  ```
  SpeedRota é o aplicativo definitivo para otimização de rotas de entrega.
  
  ✓ Rotas otimizadas com Inteligência Artificial
  ✓ Suporte a múltiplas paradas
  ✓ Integração com Google Maps
  ✓ OCR para leitura de endereços via PDF
  ✓ Histórico de rotas
  
  Planos disponíveis:
  • Pro: R$ 29,90/mês - Até 30 paradas por rota
  • Full: R$ 59,90/mês - Até 100 paradas por rota
  
  Economize tempo e combustível com rotas inteligentes!
  ```

#### Assets Necessários:
- Ícone do app: 512x512 px (PNG, 32-bit)
- Feature Graphic: 1024x500 px
- Screenshots: mínimo 2 (phone), recomendado 8
- Video promocional (opcional): link do YouTube

#### Categorização:
- **Categoria:** Mapas e Navegação ou Produtividade
- **Classificação etária:** Para todos (sem conteúdo restrito)

### 3. Configurações de Assinatura

A assinatura do app já está configurada com:
- **Keystore:** speedrota-release.keystore
- **Key Alias:** speedrota

**IMPORTANTE:** Guarde o arquivo keystore em local seguro! Você precisará dele para todas as atualizações futuras.

## Passos para Publicar

### Passo 1: Criar o App
1. Acesse Google Play Console
2. Clique em "Criar app"
3. Preencha nome, idioma padrão, tipo (App) e categoria
4. Aceite as declarações

### Passo 2: Configurar a Página do App
1. Vá em "Presença na loja" > "Página principal da loja"
2. Adicione descrições, ícone e screenshots
3. Preencha política de privacidade (obrigatório se coleta dados)

### Passo 3: Upload do AAB
1. Vá em "Produção" > "Criar nova versão"
2. Faça upload do arquivo `speedrota-v1.0.0.aab`
3. Adicione notas de versão
4. Revise e publique

### Passo 4: Política de Privacidade
- URL obrigatório se o app coleta dados pessoais
- Deve estar hospedado em URL público

### Passo 5: Questionário de Classificação
- Preencha o questionário de classificação etária (IARC)
- O app receberá classificação automática

### Passo 6: Configurar Preço e Países
1. Vá em "Preço" > Gratuito (com compras no app)
2. Selecione países de distribuição (Brasil)

### Passo 7: Revisão e Publicação
- Revise todos os campos obrigatórios
- Clique em "Enviar para revisão"
- Aguarde 1-7 dias para aprovação

## Configuração de Assinaturas In-App

Para configurar os planos Pro e Full:

1. Vá em "Monetização" > "Produtos" > "Assinaturas"
2. Crie as assinaturas:
   - **pro_monthly:** R$ 29,90/mês
   - **full_monthly:** R$ 59,90/mês

## Próximas Versões

Para atualizar o app:
1. Incremente o `versionCode` no `build.gradle.kts`
2. Atualize o `versionName` (ex: 1.0.1, 1.1.0, etc.)
3. Execute: `.\gradlew.bat bundleRelease`
4. Upload do novo AAB no Play Console

## Suporte

Em caso de dúvidas sobre a publicação:
- Documentação Google: https://support.google.com/googleplay/android-developer
- Help Center: https://support.google.com/googleplay/android-developer/answer/9859751
