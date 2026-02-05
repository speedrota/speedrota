/**
 * @fileoverview Tela de Frota para Motoristas Android
 *
 * DESIGN POR CONTRATO:
 * @description Interface do motorista para ver rotas atribuídas
 * @pre Motorista autenticado e vinculado a uma empresa
 * @post Visualização e controle de rotas atribuídas
 */

package br.com.speedrota.ui.screens.frota

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
import kotlinx.coroutines.launch

// ==========================================
// DATA CLASSES
// ==========================================

data class RotaAtribuida(
    val id: String,
    val totalEntregas: Int,
    val entregasConcluidas: Int,
    val distanciaKm: Float,
    val tempoEstimadoMin: Int,
    val status: StatusRota,
    val criadoEm: String,
    val paradas: List<ParadaRota>
)

data class ParadaRota(
    val id: String,
    val ordem: Int,
    val endereco: String,
    val bairro: String?,
    val cidade: String,
    val uf: String,
    val lat: Double,
    val lng: Double,
    val status: StatusParada,
    val prioridade: String,
    val janelaFim: String?,
    val volumes: Int
)

enum class StatusRota {
    PENDENTE, EM_ANDAMENTO, CONCLUIDA, CANCELADA
}

enum class StatusParada {
    PENDENTE, EM_ANDAMENTO, ENTREGUE, NAO_ENTREGUE, PULADA
}

enum class StatusMotorista {
    DISPONIVEL, EM_ROTA, PAUSADO, INDISPONIVEL, OFFLINE
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TelaFrotaMotorista(
    onNavigateBack: () -> Unit,
    onNavigateToRota: (String) -> Unit,
    viewModel: FrotaMotoristaViewModel = androidx.lifecycle.viewmodel.compose.viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val scope = rememberCoroutineScope()
    var showStatusDialog by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        viewModel.carregarDados()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text("Minhas Entregas", fontWeight = FontWeight.Bold)
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Voltar")
                    }
                },
                actions = {
                    // Botão de status
                    StatusChip(
                        status = uiState.meuStatus,
                        onClick = { showStatusDialog = true }
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Resumo do dia
            ResumoDodia(uiState = uiState)

            when {
                uiState.loading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }
                uiState.rotas.isEmpty() -> {
                    EmptyState()
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(uiState.rotas) { rota ->
                            RotaCard(
                                rota = rota,
                                onClick = { onNavigateToRota(rota.id) },
                                onIniciar = { viewModel.iniciarRota(rota.id) }
                            )
                        }
                    }
                }
            }
        }
    }

    // Dialog de alteração de status
    if (showStatusDialog) {
        StatusDialog(
            currentStatus = uiState.meuStatus,
            onDismiss = { showStatusDialog = false },
            onConfirm = { novoStatus ->
                scope.launch {
                    viewModel.atualizarStatus(novoStatus)
                }
                showStatusDialog = false
            }
        )
    }
}

// ==========================================
// COMPONENTES AUXILIARES
// ==========================================

@Composable
fun ResumoDodia(uiState: FrotaUiState) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            ResumoItem(
                valor = uiState.totalEntregas.toString(),
                label = "Entregas",
                icon = Icons.Default.LocalShipping
            )
            ResumoItem(
                valor = uiState.entregasConcluidas.toString(),
                label = "Concluídas",
                icon = Icons.Default.CheckCircle
            )
            ResumoItem(
                valor = String.format("%.1f km", uiState.kmRodados),
                label = "Rodados",
                icon = Icons.Default.Route
            )
        }
    }
}

@Composable
fun ResumoItem(
    valor: String,
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = valor,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onPrimaryContainer
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
        )
    }
}

