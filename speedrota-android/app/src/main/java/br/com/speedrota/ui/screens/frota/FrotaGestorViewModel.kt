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
data class VeiculoGestor(
    val id: String,
    val placa: String,
    val modelo: String,
    val tipo: String,
    val status: String,
    val capacidadeKg: Float,
    val capacidadeVolumes: Int,
    val motoristaAtual: MotoristaResumo? = null
)

@Serializable
data class MotoristaResumo(
    val id: String,
    val nome: String
)

@Serializable
data class ZonaGestor(
    val id: String,
    val nome: String,
    val cor: String,
    val cidades: List<String>,
    val bairros: List<String>,
    val countMotoristas: Int = 0
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
    val zonas: List<ZonaGestor> = emptyList()
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
