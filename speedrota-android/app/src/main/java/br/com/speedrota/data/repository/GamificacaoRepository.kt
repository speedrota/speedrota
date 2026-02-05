package br.com.speedrota.data.repository

import br.com.speedrota.data.api.SpeedRotaApi
import br.com.speedrota.data.model.*
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository para Gamificação (Badges, Ranking, Conquistas)
 * 
 * DESIGN POR CONTRATO:
 * @pre Token JWT válido
 * @post Retorna dados de gamificação
 * 
 * @author SpeedRota Team
 * @version 1.0.0
 */
@Singleton
class GamificacaoRepository @Inject constructor(
    private val api: SpeedRotaApi
) {

    /**
     * Obtém perfil de gamificação do usuário
     * @post Nível, pontos, badges, ranking
     */
    suspend fun getPerfilGamificacao(): PerfilGamificacaoResponse {
        return api.getPerfilGamificacao()
    }

    /**
     * Lista todos os badges
     */
    suspend fun getBadges(): BadgesResponse {
        return api.getBadges()
    }

    /**
     * Lista badges de um tipo específico
     * @pre tipo válido (ENTREGAS, STREAK, etc.)
     */
    suspend fun getBadgesPorTipo(tipo: String): BadgesResponse {
        return api.getBadgesPorTipo(tipo)
    }

    /**
     * Obtém ranking semanal
     */
    suspend fun getRankingSemanal(): RankingResponse {
        return api.getRankingSemanal()
    }

    /**
     * Lista conquistas do usuário
     */
    suspend fun getConquistas(): ConquistasResponse {
        return api.getConquistas()
    }

    /**
     * Obtém resumo semanal de gamificação
     */
    suspend fun getResumoSemanal(): ResumoSemanalResponse {
        return api.getResumoSemanal()
    }

    /**
     * Obtém leaderboard global
     */
    suspend fun getLeaderboard(
        periodo: String? = null,
        limite: Int? = null
    ): LeaderboardResponse {
        return api.getLeaderboard(periodo, limite)
    }
}
