/**
 * @fileoverview Tela de Frota para Gestor Android
 *
 * DESIGN POR CONTRATO:
 * @description Interface do gestor para gerenciar frota
 * @pre Gestor autenticado com empresa vinculada
 * @post Visualização e controle de motoristas, veículos, entregas
 * @invariant Dados sempre da API (sem mocks)
 *
 * TABS:
 * 1. Dashboard - KPIs e resumo
 * 2. Motoristas - Lista e status em tempo real
 * 3. Veículos - Gestão de veículos
 * 4. Zonas - Áreas de atuação
 * 5. Distribuir - Atribuição de rotas
 */

package br.com.speedrota.ui.screens.frota

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel

// ==========================================
// CONSTANTES DE COR
// ==========================================

private val GreenSuccess = Color(0xFF22C55E)
private val BlueActive = Color(0xFF3B82F6)
private val YellowWarning = Color(0xFFF59E0B)
private val RedError = Color(0xFFEF4444)
private val GrayNeutral = Color(0xFF6B7280)
private val PurpleAccent = Color(0xFF8B5CF6)

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TelaFrotaGestor(
    onNavigateBack: () -> Unit,
    onNavigateToRota: (String) -> Unit = {},
    viewModel: FrotaGestorViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    
    LaunchedEffect(Unit) {
        viewModel.carregarDados()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Gestão de Frota", fontWeight = FontWeight.Bold)
                        uiState.empresaSelecionada?.let {
                            Text(
                                text = it.nome,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.8f)
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Voltar")
                    }
                },
                actions = {
                    // Seletor de empresa (se mais de uma)
                    if (uiState.empresas.size > 1) {
                        var expanded by remember { mutableStateOf(false) }
                        Box {
                            IconButton(onClick = { expanded = true }) {
                                Icon(Icons.Default.Business, contentDescription = "Empresas")
                            }
                            DropdownMenu(
                                expanded = expanded,
                                onDismissRequest = { expanded = false }
                            ) {
                                uiState.empresas.forEach { empresa ->
                                    DropdownMenuItem(
                                        text = { Text(empresa.nome) },
                                        onClick = {
                                            viewModel.selecionarEmpresa(empresa)
                                            expanded = false
                                        }
                                    )
                                }
                            }
                        }
                    }
                    
                    IconButton(onClick = { viewModel.carregarDados() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Atualizar")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary,
                    actionIconContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Tabs
            TabRow(
                selectedTabIndex = uiState.tabAtual,
                containerColor = MaterialTheme.colorScheme.surface
            ) {
                listOf(
                    "📊" to "Dashboard",
                    "🚚" to "Motoristas",
                    "🚗" to "Veículos",
                    "📍" to "Zonas",
                    "📦" to "Distribuir"
                ).forEachIndexed { index, (emoji, label) ->
                    Tab(
                        selected = uiState.tabAtual == index,
                        onClick = { viewModel.mudarTab(index) },
                        text = { 
                            Text(
                                text = "$emoji $label",
                                fontSize = 12.sp,
                                maxLines = 1
                            )
                        }
                    )
                }
            }

            // Content
            when {
                uiState.loading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }
                uiState.erro != null -> {
                    ErrorState(
                        message = uiState.erro!!,
                        onRetry = { viewModel.carregarDados() }
                    )
                }
                uiState.empresas.isEmpty() -> {
                    EmptyEmpresaState(
                        onCriarEmpresa = { viewModel.toggleCriarEmpresa(true) }
                    )
                }
                else -> {
                    when (uiState.tabAtual) {
                        0 -> TabDashboard(uiState)
                        1 -> TabMotoristas(uiState, viewModel)
                        2 -> TabVeiculos(uiState, viewModel)
                        3 -> TabZonas(uiState)
                        4 -> TabDistribuir(uiState)
                    }
                }
            }
        }
        
        // Modal Criar Empresa
        if (uiState.showCriarEmpresa) {
            CriarEmpresaDialog(
                criando = uiState.criandoEmpresa,
                onDismiss = { viewModel.toggleCriarEmpresa(false) },
                onConfirm = { nome, cnpj, endereco, modo ->
                    viewModel.criarEmpresa(nome, cnpj, endereco, modo)
                }
            )
        }
        
        // Modal Criar Motorista
        if (uiState.showCriarMotorista) {
            CriarMotoristaDialog(
                criando = uiState.criandoMotorista,
                temEmpresa = uiState.empresaSelecionada != null,
                onDismiss = { viewModel.toggleCriarMotorista(false) },
                onConfirm = { nome, email, telefone, cpf, tipo ->
                    viewModel.criarMotorista(nome, email, telefone, cpf, tipo)
                },
                onCriarEmpresa = {
                    viewModel.toggleCriarMotorista(false)
                    viewModel.toggleCriarEmpresa(true)
                }
            )
        }
        
        // Snackbar de sucesso
        uiState.mensagemSucesso?.let { mensagem ->
            LaunchedEffect(mensagem) {
                kotlinx.coroutines.delay(3000)
                viewModel.limparMensagemSucesso()
            }
            Snackbar(
                modifier = Modifier.padding(16.dp)
            ) {
                Text(mensagem)
            }
        }
    }
}

