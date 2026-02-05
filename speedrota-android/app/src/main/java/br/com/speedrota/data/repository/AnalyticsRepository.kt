package br.com.speedrota.data.repository

import br.com.speedrota.data.api.SpeedRotaApi
import br.com.speedrota.data.model.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repositório de Analytics
 * 
 * @description Gerencia consultas de métricas e KPIs do dashboard
 * @pre Usuário autenticado
 * @post Dados de analytics conforme plano do usuário
 * @invariant FREE = 7d fixo, PRO+ = filtros de período
 */
@Singleton
class AnalyticsRepository @Inject constructor(
    private val api: SpeedRotaApi
) {
    
    /**
     * Busca overview com KPIs principais
     * @pre Token válido
     * @post KPIs calculados para o período
     */
    suspend fun getOverview(
        periodo: String = "30d",
        dataInicio: String? = null,
        dataFim: String? = null,
        fornecedor: String? = null
    ): Result<OverviewData> {
        return try {
            val response = api.getAnalyticsOverview(periodo, dataInicio, dataFim, fornecedor)
            if (response.success && response.data != null) {
                Result.success(response.data)
            } else {
                Result.failure(Exception(response.error ?: "Erro ao carregar overview"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Busca status das entregas
     * @pre Token válido
     * @post Breakdown por status + pieChartData
     */
    suspend fun getDeliveries(
        periodo: String = "30d",
        dataInicio: String? = null,
        dataFim: String? = null,
        fornecedor: String? = null
    ): Result<DeliveriesData> {
        return try {
            val response = api.getAnalyticsDeliveries(periodo, dataInicio, dataFim, fornecedor)
            if (response.success && response.data != null) {
                Result.success(response.data)
            } else {
                Result.failure(Exception(response.error ?: "Erro ao carregar entregas"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Busca tendências (PRO+)
     * @pre Token válido, plano PRO ou superior
     * @post Dados agrupados por dia/semana/mês
     */
    suspend fun getTrends(
        periodo: String = "30d",
        groupBy: String = "day"
    ): Result<TrendsData> {
        return try {
            val response = api.getAnalyticsTrends(periodo, groupBy)
            if (response.success && response.data != null) {
                Result.success(response.data)
            } else {
                Result.failure(Exception(response.error ?: "Erro ao carregar tendências"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Busca dados por fornecedor (PRO+)
     * @pre Token válido, plano PRO ou superior
     * @post Breakdown por fornecedor
     */
    suspend fun getSuppliers(
        periodo: String = "30d",
        dataInicio: String? = null,
        dataFim: String? = null
    ): Result<SuppliersData> {
        return try {
            val response = api.getAnalyticsSuppliers(periodo, dataInicio, dataFim)
            if (response.success && response.data != null) {
                Result.success(response.data)
            } else {
                Result.failure(Exception(response.error ?: "Erro ao carregar fornecedores"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
