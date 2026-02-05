package br.com.speedrota.ui.screens.dashboard

import androidx.compose.foundation.background
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import br.com.speedrota.data.model.PieChartItem
import br.com.speedrota.data.model.SupplierData
import br.com.speedrota.ui.theme.Primary

/**
 * Dashboard Screen - Analytics do SpeedRota
 * 
 * @description Tela de métricas e KPIs
 * @pre Usuário autenticado
 * @post Exibe dashboard apropriado para o plano
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel = hiltViewModel(),
    onBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("📊", fontSize = 24.sp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Dashboard Analytics")
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
                    }
                },
                actions = {
                    // Badge do plano
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = when (uiState.plano) {
                            "FREE" -> Color(0xFF6B7280)
                            "PRO" -> Color(0xFF2563EB)
                            else -> Color(0xFF059669)
                        }
                    ) {
                        Text(
                            text = uiState.plano,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            color = Color.White,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        }
    ) { paddingValues ->
        when {
            uiState.isLoading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = Primary)
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Carregando analytics...")
                    }
                }
            }
            
            uiState.error != null -> {
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
                        Text("❌", fontSize = 48.sp)
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Erro ao carregar dados",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = uiState.error ?: "",
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadDashboardData() }) {
                            Text("Tentar novamente")
                        }
                    }
                }
            }
            
            else -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Header com período
                    item {
                        Spacer(modifier = Modifier.height(8.dp))
                        PeriodoSelector(
                            periodo = uiState.periodo,
                            plano = uiState.plano,
                            onPeriodoChange = { viewModel.setPeriodo(it) }
                        )
                    }
                    
                    // KPI Cards
                    item {
                        Text(
                            text = "Resumo do Período",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        KPICardsGrid(uiState)
                    }
                    
                    // Status das Entregas (Pie Chart simplificado)
                    item {
                        DeliveriesCard(uiState)
                    }
                    
                    // Fornecedores (PRO+)
                    if (uiState.plano != "FREE" && uiState.suppliers != null) {
                        item {
                            SuppliersCard(uiState.suppliers!!)
                        }
                    }
                    
                    // Upgrade Prompt (FREE)
                    if (uiState.plano == "FREE") {
                        item {
                            UpgradePromptCard()
                        }
                    }
                    
                    item {
                        Spacer(modifier = Modifier.height(24.dp))
                    }
                }
            }
        }
    }
}

/**
 * Seletor de período
 */
@Composable
fun PeriodoSelector(
    periodo: String,
    plano: String,
    onPeriodoChange: (String) -> Unit
) {
    val periodos = listOf("7d" to "7 dias", "30d" to "30 dias", "90d" to "90 dias")
    
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
                label = { Text(label) },
                enabled = !isDisabled,
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = Primary,
                    selectedLabelColor = Color.White
                )
            )
        }
    }
}

/**
 * Grid de KPI Cards
 */
@Composable
fun KPICardsGrid(state: DashboardUiState) {
    val kpis = state.overview?.kpis
    
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            KPICard(
                modifier = Modifier.weight(1f),
                icon = Icons.Default.Map,
                label = "Rotas",
                value = "${kpis?.totalRotas ?: 0}",
                color = Color(0xFF2563EB)
            )
            KPICard(
                modifier = Modifier.weight(1f),
                icon = Icons.Default.Route,
                label = "Km Rodados",
                value = String.format("%.1f", kpis?.totalKm ?: 0.0),
                color = Color(0xFF059669)
            )
        }
        
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            KPICard(
                modifier = Modifier.weight(1f),
                icon = Icons.Default.CheckCircle,
                label = "Taxa Sucesso",
                value = String.format("%.0f%%", kpis?.taxaSucesso ?: 0.0),
                color = Color(0xFF0891B2)
            )
            KPICard(
                modifier = Modifier.weight(1f),
                icon = Icons.Default.LocalShipping,
                label = "Entregas",
                value = "${kpis?.totalParadas ?: 0}",
                color = Color(0xFFF59E0B)
            )
        }
        
        // PRO+ KPIs extras
        if (state.plano != "FREE" && kpis != null) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                KPICard(
                    modifier = Modifier.weight(1f),
                    icon = Icons.Default.Timer,
                    label = "Tempo Total",
                    value = "${kpis.tempoTotalMin ?: 0} min",
                    color = Color(0xFF7C3AED)
                )
                KPICard(
                    modifier = Modifier.weight(1f),
                    icon = Icons.Default.AttachMoney,
                    label = "Custo",
                    value = String.format("R$ %.2f", kpis.custoTotal ?: 0.0),
                    color = Color(0xFFDC2626)
                )
            }
        }
    }
}

/**
 * Card de KPI individual
 */
@Composable
fun KPICard(
    modifier: Modifier = Modifier,
    icon: ImageVector,
    label: String,
    value: String,
    color: Color
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(color.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = color,
                    modifier = Modifier.size(24.dp)
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = label,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Card de status das entregas
 */
@Composable
fun DeliveriesCard(state: DashboardUiState) {
    val deliveries = state.deliveries ?: return
    
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Status das Entregas",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "${deliveries.totais.total} entregas no período",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Mini pie chart visual (barras horizontais)
            deliveries.pieChartData.forEach { item ->
                StatusBar(item)
                Spacer(modifier = Modifier.height(8.dp))
            }
        }
    }
}

/**
 * Barra de status individual
 */
@Composable
fun StatusBar(item: PieChartItem) {
    val color = try {
        Color(android.graphics.Color.parseColor(item.color))
    } catch (e: Exception) {
        Color.Gray
    }
    
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = item.name,
                style = MaterialTheme.typography.bodyMedium
            )
            Text(
                text = "${item.value} (${String.format("%.0f", item.percent)}%)",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        LinearProgressIndicator(
            progress = { (item.percent / 100f).coerceIn(0f, 1f) },
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp)),
            color = color,
            trackColor = color.copy(alpha = 0.2f)
        )
    }
}

/**
 * Card de fornecedores (PRO+)
 */
@Composable
fun SuppliersCard(suppliers: br.com.speedrota.data.model.SuppliersData) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Entregas por Fornecedor",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "${suppliers.total} entregas",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            suppliers.por_fornecedor.forEach { supplier ->
                SupplierRow(supplier)
                Spacer(modifier = Modifier.height(12.dp))
            }
        }
    }
}

/**
 * Linha de fornecedor
 */
@Composable
fun SupplierRow(supplier: SupplierData) {
    val color = try {
        Color(android.graphics.Color.parseColor(supplier.cor))
    } catch (e: Exception) {
        Color.Gray
    }
    
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = supplier.emoji,
            fontSize = 24.sp
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = supplier.nome,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "${supplier.entregas} entregas • ${String.format("%.1f", supplier.km)} km",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = String.format("%.0f%%", supplier.percentual),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = color
            )
        }
    }
}

/**
 * Card de Upgrade (FREE)
 */
@Composable
fun UpgradePromptCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = Primary.copy(alpha = 0.1f)
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("⚡", fontSize = 32.sp)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Desbloqueie mais insights",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Filtros de período, tendências, análise por fornecedor e muito mais!",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(12.dp))
            Button(
                onClick = { /* TODO: Navigate to plans */ },
                colors = ButtonDefaults.buttonColors(containerColor = Primary)
            ) {
                Text("Ver Planos PRO")
            }
        }
    }
}
