package br.com.speedrota.ui.screens.previsao

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.speedrota.data.model.*
import br.com.speedrota.data.repository.MLRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import javax.inject.Inject

/**
 * ViewModel para Tela de Previsão de Demanda (ML)
 * 
 * DESIGN POR CONTRATO:
 * @pre Usuário autenticado
 * @post Carrega previsões, mapa de calor e insights
 * 
 * @author SpeedRota Team
 * @version 1.0.0
 */
@HiltViewModel
class PrevisaoViewModel @Inject constructor(
    private val repository: MLRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(PrevisaoUiState())
    val uiState: StateFlow<PrevisaoUiState> = _uiState.asStateFlow()

    init {
        carregarMapaCalor()
        carregarInsights()
        carregarMetricas()
    }

    /**
     * Busca previsão para uma zona específica
     * @pre zona com mínimo 5 dígitos
     * @post Atualiza uiState com previsão
     */
    fun buscarPrevisao(zona: String) {
        if (zona.length < 5) {
            _uiState.value = _uiState.value.copy(
                erro = "Informe um CEP válido (mínimo 5 dígitos)"
            )
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isLoading = true,
                erro = null
            )

            try {
                val response = repository.getPrevisaoDemanda(
                    zona = zona.take(5),
                    data = _uiState.value.dataSelecionada
                )

                if (response.success && response.data != null) {
                    _uiState.value = _uiState.value.copy(
                        previsao = response.data,
                        isLoading = false
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        erro = response.error ?: "Erro ao buscar previsão",
                        isLoading = false
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    erro = e.message ?: "Erro de conexão",
                    isLoading = false
                )
            }
        }
    }

    /**
     * Carrega mapa de calor de demanda
     */
    fun carregarMapaCalor(data: String? = null) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoadingMapa = true)

            try {
                val response = repository.getMapaCalor(
                    data ?: _uiState.value.dataSelecionada
                )

                if (response.success && response.data != null) {
                    _uiState.value = _uiState.value.copy(
                        zonasCalor = response.data.zonas,
                        isLoadingMapa = false
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoadingMapa = false)
            }
        }
    }

    /**
     * Carrega insights personalizados
     */
    private fun carregarInsights() {
        viewModelScope.launch {
            try {
                val response = repository.getInsightsML()

                if (response.success && response.data != null) {
                    _uiState.value = _uiState.value.copy(
                        insights = response.data
                    )
                }
            } catch (e: Exception) {
                // Silently fail - insights são opcionais
            }
        }
    }

    /**
     * Carrega métricas do modelo
     */
    private fun carregarMetricas() {
        viewModelScope.launch {
            try {
                val response = repository.getMetricasML()

                if (response.success && response.data != null) {
                    _uiState.value = _uiState.value.copy(
                        metricas = response.data
                    )
                }
            } catch (e: Exception) {
                // Silently fail - métricas são opcionais
            }
        }
    }

    /**
     * Atualiza data selecionada e recarrega dados
     */
    fun selecionarData(data: String) {
        _uiState.value = _uiState.value.copy(dataSelecionada = data)
        carregarMapaCalor(data)
        
        // Re-buscar previsão se já havia uma zona selecionada
        _uiState.value.previsao?.let { previsao ->
            buscarPrevisao(previsao.zona)
        }
    }

    /**
     * Limpa erros
     */
    fun limparErro() {
        _uiState.value = _uiState.value.copy(erro = null)
    }
}

/**
 * Estado da UI de Previsão
 */
data class PrevisaoUiState(
    val isLoading: Boolean = false,
    val isLoadingMapa: Boolean = false,
    val erro: String? = null,
    val dataSelecionada: String = LocalDate.now().plusDays(1)
        .format(DateTimeFormatter.ISO_LOCAL_DATE),
    val previsao: PrevisaoDemandaData? = null,
    val zonasCalor: List<ZonaCalor> = emptyList(),
    val insights: List<InsightML> = emptyList(),
    val metricas: MetricasML? = null
)
