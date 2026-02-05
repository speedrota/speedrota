package br.com.speedrota.data.util

import android.util.Log
import br.com.speedrota.data.model.*
import kotlin.math.roundToInt

/**
 * @description Serviço de Capacidade de Veículos para Android
 *
 * DESIGN POR CONTRATO:
 * @pre Tipo de veículo válido
 * @pre Carga com pesos e volumes >= 0
 * @post Validação retorna se cabe e percentuais
 *
 * FUNCIONALIDADES:
 * - Validação de capacidade local (offline)
 * - Cálculo de percentuais de ocupação
 * - Geração de alertas de sobrecarga
 * - Sugestão de veículo adequado
 *
 * CAPACIDADES PADRÃO (kg/volumes):
 * - MOTO: 10kg, 3 volumes
 * - BIKE: 8kg, 2 volumes
 * - CARRO: 150kg, 30 volumes
 * - VAN: 500kg, 80 volumes
 * - CAMINHAO_LEVE: 1500kg, 200 volumes
 * - CAMINHAO: 4000kg, 500 volumes
 */
object CapacidadeService {

    private const val TAG = "CapacidadeService"

    // ==========================================
    // CAPACIDADES PADRÃO POR TIPO DE VEÍCULO
    // ==========================================
    
    private val capacidadesPadrao = mapOf(
        TipoVeiculo.MOTO to CapacidadeVeiculo(
            tipo = TipoVeiculo.MOTO.name,
            capacidadeKg = 10.0,
            capacidadeVolumes = 3,
            capacidadeM3 = 0.05
        ),
        TipoVeiculo.BIKE to CapacidadeVeiculo(
            tipo = TipoVeiculo.BIKE.name,
            capacidadeKg = 8.0,
            capacidadeVolumes = 2,
            capacidadeM3 = 0.03
        ),
        TipoVeiculo.CARRO to CapacidadeVeiculo(
            tipo = TipoVeiculo.CARRO.name,
            capacidadeKg = 150.0,
            capacidadeVolumes = 30,
            capacidadeM3 = 0.8
        ),
        TipoVeiculo.VAN to CapacidadeVeiculo(
            tipo = TipoVeiculo.VAN.name,
            capacidadeKg = 500.0,
            capacidadeVolumes = 80,
            capacidadeM3 = 3.0
        ),
        TipoVeiculo.CAMINHAO_LEVE to CapacidadeVeiculo(
            tipo = TipoVeiculo.CAMINHAO_LEVE.name,
            capacidadeKg = 1500.0,
            capacidadeVolumes = 200,
            capacidadeM3 = 10.0
        ),
        TipoVeiculo.CAMINHAO to CapacidadeVeiculo(
            tipo = TipoVeiculo.CAMINHAO.name,
            capacidadeKg = 4000.0,
            capacidadeVolumes = 500,
            capacidadeM3 = 25.0
        )
    )

    // Limites de alerta
    private const val ALERTA_PESO_PERCENT = 80.0
    private const val CRITICO_PESO_PERCENT = 95.0
    private const val ALERTA_VOLUME_PERCENT = 85.0

    // ==========================================
    // FUNÇÕES PRINCIPAIS
    // ==========================================

    /**
     * Obtém capacidade padrão para um tipo de veículo
     * 
     * @pre tipo válido
     * @post CapacidadeVeiculo com valores padrão
     */
    fun getCapacidadePadrao(tipo: TipoVeiculo): CapacidadeVeiculo {
        return capacidadesPadrao[tipo] 
            ?: throw IllegalArgumentException("Tipo de veículo inválido: $tipo")
    }

    /**
     * Lista todos os tipos de veículo disponíveis
     */
    fun getTiposVeiculo(): List<TipoVeiculo> = TipoVeiculo.entries

