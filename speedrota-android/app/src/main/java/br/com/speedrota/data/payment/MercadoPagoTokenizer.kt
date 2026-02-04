package br.com.speedrota.data.payment

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Utilitário para tokenização de cartões do Mercado Pago
 * 
 * @description Gera tokens de cartão seguros para processamento
 * @pre Public Key do Mercado Pago configurada
 * @post Token gerado para uso único
 * @invariant Dados do cartão NUNCA são armazenados localmente
 */
@Singleton
class MercadoPagoTokenizer @Inject constructor(
    private val okHttpClient: OkHttpClient
) {
    private val json = Json { ignoreUnknownKeys = true }
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    
    companion object {
        private const val MP_API_URL = "https://api.mercadopago.com/v1"
    }
    
    /**
     * Dados do cartão para tokenização
     * 
     * @warning Esses dados NUNCA devem ser persistidos
     */
    data class CardData(
        val cardNumber: String,
        val cardholderName: String,
        val expirationMonth: Int,
        val expirationYear: Int,
        val securityCode: String,
        val identificationType: String = "CPF",
        val identificationNumber: String
    )
    
    /**
     * Resultado da tokenização
     */
    @Serializable
    data class TokenResponse(
        val id: String,
        val first_six_digits: String? = null,
        val last_four_digits: String? = null,
        val expiration_month: Int? = null,
        val expiration_year: Int? = null,
        val cardholder: CardHolder? = null,
        val date_created: String? = null,
        val date_last_updated: String? = null,
        val date_due: String? = null,
        val luhn_validation: Boolean? = null,
        val live_mode: Boolean? = null,
        val status: String? = null
    )
    
    @Serializable
    data class CardHolder(
        val name: String? = null,
        val identification: Identification? = null
    )
    
    @Serializable
    data class Identification(
        val type: String? = null,
        val number: String? = null
    )
    
    @Serializable
    data class ErrorResponse(
        val message: String? = null,
        val error: String? = null,
        val status: Int? = null,
        val cause: List<ErrorCause>? = null
    )
    
    @Serializable
    data class ErrorCause(
        val code: String? = null,
        val description: String? = null
    )
    
    /**
     * Gera token do cartão
     * 
     * @pre cardData com dados válidos, publicKey não vazia
     * @post Token de uso único para processamento
     * @throws TokenizationException se falhar
     */
    suspend fun createToken(
        publicKey: String,
        cardData: CardData
    ): Result<TokenResponse> = withContext(Dispatchers.IO) {
        try {
            val requestBody = """
                {
                    "card_number": "${cardData.cardNumber.replace(" ", "")}",
                    "cardholder": {
                        "name": "${cardData.cardholderName}",
                        "identification": {
                            "type": "${cardData.identificationType}",
                            "number": "${cardData.identificationNumber.replace(Regex("[^0-9]"), "")}"
                        }
                    },
                    "expiration_month": ${cardData.expirationMonth},
                    "expiration_year": ${cardData.expirationYear},
                    "security_code": "${cardData.securityCode}"
                }
            """.trimIndent()
            
            val request = Request.Builder()
                .url("$MP_API_URL/card_tokens?public_key=$publicKey")
                .post(requestBody.toRequestBody(jsonMediaType))
                .addHeader("Content-Type", "application/json")
                .build()
            
            val response = okHttpClient.newCall(request).execute()
            val responseBody = response.body?.string() ?: throw Exception("Resposta vazia")
            
            if (response.isSuccessful) {
                val tokenResponse = json.decodeFromString<TokenResponse>(responseBody)
                Result.success(tokenResponse)
            } else {
                val errorResponse = try {
                    json.decodeFromString<ErrorResponse>(responseBody)
                } catch (e: Exception) {
                    ErrorResponse(message = responseBody)
                }
                
                val errorMessage = errorResponse.cause?.firstOrNull()?.description
                    ?: errorResponse.message
                    ?: "Erro ao tokenizar cartão"
                
                Result.failure(Exception(errorMessage))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Erro de conexão: ${e.message}"))
        }
    }
    
    /**
     * Identifica a bandeira do cartão pelo número
     */
    fun identifyCardBrand(cardNumber: String): CardBrand {
        val number = cardNumber.replace(" ", "")
        
        return when {
            number.startsWith("4") -> CardBrand.VISA
            number.startsWith("5") && number.length >= 2 && 
                number[1] in '1'..'5' -> CardBrand.MASTERCARD
            number.startsWith("34") || number.startsWith("37") -> CardBrand.AMEX
            number.startsWith("636368") || number.startsWith("438935") ||
                number.startsWith("504175") || number.startsWith("451416") ||
                number.startsWith("636297") || number.startsWith("5067") ||
                number.startsWith("4576") || number.startsWith("4011") -> CardBrand.ELO
            number.startsWith("606282") || number.startsWith("3841") -> CardBrand.HIPERCARD
            else -> CardBrand.UNKNOWN
        }
    }
    
    /**
     * Valida número do cartão usando algoritmo de Luhn
     */
    fun validateCardNumber(cardNumber: String): Boolean {
        val number = cardNumber.replace(" ", "")
        if (number.length < 13 || number.length > 19) return false
        if (!number.all { it.isDigit() }) return false
        
        var sum = 0
        var alternate = false
        
        for (i in number.length - 1 downTo 0) {
            var digit = number[i].digitToInt()
            
            if (alternate) {
                digit *= 2
                if (digit > 9) digit -= 9
            }
            
            sum += digit
            alternate = !alternate
        }
        
        return sum % 10 == 0
    }
    
    /**
     * Valida data de expiração
     */
    fun validateExpiration(month: Int, year: Int): Boolean {
        if (month < 1 || month > 12) return false
        
        val currentYear = java.util.Calendar.getInstance().get(java.util.Calendar.YEAR)
        val currentMonth = java.util.Calendar.getInstance().get(java.util.Calendar.MONTH) + 1
        
        val fullYear = if (year < 100) 2000 + year else year
        
        return when {
            fullYear > currentYear -> true
            fullYear == currentYear && month >= currentMonth -> true
            else -> false
        }
    }
    
    /**
     * Valida CVV
     */
    fun validateCVV(cvv: String, brand: CardBrand): Boolean {
        return when (brand) {
            CardBrand.AMEX -> cvv.length == 4
            else -> cvv.length == 3
        } && cvv.all { it.isDigit() }
    }
    
    /**
     * Formata número do cartão com espaços
     */
    fun formatCardNumber(cardNumber: String): String {
        val number = cardNumber.replace(" ", "").take(19)
        return number.chunked(4).joinToString(" ")
    }
    
    /**
     * Formata validade
     */
    fun formatExpiration(expiration: String): String {
        val digits = expiration.replace("/", "").take(4)
        return if (digits.length > 2) {
            "${digits.take(2)}/${digits.drop(2)}"
        } else {
            digits
        }
    }
}

/**
 * Bandeiras de cartão suportadas
 */
enum class CardBrand(val displayName: String, val paymentMethodId: String) {
    VISA("Visa", "visa"),
    MASTERCARD("Mastercard", "master"),
    AMEX("American Express", "amex"),
    ELO("Elo", "elo"),
    HIPERCARD("Hipercard", "hipercard"),
    UNKNOWN("Desconhecido", "unknown")
}
