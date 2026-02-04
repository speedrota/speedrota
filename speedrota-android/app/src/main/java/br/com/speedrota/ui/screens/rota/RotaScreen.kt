package br.com.speedrota.ui.screens.rota

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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import br.com.speedrota.data.model.Destino
import br.com.speedrota.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RotaScreen(
    rotaId: String? = null,
    viewModel: RotaViewModel = hiltViewModel(),
    onNovaRota: () -> Unit,
    onBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val uriHandler = LocalUriHandler.current
    
    // Carregar rota do histórico se rotaId foi fornecido
    LaunchedEffect(rotaId) {
        rotaId?.let { viewModel.carregarRotaPorId(it) }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Rota Otimizada") },
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
        ) {
            if (uiState.isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = Primary)
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "Otimizando sua rota...",
                            style = MaterialTheme.typography.bodyLarge
                        )
                    }
                }
            } else if (uiState.error != null) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(32.dp)
                    ) {
                        Icon(
                            Icons.Default.Error,
                            contentDescription = null,
                            tint = Error,
                            modifier = Modifier.size(64.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = uiState.error!!,
                            style = MaterialTheme.typography.bodyLarge,
                            color = Error
                        )
                        Spacer(modifier = Modifier.height(24.dp))
                        Button(onClick = onBack) {
                            Text("Voltar")
                        }
                    }
                }
            } else {
                // Métricas
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surface
                    )
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Resumo da Rota",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly
                        ) {
                            MetricItem(
                                icon = Icons.Default.Route,
                                value = "${String.format("%.1f", uiState.distanciaTotal)} km",
                                label = "Distância"
                            )
                            MetricItem(
                                icon = Icons.Default.Schedule,
                                value = "${uiState.tempoEstimado} min",
                                label = "Tempo"
                            )
                            MetricItem(
                                icon = Icons.Default.LocalGasStation,
                                value = "R$ ${String.format("%.2f", uiState.custoEstimado)}",
                                label = "Combustível"
                            )
                        }
                        
                        if (uiState.economiaPercentual > 0) {
                            Spacer(modifier = Modifier.height(12.dp))
                            Card(
                                colors = CardDefaults.cardColors(
                                    containerColor = Success.copy(alpha = 0.1f)
                                )
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    @Suppress("DEPRECATION")
                                    Icon(
                                        Icons.Default.TrendingDown,
                                        contentDescription = null,
                                        tint = Success
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "Economia de ${String.format("%.0f", uiState.economiaPercentual)}% vs ordem original",
                                        color = Success,
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }
                }
                
                // Lista de destinos ordenados
                Text(
                    text = "Ordem de Entrega",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 16.dp)
                )
                
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    itemsIndexed(uiState.destinosOtimizados) { index, destino ->
                        DestinoRotaCard(
                            destino = destino,
                            index = index + 1,
                            onNavigate = { lat, lng ->
                                // Abrir Google Maps
                                val url = "https://www.google.com/maps/dir/?api=1&destination=$lat,$lng"
                                uriHandler.openUri(url)
                            }
                        )
                    }
                }
                
                // Botões de ação
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = onNovaRota,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Nova Rota")
                    }
                    
                    Button(
                        onClick = {
                            // Abrir navegação para primeiro destino
                            uiState.destinosOtimizados.firstOrNull()?.let { destino ->
                                destino.coordenadas?.let { coord ->
                                    val url = "https://www.google.com/maps/dir/?api=1&destination=${coord.lat},${coord.lng}"
                                    uriHandler.openUri(url)
                                }
                            }
                        },
                        modifier = Modifier.weight(1f),
                        enabled = uiState.destinosOtimizados.isNotEmpty()
                    ) {
                        Icon(Icons.Default.Navigation, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Iniciar")
                    }
                }
            }
        }
    }
}

@Composable
fun MetricItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    value: String,
    label: String
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(
            icon,
            contentDescription = null,
            tint = Primary,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
fun DestinoRotaCard(
    destino: Destino,
    index: Int,
    onNavigate: (Double, Double) -> Unit
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
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Número da ordem
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Primary),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "$index",
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
            }
            
            Spacer(modifier = Modifier.width(12.dp))
            
            // Endereço
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = destino.endereco,
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 2
                )
                destino.fornecedor?.let { fornecedor ->
                    Text(
                        text = fornecedor.uppercase(),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            
            // Botão navegar
            IconButton(
                onClick = {
                    destino.coordenadas?.let { coord ->
                        onNavigate(coord.lat, coord.lng)
                    }
                },
                enabled = destino.coordenadas != null
            ) {
                Icon(
                    Icons.Default.Navigation,
                    contentDescription = "Navegar",
                    tint = if (destino.coordenadas != null) Primary else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
