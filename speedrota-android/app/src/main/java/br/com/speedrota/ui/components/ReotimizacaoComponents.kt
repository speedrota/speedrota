package br.com.speedrota.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import br.com.speedrota.data.util.CenarioInfo
import br.com.speedrota.data.util.MotivoReotimizacao
import br.com.speedrota.data.util.ReotimizacaoResult
import br.com.speedrota.data.util.ReotimizacaoService

/**
 * @description Componentes de UI para Re-otimização Dinâmica
 *
 * COMPONENTES:
 * - ReotimizacaoBottomSheet: Modal com opções de re-otimização
 * - BotaoReotimizar: Botão de ação rápida
 * - AcoesParada: Menu de ações por parada
 * - AlertaReotimizacao: Banner de sugestão inteligente
 *
 * DESIGN POR CONTRATO:
 * @pre Rota em andamento
 * @post UI para interações de re-otimização
 */

// ==========================================
// BOTÃO RE-OTIMIZAR
// ==========================================

/**
 * Botão de re-otimização rápida
 */
@Composable
fun BotaoReotimizar(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variante: BotaoVariante = BotaoVariante.PRIMARY
) {
    val colors = when (variante) {
        BotaoVariante.PRIMARY -> ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary
        )
        BotaoVariante.DANGER -> ButtonDefaults.buttonColors(
            containerColor = Color(0xFFDC2626)
        )
        BotaoVariante.WARNING -> ButtonDefaults.buttonColors(
            containerColor = Color(0xFFF59E0B)
        )
    }
    
    Button(
        onClick = onClick,
        modifier = modifier,
        colors = colors,
        shape = RoundedCornerShape(8.dp)
    ) {
        Icon(
            imageVector = Icons.Default.Refresh,
            contentDescription = null,
            modifier = Modifier.size(18.dp)
        )
        Spacer(Modifier.width(8.dp))
        Text("Recalcular Rota")
    }
}

enum class BotaoVariante {
    PRIMARY, DANGER, WARNING
}

// ==========================================
// MODAL DE RE-OTIMIZAÇÃO
// ==========================================

/**
 * Modal com lista de cenários de re-otimização
 */
@Composable
fun ModalReotimizacao(
    isOpen: Boolean,
    paradaNome: String? = null,
    paradaId: String? = null,
    isLoading: Boolean = false,
    resultado: ReotimizacaoResult? = null,
    onDismiss: () -> Unit,
    onSelectCenario: (MotivoReotimizacao) -> Unit
) {
    if (!isOpen) return
    
    val cenarios = remember { 
        if (paradaId != null) {
            ReotimizacaoService.cenarios
        } else {
            ReotimizacaoService.cenarios.filter { !it.requerParadaId }
        }
    }
    
    Dialog(onDismissRequest = onDismiss) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 8.dp
        ) {
            Column {
                // Header
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Re-otimizar Rota",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    IconButton(onClick = onDismiss) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Fechar"
                        )
                    }
                }
                
                // Parada selecionada
                paradaNome?.let { nome ->
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Parada:",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                fontSize = 14.sp
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(
                                text = nome,
                                fontWeight = FontWeight.Medium,
                                fontSize = 14.sp
                            )
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                }
                
                // Resultado ou Lista de cenários
                if (resultado != null) {
                    ResultadoReotimizacao(
                        resultado = resultado,
                        onDismiss = onDismiss
                    )
                } else if (isLoading) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator()
                            Spacer(Modifier.height(16.dp))
                            Text("Recalculando rota...")
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.padding(8.dp)
                    ) {
                        items(cenarios) { cenario ->
                            CenarioItem(
                                cenario = cenario,
                                onClick = { onSelectCenario(cenario.motivo) }
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Item de cenário na lista
 */
@Composable
private fun CenarioItem(
    cenario: CenarioInfo,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = Color.Transparent
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Ícone
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = cenario.icone,
                    fontSize = 22.sp
                )
            }
            
            Spacer(Modifier.width(12.dp))
            
            // Textos
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = cenario.nome,
                    fontWeight = FontWeight.Medium,
                    fontSize = 15.sp
                )
                Text(
                    text = cenario.descricao,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 13.sp
                )
            }
            
            // Seta
            Text(
                text = "→",
                color = MaterialTheme.colorScheme.outline,
                fontSize = 18.sp
            )
        }
    }
}

/**
 * Exibição do resultado
 */
