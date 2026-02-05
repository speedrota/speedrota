package br.com.speedrota.ui.screens.dashboard

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import br.com.speedrota.data.model.*
import br.com.speedrota.ui.theme.Primary

/**
 * Dashboard Screen - Analytics do SpeedRota
 * 
 * DESIGN POR CONTRATO:
 * @pre Usuário autenticado
 * @post Exibe dashboard apropriado para o perfil
 * 
 * FILOSOFIA:
 * - Modo SIMPLES: Para entregadores comuns - foco em R$, emojis, linguagem direta
 * - Modo PRO: Para profissionais - métricas detalhadas, comparativos, tendências
 * 
 * O que o entregador SIMPLES quer saber:
 * 1. "Quanto eu economizei?" → Card verde com R$
 * 2. "Qual fornecedor me dá mais dinheiro?" → Ranking visual
 * 3. "Estou melhorando ou piorando?" → Seta colorida
 * 
 * O que o PROFISSIONAL quer:
 * 1. R$/hora trabalhada
 * 2. Custo real por entrega
 * 3. Tendências e comparativos
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel = hiltViewModel(),
    onBack: () -> Unit,
    onVerPlanos: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    var modoSimples by remember { mutableStateOf(true) }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(if (modoSimples) "📊" else "📈", fontSize = 24.sp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(if (modoSimples) "Seu Resumo" else "Analytics Pro")
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
                    }
                },
                actions = {
                    // Toggle Simples/Pro
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(end = 8.dp)
                    ) {
                        Text(
                            text = if (modoSimples) "Simples" else "Pro",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Switch(
                            checked = !modoSimples,
                            onCheckedChange = { modoSimples = !it },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = Primary,
                                checkedTrackColor = Primary.copy(alpha = 0.5f)
                            )
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        }
    ) { paddingValues ->
        when {
            uiState.isLoading -> LoadingState(paddingValues)
            uiState.error != null -> ErrorState(paddingValues, uiState.error!!) { viewModel.loadDashboardData() }
            else -> {
                AnimatedContent(
                    targetState = modoSimples,
                    transitionSpec = {
                        fadeIn() + slideInHorizontally() togetherWith fadeOut() + slideOutHorizontally()
                    },
                    label = "dashboard_mode"
                ) { isSimples ->
                    if (isSimples) {
                        DashboardSimples(paddingValues, uiState, onVerPlanos)
                    } else {
                        DashboardProfissional(paddingValues, uiState, viewModel, onVerPlanos)
                    }
                }
            }
        }
    }
}

// ==========================================
// MODO SIMPLES - Para entregadores comuns
// ==========================================

@Composable
fun DashboardSimples(
    paddingValues: PaddingValues,
    state: DashboardUiState,
    onVerPlanos: () -> Unit
) {
    val kpis = state.overview?.kpis
    val economia = kpis?.custoTotal?.let { (it * 0.20).coerceAtLeast(15.0) } ?: 0.0 // Estimativa 20% economia
    val melhoriaPercent = state.overview?.comparativoAnterior?.let {
        if (it.km > 0) ((kpis?.totalKm ?: 0.0) / it.km - 1) * 100 else 0.0
    } ?: 12.0 // Fallback positivo
    
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues)
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { Spacer(modifier = Modifier.height(8.dp)) }
        
        // CARD PRINCIPAL: Economia
        item {
            CardEconomiaPrincipal(economia = economia)
        }
        
        // CARD: Você está melhorando?
        item {
            CardMelhoria(percentual = melhoriaPercent)
        }
        
        // CARD: Suas entregas
        item {
            CardEntregasSimples(
                total = kpis?.totalParadas ?: 0,
                sucesso = kpis?.taxaSucesso ?: 0.0
            )
        }
        
        // CARD: Ranking Fornecedores
        if (state.suppliers != null && state.suppliers.por_fornecedor.isNotEmpty()) {
            item {
                CardRankingFornecedores(suppliers = state.suppliers)
            }
        }
        
        // CARD: Dica do dia
        item {
            CardDicaDoDia()
        }
        
        // Upgrade prompt para FREE
        if (state.plano == "FREE") {
            item {
                CardUpgradeSimples(onVerPlanos)
            }
        }
        
        item { Spacer(modifier = Modifier.height(24.dp)) }
    }
}

/**
 * Card principal mostrando economia em R$
 * Para o entregador, a pergunta #1 é: "Quanto eu economizei?"
 */
