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

// ==================== PASSWORD RECOVERY ====================

@Serializable
data class ForgotPasswordRequest(
    val email: String
)

@Serializable
data class ForgotPasswordResponse(
    val success: Boolean,
    val message: String? = null,
    val resetCode: String? = null, // Apenas em dev
    val error: String? = null
)

@Serializable
data class VerifyResetCodeRequest(
    val email: String,
    val code: String
)

@Serializable
data class VerifyResetCodeResponse(
    val success: Boolean,
    val message: String? = null,
    val error: String? = null
)

@Serializable
data class ResetPasswordRequest(
    val email: String,
    val code: String,
    val novaSenha: String
)

@Serializable
data class ResetPasswordResponse(
    val success: Boolean,
    val message: String? = null,
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

// Request para criar preferência de pagamento
@Serializable
data class PreferenceRequest(
    val plano: String // "PRO" ou "FULL"
)

// Response da criação de preferência
@Serializable
data class PreferenceResponse(
    val success: Boolean,
    val data: PreferenceData? = null,
    val error: String? = null
)

@Serializable
data class PreferenceData(
    val preferenceId: String,
    val initPoint: String, // URL para checkout
    val sandboxInitPoint: String? = null
)

// Request para confirmar upgrade
@Serializable
data class ConfirmUpgradeRequest(
    val plano: String,
    val paymentId: String? = null
)

// Response de confirmação de upgrade
@Serializable
data class ConfirmUpgradeResponse(
    val success: Boolean,
    val data: UpgradeData? = null,
    val error: String? = null
)

@Serializable
data class UpgradeData(
    val plano: String,
    val mensagem: String
)

// Response do status do pagamento
@Serializable
data class PaymentStatusResponse(
    val success: Boolean,
    val data: PaymentStatusData? = null,
    val error: String? = null
)

@Serializable
data class PaymentStatusData(
    val id: Long? = null,
    val status: String, // "pending", "approved", "rejected"
    val statusDetail: String? = null,
    val approved: Boolean
)

// Response da assinatura atual
@Serializable
data class SubscriptionResponse(
    val success: Boolean,
    val data: SubscriptionData? = null,
    val error: String? = null
)

@Serializable
data class SubscriptionData(
    val plano: String,
    val expiraEm: String? = null,
    val ativo: Boolean,
    val rotasNoMes: Int,
    val limites: LimitesPlano
)

@Serializable
data class LimitesPlano(
    val rotasPorMes: Int? = null,
    val paradasPorRota: Int,
    val fornecedores: Int? = null,
    val historicosDias: Int,
    val pdfUpload: Boolean,
    val apiAccess: Boolean
)

// Response dos planos disponíveis
@Serializable
data class PlanosResponse(
    val success: Boolean,
    val data: List<PlanoInfo>? = null,
    val error: String? = null
)

@Serializable
data class PlanoInfo(
    val id: String,
    val nome: String,
    val preco: Double,
    val precoFormatado: String,
    val recursos: List<String>,
    val limites: LimitesPlano,
    val popular: Boolean? = false
)

// Response da public key
@Serializable
data class PublicKeyResponse(
    val success: Boolean,
    val data: PublicKeyData? = null,
    val error: String? = null
)

@Serializable
data class PublicKeyData(
    val publicKey: String
)

// ==================== PIX DIRETO ====================

// Response do PIX direto (novo endpoint)
@Serializable
data class PixDirectResponse(
    val success: Boolean,
    val data: PixDirectData? = null,
    val error: String? = null
)

@Serializable
data class PixDirectData(
    val paymentId: String,
    val qrCode: String, // Código copia e cola
    val qrCodeBase64: String, // Imagem base64 do QR Code
    val valor: Double,
    val valorFormatado: String,
    val expiracao: String? = null,
    val status: String
)

// ==================== CARTÃO ====================

// Request para pagamento com cartão
@Serializable
data class CardPaymentRequest(
    val plano: String, // "PRO" ou "FULL"
    val token: String, // Token do cartão gerado pelo SDK
    val paymentMethodId: String, // visa, mastercard, etc
    val installments: Int = 1,
    val email: String,
    val identificationType: String? = null, // CPF
    val identificationNumber: String? = null
)

// Response do pagamento com cartão
@Serializable
data class CardPaymentResponse(
    val success: Boolean,
    val data: CardPaymentData? = null,
    val error: String? = null
)

@Serializable
data class CardPaymentData(
    val paymentId: String,
    val status: String, // approved, rejected, pending
    val statusDetail: String? = null,
    val approved: Boolean
)

// ==================== LEGACY (mantido para compatibilidade) ====================

@Serializable
data class PixRequest(
    val plano: String,
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
