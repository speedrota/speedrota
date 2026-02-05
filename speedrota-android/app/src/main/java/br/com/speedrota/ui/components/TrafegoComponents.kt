package br.com.speedrota.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.speedrota.data.util.CorTrafego
import br.com.speedrota.data.util.ResumoTrafego
import br.com.speedrota.data.util.StatusTrafego
import br.com.speedrota.data.util.TempoFormatado

/**
 * Indicador visual de tráfego
 */
@Composable
fun IndicadorTrafego(
    resumo: ResumoTrafego,
    modifier: Modifier = Modifier,
    compacto: Boolean = false,
    onClick: (() -> Unit)? = null
) {
    val (backgroundColor, borderColor) = when (resumo.status) {
        StatusTrafego.LEVE -> Color(0x1A22C55E) to Color(0xFF22C55E)
        StatusTrafego.MODERADO -> Color(0x1AEAB308) to Color(0xFFEAB308)
        StatusTrafego.INTENSO -> Color(0x1AEF4444) to Color(0xFFEF4444)
    }

    Row(
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(backgroundColor)
            .border(1.dp, borderColor, RoundedCornerShape(999.dp))
            .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier)
            .padding(horizontal = if (compacto) 8.dp else 12.dp, vertical = if (compacto) 4.dp else 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = resumo.emoji,
            fontSize = if (compacto) 16.sp else 20.sp
        )

        if (!compacto) {
            Column {
                Text(
                    text = resumo.descricao,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurface
                )
                if (resumo.fatorAtual != 1.0f) {
                    val sinal = if (resumo.fatorAtual > 1) "+" else ""
                    val percentual = ((resumo.fatorAtual - 1) * 100).toInt()
                    Text(
                        text = "$sinal$percentual% tempo",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

/**
 * Badge pequeno de tráfego
 */
@Composable
fun BadgeTrafego(
    fator: Float,
    modifier: Modifier = Modifier
) {
    val emoji = when {
        fator >= 1.5f -> "🔴"
        fator >= 1.2f -> "🟡"
        else -> "🟢"
    }

    Text(
        text = emoji,
        fontSize = 12.sp,
        modifier = modifier
    )
}

/**
 * Tempo formatado com indicador de tráfego
 */
@Composable
fun TempoComTrafego(
    tempo: TempoFormatado,
    modifier: Modifier = Modifier,
    mostrarOriginal: Boolean = true
) {
    Column(modifier = modifier) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            BadgeTrafego(fator = tempo.fator)
            Text(
                text = tempo.texto,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurface
            )
        }

        if (mostrarOriginal && tempo.fator != 1.0f) {
            Text(
                text = "(sem tráfego: ${tempo.textoOriginal})",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Card de resumo de tráfego
 */
@Composable
fun CardTrafego(
    resumo: ResumoTrafego,
    modifier: Modifier = Modifier
) {
    val backgroundColor = when (resumo.status) {
        StatusTrafego.LEVE -> Color(0x1A22C55E)
        StatusTrafego.MODERADO -> Color(0x1AEAB308)
        StatusTrafego.INTENSO -> Color(0x1AEF4444)
    }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(backgroundColor)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = resumo.emoji,
            fontSize = 32.sp
        )

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = resumo.descricao,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = when (resumo.status) {
                    StatusTrafego.LEVE -> "Bom momento para rodar!"
                    StatusTrafego.MODERADO -> "Trânsito um pouco lento"
                    StatusTrafego.INTENSO -> "Considere esperar um pouco"
                },
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        if (resumo.fatorAtual != 1.0f) {
            val sinal = if (resumo.fatorAtual > 1) "+" else ""
            val percentual = ((resumo.fatorAtual - 1) * 100).toInt()
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "$sinal$percentual%",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = "tempo",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
