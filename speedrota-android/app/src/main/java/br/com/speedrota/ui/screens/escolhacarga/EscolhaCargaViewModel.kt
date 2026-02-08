package br.com.speedrota.ui.screens.escolhacarga

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.speedrota.R
import br.com.speedrota.data.local.PreferencesManager
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import javax.inject.Inject

/**
 * ViewModel para tela de Escolha de Carga
 * 
 * Para GESTOR_FROTA: Inclui seleção de motorista destino
 * Decide entre:
 * - Baixar rota já preparada pelo armazenista
 * - Fazer separação manual (fotografar caixas e notas)
 */
@HiltViewModel
class EscolhaCargaViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val preferencesManager: PreferencesManager
) : ViewModel() {
    
    private val client = OkHttpClient()
    private val apiUrl: String
        get() = context.getString(R.string.api_base_url)
    
    data class RotaPreparada(
        val id: String,
        val preparadaEm: String,
        val totalParadas: Int,
        val totalCaixas: Int,
        val caixasPreview: List<CaixaPreview>
    )
    
    data class CaixaPreview(
        val id: String,
        val tagVisual: String?,
        val tagCor: Int?,
        val destinatario: String?
    )
    
    data class MotoristaFrota(
        val id: String,
        val nome: String,
        val telefone: String?,
        val status: String,
        val tipoMotorista: String,
        val empresaNome: String?
    )
    
    data class EscolhaCargaUiState(
        val isLoading: Boolean = false,
        val rotasDisponiveis: List<RotaPreparada> = emptyList(),
        val baixando: Boolean = false,
        val rotaBaixada: String? = null,
        val erro: String? = null,
        // GESTOR_FROTA
        val isGestorFrota: Boolean = false,
        val carregandoMotoristas: Boolean = false,
        val motoristas: List<MotoristaFrota> = emptyList(),
        val motoristaSelecionado: MotoristaFrota? = null
    )
    
    private val _uiState = MutableStateFlow(EscolhaCargaUiState())
    val uiState: StateFlow<EscolhaCargaUiState> = _uiState.asStateFlow()
    
    init {
        verificarTipoUsuario()
    }
    
    private fun verificarTipoUsuario() {
        viewModelScope.launch {
            val tipoUsuario = preferencesManager.userTipoUsuario.first() ?: "ENTREGADOR"
            val isGestor = tipoUsuario == "GESTOR_FROTA"
            
            _uiState.value = _uiState.value.copy(isGestorFrota = isGestor)
            
            if (isGestor) {
                buscarMotoristas()
            } else {
                // Buscar rotas de forma silenciosa (não bloqueia UI)
                buscarRotasPreparadasSilencioso()
            }
        }
    }
    
    fun buscarMotoristas() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(carregandoMotoristas = true, erro = null)
            
            try {
                val token = preferencesManager.token.first()
                android.util.Log.d("EscolhaCarga", "Buscando motoristas - Token: ${token?.take(20)}...")
                android.util.Log.d("EscolhaCarga", "URL: $apiUrl/frota/motoristas/todos")
                
                val request = Request.Builder()
                    .url("$apiUrl/frota/motoristas/todos")
                    .addHeader("Authorization", "Bearer $token")
                    .get()
                    .build()
                
                val response = withContext(Dispatchers.IO) {
                    client.newCall(request).execute()
                }
                
                android.util.Log.d("EscolhaCarga", "Response code: ${response.code}")
                
                if (response.isSuccessful) {
                    val responseBody = response.body?.string() ?: "{}"
                    android.util.Log.d("EscolhaCarga", "Response body: ${responseBody.take(500)}")
                    val json = JSONObject(responseBody)
                    val motoristasArray = json.optJSONArray("motoristas")
                    val lista = mutableListOf<MotoristaFrota>()
                    
                    if (motoristasArray != null) {
                        for (i in 0 until motoristasArray.length()) {
                            val m = motoristasArray.getJSONObject(i)
                            lista.add(MotoristaFrota(
                                id = m.getString("id"),
                                nome = m.getString("nome"),
                                telefone = m.optString("telefone", null),
                                status = m.optString("status", "DISPONIVEL"),
                                tipoMotorista = m.optString("tipoMotorista", "AUTONOMO"),
                                empresaNome = m.optJSONObject("empresa")?.optString("nome")
                            ))
                        }
                    }
                    
                    _uiState.value = _uiState.value.copy(
                        carregandoMotoristas = false,
                        motoristas = lista
                    )
                } else {
                    val errorBody = response.body?.string() ?: ""
                    android.util.Log.e("EscolhaCarga", "Erro ${response.code}: $errorBody")
                    _uiState.value = _uiState.value.copy(
                        carregandoMotoristas = false,
                        erro = "Erro ${response.code} ao buscar motoristas"
                    )
                }
            } catch (e: Exception) {
                android.util.Log.e("EscolhaCarga", "Exception: ${e.message}", e)
                _uiState.value = _uiState.value.copy(
                    carregandoMotoristas = false,
                    erro = e.message
                )
            }
        }
    }
    
    fun selecionarMotorista(motorista: MotoristaFrota) {
        _uiState.value = _uiState.value.copy(motoristaSelecionado = motorista)
        // Não buscar rotas automaticamente - só quando o usuário pedir
        // O usuário pode querer ir direto para Separação
        buscarRotasPreparadasSilencioso()
    }
    
    fun buscarRotasPreparadas() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, erro = null)
            
            try {
                val token = preferencesManager.token.first()
                val request = Request.Builder()
                    .url("$apiUrl/rotas/preparadas")
                    .addHeader("Authorization", "Bearer $token")
                    .get()
                    .build()
                
                val response = withContext(Dispatchers.IO) {
                    client.newCall(request).execute()
                }
                
                if (response.isSuccessful) {
                    val json = JSONObject(response.body?.string() ?: "{}")
                    val rotasArray = json.optJSONArray("rotas")
                    val lista = mutableListOf<RotaPreparada>()
                    
                    if (rotasArray != null) {
                        for (i in 0 until rotasArray.length()) {
                            val r = rotasArray.getJSONObject(i)
                            val paradasArray = r.optJSONArray("paradas")
                            val caixasArray = r.optJSONArray("caixas")
                            
                            val caixasPreview = mutableListOf<CaixaPreview>()
                            if (caixasArray != null) {
                                for (j in 0 until minOf(6, caixasArray.length())) {
                                    val c = caixasArray.getJSONObject(j)
                                    caixasPreview.add(CaixaPreview(
                                        id = c.getString("id"),
                                        tagVisual = c.optString("tagVisual", null),
                                        tagCor = if (c.has("tagCor")) c.getInt("tagCor") else null,
                                        destinatario = c.optString("destinatario", null)
                                    ))
                                }
                            }
                            
                            lista.add(RotaPreparada(
                                id = r.getString("id"),
                                preparadaEm = r.optString("preparadaEm", ""),
                                totalParadas = paradasArray?.length() ?: 0,
                                totalCaixas = caixasArray?.length() ?: 0,
                                caixasPreview = caixasPreview
                            ))
                        }
                    }
                    
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        rotasDisponiveis = lista
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        erro = "Erro ao buscar rotas"
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    erro = e.message
                )
            }
        }
    }
    
    /**
     * Busca rotas preparadas sem exibir erro ao usuário
     * Usado para carregamento em background quando o usuário ainda pode querer ir para Separação
     */
    private fun buscarRotasPreparadasSilencioso() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            
            try {
                val token = preferencesManager.token.first()
                val request = Request.Builder()
                    .url("$apiUrl/rotas/preparadas")
                    .addHeader("Authorization", "Bearer $token")
                    .get()
                    .build()
                
                val response = withContext(Dispatchers.IO) {
                    client.newCall(request).execute()
                }
                
                if (response.isSuccessful) {
                    val json = JSONObject(response.body?.string() ?: "{}")
                    val rotasArray = json.optJSONArray("rotas")
                    val lista = mutableListOf<RotaPreparada>()
                    
                    if (rotasArray != null) {
                        for (i in 0 until rotasArray.length()) {
                            val r = rotasArray.getJSONObject(i)
                            val paradasArray = r.optJSONArray("paradas")
                            val caixasArray = r.optJSONArray("caixas")
                            
                            val caixasPreview = mutableListOf<CaixaPreview>()
                            if (caixasArray != null) {
                                for (j in 0 until minOf(6, caixasArray.length())) {
                                    val c = caixasArray.getJSONObject(j)
                                    caixasPreview.add(CaixaPreview(
                                        id = c.getString("id"),
                                        tagVisual = c.optString("tagVisual", null),
                                        tagCor = if (c.has("tagCor")) c.getInt("tagCor") else null,
                                        destinatario = c.optString("destinatario", null)
                                    ))
                                }
                            }
                            
                            lista.add(RotaPreparada(
                                id = r.getString("id"),
                                preparadaEm = r.optString("preparadaEm", ""),
                                totalParadas = paradasArray?.length() ?: 0,
                                totalCaixas = caixasArray?.length() ?: 0,
                                caixasPreview = caixasPreview
                            ))
                        }
                    }
                    
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        rotasDisponiveis = lista
                    )
                } else {
                    // Falhou mas não mostra erro - usuário pode ir para Separação
                    android.util.Log.w("EscolhaCarga", "Rotas preparadas não disponíveis: ${response.code}")
                    _uiState.value = _uiState.value.copy(isLoading = false)
                }
            } catch (e: Exception) {
                // Falhou silenciosamente - não bloquear o fluxo
                android.util.Log.w("EscolhaCarga", "Erro ao buscar rotas preparadas: ${e.message}")
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }
    
    fun baixarRota(rotaId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(baixando = true, erro = null)
            
            try {
                val token = preferencesManager.token.first()
                val request = Request.Builder()
                    .url("$apiUrl/rotas/$rotaId/baixar")
                    .addHeader("Authorization", "Bearer $token")
                    .post(okhttp3.RequestBody.create(null, ByteArray(0)))
                    .build()
                
                val response = client.newCall(request).execute()
                
                if (response.isSuccessful) {
                    _uiState.value = _uiState.value.copy(
                        baixando = false,
                        rotaBaixada = rotaId
                    )
                } else {
                    val erro = response.body?.string() ?: "Erro ao baixar rota"
                    _uiState.value = _uiState.value.copy(
                        baixando = false,
                        erro = erro
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    baixando = false,
                    erro = e.message
                )
            }
        }
    }
    
    fun limparErro() {
        _uiState.value = _uiState.value.copy(erro = null)
    }
    
    fun limparRotaBaixada() {
        _uiState.value = _uiState.value.copy(rotaBaixada = null)
    }
    
    /**
     * Processa arquivo de separação carregado pelo usuário
     * @param conteudo Conteúdo do arquivo texto
     */
    fun processarArquivoSeparacao(conteudo: String) {
        viewModelScope.launch {
            try {
                android.util.Log.d("EscolhaCarga", "Processando arquivo: ${conteudo.length} chars, ${conteudo.lines().size} linhas")
                
                // Parse básico do arquivo de separação
                // O arquivo tem formato:
                // 📦 1. TAG: XXX-000-00
                //    Para: Nome Destinatário
                //    End: Endereço, Número
                //    Bairro - Cidade/UF
                //    CEP: 00000-000
                
                val destinos = mutableListOf<ParsedDestino>()
                var currentDestino: MutableMap<String, String>? = null
                
                conteudo.lines().forEach { linha ->
                    when {
                        linha.contains("📦") && linha.contains("TAG:") -> {
                            // Novo destino
                            currentDestino?.let { 
                                if (it.containsKey("endereco")) {
                                    destinos.add(ParsedDestino(
                                        tag = it["tag"] ?: "",
                                        nome = it["nome"] ?: "",
                                        endereco = it["endereco"] ?: "",
                                        cep = it["cep"] ?: ""
                                    ))
                                }
                            }
                            currentDestino = mutableMapOf()
                            // Extrair TAG
                            val tagMatch = Regex("TAG:\\s*(\\S+)").find(linha)
                            currentDestino?.set("tag", tagMatch?.groupValues?.get(1) ?: "")
                        }
                        linha.trim().startsWith("Para:") -> {
                            currentDestino?.set("nome", linha.substringAfter("Para:").trim())
                        }
                        linha.trim().startsWith("End:") -> {
                            currentDestino?.set("endereco", linha.substringAfter("End:").trim())
                        }
                        linha.trim().startsWith("CEP:") -> {
                            currentDestino?.set("cep", linha.substringAfter("CEP:").trim())
                        }
                    }
                }
                
                // Último destino
                currentDestino?.let { 
                    if (it.containsKey("endereco")) {
                        destinos.add(ParsedDestino(
                            tag = it["tag"] ?: "",
                            nome = it["nome"] ?: "",
                            endereco = it["endereco"] ?: "",
                            cep = it["cep"] ?: ""
                        ))
                    }
                }
                
                android.util.Log.d("EscolhaCarga", "Destinos extraídos: ${destinos.size}")
                destinos.forEachIndexed { idx, d -> 
                    android.util.Log.d("EscolhaCarga", "  $idx: ${d.tag} - ${d.nome} - ${d.endereco}")
                }
                
                // TODO: Transferir para RotaDataHolder
                if (destinos.isNotEmpty()) {
                    _uiState.value = _uiState.value.copy(
                        erro = null
                    )
                    // Podemos simular que baixamos uma rota aqui
                }
                
            } catch (e: Exception) {
                android.util.Log.e("EscolhaCarga", "Erro ao processar arquivo: ${e.message}", e)
                _uiState.value = _uiState.value.copy(erro = "Erro ao processar arquivo: ${e.message}")
            }
        }
    }
    
    data class ParsedDestino(
        val tag: String,
        val nome: String,
        val endereco: String,
        val cep: String
    )
    
    companion object {
        val CORES_TAG = mapOf(
            1 to 0xFFf97316.toInt(),
            2 to 0xFF22c55e.toInt(),
            3 to 0xFF3b82f6.toInt(),
            4 to 0xFFa855f7.toInt(),
            5 to 0xFFec4899.toInt(),
            6 to 0xFFeab308.toInt(),
            7 to 0xFF14b8a6.toInt(),
            8 to 0xFFf43f5e.toInt()
        )
    }
}
