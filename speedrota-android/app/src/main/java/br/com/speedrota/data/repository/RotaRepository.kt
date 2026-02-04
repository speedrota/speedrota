package br.com.speedrota.data.repository

import br.com.speedrota.data.api.SpeedRotaApi
import br.com.speedrota.data.model.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repositório de rotas
 * 
 * @description Gerencia CRUD e otimização de rotas
 * @pre Usuário autenticado
 * @post Rotas persistidas na API
 */
@Singleton
class RotaRepository @Inject constructor(
    private val api: SpeedRotaApi
) {
    
    /**
     * Lista todas as rotas do usuário
     * @pre Token válido
     * @post Lista de rotas ordenada por data
     */
    suspend fun getRotas(): Result<List<RotaResponse>> {
        return try {
            val rotas = api.getRotas()
            Result.success(rotas)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Cria nova rota
     * @pre Origem e destinos válidos
     * @post Rota criada e salva
     */
    suspend fun createRota(
        nome: String?,
        origem: String,
        destinos: List<Destino>
    ): Result<RotaData> {
        return try {
            val response = api.createRota(CreateRotaRequest(nome, origem, destinos))
            
            if (response.success && response.rota != null) {
                Result.success(response.rota)
            } else {
                Result.failure(Exception(response.error ?: "Erro ao criar rota"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Otimiza rota usando algoritmo TSP
     * @pre Origem com coordenadas, destinos geocodificados
     * @post Destinos reordenados, métricas calculadas
     * @invariant Usa nearestNeighbor + haversineCorrigido (fator 1.4x)
     */
    suspend fun otimizarRota(
        origem: Coordenada,
        destinos: List<Destino>
    ): Result<OtimizarRotaResponse> {
        return try {
            val response = api.otimizarRota(OtimizarRotaRequest(origem, destinos))
            
            if (response.success) {
                Result.success(response)
            } else {
                Result.failure(Exception(response.error ?: "Erro ao otimizar rota"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