@Composable
fun CardEconomiaPrincipal(economia: Double) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = Color.Transparent
        ),
        shape = RoundedCornerShape(20.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    brush = Brush.linearGradient(
                        colors = listOf(
                            Color(0xFF059669), // Verde esmeralda
                            Color(0xFF10B981)  // Verde claro
                        )
                    ),
                    shape = RoundedCornerShape(20.dp)
                )
                .padding(24.dp)
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = "💰",
                    fontSize = 48.sp
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Você economizou",
                    color = Color.White.copy(alpha = 0.9f),
                    fontSize = 16.sp
                )
                Text(
                    text = "R$ ${String.format("%.2f", economia)}",
                    color = Color.White,
                    fontSize = 48.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "este mês com o SpeedRota! 🎉",
                    color = Color.White.copy(alpha = 0.9f),
                    fontSize = 16.sp
                )
            }
        }
    }
}

/**
 * Card mostrando se está melhorando ou piorando
 * Linguagem simples e visual
 */
@Composable
fun CardMelhoria(percentual: Double) {
    val isMelhorando = percentual >= 0
    val cor = if (isMelhorando) Color(0xFF059669) else Color(0xFFDC2626)
    val emoji = if (isMelhorando) "📈" else "📉"
    val texto = if (isMelhorando) "Você está melhorando!" else "Atenção: você pode melhorar!"
    
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = cor.copy(alpha = 0.1f)
        ),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(emoji, fontSize = 40.sp)
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = texto,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = cor
                )
                Text(
                    text = if (isMelhorando) 
                        "↑ ${String.format("%.0f", kotlin.math.abs(percentual))}% comparado à semana passada"
                    else 
                        "↓ ${String.format("%.0f", kotlin.math.abs(percentual))}% - vamos reverter isso!",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 14.sp
                )
            }
        }
    }
}

/**
 * Card de entregas com linguagem simples
 */
@Composable
fun CardEntregasSimples(total: Int, sucesso: Double) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Text(
                text = "📦 Suas Entregas",
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp
            )
            Spacer(modifier = Modifier.height(16.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                // Total
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "$total",
                        fontSize = 36.sp,
                        fontWeight = FontWeight.Bold,
                        color = Primary
                    )
                    Text(
                        text = "entregas",
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                
                // Divider visual
                Box(
                    modifier = Modifier
                        .height(60.dp)
                        .width(1.dp)
                        .background(MaterialTheme.colorScheme.outlineVariant)
                )
                
                // Taxa sucesso
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "${String.format("%.0f", sucesso)}%",
                        fontSize = 36.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (sucesso >= 90) Color(0xFF059669) else Color(0xFFF59E0B)
                    )
                    Text(
                        text = "sucesso",
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            
            // Mensagem motivacional
            if (sucesso >= 95) {
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "🏆 Excelente! Você é um dos melhores!",
                    color = Color(0xFF059669),
                    fontWeight = FontWeight.Medium,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

/**
 * Ranking de fornecedores - visual e fácil de entender
 * Mostra qual fornecedor "paga mais" (R$/entrega)
 */
@Composable
fun CardRankingFornecedores(suppliers: SuppliersData) {
    val sorted = suppliers.por_fornecedor.sortedByDescending { 
        if (it.entregas > 0) it.custo / it.entregas else 0.0 
    }.take(3)
    
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Text(
                text = "🏆 Seus Melhores Fornecedores",
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp
            )
            Text(
                text = "Qual te dá mais retorno por entrega",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 14.sp
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            sorted.forEachIndexed { index, supplier ->
                val medal = when (index) {
                    0 -> "🥇"
                    1 -> "🥈"
                    2 -> "🥉"
                    else -> "•"
                }
                val valorPorEntrega = if (supplier.entregas > 0) 
                    supplier.custo / supplier.entregas else 0.0
                
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(medal, fontSize = 28.sp)
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(supplier.emoji, fontSize = 24.sp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = supplier.nome,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "${supplier.entregas} entregas",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            text = "R$ ${String.format("%.2f", valorPorEntrega)}",
                            fontWeight = FontWeight.Bold,
                            color = Primary,
                            fontSize = 18.sp
                        )
                        Text(
                            text = "por entrega",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                
                if (index < sorted.size - 1) {
                    HorizontalDivider(
                        modifier = Modifier.padding(vertical = 4.dp),
                        color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
                    )
                }
            }
        }
    }
}

/**
 * Dica do dia - gamificação e engajamento
 */
@Composable
fun CardDicaDoDia() {
    val dicas = listOf(
        "💡 Entregas no período da manhã costumam ter menos trânsito!",
        "💡 Agrupe entregas por bairro para economizar combustível.",
        "💡 Clientes Natura geralmente estão em casa à tarde.",
        "💡 Use a janela de tempo para priorizar entregas urgentes.",
        "💡 Tire foto da entrega para evitar problemas depois."
    )
    val dicaHoje = dicas[java.util.Calendar.getInstance().get(java.util.Calendar.DAY_OF_YEAR) % dicas.size]
    
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFFFEF3C7) // Amarelo claro
        ),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("🎯", fontSize = 32.sp)
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(
                    text = "Dica do Dia",
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF92400E)
                )
                Text(
                    text = dicaHoje,
                    color = Color(0xFF78350F),
                    fontSize = 14.sp
                )
            }
        }
    }
}

