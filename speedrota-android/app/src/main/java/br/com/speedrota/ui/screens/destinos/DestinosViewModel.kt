package br.com.speedrota.ui.screens.destinos

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.speedrota.data.model.Coordenada
import br.com.speedrota.data.model.Destino
import br.com.speedrota.data.model.Fornecedor
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DestinoItem(
    val id: String = java.util.UUID.randomUUID().toString(),
    val endereco: String,
    val fornecedor: Fornecedor = Fornecedor.OUTRO,
    val coordenadas: Coordenada? = null,
    val confianca: Float = 0f,
    // Novos campos - janela de tempo e prioridade
    val janelaInicio: String? = null,
    val janelaFim: String? = null,
    val prioridade: String = "MEDIA" // "ALTA", "MEDIA", "BAIXA"
)

data class DestinosUiState(
    val destinos: List<DestinoItem> = emptyList(),
    val isProcessingOcr: Boolean = false,
    val isCameraOpen: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class DestinosViewModel @Inject constructor(
    private val rotaDataHolder: br.com.speedrota.data.RotaDataHolder
) : ViewModel() {

    private val _uiState = MutableStateFlow(DestinosUiState())
    val uiState: StateFlow<DestinosUiState> = _uiState.asStateFlow()
    
    init {
        // Carregar destinos pendentes do RotaDataHolder (pode vir do QrCodeScanner)
        val destinosPendentes = rotaDataHolder.destinos.value
        if (destinosPendentes.isNotEmpty()) {
            _uiState.value = _uiState.value.copy(destinos = destinosPendentes)
            android.util.Log.d("DestinosViewModel", "Carregados ${destinosPendentes.size} destinos do holder")
        }
    }

    fun addDestino(
        endereco: String,
        fornecedor: Fornecedor = Fornecedor.OUTRO,
        janelaInicio: String? = null,
        janelaFim: String? = null,
        prioridade: String = "MEDIA"
    ) {
        if (endereco.isBlank()) return
        
        val novoDestino = DestinoItem(
            endereco = endereco,
            fornecedor = fornecedor,
            janelaInicio = janelaInicio,
            janelaFim = janelaFim,
            prioridade = prioridade
        )
        
        _uiState.value = _uiState.value.copy(
            destinos = _uiState.value.destinos + novoDestino
        )
    }

    fun removeDestino(id: String) {
        _uiState.value = _uiState.value.copy(
            destinos = _uiState.value.destinos.filter { it.id != id }
        )
    }

    fun updateDestino(id: String, endereco: String) {
        _uiState.value = _uiState.value.copy(
            destinos = _uiState.value.destinos.map { destino ->
                if (destino.id == id) destino.copy(endereco = endereco)
                else destino
            }
        )
    }

    fun setFornecedor(id: String, fornecedor: Fornecedor) {
        _uiState.value = _uiState.value.copy(
            destinos = _uiState.value.destinos.map { destino ->
                if (destino.id == id) destino.copy(fornecedor = fornecedor)
                else destino
            }
        )
    }

    fun openCamera() {
        _uiState.value = _uiState.value.copy(isCameraOpen = true)
    }

    fun closeCamera() {
        _uiState.value = _uiState.value.copy(isCameraOpen = false)
    }

    fun processOcrResult(text: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isProcessingOcr = true)
            
            try {
                // Extrair endereço do texto OCR
                val endereco = extractEnderecoFromOcr(text)
                
                if (endereco.isNotBlank()) {
                    addDestino(endereco)
                }
                
                _uiState.value = _uiState.value.copy(
                    isProcessingOcr = false,
                    isCameraOpen = false
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isProcessingOcr = false,
                    error = "Erro ao processar imagem"
                )
            }
        }
    }

    private fun extractEnderecoFromOcr(text: String): String {
        // Regex para encontrar padrões de endereço em NF-e
        val patterns = listOf(
            // Rua/Av + número
            """(?:Rua|R\.|Av\.|Avenida|Alameda|Al\.|Travessa|Tv\.)\s+[\w\s]+,?\s*\d+""".toRegex(RegexOption.IGNORE_CASE),
            // CEP
            """\d{5}-?\d{3}""".toRegex(),
            // Bairro - Cidade
            """[\w\s]+\s*-\s*[\w\s]+\s*-\s*[A-Z]{2}""".toRegex()
        )
        
        for (pattern in patterns) {
            val match = pattern.find(text)
            if (match != null) {
                return match.value.trim()
            }
        }
        
        return ""
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
    
    /**
     * Prepara os dados para calcular rota
     * Salva destinos no RotaDataHolder para serem consumidos pelo RotaViewModel
     * 
     * @return true se há destinos para calcular, false caso contrário
     */
    fun prepararParaCalcularRota(): Boolean {
        val destinos = _uiState.value.destinos
        if (destinos.isEmpty()) {
            _uiState.value = _uiState.value.copy(error = "Adicione pelo menos 1 destino")
            return false
        }
        
        // Salvar destinos no holder para RotaViewModel consumir
        rotaDataHolder.setDestinos(destinos)
        android.util.Log.d("DestinosViewModel", "Preparados ${destinos.size} destinos para rota")
        return true
    }

    fun getDestinosForApi(): List<Destino> {
        return _uiState.value.destinos.mapIndexed { index, item ->
            Destino(
                endereco = item.endereco,
                coordenadas = item.coordenadas,
                fornecedor = item.fornecedor.name.lowercase(),
                ordem = index
            )
        }
    }
}
