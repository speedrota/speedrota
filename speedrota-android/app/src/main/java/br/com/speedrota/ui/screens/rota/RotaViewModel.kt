package br.com.speedrota.ui.screens.rota

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.speedrota.data.RotaDataHolder
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
    private val rotaRepository: RotaRepository,
    private val rotaDataHolder: RotaDataHolder
) : ViewModel() {

    private val _uiState = MutableStateFlow(RotaUiState())
    val uiState: StateFlow<RotaUiState> = _uiState.asStateFlow()

    init {
        // Carregar destinos do RotaDataHolder (vindos da tela de Destinos)
        carregarDestinosDoHolder()
    }

    /**
     * Carrega destinos do RotaDataHolder e calcula rota
     * @pre RotaDataHolder tem destinos preenchidos pela DestinosScreen
     * @post UI atualizada com rota otimizada ou erro
     */
    private fun carregarDestinosDoHolder() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            val destinosDoHolder = rotaDataHolder.destinos.value
            
            if (destinosDoHolder.isEmpty()) {
                android.util.Log.w("RotaViewModel", "Nenhum destino no holder - usando dados simulados")
                loadFallbackData()
                return@launch
            }
            
            android.util.Log.d("RotaViewModel", "Carregados ${destinosDoHolder.size} destinos do holder")
            
            // Converter DestinoItem para Destino (modelo da API)
            val destinos = destinosDoHolder.mapIndexed { index, item ->
                Destino(
                    endereco = item.endereco,
                    coordenadas = item.coordenadas,
                    fornecedor = item.fornecedor.name.lowercase(),
                    ordem = index,
                    janelaInicio = item.janelaInicio,
                    janelaFim = item.janelaFim,
                    prioridade = item.prioridade
                )
            }
            
            // Atualiza UI com destinos (por enquanto sem otimização real via API)
            // TODO: Chamar rotaRepository.otimizarRota() quando origem estiver disponível
            _uiState.value = _uiState.value.copy(
                destinosOtimizados = destinos,
                distanciaTotal = calcularDistanciaEstimada(destinos.size),
                tempoEstimado = calcularTempoEstimado(destinos.size),
                custoEstimado = calcularCustoEstimado(destinos.size),
                economiaPercentual = 15.0 + (destinos.size * 2.0), // Estimativa
                isLoading = false
            )
        }
    }
    
    /**
     * Calcula estimativas baseadas no número de destinos
     */
    private fun calcularDistanciaEstimada(numDestinos: Int): Double {
        // Estimativa: ~3km por destino em média urbana
        return numDestinos * 3.0
    }
    
    private fun calcularTempoEstimado(numDestinos: Int): Int {
        // Estimativa: ~15min por destino (deslocamento + entrega)
        return numDestinos * 15
    }
    
    private fun calcularCustoEstimado(numDestinos: Int): Double {
        // Estimativa: ~R$2 por destino (combustível)
        return numDestinos * 2.0
    }
    
    /**
     * Mostra erro quando não há destinos
     * @pre Chamado quando RotaDataHolder está vazio
     * @post UI mostra mensagem de erro orientando usuário
     */
    private fun loadFallbackData() {
        // NÃO usar dados fictícios - mostrar erro orientando o usuário
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isLoading = false,
                error = "Nenhum destino adicionado. Volte e adicione destinos via QR Code ou manualmente."
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
