package br.com.speedrota.ui.screens.destinos

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import br.com.speedrota.data.model.Fornecedor
import br.com.speedrota.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DestinosScreen(
    viewModel: DestinosViewModel = hiltViewModel(),
    onCalcularRota: () -> Unit,
    onBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    var showAddDialog by remember { mutableStateOf(false) }
    var novoEndereco by remember { mutableStateOf("") }
    var selectedFornecedor by remember { mutableStateOf(Fornecedor.OUTRO) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Destinos (${uiState.destinos.size})") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        },
        floatingActionButton = {
            Column {
                // FAB Câmera (OCR)
                FloatingActionButton(
                    onClick = viewModel::openCamera,
                    containerColor = MaterialTheme.colorScheme.secondary,
                    modifier = Modifier.padding(bottom = 8.dp)
                ) {
                    Icon(Icons.Default.CameraAlt, contentDescription = "Escanear NF-e")
                }
                
                // FAB Adicionar manual
                FloatingActionButton(
                    onClick = { showAddDialog = true },
                    containerColor = Primary
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Adicionar endereço")
                }
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(paddingValues)
        ) {
            // Info quando vazio
            if (uiState.destinos.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(32.dp)
                    ) {
                        Text("📍", fontSize = 64.sp)
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Nenhum destino adicionado",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Escaneie notas fiscais ou adicione endereços manualmente",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                // Lista de destinos
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    itemsIndexed(
                        items = uiState.destinos,
                        key = { _, item -> item.id }
                    ) { index, destino ->
                        DestinoCard(
                            destino = destino,
                            index = index + 1,
                            onRemove = { viewModel.removeDestino(destino.id) },
                            onFornecedorChange = { viewModel.setFornecedor(destino.id, it) }
                        )
                    }
                }
                
                // Botão calcular rota
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    Button(
                        onClick = onCalcularRota,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp),
                        enabled = uiState.destinos.isNotEmpty()
                    ) {
                        Icon(Icons.Default.Route, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Calcular Rota Otimizada",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }

    // Dialog adicionar endereço
    if (showAddDialog) {
        AlertDialog(
            onDismissRequest = { showAddDialog = false },
            title = { Text("Adicionar Destino") },
            text = {
                Column {
                    OutlinedTextField(
                        value = novoEndereco,
                        onValueChange = { novoEndereco = it },
                        label = { Text("Endereço") },
                        placeholder = { Text("Ex: Rua das Flores, 123 - SP") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    Text(
                        text = "Fornecedor",
                        style = MaterialTheme.typography.labelMedium
                    )
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    // Chips de fornecedores
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Fornecedor.entries.take(4).forEach { fornecedor ->
                            FilterChip(
                                selected = selectedFornecedor == fornecedor,
                                onClick = { selectedFornecedor = fornecedor },
                                label = { Text(fornecedor.emoji) }
                            )
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (novoEndereco.isNotBlank()) {
                            viewModel.addDestino(novoEndereco, selectedFornecedor)
                            novoEndereco = ""
                            selectedFornecedor = Fornecedor.OUTRO
                            showAddDialog = false
                        }
                    }
                ) {
                    Text("Adicionar")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddDialog = false }) {
                    Text("Cancelar")
                }
            }
        )
    }
}

@Composable
fun DestinoCard(
    destino: DestinoItem,
    index: Int,
    onRemove: () -> Unit,
    onFornecedorChange: (Fornecedor) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Número
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .background(
                        color = Color(destino.fornecedor.colorHex).copy(alpha = 0.2f),
                        shape = RoundedCornerShape(8.dp)
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = destino.fornecedor.emoji,
                    fontSize = 20.sp
                )
            }
            
            Spacer(modifier = Modifier.width(12.dp))
            
            // Endereço
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Destino $index",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color(destino.fornecedor.colorHex)
                )
                Text(
                    text = destino.endereco,
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 2
                )
            }
            
            // Botão remover
            IconButton(onClick = onRemove) {
                Icon(
                    Icons.Default.Close,
                    contentDescription = "Remover",
                    tint = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}
