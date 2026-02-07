package br.com.speedrota.ui.screens.escolhacarga

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.speedrota.data.api.SpeedRotaApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel para tela de Escolha de Carga
 * 
 * Decide entre:
 * - Baixar rota já preparada pelo armazenista
 * - Fazer separação manual (fotografar caixas e notas)
 */
@HiltViewModel
class EscolhaCargaViewModel @Inject constructor(
    private val api: SpeedRotaApi
) : ViewModel() {
    
    data class RotaPreparada(
        val id: String,
        val preparadaEm: String,
        val totalParadas: Int,
        val totalCaixas: Int,
        val caixasPreview: List<CaixaPreview>
    )
    
    data class CaixaPreview(
        val id: String,
        val tagVisual: String?,
        val tagCor: Int?,
        val destinatario: String?
    )
    
    data class EscolhaCargaUiState(
        val isLoading: Boolean = false,
        val rotasDisponiveis: List<RotaPreparada> = emptyList(),
        val baixando: Boolean = false,
        val rotaBaixada: String? = null,
        val erro: String? = null
    )
    
    private val _uiState = MutableStateFlow(EscolhaCargaUiState())
    val uiState: StateFlow<EscolhaCargaUiState> = _uiState.asStateFlow()
    
    init {
        buscarRotasPreparadas()
    }
    
    fun buscarRotasPreparadas() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, erro = null)
            
            try {
                val response = api.buscarRotasPreparadas()
                
                if (response.isSuccessful) {
                    val rotas = response.body()?.rotas?.map { r ->
                        RotaPreparada(
                            id = r.id,
                            preparadaEm = r.preparadaEm ?: "",
                            totalParadas = r.paradas?.size ?: 0,
                            totalCaixas = r.caixas?.size ?: 0,
                            caixasPreview = r.caixas?.take(6)?.map { c ->
                                CaixaPreview(
                                    id = c.id,
                                    tagVisual = c.tagVisual,
                                    tagCor = c.tagCor,
                                    destinatario = c.destinatario
                                )
                            } ?: emptyList()
                        )
                    } ?: emptyList()
                    
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        rotasDisponiveis = rotas
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        erro = "Erro ao buscar rotas"
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    erro = e.message
                )
            }
        }
    }
    
    fun baixarRota(rotaId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(baixando = true, erro = null)
            
            try {
                val response = api.baixarRota(rotaId)
                
                if (response.isSuccessful) {
                    _uiState.value = _uiState.value.copy(
                        baixando = false,
                        rotaBaixada = rotaId
                    )
                } else {
                    val erro = response.errorBody()?.string() ?: "Erro ao baixar rota"
                    _uiState.value = _uiState.value.copy(
                        baixando = false,
                        erro = erro
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    baixando = false,
                    erro = e.message
                )
            }
        }
    }
    
    fun limparErro() {
        _uiState.value = _uiState.value.copy(erro = null)
    }
    
    fun limparRotaBaixada() {
        _uiState.value = _uiState.value.copy(rotaBaixada = null)
    }
    
    companion object {
        val CORES_TAG = mapOf(
            1 to 0xFFf97316.toInt(),
            2 to 0xFF22c55e.toInt(),
            3 to 0xFF3b82f6.toInt(),
            4 to 0xFFa855f7.toInt(),
            5 to 0xFFec4899.toInt(),
            6 to 0xFFeab308.toInt(),
            7 to 0xFF14b8a6.toInt(),
            8 to 0xFFf43f5e.toInt()
        )
    }
}
