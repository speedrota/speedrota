package br.com.speedrota.ui.screens.matching

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import br.com.speedrota.ui.theme.*
import java.io.ByteArrayOutputStream

/**
 * Tela de Matching Caixa ↔ NF-e
 * 
 * Funcionalidades:
 * - Fotografar caixas (etiquetas)
 * - Ver lista de caixas escaneadas
 * - Executar matching automático
 * - Ver resultados com tags visuais
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MatchingScreen(
    viewModel: MatchingViewModel = hiltViewModel(),
    rotaId: String,
    onConcluir: () -> Unit,
    onBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    
    var tabIndex by remember { mutableIntStateOf(0) }
    val tabs = listOf("📦 Caixas", "✅ Matches")
    
    // Launcher para câmera
    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicturePreview()
    ) { bitmap ->
        bitmap?.let {
            val base64 = bitmapToBase64(it)
            viewModel.adicionarCaixa(base64)
        }
    }
    
    // Inicializar com rotaId
    LaunchedEffect(rotaId) {
        viewModel.setRotaId(rotaId)
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Match Caixa ↔ NF-e") },
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
            // Tabs
            TabRow(
                selectedTabIndex = tabIndex,
                containerColor = MaterialTheme.colorScheme.background
            ) {
                tabs.forEachIndexed { index, title ->
                    Tab(
                        selected = tabIndex == index,
                        onClick = { tabIndex = index },
                        text = { Text(title) }
                    )
                }
            }
            
            // Conteúdo
            when (tabIndex) {
                0 -> CaixasTab(
                    caixas = uiState.caixas,
                    isLoading = uiState.isLoading,
                    onFotografar = { cameraLauncher.launch(null) },
                    onExecutarMatching = { viewModel.executarMatching() }
                )
                1 -> MatchesTab(
                    matches = uiState.matches,
                    isLoading = uiState.isLoading,
                    onConcluir = onConcluir
                )
            }
            
            // Erro
            uiState.erro?.let { erro ->
                Snackbar(
                    modifier = Modifier.padding(16.dp),
                    action = {
                        TextButton(onClick = { viewModel.limparErro() }) {
                            Text("OK")
                        }
                    }
                ) {
                    Text(erro)
                }
            }
        }
    }
}

@Composable
private fun CaixasTab(
    caixas: List<MatchingViewModel.CaixaEscaneada>,
    isLoading: Boolean,
    onFotografar: () -> Unit,
    onExecutarMatching: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // Botão fotografar
        Button(
            onClick = onFotografar,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Primary)
        ) {
            Icon(Icons.Default.CameraAlt, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("📷 Fotografar Caixa", fontSize = 16.sp)
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        // Stats
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("${caixas.size}", fontSize = 24.sp, fontWeight = FontWeight.Bold)
                    Text("Caixas", fontSize = 12.sp, color = Color.Gray)
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        "${caixas.count { it.statusMatch == "PAREADO" }}",
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = Success
                    )
                    Text("Pareadas", fontSize = 12.sp, color = Color.Gray)
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        "${caixas.count { it.statusMatch == "PENDENTE" }}",
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = Warning
                    )
                    Text("Pendentes", fontSize = 12.sp, color = Color.Gray)
                }
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        // Lista de caixas
        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(caixas) { caixa ->
                CaixaCard(caixa)
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        // Botão executar matching
        Button(
            onClick = onExecutarMatching,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            enabled = caixas.any { it.statusMatch == "PENDENTE" } && !isLoading,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Success)
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = Color.White
                )
            } else {
                Text("🔄 Executar Matching", fontSize = 16.sp)
            }
        }
    }
}

@Composable
private fun CaixaCard(caixa: MatchingViewModel.CaixaEscaneada) {
    val backgroundColor = when (caixa.statusMatch) {
        "PAREADO" -> Color(0xFFf0fdf4)
        "SEM_MATCH" -> Color(0xFFfef2f2)
        else -> MaterialTheme.colorScheme.surface
    }
    
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = backgroundColor),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Tag visual
            caixa.tagVisual?.let { tag ->
                Box(
                    modifier = Modifier
                        .background(
                            color = Color(MatchingViewModel.CORES_TAG[caixa.tagCor] ?: 0xFF6b7280.toInt()),
                            shape = RoundedCornerShape(4.dp)
                        )
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = tag,
                        color = Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
            }
            
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = caixa.destinatario ?: "Sem destinatário",
                    fontWeight = FontWeight.Medium
                )
                Row {
                    caixa.pedido?.let {
                        Text("PED: $it", fontSize = 12.sp, color = Color.Gray)
                        Spacer(modifier = Modifier.width(8.dp))
                    }
                    caixa.remessa?.let {
                        Text("REM: $it", fontSize = 12.sp, color = Color.Gray)
                    }
                }
                caixa.totalCaixas?.let { total ->
                    if (total > 1) {
                        Text(
                            text = "Caixa ${caixa.numeroCaixa}/$total",
                            fontSize = 11.sp,
                            color = Primary
                        )
                    }
                }
            }
            
            // Status icon
            Icon(
                imageVector = when (caixa.statusMatch) {
                    "PAREADO" -> Icons.Default.Check
                    "SEM_MATCH" -> Icons.Default.Close
                    else -> Icons.Default.HourglassEmpty
                },
                contentDescription = caixa.statusMatch,
                tint = when (caixa.statusMatch) {
                    "PAREADO" -> Success
                    "SEM_MATCH" -> Error
                    else -> Warning
                }
            )
        }
    }
}

@Composable
private fun MatchesTab(
    matches: List<MatchingViewModel.Match>,
    isLoading: Boolean,
    onConcluir: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        if (matches.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("🔗", fontSize = 48.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Execute o matching primeiro",
                        color = Color.Gray
                    )
                }
            }
        } else {
            Text(
                text = "${matches.size} matches encontrados",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(bottom = 16.dp)
            )
            
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(matches) { match ->
                    MatchCard(match)
                }
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        // Botão concluir
        Button(
            onClick = onConcluir,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            enabled = matches.isNotEmpty() && !isLoading,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Primary)
        ) {
            Text("✅ Concluir e Preparar Rota", fontSize = 16.sp)
        }
    }
}

@Composable
private fun MatchCard(match: MatchingViewModel.Match) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFf0fdf4)),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Tag visual
            Box(
                modifier = Modifier
                    .background(
                        color = Color(MatchingViewModel.CORES_TAG[match.tagCor] ?: 0xFF6b7280.toInt()),
                        shape = RoundedCornerShape(4.dp)
                    )
                    .padding(horizontal = 10.dp, vertical = 6.dp)
            ) {
                Text(
                    text = match.tagVisual,
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
            }
            
            Spacer(modifier = Modifier.width(12.dp))
            
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = match.destinatario,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = match.endereco,
                    fontSize = 12.sp,
                    color = Color.Gray,
                    maxLines = 1
                )
                match.totalCaixas?.let { total ->
                    if (total > 1) {
                        Text(
                            text = "📦 ${match.numeroCaixa}/$total caixas",
                            fontSize = 11.sp,
                            color = Primary
                        )
                    }
                }
            }
            
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "${match.score}%",
                    color = Success,
                    fontWeight = FontWeight.Bold
                )
                Text("Match", fontSize = 10.sp, color = Color.Gray)
            }
        }
    }
}

private fun bitmapToBase64(bitmap: Bitmap): String {
    val outputStream = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.JPEG, 80, outputStream)
    val bytes = outputStream.toByteArray()
    return Base64.encodeToString(bytes, Base64.NO_WRAP)
}
