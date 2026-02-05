package br.com.speedrota.data.util

/**
 * @description Serviço de Re-otimização Dinâmica (offline)
 *
 * CENÁRIOS INTELIGENTES:
 * 1. CANCELAMENTO - Cliente cancelou
 * 2. TRAFEGO_INTENSO - Congestionamento detectado
 * 3. ATRASO_ACUMULADO - Atrasado vs janela
 * 4. CLIENTE_AUSENTE - Não encontrado
 * 5. NOVO_PEDIDO_URGENTE - Nova entrega prioritária
 * 6. ENDERECO_INCORRETO - Não localizado
 * 7. REAGENDAMENTO - Nova janela solicitada
 *
 * DESIGN POR CONTRATO:
 * @pre Rota em andamento
 * @post Cenário identificado com sugestão de ação
 */

/**
 * Tipos de motivo para re-otimização
 */
enum class MotivoReotimizacao {
    CANCELAMENTO,
    TRAFEGO_INTENSO,
    ATRASO_ACUMULADO,
    CLIENTE_AUSENTE,
    NOVO_PEDIDO_URGENTE,
    ENDERECO_INCORRETO,
    REAGENDAMENTO
}

/**
 * Informações de um cenário
 */
data class CenarioInfo(
    val motivo: MotivoReotimizacao,
    val nome: String,
    val descricao: String,
    val icone: String,
    val requerParadaId: Boolean,
    val acaoAutomatica: String
)

/**
 * Resultado de uma re-otimização
 */
data class ReotimizacaoResult(
    val success: Boolean,
    val motivo: MotivoReotimizacao,
    val mensagem: String,
    val acaoTomada: String,
    val paradasAlteradas: Int,
    val novaDistanciaKm: Double? = null,
    val novoTempoMin: Double? = null,
    val economiaKm: Double? = null,
    val economiaMin: Double? = null
)

/**
 * Verificação de tráfego
 */
data class VerificacaoTrafego(
    val requerReotimizacao: Boolean,
    val fatorTrafego: Double,
    val periodo: String,
    val sugestao: String
)

/**
 * Verificação de atrasos
 */
data class VerificacaoAtrasos(
    val requerReotimizacao: Boolean,
    val paradasEmRisco: Int,
    val sugestao: String
)

/**
 * Service singleton para re-otimização
 */
object ReotimizacaoService {
    
    /**
     * Lista de cenários disponíveis (cache local)
     * @pre Nenhum
     * @post Lista de cenários retornada
     */
    val cenarios: List<CenarioInfo> = listOf(
        CenarioInfo(
            motivo = MotivoReotimizacao.CANCELAMENTO,
            nome = "Cancelamento",
            descricao = "Cliente cancelou o pedido",
            icone = "❌",
            requerParadaId = true,
            acaoAutomatica = "Remove parada e recalcula rota"
        ),
        CenarioInfo(
            motivo = MotivoReotimizacao.TRAFEGO_INTENSO,
            nome = "Tráfego Intenso",
            descricao = "Congestionamento detectado no trajeto",
            icone = "🚗",
            requerParadaId = false,
            acaoAutomatica = "Reordena priorizando janelas de tempo"
        ),
        CenarioInfo(
            motivo = MotivoReotimizacao.ATRASO_ACUMULADO,
            nome = "Atraso Acumulado",
            descricao = "Entregador está atrasado na rota",
            icone = "⏰",
            requerParadaId = false,
            acaoAutomatica = "Prioriza entregas com janela próxima de expirar"
        ),
        CenarioInfo(
            motivo = MotivoReotimizacao.CLIENTE_AUSENTE,
            nome = "Cliente Ausente",
            descricao = "Cliente não estava no local",
            icone = "🏠",
            requerParadaId = true,
            acaoAutomatica = "Move entrega para o final (tentativa posterior)"
        ),
        CenarioInfo(
            motivo = MotivoReotimizacao.NOVO_PEDIDO_URGENTE,
            nome = "Novo Pedido Urgente",
            descricao = "Nova entrega de alta prioridade",
            icone = "🚨",
            requerParadaId = false,
            acaoAutomatica = "Insere na melhor posição da rota"
        ),
        CenarioInfo(
            motivo = MotivoReotimizacao.ENDERECO_INCORRETO,
            nome = "Endereço Incorreto",
            descricao = "Não foi possível encontrar o endereço",
            icone = "📍",
            requerParadaId = true,
            acaoAutomatica = "Pula entrega e marca para verificação"
        ),
        CenarioInfo(
            motivo = MotivoReotimizacao.REAGENDAMENTO,
            nome = "Reagendamento",
            descricao = "Cliente solicitou outro horário",
            icone = "📅",
            requerParadaId = true,
            acaoAutomatica = "Atualiza janela e reordena rota"
        )
    )
    
