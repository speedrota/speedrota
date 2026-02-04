package br.com.speedrota.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.speedrota.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Etapas do fluxo de recuperação de senha
 */
enum class RecoveryStep {
    EMAIL,      // Inserir email
    CODE,       // Inserir código de 6 dígitos
    NEW_PASSWORD, // Inserir nova senha
    SUCCESS     // Senha redefinida com sucesso
}

/**
 * Estado da UI de recuperação de senha
 */
data class ForgotPasswordUiState(
    val step: RecoveryStep = RecoveryStep.EMAIL,
    val email: String = "",
    val code: String = "",
    val novaSenha: String = "",
    val confirmarSenha: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val successMessage: String? = null
)

/**
 * ViewModel para recuperação de senha
 * 
 * @description Gerencia o fluxo de recuperação de senha em 3 etapas
 * @pre AuthRepository injetado via Hilt
 * @post Senha redefinida quando fluxo completo
 */
@HiltViewModel
class ForgotPasswordViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(ForgotPasswordUiState())
    val uiState: StateFlow<ForgotPasswordUiState> = _uiState.asStateFlow()
    
    // ==================== INPUT HANDLERS ====================
    
    fun onEmailChange(email: String) {
        _uiState.update { it.copy(email = email, error = null) }
    }
    
    fun onCodeChange(code: String) {
        // Limita a 6 dígitos
        if (code.length <= 6 && code.all { it.isDigit() }) {
            _uiState.update { it.copy(code = code, error = null) }
        }
    }
    
    fun onNovaSenhaChange(senha: String) {
        _uiState.update { it.copy(novaSenha = senha, error = null) }
    }
    
    fun onConfirmarSenhaChange(senha: String) {
        _uiState.update { it.copy(confirmarSenha = senha, error = null) }
    }
    
    // ==================== ACTIONS ====================
    
    /**
     * Etapa 1: Solicita código de recuperação
     * @pre email válido
     * @post Código enviado por email, avança para etapa CODE
     */
    fun solicitarCodigo() {
        val email = _uiState.value.email.trim()
        
        if (email.isBlank()) {
            _uiState.update { it.copy(error = "Digite seu email") }
            return
        }
        
        if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            _uiState.update { it.copy(error = "Email inválido") }
            return
        }
        
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            
            authRepository.forgotPassword(email)
                .onSuccess { response ->
                    _uiState.update { 
                        it.copy(
                            isLoading = false, 
                            step = RecoveryStep.CODE,
                            successMessage = response.message
                        ) 
                    }
                }
                .onFailure { e ->
                    _uiState.update { 
                        it.copy(
                            isLoading = false, 
                            error = e.message ?: "Erro ao solicitar código"
                        ) 
                    }
                }
        }
    }
    
    /**
     * Etapa 2: Verifica código de 6 dígitos
     * @pre código com 6 dígitos
     * @post Código validado, avança para etapa NEW_PASSWORD
     */
    fun verificarCodigo() {
        val code = _uiState.value.code.trim()
        
        if (code.length != 6) {
            _uiState.update { it.copy(error = "Digite o código de 6 dígitos") }
            return
        }
        
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            
            authRepository.verifyResetCode(_uiState.value.email, code)
                .onSuccess {
                    _uiState.update { 
                        it.copy(
                            isLoading = false, 
                            step = RecoveryStep.NEW_PASSWORD
                        ) 
                    }
                }
                .onFailure { e ->
                    _uiState.update { 
                        it.copy(
                            isLoading = false, 
                            error = e.message ?: "Código inválido ou expirado"
                        ) 
                    }
                }
        }
    }
    
    /**
     * Etapa 3: Redefine a senha
     * @pre nova senha >= 6 chars e senhas coincidem
     * @post Senha redefinida, avança para SUCCESS
     */
    fun redefinirSenha() {
        val novaSenha = _uiState.value.novaSenha
        val confirmar = _uiState.value.confirmarSenha
        
        if (novaSenha.length < 6) {
            _uiState.update { it.copy(error = "Senha deve ter no mínimo 6 caracteres") }
            return
        }
        
        if (novaSenha != confirmar) {
            _uiState.update { it.copy(error = "As senhas não coincidem") }
            return
        }
        
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            
            authRepository.resetPassword(
                email = _uiState.value.email,
                code = _uiState.value.code,
                novaSenha = novaSenha
            )
                .onSuccess {
                    _uiState.update { 
                        it.copy(
                            isLoading = false, 
                            step = RecoveryStep.SUCCESS,
                            successMessage = "Senha redefinida com sucesso!"
                        ) 
                    }
                }
                .onFailure { e ->
                    _uiState.update { 
                        it.copy(
                            isLoading = false, 
                            error = e.message ?: "Erro ao redefinir senha"
                        ) 
                    }
                }
        }
    }
    
    /**
     * Volta para etapa anterior
     */
    fun voltar() {
        _uiState.update { state ->
            when (state.step) {
                RecoveryStep.CODE -> state.copy(step = RecoveryStep.EMAIL, code = "", error = null)
                RecoveryStep.NEW_PASSWORD -> state.copy(step = RecoveryStep.CODE, novaSenha = "", confirmarSenha = "", error = null)
                else -> state
            }
        }
    }
    
    /**
     * Reenviar código
     */
    fun reenviarCodigo() {
        _uiState.update { it.copy(code = "") }
        solicitarCodigo()
    }
    
    /**
     * Reseta o estado
     */
    fun reset() {
        _uiState.update { ForgotPasswordUiState() }
    }
}
