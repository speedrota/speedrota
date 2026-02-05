/**
 * @fileoverview Tela de Detalhes da Rota para Execução de Entregas
 *
 * DESIGN POR CONTRATO:
 * @description Interface para motorista executar entregas da rota
 * @pre Rota atribuída carregada
 * @post Entregas marcadas como realizadas ou não
 */

package br.com.speedrota.ui.screens.frota

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TelaRotaExecucao(
    rotaId: String,
    onNavigateBack: () -> Unit,
    viewModel: FrotaMotoristaViewModel = androidx.lifecycle.viewmodel.compose.viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    var showEntregaDialog by remember { mutableStateOf<ParadaRota?>(null) }
    var showNaoEntregueDialog by remember { mutableStateOf<ParadaRota?>(null) }

    val rota = uiState.rotas.find { it.id == rotaId }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Rota ${rotaId.take(8)}", fontWeight = FontWeight.Bold)
                        rota?.let {
                            Text(
                                "${it.entregasConcluidas}/${it.totalEntregas} entregas",
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Voltar")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        },
        floatingActionButton = {
            rota?.paradas?.firstOrNull { it.status == StatusParada.PENDENTE }?.let { proxima ->
                ExtendedFloatingActionButton(
                    onClick = { abrirNavegacao(context, proxima.lat, proxima.lng) },
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary
                ) {
                    Icon(Icons.Default.Navigation, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Navegar")
                }
            }
        }
    ) { padding ->
        if (rota == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Resumo da rota
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            "${rota.distanciaKm} km",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            "Distância",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            "${rota.tempoEstimadoMin} min",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            "Tempo est.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        val progresso = if (rota.totalEntregas > 0) {
                            (rota.entregasConcluidas * 100) / rota.totalEntregas
                        } else 0
                        Text(
                            "$progresso%",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = if (progresso == 100) Color(0xFF22C55E) else MaterialTheme.colorScheme.primary
                        )
                        Text(
                            "Progresso",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            // Lista de paradas
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                itemsIndexed(rota.paradas) { index, parada ->
                    ParadaCard(
                        parada = parada,
                        ordem = index + 1,
                        onClick = {
                            when (parada.status) {
                                StatusParada.PENDENTE, StatusParada.EM_ANDAMENTO -> {
                                    showEntregaDialog = parada
                                }
                                else -> { /* Já processada */ }
                            }
                        },
                        onNavigate = { abrirNavegacao(context, parada.lat, parada.lng) }
                    )
                }
            }
        }
    }

    // Dialog de confirmação de entrega
    showEntregaDialog?.let { parada ->
        AlertDialog(
            onDismissRequest = { showEntregaDialog = null },
            title = { Text("Confirmar Entrega") },
            text = {
                Column {
                    Text("Endereço: ${parada.endereco}")
                    parada.bairro?.let { Text("Bairro: $it") }
                    Text("${parada.volumes} volume(s)")
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.marcarEntregue(parada.id)
                        showEntregaDialog = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF22C55E))
                ) {
                    Icon(Icons.Default.Check, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Entregue")
                }
            },
            dismissButton = {
                OutlinedButton(
                    onClick = {
                        showEntregaDialog = null
                        showNaoEntregueDialog = parada
                    },
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFEF4444))
                ) {
                    Icon(Icons.Default.Close, contentDescription = null)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Não Entregue")
                }
            }
        )
    }

    // Dialog de motivo para não entrega
    showNaoEntregueDialog?.let { parada ->
        var motivo by remember { mutableStateOf("") }
        val motivos = listOf(
            "Cliente ausente",
            "Endereço não encontrado",
            "Recusado pelo cliente",
            "Estabelecimento fechado",
            "Outro"
        )

        AlertDialog(
            onDismissRequest = { showNaoEntregueDialog = null },
            title = { Text("Motivo da Não Entrega") },
            text = {
                Column {
                    motivos.forEach { m ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { motivo = m }
                                .padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(
                                selected = motivo == m,
                                onClick = { motivo = m }
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(m)
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (motivo.isNotEmpty()) {
                            viewModel.marcarNaoEntregue(parada.id, motivo)
                            showNaoEntregueDialog = null
                        }
                    },
                    enabled = motivo.isNotEmpty()
                ) {
                    Text("Confirmar")
                }
            },
            dismissButton = {
                TextButton(onClick = { showNaoEntregueDialog = null }) {
                    Text("Cancelar")
                }
            }
        )
    }
}

