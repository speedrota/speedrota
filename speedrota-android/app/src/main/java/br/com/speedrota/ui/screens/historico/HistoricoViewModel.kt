package br.com.speedrota.ui.screens.historico

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.speedrota.data.model.RotaListItem
import br.com.speedrota.data.repository.RotaRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HistoricoUiState(
    val isLoading: Boolean = true,
    val rotas: List<RotaListItem> = emptyList(),
    val error: String? = null
)

@HiltViewModel
class HistoricoViewModel @Inject constructor(
    private val rotaRepository: RotaRepository
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(HistoricoUiState())
    val uiState: StateFlow<HistoricoUiState> = _uiState.asStateFlow()
    
    init {
        carregarRotas()
    }
    
    fun carregarRotas() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            rotaRepository.getRotas()
                .onSuccess { response ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        rotas = response.rotas
                    )
                }
                .onFailure { e ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = e.message ?: "Erro ao carregar histórico"
                    )
                }
        }
    }
}
