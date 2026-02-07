package br.com.speedrota.ui.screens.frota

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.speedrota.data.local.PreferencesManager
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject

// ================================
// DATA CLASSES
// ================================

@Serializable
data class EmpresaItem(
    val id: String,
    val nome: String,
    val cnpj: String? = null,
    val email: String
)

@Serializable
data class EmpresaNested(
    val id: String,
    val nome: String
)

@Serializable
data class MotoristaItem(
    val id: String,
    val nome: String,
    val email: String,
    val tipoMotorista: String,
    val empresa: EmpresaNested? = null
) {
    val empresaNome: String? get() = empresa?.nome
}

data class MenuFrotaState(
    val empresas: List<EmpresaItem> = emptyList(),
    val motoristas: List<MotoristaItem> = emptyList(),
    val empresasSelect: List<EmpresaItem> = emptyList(),
    val carregando: Boolean = false,
    val erro: String? = null,
    val sucesso: String? = null
)

// ================================
// VIEW MODEL
// ================================

@HiltViewModel
class MenuFrotaViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val preferencesManager: PreferencesManager
) : ViewModel() {
    
    private val _state = MutableStateFlow(MenuFrotaState())
    val state: StateFlow<MenuFrotaState> = _state.asStateFlow()
    
    private val client = OkHttpClient()
    private val json = Json { ignoreUnknownKeys = true }
    
    private val apiUrl: String
        get() = context.getString(br.com.speedrota.R.string.api_base_url)
    
    private suspend fun getToken(): String? = preferencesManager.getToken().first()
    
    fun carregarEmpresas() {
        viewModelScope.launch {
            _state.value = _state.value.copy(carregando = true, erro = null)
            try {
                val token = getToken() ?: throw Exception("Não autenticado")
                val request = Request.Builder()
                    .url("$apiUrl/frota/empresas")
                    .header("Authorization", "Bearer $token")
                    .get()
                    .build()
                
                val response = withContext(Dispatchers.IO) {
                    client.newCall(request).execute()
                }
                
                if (response.isSuccessful) {
                    val body = response.body?.string() ?: "[]"
                    val empresas = json.decodeFromString<List<EmpresaItem>>(body)
                    _state.value = _state.value.copy(empresas = empresas, carregando = false)
                } else {
                    _state.value = _state.value.copy(erro = "Erro ao carregar empresas", carregando = false)
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(erro = e.message, carregando = false)
            }
        }
    }
    
    fun carregarEmpresasParaSelect() {
        viewModelScope.launch {
            try {
                val token = getToken() ?: return@launch
                val request = Request.Builder()
                    .url("$apiUrl/frota/empresas")
                    .header("Authorization", "Bearer $token")
                    .get()
                    .build()
                
                val response = withContext(Dispatchers.IO) {
                    client.newCall(request).execute()
                }
                
                if (response.isSuccessful) {
                    val body = response.body?.string() ?: "[]"
                    val empresas = json.decodeFromString<List<EmpresaItem>>(body)
                    _state.value = _state.value.copy(empresasSelect = empresas)
                }
            } catch (e: Exception) {
                // Silently fail for select
            }
        }
    }
    
    fun carregarMotoristas() {
        viewModelScope.launch {
            _state.value = _state.value.copy(carregando = true, erro = null)
            try {
                val token = getToken() ?: throw Exception("Não autenticado")
                val request = Request.Builder()
                    .url("$apiUrl/frota/motoristas/todos")
                    .header("Authorization", "Bearer $token")
                    .get()
                    .build()
                
                val response = withContext(Dispatchers.IO) {
                    client.newCall(request).execute()
                }
                
                if (response.isSuccessful) {
                    val body = response.body?.string() ?: "[]"
                    val motoristas = json.decodeFromString<List<MotoristaItem>>(body)
                    _state.value = _state.value.copy(motoristas = motoristas, carregando = false)
                } else {
                    _state.value = _state.value.copy(erro = "Erro ao carregar motoristas", carregando = false)
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(erro = e.message, carregando = false)
            }
        }
    }
    
    fun criarEmpresa(nome: String, cnpj: String?, email: String, telefone: String?, onSuccess: () -> Unit) {
        if (nome.isBlank() || email.isBlank()) {
            _state.value = _state.value.copy(erro = "Nome e email são obrigatórios")
            return
        }
        
        viewModelScope.launch {
            _state.value = _state.value.copy(carregando = true, erro = null)
            try {
                val token = getToken() ?: throw Exception("Não autenticado")
                
                val jsonBody = buildString {
                    append("{")
                    append("\"nome\":\"${nome.trim()}\"")
                    append(",\"email\":\"${email.trim()}\"")
                    cnpj?.takeIf { it.isNotBlank() }?.let { append(",\"cnpj\":\"${it.trim()}\"") }
                    telefone?.takeIf { it.isNotBlank() }?.let { append(",\"telefone\":\"${it.trim()}\"") }
                    append("}")
                }
                
                val request = Request.Builder()
                    .url("$apiUrl/frota/empresa")
                    .header("Authorization", "Bearer $token")
                    .post(jsonBody.toRequestBody("application/json".toMediaType()))
                    .build()
                
                val response = withContext(Dispatchers.IO) {
                    client.newCall(request).execute()
                }
                
                if (response.isSuccessful) {
                    _state.value = _state.value.copy(
                        sucesso = "Empresa \"$nome\" criada com sucesso!",
                        carregando = false
                    )
                    onSuccess()
                } else {
                    val errorBody = response.body?.string() ?: ""
                    _state.value = _state.value.copy(erro = "Erro ao criar empresa: $errorBody", carregando = false)
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(erro = e.message, carregando = false)
            }
        }
    }
    
    fun criarMotorista(
        nome: String,
        email: String,
        telefone: String,
        tipoMotorista: String,
        empresaId: String?,
        onSuccess: () -> Unit
    ) {
        if (nome.isBlank() || email.isBlank() || telefone.isBlank()) {
            _state.value = _state.value.copy(erro = "Nome, email e telefone são obrigatórios")
            return
        }
        
        if (tipoMotorista == "VINCULADO" && empresaId.isNullOrBlank()) {
            _state.value = _state.value.copy(erro = "Selecione uma empresa")
            return
        }
        
        viewModelScope.launch {
            _state.value = _state.value.copy(carregando = true, erro = null)
            try {
                val token = getToken() ?: throw Exception("Não autenticado")
                
                val jsonBody = """
                    {
                        "nome": "${nome.trim()}",
                        "email": "${email.trim()}",
                        "telefone": "${telefone.trim()}",
                        "tipoMotorista": "$tipoMotorista"
                    }
                """.trimIndent()
                
                val url = if (tipoMotorista == "AUTONOMO" || tipoMotorista == "AUTONOMO_PARCEIRO") {
                    "$apiUrl/frota/motorista/autonomo"
                } else {
                    "$apiUrl/frota/empresa/$empresaId/motorista"
                }
                
                val request = Request.Builder()
                    .url(url)
                    .header("Authorization", "Bearer $token")
                    .post(jsonBody.toRequestBody("application/json".toMediaType()))
                    .build()
                
                val response = withContext(Dispatchers.IO) {
                    client.newCall(request).execute()
                }
                
                if (response.isSuccessful) {
                    val tipo = if (tipoMotorista == "AUTONOMO") "autônomo" else "vinculado"
                    _state.value = _state.value.copy(
                        sucesso = "Motorista $tipo \"$nome\" criado!",
                        carregando = false
                    )
                    onSuccess()
                } else {
                    val errorBody = response.body?.string() ?: ""
                    _state.value = _state.value.copy(erro = "Erro ao criar motorista: $errorBody", carregando = false)
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(erro = e.message, carregando = false)
            }
        }
    }
    
    fun limparMensagens() {
        _state.value = _state.value.copy(erro = null, sucesso = null)
    }
}

// ================================
// TELA PRINCIPAL
// ================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TelaMenuFrota(
    onNavigateBack: () -> Unit,
    onNavigateToFrotaGestor: (empresaId: String) -> Unit,
    onNavigateToMotorista: (motoristaId: String) -> Unit,
    viewModel: MenuFrotaViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()
    
    // Estados dos modais
    var showAdicionarEmpresa by remember { mutableStateOf(false) }
    var showAdicionarMotorista by remember { mutableStateOf(false) }
    var showAcessarEmpresa by remember { mutableStateOf(false) }
    var showAcessarMotorista by remember { mutableStateOf(false) }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Gestão de Frota") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Voltar")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF1A1A2E),
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White
                )
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color(0xFF1A1A2E), Color(0xFF16213E))
                    )
                )
                .padding(padding)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Spacer(modifier = Modifier.height(40.dp))
                
                // Grid de Cards
                Column(
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Row 1
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Card: Adicionar Empresa
                        MenuCard(
                            modifier = Modifier.weight(1f),
                            emoji = "🏢",
                            title = "Adicionar Empresa",
                            subtitle = "Cadastrar nova empresa",
                            onClick = {
                                viewModel.limparMensagens()
                                showAdicionarEmpresa = true
                            }
                        )
                        
                        // Card: Adicionar Motorista
                        MenuCard(
                            modifier = Modifier.weight(1f),
                            emoji = "👤",
                            title = "Adicionar Motorista",
                            subtitle = "Autônomo ou vinculado",
                            onClick = {
                                viewModel.limparMensagens()
                                viewModel.carregarEmpresasParaSelect()
                                showAdicionarMotorista = true
                            }
                        )
                    }
                    
                    // Row 2
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Card: Acessar Empresa
                        MenuCard(
                            modifier = Modifier.weight(1f),
                            emoji = "🏭",
                            title = "Acessar Empresa",
                            subtitle = "Gerenciar empresa",
                            onClick = {
                                viewModel.limparMensagens()
                                viewModel.carregarEmpresas()
                                showAcessarEmpresa = true
                            }
                        )
                        
                        // Card: Acessar Motorista
                        MenuCard(
                            modifier = Modifier.weight(1f),
                            emoji = "🚚",
                            title = "Acessar Motorista",
                            subtitle = "Visualizar motorista",
                            onClick = {
                                viewModel.limparMensagens()
                                viewModel.carregarMotoristas()
                                showAcessarMotorista = true
                            }
                        )
                    }
                }
            }
        }
    }
    
    // ================================
    // MODAIS
    // ================================
    
    // Modal: Adicionar Empresa
    if (showAdicionarEmpresa) {
        ModalAdicionarEmpresa(
            state = state,
            onDismiss = { showAdicionarEmpresa = false },
            onConfirm = { nome, cnpj, email, telefone ->
                viewModel.criarEmpresa(nome, cnpj, email, telefone) {
                    showAdicionarEmpresa = false
                }
            }
        )
    }
    
    // Modal: Adicionar Motorista
    if (showAdicionarMotorista) {
        ModalAdicionarMotorista(
            state = state,
            onDismiss = { showAdicionarMotorista = false },
            onConfirm = { nome, email, telefone, tipo, empresaId ->
                viewModel.criarMotorista(nome, email, telefone, tipo, empresaId) {
                    showAdicionarMotorista = false
                }
            }
        )
    }
    
    // Modal: Acessar Empresa
    if (showAcessarEmpresa) {
        ModalAcessarEmpresa(
            state = state,
            onDismiss = { showAcessarEmpresa = false },
            onSelect = { empresaId ->
                showAcessarEmpresa = false
                onNavigateToFrotaGestor(empresaId)
            },
            onAdicionarPrimeira = {
                showAcessarEmpresa = false
                showAdicionarEmpresa = true
            }
        )
    }
    
    // Modal: Acessar Motorista
    if (showAcessarMotorista) {
        ModalAcessarMotorista(
            state = state,
            onDismiss = { showAcessarMotorista = false },
            onSelect = { motoristaId ->
                showAcessarMotorista = false
                onNavigateToMotorista(motoristaId)
            },
            onAdicionarPrimeiro = {
                showAcessarMotorista = false
                showAdicionarMotorista = true
            }
        )
    }
}