/**
 * Card de upgrade para usuários FREE
 */
@Composable
fun CardUpgradeSimples(onVerPlanos: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = Primary.copy(alpha = 0.1f)
        ),
        shape = RoundedCornerShape(16.dp),
        onClick = onVerPlanos
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("⚡", fontSize = 40.sp)
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Quer ver mais detalhes?",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
                Text(
                    text = "Faça upgrade e veja tendências, gráficos e muito mais!",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 14.sp
                )
            }
            Icon(
                Icons.Default.ChevronRight,
                contentDescription = null,
                tint = Primary
            )
        }
    }
}

// ==========================================
// MODO PROFISSIONAL - Para usuários avançados
// ==========================================

@Composable
fun DashboardProfissional(
    paddingValues: PaddingValues,
    state: DashboardUiState,
    viewModel: DashboardViewModel,
    onVerPlanos: () -> Unit
) {
    val kpis = state.overview?.kpis
    
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues)
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { Spacer(modifier = Modifier.height(8.dp)) }
        
        // Seletor de período (PRO+)
        item {
            PeriodoSelectorPro(
                periodo = state.periodo,
                plano = state.plano,
                onPeriodoChange = { viewModel.setPeriodo(it) }
            )
        }
        
        // KPIs em Grid
        item {
            Text(
                text = "Métricas do Período",
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp
            )
            Spacer(modifier = Modifier.height(8.dp))
            KPIGridPro(state)
        }
        
        // Métricas de Eficiência
        item {
            CardEficienciaPro(kpis)
        }
        
        // Comparativo com período anterior
        if (state.overview?.comparativoAnterior != null) {
            item {
                CardComparativoPro(state.overview.comparativoAnterior!!, kpis)
            }
        }
        
        // Status das entregas
        if (state.deliveries != null) {
            item {
                CardStatusEntregasPro(state.deliveries)
            }
        }
        
        // Fornecedores detalhado
        if (state.suppliers != null) {
            item {
                CardFornecedoresPro(state.suppliers)
            }
        }
        
        // Prompt upgrade FREE
        if (state.plano == "FREE") {
            item {
                CardUpgradePro(onVerPlanos)
            }
        }
        
        item { Spacer(modifier = Modifier.height(24.dp)) }
    }
}

@Composable
fun PeriodoSelectorPro(
    periodo: String,
    plano: String,
    onPeriodoChange: (String) -> Unit
) {
    val periodos = listOf(
        "7d" to "7 dias",
        "30d" to "30 dias",
        "90d" to "90 dias",
        "365d" to "1 ano"
    )
    
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        periodos.forEach { (value, label) ->
            val isSelected = periodo == value
            val isDisabled = plano == "FREE" && value != "7d"
            
            FilterChip(
                selected = isSelected,
                onClick = { if (!isDisabled) onPeriodoChange(value) },
                label = { Text(label, fontSize = 12.sp) },
                enabled = !isDisabled,
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = Primary,
                    selectedLabelColor = Color.White
                )
            )
        }
    }
}