@Composable
fun ParadaCard(
    parada: ParadaRota,
    ordem: Int,
    onClick: () -> Unit,
    onNavigate: () -> Unit
) {
    val (bgColor, iconColor, icon) = when (parada.status) {
        StatusParada.PENDENTE -> Triple(
            MaterialTheme.colorScheme.surface,
            MaterialTheme.colorScheme.primary,
            Icons.Default.RadioButtonUnchecked
        )
        StatusParada.EM_ANDAMENTO -> Triple(
            Color(0xFFEFF6FF),
            Color(0xFF3B82F6),
            Icons.Default.PlayCircle
        )
        StatusParada.ENTREGUE -> Triple(
            Color(0xFFF0FDF4),
            Color(0xFF22C55E),
            Icons.Default.CheckCircle
        )
        StatusParada.NAO_ENTREGUE -> Triple(
            Color(0xFFFEF2F2),
            Color(0xFFEF4444),
            Icons.Default.Cancel
        )
        StatusParada.PULADA -> Triple(
            Color(0xFFFFFBEB),
            Color(0xFFF59E0B),
            Icons.Default.SkipNext
        )
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = parada.status == StatusParada.PENDENTE) { onClick() },
        colors = CardDefaults.cardColors(containerColor = bgColor),
        elevation = CardDefaults.cardElevation(
            defaultElevation = if (parada.status == StatusParada.PENDENTE) 2.dp else 0.dp
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Ordem e status
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(iconColor.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                if (parada.status == StatusParada.PENDENTE) {
                    Text(
                        "$ordem",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = iconColor
                    )
                } else {
                    Icon(
                        icon,
                        contentDescription = null,
                        tint = iconColor,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Info
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        parada.endereco,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    
                    // Badge de prioridade
                    if (parada.prioridade == "ALTA") {
                        Spacer(modifier = Modifier.width(8.dp))
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = Color(0xFFEF4444).copy(alpha = 0.1f)
                        ) {
                            Text(
                                "URGENTE",
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = Color(0xFFEF4444),
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "${parada.bairro ?: ""} - ${parada.cidade}/${parada.uf}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    
                    Spacer(modifier = Modifier.width(8.dp))
                    
                    Text(
                        "${parada.volumes} vol",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    parada.janelaFim?.let {
                        Spacer(modifier = Modifier.width(8.dp))
                        Icon(
                            Icons.Default.Schedule,
                            contentDescription = null,
                            modifier = Modifier.size(12.dp),
                            tint = if (isJanelaProxima(it)) Color(0xFFEF4444) else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.width(2.dp))
                        Text(
                            "até $it",
                            style = MaterialTheme.typography.labelSmall,
                            color = if (isJanelaProxima(it)) Color(0xFFEF4444) else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            // Botão de navegação
            if (parada.status == StatusParada.PENDENTE) {
                IconButton(onClick = onNavigate) {
                    Icon(
                        Icons.Default.Navigation,
                        contentDescription = "Navegar",
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }
    }
}

// ==========================================
// HELPERS
// ==========================================

private fun abrirNavegacao(context: android.content.Context, lat: Double, lng: Double) {
    // Preferência: Google Maps > Waze > Browser
    val googleMapsIntent = Intent(Intent.ACTION_VIEW).apply {
        data = Uri.parse("google.navigation:q=$lat,$lng&mode=d")
        `package` = "com.google.android.apps.maps"
    }

    val wazeIntent = Intent(Intent.ACTION_VIEW).apply {
        data = Uri.parse("https://waze.com/ul?ll=$lat,$lng&navigate=yes")
    }

    val browserIntent = Intent(Intent.ACTION_VIEW).apply {
        data = Uri.parse("https://www.google.com/maps/dir/?api=1&destination=$lat,$lng")
    }

    try {
        context.startActivity(googleMapsIntent)
    } catch (e: Exception) {
        try {
            context.startActivity(wazeIntent)
        } catch (e: Exception) {
            context.startActivity(browserIntent)
        }
    }
}

private fun isJanelaProxima(janela: String): Boolean {
    // Verifica se a janela está próxima (menos de 30 min)
    return try {
        val parts = janela.split(":")
        val horaJanela = parts[0].toInt()
        val minJanela = parts[1].toInt()
        
        val cal = java.util.Calendar.getInstance()
        val horaAtual = cal.get(java.util.Calendar.HOUR_OF_DAY)
        val minAtual = cal.get(java.util.Calendar.MINUTE)
        
        val minRestantes = (horaJanela * 60 + minJanela) - (horaAtual * 60 + minAtual)
        minRestantes in 0..30
    } catch (e: Exception) {
        false
    }
}
