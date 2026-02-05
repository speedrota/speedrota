package br.com.speedrota.data.util

import java.time.LocalDateTime
import java.time.LocalTime
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Serviço de Tráfego Real-time
 *
 * ESTRATÉGIA (Zero Custo):
 * 1. Fatores de horário de pico (rush manhã/tarde)
 * 2. Aprendizado com histórico (futuro)
 * 3. Sem APIs externas pagas
 *
 * @pre Hora do sistema válida (0-23)
 * @post Fator de tráfego >= 0.8
 */
@Singleton
class TrafegoService @Inject constructor() {

    companion object {
        // Fatores de tráfego por período
        const val FATOR_PICO_MANHA = 1.5f
        const val FATOR_PICO_TARDE = 1.6f
        const val FATOR_ALMOCO = 1.2f
        const val FATOR_MADRUGADA = 0.8f
        const val FATOR_NORMAL = 1.0f
    }

    /**
     * Faixas de horário com seus fatores
     */
    private val faixasHorario = listOf(
        FaixaHorario(7, 9, FATOR_PICO_MANHA, "pico_manha", "Horário de pico manhã"),
        FaixaHorario(11, 14, FATOR_ALMOCO, "almoco", "Horário de almoço"),
        FaixaHorario(17, 19, FATOR_PICO_TARDE, "pico_tarde", "Horário de pico tarde"),
        FaixaHorario(22, 24, FATOR_MADRUGADA, "madrugada", "Madrugada"),
        FaixaHorario(0, 5, FATOR_MADRUGADA, "madrugada", "Madrugada"),
    )

    /**
     * Obtém o fator de tráfego para uma hora específica
     */
    fun obterFatorTrafego(hora: Int): FatorTrafego {
        val horaValida = hora.coerceIn(0, 23)

        for (faixa in faixasHorario) {
            if (horaValida >= faixa.inicio && horaValida < faixa.fim) {
                return FatorTrafego(
                    fator = faixa.fator,
                    periodo = faixa.periodo,
                    descricao = faixa.descricao
                )
            }
        }

        return FatorTrafego(
            fator = FATOR_NORMAL,
            periodo = "normal",
            descricao = "Trânsito normal"
        )
    }

    /**
     * Obtém o fator de tráfego atual
     */
    fun obterFatorTrafegoAtual(): FatorTrafego {
        val horaAtual = LocalDateTime.now().hour
        return obterFatorTrafego(horaAtual)
    }

    /**
     * Ajusta duração com base no tráfego atual
     */
    fun ajustarDuracaoComTrafego(
        duracaoMinutos: Int,
        hora: Int? = null
    ): AjusteTempo {
        val horaCalculo = hora ?: LocalDateTime.now().hour
        val (fator, periodo, _) = obterFatorTrafego(horaCalculo)

        return AjusteTempo(
            duracaoOriginal = duracaoMinutos,
            duracaoAjustada = (duracaoMinutos * fator).toInt(),
            fatorAplicado = fator,
            periodo = periodo
        )
    }

    /**
     * Obtém resumo do tráfego para UI
     */
    fun obterResumoTrafego(): ResumoTrafego {
        val (fator, _, descricao) = obterFatorTrafegoAtual()

        return when {
            fator <= 0.9f -> ResumoTrafego(
                status = StatusTrafego.LEVE,
                emoji = "🟢",
                descricao = "Trânsito leve",
                fatorAtual = fator
            )
            fator <= 1.3f -> ResumoTrafego(
                status = StatusTrafego.MODERADO,
                emoji = "🟡",
                descricao = "Trânsito moderado",
                fatorAtual = fator
            )
            else -> ResumoTrafego(
                status = StatusTrafego.INTENSO,
                emoji = "🔴",
                descricao = descricao,
                fatorAtual = fator
            )
        }
    }

    /**
     * Formata tempo com indicador de tráfego
     */
    fun formatarTempoComTrafego(duracaoMinutos: Int): TempoFormatado {
        val ajuste = ajustarDuracaoComTrafego(duracaoMinutos)

        val (emoji, cor) = when {
            ajuste.fatorAplicado >= 1.5f -> "🔴" to CorTrafego.VERMELHO
            ajuste.fatorAplicado >= 1.2f -> "🟡" to CorTrafego.AMARELO
            else -> "🟢" to CorTrafego.VERDE
        }

        return TempoFormatado(
            texto = formatarMinutos(ajuste.duracaoAjustada),
            textoOriginal = formatarMinutos(ajuste.duracaoOriginal),
            emoji = emoji,
            cor = cor,
            fator = ajuste.fatorAplicado
        )
    }

    private fun formatarMinutos(minutos: Int): String {
        val horas = minutos / 60
        val mins = minutos % 60
        return if (horas > 0) "${horas}h ${mins}min" else "${mins}min"
    }
}

/**
 * Data classes para Tráfego
 */
data class FaixaHorario(
    val inicio: Int,
    val fim: Int,
    val fator: Float,
    val periodo: String,
    val descricao: String
)

data class FatorTrafego(
    val fator: Float,
    val periodo: String,
    val descricao: String
)

data class AjusteTempo(
    val duracaoOriginal: Int,
    val duracaoAjustada: Int,
    val fatorAplicado: Float,
    val periodo: String
)

enum class StatusTrafego {
    LEVE, MODERADO, INTENSO
}

enum class CorTrafego {
    VERDE, AMARELO, VERMELHO
}

data class ResumoTrafego(
    val status: StatusTrafego,
    val emoji: String,
    val descricao: String,
    val fatorAtual: Float
)

data class TempoFormatado(
    val texto: String,
    val textoOriginal: String,
    val emoji: String,
    val cor: CorTrafego,
    val fator: Float
)
