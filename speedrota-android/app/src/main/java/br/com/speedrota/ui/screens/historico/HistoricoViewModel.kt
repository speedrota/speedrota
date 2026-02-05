package br.com.speedrota.ui.screens.historico

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.speedrota.data.model.RotaHistoricoItem
import br.com.speedrota.data.model.ResumoHistorico
import br.com.speedrota.data.repository.RotaRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject

data class FiltrosHistorico(
    val dataInicio: String = "",
    val dataFim: String = "",
    val fornecedor: String = "",
    val status: String = ""
)

data class HistoricoUiState(
    val isLoading: Boolean = true,
    val rotas: List<RotaHistoricoItem> = emptyList(),
    val resumo: ResumoHistorico? = null,
    val fornecedores: List<String> = emptyList(),
    val filtros: FiltrosHistorico = FiltrosHistorico(),
    val pagina: Int = 1,
    val totalPaginas: Int = 1,
    val error: String? = null
)

@HiltViewModel
class HistoricoViewModel @Inject constructor(
    private val rotaRepository: RotaRepository
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(HistoricoUiState())
    val uiState: StateFlow<HistoricoUiState> = _uiState.asStateFlow()
    
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    
    init {
        // Definir período padrão (últimos 30 dias)
        val hoje = Date()
        val trintaDiasAtras = Date(System.currentTimeMillis() - 30L * 24 * 60 * 60 * 1000)
        
        _uiState.value = _uiState.value.copy(
            filtros = FiltrosHistorico(
                dataInicio = dateFormat.format(trintaDiasAtras),
                dataFim = dateFormat.format(hoje)
            )
        )
        
        carregarFornecedores()
        carregarRotas()
    }
    
    fun carregarRotas() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            val filtros = _uiState.value.filtros
            
            rotaRepository.getHistoricoRotas(
                dataInicio = filtros.dataInicio.takeIf { it.isNotEmpty() },
                dataFim = filtros.dataFim.takeIf { it.isNotEmpty() },
                fornecedor = filtros.fornecedor.takeIf { it.isNotEmpty() },
                status = filtros.status.takeIf { it.isNotEmpty() },
                pagina = _uiState.value.pagina
            ).onSuccess { response ->
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    rotas = response.data?.rotas ?: emptyList(),
                    resumo = response.data?.resumo,
                    totalPaginas = response.data?.paginacao?.totalPaginas ?: 1
                )
            }.onFailure { e ->
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Erro ao carregar histórico"
                )
            }
        }
    }
    
    fun carregarFornecedores() {
        viewModelScope.launch {
            rotaRepository.getHistoricoFornecedores()
                .onSuccess { response ->
                    _uiState.value = _uiState.value.copy(
                        fornecedores = response.data?.fornecedores ?: emptyList()
                    )
                }
        }
    }
    
    fun atualizarFiltros(novosFiltros: FiltrosHistorico) {
        _uiState.value = _uiState.value.copy(
            filtros = novosFiltros,
            pagina = 1 // Reset para primeira página
        )
        carregarRotas()
    }
    
    fun irParaPagina(pagina: Int) {
        if (pagina in 1.._uiState.value.totalPaginas) {
            _uiState.value = _uiState.value.copy(pagina = pagina)
            carregarRotas()
        }
    }
    
    fun formatarTempo(minutos: Double): String {
        return if (minutos < 60) {
            "${minutos.toInt()}min"
        } else {
            val h = (minutos / 60).toInt()
            val m = (minutos % 60).toInt()
            "${h}h${m}m"
        }
    }
}
