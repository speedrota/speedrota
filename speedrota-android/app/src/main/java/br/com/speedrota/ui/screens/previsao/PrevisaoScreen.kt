package br.com.speedrota.ui.screens.previsao

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import br.com.speedrota.data.model.*
import br.com.speedrota.ui.theme.Primary

/**
 * Tela de Previsão de Demanda (ML)
 * 
 * DESIGN POR CONTRATO:
 * @pre Usuário autenticado
 * @post Exibe mapa de calor, previsões e insights
 * 
 * @author SpeedRota Team
 * @version 1.0.0
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrevisaoScreen(
    viewModel: PrevisaoViewModel = hiltViewModel(),
    onBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    var zonaBusca by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("🔮", fontSize = 24.sp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Previsão de Demanda")
                    }
                },
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
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header
            item {
                Text(
                    text = "Descubra onde e quando haverá mais entregas",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // Busca por zona
            item {
                BuscaPrevisaoCard(
                    zona = zonaBusca,
                    onZonaChange = { zonaBusca = it.filter { c -> c.isDigit() }.take(8) },
                    onBuscar = { viewModel.buscarPrevisao(zonaBusca) },
                    isLoading = uiState.isLoading,
                    erro = uiState.erro
                )
            }

            // Card de Previsão (se houver)
            uiState.previsao?.let { previsao ->
                item {
                    CardPrevisao(previsao = previsao)
                }
            }

            // Mapa de Calor
            item {
                MapaCalorSection(
                    zonas = uiState.zonasCalor,
                    dataSelecionada = uiState.dataSelecionada,
                    isLoading = uiState.isLoadingMapa,
                    onDataChange = { viewModel.selecionarData(it) }
                )
            }

            // Insights
            if (uiState.insights.isNotEmpty()) {
                item {
                    InsightsSection(insights = uiState.insights)
                }
            }

            // Métricas do Modelo
            uiState.metricas?.let { metricas ->
                item {
                    MetricasSection(metricas = metricas)
                }
            }
        }
    }
}

@Composable
private fun BuscaPrevisaoCard(
    zona: String,
    onZonaChange: (String) -> Unit,
    onBuscar: () -> Unit,
    isLoading: Boolean,
    erro: String?
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = zona,
                    onValueChange = onZonaChange,
                    placeholder = { Text("Digite um CEP (ex: 01310)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )

                Button(
                    onClick = onBuscar,
                    enabled = !isLoading && zona.length >= 5
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text("🔍 Buscar")
                    }
                }
            }

            if (erro != null) {
                Text(
                    text = erro,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}

@Composable
private fun CardPrevisao(previsao: PrevisaoDemandaData) {
    val confiancaColor = when {
        previsao.confianca >= 0.8 -> Color(0xFF22C55E)
        previsao.confianca >= 0.6 -> Color(0xFFF59E0B)
        else -> Color(0xFFEF4444)
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "📍 ${previsao.zona}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = confiancaColor.copy(alpha = 0.2f)
                ) {
                    Text(
                        text = "${(previsao.confianca * 100).toInt()}% confiança",
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = confiancaColor,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Números principais
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "${previsao.demandaPrevista}",
                        style = MaterialTheme.typography.headlineLarge,
                        fontWeight = FontWeight.Bold,
                        color = Primary
                    )
                    Text(
                        text = "entregas previstas",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "${previsao.limiteInferior}-${previsao.limiteSuperior}",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = "intervalo 95%",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Fatores
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                FatorChip("📅 Dia", previsao.fatores.diaSemana)
                FatorChip("⏰ Hora", previsao.fatores.horario)
                FatorChip("📊 Sazon", previsao.fatores.sazonalidade)
                FatorChip("📈 Tend", previsao.fatores.tendencia)
            }
        }
    }
}

@Composable
private fun FatorChip(label: String, valor: Double) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surface
    ) {
        Column(
            modifier = Modifier.padding(8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = String.format("%.2fx", valor),
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun MapaCalorSection(
    zonas: List<ZonaCalor>,
    dataSelecionada: String,
    isLoading: Boolean,
    onDataChange: (String) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "🗺️ Mapa de Calor",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                // TODO: Date picker
            }

            Spacer(modifier = Modifier.height(16.dp))

            if (isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(150.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            } else if (zonas.isEmpty()) {
                Text(
                    text = "Nenhuma zona disponível",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Center
                )
            } else {
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(zonas) { zona ->
                        ZonaCalorCard(zona = zona)
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Legenda
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    LegendaItem(Color(0xFFEF4444), "Alta")
                    LegendaItem(Color(0xFFF97316), "Média-Alta")
                    LegendaItem(Color(0xFFEAB308), "Média")
                    LegendaItem(Color(0xFF22C55E), "Baixa")
                }
            }
        }
    }
}

@Composable
private fun ZonaCalorCard(zona: ZonaCalor) {
    val cor = when {
        zona.intensidade >= 0.8 -> Color(0xFFEF4444)
        zona.intensidade >= 0.6 -> Color(0xFFF97316)
        zona.intensidade >= 0.4 -> Color(0xFFEAB308)
        zona.intensidade >= 0.2 -> Color(0xFF22C55E)
        else -> Color(0xFF94A3B8)
    }

    Surface(
        modifier = Modifier.size(100.dp),
        shape = RoundedCornerShape(12.dp),
        color = cor.copy(alpha = 0.7f + (zona.intensidade * 0.3f).toFloat())
    ) {
        Column(
            modifier = Modifier.padding(8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = zona.zona,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
            Text(
                text = "${zona.demandaPrevista} entregas",
                style = MaterialTheme.typography.bodySmall,
                color = Color.White
            )
            Text(
                text = "🕐 ${zona.melhorHorario}",
                style = MaterialTheme.typography.bodySmall,
                color = Color.White.copy(alpha = 0.9f)
            )
        }
    }
}

@Composable
private fun LegendaItem(cor: Color, label: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Box(
            modifier = Modifier
                .size(12.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(cor)
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun InsightsSection(insights: List<InsightML>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "💡 Insights para Você",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(12.dp))

            insights.forEach { insight ->
                InsightCard(insight = insight)
                Spacer(modifier = Modifier.height(8.dp))
            }
        }
    }
}

@Composable
private fun InsightCard(insight: InsightML) {
    val iconeTipo = when (insight.tipo) {
        "PICO_DEMANDA" -> "📈"
        "MELHOR_HORARIO" -> "⏰"
        "TENDENCIA" -> "📊"
        "ZONA_EVITAR" -> "⚠️"
        "FORNECEDOR_PICO" -> "🏭"
        "OPORTUNIDADE" -> "💡"
        else -> "🎯"
    }

    val corPrioridade = when (insight.prioridade) {
        1 -> Color(0xFFEF4444)
        2 -> Color(0xFFF59E0B)
        else -> Primary
    }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.secondaryContainer
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .border(
                    width = 2.dp,
                    color = corPrioridade,
                    shape = RoundedCornerShape(topStart = 8.dp, bottomStart = 8.dp)
                )
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = iconeTipo,
                fontSize = 24.sp
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = insight.titulo,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = insight.descricao,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "💡 ${insight.acao}",
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

@Composable
private fun MetricasSection(metricas: MetricasML) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "📈 Qualidade do Modelo",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                MetricaItem(valor = "${metricas.totalPrevisoes}", label = "Previsões")
                MetricaItem(valor = metricas.taxaAcerto, label = "Acurácia")
                MetricaItem(valor = metricas.mape, label = "Erro %")
                MetricaItem(valor = metricas.confiancaMedia, label = "Confiança")
            }
        }
    }
}

@Composable
private fun MetricaItem(valor: String, label: String) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(8.dp)
    ) {
        Text(
            text = valor,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = Primary
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
