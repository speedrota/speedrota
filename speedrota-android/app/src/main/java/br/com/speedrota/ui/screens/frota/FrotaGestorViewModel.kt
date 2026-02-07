/**
 * @fileoverview ViewModel para Tela de Frota do Gestor
 *
 * DESIGN POR CONTRATO:
 * @description Gerencia estado e lógica de gestão de frota
 * @pre Gestor autenticado com permissão de empresa
 * @post Estado de motoristas, veículos, entregas atualizado
 * @invariant Dados sempre vêm da API (sem mocks)
 */

package br.com.speedrota.ui.screens.frota

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.speedrota.data.local.PreferencesManager
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import javax.inject.Inject

// ==========================================
// DATA CLASSES (API Response)
// ==========================================

@Serializable
data class EmpresaGestor(
    val id: String,
    val nome: String,
    val modoDistribuicao: String,
    val baseLat: Double? = null,
    val baseLng: Double? = null
)

@Serializable
data class MotoristaGestor(
    val id: String,
    val nome: String,
    val foto: String? = null,
    val telefone: String,
    val status: String,
    val taxaEntrega: Float,
    val ultimaLat: Double? = null,
    val ultimaLng: Double? = null,
    val entregasHoje: Int = 0,
    val veiculoAtual: VeiculoResumo? = null
)

@Serializable
data class VeiculoResumo(
    val placa: String,
    val tipo: String
)

@Serializable
data class MotoristaResumo(
    val id: String,
    val nome: String,
    val status: String = "DISPONIVEL"
)

@Serializable
data class VeiculoGestor(
    val id: String,
    val placa: String,
    val modelo: String,
    val tipo: String,
    val status: String,
    val capacidadeKg: Float,
    val capacidadeVolumes: Int,
    val motoristasUsando: List<MotoristaResumo> = emptyList()
)

@Serializable
data class ZonaGestor(
    val id: String,
    val nome: String,
    val cor: String,
    val cidades: List<String>,
    val bairros: List<String>,
    @kotlinx.serialization.SerialName("_count")
    val count: ZonaCount? = null
)

@Serializable
data class ZonaCount(
    val motoristasZona: Int = 0
)

@Serializable
data class DashboardGestor(
    val empresa: EmpresaGestor,
    val motoristas: MotoristaStats,
    val entregas: EntregaStats,
    val metricas: MetricasStats,
    val veiculos: VeiculoStats,
    val topMotoristas: List<TopMotorista>
)

@Serializable
data class MotoristaStats(
    val total: Int,
    val porStatus: Map<String, Int>
)

@Serializable
data class EntregaStats(
    val total: Int,
    val concluidas: Int,
    val pendentes: Int,
    val emAndamento: Int,
    val taxaSucesso: Int
)

@Serializable
data class MetricasStats(
    val kmHoje: Float,
    val tempoHoje: Int,
    val rotasAtivas: Int
)

@Serializable
data class VeiculoStats(
    val disponiveis: Int,
    val emUso: Int
)

@Serializable
data class TopMotorista(
    val id: String,
    val nome: String,
    val foto: String? = null,
    val taxaEntrega: Float,
    val status: String
)

// ==========================================
// UI STATE
// ==========================================

data class FrotaGestorUiState(
    val loading: Boolean = true,
    val erro: String? = null,
    val tabAtual: Int = 0,
    
    // Empresas
    val empresas: List<EmpresaGestor> = emptyList(),
    val empresaSelecionada: EmpresaGestor? = null,
    
    // Dashboard
    val dashboard: DashboardGestor? = null,
    
    // Motoristas
    val motoristas: List<MotoristaGestor> = emptyList(),
    
    // Veículos
    val veiculos: List<VeiculoGestor> = emptyList(),
    
    // Zonas
    val zonas: List<ZonaGestor> = emptyList(),
    
    // Modais
    val showCriarEmpresa: Boolean = false,
    val showCriarMotorista: Boolean = false,
    val criandoEmpresa: Boolean = false,
    val criandoMotorista: Boolean = false,
    val mensagemSucesso: String? = null
)

// ==========================================
// VIEW MODEL
// ==========================================

