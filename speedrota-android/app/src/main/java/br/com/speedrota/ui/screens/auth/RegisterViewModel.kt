package br.com.speedrota.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.speedrota.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class RegisterUiState(
    val nome: String = "",
    val email: String = "",
    val senha: String = "",
    val confirmarSenha: String = "",
    val telefone: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val isSuccess: Boolean = false
)

@HiltViewModel
class RegisterViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(RegisterUiState())
    val uiState: StateFlow<RegisterUiState> = _uiState.asStateFlow()

    fun onNomeChange(nome: String) {
        _uiState.value = _uiState.value.copy(nome = nome, error = null)
    }

    fun onEmailChange(email: String) {
        _uiState.value = _uiState.value.copy(email = email, error = null)
    }

    fun onSenhaChange(senha: String) {
        _uiState.value = _uiState.value.copy(senha = senha, error = null)
    }

    fun onConfirmarSenhaChange(confirmarSenha: String) {
        _uiState.value = _uiState.value.copy(confirmarSenha = confirmarSenha, error = null)
    }

    fun onTelefoneChange(telefone: String) {
        _uiState.value = _uiState.value.copy(telefone = telefone, error = null)
    }

    fun register() {
        val state = _uiState.value
        
        // Validação
        if (state.nome.isBlank()) {
            _uiState.value = state.copy(error = "Digite seu nome")
            return
        }
        if (state.email.isBlank()) {
            _uiState.value = state.copy(error = "Digite seu email")
            return
        }
        if (!android.util.Patterns.EMAIL_ADDRESS.matcher(state.email).matches()) {
            _uiState.value = state.copy(error = "Email inválido")
            return
        }
        if (state.senha.length < 6) {
            _uiState.value = state.copy(error = "Senha deve ter pelo menos 6 caracteres")
            return
        }
        if (state.senha != state.confirmarSenha) {
            _uiState.value = state.copy(error = "Senhas não conferem")
            return
        }

        viewModelScope.launch {
            _uiState.value = state.copy(isLoading = true, error = null)
            
            authRepository.register(
                nome = state.nome,
                email = state.email,
                senha = state.senha,
                telefone = state.telefone.takeIf { it.isNotBlank() }
            )
                .onSuccess { user ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isSuccess = true
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.message ?: "Erro ao cadastrar"
                    )
                }
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}