// ==========================================
// TAB: DASHBOARD
// ==========================================

@Composable
private fun TabDashboard(uiState: FrotaGestorUiState) {
    val dashboard = uiState.dashboard ?: return
    
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Cards de resumo
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                DashboardCard(
                    modifier = Modifier.weight(1f),
                    emoji = "🚚",
                    valor = dashboard.motoristas.total.toString(),
                    label = "Motoristas",
                    detalhe = "${dashboard.motoristas.porStatus["DISPONIVEL"] ?: 0} disponíveis",
                    cor = BlueActive
                )
                DashboardCard(
                    modifier = Modifier.weight(1f),
                    emoji = "📦",
                    valor = dashboard.entregas.total.toString(),
                    label = "Entregas Hoje",
                    detalhe = "${dashboard.entregas.concluidas} concluídas (${dashboard.entregas.taxaSucesso}%)",
                    cor = GreenSuccess
                )
            }
        }
        
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                DashboardCard(
                    modifier = Modifier.weight(1f),
                    emoji = "📍",
                    valor = "${dashboard.metricas.kmHoje} km",
                    label = "Percorridos",
                    detalhe = "${dashboard.metricas.rotasAtivas} rotas ativas",
                    cor = YellowWarning
                )
                DashboardCard(
                    modifier = Modifier.weight(1f),
                    emoji = "🚗",
                    valor = dashboard.veiculos.disponiveis.toString(),
                    label = "Veículos Livres",
                    detalhe = "${dashboard.veiculos.emUso} em uso",
                    cor = PurpleAccent
                )
            }
        }
        
        // Top Motoristas
        item {
            Text(
                text = "🏆 Top Motoristas",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
        }
        
        items(dashboard.topMotoristas) { motorista ->
            TopMotoristaCard(motorista)
        }
    }
}

@Composable
private fun DashboardCard(
    modifier: Modifier = Modifier,
    emoji: String,
    valor: String,
    label: String,
    detalhe: String,
    cor: Color
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(text = emoji, fontSize = 24.sp)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = valor,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = cor
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium
            )
            Text(
                text = detalhe,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun TopMotoristaCard(motorista: TopMotorista) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Avatar
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = motorista.nome.first().toString(),
                    fontWeight = FontWeight.Bold
                )
            }
            
            Spacer(modifier = Modifier.width(12.dp))
            
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = motorista.nome,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = "Taxa: ${motorista.taxaEntrega}%",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            
            StatusChipGestor(status = motorista.status)
        }
    }
}

// ==========================================
// TAB: MOTORISTAS
// ==========================================

