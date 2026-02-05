package br.com.speedrota.ui.screens.gamificacao

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.speedrota.data.model.*
import br.com.speedrota.data.repository.GamificacaoRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel para Tela de Gamificação
 * 
 * DESIGN POR CONTRATO:
 * @pre Usuário autenticado
 * @post Carrega perfil, badges, ranking e resumo
 * 
 * @author SpeedRota Team
 * @version 1.0.0
 */
@HiltViewModel
class GamificacaoViewModel @Inject constructor(
    private val repository: GamificacaoRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(GamificacaoUiState())
    val uiState: StateFlow<GamificacaoUiState> = _uiState.asStateFlow()

    init {
        carregarPerfil()
        carregarBadges()
        carregarRanking()
        carregarResumoSemanal()
    }

    /**
     * Carrega perfil de gamificação
     */
    private fun carregarPerfil() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)

            try {
                val response = repository.getPerfilGamificacao()

                if (response.success && response.data != null) {
                    _uiState.value = _uiState.value.copy(
                        perfil = response.data,
                        isLoading = false
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    erro = e.message ?: "Erro ao carregar perfil",
                    isLoading = false
                )
            }
        }
    }

    /**
     * Carrega todos os badges ou de categoria específica
     */
    fun carregarBadges(categoria: String? = null) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isLoadingBadges = true,
                categoriaSelecionada = categoria
            )

            try {
                val response = if (categoria != null) {
                    repository.getBadgesPorTipo(categoria)
                } else {
                    repository.getBadges()
                }

                if (response.success && response.data != null) {
                    _uiState.value = _uiState.value.copy(
                        badges = response.data,
                        isLoadingBadges = false
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoadingBadges = false)
            }
        }
    }

    /**
     * Carrega ranking semanal
     */
    fun carregarRanking() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoadingRanking = true)

            try {
                val response = repository.getRankingSemanal()

                if (response.success && response.data != null) {
                    _uiState.value = _uiState.value.copy(
                        ranking = response.data,
                        isLoadingRanking = false
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoadingRanking = false)
            }
        }
    }

    /**
     * Carrega resumo semanal
     */
    private fun carregarResumoSemanal() {
        viewModelScope.launch {
            try {
                val response = repository.getResumoSemanal()

                if (response.success && response.data != null) {
                    _uiState.value = _uiState.value.copy(
                        resumoSemanal = response.data
                    )
                }
            } catch (e: Exception) {
                // Silently fail - resumo é opcional
            }
        }
    }

    /**
     * Seleciona aba ativa
     */
    fun selecionarAba(aba: AbaGamificacao) {
        _uiState.value = _uiState.value.copy(abaAtiva = aba)
    }

    /**
     * Limpa erros
     */
    fun limparErro() {
        _uiState.value = _uiState.value.copy(erro = null)
    }
}

/**
 * Estado da UI de Gamificação
 */
data class GamificacaoUiState(
    val isLoading: Boolean = false,
    val isLoadingBadges: Boolean = false,
    val isLoadingRanking: Boolean = false,
    val erro: String? = null,
    val abaAtiva: AbaGamificacao = AbaGamificacao.BADGES,
    val categoriaSelecionada: String? = null,
    val perfil: PerfilGamificacaoData? = null,
    val badges: List<Badge> = emptyList(),
    val ranking: List<RankingItem> = emptyList(),
    val resumoSemanal: ResumoSemanalData? = null
)

/**
 * Abas de navegação
 */
enum class AbaGamificacao {
    BADGES,
    RANKING,
    RESUMO
}
