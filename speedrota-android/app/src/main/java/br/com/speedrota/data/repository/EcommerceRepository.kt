package br.com.speedrota.data.repository

import br.com.speedrota.data.api.SpeedRotaApi
import br.com.speedrota.data.model.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository para E-commerce (VTEX + Shopify)
 * 
 * DESIGN POR CONTRATO:
 * @pre Token de autenticação válido
 * @post Dados de integrações e pedidos
 * 
 * @author SpeedRota Team
 * @version 1.0.0
 * @since Sprint 13-14
 */
@Singleton
class EcommerceRepository @Inject constructor(
    private val api: SpeedRotaApi
) {
    /**
     * Listar integrações
     * @pre Usuário autenticado
     * @post Lista de integrações configuradas
     */
    suspend fun getIntegracoes(): ApiResponse<List<Integracao>> {
        return try {
            val response = api.getIntegracoes()
            ApiResponse(
                success = true,
                data = response.data
            )
        } catch (e: Exception) {
            ApiResponse(
                success = false,
                error = e.message ?: "Erro ao carregar integrações"
            )
        }
    }

    /**
     * Criar integração
     * @pre Credenciais válidas
     * @post Integração criada
     */
    suspend fun criarIntegracao(dados: CriarIntegracaoRequest): ApiResponse<CriarIntegracaoResponse> {
        return try {
            val response = api.criarIntegracao(dados)
            ApiResponse(
                success = true,
                data = response.data
            )
        } catch (e: Exception) {
            ApiResponse(
                success = false,
                error = e.message ?: "Erro ao criar integração"
            )
        }
    }

    /**
     * Sincronizar pedidos
     * @pre Integração existe e está ativa
     * @post Pedidos importados
     */
    suspend fun sincronizar(integracaoId: String): ApiResponse<SincronizacaoResponse> {
        return try {
            val response = api.sincronizarIntegracao(integracaoId)
            ApiResponse(
                success = true,
                data = response.data
            )
        } catch (e: Exception) {
            ApiResponse(
                success = false,
                error = e.message ?: "Erro ao sincronizar"
            )
        }
    }

    /**
     * Listar pedidos de uma integração
     * @pre Integração existe
     * @post Lista de pedidos pendentes
     */
    suspend fun getPedidos(integracaoId: String): ApiResponse<List<PedidoImportado>> {
        return try {
            val response = api.getPedidosIntegracao(integracaoId)
            ApiResponse(
                success = true,
                data = response.data
            )
        } catch (e: Exception) {
            ApiResponse(
                success = false,
                error = e.message ?: "Erro ao carregar pedidos"
            )
        }
    }

    /**
     * Marcar pedidos como processados
     * @pre Pedidos existem
     * @post Pedidos marcados como processados
     */
    suspend fun processarPedidos(
        integracaoId: String,
        pedidoIds: List<String>,
        paradaId: String? = null
    ): ApiResponse<ProcessarPedidosResponse> {
        return try {
            val response = api.processarPedidos(
                integracaoId,
                ProcessarPedidosRequest(pedidoIds, paradaId)
            )
            ApiResponse(
                success = true,
                data = response.data
            )
        } catch (e: Exception) {
            ApiResponse(
                success = false,
                error = e.message ?: "Erro ao processar pedidos"
            )
        }
    }
}
