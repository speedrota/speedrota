package br.com.speedrota.ui.screens.rota

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.speedrota.data.model.Coordenada
import br.com.speedrota.data.model.Destino
import br.com.speedrota.data.repository.RotaRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class RotaUiState(
    val destinosOtimizados: List<Destino> = emptyList(),
    val distanciaTotal: Double = 0.0,
    val tempoEstimado: Int = 0,
    val custoEstimado: Double = 0.0,
    val economiaPercentual: Double = 0.0,
    val isLoading: Boolean = true,
    val error: String? = null
)

@HiltViewModel
class RotaViewModel @Inject constructor(
    private val rotaRepository: RotaRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(RotaUiState())
    val uiState: StateFlow<RotaUiState> = _uiState.asStateFlow()

    // Dados temporários para demonstração
    // Em produção, esses dados viriam da tela anterior via SavedStateHandle ou shared ViewModel
    init {
        loadMockData()
    }

    private fun loadMockData() {
        // Simula dados otimizados
        // Na implementação real, os destinos viriam da tela de destinos
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            
            // Simula delay de processamento
            kotlinx.coroutines.delay(1500)
            
            val mockDestinos = listOf(
                Destino(
                    endereco = "Rua das Flores, 123 - Pinheiros, São Paulo",
                    coordenadas = Coordenada(-23.5631, -46.6914),
                    fornecedor = "natura",
                    ordem = 1
                ),
                Destino(
                    endereco = "Av. Paulista, 1000 - Bela Vista, São Paulo",
                    coordenadas = Coordenada(-23.5614, -46.6558),
                    fornecedor = "mercado_livre",
                    ordem = 2
                ),
                Destino(
                    endereco = "Rua Augusta, 500 - Consolação, São Paulo",
                    coordenadas = Coordenada(-23.5534, -46.6558),
                    fornecedor = "shopee",
                    ordem = 3
                )
            )
            
            _uiState.value = _uiState.value.copy(
                destinosOtimizados = mockDestinos,
                distanciaTotal = 12.5,
                tempoEstimado = 45,
                custoEstimado = 7.35,
                economiaPercentual = 23.0,
                isLoading = false
            )
        }
    }

    fun otimizarRota(origem: Coordenada, destinos: List<Destino>) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            rotaRepository.otimizarRota(origem, destinos)
                .onSuccess { response ->
                    _uiState.value = _uiState.value.copy(
                        destinosOtimizados = response.rotaOtimizada ?: emptyList(),
                        distanciaTotal = response.metricas?.distanciaTotal ?: 0.0,
                        tempoEstimado = response.metricas?.tempoEstimado ?: 0,
                        custoEstimado = response.metricas?.custoEstimado ?: 0.0,
                        economiaPercentual = response.metricas?.economiaPercentual ?: 0.0,
                        isLoading = false
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.message ?: "Erro ao otimizar rota"
                    )
                }
        }
    }
    
    /**
     * Carrega uma rota do histórico pelo ID
     * @pre ID válido, rota existe
     * @post UI atualizada com dados da rota
     */
    fun carregarRotaPorId(id: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            rotaRepository.getRotaPorId(id)
                .onSuccess { rota ->
                    // Converter paradas para Destino
                    val destinos = rota.paradas?.map { parada ->
                        Destino(
                            endereco = parada.endereco,
                            coordenadas = Coordenada(parada.lat, parada.lng),
                            fornecedor = parada.fornecedor,
                            ordem = parada.ordem
                        )
                    } ?: emptyList()
                    
                    _uiState.value = _uiState.value.copy(
                        destinosOtimizados = destinos,
                        distanciaTotal = (rota.distanciaTotal ?: 0.0) / 1000, // metros para km
                        tempoEstimado = (rota.tempoEstimado ?: 0) / 60, // segundos para minutos
                        custoEstimado = 0.0, // Calcular se necessário
                        economiaPercentual = 0.0,
                        isLoading = false
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.message ?: "Erro ao carregar rota"
                    )
                }
        }
    }
}
