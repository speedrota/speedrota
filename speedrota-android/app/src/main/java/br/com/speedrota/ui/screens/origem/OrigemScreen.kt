package br.com.speedrota.ui.screens.origem

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import br.com.speedrota.ui.theme.Primary
import br.com.speedrota.ui.theme.Success

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrigemScreen(
    viewModel: OrigemViewModel = hiltViewModel(),
    onOrigemConfirmada: () -> Unit,
    onBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    
    // Etapa atual: 1 = Ponto de Partida, 2 = Ponto de Retorno
    var etapaAtual by remember { mutableIntStateOf(1) }
    var retornarAoMesmoLocal by remember { mutableStateOf(true) }
    var enderecoRetorno by remember { mutableStateOf("") }

    // Permission launcher
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineLocationGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
        val coarseLocationGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        viewModel.onPermissionResult(fineLocationGranted || coarseLocationGranted)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Definir Origem") },
                navigationIcon = {
                    IconButton(onClick = {
                        if (etapaAtual == 2) {
                            etapaAtual = 1
                        } else {
                            onBack()
                        }
                    }) {
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
                .padding(16.dp)
                .verticalScroll(rememberScrollState())
        ) {
            when (etapaAtual) {
                1 -> {
                    // ========== ETAPA 1: PONTO DE PARTIDA ==========
                    Text(
                        text = "📍 Etapa 1: Ponto de Partida",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.align(Alignment.CenterHorizontally)
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Info box
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = Primary.copy(alpha = 0.1f)
                        )
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.Top
                        ) {
                            Icon(
                                Icons.Default.Info,
                                contentDescription = null,
                                tint = Primary
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = "A origem é sua localização atual, não o remetente da NF-e",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Primary
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // Botão usar localização atual
                    Button(
                        onClick = {
                            locationPermissionLauncher.launch(
                                arrayOf(
                                    Manifest.permission.ACCESS_FINE_LOCATION,
                                    Manifest.permission.ACCESS_COARSE_LOCATION
                                )
                            )
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Primary),
                        enabled = !uiState.isLoadingLocation
                    ) {
                        if (uiState.isLoadingLocation) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                color = Color.White
                            )
                        } else {
                            Text("📍 Usar minha localização (GPS)", fontSize = 16.sp)
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // Divider com "ou"
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        HorizontalDivider(modifier = Modifier.weight(1f))
                        Text("  ou  ", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        HorizontalDivider(modifier = Modifier.weight(1f))
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // Botão digitar endereço manualmente
                    OutlinedButton(
                        onClick = { /* TODO: Mostrar campo de input */ },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("✏️ Digitar endereço manualmente")
                    }

                    // Origem selecionada
                    if (uiState.latitude != null && uiState.longitude != null) {
                        Spacer(modifier = Modifier.height(24.dp))

                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = Success.copy(alpha = 0.1f)
                            )
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text("✅", fontSize = 18.sp)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "Origem Selecionada",
                                        fontWeight = FontWeight.Bold,
                                        color = Success
                                    )
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = uiState.endereco.ifEmpty { "Localização via GPS" },
                                    style = MaterialTheme.typography.bodyMedium
                                )
                                Text(
                                    text = "Coordenadas: ${String.format("%.6f", uiState.latitude)}, ${String.format("%.6f", uiState.longitude)}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(24.dp))

                        // Botão próximo
                        Button(
                            onClick = { etapaAtual = 2 },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(56.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Primary)
                        ) {
                            Text("Próximo: Definir Ponto de Retorno", fontSize = 16.sp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null)
                        }
                    }

                    // Erro
                    if (uiState.error != null) {
                        Spacer(modifier = Modifier.height(16.dp))
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.1f)
                            )
                        ) {
                            Row(modifier = Modifier.padding(12.dp)) {
                                Icon(Icons.Default.Error, tint = MaterialTheme.colorScheme.error, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(uiState.error!!, color = MaterialTheme.colorScheme.error)
                            }
                        }
                    }
                }

                2 -> {
                    // ========== ETAPA 2: PONTO DE RETORNO ==========
                    Text(
                        text = "🏁 Etapa 2: Ponto de Retorno",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.align(Alignment.CenterHorizontally)
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Info box
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = Primary.copy(alpha = 0.1f)
                        )
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.Top
                        ) {
                            Icon(Icons.Default.Info, tint = Primary, contentDescription = null)
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = "Para onde você vai após a última entrega?",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Primary
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // Checkbox retornar ao mesmo local
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = if (retornarAoMesmoLocal) Success.copy(alpha = 0.1f)
                                            else MaterialTheme.colorScheme.surface
                        )
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Checkbox(
                                checked = retornarAoMesmoLocal,
                                onCheckedChange = { retornarAoMesmoLocal = it }
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text(
                                    text = "Retornar ao mesmo local da partida",
                                    fontWeight = FontWeight.Medium
                                )
                                if (retornarAoMesmoLocal) {
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = "📍 ${uiState.endereco.ifEmpty { "Localização via GPS" }}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    }

                    if (!retornarAoMesmoLocal) {
                        Spacer(modifier = Modifier.height(16.dp))

                        OutlinedTextField(
                            value = enderecoRetorno,
                            onValueChange = { enderecoRetorno = it },
                            label = { Text("Endereço de retorno") },
                            placeholder = { Text("Digite o endereço de retorno") },
                            leadingIcon = { Icon(Icons.Default.Home, contentDescription = null) },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    Spacer(modifier = Modifier.height(32.dp))

                    // Botão confirmar e adicionar destinos
                    Button(
                        onClick = {
                            viewModel.setRetorno(retornarAoMesmoLocal, enderecoRetorno)
                            onOrigemConfirmada()
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Primary)
                    ) {
                        Text("Confirmar e Adicionar Destinos", fontSize = 16.sp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null)
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Botão voltar para origem
                    OutlinedButton(
                        onClick = { etapaAtual = 1 },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Voltar para Origem")
                    }
                }
            }
        }
    }
}
