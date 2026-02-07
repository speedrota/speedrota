/**
 * @fileoverview ViewModel para Tela de Frota do Motorista
 *
 * DESIGN POR CONTRATO:
 * @description Gerencia estado e lógica de entregas do motorista
 * @pre Motorista autenticado
 * @post Estado de rotas e entregas atualizado
 */

package br.com.speedrota.ui.screens.frota

import android.content.Context
import android.location.Location
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

// ==========================================
// VIEW MODEL
// ==========================================

@HiltViewModel
class FrotaMotoristaViewModel @Inject constructor(
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val _uiState = MutableStateFlow(FrotaUiState())
    val uiState: StateFlow<FrotaUiState> = _uiState.asStateFlow()

    private val client = OkHttpClient()
    private val json = Json { ignoreUnknownKeys = true }
    
    private val apiUrl: String
        get() = context.getString(br.com.speedrota.R.string.api_base_url)

    private val motoristaId: String?
        get() = context.getSharedPreferences("speedrota", Context.MODE_PRIVATE)
            .getString("motorista_id", null)

    private val token: String?
        get() = context.getSharedPreferences("speedrota", Context.MODE_PRIVATE)
            .getString("auth_token", null)

    // ==========================================
    // FUNÇÕES PÚBLICAS
    // ==========================================

    /**
     * Carrega dados iniciais do motorista
     */
    fun carregarDados() {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, erro = null) }
            
            try {
                carregarRotas()
                carregarStatus()
            } catch (e: Exception) {
                _uiState.update { 
                    it.copy(loading = false, erro = e.message)
                }
            }
        }
    }

    /**
     * Atualiza status do motorista
     */
    suspend fun atualizarStatus(novoStatus: StatusMotorista) {
        val id = motoristaId ?: return
        val authToken = token ?: return

        val requestBody = """
            {"status": "${novoStatus.name}"}
        """.trimIndent().toRequestBody("application/json".toMediaType())

        val request = Request.Builder()
            .url("$apiUrl/frota/motorista/$id/status")
            .patch(requestBody)
            .addHeader("Authorization", "Bearer $authToken")
            .build()

        try {
            val response = client.newCall(request).execute()
            if (response.isSuccessful) {
                _uiState.update { it.copy(meuStatus = novoStatus) }
            }
        } catch (e: IOException) {
            _uiState.update { it.copy(erro = "Erro ao atualizar status") }
        }
    }

    /**
     * Inicia uma rota
     */
    fun iniciarRota(rotaId: String) {
        viewModelScope.launch {
            val authToken = token ?: return@launch

            val requestBody = """
                {"status": "EM_ANDAMENTO"}
            """.trimIndent().toRequestBody("application/json".toMediaType())

            val request = Request.Builder()
                .url("$apiUrl/frota/rota/$rotaId/status")
                .patch(requestBody)
                .addHeader("Authorization", "Bearer $authToken")
                .build()

            try {
                val response = client.newCall(request).execute()
                if (response.isSuccessful) {
                    // Atualiza lista local
                    _uiState.update { state ->
                        state.copy(
                            rotas = state.rotas.map { rota ->
                                if (rota.id == rotaId) {
                                    rota.copy(status = StatusRota.EM_ANDAMENTO)
                                } else rota
                            },
                            meuStatus = StatusMotorista.EM_ROTA
                        )
                    }
                }
            } catch (e: IOException) {
                _uiState.update { it.copy(erro = "Erro ao iniciar rota") }
            }
        }
    }

    /**
     * Atualiza posição do motorista
     */
    fun atualizarPosicao(location: Location) {
        val id = motoristaId ?: return
        val authToken = token ?: return

        viewModelScope.launch {
            val requestBody = """
                {"lat": ${location.latitude}, "lng": ${location.longitude}}
            """.trimIndent().toRequestBody("application/json".toMediaType())

            val request = Request.Builder()
                .url("$apiUrl/frota/motorista/$id/posicao")
                .patch(requestBody)
                .addHeader("Authorization", "Bearer $authToken")
                .build()

            try {
                client.newCall(request).execute()
            } catch (e: IOException) {
                // Silenciosamente ignora erros de tracking
            }
        }
    }

    /**
     * Marca entrega como realizada
     */
    fun marcarEntregue(paradaId: String, assinatura: String? = null, foto: String? = null) {
        viewModelScope.launch {
            val authToken = token ?: return@launch

            val body = buildString {
                append("{")
                append(""""status": "ENTREGUE"""")
                assinatura?.let { append(""", "assinatura": "$it"""") }
                foto?.let { append(""", "foto": "$it"""") }
                append("}")
            }

            val requestBody = body.toRequestBody("application/json".toMediaType())

            val request = Request.Builder()
                .url("$apiUrl/frota/parada/$paradaId/status")
                .patch(requestBody)
                .addHeader("Authorization", "Bearer $authToken")
                .build()

            try {
                val response = client.newCall(request).execute()
                if (response.isSuccessful) {
                    // Atualiza contadores
                    _uiState.update { state ->
                        state.copy(
                            entregasConcluidas = state.entregasConcluidas + 1,
                            rotas = state.rotas.map { rota ->
                                val paradaAtualizada = rota.paradas.any { it.id == paradaId }
                                if (paradaAtualizada) {
                                    rota.copy(
                                        entregasConcluidas = rota.entregasConcluidas + 1,
                                        paradas = rota.paradas.map { parada ->
                                            if (parada.id == paradaId) {
                                                parada.copy(status = StatusParada.ENTREGUE)
                                            } else parada
                                        }
                                    )
                                } else rota
                            }
                        )
                    }
                }
            } catch (e: IOException) {
                _uiState.update { it.copy(erro = "Erro ao registrar entrega") }
            }
        }
    }

    /**
     * Marca entrega como não realizada
     */
    fun marcarNaoEntregue(paradaId: String, motivo: String) {
        viewModelScope.launch {
            val authToken = token ?: return@launch

            val requestBody = """
                {"status": "NAO_ENTREGUE", "motivo": "$motivo"}
            """.trimIndent().toRequestBody("application/json".toMediaType())

            val request = Request.Builder()
                .url("$apiUrl/frota/parada/$paradaId/status")
                .patch(requestBody)
                .addHeader("Authorization", "Bearer $authToken")
                .build()

            try {
                val response = client.newCall(request).execute()
                if (response.isSuccessful) {
                    _uiState.update { state ->
                        state.copy(
                            rotas = state.rotas.map { rota ->
                                rota.copy(
                                    paradas = rota.paradas.map { parada ->
                                        if (parada.id == paradaId) {
                                            parada.copy(status = StatusParada.NAO_ENTREGUE)
                                        } else parada
                                    }
                                )
                            }
                        )
                    }
                }
            } catch (e: IOException) {
                _uiState.update { it.copy(erro = "Erro ao registrar") }
            }
        }
    }

    // ==========================================
    // FUNÇÕES PRIVADAS
    // ==========================================

    private suspend fun carregarRotas() {
        val id = motoristaId ?: return
        val authToken = token ?: return

        val request = Request.Builder()
            .url("$apiUrl/frota/motorista/$id/rotas")
            .addHeader("Authorization", "Bearer $authToken")
            .build()

        try {
            val response = client.newCall(request).execute()
            if (response.isSuccessful) {
                val body = response.body?.string() ?: "[]"
                val rotas = parseRotas(body)
                
                val totalEntregas = rotas.sumOf { it.totalEntregas }
                val concluidas = rotas.sumOf { it.entregasConcluidas }
                val km = rotas.sumOf { it.distanciaKm.toDouble() }.toFloat()
                
                _uiState.update { state ->
                    state.copy(
                        loading = false,
                        rotas = rotas,
                        totalEntregas = totalEntregas,
                        entregasConcluidas = concluidas,
                        kmRodados = km
                    )
                }
            }
        } catch (e: IOException) {
            _uiState.update { 
                it.copy(loading = false, erro = "Erro ao carregar rotas")
            }
        }
    }

    private suspend fun carregarStatus() {
        val id = motoristaId ?: return
        val authToken = token ?: return

        val request = Request.Builder()
            .url("$apiUrl/frota/motorista/$id")
            .addHeader("Authorization", "Bearer $authToken")
            .build()

        try {
            val response = client.newCall(request).execute()
            if (response.isSuccessful) {
                val body = response.body?.string() ?: "{}"
                // Parse status from response
                val statusRegex = """"status"\s*:\s*"(\w+)"""".toRegex()
                val match = statusRegex.find(body)
                val statusStr = match?.groupValues?.get(1) ?: "DISPONIVEL"
                val status = try {
                    StatusMotorista.valueOf(statusStr)
                } catch (e: Exception) {
                    StatusMotorista.DISPONIVEL
                }
                
                _uiState.update { it.copy(meuStatus = status) }
            }
        } catch (e: IOException) {
            // Status padrão se não conseguir carregar
        }
    }

    private fun parseRotas(jsonString: String): List<RotaAtribuida> {
        // Simple JSON parsing without full serialization
        // In production, use proper Gson/Moshi/Kotlinx.serialization
        return try {
            val rotaRegex = """\{[^{}]*"id"\s*:\s*"([^"]+)"[^{}]*\}""".toRegex()
            val matches = rotaRegex.findAll(jsonString)
            
            matches.map { match ->
                val rotaJson = match.value
                RotaAtribuida(
                    id = extractString(rotaJson, "id") ?: "",
                    totalEntregas = extractInt(rotaJson, "totalEntregas") ?: 0,
                    entregasConcluidas = extractInt(rotaJson, "entregasConcluidas") ?: 0,
                    distanciaKm = extractFloat(rotaJson, "distanciaKm") ?: 0f,
                    tempoEstimadoMin = extractInt(rotaJson, "tempoEstimadoMin") ?: 0,
                    status = try {
                        StatusRota.valueOf(extractString(rotaJson, "status") ?: "PENDENTE")
                    } catch (e: Exception) {
                        StatusRota.PENDENTE
                    },
                    createdAt = extractString(rotaJson, "createdAt") ?: "",
                    paradas = emptyList() // Paradas são carregadas separadamente
                )
            }.toList()
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun extractString(json: String, key: String): String? {
        val regex = """"$key"\s*:\s*"([^"]+)"""".toRegex()
        return regex.find(json)?.groupValues?.get(1)
    }

    private fun extractInt(json: String, key: String): Int? {
        val regex = """"$key"\s*:\s*(\d+)""".toRegex()
        return regex.find(json)?.groupValues?.get(1)?.toIntOrNull()
    }

    private fun extractFloat(json: String, key: String): Float? {
        val regex = """"$key"\s*:\s*([\d.]+)""".toRegex()
        return regex.find(json)?.groupValues?.get(1)?.toFloatOrNull()
    }
}