@Composable
private fun TabMotoristas(
    uiState: FrotaGestorUiState,
    viewModel: FrotaGestorViewModel
) {
    Box(modifier = Modifier.fillMaxSize()) {
        if (uiState.motoristas.isEmpty()) {
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text("🚚", fontSize = 48.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Text("Nenhum motorista cadastrado")
                Spacer(modifier = Modifier.height(16.dp))
                Button(onClick = { viewModel.toggleCriarMotorista(true) }) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Adicionar Motorista")
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(uiState.motoristas) { motorista ->
                    MotoristaCard(
                        motorista = motorista,
                        onStatusChange = { novoStatus ->
                            viewModel.atualizarStatusMotorista(motorista.id, novoStatus)
                        }
                    )
                }
            }
        }
        
        // FAB para adicionar motorista
        FloatingActionButton(
            onClick = { viewModel.toggleCriarMotorista(true) },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(16.dp),
            containerColor = MaterialTheme.colorScheme.primary
        ) {
            Icon(Icons.Default.Add, contentDescription = "Adicionar Motorista")
        }
    }
}

@Composable
private fun MotoristaCard(
    motorista: MotoristaGestor,
    onStatusChange: (String) -> Unit
) {
    var showStatusMenu by remember { mutableStateOf(false) }
    
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Avatar
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primaryContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = motorista.nome.first().toString(),
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                
                Spacer(modifier = Modifier.width(12.dp))
                
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = motorista.nome,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = motorista.telefone,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    motorista.veiculoAtual?.let {
                        Text(
                            text = "${it.tipo} - ${it.placa}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
                
                Box {
                    StatusChipGestor(
                        status = motorista.status,
                        onClick = { showStatusMenu = true }
                    )
                    
                    DropdownMenu(
                        expanded = showStatusMenu,
                        onDismissRequest = { showStatusMenu = false }
                    ) {
                        listOf("DISPONIVEL", "EM_ROTA", "PAUSADO", "INDISPONIVEL").forEach { status ->
                            DropdownMenuItem(
                                text = { Text(getStatusLabel(status)) },
                                onClick = {
                                    onStatusChange(status)
                                    showStatusMenu = false
                                }
                            )
                        }
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            // Métricas
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                MetricaItem(
                    label = "Entregas Hoje",
                    valor = motorista.entregasHoje.toString()
                )
                MetricaItem(
                    label = "Taxa Entrega",
                    valor = "${motorista.taxaEntrega}%"
                )
            }
        }
    }
}

// ==========================================
// TAB: VEÍCULOS
// ==========================================

@Composable
private fun TabVeiculos(
    uiState: FrotaGestorUiState,
    viewModel: FrotaGestorViewModel
) {
    if (uiState.veiculos.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("🚗", fontSize = 48.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Text("Nenhum veículo cadastrado")
            }
        }
        return
    }
    
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(uiState.veiculos) { veiculo ->
            VeiculoCard(
                veiculo = veiculo,
                onStatusChange = { novoStatus ->
                    viewModel.atualizarStatusVeiculo(veiculo.id, novoStatus)
                }
            )
        }
    }
}

@Composable
private fun VeiculoCard(
    veiculo: VeiculoGestor,
    onStatusChange: (String) -> Unit
) {
    var showStatusMenu by remember { mutableStateOf(false) }
    
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Ícone do tipo
                Text(
                    text = getVeiculoEmoji(veiculo.tipo),
                    fontSize = 32.sp
                )
                
                Spacer(modifier = Modifier.width(12.dp))
                
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = veiculo.placa,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                    Text(
                        text = "${veiculo.modelo} - ${veiculo.tipo}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    veiculo.motoristaAtual?.let {
                        Text(
                            text = "👤 ${it.nome}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
                
                Box {
                    StatusChipVeiculo(
                        status = veiculo.status,
                        onClick = { showStatusMenu = true }
                    )
                    
                    DropdownMenu(
                        expanded = showStatusMenu,
                        onDismissRequest = { showStatusMenu = false }
                    ) {
                        listOf("DISPONIVEL", "EM_USO", "MANUTENCAO", "RESERVADO").forEach { status ->
                            DropdownMenuItem(
                                text = { Text(getStatusVeiculoLabel(status)) },
                                onClick = {
                                    onStatusChange(status)
                                    showStatusMenu = false
                                }
                            )
                        }
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            // Capacidades
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                MetricaItem(
                    label = "Capacidade",
                    valor = "${veiculo.capacidadeKg} kg"
                )
                MetricaItem(
                    label = "Volumes",
                    valor = "${veiculo.capacidadeVolumes}"
                )
            }
        }
    }
}

// ==========================================
// TAB: ZONAS
// ==========================================

@Composable
private fun TabZonas(uiState: FrotaGestorUiState) {
    if (uiState.zonas.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("📍", fontSize = 48.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Text("Nenhuma zona cadastrada")
            }
        }
        return
    }
    
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(uiState.zonas) { zona ->
            ZonaCard(zona)
        }
    }
}

