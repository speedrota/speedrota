package br.com.speedrota.ui.tracking

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.speedrota.data.util.StatusTempoRealService
import br.com.speedrota.data.util.StatusTempoRealService.MetricasTempoReal
import br.com.speedrota.data.util.StatusTempoRealService.MotivoFalha
import br.com.speedrota.data.util.StatusTempoRealService.StatusParada
import br.com.speedrota.data.util.StatusTempoRealService.StatusRota

/**
 * @description Componentes UI para Status em Tempo Real
 *
 * DESIGN POR CONTRATO:
 * @pre Dados de rota e paradas disponíveis
 * @post UI atualizada em tempo real
 */

// ==========================================
// INDICADOR DE CONEXÃO
// ==========================================

@Composable
fun IndicadorConexao(
    conectado: Boolean,
    modifier: Modifier = Modifier
) {
    val backgroundColor by animateColorAsState(
        targetValue = if (conectado) Color(0xFFDCFCE7) else Color(0xFFFEF3C7),
        label = "conexao_bg"
    )
    val textColor = if (conectado) Color(0xFF16A34A) else Color(0xFFD97706)
    
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(50),
        color = backgroundColor
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(if (conectado) Color(0xFF22C55E) else Color(0xFFF59E0B))
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = if (conectado) "Conectado" else "Reconectando...",
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = textColor
            )
        }
    }
}

// ==========================================
// BARRA DE PROGRESSO
// ==========================================

@Composable
fun BarraProgresso(
    progresso: Int,
    entregues: Int,
    total: Int,
    modifier: Modifier = Modifier
) {
    val animatedProgress by animateFloatAsState(
        targetValue = progresso / 100f,
        label = "progress"
    )
    
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "$entregues de $total entregas",
                    fontSize = 14.sp,
                    color = Color(0xFF64748B)
                )
                Text(
                    text = "$progresso%",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary
                )
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            LinearProgressIndicator(
                progress = { animatedProgress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp)),
                trackColor = Color(0xFFE2E8F0),
            )
        }
    }
}

// ==========================================
// CARD MÉTRICAS
// ==========================================

@Composable
fun CardMetricas(
    metricas: MetricasTempoReal,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            // Grid 3x2 de métricas
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                MetricaItem(valor = "${metricas.entregues}", label = "Entregues")
                MetricaItem(valor = "${metricas.pendentes}", label = "Pendentes")
                MetricaItem(
                    valor = "${metricas.falhas}",
                    label = "Falhas",
                    valorColor = Color(0xFFEF4444)
                )
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                MetricaItem(
                    valor = StatusTempoRealService.formatarTempo(metricas.tempoDecorrido),
                    label = "Tempo"
                )
                MetricaItem(valor = "${metricas.kmPercorridos}", label = "Km")
                MetricaItem(
                    valor = StatusTempoRealService.formatarTempo(metricas.tempoEstimadoRestante),
                    label = "Restante"
                )
            }
            
            // Próxima parada
            metricas.proximaParada?.let { proxima ->
                Spacer(modifier = Modifier.height(12.dp))
                
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    color = Color(0xFFEFF6FF)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Próxima:",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = proxima.endereco,
                            fontSize = 14.sp,
                            color = Color(0xFF1E293B),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f)
                        )
                        Text(
                            text = "~${proxima.etaMinutos} min",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun MetricaItem(
    valor: String,
    label: String,
    valorColor: Color = Color(0xFF1E293B)
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .background(Color(0xFFF8FAFC), RoundedCornerShape(8.dp))
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        Text(
            text = valor,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = valorColor
        )
        Text(
            text = label,
            fontSize = 12.sp,
            color = Color(0xFF64748B)
        )
    }
}

// ==========================================
// CONTROLES DA ROTA
// ==========================================