@HiltViewModel
class FrotaGestorViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val preferencesManager: PreferencesManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(FrotaGestorUiState())
    val uiState: StateFlow<FrotaGestorUiState> = _uiState.asStateFlow()

    private val client = OkHttpClient()
    private val json = Json { ignoreUnknownKeys = true }
    
    private val apiUrl: String
        get() = context.getString(br.com.speedrota.R.string.api_base_url)

    /**
     * Obtém token do DataStore de forma suspensa
     */
    private suspend fun getToken(): String? {
        return preferencesManager.token.first()
    }

    // ==========================================
    // SANITY CHECKS (Quality Gates)
    // ==========================================
    
    /**
     * Valida dados do dashboard antes de exibir
     * @pre dados recebidos da API
     * @post warnings logados se inconsistentes
     */
    private fun validateDashboard(dashboard: DashboardGestor): List<String> {
        val warnings = mutableListOf<String>()
        
        // Range checks
        if (dashboard.entregas.taxaSucesso < 0 || dashboard.entregas.taxaSucesso > 100) {
            warnings.add("Taxa sucesso fora do range: ${dashboard.entregas.taxaSucesso}")
        }
        
        // Consistência: concluídas <= total
        if (dashboard.entregas.concluidas > dashboard.entregas.total) {
            warnings.add("Inconsistência: concluídas > total")
        }
        
        // Soma motoristas por status
        val somaStatus = dashboard.motoristas.porStatus.values.sum()
        if (somaStatus != dashboard.motoristas.total) {
            warnings.add("Soma status (${somaStatus}) != total (${dashboard.motoristas.total})")
        }
        
        if (warnings.isNotEmpty()) {
            android.util.Log.w("FrotaGestor", "SanityCheck warnings: $warnings")
        }
        
        return warnings
    }

    // ==========================================
    // FUNÇÕES PÚBLICAS
    // ==========================================

    /**
     * Carrega dados iniciais do gestor
     */
    fun carregarDados() {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, erro = null) }
            
            try {
                carregarEmpresas()
            } catch (e: Exception) {
                _uiState.update { 
                    it.copy(loading = false, erro = e.message)
                }
            }
        }
    }

    /**
     * Seleciona empresa e carrega dados
     */
    fun selecionarEmpresa(empresa: EmpresaGestor) {
        viewModelScope.launch {
            _uiState.update { it.copy(empresaSelecionada = empresa, loading = true) }
            carregarDadosEmpresa(empresa.id)
        }
    }

    /**
     * Muda tab atual
     */
    fun mudarTab(tab: Int) {
        _uiState.update { it.copy(tabAtual = tab) }
    }

    /**
     * Toggle modal criar empresa
     */
    fun toggleCriarEmpresa(show: Boolean) {
        _uiState.update { it.copy(showCriarEmpresa = show) }
    }

    /**
     * Toggle modal criar motorista
     */
    fun toggleCriarMotorista(show: Boolean) {
        _uiState.update { it.copy(showCriarMotorista = show) }
    }

    /**
     * Limpa mensagem de sucesso
     */
    fun limparMensagemSucesso() {
        _uiState.update { it.copy(mensagemSucesso = null) }
    }

    /**
     * Cria nova empresa
     * @param nome Nome da empresa (obrigatório)
     * @param cnpj CNPJ (opcional)
     * @param baseEndereco Endereço base (opcional)
     * @param modoDistribuicao Modo de distribuição (AUTOMATICO, MANUAL, HIBRIDO)
     */
    fun criarEmpresa(
        nome: String,
        cnpj: String = "",
        baseEndereco: String = "",
        modoDistribuicao: String = "AUTOMATICO"
    ) {
        if (nome.isBlank()) {
            _uiState.update { it.copy(erro = "Nome da empresa é obrigatório") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(criandoEmpresa = true, erro = null) }

            val authToken = getToken() ?: run {
                _uiState.update { it.copy(criandoEmpresa = false, erro = "Não autenticado") }
                return@launch
            }

            val requestBody = buildString {
                append("{")
                append("\"nome\": \"$nome\"")
                if (cnpj.isNotBlank()) append(", \"cnpj\": \"$cnpj\"")
                if (baseEndereco.isNotBlank()) append(", \"baseEndereco\": \"$baseEndereco\"")
                append(", \"modoDistribuicao\": \"$modoDistribuicao\"")
                append("}")
            }.toRequestBody("application/json".toMediaType())

            val request = Request.Builder()
                .url("$apiUrl/frota/empresa")
                .post(requestBody)
                .addHeader("Authorization", "Bearer $authToken")
                .addHeader("Content-Type", "application/json")
                .build()

            try {
                client.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        val body = response.body?.string() ?: ""
                        val empresa = json.decodeFromString<EmpresaGestor>(body)
                        
                        _uiState.update { 
                            it.copy(
                                empresas = it.empresas + empresa,
                                empresaSelecionada = empresa,
                                showCriarEmpresa = false,
                                criandoEmpresa = false,
                                mensagemSucesso = "Empresa criada com sucesso!"
                            )
                        }
                        
                        // Carregar dados da nova empresa
                        carregarDadosEmpresa(empresa.id)
                    } else {
                        val errorBody = response.body?.string() ?: "Erro desconhecido"
                        _uiState.update { 
                            it.copy(criandoEmpresa = false, erro = "Erro ao criar empresa: $errorBody")
                        }
                    }
                }
            } catch (e: Exception) {
                _uiState.update { 
                    it.copy(criandoEmpresa = false, erro = "Erro: ${e.message}")
                }
            }
        }
    }

    /**
     * Cria novo motorista
     * @param nome Nome do motorista (obrigatório)
     * @param email Email (obrigatório)
     * @param telefone Telefone (obrigatório)
     * @param cpf CPF (opcional)
     * @param tipoMotorista Tipo: VINCULADO, AUTONOMO, AUTONOMO_PARCEIRO
     */
    fun criarMotorista(
        nome: String,
        email: String,
        telefone: String,
        cpf: String = "",
        tipoMotorista: String = "VINCULADO"
    ) {
        if (nome.isBlank() || email.isBlank() || telefone.isBlank()) {
            _uiState.update { it.copy(erro = "Nome, email e telefone são obrigatórios") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(criandoMotorista = true, erro = null) }

            val authToken = getToken() ?: run {
                _uiState.update { it.copy(criandoMotorista = false, erro = "Não autenticado") }
                return@launch
            }

            val url: String
            val requestBody: RequestBody

            if (tipoMotorista == "VINCULADO") {
                // Motorista vinculado a empresa
                val empresaId = _uiState.value.empresaSelecionada?.id ?: run {
                    _uiState.update { 
                        it.copy(criandoMotorista = false, erro = "Selecione uma empresa primeiro")
                    }
                    return@launch
                }
                url = "$apiUrl/frota/empresa/$empresaId/motorista"
                requestBody = buildString {
                    append("{")
                    append("\"nome\": \"$nome\"")
                    append(", \"email\": \"$email\"")
                    append(", \"telefone\": \"$telefone\"")
                    if (cpf.isNotBlank()) append(", \"cpf\": \"$cpf\"")
                    append("}")
                }.toRequestBody("application/json".toMediaType())
            } else {
                // Motorista autônomo
                url = "$apiUrl/frota/motorista/autonomo"
                requestBody = buildString {
                    append("{")
                    append("\"nome\": \"$nome\"")
                    append(", \"email\": \"$email\"")
                    append(", \"telefone\": \"$telefone\"")
                    if (cpf.isNotBlank()) append(", \"cpf\": \"$cpf\"")
                    append(", \"tipoMotorista\": \"$tipoMotorista\"")
                    append("}")
                }.toRequestBody("application/json".toMediaType())
            }

            val request = Request.Builder()
                .url(url)
                .post(requestBody)
                .addHeader("Authorization", "Bearer $authToken")
                .addHeader("Content-Type", "application/json")
                .build()

            try {
                client.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        _uiState.update { 
                            it.copy(
                                showCriarMotorista = false,
                                criandoMotorista = false,
                                mensagemSucesso = "Motorista criado com sucesso!"
                            )
                        }
                        
                        // Recarregar motoristas
                        _uiState.value.empresaSelecionada?.let {
                            carregarMotoristas(it.id)
                        }
                    } else {
                        val errorBody = response.body?.string() ?: "Erro desconhecido"
                        _uiState.update { 
                            it.copy(criandoMotorista = false, erro = "Erro ao criar motorista: $errorBody")
                        }
                    }
                }
            } catch (e: Exception) {
                _uiState.update { 
                    it.copy(criandoMotorista = false, erro = "Erro: ${e.message}")
                }
            }
        }
    }

    /**
     * Atualiza status de motorista
     */
    fun atualizarStatusMotorista(motoristaId: String, novoStatus: String) {
        viewModelScope.launch {
            val authToken = getToken() ?: return@launch
            
            val requestBody = """{"status": "$novoStatus"}"""
                .toRequestBody("application/json".toMediaType())
            
            val request = Request.Builder()
                .url("$apiUrl/frota/motorista/$motoristaId/status")
                .patch(requestBody)
                .addHeader("Authorization", "Bearer $authToken")
                .build()
            
            try {
                client.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        // Recarregar motoristas
                        _uiState.value.empresaSelecionada?.let {
                            carregarMotoristas(it.id)
                        }
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("FrotaGestor", "Erro ao atualizar status: ${e.message}")
            }
        }
    }

    /**
     * Atualiza status de veículo
     */
    fun atualizarStatusVeiculo(veiculoId: String, novoStatus: String) {
        viewModelScope.launch {
            val authToken = getToken() ?: return@launch
            
            val requestBody = """{"status": "$novoStatus"}"""
                .toRequestBody("application/json".toMediaType())
            
            val request = Request.Builder()
                .url("$apiUrl/frota/veiculo/$veiculoId/status")
                .patch(requestBody)
                .addHeader("Authorization", "Bearer $authToken")
                .build()
            
            try {
                client.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        _uiState.value.empresaSelecionada?.let {
                            carregarVeiculos(it.id)
                        }
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("FrotaGestor", "Erro ao atualizar veículo: ${e.message}")
            }
        }
    }

    // ==========================================
    // FUNÇÕES PRIVADAS (API CALLS)
    // ==========================================

    private suspend fun carregarEmpresas() {
        val authToken = getToken() ?: run {
            _uiState.update { it.copy(loading = false, erro = "Não autenticado") }
            return
        }

        val request = Request.Builder()
            .url("$apiUrl/frota/empresas")
            .get()
            .addHeader("Authorization", "Bearer $authToken")
            .build()

        try {
            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val body = response.body?.string() ?: "[]"
                    val empresas = json.decodeFromString<List<EmpresaGestor>>(body)
                    
                    _uiState.update { 
                        it.copy(
                            empresas = empresas,
                            empresaSelecionada = empresas.firstOrNull(),
                            loading = false
                        )
                    }
                    
                    // Carregar dados da primeira empresa
                    empresas.firstOrNull()?.let { carregarDadosEmpresa(it.id) }
                } else {
                    _uiState.update { it.copy(loading = false, erro = "Erro ao buscar empresas") }
                }
            }
        } catch (e: Exception) {
            _uiState.update { it.copy(loading = false, erro = e.message) }
        }
    }

    private suspend fun carregarDadosEmpresa(empresaId: String) {
        // Carregar em paralelo
        kotlinx.coroutines.coroutineScope {
            launch { carregarDashboard(empresaId) }
            launch { carregarMotoristas(empresaId) }
            launch { carregarVeiculos(empresaId) }
            launch { carregarZonas(empresaId) }
        }
        _uiState.update { it.copy(loading = false) }
    }

    private suspend fun carregarDashboard(empresaId: String) {
        val authToken = getToken() ?: return

        val request = Request.Builder()
            .url("$apiUrl/frota/empresa/$empresaId/dashboard")
            .get()
            .addHeader("Authorization", "Bearer $authToken")
            .build()

        try {
            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val body = response.body?.string() ?: return
                    val dashboard = json.decodeFromString<DashboardGestor>(body)
                    
                    // Sanity check
                    validateDashboard(dashboard)
                    
                    _uiState.update { it.copy(dashboard = dashboard) }
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("FrotaGestor", "Erro dashboard: ${e.message}")
        }
    }

    private suspend fun carregarMotoristas(empresaId: String) {
        val authToken = getToken() ?: return

        val request = Request.Builder()
            .url("$apiUrl/frota/empresa/$empresaId/motoristas")
            .get()
            .addHeader("Authorization", "Bearer $authToken")
            .build()

        try {
            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val body = response.body?.string() ?: "[]"
                    val motoristas = json.decodeFromString<List<MotoristaGestor>>(body)
                    _uiState.update { it.copy(motoristas = motoristas) }
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("FrotaGestor", "Erro motoristas: ${e.message}")
        }
    }

    private suspend fun carregarVeiculos(empresaId: String) {
        val authToken = getToken() ?: return

        val request = Request.Builder()
            .url("$apiUrl/frota/empresa/$empresaId/veiculos")
            .get()
            .addHeader("Authorization", "Bearer $authToken")
            .build()

        try {
            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val body = response.body?.string() ?: "[]"
                    val veiculos = json.decodeFromString<List<VeiculoGestor>>(body)
                    _uiState.update { it.copy(veiculos = veiculos) }
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("FrotaGestor", "Erro veículos: ${e.message}")
        }
    }

    private suspend fun carregarZonas(empresaId: String) {
        val authToken = getToken() ?: return

        val request = Request.Builder()
            .url("$apiUrl/frota/empresa/$empresaId/zonas")
            .get()
            .addHeader("Authorization", "Bearer $authToken")
            .build()

        try {
            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val body = response.body?.string() ?: "[]"
                    val zonas = json.decodeFromString<List<ZonaGestor>>(body)
                    _uiState.update { it.copy(zonas = zonas) }
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("FrotaGestor", "Erro zonas: ${e.message}")
        }
    }
}