    /**
     * Valida se carga cabe no veículo
     * 
     * @pre capacidade.capacidadeKg > 0
     * @pre carga.pesoKg >= 0, carga.volumes >= 0
     * @post ResultadoCapacidade com cabe, percentuais e alertas
     */
    fun validarCapacidade(
        capacidade: CapacidadeVeiculo,
        carga: CargaAtual
    ): ResultadoCapacidade {
        // Calcular percentuais
        val percentualPeso = if (capacidade.capacidadeKg > 0) {
            (carga.pesoKg / capacidade.capacidadeKg) * 100
        } else 0.0

        val percentualVolumes = if (capacidade.capacidadeVolumes > 0) {
            (carga.volumes.toDouble() / capacidade.capacidadeVolumes) * 100
        } else 0.0

        val percentualM3 = if (capacidade.capacidadeM3 != null && carga.m3 != null && capacidade.capacidadeM3 > 0) {
            (carga.m3 / capacidade.capacidadeM3) * 100
        } else null

        // Gerar alertas
        val alertas = mutableListOf<AlertaCapacidade>()

        // Alertas de peso
        when {
            percentualPeso > 100 -> alertas.add(
                AlertaCapacidade(
                    tipo = "PESO_EXCEDIDO",
                    mensagem = "Peso excede capacidade em ${(percentualPeso - 100).roundToInt()}%",
                    severidade = "CRITICO",
                    percentual = percentualPeso
                )
            )
            percentualPeso > CRITICO_PESO_PERCENT -> alertas.add(
                AlertaCapacidade(
                    tipo = "PESO_CRITICO",
                    mensagem = "Peso em nível crítico (${percentualPeso.roundToInt()}%)",
                    severidade = "ALTO",
                    percentual = percentualPeso
                )
            )
            percentualPeso > ALERTA_PESO_PERCENT -> alertas.add(
                AlertaCapacidade(
                    tipo = "PESO_ALERTA",
                    mensagem = "Peso em nível de alerta (${percentualPeso.roundToInt()}%)",
                    severidade = "MEDIO",
                    percentual = percentualPeso
                )
            )
        }

        // Alertas de volume
        when {
            percentualVolumes > 100 -> alertas.add(
                AlertaCapacidade(
                    tipo = "VOLUME_EXCEDIDO",
                    mensagem = "Volumes excedem capacidade em ${(percentualVolumes - 100).roundToInt()}%",
                    severidade = "CRITICO",
                    percentual = percentualVolumes
                )
            )
            percentualVolumes > ALERTA_VOLUME_PERCENT -> alertas.add(
                AlertaCapacidade(
                    tipo = "VOLUME_ALERTA",
                    mensagem = "Volumes em nível de alerta (${percentualVolumes.roundToInt()}%)",
                    severidade = "MEDIO",
                    percentual = percentualVolumes
                )
            )
        }

        // Calcular margens
        val margemPesoKg = maxOf(0.0, capacidade.capacidadeKg - carga.pesoKg)
        val margemVolumes = maxOf(0, capacidade.capacidadeVolumes - carga.volumes)

        val cabe = percentualPeso <= 100 && percentualVolumes <= 100

        Log.d(TAG, "Validação: cabe=$cabe, peso=${percentualPeso.roundToInt()}%, volumes=${percentualVolumes.roundToInt()}%")

        return ResultadoCapacidade(
            cabe = cabe,
            percentualPeso = percentualPeso,
            percentualVolumes = percentualVolumes,
            percentualM3 = percentualM3,
            alertas = alertas,
            margemPesoKg = margemPesoKg,
            margemVolumes = margemVolumes
        )
    }

    /**
     * Valida capacidade para um tipo de veículo (atalho)
     */
    fun validarCapacidadePorTipo(
        tipo: TipoVeiculo,
        carga: CargaAtual
    ): ResultadoCapacidade {
        val capacidade = getCapacidadePadrao(tipo)
        return validarCapacidade(capacidade, carga)
    }

    /**
     * Sugere veículo adequado para a carga
     * 
     * @post Retorna menor veículo que comporta a carga
     */
    fun sugerirVeiculo(carga: CargaAtual): TipoVeiculo? {
        // Ordenar por capacidade crescente
        val veiculosOrdenados = listOf(
            TipoVeiculo.BIKE,
            TipoVeiculo.MOTO,
            TipoVeiculo.CARRO,
            TipoVeiculo.VAN,
            TipoVeiculo.CAMINHAO_LEVE,
            TipoVeiculo.CAMINHAO
        )

        for (tipo in veiculosOrdenados) {
            val resultado = validarCapacidadePorTipo(tipo, carga)
            if (resultado.cabe && resultado.percentualPeso <= ALERTA_PESO_PERCENT) {
                Log.d(TAG, "Veículo sugerido: $tipo para carga de ${carga.pesoKg}kg e ${carga.volumes} volumes")
                return tipo
            }
        }

        Log.w(TAG, "Nenhum veículo comporta a carga")
        return null
    }

    /**
     * Calcula quantas entregas cabem no veículo
     * 
     * @pre pesoMedioPorEntrega > 0, volumesMedioPorEntrega > 0
     * @post Número máximo de entregas que cabem
     */
    fun calcularCapacidadeEntregas(
        tipo: TipoVeiculo,
        pesoMedioPorEntrega: Double,
        volumesMedioPorEntrega: Int
    ): Int {
        if (pesoMedioPorEntrega <= 0 || volumesMedioPorEntrega <= 0) {
            return 0
        }

        val capacidade = getCapacidadePadrao(tipo)

        val maximoPorPeso = (capacidade.capacidadeKg / pesoMedioPorEntrega).toInt()
        val maximoPorVolumes = capacidade.capacidadeVolumes / volumesMedioPorEntrega

        return minOf(maximoPorPeso, maximoPorVolumes)
    }

    /**
     * Gera resumo de ocupação para exibição
     */
    fun gerarResumoOcupacao(resultado: ResultadoCapacidade): String {
        val emoji = when {
            !resultado.cabe -> "🚫"
            resultado.percentualPeso > CRITICO_PESO_PERCENT -> "⚠️"
            resultado.percentualPeso > ALERTA_PESO_PERCENT -> "⚡"
            else -> "✅"
        }

        val status = when {
            !resultado.cabe -> "Excedido"
            resultado.percentualPeso > CRITICO_PESO_PERCENT -> "Crítico"
            resultado.percentualPeso > ALERTA_PESO_PERCENT -> "Alerta"
            else -> "OK"
        }

        return "$emoji Peso: ${resultado.percentualPeso.roundToInt()}% | Volumes: ${resultado.percentualVolumes.roundToInt()}% | $status"
    }
}
