package br.com.speedrota.data.payment

import android.app.Activity
import com.google.android.gms.wallet.*
import org.json.JSONArray
import org.json.JSONObject

/**
 * Utilitário para configuração do Google Pay
 * 
 * @description Configura o Google Pay para pagamentos via Mercado Pago
 * @pre API do Google Pay habilitada no projeto
 * @post Cliente pronto para processar pagamentos
 */
object GooglePayUtil {
    
    // Gateway do Mercado Pago
    private const val GATEWAY = "mercadopago"
    
    // Ambiente (TEST para desenvolvimento, PRODUCTION para produção)
    private val PAYMENTS_ENVIRONMENT = WalletConstants.ENVIRONMENT_TEST
    
    /**
     * Cria cliente do Google Pay
     */
    fun createPaymentsClient(activity: Activity): PaymentsClient {
        val walletOptions = Wallet.WalletOptions.Builder()
            .setEnvironment(PAYMENTS_ENVIRONMENT)
            .build()
        return Wallet.getPaymentsClient(activity, walletOptions)
    }
    
    /**
     * Verifica se o Google Pay está disponível
     */
    fun isReadyToPayRequest(): IsReadyToPayRequest {
        return IsReadyToPayRequest.fromJson(
            JSONObject()
                .put("apiVersion", 2)
                .put("apiVersionMinor", 0)
                .put("allowedPaymentMethods", JSONArray()
                    .put(baseCardPaymentMethod()))
                .toString()
        )
    }
    
    /**
     * Cria request de pagamento
     * @param priceInCents Valor em centavos
     * @param merchantId ID do comerciante no Mercado Pago
     */
    fun createPaymentDataRequest(
        priceInCents: Long,
        merchantId: String,
        merchantName: String = "SpeedRota"
    ): PaymentDataRequest {
        val price = "%.2f".format(priceInCents / 100.0)
        
        return PaymentDataRequest.fromJson(
            JSONObject()
                .put("apiVersion", 2)
                .put("apiVersionMinor", 0)
                .put("allowedPaymentMethods", JSONArray()
                    .put(cardPaymentMethod(merchantId)))
                .put("transactionInfo", JSONObject()
                    .put("totalPrice", price)
                    .put("totalPriceStatus", "FINAL")
                    .put("currencyCode", "BRL")
                    .put("countryCode", "BR"))
                .put("merchantInfo", JSONObject()
                    .put("merchantName", merchantName))
                .put("shippingAddressRequired", false)
                .put("emailRequired", true)
                .toString()
        )
    }
    
    /**
     * Configuração base do método de pagamento
     */
    private fun baseCardPaymentMethod(): JSONObject {
        return JSONObject()
            .put("type", "CARD")
            .put("parameters", JSONObject()
                .put("allowedAuthMethods", JSONArray()
                    .put("PAN_ONLY")
                    .put("CRYPTOGRAM_3DS"))
                .put("allowedCardNetworks", JSONArray()
                    .put("VISA")
                    .put("MASTERCARD")
                    .put("ELO")
                    .put("AMEX")))
    }
    
    /**
     * Método de pagamento com tokenização
     */
    private fun cardPaymentMethod(merchantId: String): JSONObject {
        return baseCardPaymentMethod()
            .put("tokenizationSpecification", JSONObject()
                .put("type", "PAYMENT_GATEWAY")
                .put("parameters", JSONObject()
                    .put("gateway", GATEWAY)
                    .put("gatewayMerchantId", merchantId)))
    }
    
    /**
     * Extrai token do resultado do Google Pay
     */
    fun extractPaymentToken(paymentData: PaymentData): String? {
        return try {
            val paymentMethodData = JSONObject(paymentData.toJson())
                .getJSONObject("paymentMethodData")
            
            paymentMethodData
                .getJSONObject("tokenizationData")
                .getString("token")
        } catch (e: Exception) {
            null
        }
    }
    
    /**
     * Extrai email do resultado do Google Pay
     */
    fun extractEmail(paymentData: PaymentData): String? {
        return try {
            JSONObject(paymentData.toJson()).getString("email")
        } catch (e: Exception) {
            null
        }
    }
}
