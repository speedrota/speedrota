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
    onScanQrCode: () -> Unit = {},
    onBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    var showAddDialog by remember { mutableStateOf(false) }
    var novoEndereco by remember { mutableStateOf("") }
    var selectedFornecedor by remember { mutableStateOf(Fornecedor.OUTRO) }
    var janelaInicio by remember { mutableStateOf("") }
    var janelaFim by remember { mutableStateOf("") }
    var prioridade by remember { mutableStateOf("MEDIA") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Adicionar Destinos") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(paddingValues)
                .padding(16.dp)
        ) {
            // ========== BOTÕES DE AÇÃO NO TOPO ==========

            // Botão Escanear NF-e
            Button(
                onClick = onScanQrCode,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Primary)
            ) {
                Text("📷 Escanear NF-e (Imagem/PDF)", fontSize = 16.sp)
            }

            Text(
                text = "Formatos aceitos: PNG, JPG, JPEG, PDF",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(start = 4.dp, top = 4.dp)
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Botão Adicionar Manualmente
            OutlinedButton(
                onClick = { showAddDialog = true },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("✏️ Adicionar Manualmente")
            }

            Spacer(modifier = Modifier.height(24.dp))

            // ========== LISTA DE ENTREGAS ==========
            Text(
                text = "Entregas (${uiState.destinos.size})",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(12.dp))

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
                        Text("📦", fontSize = 48.sp)
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Nenhum destino adicionado.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = "Escaneie uma NF-e ou adicione manualmente.",
                            style = MaterialTheme.typography.bodySmall,
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
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    itemsIndexed(
                        items = uiState.destinos,
                        key = { _, item -> item.id }
                    ) { index, destino ->
                        DestinoCard(
                            destino = destino,
                            index = index + 1,
                            onRemove = { viewModel.removeDestino(destino.id) }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // ========== BOTÃO CALCULAR ROTA ==========
            Button(
                onClick = onCalcularRota,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(12.dp),
                enabled = uiState.destinos.isNotEmpty(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (uiState.destinos.isNotEmpty()) Primary else Primary.copy(alpha = 0.5f)
                )
            ) {
                Text("🧭 Calcular Rota Otimizada", fontSize = 16.sp)
            }

            if (uiState.destinos.isEmpty()) {
                Text(
                    text = "Adicione pelo menos 1 destino para calcular",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .align(Alignment.CenterHorizontally)
                        .padding(top = 4.dp)
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Botão Alterar Origem
            TextButton(
                onClick = onBack,
                modifier = Modifier.align(Alignment.CenterHorizontally)
            ) {
                Text("← Alterar Origem")
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

                    Spacer(modifier = Modifier.height(16.dp))

                    // Janela de tempo
                    Text(
                        text = "⏰ Janela de Entrega (opcional)",
                        style = MaterialTheme.typography.labelMedium
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = janelaInicio,
                            onValueChange = { janelaInicio = it },
                            label = { Text("Início") },
                            placeholder = { Text("08:00") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = janelaFim,
                            onValueChange = { janelaFim = it },
                            label = { Text("Fim") },
                            placeholder = { Text("12:00") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Prioridade
                    Text(
                        text = "🎯 Prioridade",
                        style = MaterialTheme.typography.labelMedium
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        FilterChip(
                            selected = prioridade == "ALTA",
                            onClick = { prioridade = "ALTA" },
                            label = { Text("🔴 Alta") }
                        )
                        FilterChip(
                            selected = prioridade == "MEDIA",
                            onClick = { prioridade = "MEDIA" },
                            label = { Text("🟡 Média") }
                        )
                        FilterChip(
                            selected = prioridade == "BAIXA",
                            onClick = { prioridade = "BAIXA" },
                            label = { Text("🟢 Baixa") }
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (novoEndereco.isNotBlank()) {
                            viewModel.addDestino(
                                endereco = novoEndereco,
                                fornecedor = selectedFornecedor,
                                janelaInicio = janelaInicio.takeIf { it.isNotBlank() },
                                janelaFim = janelaFim.takeIf { it.isNotBlank() },
                                prioridade = prioridade
                            )
                            novoEndereco = ""
                            selectedFornecedor = Fornecedor.OUTRO
                            janelaInicio = ""
                            janelaFim = ""
                            prioridade = "MEDIA"
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
    onRemove: () -> Unit
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
