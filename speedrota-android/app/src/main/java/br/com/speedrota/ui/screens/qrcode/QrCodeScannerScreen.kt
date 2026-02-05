package br.com.speedrota.ui.screens.qrcode

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel

/**
 * Tela de Scanner QR Code para NF-e/NFC-e
 * 
 * @pre Usuário autenticado
 * @post QR Codes processados e importados como paradas
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QrCodeScannerScreen(
    viewModel: QrCodeViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onImportarParadas: (List<String>) -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED
        )
    }
    
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        hasCameraPermission = isGranted
    }
    
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFF2563EB),
                        Color(0xFF1D4ED8)
                    )
                )
            )
    ) {
        Column(
            modifier = Modifier.fillMaxSize()
        ) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = onNavigateBack,
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.2f))
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Voltar",
                        tint = Color.White
                    )
                }
                
                Spacer(modifier = Modifier.width(16.dp))
                
                Text(
                    text = "📱 Scanner QR Code NF-e",
                    color = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
            }
            
            // Conteúdo principal (scrollable)
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Área Scanner
                item {
                    ScannerArea(
                        uiState = uiState,
                        hasCameraPermission = hasCameraPermission,
                        onRequestPermission = {
                            permissionLauncher.launch(Manifest.permission.CAMERA)
                        },
                        onInputChange = viewModel::onInputChange,
                        onProcessar = { viewModel.processarQrCode(uiState.inputText) },
                        onLimpar = viewModel::limpar,
                        onAlternarModo = viewModel::alternarModo
                    )
                }
                
                // Erro
                if (uiState.error != null) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = Color(0xFFEF4444).copy(alpha = 0.1f)
                            ),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("⚠️", fontSize = 18.sp)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = uiState.error ?: "",
                                    color = Color(0xFFDC2626),
                                    fontSize = 14.sp
                                )
                            }
                        }
                    }
                }
                
                // Resultado do Scan
                if (uiState.resultado != null) {
                    item {
                        ResultadoCard(
                            resultado = uiState.resultado!!,
                            isLoading = uiState.isLoading,
                            onImportar = viewModel::importarResultado,
                            onNovoScan = viewModel::limpar
                        )
                    }
                }
                
                // Lista de Importados
                if (uiState.importados.isNotEmpty()) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Column(
                                modifier = Modifier.padding(16.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "Paradas Importadas",
                                        fontWeight = FontWeight.Bold
                                    )
                                    
                                    Surface(
                                        color = Color(0xFF2563EB),
                                        shape = RoundedCornerShape(16.dp)
                                    ) {
                                        Text(
                                            text = "${uiState.importados.size}",
                                            color = Color.White,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                    
                    items(uiState.importados) { importado ->
                        ImportadoCard(
                            importado = importado,
                            onRemover = { viewModel.removerImportado(importado.id) }
                        )
                    }
                    
                    // Botão Finalizar
                    item {
                        Button(
                            onClick = {
                                onImportarParadas(uiState.importados.map { it.chaveNfe })
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(56.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF22C55E)
                            )
                        ) {
                            Text("✅", fontSize = 18.sp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Continuar para Destinos (${uiState.importados.size} paradas)",
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
                
                // Empty State
                if (uiState.importados.isEmpty() && uiState.resultado == null) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text("📦", fontSize = 48.sp)
                                Spacer(modifier = Modifier.height(16.dp))
                                Text(
                                    text = "Escaneie ou digite QR Codes de NF-e para adicionar paradas automaticamente",
                                    textAlign = TextAlign.Center,
                                    color = Color.Gray
                                )
                            }
                        }
                    }
                }
                
                // Espaço extra no final
                item { Spacer(modifier = Modifier.height(16.dp)) }
            }
        }
        
        // Loading overlay
        if (uiState.isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.3f)),
                contentAlignment = Alignment.Center
            ) {
                Card(
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        CircularProgressIndicator()
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Processando...")
                    }
                }
            }
        }
    }
}

/**
 * Área de escaneamento (câmera ou input manual)
 */