@Composable
private fun ZonaCard(zona: ZonaGestor) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Cor da zona
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .height(60.dp)
                    .background(
                        color = try { Color(android.graphics.Color.parseColor(zona.cor)) } catch (_: Exception) { GrayNeutral },
                        shape = RoundedCornerShape(2.dp)
                    )
            )
            
            Spacer(modifier = Modifier.width(12.dp))
            
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = zona.nome,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Cidades: ${zona.cidades.joinToString(", ").ifEmpty { "Nenhuma" }}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "Bairros: ${if (zona.bairros.isEmpty()) "Todos" else zona.bairros.take(3).joinToString(", ")}${if (zona.bairros.size > 3) "..." else ""}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            
            Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = zona.countMotoristas.toString(),
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp
                )
                Text(
                    text = "Motoristas",
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}

// ==========================================
// TAB: DISTRIBUIR
// ==========================================

@Composable
private fun TabDistribuir(uiState: FrotaGestorUiState) {
    val modo = uiState.empresaSelecionada?.modoDistribuicao ?: "AUTOMATICO"
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Modo atual
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer
            )
        ) {
            Column(
                modifier = Modifier.padding(16.dp)
            ) {
                Text(
                    text = "Modo de Distribuição",
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = when (modo) {
                        "AUTOMATICO" -> "🤖 Automático"
                        "MANUAL" -> "✋ Manual"
                        else -> "🔄 Híbrido"
                    },
                    fontSize = 20.sp
                )
            }
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        // Ações
        Button(
            onClick = { /* TODO: Importar entregas */ },
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.Default.Upload, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("📄 Importar Entregas (NF-e)")
        }
        
        Spacer(modifier = Modifier.height(12.dp))
        
        OutlinedButton(
            onClick = { /* TODO: Distribuição manual */ },
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.Default.Edit, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("✋ Distribuir Manualmente")
        }
        
        Spacer(modifier = Modifier.height(12.dp))
        
        Button(
            onClick = { /* TODO: Distribuição automática */ },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(
                containerColor = GreenSuccess
            )
        ) {
            Icon(Icons.Default.AutoMode, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("🤖 Distribuição Automática")
        }
    }
}

// ==========================================
// COMPONENTES AUXILIARES
// ==========================================

@Composable
private fun StatusChipGestor(
    status: String,
    onClick: (() -> Unit)? = null
) {
    Surface(
        modifier = if (onClick != null) Modifier.clickable { onClick() } else Modifier,
        shape = RoundedCornerShape(16.dp),
        color = getStatusColor(status).copy(alpha = 0.2f)
    ) {
        Text(
            text = getStatusLabel(status),
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            color = getStatusColor(status),
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
private fun StatusChipVeiculo(
    status: String,
    onClick: (() -> Unit)? = null
) {
    Surface(
        modifier = if (onClick != null) Modifier.clickable { onClick() } else Modifier,
        shape = RoundedCornerShape(16.dp),
        color = getStatusVeiculoColor(status).copy(alpha = 0.2f)
    ) {
        Text(
            text = getStatusVeiculoLabel(status),
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            color = getStatusVeiculoColor(status),
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
private fun MetricaItem(label: String, valor: String) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = valor,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun ErrorState(message: String, onRetry: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("❌", fontSize = 48.sp)
            Spacer(modifier = Modifier.height(8.dp))
            Text(text = message)
            Spacer(modifier = Modifier.height(16.dp))
            Button(onClick = onRetry) {
                Text("Tentar novamente")
            }
        }
    }
}

@Composable
private fun EmptyEmpresaState(
    onCriarEmpresa: () -> Unit = {}
) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("🏢", fontSize = 48.sp)
            Spacer(modifier = Modifier.height(8.dp))
            Text("Nenhuma empresa cadastrada")
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Crie sua empresa para começar",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(16.dp))
            Button(onClick = onCriarEmpresa) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Criar Empresa")
            }
        }
    }
}