@Composable
fun ControlesRota(
    statusRota: StatusRota?,
    loading: Boolean,
    onIniciar: () -> Unit,
    onPausar: () -> Unit,
    onFinalizar: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        when (statusRota) {
            StatusRota.PLANEJADA, StatusRota.PAUSADA -> {
                Button(
                    onClick = onIniciar,
                    enabled = !loading,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.PlayArrow, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(if (statusRota == StatusRota.PAUSADA) "Retomar" else "Iniciar Rota")
                }
            }
            StatusRota.EM_ANDAMENTO -> {
                OutlinedButton(
                    onClick = onPausar,
                    enabled = !loading,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.Pause, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Pausar")
                }
                
                Spacer(modifier = Modifier.width(12.dp))
                
                Button(
                    onClick = onFinalizar,
                    enabled = !loading,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF22C55E)
                    ),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.Flag, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Finalizar")
                }
            }
            StatusRota.CONCLUIDA -> {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    color = Color(0xFFDCFCE7)
                ) {
                    Text(
                        text = "🎉 Rota Concluída!",
                        modifier = Modifier.padding(16.dp),
                        fontSize = 18.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF16A34A)
                    )
                }
            }
            else -> {}
        }
    }
}

// ==========================================
// ITEM PARADA
// ==========================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ItemParada(
    ordem: Int,
    nome: String,
    endereco: String,
    status: StatusParada,
    emAndamento: Boolean,
    onAtualizarStatus: (StatusParada, MotivoFalha?, String?) -> Unit,
    modifier: Modifier = Modifier
) {
    var expandido by remember { mutableStateOf(false) }
    var motivoSelecionado by remember { mutableStateOf<MotivoFalha?>(null) }
    var observacao by remember { mutableStateOf("") }
    var dropdownExpanded by remember { mutableStateOf(false) }
    
    val podeAtualizar = emAndamento && status != StatusParada.ENTREGUE && status != StatusParada.CANCELADO
    val corStatus = Color(StatusTempoRealService.corPorStatus(status))
    
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable { if (podeAtualizar) expandido = !expandido },
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Número da ordem
                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(
                            when (status) {
                                StatusParada.ENTREGUE -> Color(0xFF22C55E)
                                StatusParada.FALHA -> Color(0xFFEF4444)
                                else -> MaterialTheme.colorScheme.primary
                            }
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "$ordem",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White
                    )
                }
                
                Spacer(modifier = Modifier.width(12.dp))
                
                // Info
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = nome.ifEmpty { "Destinatário" },
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = endereco,
                        fontSize = 12.sp,
                        color = Color(0xFF64748B),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                
                Spacer(modifier = Modifier.width(8.dp))
                
                // Badge status
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = corStatus
                ) {
                    Text(
                        text = "${StatusTempoRealService.emojiPorStatus(status)} ${StatusTempoRealService.formatarStatus(status)}",
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color.White
                    )
                }
            }
            
            // Ações expandidas
            AnimatedVisibility(
                visible = expandido && podeAtualizar,
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFF8FAFC))
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    when (status) {
                        StatusParada.PENDENTE -> {
                            Button(
                                onClick = { onAtualizarStatus(StatusParada.EM_TRANSITO, null, null) },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Icon(Icons.Default.DirectionsCar, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Indo para lá")
                            }
                        }
                        StatusParada.EM_TRANSITO, StatusParada.CHEGOU -> {
                            // Botão Entregar
                            Button(
                                onClick = { onAtualizarStatus(StatusParada.ENTREGUE, null, null) },
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color(0xFF22C55E)
                                )
                            ) {
                                Icon(Icons.Default.Check, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Entregar")
                            }
                            
                            // Dropdown motivo falha
                            ExposedDropdownMenuBox(
                                expanded = dropdownExpanded,
                                onExpandedChange = { dropdownExpanded = !dropdownExpanded }
                            ) {
                                OutlinedTextField(
                                    value = motivoSelecionado?.let { 
                                        StatusTempoRealService.formatarMotivoFalha(it) 
                                    } ?: "Motivo da falha...",
                                    onValueChange = {},
                                    readOnly = true,
                                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = dropdownExpanded) },
                                    modifier = Modifier
                                        .menuAnchor()
                                        .fillMaxWidth()
                                )
                                
                                ExposedDropdownMenu(
                                    expanded = dropdownExpanded,
                                    onDismissRequest = { dropdownExpanded = false }
                                ) {
                                    MotivoFalha.entries.forEach { motivo ->
                                        DropdownMenuItem(
                                            text = { Text(StatusTempoRealService.formatarMotivoFalha(motivo)) },
                                            onClick = {
                                                motivoSelecionado = motivo
                                                dropdownExpanded = false
                                            }
                                        )
                                    }
                                }
                            }
                            
                            // Campo observação e botão falha
                            if (motivoSelecionado != null) {
                                OutlinedTextField(
                                    value = observacao,
                                    onValueChange = { observacao = it },
                                    label = { Text("Observação (opcional)") },
                                    modifier = Modifier.fillMaxWidth()
                                )
                                
                                Button(
                                    onClick = {
                                        onAtualizarStatus(StatusParada.FALHA, motivoSelecionado, observacao.ifEmpty { null })
                                        motivoSelecionado = null
                                        observacao = ""
                                        expandido = false
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = Color(0xFFEF4444)
                                    )
                                ) {
                                    Icon(Icons.Default.Close, contentDescription = null)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Registrar Falha")
                                }
                            }
                        }
                        StatusParada.FALHA -> {
                            Button(
                                onClick = { onAtualizarStatus(StatusParada.EM_TRANSITO, null, null) },
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color(0xFFF59E0B)
                                )
                            ) {
                                Icon(Icons.Default.Refresh, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Tentar Novamente")
                            }
                        }
                        else -> {}
                    }
                }
            }
        }
    }
}