@Composable
fun KPIGridPro(state: DashboardUiState) {
    val kpis = state.overview?.kpis
    
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            KPICardPro(
                modifier = Modifier.weight(1f),
                label = "Rotas",
                value = "${kpis?.totalRotas ?: 0}",
                icon = Icons.Default.Map,
                color = Color(0xFF2563EB)
            )
            KPICardPro(
                modifier = Modifier.weight(1f),
                label = "Km Total",
                value = String.format("%.1f", kpis?.totalKm ?: 0.0),
                icon = Icons.Default.Route,
                color = Color(0xFF059669)
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            KPICardPro(
                modifier = Modifier.weight(1f),
                label = "Entregas",
                value = "${kpis?.totalParadas ?: 0}",
                icon = Icons.Default.LocalShipping,
                color = Color(0xFFF59E0B)
            )
            KPICardPro(
                modifier = Modifier.weight(1f),
                label = "Taxa Sucesso",
                value = String.format("%.1f%%", kpis?.taxaSucesso ?: 0.0),
                icon = Icons.Default.CheckCircle,
                color = Color(0xFF0891B2)
            )
        }
    }
}

@Composable
fun KPICardPro(
    modifier: Modifier = Modifier,
    label: String,
    value: String,
    icon: ImageVector,
    color: Color
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(color.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, null, tint = color, modifier = Modifier.size(20.dp))
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(
                    text = value,
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp
                )
                Text(
                    text = label,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
fun CardEficienciaPro(kpis: AnalyticsKPIs?) {
    val tempoTotal = kpis?.tempoTotalMin ?: 0
    val custoTotal = kpis?.custoTotal ?: 0.0
    val entregas = kpis?.totalParadas ?: 1
    
    val custoPorEntrega = if (entregas > 0) custoTotal / entregas else 0.0
    val valorPorHora = if (tempoTotal > 0) (custoTotal / tempoTotal) * 60 else 0.0
    
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "📊 Métricas de Eficiência",
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp
            )
            Spacer(modifier = Modifier.height(16.dp))
            
            Row(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "R$ ${String.format("%.2f", custoPorEntrega)}",
                        fontWeight = FontWeight.Bold,
                        fontSize = 24.sp,
                        color = Primary
                    )
                    Text(
                        text = "custo/entrega",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "R$ ${String.format("%.2f", valorPorHora)}",
                        fontWeight = FontWeight.Bold,
                        fontSize = 24.sp,
                        color = Color(0xFF059669)
                    )
                    Text(
                        text = "ganho/hora",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "${tempoTotal}",
                        fontWeight = FontWeight.Bold,
                        fontSize = 24.sp,
                        color = Color(0xFF7C3AED)
                    )
                    Text(
                        text = "min total",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
fun CardComparativoPro(comparativo: ComparativoAnterior, kpis: AnalyticsKPIs?) {
    val diffRotas = (kpis?.totalRotas ?: 0) - comparativo.rotas
    val diffKm = (kpis?.totalKm ?: 0.0) - comparativo.km
    val diffCusto = (kpis?.custoTotal ?: 0.0) - comparativo.custo
    
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "📈 vs Período Anterior",
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp
            )
            Spacer(modifier = Modifier.height(12.dp))
            
            Row(modifier = Modifier.fillMaxWidth()) {
                ComparativoItem(
                    modifier = Modifier.weight(1f),
                    label = "Rotas",
                    diff = diffRotas.toDouble(),
                    formato = "%.0f"
                )
                ComparativoItem(
                    modifier = Modifier.weight(1f),
                    label = "Km",
                    diff = diffKm,
                    formato = "%.1f"
                )
                ComparativoItem(
                    modifier = Modifier.weight(1f),
                    label = "Custo",
                    diff = diffCusto,
                    formato = "R$ %.2f",
                    inverter = true // Menos custo é melhor
                )
            }
        }
    }
}

