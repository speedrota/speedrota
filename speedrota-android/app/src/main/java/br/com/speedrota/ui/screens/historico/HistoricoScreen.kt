package br.com.speedrota.ui.screens.historico

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import br.com.speedrota.data.model.RotaHistoricoItem
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HistoricoScreen(
    onVoltar: () -> Unit,
    onRotaSelecionada: (String) -> Unit,
    viewModel: HistoricoViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var mostrarFiltros by remember { mutableStateOf(false) }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Histórico de Rotas") },
                navigationIcon = {
                    IconButton(onClick = onVoltar) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Voltar"
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { mostrarFiltros = !mostrarFiltros }) {
                        Icon(
                            imageVector = Icons.Default.FilterList,
                            contentDescription = "Filtros"
                        )
                    }
                    IconButton(onClick = { viewModel.carregarRotas() }) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Atualizar"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary,
                    actionIconContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Filtros
            if (mostrarFiltros) {
                FiltrosSection(
                    filtros = uiState.filtros,
                    fornecedores = uiState.fornecedores,
                    onFiltrosChanged = { viewModel.atualizarFiltros(it) }
                )
            }
            
            // Resumo
            uiState.resumo?.let { resumo ->
                ResumoCard(
                    totalRotas = resumo.totais?.rotas ?: 0,
                    totalEntregas = resumo.totais?.entregas ?: 0,
                    distanciaTotal = resumo.distancia?.total ?: 0.0,
                    tempoTotal = resumo.tempo?.total ?: 0.0
                )
            }
            
            // Lista de rotas
            Box(modifier = Modifier.weight(1f)) {
                when {
                    uiState.isLoading -> {
                        CircularProgressIndicator(
                            modifier = Modifier.align(Alignment.Center)
                        )
                    }
                    uiState.error != null -> {
                        Column(
                            modifier = Modifier
                                .align(Alignment.Center)
                                .padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = uiState.error ?: "Erro desconhecido",
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodyLarge
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(onClick = { viewModel.carregarRotas() }) {
                                Text("Tentar novamente")
                            }
                        }
                    }
                    uiState.rotas.isEmpty() -> {
                        Column(
                            modifier = Modifier
                                .align(Alignment.Center)
                                .padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = Icons.Default.LocationOn,
                                contentDescription = null,
                                modifier = Modifier.size(64.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "Nenhuma rota encontrada",
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = "Ajuste os filtros ou crie uma rota",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    else -> {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(uiState.rotas) { rota ->
                                RotaHistoricoCard(
                                    rota = rota,
                                    onClick = { onRotaSelecionada(rota.id) },
                                    formatarTempo = { viewModel.formatarTempo(it) }
                                )
                            }
                        }
                    }
                }
            }
            
            // Paginação
            if (uiState.totalPaginas > 1) {
                PaginacaoBar(
                    paginaAtual = uiState.pagina,
                    totalPaginas = uiState.totalPaginas,
                    onPaginaAnterior = { viewModel.irParaPagina(uiState.pagina - 1) },
                    onProximaPagina = { viewModel.irParaPagina(uiState.pagina + 1) }
                )
            }
        }
    }
}

@Composable
private fun FiltrosSection(
    filtros: FiltrosHistorico,
    fornecedores: List<String>,
    onFiltrosChanged: (FiltrosHistorico) -> Unit
) {
    var expandirFornecedor by remember { mutableStateOf(false) }
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(8.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = "Filtros",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = filtros.dataInicio,
                    onValueChange = { onFiltrosChanged(filtros.copy(dataInicio = it)) },
                    label = { Text("De") },
                    leadingIcon = { Icon(Icons.Default.DateRange, null) },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
                OutlinedTextField(
                    value = filtros.dataFim,
                    onValueChange = { onFiltrosChanged(filtros.copy(dataFim = it)) },
                    label = { Text("Até") },
                    leadingIcon = { Icon(Icons.Default.DateRange, null) },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            ExposedDropdownMenuBox(
                expanded = expandirFornecedor,
                onExpandedChange = { expandirFornecedor = it }
            ) {
                OutlinedTextField(
                    value = filtros.fornecedor.ifEmpty { "Todos" },
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Fornecedor") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expandirFornecedor) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor()
                )
                ExposedDropdownMenu(
                    expanded = expandirFornecedor,
                    onDismissRequest = { expandirFornecedor = false }
                ) {
                    DropdownMenuItem(
                        text = { Text("Todos") },
                        onClick = {
                            onFiltrosChanged(filtros.copy(fornecedor = ""))
                            expandirFornecedor = false
                        }
                    )
                    fornecedores.forEach { fornecedor ->
                        DropdownMenuItem(
                            text = { Text(fornecedor) },
                            onClick = {
                                onFiltrosChanged(filtros.copy(fornecedor = fornecedor))
                                expandirFornecedor = false
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ResumoCard(
    totalRotas: Int,
    totalEntregas: Int,
    distanciaTotal: Double,
    tempoTotal: Double
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(8.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            ResumoItem(valor = totalRotas.toString(), label = "Rotas")
            ResumoItem(valor = totalEntregas.toString(), label = "Entregas")
            ResumoItem(
                valor = String.format(Locale.getDefault(), "%.1f km", distanciaTotal),
                label = "Distância"
            )
            ResumoItem(
                valor = formatarTempoResumo(tempoTotal),
                label = "Tempo"
            )
        }
    }
}

@Composable
private fun ResumoItem(valor: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = valor,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onPrimaryContainer
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onPrimaryContainer
        )
    }
}

@Composable
private fun PaginacaoBar(
    paginaAtual: Int,
    totalPaginas: Int,
    onPaginaAnterior: () -> Unit,
    onProximaPagina: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(8.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(
            onClick = onPaginaAnterior,
            enabled = paginaAtual > 1
        ) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Anterior")
        }
        Text(
            text = "$paginaAtual / $totalPaginas",
            style = MaterialTheme.typography.bodyMedium
        )
        IconButton(
            onClick = onProximaPagina,
            enabled = paginaAtual < totalPaginas
        ) {
            Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = "Próxima")
        }
    }
}

@Composable
private fun RotaHistoricoCard(
    rota: RotaHistoricoItem,
    onClick: () -> Unit,
    formatarTempo: (Double) -> String
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = rota.nome,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                rota.fornecedor?.let { fornecedor ->
                    AssistChip(
                        onClick = {},
                        label = { Text(fornecedor) },
                        modifier = Modifier.padding(start = 8.dp)
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Text(
                text = formatarData(rota.data),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                InfoChip(label = "${rota.entregas} entregas")
                InfoChip(label = String.format(Locale.getDefault(), "%.1f km", rota.distanciaKm))
                InfoChip(label = formatarTempo(rota.tempoMin))
            }
        }
    }
}

@Composable
private fun InfoChip(label: String) {
    Surface(
        color = MaterialTheme.colorScheme.secondaryContainer,
        shape = MaterialTheme.shapes.small
    ) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSecondaryContainer
        )
    }
}

private fun formatarData(dataString: String): String {
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
        val outputFormat = SimpleDateFormat("dd/MM/yyyy 'às' HH:mm", Locale("pt", "BR"))
        val date = inputFormat.parse(dataString)
        date?.let { outputFormat.format(it) } ?: dataString
    } catch (e: Exception) {
        dataString
    }
}

private fun formatarTempoResumo(minutos: Double): String {
    return if (minutos < 60) {
        "${minutos.toInt()}min"
    } else {
        val h = (minutos / 60).toInt()
        val m = (minutos % 60).toInt()
        "${h}h${m}m"
    }
}