// ==========================================
// LISTA PARADAS
// ==========================================

data class ParadaUI(
    val id: String,
    val ordem: Int,
    val nome: String,
    val endereco: String,
    val status: StatusParada
)

@Composable
fun ListaParadas(
    paradas: List<ParadaUI>,
    emAndamento: Boolean,
    onAtualizarStatus: (String, StatusParada, MotivoFalha?, String?) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(paradas.sortedBy { it.ordem }) { parada ->
            ItemParada(
                ordem = parada.ordem,
                nome = parada.nome,
                endereco = parada.endereco,
                status = parada.status,
                emAndamento = emAndamento,
                onAtualizarStatus = { status, motivo, obs ->
                    onAtualizarStatus(parada.id, status, motivo, obs)
                }
            )
        }
    }
}

// ==========================================
// PAINEL TRACKING PRINCIPAL
// ==========================================

@Composable
fun PainelTracking(
    statusRota: StatusRota?,
    metricas: MetricasTempoReal?,
    paradas: List<ParadaUI>,
    conectado: Boolean,
    loading: Boolean,
    onIniciar: () -> Unit,
    onPausar: () -> Unit,
    onFinalizar: () -> Unit,
    onAtualizarParada: (String, StatusParada, MotivoFalha?, String?) -> Unit,
    modifier: Modifier = Modifier
) {
    val emAndamento = statusRota == StatusRota.EM_ANDAMENTO
    
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = statusRota?.let { 
                    "${StatusTempoRealService.emojiPorStatus(
                        when (it) {
                            StatusRota.PLANEJADA -> StatusParada.PENDENTE
                            StatusRota.EM_ANDAMENTO -> StatusParada.EM_TRANSITO
                            StatusRota.PAUSADA -> StatusParada.PULADO
                            StatusRota.CONCLUIDA -> StatusParada.ENTREGUE
                            StatusRota.CANCELADA -> StatusParada.CANCELADO
                        }
                    )} ${StatusTempoRealService.formatarStatusRota(it)}" 
                } ?: "Carregando...",
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold
            )
            IndicadorConexao(conectado = conectado)
        }
        
        // Progresso
        metricas?.let {
            BarraProgresso(
                progresso = it.progresso,
                entregues = it.entregues,
                total = it.totalParadas
            )
            
            CardMetricas(metricas = it)
        }
        
        // Controles
        ControlesRota(
            statusRota = statusRota,
            loading = loading,
            onIniciar = onIniciar,
            onPausar = onPausar,
            onFinalizar = onFinalizar
        )
        
        // Lista de paradas
        ListaParadas(
            paradas = paradas,
            emAndamento = emAndamento,
            onAtualizarStatus = onAtualizarParada,
            modifier = Modifier.weight(1f)
        )
    }
}
