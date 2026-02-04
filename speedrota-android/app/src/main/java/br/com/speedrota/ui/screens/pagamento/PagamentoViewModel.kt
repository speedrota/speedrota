package br.com.speedrota.ui.screens.pagamento

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.speedrota.data.local.PreferencesManager
import br.com.speedrota.data.payment.CardBrand
import br.com.speedrota.data.payment.MercadoPagoTokenizer
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
    val publicKey: String = "",
    // Estado do cartão
    val cardNumber: String = "",
    val cardholderName: String = "",
    val expirationDate: String = "",
    val securityCode: String = "",
    val cpf: String = "",
    val cardBrand: CardBrand = CardBrand.UNKNOWN,
    val isCardNumberValid: Boolean = false,
    val isExpirationValid: Boolean = false,
    val isCvvValid: Boolean = false,
    val isCpfValid: Boolean = false,
    val installments: Int = 1,
    val isProcessingCard: Boolean = false,
    // Google Pay
    val isGooglePayAvailable: Boolean = false,
    val isGooglePayLoading: Boolean = false,
    // Usuário
    val userEmail: String = ""
)

@HiltViewModel
class PagamentoViewModel @Inject constructor(
    private val pagamentoRepository: PagamentoRepository,
    private val preferencesManager: PreferencesManager,
    private val mercadoPagoTokenizer: MercadoPagoTokenizer
) : ViewModel() {

    private val _uiState = MutableStateFlow(PagamentoUiState())
    val uiState: StateFlow<PagamentoUiState> = _uiState.asStateFlow()
    
    private var pollingJob: Job? = null
    
    init {
        // Carregar public key do Mercado Pago
        carregarPublicKey()
        // Carregar email do usuário
        carregarEmailUsuario()
    }
    
    private fun carregarPublicKey() {
        viewModelScope.launch {
            pagamentoRepository.obterPublicKey()
                .onSuccess { publicKey ->
                    _uiState.value = _uiState.value.copy(publicKey = publicKey)
                }
        }
    }
    
    private fun carregarEmailUsuario() {
        viewModelScope.launch {
            val email = preferencesManager.userEmail.first() ?: ""
            _uiState.value = _uiState.value.copy(userEmail = email)
        }
    }
    
    // ==================== CARTÃO ====================
    
    /**
     * Atualiza número do cartão
     */
    fun updateCardNumber(number: String) {
        val formatted = mercadoPagoTokenizer.formatCardNumber(number)
        val brand = mercadoPagoTokenizer.identifyCardBrand(number)
        val isValid = mercadoPagoTokenizer.validateCardNumber(number)
        
        _uiState.value = _uiState.value.copy(
            cardNumber = formatted,
            cardBrand = brand,
            isCardNumberValid = isValid,
            error = null
        )
    }
    
    /**
     * Atualiza nome do titular
     */
    fun updateCardholderName(name: String) {
        _uiState.value = _uiState.value.copy(
            cardholderName = name.uppercase(),
            error = null
        )
    }
    
    /**
     * Atualiza data de expiração
     */
    fun updateExpirationDate(date: String) {
        val formatted = mercadoPagoTokenizer.formatExpiration(date)
        val parts = formatted.split("/")
        val isValid = if (parts.size == 2) {
            val month = parts[0].toIntOrNull() ?: 0
            val year = parts[1].toIntOrNull() ?: 0
            mercadoPagoTokenizer.validateExpiration(month, year)
        } else {
            false
        }
        
        _uiState.value = _uiState.value.copy(
            expirationDate = formatted,
            isExpirationValid = isValid,
            error = null
        )
    }
    
    /**
     * Atualiza CVV
     */
    fun updateSecurityCode(cvv: String) {
        val digits = cvv.filter { it.isDigit() }.take(4)
        val isValid = mercadoPagoTokenizer.validateCVV(digits, _uiState.value.cardBrand)
        
        _uiState.value = _uiState.value.copy(
            securityCode = digits,
            isCvvValid = isValid,
            error = null
        )
    }
    
    /**
     * Atualiza CPF
     */
    fun updateCpf(cpf: String) {
        val digits = cpf.filter { it.isDigit() }.take(11)
        val formatted = formatCpf(digits)
        val isValid = validateCpf(digits)
        
        _uiState.value = _uiState.value.copy(
            cpf = formatted,
            isCpfValid = isValid,
            error = null
        )
    }
    
    /**
     * Atualiza número de parcelas
     */
    fun updateInstallments(installments: Int) {
        _uiState.value = _uiState.value.copy(installments = installments)
    }
    
    /**
     * Verifica se o formulário do cartão é válido
     */
    fun isCardFormValid(): Boolean {
        val state = _uiState.value
        return state.isCardNumberValid &&
               state.cardholderName.length >= 3 &&
               state.isExpirationValid &&
               state.isCvvValid &&
               state.isCpfValid
    }
    
    /**
     * Processa pagamento com cartão
     */
    fun processarCartao(plano: String, email: String) {
        if (!isCardFormValid()) {
            _uiState.value = _uiState.value.copy(
                error = "Preencha todos os campos corretamente"
            )
            return
        }
        
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isProcessingCard = true,
                error = null
            )
            
            try {
                val state = _uiState.value
                val expParts = state.expirationDate.split("/")
                val month = expParts[0].toInt()
                val year = 2000 + expParts[1].toInt()
                
                // 1. Tokenizar cartão
                val cardData = MercadoPagoTokenizer.CardData(
                    cardNumber = state.cardNumber,
                    cardholderName = state.cardholderName,
                    expirationMonth = month,
                    expirationYear = year,
                    securityCode = state.securityCode,
                    identificationType = "CPF",
                    identificationNumber = state.cpf
                )
                
                val tokenResult = mercadoPagoTokenizer.createToken(
                    publicKey = state.publicKey,
                    cardData = cardData
                )
                
                tokenResult.onSuccess { tokenResponse ->
                    // 2. Enviar para API processar pagamento
                    val paymentResult = pagamentoRepository.processarCartao(
                        plano = plano,
                        token = tokenResponse.id,
                        paymentMethodId = state.cardBrand.paymentMethodId,
                        installments = state.installments,
                        email = email,
                        cpf = state.cpf.filter { it.isDigit() }
                    )
                    
                    paymentResult.onSuccess { paymentData ->
                        if (paymentData.approved) {
                            _uiState.value = _uiState.value.copy(
                                isPagamentoConfirmado = true,
                                statusPagamento = "approved",
                                isProcessingCard = false
                            )
                        } else {
                            _uiState.value = _uiState.value.copy(
                                statusPagamento = paymentData.status,
                                paymentId = paymentData.paymentId,
                                isProcessingCard = false,
                                error = getPaymentErrorMessage(paymentData.statusDetail)
                            )
                        }
                    }.onFailure { error ->
                        _uiState.value = _uiState.value.copy(
                            isProcessingCard = false,
                            error = error.message ?: "Erro ao processar pagamento"
                        )
                    }
                }.onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isProcessingCard = false,
                        error = error.message ?: "Erro ao tokenizar cartão"
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isProcessingCard = false,
                    error = e.message ?: "Erro inesperado"
                )
            }
        }
    }
    
    // ==================== GOOGLE PAY ====================
    
    /**
     * Define se Google Pay está disponível
     */
    fun setGooglePayAvailable(available: Boolean) {
        _uiState.value = _uiState.value.copy(isGooglePayAvailable = available)
    }
    
    /**
     * Processa pagamento do Google Pay
     */
    fun processarGooglePay(plano: String, token: String, email: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isGooglePayLoading = true,
                error = null
            )
            
            // O token do Google Pay vem pronto para usar
            val paymentResult = pagamentoRepository.processarCartao(
                plano = plano,
                token = token,
                paymentMethodId = "google_pay",
                installments = 1,
                email = email
            )
            
            paymentResult.onSuccess { paymentData ->
                if (paymentData.approved) {
                    _uiState.value = _uiState.value.copy(
                        isPagamentoConfirmado = true,
                        statusPagamento = "approved",
                        isGooglePayLoading = false
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        statusPagamento = paymentData.status,
                        isGooglePayLoading = false,
                        error = getPaymentErrorMessage(paymentData.statusDetail)
                    )
                }
            }.onFailure { error ->
                _uiState.value = _uiState.value.copy(
                    isGooglePayLoading = false,
                    error = error.message ?: "Erro ao processar Google Pay"
                )
            }
        }
    }

    // ==================== PIX ====================

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

    // ==================== UTILITÁRIOS ====================

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
    
    private fun formatCpf(cpf: String): String {
        return when {
            cpf.length <= 3 -> cpf
            cpf.length <= 6 -> "${cpf.take(3)}.${cpf.drop(3)}"
            cpf.length <= 9 -> "${cpf.take(3)}.${cpf.substring(3, 6)}.${cpf.drop(6)}"
            else -> "${cpf.take(3)}.${cpf.substring(3, 6)}.${cpf.substring(6, 9)}-${cpf.drop(9)}"
        }
    }
    
    private fun validateCpf(cpf: String): Boolean {
        if (cpf.length != 11) return false
        if (cpf.all { it == cpf[0] }) return false
        
        // Validação do primeiro dígito
        var sum = 0
        for (i in 0..8) {
            sum += cpf[i].digitToInt() * (10 - i)
        }
        var digit1 = 11 - (sum % 11)
        if (digit1 >= 10) digit1 = 0
        if (digit1 != cpf[9].digitToInt()) return false
        
        // Validação do segundo dígito
        sum = 0
        for (i in 0..9) {
            sum += cpf[i].digitToInt() * (11 - i)
        }
        var digit2 = 11 - (sum % 11)
        if (digit2 >= 10) digit2 = 0
        return digit2 == cpf[10].digitToInt()
    }
    
    private fun getPaymentErrorMessage(statusDetail: String?): String {
        return when (statusDetail) {
            "cc_rejected_bad_filled_card_number" -> "Número do cartão inválido"
            "cc_rejected_bad_filled_date" -> "Data de validade inválida"
            "cc_rejected_bad_filled_other" -> "Dados do cartão inválidos"
            "cc_rejected_bad_filled_security_code" -> "CVV inválido"
            "cc_rejected_blacklist" -> "Cartão não permitido"
            "cc_rejected_call_for_authorize" -> "Ligue para a operadora do cartão"
            "cc_rejected_card_disabled" -> "Cartão desabilitado"
            "cc_rejected_card_error" -> "Erro no cartão"
            "cc_rejected_duplicated_payment" -> "Pagamento duplicado"
            "cc_rejected_high_risk" -> "Pagamento recusado por segurança"
            "cc_rejected_insufficient_amount" -> "Saldo insuficiente"
            "cc_rejected_invalid_installments" -> "Parcelas inválidas"
            "cc_rejected_max_attempts" -> "Muitas tentativas. Tente outro cartão"
            "cc_rejected_other_reason" -> "Cartão recusado. Tente outro"
            else -> "Pagamento recusado. Tente novamente"
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
    
    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    override fun onCleared() {
        super.onCleared()
        pollingJob?.cancel()
    }
}
