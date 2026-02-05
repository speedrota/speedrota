package br.com.speedrota.ui.screens.ecommerce

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.speedrota.data.model.*
import br.com.speedrota.data.repository.EcommerceRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel para Tela de E-commerce (VTEX + Shopify)
 * 
 * DESIGN POR CONTRATO:
 * @pre Usuário autenticado
 * @post Carrega integrações e pedidos importados
 * 
 * @author SpeedRota Team
 * @version 1.0.0
 * @since Sprint 13-14
 */
@HiltViewModel
class EcommerceViewModel @Inject constructor(
    private val repository: EcommerceRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(EcommerceUiState())
    val uiState: StateFlow<EcommerceUiState> = _uiState.asStateFlow()

    init {
        carregarIntegracoes()
    }

    /**
     * Carrega lista de integrações
     */
    fun carregarIntegracoes() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, erro = null)

            try {
                val response = repository.getIntegracoes()

                if (response.success && response.data != null) {
                    _uiState.value = _uiState.value.copy(
                        integracoes = response.data,
                        isLoading = false
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        erro = response.error ?: "Erro ao carregar integrações",
                        isLoading = false
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    erro = e.message ?: "Erro de conexão",
                    isLoading = false
                )
            }
        }
    }

    /**
     * Seleciona uma integração e carrega seus pedidos
     */
    fun selecionarIntegracao(integracaoId: String) {
        _uiState.value = _uiState.value.copy(integracaoSelecionada = integracaoId)
        carregarPedidos(integracaoId)
    }

    /**
     * Carrega pedidos de uma integração
     */
    fun carregarPedidos(integracaoId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoadingPedidos = true)

            try {
                val response = repository.getPedidos(integracaoId)

                if (response.success && response.data != null) {
                    _uiState.value = _uiState.value.copy(
                        pedidos = response.data.map { it.copy(selecionado = false) },
                        isLoadingPedidos = false
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    erro = e.message,
                    isLoadingPedidos = false
                )
            }
        }
    }

    /**
     * Sincroniza pedidos de uma integração
     */
    fun sincronizar(integracaoId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSincronizando = true, erro = null)

            try {
                val response = repository.sincronizar(integracaoId)

                if (response.success && response.data != null) {
                    val resultado = response.data
                    _uiState.value = _uiState.value.copy(
                        mensagemSucesso = "✅ ${resultado.totalImportados} pedidos importados",
                        isSincronizando = false
                    )
                    
                    // Recarregar listas
                    carregarIntegracoes()
                    if (_uiState.value.integracaoSelecionada == integracaoId) {
                        carregarPedidos(integracaoId)
                    }
                } else {
                    _uiState.value = _uiState.value.copy(
                        erro = response.error,
                        isSincronizando = false
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    erro = e.message,
                    isSincronizando = false
                )
            }
        }
    }

    /**
     * Criar nova integração
     */
    fun criarIntegracao(dados: CriarIntegracaoRequest) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isCriando = true, erro = null)

            try {
                val response = repository.criarIntegracao(dados)

                if (response.success && response.data != null) {
                    val mensagem = if (response.data.testado) {
                        "✅ Integração criada e conexão testada"
                    } else {
                        "⚠️ Integração criada, mas não foi possível testar"
                    }
                    
                    _uiState.value = _uiState.value.copy(
                        mensagemSucesso = mensagem,
                        mostrarFormulario = false,
                        isCriando = false
                    )
                    
                    carregarIntegracoes()
                } else {
                    _uiState.value = _uiState.value.copy(
                        erro = response.error ?: "Erro ao criar integração",
                        isCriando = false
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    erro = e.message,
                    isCriando = false
                )
            }
        }
    }

    /**
     * Toggle seleção de pedido
     */
    fun togglePedido(pedidoId: String) {
        val pedidosAtualizados = _uiState.value.pedidos.map { pedido ->
            if (pedido.id == pedidoId) {
                pedido.copy(selecionado = !pedido.selecionado)
            } else {
                pedido
            }
        }
        _uiState.value = _uiState.value.copy(pedidos = pedidosAtualizados)
    }

    /**
     * Selecionar/desselecionar todos os pedidos
     */
    fun toggleTodos() {
        val todosSelecionados = _uiState.value.pedidos.all { it.selecionado }
        val pedidosAtualizados = _uiState.value.pedidos.map { pedido ->
            pedido.copy(selecionado = !todosSelecionados)
        }
        _uiState.value = _uiState.value.copy(pedidos = pedidosAtualizados)
    }

    /**
     * Mostrar/esconder formulário
     */
    fun toggleFormulario() {
        _uiState.value = _uiState.value.copy(
            mostrarFormulario = !_uiState.value.mostrarFormulario
        )
    }

    /**
     * Limpar mensagens
     */
    fun limparMensagens() {
        _uiState.value = _uiState.value.copy(
            mensagemSucesso = null,
            erro = null
        )
    }

    /**
     * Obter pedidos selecionados para importar
     */
    fun getPedidosSelecionados(): List<PedidoImportado> {
        return _uiState.value.pedidos.filter { it.selecionado }
    }
}

/**
 * Estado da UI de E-commerce
 */
data class EcommerceUiState(
    val integracoes: List<Integracao> = emptyList(),
    val pedidos: List<PedidoImportado> = emptyList(),
    val integracaoSelecionada: String? = null,
    val isLoading: Boolean = false,
    val isLoadingPedidos: Boolean = false,
    val isSincronizando: Boolean = false,
    val isCriando: Boolean = false,
    val mostrarFormulario: Boolean = false,
    val mensagemSucesso: String? = null,
    val erro: String? = null
)
