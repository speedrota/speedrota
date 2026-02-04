package br.com.speedrota.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.speedrota.data.model.UserData
import br.com.speedrota.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val email: String = "",
    val senha: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val isSuccess: Boolean = false
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    fun onEmailChange(email: String) {
        _uiState.value = _uiState.value.copy(email = email, error = null)
    }

    fun onSenhaChange(senha: String) {
        _uiState.value = _uiState.value.copy(senha = senha, error = null)
    }

    fun login() {
        val state = _uiState.value
        
        // Validação
        if (state.email.isBlank()) {
            _uiState.value = state.copy(error = "Digite seu email")
            return
        }
        if (state.senha.isBlank()) {
            _uiState.value = state.copy(error = "Digite sua senha")
            return
        }

        viewModelScope.launch {
            _uiState.value = state.copy(isLoading = true, error = null)
            
            authRepository.login(state.email, state.senha)
                .onSuccess { user ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isSuccess = true
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.message ?: "Erro ao fazer login"
                    )
                }
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}
