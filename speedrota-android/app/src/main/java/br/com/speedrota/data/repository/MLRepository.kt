package br.com.speedrota.data.repository

import br.com.speedrota.data.api.SpeedRotaApi
import br.com.speedrota.data.model.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository para Machine Learning (Previsão de Demanda)
 * 
 * DESIGN POR CONTRATO:
 * @pre Token JWT válido
 * @post Retorna dados de previsão/insights/métricas
 * 
 * @author SpeedRota Team
 * @version 1.0.0
 */
@Singleton
class MLRepository @Inject constructor(
    private val api: SpeedRotaApi
) {

    /**
     * Obtém previsão de demanda para uma zona
     * @pre zona com 5 dígitos
     * @post Previsão com confiança e fatores
     */
    suspend fun getPrevisaoDemanda(
        zona: String,
        data: String? = null,
        horaInicio: Int? = null,
        horaFim: Int? = null
    ): PrevisaoDemandaResponse {
        return api.getPrevisaoDemanda(
            zona = zona,
            data = data,
            horaInicio = horaInicio,
            horaFim = horaFim
        )
    }

    /**
     * Obtém mapa de calor de demanda
     * @post Lista de zonas com intensidade
     */
    suspend fun getMapaCalor(data: String? = null): MapaCalorResponse {
        return api.getMapaCalor(data)
    }

    /**
     * Lista insights personalizados
     */
    suspend fun getInsightsML(
        zona: String? = null,
        limite: Int? = null
    ): InsightsMLResponse {
        return api.getInsightsML(zona, limite)
    }

    /**
     * Obtém métricas do modelo ML
     */
    suspend fun getMetricasML(): MetricasMLResponse {
        return api.getMetricasML()
    }
}
