package br.com.speedrota.ui.screens.matching

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
 * ViewModel para tela de Matching Caixa ↔ NF-e
 * 
 * Funcionalidades:
 * - Escanear foto de caixa (etiqueta)
 * - Processar OCR para extrair PED, REM, destinatário
 * - Executar matching automático
 * - Permitir match manual
 * - Gerar tag visual para identificação
 */
@HiltViewModel
class MatchingViewModel @Inject constructor(
    private val api: SpeedRotaApi
) : ViewModel() {
    
    data class CaixaEscaneada(
        val id: String,
        val pedido: String?,
        val remessa: String?,
        val destinatario: String?,
        val cep: String?,
        val itens: Int?,
        val pesoKg: Double?,
        val tagVisual: String?,
        val tagCor: Int?,
        val numeroCaixa: Int?,
        val totalCaixas: Int?,
        val statusMatch: String
    )
    
    data class Match(
        val caixaId: String,
        val paradaId: String,
        val score: Int,
        val tagVisual: String,
        val tagCor: Int,
        val destinatario: String,
        val endereco: String,
        val numeroCaixa: Int?,
        val totalCaixas: Int?
    )
    
    data class MatchingUiState(
        val isLoading: Boolean = false,
        val caixas: List<CaixaEscaneada> = emptyList(),
        val matches: List<Match> = emptyList(),
        val erro: String? = null,
        val matchesRealizados: Int = 0,
        val totalCaixas: Int = 0
    )
    
    private val _uiState = MutableStateFlow(MatchingUiState())
    val uiState: StateFlow<MatchingUiState> = _uiState.asStateFlow()
    
    private var rotaId: String? = null
    
    fun setRotaId(id: String) {
        rotaId = id
        carregarCaixas()
    }
    
    private fun carregarCaixas() {
        val id = rotaId ?: return
        
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            
            try {
                val response = api.listarCaixas(id)
                if (response.isSuccessful) {
                    val caixas = response.body()?.caixas?.map { c ->
                        CaixaEscaneada(
                            id = c.id,
                            pedido = c.pedido,
                            remessa = c.remessa,
                            destinatario = c.destinatario,
                            cep = c.cep,
                            itens = c.itens,
                            pesoKg = c.pesoKg,
                            tagVisual = c.tagVisual,
                            tagCor = c.tagCor,
                            numeroCaixa = c.numeroCaixa,
                            totalCaixas = c.totalCaixas,
                            statusMatch = c.statusMatch
                        )
                    } ?: emptyList()
                    
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        caixas = caixas,
                        totalCaixas = caixas.size
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        erro = "Erro ao carregar caixas"
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    erro = e.message ?: "Erro desconhecido"
                )
            }
        }
    }
    
    fun adicionarCaixa(fotoBase64: String) {
        val id = rotaId ?: return
        
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            
            try {
                val body = mapOf("fotoBase64" to fotoBase64)
                val response = api.adicionarCaixa(id, body)
                
                if (response.isSuccessful) {
                    carregarCaixas()
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        erro = "Erro ao processar caixa"
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
    
    fun executarMatching() {
        val id = rotaId ?: return
        
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, erro = null)
            
            try {
                val response = api.executarMatching(id)
                
                if (response.isSuccessful) {
                    val matches = response.body()?.matches?.map { m ->
                        Match(
                            caixaId = m.caixaId,
                            paradaId = m.paradaId,
                            score = m.score,
                            tagVisual = m.tagVisual,
                            tagCor = m.tagCor,
                            destinatario = m.destinatario ?: "",
                            endereco = m.endereco ?: "",
                            numeroCaixa = m.numeroCaixa,
                            totalCaixas = m.totalCaixas
                        )
                    } ?: emptyList()
                    
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        matches = matches,
                        matchesRealizados = matches.size
                    )
                    
                    carregarCaixas()
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        erro = "Erro ao executar matching"
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
    
    fun limparErro() {
        _uiState.value = _uiState.value.copy(erro = null)
    }
    
    companion object {
        val CORES_TAG = mapOf(
            1 to 0xFFf97316.toInt(), // Laranja
            2 to 0xFF22c55e.toInt(), // Verde
            3 to 0xFF3b82f6.toInt(), // Azul
            4 to 0xFFa855f7.toInt(), // Roxo
            5 to 0xFFec4899.toInt(), // Pink
            6 to 0xFFeab308.toInt(), // Amarelo
            7 to 0xFF14b8a6.toInt(), // Teal
            8 to 0xFFf43f5e.toInt()  // Vermelho
        )
    }
}
