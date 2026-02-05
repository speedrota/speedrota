package br.com.speedrota.ui.screens.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.speedrota.data.local.PreferencesManager
import br.com.speedrota.data.model.Plano
import br.com.speedrota.data.model.RotaData
import br.com.speedrota.data.repository.AuthRepository
import br.com.speedrota.data.repository.RotaRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HomeUiState(
    val userName: String = "",
    val userPlano: String = "FREE",
    val tipoUsuario: String = "ENTREGADOR",
    val rotasHoje: Int = 0,
    val rotasRestantes: Int = 2,
    val isLoading: Boolean = true,
    val error: String? = null
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val rotaRepository: RotaRepository,
    private val preferencesManager: PreferencesManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        loadUserData()
    }

    private fun loadUserData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            
            try {
                val userName = preferencesManager.userName.first() ?: ""
                val userPlano = preferencesManager.userPlano.first() ?: "FREE"
                val tipoUsuario = preferencesManager.userTipoUsuario.first() ?: "ENTREGADOR"
                
                val plano = Plano.entries.find { it.name == userPlano } ?: Plano.FREE
                
                _uiState.value = _uiState.value.copy(
                    userName = userName,
                    userPlano = userPlano,
                    tipoUsuario = tipoUsuario,
                    rotasRestantes = plano.rotasPorDia,
                    isLoading = false
                )
                
                // Buscar dados atualizados da API
                authRepository.getMe()
                    .onSuccess { user ->
                        val planoAtualizado = Plano.entries.find { it.name == user.plano } ?: Plano.FREE
                        _uiState.value = _uiState.value.copy(
                            userName = user.nome,
                            userPlano = user.plano,
                            tipoUsuario = user.tipoUsuario,
                            rotasRestantes = user.rotasRestantes ?: planoAtualizado.rotasPorDia
                        )
                    }
                
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message
                )
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
        }
    }

    fun refresh() {
        loadUserData()
    }
}