// ==========================================
// DIALOGS
// ==========================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CriarEmpresaDialog(
    criando: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (nome: String, cnpj: String, endereco: String, modo: String) -> Unit
) {
    var nome by remember { mutableStateOf("") }
    var cnpj by remember { mutableStateOf("") }
    var endereco by remember { mutableStateOf("") }
    var modoDistribuicao by remember { mutableStateOf("AUTOMATICO") }
    var modoExpanded by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = { if (!criando) onDismiss() },
        title = { Text("🏢 Criar Nova Empresa") },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = nome,
                    onValueChange = { nome = it },
                    label = { Text("Nome da Empresa *") },
                    placeholder = { Text("Ex: Transportadora XYZ") },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !criando,
                    singleLine = true
                )
                
                OutlinedTextField(
                    value = cnpj,
                    onValueChange = { cnpj = it },
                    label = { Text("CNPJ") },
                    placeholder = { Text("00.000.000/0000-00") },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !criando,
                    singleLine = true
                )
                
                OutlinedTextField(
                    value = endereco,
                    onValueChange = { endereco = it },
                    label = { Text("Endereço Base") },
                    placeholder = { Text("Rua, número, bairro, cidade") },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !criando,
                    singleLine = true
                )
                
                ExposedDropdownMenuBox(
                    expanded = modoExpanded,
                    onExpandedChange = { modoExpanded = it }
                ) {
                    OutlinedTextField(
                        value = when (modoDistribuicao) {
                            "AUTOMATICO" -> "Automático (IA distribui)"
                            "MANUAL" -> "Manual (você distribui)"
                            "HIBRIDO" -> "Híbrido (IA sugere)"
                            else -> modoDistribuicao
                        },
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Modo de Distribuição") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = modoExpanded) },
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth(),
                        enabled = !criando
                    )
                    ExposedDropdownMenu(
                        expanded = modoExpanded,
                        onDismissRequest = { modoExpanded = false }
                    ) {
                        listOf(
                            "AUTOMATICO" to "Automático (IA distribui)",
                            "MANUAL" to "Manual (você distribui)",
                            "HIBRIDO" to "Híbrido (IA sugere)"
                        ).forEach { (value, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    modoDistribuicao = value
                                    modoExpanded = false
                                }
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onConfirm(nome, cnpj, endereco, modoDistribuicao) },
                enabled = nome.isNotBlank() && !criando
            ) {
                if (criando) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text(if (criando) "Criando..." else "Criar Empresa")
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                enabled = !criando
            ) {
                Text("Cancelar")
            }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CriarMotoristaDialog(
    criando: Boolean,
    temEmpresa: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (nome: String, email: String, telefone: String, cpf: String, tipo: String) -> Unit,
    onCriarEmpresa: () -> Unit
) {
    var nome by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var telefone by remember { mutableStateOf("") }
    var cpf by remember { mutableStateOf("") }
    var tipoMotorista by remember { mutableStateOf("VINCULADO") }
    var tipoExpanded by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = { if (!criando) onDismiss() },
        title = { Text("🚚 Adicionar Motorista") },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Tipo de motorista
                ExposedDropdownMenuBox(
                    expanded = tipoExpanded,
                    onExpandedChange = { tipoExpanded = it }
                ) {
                    OutlinedTextField(
                        value = when (tipoMotorista) {
                            "VINCULADO" -> "Vinculado à Empresa"
                            "AUTONOMO" -> "Autônomo"
                            "AUTONOMO_PARCEIRO" -> "Autônomo Parceiro"
                            else -> tipoMotorista
                        },
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Tipo de Motorista *") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = tipoExpanded) },
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth(),
                        enabled = !criando
                    )
                    ExposedDropdownMenu(
                        expanded = tipoExpanded,
                        onDismissRequest = { tipoExpanded = false }
                    ) {
                        listOf(
                            "VINCULADO" to "Vinculado à Empresa",
                            "AUTONOMO" to "Autônomo",
                            "AUTONOMO_PARCEIRO" to "Autônomo Parceiro"
                        ).forEach { (value, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    tipoMotorista = value
                                    tipoExpanded = false
                                }
                            )
                        }
                    }
                }
                
                // Hint sobre tipo
                Text(
                    text = when (tipoMotorista) {
                        "VINCULADO" -> "Motorista que trabalha para sua empresa"
                        "AUTONOMO" -> "Motorista independente, entregas avulsas"
                        "AUTONOMO_PARCEIRO" -> "Autônomo com parceria preferencial"
                        else -> ""
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                
                // Alerta se VINCULADO sem empresa
                if (tipoMotorista == "VINCULADO" && !temEmpresa) {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = YellowWarning.copy(alpha = 0.2f)
                        )
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("⚠️", fontSize = 20.sp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Crie uma empresa primeiro",
                                    fontWeight = FontWeight.Medium,
                                    fontSize = 14.sp
                                )
                                TextButton(
                                    onClick = onCriarEmpresa,
                                    contentPadding = PaddingValues(0.dp)
                                ) {
                                    Text("Criar Empresa →")
                                }
                            }
                        }
                    }
                }
                
                OutlinedTextField(
                    value = nome,
                    onValueChange = { nome = it },
                    label = { Text("Nome *") },
                    placeholder = { Text("Nome completo") },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !criando,
                    singleLine = true
                )
                
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email *") },
                    placeholder = { Text("email@exemplo.com") },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !criando,
                    singleLine = true
                )
                
                OutlinedTextField(
                    value = telefone,
                    onValueChange = { telefone = it },
                    label = { Text("Telefone *") },
                    placeholder = { Text("(00) 00000-0000") },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !criando,
                    singleLine = true
                )
                
                OutlinedTextField(
                    value = cpf,
                    onValueChange = { cpf = it },
                    label = { Text("CPF") },
                    placeholder = { Text("000.000.000-00") },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !criando,
                    singleLine = true
                )
            }
        },
        confirmButton = {
            val podeConfirmar = nome.isNotBlank() && email.isNotBlank() && telefone.isNotBlank() &&
                    (tipoMotorista != "VINCULADO" || temEmpresa)
            
            Button(
                onClick = { onConfirm(nome, email, telefone, cpf, tipoMotorista) },
                enabled = podeConfirmar && !criando
            ) {
                if (criando) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text(if (criando) "Criando..." else "Adicionar")
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                enabled = !criando
            ) {
                Text("Cancelar")
            }
        }
    )
}

