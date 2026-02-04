package br.com.speedrota.data.model

import kotlinx.serialization.Serializable

// ==================== AUTH ====================

@Serializable
data class RegisterRequest(
    val nome: String,
    val email: String,
    val senha: String,
    val telefone: String? = null
)

@Serializable
data class LoginRequest(
    val email: String,
    val senha: String
)

@Serializable
data class AuthResponse(
    val success: Boolean = false,
    val data: AuthData? = null,
    val error: String? = null,
    val message: String? = null
)

@Serializable
data class AuthData(
    val user: UserData? = null,
    val token: String? = null
)

@Serializable
data class UserData(
    val id: String,
    val nome: String,
    val email: String,
    val plano: String,
    val telefone: String? = null,
    val rotasRestantes: Int? = null
)

@Serializable
data class UserResponse(
    val success: Boolean,
    val usuario: UserData? = null,
    val error: String? = null
)

// ==================== ROTAS ====================

@Serializable
data class Coordenada(
    val lat: Double,
    val lng: Double
)

@Serializable
data class Destino(
    val endereco: String,
    val coordenadas: Coordenada? = null,
    val fornecedor: String? = null,
    val ordem: Int? = null
)

@Serializable
data class CreateRotaRequest(
    val nome: String? = null,
    val origem: String,
    val destinos: List<Destino>
)

@Serializable
data class OtimizarRotaRequest(
    val origem: Coordenada,
    val destinos: List<Destino>
)

@Serializable
data class RotaResponse(
    val success: Boolean,
    val rota: RotaData? = null,
    val error: String? = null
)

@Serializable
data class RotaData(
    val id: String,
    val nome: String? = null,
    val origem: String,
    val destinos: List<Destino>,
    val distanciaTotal: Double? = null,
    val tempoEstimado: Int? = null,
    val custoEstimado: Double? = null,
    val criadaEm: String? = null
)

@Serializable
data class OtimizarRotaResponse(
    val success: Boolean,
    val rotaOtimizada: List<Destino>? = null,
    val metricas: MetricasRota? = null,
    val error: String? = null
)

@Serializable
data class MetricasRota(
    val distanciaTotal: Double,
    val tempoEstimado: Int,
    val custoEstimado: Double,
    val economiaPercentual: Double? = null
)

// ==================== PAGAMENTOS ====================

@Serializable
data class PixRequest(
    val plano: String, // "PRO" ou "FULL"
    val email: String
)

@Serializable
data class PixResponse(
    val success: Boolean,
    val qrCode: String? = null,
    val qrCodeBase64: String? = null,
    val copiaCola: String? = null,
    val valor: Double? = null,
    val pagamentoId: String? = null,
    val error: String? = null
)

@Serializable
data class StatusPagamentoResponse(
    val success: Boolean,
    val status: String? = null, // "pending", "approved", "rejected"
    val plano: String? = null,
    val error: String? = null
)

// ==================== FORNECEDORES ====================

enum class Fornecedor(
    val displayName: String,
    val emoji: String,
    val colorHex: Long
) {
    NATURA("Natura", "🌿", 0xFFFF6B00),
    AVON("Avon", "💄", 0xFFE91E8C),
    BOTICARIO("O Boticário", "🧴", 0xFF006B3F),
    MERCADO_LIVRE("Mercado Livre", "📦", 0xFFFFE600),
    SHOPEE("Shopee", "🛒", 0xFFEE4D2D),
    AMAZON("Amazon", "📦", 0xFFFF9900),
    OUTRO("Outro", "📍", 0xFF6B7280)
}

// ==================== PLANOS ====================

enum class Plano(
    val displayName: String,
    val rotasPorDia: Int,
    val destinosPorRota: Int,
    val preco: Double
) {
    FREE("Grátis", 2, 5, 0.0),
    PRO("Pro", 10, 20, 19.90),
    FULL("Full", 999, 50, 39.90)
}
