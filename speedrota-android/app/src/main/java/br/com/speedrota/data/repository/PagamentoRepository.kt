package br.com.speedrota.data.repository

import br.com.speedrota.data.api.SpeedRotaApi
import br.com.speedrota.data.model.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repositório de pagamentos
 * 
 * @description Gerencia pagamentos via PIX (Mercado Pago)
 * @pre Usuário autenticado
 * @post Pagamento processado, plano atualizado
 */
@Singleton
class PagamentoRepository @Inject constructor(
    private val api: SpeedRotaApi
) {
    
    /**
     * Gera QR Code PIX para pagamento
     * @pre Plano válido (PRO ou FULL)
     * @post QR Code e código copia/cola retornados
     */
    suspend fun gerarPix(plano: String, email: String): Result<PixResponse> {
        return try {
            val response = api.gerarPix(PixRequest(plano, email))
            
            if (response.success && response.qrCode != null) {
                Result.success(response)
            } else {
                Result.failure(Exception(response.error ?: "Erro ao gerar PIX"))
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
    suspend fun verificarStatus(pagamentoId: String): Result<StatusPagamentoResponse> {
        return try {
            val response = api.verificarStatusPagamento(pagamentoId)
            
            if (response.success) {
                Result.success(response)
            } else {
                Result.failure(Exception(response.error ?: "Erro ao verificar status"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