// ==========================================
// HELPERS
// ==========================================

private fun getStatusColor(status: String): Color = when (status) {
    "DISPONIVEL" -> GreenSuccess
    "EM_ROTA" -> BlueActive
    "PAUSADO" -> YellowWarning
    "INDISPONIVEL" -> RedError
    "OFFLINE" -> GrayNeutral
    else -> GrayNeutral
}

private fun getStatusLabel(status: String): String = when (status) {
    "DISPONIVEL" -> "Disponível"
    "EM_ROTA" -> "Em Rota"
    "PAUSADO" -> "Pausado"
    "INDISPONIVEL" -> "Indisponível"
    "OFFLINE" -> "Offline"
    else -> status
}

private fun getStatusVeiculoColor(status: String): Color = when (status) {
    "DISPONIVEL" -> GreenSuccess
    "EM_USO" -> BlueActive
    "MANUTENCAO" -> YellowWarning
    "RESERVADO" -> PurpleAccent
    "INATIVO" -> GrayNeutral
    else -> GrayNeutral
}

private fun getStatusVeiculoLabel(status: String): String = when (status) {
    "DISPONIVEL" -> "Disponível"
    "EM_USO" -> "Em Uso"
    "MANUTENCAO" -> "Manutenção"
    "RESERVADO" -> "Reservado"
    "INATIVO" -> "Inativo"
    else -> status
}

private fun getVeiculoEmoji(tipo: String): String = when (tipo.uppercase()) {
    "MOTO" -> "🏍️"
    "CARRO" -> "🚗"
    "VAN" -> "🚐"
    "CAMINHAO", "CAMINHÃO" -> "🚚"
    "BICICLETA" -> "🚲"
    else -> "🚗"
}
