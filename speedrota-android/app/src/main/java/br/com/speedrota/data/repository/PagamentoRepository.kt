package br.com.speedrota.data.repository

import br.com.speedrota.data.api.SpeedRotaApi
import br.com.speedrota.data.model.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repositório de pagamentos
 * 
 * @description Gerencia pagamentos via Mercado Pago (PIX, Cartão, Checkout)
 * @pre Usuário autenticado
 * @post Pagamento processado, plano atualizado
 */
@Singleton
class PagamentoRepository @Inject constructor(
    private val api: SpeedRotaApi
) {
    
    /**
     * Lista planos disponíveis
     * @post Lista de planos com preços e recursos
     */
    suspend fun listarPlanos(): Result<List<PlanoInfo>> {
        return try {
            val response = api.listarPlanos()
            if (response.success && response.data != null) {
                Result.success(response.data)
            } else {
                Result.failure(Exception(response.error ?: "Erro ao listar planos"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Cria preferência de pagamento no Mercado Pago
     * @pre Plano válido (PRO ou FULL)
     * @post URL de checkout retornada
     */
    suspend fun criarPreferencia(plano: String): Result<PreferenceData> {
        return try {
            val response = api.criarPreferencia(PreferenceRequest(plano))
            if (response.success && response.data != null) {
                Result.success(response.data)
            } else {
                Result.failure(Exception(response.error ?: "Erro ao criar preferência"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Cria pagamento PIX direto
     * @pre Plano válido (PRO ou FULL)
     * @post QR Code PIX retornado para pagamento
     */
    suspend fun criarPix(plano: String): Result<PixDirectData> {
        return try {
            val response = api.criarPix(PreferenceRequest(plano))
            if (response.success && response.data != null) {
                Result.success(response.data)
            } else {
                Result.failure(Exception(response.error ?: "Erro ao gerar PIX"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Processa pagamento com cartão
     * @pre Token do cartão válido
     * @post Pagamento processado
     */
    suspend fun processarCartao(
        plano: String,
        token: String,
        paymentMethodId: String,
        installments: Int,
        email: String,
        cpf: String? = null
    ): Result<CardPaymentData> {
        return try {
            val request = CardPaymentRequest(
                plano = plano,
                token = token,
                paymentMethodId = paymentMethodId,
                installments = installments,
                email = email,
                identificationType = if (cpf != null) "CPF" else null,
                identificationNumber = cpf
            )
            val response = api.processarCartao(request)
            if (response.success && response.data != null) {
                Result.success(response.data)
            } else {
                Result.failure(Exception(response.error ?: "Erro ao processar cartão"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Confirma upgrade após pagamento
     * @pre Pagamento aprovado no Mercado Pago
     * @post Plano do usuário atualizado
     */
    suspend fun confirmarUpgrade(plano: String, paymentId: String? = null): Result<UpgradeData> {
        return try {
            val response = api.confirmarUpgrade(ConfirmUpgradeRequest(plano, paymentId))
            if (response.success && response.data != null) {
                Result.success(response.data)
            } else {
                Result.failure(Exception(response.error ?: "Erro ao confirmar upgrade"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Verifica status do pagamento
     * @pre ID do pagamento válido
     * @post Status atual (pending, approved, rejected)
     */
    suspend fun verificarStatus(paymentId: String): Result<PaymentStatusData> {
        return try {
            val response = api.verificarStatusPagamento(paymentId)
            if (response.success && response.data != null) {
                Result.success(response.data)
            } else {
                Result.failure(Exception(response.error ?: "Erro ao verificar status"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Obtém assinatura atual do usuário
     * @post Dados do plano atual e limites
     */
    suspend fun obterAssinatura(): Result<SubscriptionData> {
        return try {
            val response = api.obterAssinatura()
            if (response.success && response.data != null) {
                Result.success(response.data)
            } else {
                Result.failure(Exception(response.error ?: "Erro ao obter assinatura"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Obtém public key do Mercado Pago
     * @post Public key para SDK
     */
    suspend fun obterPublicKey(): Result<String> {
        return try {
            val response = api.obterPublicKey()
            if (response.success && response.data != null) {
                Result.success(response.data.publicKey)
            } else {
                Result.failure(Exception(response.error ?: "Erro ao obter public key"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