    /**
     * Obtém cenário por motivo
     * @pre motivo válido
     * @post Cenário correspondente ou null
     */
    fun obterCenario(motivo: MotivoReotimizacao): CenarioInfo? {
        return cenarios.find { it.motivo == motivo }
    }
    
    /**
     * Verifica se deve sugerir re-otimização por tráfego
     * Usa TrafegoService para obter fator atual
     * 
     * @pre Nenhum
     * @post Sugestão baseada no fator de tráfego atual
     */
    fun verificarTrafegoLocal(): VerificacaoTrafego {
        val trafego = TrafegoService.obterFatorTrafegoAtual()
        val requer = trafego.fator >= 1.4
        
        return VerificacaoTrafego(
            requerReotimizacao = requer,
            fatorTrafego = trafego.fator,
            periodo = trafego.periodo.name,
            sugestao = if (requer) {
                "Recomendamos re-otimizar a rota devido ao tráfego intenso"
            } else {
                "Tráfego está normal, rota atual é adequada"
            }
        )
    }
    
    /**
     * Verifica entregas em risco de atraso
     * 
     * @pre paradasPendentes: lista de paradas com janelaFim
     * @post Quantidade de paradas com janela < 30min
     */
    fun verificarAtrasosLocal(
        paradasPendentes: List<Pair<String, String?>> // (id, janelaFim)
    ): VerificacaoAtrasos {
        val calendar = java.util.Calendar.getInstance()
        val horaAtual = calendar.get(java.util.Calendar.HOUR_OF_DAY) * 60 + 
                        calendar.get(java.util.Calendar.MINUTE)
        
        val emRisco = paradasPendentes.count { (_, janelaFim) ->
            janelaFim?.let {
                val parts = it.split(":")
                if (parts.size == 2) {
                    val fimMin = parts[0].toIntOrNull()?.times(60)?.plus(
                        parts[1].toIntOrNull() ?: 0
                    ) ?: 2400
                    fimMin - horaAtual in 0..30
                } else false
            } ?: false
        }
        
        val requer = emRisco > 0
        
        return VerificacaoAtrasos(
            requerReotimizacao = requer,
            paradasEmRisco = emRisco,
            sugestao = if (requer) {
                "$emRisco entrega(s) com janela prestes a expirar. Recomendamos re-otimizar."
            } else {
                "Todas as entregas estão dentro do prazo."
            }
        )
    }
    
    /**
     * Formata resultado para exibição
     * @pre Resultado válido
     * @post String formatada para UI
     */
    fun formatarResultado(result: ReotimizacaoResult): String {
        val partes = mutableListOf(result.mensagem, result.acaoTomada)
        
        result.economiaKm?.takeIf { it > 0 }?.let {
            partes.add("Economia: ${"%.1f".format(it)} km")
        }
        result.economiaMin?.takeIf { it > 0 }?.let {
            partes.add("Tempo: -${"%.0f".format(it)} min")
        }
        
        return partes.joinToString(" • ")
    }
}