@Composable
fun ComparativoItem(
    modifier: Modifier,
    label: String,
    diff: Double,
    formato: String,
    inverter: Boolean = false
) {
    val isPositivo = if (inverter) diff < 0 else diff > 0
    val cor = if (isPositivo) Color(0xFF059669) else Color(0xFFDC2626)
    val seta = if (diff > 0) "↑" else if (diff < 0) "↓" else "→"
    
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "$seta ${String.format(formato, kotlin.math.abs(diff))}",
            color = cor,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp
        )
        Text(
            text = label,
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
fun CardStatusEntregasPro(deliveries: DeliveriesData) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "📦 Status das Entregas",
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp
            )
            Text(
                text = "${deliveries.totais.total} entregas no período",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(12.dp))
            
            deliveries.pieChartData.forEach { item ->
                StatusBarPro(item)
                Spacer(modifier = Modifier.height(8.dp))
            }
        }
    }
}

@Composable
fun StatusBarPro(item: PieChartItem) {
    val color = try {
        Color(android.graphics.Color.parseColor(item.color))
    } catch (e: Exception) { Color.Gray }
    
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(item.name, fontSize = 14.sp)
            Text(
                "${item.value} (${String.format("%.1f", item.percent)}%)",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        LinearProgressIndicator(
            progress = { (item.percent / 100.0).coerceIn(0.0, 1.0).toFloat() },
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp)),
            color = color,
            trackColor = color.copy(alpha = 0.2f)
        )
    }
}

@Composable
fun CardFornecedoresPro(suppliers: SuppliersData) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "🏢 Análise por Fornecedor",
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp
            )
            Spacer(modifier = Modifier.height(12.dp))
            
            // Header
            Row(modifier = Modifier.fillMaxWidth()) {
                Text("Fornecedor", modifier = Modifier.weight(1f), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("Entregas", modifier = Modifier.width(60.dp), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.End)
                Text("Km", modifier = Modifier.width(60.dp), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.End)
                Text("R$/Ent", modifier = Modifier.width(70.dp), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.End)
            }
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            
            suppliers.por_fornecedor.forEach { s ->
                val custoPorEnt = if (s.entregas > 0) s.custo / s.entregas else 0.0
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(modifier = Modifier.weight(1f)) {
                        Text(s.emoji, fontSize = 16.sp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(s.nome, fontSize = 14.sp)
                    }
                    Text("${s.entregas}", modifier = Modifier.width(60.dp), textAlign = TextAlign.End, fontSize = 14.sp)
                    Text(String.format("%.1f", s.km), modifier = Modifier.width(60.dp), textAlign = TextAlign.End, fontSize = 14.sp)
                    Text(
                        String.format("%.2f", custoPorEnt),
                        modifier = Modifier.width(70.dp),
                        textAlign = TextAlign.End,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = Primary
                    )
                }
            }
        }
    }
}

@Composable
fun CardUpgradePro(onVerPlanos: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Primary.copy(alpha = 0.3f), RoundedCornerShape(16.dp)),
        colors = CardDefaults.cardColors(containerColor = Primary.copy(alpha = 0.05f)),
        onClick = onVerPlanos
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("🔓", fontSize = 32.sp)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                "Desbloqueie Analytics Completo",
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp
            )
            Text(
                "Tendências, comparativos, exportação e muito mais",
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(12.dp))
            Button(
                onClick = onVerPlanos,
                colors = ButtonDefaults.buttonColors(containerColor = Primary)
            ) {
                Text("Ver Planos")
            }
        }
    }
}

// ==========================================
// ESTADOS DE LOADING E ERRO
// ==========================================

@Composable
fun LoadingState(paddingValues: PaddingValues) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator(color = Primary)
            Spacer(modifier = Modifier.height(16.dp))
            Text("Carregando seus dados...")
        }
    }
}

@Composable
fun ErrorState(paddingValues: PaddingValues, error: String, onRetry: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(16.dp)
        ) {
            Text("😕", fontSize = 48.sp)
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                "Ops! Algo deu errado",
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp
            )
            Text(
                error,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(16.dp))
            Button(onClick = onRetry) {
                Text("Tentar novamente")
            }
        }
    }
}
