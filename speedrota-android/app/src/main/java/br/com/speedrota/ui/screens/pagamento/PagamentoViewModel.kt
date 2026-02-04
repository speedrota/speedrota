package br.com.speedrota.ui.screens.pagamento

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.speedrota.data.local.PreferencesManager
import br.com.speedrota.data.repository.PagamentoRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PagamentoUiState(
    val valor: Double = 0.0,
    val qrCodeBase64: String = "",
    val codigoCopiaCola: String = "",
    val pagamentoId: String = "",
    val statusPagamento: String = "pending",
    val isLoading: Boolean = true,
    val isCopied: Boolean = false,
    val isPagamentoConfirmado: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class PagamentoViewModel @Inject constructor(
    private val pagamentoRepository: PagamentoRepository,
    private val preferencesManager: PreferencesManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(PagamentoUiState())
    val uiState: StateFlow<PagamentoUiState> = _uiState.asStateFlow()
    
    private var pollingJob: Job? = null

    fun gerarPix(plano: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            val email = preferencesManager.userEmail.first() ?: ""
            
            pagamentoRepository.gerarPix(plano, email)
                .onSuccess { response ->
                    _uiState.value = _uiState.value.copy(
                        valor = response.valor ?: getValorPlano(plano),
                        qrCodeBase64 = response.qrCodeBase64 ?: "",
                        codigoCopiaCola = response.copiaCola ?: "",
                        pagamentoId = response.pagamentoId ?: "",
                        isLoading = false
                    )
                    
                    // Iniciar polling do status
                    response.pagamentoId?.let { id ->
                        startPolling(id)
                    }
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.message ?: "Erro ao gerar PIX"
                    )
                }
        }
    }

    private fun getValorPlano(plano: String): Double {
        return when (plano.uppercase()) {
            "PRO" -> 29.90
            "FULL" -> 59.90
            else -> 0.0
        }
    }

    private fun startPolling(pagamentoId: String) {
        pollingJob?.cancel()
        pollingJob = viewModelScope.launch {
            repeat(60) { // Verifica por até 5 minutos (60 * 5s)
                delay(5000) // 5 segundos
                
                pagamentoRepository.verificarStatus(pagamentoId)
                    .onSuccess { response ->
                        _uiState.value = _uiState.value.copy(
                            statusPagamento = response.status ?: "pending"
                        )
                        
                        if (response.status == "approved") {
                            _uiState.value = _uiState.value.copy(
                                isPagamentoConfirmado = true
                            )
                            pollingJob?.cancel()
                            return@launch
                        }
                    }
            }
        }
    }

    fun setCopied() {
        _uiState.value = _uiState.value.copy(isCopied = true)
        
        viewModelScope.launch {
            delay(2000)
            _uiState.value = _uiState.value.copy(isCopied = false)
        }
    }

    override fun onCleared() {
        super.onCleared()
        pollingJob?.cancel()
    }
}