// ================================
// COMPONENTES
// ================================

@Composable
fun MenuCard(
    modifier: Modifier = Modifier,
    emoji: String,
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier
            .height(160.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFF252542)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = emoji,
                fontSize = 40.sp
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = Color.White.copy(alpha = 0.6f),
                textAlign = TextAlign.Center
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ModalAdicionarEmpresa(
    state: MenuFrotaState,
    onDismiss: () -> Unit,
    onConfirm: (nome: String, cnpj: String?, email: String, telefone: String?) -> Unit
) {
    var nome by remember { mutableStateOf("") }
    var cnpj by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var telefone by remember { mutableStateOf("") }
    
    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(24.dp)
            ) {
                Text(
                    text = "🏢 Adicionar Empresa",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                state.erro?.let { erro ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFEE2E2))
                    ) {
                        Text(
                            text = erro,
                            color = Color(0xFFDC2626),
                            modifier = Modifier.padding(12.dp),
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                }
                
                state.sucesso?.let { sucesso ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFDCFCE7))
                    ) {
                        Text(
                            text = sucesso,
                            color = Color(0xFF16A34A),
                            modifier = Modifier.padding(12.dp),
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                }
                
                OutlinedTextField(
                    value = nome,
                    onValueChange = { nome = it },
                    label = { Text("Nome da Empresa *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                
                Spacer(modifier = Modifier.height(12.dp))
                
                OutlinedTextField(
                    value = cnpj,
                    onValueChange = { cnpj = it },
                    label = { Text("CNPJ") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                
                Spacer(modifier = Modifier.height(12.dp))
                
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                
                Spacer(modifier = Modifier.height(12.dp))
                
                OutlinedTextField(
                    value = telefone,
                    onValueChange = { telefone = it },
                    label = { Text("Telefone") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                
                Spacer(modifier = Modifier.height(24.dp))
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancelar")
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = { onConfirm(nome, cnpj, email, telefone) },
                        enabled = !state.carregando
                    ) {
                        if (state.carregando) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                color = Color.White,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text("Criar Empresa")
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ModalAdicionarMotorista(
    state: MenuFrotaState,
    onDismiss: () -> Unit,
    onConfirm: (nome: String, email: String, telefone: String, tipo: String, empresaId: String?) -> Unit
) {
    var nome by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var telefone by remember { mutableStateOf("") }
    var tipoMotorista by remember { mutableStateOf("AUTONOMO") }
    var empresaId by remember { mutableStateOf<String?>(null) }
    var expandedEmpresa by remember { mutableStateOf(false) }
    
    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(24.dp)
            ) {
                Text(
                    text = "👤 Adicionar Motorista",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                state.erro?.let { erro ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFEE2E2))
                    ) {
                        Text(
                            text = erro,
                            color = Color(0xFFDC2626),
                            modifier = Modifier.padding(12.dp),
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                }
                
                // Tipo de Motorista
                Text(
                    text = "Tipo de Motorista",
                    style = MaterialTheme.typography.labelLarge
                )
                Spacer(modifier = Modifier.height(8.dp))
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = tipoMotorista == "AUTONOMO",
                        onClick = { tipoMotorista = "AUTONOMO" },
                        label = { Text("🚗 Autônomo") },
                        modifier = Modifier.weight(1f)
                    )
                    FilterChip(
                        selected = tipoMotorista == "VINCULADO",
                        onClick = { tipoMotorista = "VINCULADO" },
                        label = { Text("🏢 Vinculado") },
                        modifier = Modifier.weight(1f)
                    )
                }
                
                // Empresa (só para vinculado)
                if (tipoMotorista == "VINCULADO") {
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    ExposedDropdownMenuBox(
                        expanded = expandedEmpresa,
                        onExpandedChange = { expandedEmpresa = !expandedEmpresa }
                    ) {
                        OutlinedTextField(
                            value = state.empresasSelect.find { it.id == empresaId }?.nome ?: "",
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Empresa *") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expandedEmpresa) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .menuAnchor()
                        )
                        
                        ExposedDropdownMenu(
                            expanded = expandedEmpresa,
                            onDismissRequest = { expandedEmpresa = false }
                        ) {
                            state.empresasSelect.forEach { empresa ->
                                DropdownMenuItem(
                                    text = { Text(empresa.nome) },
                                    onClick = {
                                        empresaId = empresa.id
                                        expandedEmpresa = false
                                    }
                                )
                            }
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(12.dp))
                
                OutlinedTextField(
                    value = nome,
                    onValueChange = { nome = it },
                    label = { Text("Nome Completo *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                
                Spacer(modifier = Modifier.height(12.dp))
                
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                
                Spacer(modifier = Modifier.height(12.dp))
                
                OutlinedTextField(
                    value = telefone,
                    onValueChange = { telefone = it },
                    label = { Text("Telefone *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                
                Spacer(modifier = Modifier.height(24.dp))
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancelar")
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = { onConfirm(nome, email, telefone, tipoMotorista, empresaId) },
                        enabled = !state.carregando
                    ) {
                        if (state.carregando) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                color = Color.White,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text("Criar Motorista")
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ModalAcessarEmpresa(
    state: MenuFrotaState,
    onDismiss: () -> Unit,
    onSelect: (empresaId: String) -> Unit,
    onAdicionarPrimeira: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(24.dp)
            ) {
                Text(
                    text = "🏭 Selecionar Empresa",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                if (state.carregando) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                } else if (state.empresas.isEmpty()) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "Nenhuma empresa cadastrada",
                            style = MaterialTheme.typography.bodyLarge,
                            color = Color.Gray
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = onAdicionarPrimeira) {
                            Text("Adicionar Primeira Empresa")
                        }
                    }
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(state.empresas) { empresa ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onSelect(empresa.id) },
                                colors = CardDefaults.cardColors(
                                    containerColor = Color(0xFFF3F4F6)
                                )
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(16.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text("🏢", fontSize = 24.sp)
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = empresa.nome,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Text(
                                            text = empresa.cnpj ?: empresa.email,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = Color.Gray
                                        )
                                    }
                                    Icon(
                                        Icons.Default.ChevronRight,
                                        contentDescription = null,
                                        tint = Color.Gray
                                    )
                                }
                            }
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(16.dp))
                
                TextButton(
                    onClick = onDismiss,
                    modifier = Modifier.align(Alignment.End)
                ) {
                    Text("Fechar")
                }
            }
        }
    }
}

@Composable
fun ModalAcessarMotorista(
    state: MenuFrotaState,
    onDismiss: () -> Unit,
    onSelect: (motoristaId: String) -> Unit,
    onAdicionarPrimeiro: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(24.dp)
            ) {
                Text(
                    text = "🚚 Selecionar Motorista",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                if (state.carregando) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                } else if (state.motoristas.isEmpty()) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "Nenhum motorista cadastrado",
                            style = MaterialTheme.typography.bodyLarge,
                            color = Color.Gray
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = onAdicionarPrimeiro) {
                            Text("Adicionar Primeiro Motorista")
                        }
                    }
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(state.motoristas) { motorista ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onSelect(motorista.id) },
                                colors = CardDefaults.cardColors(
                                    containerColor = Color(0xFFF3F4F6)
                                )
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(16.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = if (motorista.tipoMotorista == "AUTONOMO") "🚗" else "🚚",
                                        fontSize = 24.sp
                                    )
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = motorista.nome,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Text(
                                            text = if (motorista.tipoMotorista == "AUTONOMO")
                                                "Autônomo"
                                            else
                                                "Vinculado: ${motorista.empresaNome ?: "—"}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = Color.Gray
                                        )
                                    }
                                    if (motorista.tipoMotorista == "AUTONOMO") {
                                        Text("🚗", fontSize = 16.sp)
                                    } else {
                                        Text("🏢", fontSize = 16.sp)
                                    }
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Icon(
                                        Icons.Default.ChevronRight,
                                        contentDescription = null,
                                        tint = Color.Gray
                                    )
                                }
                            }
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(16.dp))
                
                TextButton(
                    onClick = onDismiss,
                    modifier = Modifier.align(Alignment.End)
                ) {
                    Text("Fechar")
                }
            }
        }
    }
}
