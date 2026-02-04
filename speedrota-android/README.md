# SpeedRota Android

App Android nativo para otimização de rotas de entrega.

## Tecnologias

- **Kotlin** - Linguagem principal
- **Jetpack Compose** - UI declarativa moderna
- **Hilt** - Injeção de dependência
- **Retrofit** - Cliente HTTP
- **Room** - Persistência local (futuro)
- **DataStore** - Preferências
- **CameraX** - Captura de imagens
- **ML Kit** - OCR para notas fiscais
- **Google Maps** - Mapas e navegação

## Estrutura

```
app/src/main/java/br/com/speedrota/
├── SpeedRotaApp.kt          # Application class
├── MainActivity.kt          # Activity principal
├── data/
│   ├── api/                 # Interface Retrofit
│   ├── local/               # DataStore, Room
│   ├── model/               # DTOs e Models
│   └── repository/          # Repositories
├── di/                      # Módulos Hilt
└── ui/
    ├── navigation/          # NavHost e Screens
    ├── theme/               # Tema Compose
    └── screens/
        ├── auth/            # Login, Register
        ├── home/            # Tela inicial
        ├── origem/          # Definir origem
        ├── destinos/        # Lista de destinos
        ├── rota/            # Rota otimizada
        ├── planos/          # Planos de assinatura
        └── pagamento/       # Pagamento PIX
```

## Configuração

### 1. Clone e abra no Android Studio

```bash
cd speedrota-android
```

Abra a pasta no Android Studio Arctic Fox ou superior.

### 2. Configure as API Keys

Em `app/build.gradle.kts`, atualize:

```kotlin
buildConfigField("String", "MAPS_API_KEY", "\"SUA_GOOGLE_MAPS_KEY\"")
```

### 3. Sincronize o Gradle

O Android Studio vai baixar todas as dependências automaticamente.

### 4. Execute

- Conecte um dispositivo Android ou inicie um emulador
- Clique em Run (▶️)

## API

O app consome a API em produção:
- **Base URL**: `https://speedrota.onrender.com/api/v1/`

### Endpoints Principais

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | /auth/register | Criar conta |
| POST | /auth/login | Login |
| GET | /auth/me | Dados do usuário |
| POST | /rotas | Criar rota |
| POST | /rotas/otimizar | Otimizar rota |
| POST | /pagamentos/pix | Gerar PIX |

## Funcionalidades

- ✅ Login/Cadastro
- ✅ Definir origem (GPS ou manual)
- ✅ Adicionar destinos manualmente
- 🔄 OCR de notas fiscais (CameraX + ML Kit)
- ✅ Otimização de rota
- ✅ Navegação (Google Maps/Waze)
- ✅ Planos e pagamento PIX

## Build para Produção

```bash
./gradlew assembleRelease
```

O APK será gerado em `app/build/outputs/apk/release/`

## Publicar na Play Store

1. Gere uma keystore de assinatura
2. Configure em `app/build.gradle.kts`
3. Execute `./gradlew bundleRelease`
4. Faça upload do AAB no Google Play Console
