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
    val valorFormatado: String = "",
    val qrCodeBase64: String = "",
    val codigoCopiaCola: String = "",
    val paymentId: String = "",
    val statusPagamento: String = "pending",
    val isLoading: Boolean = false,
    val isCopied: Boolean = false,
    val isPagamentoConfirmado: Boolean = false,
    val error: String? = null,
    // Campos para checkout
    val checkoutUrl: String = "",
    val preferenceId: String = "",
    // Campos para cartão
    val publicKey: String = ""
)

@HiltViewModel
class PagamentoViewModel @Inject constructor(
    private val pagamentoRepository: PagamentoRepository,
    private val preferencesManager: PreferencesManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(PagamentoUiState())
    val uiState: StateFlow<PagamentoUiState> = _uiState.asStateFlow()
    
    private var pollingJob: Job? = null
    
    init {
        // Carregar public key do Mercado Pago
        carregarPublicKey()
    }
    
    private fun carregarPublicKey() {
        viewModelScope.launch {
            pagamentoRepository.obterPublicKey()
                .onSuccess { publicKey ->
                    _uiState.value = _uiState.value.copy(publicKey = publicKey)
                }
        }
    }

    /**
     * Gera PIX direto com QR Code
     * Este é o método principal para pagamento via PIX
     */
    fun gerarPix(plano: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isLoading = true, 
                error = null,
                qrCodeBase64 = "",
                codigoCopiaCola = ""
            )
            
            pagamentoRepository.criarPix(plano)
                .onSuccess { pixData ->
                    _uiState.value = _uiState.value.copy(
                        valor = pixData.valor,
                        valorFormatado = pixData.valorFormatado,
                        qrCodeBase64 = pixData.qrCodeBase64,
                        codigoCopiaCola = pixData.qrCode,
                        paymentId = pixData.paymentId,
                        statusPagamento = pixData.status,
                        isLoading = false
                    )
                    
                    // Iniciar polling do status
                    startPolling(pixData.paymentId)
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.message ?: "Erro ao gerar PIX"
                    )
                }
        }
    }
    
    /**
     * Cria preferência de pagamento e retorna URL do checkout
     * Usado como fallback ou para métodos não implementados
     */
    fun iniciarPagamento(plano: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            pagamentoRepository.criarPreferencia(plano)
                .onSuccess { preference ->
                    _uiState.value = _uiState.value.copy(
                        valor = getValorPlano(plano),
                        checkoutUrl = preference.initPoint,
                        preferenceId = preference.preferenceId,
                        isLoading = false
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.message ?: "Erro ao iniciar pagamento"
                    )
                }
        }
    }

    /**
     * Confirma upgrade após retorno do checkout
     */
    fun confirmarUpgrade(plano: String, paymentId: String? = null) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            
            pagamentoRepository.confirmarUpgrade(plano, paymentId)
                .onSuccess { upgradeData ->
                    _uiState.value = _uiState.value.copy(
                        isPagamentoConfirmado = true,
                        statusPagamento = "approved",
                        isLoading = false
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.message ?: "Erro ao confirmar upgrade"
                    )
                }
        }
    }
    
    /**
     * Verifica status de um pagamento específico
     */
    fun verificarPagamento(paymentId: String) {
        viewModelScope.launch {
            pagamentoRepository.verificarStatus(paymentId)
                .onSuccess { status ->
                    _uiState.value = _uiState.value.copy(
                        statusPagamento = status.status
                    )
                    
                    if (status.approved) {
                        _uiState.value = _uiState.value.copy(
                            isPagamentoConfirmado = true
                        )
                        pollingJob?.cancel()
                    }
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

    private fun startPolling(paymentId: String) {
        pollingJob?.cancel()
        pollingJob = viewModelScope.launch {
            repeat(120) { // Verifica por até 10 minutos (120 * 5s)
                delay(5000) // 5 segundos
                
                pagamentoRepository.verificarStatus(paymentId)
                    .onSuccess { response ->
                        _uiState.value = _uiState.value.copy(
                            statusPagamento = response.status
                        )
                        
                        if (response.approved) {
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
    
    fun resetState() {
        pollingJob?.cancel()
        _uiState.value = PagamentoUiState(publicKey = _uiState.value.publicKey)
    }

    override fun onCleared() {
        super.onCleared()
        pollingJob?.cancel()
    }
}
