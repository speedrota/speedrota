package br.com.speedrota.ui.screens.origem

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
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
                .padding(16.dp)
        ) {
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
                        text = "A origem é sua localização atual (onde você está agora), NÃO o endereço do remetente da nota fiscal.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface
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
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.surface
                ),
                enabled = !uiState.isLoadingLocation
            ) {
                if (uiState.isLoadingLocation) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = Primary
                    )
                } else {
                    Icon(
                        Icons.Default.MyLocation,
                        contentDescription = null,
                        tint = Primary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Usar minha localização atual",
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // Divider com "ou"
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                HorizontalDivider(
                    modifier = Modifier.weight(1f),
                    color = MaterialTheme.colorScheme.surfaceVariant
                )
                Text(
                    text = "  ou  ",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall
                )
                HorizontalDivider(
                    modifier = Modifier.weight(1f),
                    color = MaterialTheme.colorScheme.surfaceVariant
                )
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // Campo de endereço manual
            OutlinedTextField(
                value = uiState.endereco,
                onValueChange = viewModel::onEnderecoChange,
                label = { Text("Digite o endereço de origem") },
                placeholder = { Text("Ex: Rua das Flores, 123 - São Paulo") },
                leadingIcon = {
                    Icon(Icons.Default.LocationOn, contentDescription = null)
                },
                trailingIcon = {
                    if (uiState.endereco.isNotEmpty()) {
                        IconButton(onClick = { viewModel.onEnderecoChange("") }) {
                            Icon(Icons.Default.Clear, contentDescription = "Limpar")
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            
            Spacer(modifier = Modifier.height(12.dp))
            
            // Botão buscar endereço
            OutlinedButton(
                onClick = viewModel::searchEndereco,
                modifier = Modifier.fillMaxWidth(),
                enabled = uiState.endereco.isNotBlank() && !uiState.isSearching
            ) {
                if (uiState.isSearching) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Icon(Icons.Default.Search, contentDescription = null)
                }
                Spacer(modifier = Modifier.width(8.dp))
                Text("Buscar endereço")
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
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.Error,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.error
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = uiState.error!!,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }
            
            // Coordenadas encontradas
            if (uiState.latitude != null && uiState.longitude != null) {
                Spacer(modifier = Modifier.height(16.dp))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = Success.copy(alpha = 0.1f)
                    )
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = Success
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text(
                                text = "Localização confirmada",
                                color = Success,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "${String.format("%.6f", uiState.latitude)}, ${String.format("%.6f", uiState.longitude)}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
            
            Spacer(modifier = Modifier.weight(1f))
            
            // Botão continuar
            Button(
                onClick = onOrigemConfirmada,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                enabled = viewModel.isOrigemValida()
            ) {
                Text(
                    text = "Continuar",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.width(8.dp))
                Icon(Icons.Default.ArrowForward, contentDescription = null)
            }
        }
    }
}