@Composable
private fun ScannerArea(
    uiState: QrCodeState,
    hasCameraPermission: Boolean,
    onRequestPermission: () -> Unit,
    onInputChange: (String) -> Unit,
    onProcessar: () -> Unit,
    onLimpar: () -> Unit,
    onAlternarModo: (ModoScanner) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            // Toggle de modo
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                ModoButton(
                    text = "📷 Câmera",
                    selected = uiState.modoScanner == ModoScanner.CAMERA,
                    onClick = { onAlternarModo(ModoScanner.CAMERA) },
                    modifier = Modifier.weight(1f)
                )
                
                ModoButton(
                    text = "⌨️ Digitar",
                    selected = uiState.modoScanner == ModoScanner.MANUAL,
                    onClick = { onAlternarModo(ModoScanner.MANUAL) },
                    modifier = Modifier.weight(1f)
                )
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            when (uiState.modoScanner) {
                ModoScanner.CAMERA -> {
                    // Câmera (placeholder - precisa ZXing ou ML Kit)
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(250.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFF1A1A1A)),
                        contentAlignment = Alignment.Center
                    ) {
                        if (hasCameraPermission) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text("📷", fontSize = 48.sp)
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Scanner de câmera",
                                    color = Color.White.copy(alpha = 0.8f)
                                )
                                Text(
                                    text = "(Requer biblioteca ML Kit ou ZXing)",
                                    color = Color.White.copy(alpha = 0.5f),
                                    fontSize = 12.sp
                                )
                            }
                        } else {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text("📵", fontSize = 48.sp)
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Permissão necessária",
                                    color = Color.White
                                )
                                Spacer(modifier = Modifier.height(16.dp))
                                Button(onClick = onRequestPermission) {
                                    Text("Permitir Câmera")
                                }
                            }
                        }
                    }
                }
                
                ModoScanner.MANUAL -> {
                    // Input manual
                    OutlinedTextField(
                        value = uiState.inputText,
                        onValueChange = onInputChange,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(140.dp),
                        placeholder = {
                            Text(
                                "Cole aqui o conteúdo do QR Code ou a chave de acesso (44 dígitos)...\n\nExemplos aceitos:\n• Chave: 35240107418764000106..."
                            )
                        },
                        textStyle = LocalTextStyle.current.copy(
                            fontFamily = FontFamily.Monospace,
                            fontSize = 13.sp
                        ),
                        shape = RoundedCornerShape(8.dp),
                        enabled = !uiState.isLoading
                    )
                    
                    Text(
                        text = "Aceita URL completa, chave de 44 dígitos ou código de barras",
                        fontSize = 12.sp,
                        color = Color.Gray,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = onProcessar,
                            modifier = Modifier.weight(1f),
                            enabled = uiState.inputText.isNotBlank() && !uiState.isLoading,
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            if (uiState.isLoading) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    strokeWidth = 2.dp,
                                    color = Color.White
                                )
                            } else {
                                Text("🔍")
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Processar QR Code")
                        }
                        
                        if (uiState.inputText.isNotBlank()) {
                            OutlinedButton(
                                onClick = onLimpar,
                                enabled = !uiState.isLoading,
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("✕")
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Botão de modo (câmera/manual)
 */
@Composable
private fun ModoButton(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    if (selected) {
        Button(
            onClick = onClick,
            modifier = modifier.height(48.dp),
            shape = RoundedCornerShape(8.dp)
        ) {
            Text(text)
        }
    } else {
        OutlinedButton(
            onClick = onClick,
            modifier = modifier.height(48.dp),
            shape = RoundedCornerShape(8.dp)
        ) {
            Text(text)
        }
    }
}

/**
 * Card de resultado do scan
 */
@Composable
private fun ResultadoCard(
    resultado: QrCodeResultado,
    isLoading: Boolean,
    onImportar: () -> Unit,
    onNovoScan: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            // Header
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(
                            if (resultado.nomeDestinatario != null) 
                                Color(0xFF22C55E).copy(alpha = 0.1f)
                            else 
                                Color(0xFFF59E0B).copy(alpha = 0.1f)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        if (resultado.nomeDestinatario != null) "✅" else "⚠️",
                        fontSize = 24.sp
                    )
                }
                
                Spacer(modifier = Modifier.width(12.dp))
                
                Column {
                    Text(
                        text = resultado.nomeDestinatario ?: "Chave Extraída",
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Tipo: ${resultado.tipoQrCode}",
                        fontSize = 12.sp,
                        color = Color.Gray
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Detalhes
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color(0xFFF9FAFB),
                shape = RoundedCornerShape(8.dp)
            ) {
                Column(
                    modifier = Modifier.padding(12.dp)
                ) {
                    DetalheRow(label = "Chave:", valor = resultado.chaveAcesso, isMonospace = true)
                    
                    resultado.endereco?.let {
                        Divider(modifier = Modifier.padding(vertical = 8.dp))
                        DetalheRow(label = "Endereço:", valor = it)
                    }
                    
                    resultado.valor?.let {
                        Divider(modifier = Modifier.padding(vertical = 8.dp))
                        DetalheRow(
                            label = "Valor:",
                            valor = "R$ ${String.format("%.2f", it)}"
                        )
                    }
                    
                    resultado.dataEmissao?.let {
                        Divider(modifier = Modifier.padding(vertical = 8.dp))
                        DetalheRow(label = "Emissão:", valor = it.take(10))
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Ações
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = onImportar,
                    modifier = Modifier.weight(1f),
                    enabled = !isLoading,
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF22C55E)
                    )
                ) {
                    Text("📍 Adicionar à Rota")
                }
                
                OutlinedButton(
                    onClick = onNovoScan,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("🔄 Novo")
                }
            }
        }
    }
}

/**
 * Linha de detalhe no card de resultado
 */
@Composable
private fun DetalheRow(
    label: String,
    valor: String,
    isMonospace: Boolean = false
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            color = Color.Gray,
            fontSize = 14.sp
        )
        Text(
            text = if (isMonospace && valor.length > 20) 
                "${valor.take(10)}...${valor.takeLast(10)}" 
            else valor,
            fontWeight = FontWeight.Medium,
            fontSize = 14.sp,
            fontFamily = if (isMonospace) FontFamily.Monospace else FontFamily.Default,
            textAlign = TextAlign.End,
            modifier = Modifier.widthIn(max = 200.dp)
        )
    }
}

/**
 * Card de NF-e importada
 */
@Composable
private fun ImportadoCard(
    importado: NfeImportada,
    onRemover: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF22C55E).copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                Text("📦", fontSize = 20.sp)
            }
            
            Spacer(modifier = Modifier.width(12.dp))
            
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = importado.nome,
                    fontWeight = FontWeight.Medium,
                    fontSize = 14.sp
                )
                Text(
                    text = importado.endereco,
                    fontSize = 12.sp,
                    color = Color.Gray
                )
                Text(
                    text = "...${importado.chaveNfe.takeLast(12)}",
                    fontSize = 10.sp,
                    color = Color.LightGray,
                    fontFamily = FontFamily.Monospace
                )
            }
            
            IconButton(onClick = onRemover) {
                Text("🗑️", fontSize = 18.sp)
            }
        }
    }
}