@Composable
private fun ResultadoReotimizacao(
    resultado: ReotimizacaoResult,
    onDismiss: () -> Unit
) {
    Column(
        modifier = Modifier.padding(16.dp)
    ) {
        // Card do resultado
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = if (resultado.success) {
                    Color(0xFFDCFCE7)
                } else {
                    Color(0xFFFEE2E2)
                }
            ),
            shape = RoundedCornerShape(12.dp)
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.Top
            ) {
                Text(
                    text = if (resultado.success) "✅" else "❌",
                    fontSize = 24.sp
                )
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(
                        text = resultado.mensagem,
                        fontWeight = FontWeight.Medium,
                        fontSize = 15.sp
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = resultado.acaoTomada,
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    resultado.economiaKm?.takeIf { it > 0 }?.let { km ->
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = "Economia: ${"%.1f".format(km)} km" +
                                   (resultado.economiaMin?.takeIf { it > 0 }
                                       ?.let { " / ${"%.0f".format(it)} min" } ?: ""),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xFF059669)
                        )
                    }
                }
            }
        }
        
        Spacer(Modifier.height(16.dp))
        
        // Botão fechar
        Button(
            onClick = onDismiss,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(10.dp)
        ) {
            Text("Fechar")
        }
    }
}

// ==========================================
// AÇÕES DA PARADA
// ==========================================

/**
 * Botões de ação rápida para uma parada
 */
@Composable
fun AcoesParada(
    onCancelar: () -> Unit,
    onAusente: () -> Unit,
    onMais: () -> Unit,
    isLoading: Boolean = false,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        BotaoAcao(
            icone = "❌",
            contentDescription = "Cancelar entrega",
            onClick = onCancelar,
            enabled = !isLoading,
            corHover = Color(0xFFFEE2E2)
        )
        BotaoAcao(
            icone = "🏠",
            contentDescription = "Cliente ausente",
            onClick = onAusente,
            enabled = !isLoading,
            corHover = Color(0xFFFEF3C7)
        )
        BotaoAcao(
            icone = "⋮",
            contentDescription = "Mais opções",
            onClick = onMais,
            enabled = !isLoading
        )
    }
}

@Composable
private fun BotaoAcao(
    icone: String,
    contentDescription: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
    corHover: Color = MaterialTheme.colorScheme.surfaceVariant
) {
    Surface(
        modifier = Modifier
            .size(32.dp)
            .clip(RoundedCornerShape(6.dp))
            .clickable(enabled = enabled, onClick = onClick),
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = RoundedCornerShape(6.dp)
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                text = icone,
                fontSize = 14.sp,
                color = if (enabled) {
                    Color.Unspecified
                } else {
                    MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                }
            )
        }
    }
}

// ==========================================
// ALERTA INTELIGENTE
// ==========================================

/**
 * Banner de sugestão de re-otimização
 */
@Composable
fun AlertaReotimizacao(
    tipo: AlertaTipo,
    mensagem: String,
    onReotimizar: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    AnimatedVisibility(
        visible = true,
        enter = fadeIn() + slideInVertically(),
        exit = fadeOut() + slideOutVertically()
    ) {
        val (backgroundColor, borderColor, icone) = when (tipo) {
            AlertaTipo.TRAFEGO -> Triple(
                Color(0xFFFEF3C7),
                Color(0xFFFCD34D),
                "🚗"
            )
            AlertaTipo.ATRASO -> Triple(
                Color(0xFFFEE2E2),
                Color(0xFFFCA5A5),
                "⏰"
            )
        }
        
        Surface(
            modifier = modifier.fillMaxWidth(),
            color = backgroundColor,
            shape = RoundedCornerShape(10.dp),
            border = androidx.compose.foundation.BorderStroke(
                1.dp,
                borderColor
            )
        ) {
            Row(
                modifier = Modifier.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = icone,
                    fontSize = 20.sp
                )
                Spacer(Modifier.width(12.dp))
                Text(
                    text = mensagem,
                    modifier = Modifier.weight(1f),
                    fontSize = 14.sp
                )
                Spacer(Modifier.width(8.dp))
                Button(
                    onClick = onReotimizar,
                    shape = RoundedCornerShape(6.dp),
                    contentPadding = ButtonDefaults.ButtonWithIconContentPadding
                ) {
                    Text("Recalcular", fontSize = 12.sp)
                }
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.size(24.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Fechar",
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

enum class AlertaTipo {
    TRAFEGO, ATRASO
}