@Composable
fun StatusChip(
    status: StatusMotorista,
    onClick: () -> Unit
) {
    val (cor, texto) = when (status) {
        StatusMotorista.DISPONIVEL -> Color(0xFF22C55E) to "Disponível"
        StatusMotorista.EM_ROTA -> Color(0xFF3B82F6) to "Em Rota"
        StatusMotorista.PAUSADO -> Color(0xFFF59E0B) to "Pausado"
        StatusMotorista.INDISPONIVEL -> Color(0xFFEF4444) to "Indisponível"
        StatusMotorista.OFFLINE -> Color(0xFF6B7280) to "Offline"
    }

    Surface(
        modifier = Modifier.clickable { onClick() },
        shape = RoundedCornerShape(16.dp),
        color = cor.copy(alpha = 0.2f)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(cor)
            )
            Text(
                text = texto,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onPrimary,
                fontWeight = FontWeight.Medium
            )
            Icon(
                Icons.Default.KeyboardArrowDown,
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.onPrimary
            )
        }
    }
}

@Composable
fun RotaCard(
    rota: RotaAtribuida,
    onClick: () -> Unit,
    onIniciar: () -> Unit
) {
    val progresso = if (rota.totalEntregas > 0) {
        rota.entregasConcluidas.toFloat() / rota.totalEntregas
    } else 0f

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                StatusBadge(status = rota.status)
                Text(
                    text = rota.criadoEm,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Stats
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = "${rota.totalEntregas} entregas",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "${rota.distanciaKm} km • ${rota.tempoEstimadoMin} min",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Text(
                    text = "${rota.entregasConcluidas}/${rota.totalEntregas}",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Progress bar
            LinearProgressIndicator(
                progress = { progresso },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp)),
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.surfaceVariant
            )

            // Botão iniciar (se pendente)
            if (rota.status == StatusRota.PENDENTE) {
                Spacer(modifier = Modifier.height(12.dp))
                Button(
                    onClick = onIniciar,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary
                    )
                ) {
                    Icon(Icons.Default.PlayArrow, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Iniciar Rota")
                }
            }
        }
    }
}

@Composable
fun StatusBadge(status: StatusRota) {
    val (cor, texto) = when (status) {
        StatusRota.PENDENTE -> Color(0xFFF59E0B) to "Pendente"
        StatusRota.EM_ANDAMENTO -> Color(0xFF3B82F6) to "Em Andamento"
        StatusRota.CONCLUIDA -> Color(0xFF22C55E) to "Concluída"
        StatusRota.CANCELADA -> Color(0xFFEF4444) to "Cancelada"
    }

    Surface(
        shape = RoundedCornerShape(4.dp),
        color = cor.copy(alpha = 0.15f)
    ) {
        Text(
            text = texto,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            color = cor,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
fun EmptyState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.LocalShipping,
            contentDescription = null,
            modifier = Modifier.size(80.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Nenhuma rota atribuída",
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Aguarde novas atribuições do gestor",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
        )
    }
}

@Composable
fun StatusDialog(
    currentStatus: StatusMotorista,
    onDismiss: () -> Unit,
    onConfirm: (StatusMotorista) -> Unit
) {
    var selected by remember { mutableStateOf(currentStatus) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Alterar Status") },
        text = {
            Column {
                StatusMotorista.entries.forEach { status ->
                    if (status != StatusMotorista.OFFLINE) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { selected = status }
                                .padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(
                                selected = selected == status,
                                onClick = { selected = status }
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = when (status) {
                                    StatusMotorista.DISPONIVEL -> "Disponível"
                                    StatusMotorista.EM_ROTA -> "Em Rota"
                                    StatusMotorista.PAUSADO -> "Pausado"
                                    StatusMotorista.INDISPONIVEL -> "Indisponível"
                                    else -> status.name
                                }
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(selected) }) {
                Text("Confirmar")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
}

// ==========================================
// UI STATE
// ==========================================

data class FrotaUiState(
    val loading: Boolean = true,
    val meuStatus: StatusMotorista = StatusMotorista.DISPONIVEL,
    val rotas: List<RotaAtribuida> = emptyList(),
    val totalEntregas: Int = 0,
    val entregasConcluidas: Int = 0,
    val kmRodados: Float = 0f,
    val erro: String? = null
)
