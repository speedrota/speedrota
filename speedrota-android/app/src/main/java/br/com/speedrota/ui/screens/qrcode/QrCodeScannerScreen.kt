package br.com.speedrota.ui.screens.qrcode

import android.Manifest
import android.content.pm.PackageManager
import android.util.Log
import android.view.ViewGroup
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
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
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors

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
                        onProcessarCodigo = viewModel::processarQrCode,  // Processa código diretamente
                        onLimpar = viewModel::limpar,
                        onAlternarModo = viewModel::alternarModo,
                        onFotoCapturada = viewModel::setFotoCapturada,
                        onProcessarFoto = viewModel::processarFotoNota,
                        onLimparFoto = viewModel::limparFoto
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
 * Área de escaneamento (câmera, input manual ou foto)
 */
@Composable
private fun ScannerArea(
    uiState: QrCodeState,
    hasCameraPermission: Boolean,
    onRequestPermission: () -> Unit,
    onInputChange: (String) -> Unit,
    onProcessar: () -> Unit,
    onProcessarCodigo: (String) -> Unit,  // Processa código diretamente (evita race condition)
    onLimpar: () -> Unit,
    onAlternarModo: (ModoScanner) -> Unit,
    onFotoCapturada: (String?) -> Unit,
    onProcessarFoto: () -> Unit,
    onLimparFoto: () -> Unit
) {
    val context = LocalContext.current
    
    // Estado para controlar feedback de captura
    var capturando by remember { mutableStateOf(false) }

    // Launcher para capturar foto - usa TakePicturePreview com tratamento melhorado
    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicturePreview()
    ) { bitmap ->
        capturando = false
        Log.d("ScannerArea", "Callback da câmera - bitmap: ${bitmap != null}")
        
        if (bitmap != null) {
            try {
                Log.d("ScannerArea", "Bitmap recebido: ${bitmap.width}x${bitmap.height}")
                
                // Converter bitmap para base64
                val outputStream = java.io.ByteArrayOutputStream()
                bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 85, outputStream)
                val bytes = outputStream.toByteArray()
                val base64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
                
                Log.d("ScannerArea", "Base64 gerado: ${base64.length} chars")
                
                // Atualiza estado com a foto
                onFotoCapturada(base64)
                
                // Processa automaticamente após captura
                // Pequeno delay para UI atualizar
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                    onProcessarFoto()
                }, 300)
                
            } catch (e: Exception) {
                Log.e("ScannerArea", "Erro ao processar bitmap", e)
                android.widget.Toast.makeText(
                    context,
                    "Erro ao processar imagem: ${e.message}",
                    android.widget.Toast.LENGTH_SHORT
                ).show()
            }
        } else {
            Log.w("ScannerArea", "Bitmap nulo - câmera cancelada ou falhou")
            android.widget.Toast.makeText(
                context,
                "Foto não capturada. Tente novamente.",
                android.widget.Toast.LENGTH_SHORT
            ).show()
        }
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            // Toggle de modo - 3 opções
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
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

                ModoButton(
                    text = "📸 Foto",
                    selected = uiState.modoScanner == ModoScanner.FOTO,
                    onClick = { onAlternarModo(ModoScanner.FOTO) },
                    modifier = Modifier.weight(1f)
                )
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            when (uiState.modoScanner) {
                ModoScanner.CAMERA -> {
                    // Câmera real com CameraX + ML Kit
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(300.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFF1A1A1A)),
                        contentAlignment = Alignment.Center
                    ) {
                        if (hasCameraPermission) {
                            CameraPreviewWithScanner(
                                onQrCodeDetected = { qrCode ->
                                    // Usa callback direto para evitar race condition
                                    // onInputChange atualiza UI, onProcessarCodigo processa imediatamente
                                    onInputChange(qrCode)
                                    onProcessarCodigo(qrCode)
                                }
                            )
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

                ModoScanner.FOTO -> {
                    // Modo de captura de foto da nota
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(280.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFFF5F5F5)),
                        contentAlignment = Alignment.Center
                    ) {
                        if (uiState.fotoCapturada != null) {
                            // Exibir preview da foto capturada
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier.fillMaxSize()
                            ) {
                                // Imagem preview
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .fillMaxWidth()
                                        .padding(8.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(Color.LightGray),
                                    contentAlignment = Alignment.Center
                                ) {
                                    // Decodificar e mostrar a imagem
                                    val imageBytes = android.util.Base64.decode(
                                        uiState.fotoCapturada,
                                        android.util.Base64.NO_WRAP
                                    )
                                    val bitmap = android.graphics.BitmapFactory.decodeByteArray(
                                        imageBytes, 0, imageBytes.size
                                    )
                                    if (bitmap != null) {
                                        androidx.compose.foundation.Image(
                                            bitmap = bitmap.asImageBitmap(),
                                            contentDescription = "Foto da nota",
                                            modifier = Modifier.fillMaxSize(),
                                            contentScale = androidx.compose.ui.layout.ContentScale.Fit
                                        )
                                    }
                                }

                                // Botões
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(8.dp),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    OutlinedButton(
                                        onClick = onLimparFoto,
                                        modifier = Modifier.weight(1f),
                                        shape = RoundedCornerShape(8.dp)
                                    ) {
                                        Text("🔄 Nova Foto")
                                    }

                                    Button(
                                        onClick = onProcessarFoto,
                                        modifier = Modifier.weight(1f),
                                        enabled = !uiState.processandoFoto,
                                        shape = RoundedCornerShape(8.dp)
                                    ) {
                                        if (uiState.processandoFoto) {
                                            CircularProgressIndicator(
                                                modifier = Modifier.size(20.dp),
                                                strokeWidth = 2.dp,
                                                color = Color.White
                                            )
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text("Analisando...")
                                        } else {
                                            Text("🔍 Analisar Foto")
                                        }
                                    }
                                }
                            }
                        } else {
                            // Botão para tirar foto ou estado de loading
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center
                            ) {
                                if (capturando || uiState.processandoFoto) {
                                    // Mostra loading enquanto processa
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(60.dp),
                                        strokeWidth = 4.dp,
                                        color = Color(0xFF2563EB)
                                    )
                                    
                                    Spacer(modifier = Modifier.height(16.dp))
                                    
                                    Text(
                                        text = if (capturando) "Capturando foto..." else "🔍 Analisando imagem...",
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 16.sp,
                                        color = Color(0xFF2563EB)
                                    )
                                    
                                    Spacer(modifier = Modifier.height(8.dp))
                                    
                                    Text(
                                        text = if (capturando) "Aguarde..." else "Buscando endereço na nota fiscal",
                                        textAlign = TextAlign.Center,
                                        color = Color.Gray,
                                        fontSize = 13.sp
                                    )
                                } else {
                                    // Botão normal para tirar foto
                                    Button(
                                        onClick = {
                                            if (hasCameraPermission) {
                                                capturando = true
                                                Log.d("ScannerArea", "Iniciando captura de foto...")
                                                cameraLauncher.launch(null)
                                            } else {
                                                onRequestPermission()
                                            }
                                        },
                                        modifier = Modifier.size(100.dp),
                                        shape = CircleShape,
                                        colors = ButtonDefaults.buttonColors(
                                            containerColor = Color(0xFF2563EB)
                                        )
                                    ) {
                                        Text("📸", fontSize = 40.sp)
                                    }

                                    Spacer(modifier = Modifier.height(16.dp))

                                    Text(
                                        text = "Tirar Foto da Nota Fiscal",
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 16.sp
                                    )

                                    Spacer(modifier = Modifier.height(8.dp))

                                    Text(
                                        text = "Fotografe a área onde está a\nchave de acesso (44 dígitos)",
                                        textAlign = TextAlign.Center,
                                        color = Color.Gray,
                                        fontSize = 13.sp
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    // Dicas
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = Color(0xFFEFF6FF)
                        ),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp)
                        ) {
                            Text(
                                text = "💡 Dicas para melhor resultado:",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.sp,
                                color = Color(0xFF1E40AF)
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "• Fotografe a chave de 44 dígitos (números abaixo do código de barras)\n• Garanta boa iluminação\n• Evite reflexos e sombras\n• Mantenha o documento reto",
                                fontSize = 12.sp,
                                color = Color(0xFF3B82F6),
                                lineHeight = 18.sp
                            )
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

/**
 * Preview de câmera com scanner de QR Code usando CameraX + ML Kit
 */
@Composable
private fun CameraPreviewWithScanner(
    onQrCodeDetected: (String) -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    var lastScannedCode by remember { mutableStateOf<String?>(null) }

    val cameraProviderFuture = remember { ProcessCameraProvider.getInstance(context) }

    Box(modifier = Modifier.fillMaxSize()) {
        AndroidView(
            factory = { ctx ->
                val previewView = PreviewView(ctx).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                    scaleType = PreviewView.ScaleType.FILL_CENTER
                }

                val executor = Executors.newSingleThreadExecutor()

                cameraProviderFuture.addListener({
                    val cameraProvider = cameraProviderFuture.get()

                    val preview = Preview.Builder().build().also {
                        it.surfaceProvider = previewView.surfaceProvider
                    }

                    // Configurar scanner para detectar TODOS os formatos de código
                    val options = BarcodeScannerOptions.Builder()
                        .setBarcodeFormats(
                            Barcode.FORMAT_ALL_FORMATS  // Detecta QR Code, Code 128, Code 39, EAN-13, etc.
                        )
                        .build()
                    val barcodeScanner = BarcodeScanning.getClient(options)

                    val imageAnalysis = ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build()
                        .also { analysis ->
                            analysis.setAnalyzer(executor) { imageProxy ->
                                processImageProxy(barcodeScanner, imageProxy) { barcode ->
                                    if (barcode != lastScannedCode) {
                                        lastScannedCode = barcode
                                        onQrCodeDetected(barcode)
                                    }
                                }
                            }
                        }

                    val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

                    try {
                        cameraProvider.unbindAll()
                        cameraProvider.bindToLifecycle(
                            lifecycleOwner,
                            cameraSelector,
                            preview,
                            imageAnalysis
                        )
                    } catch (e: Exception) {
                        Log.e("QrCodeScanner", "Erro ao iniciar câmera", e)
                    }
                }, ContextCompat.getMainExecutor(ctx))

                previewView
            },
            modifier = Modifier.fillMaxSize()
        )

        // Overlay com quadrado de foco
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(40.dp),
            contentAlignment = Alignment.Center
        ) {
            Box(
                modifier = Modifier
                    .size(200.dp)
                    .background(Color.Transparent)
            ) {
                // Cantos do quadrado de foco
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .size(30.dp, 4.dp)
                        .background(Color.White)
                )
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .size(4.dp, 30.dp)
                        .background(Color.White)
                )
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .size(30.dp, 4.dp)
                        .background(Color.White)
                )
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .size(4.dp, 30.dp)
                        .background(Color.White)
                )
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .size(30.dp, 4.dp)
                        .background(Color.White)
                )
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .size(4.dp, 30.dp)
                        .background(Color.White)
                )
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .size(30.dp, 4.dp)
                        .background(Color.White)
                )
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .size(4.dp, 30.dp)
                        .background(Color.White)
                )
            }
        }

        // Texto de instrução
        Text(
            text = "Aponte para o QR Code ou Código de Barras da NF-e",
            color = Color.White,
            fontSize = 14.sp,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 16.dp)
                .background(
                    Color.Black.copy(alpha = 0.6f),
                    RoundedCornerShape(8.dp)
                )
                .padding(horizontal = 16.dp, vertical = 8.dp)
        )
    }
}

/**
 * Processa a imagem para detectar códigos de barras/QR Codes
 * Aceita TODOS os formatos: QR Code, Code 128, Code 39, EAN-13, EAN-8, ITF, PDF417, etc.
 */
@androidx.annotation.OptIn(androidx.camera.core.ExperimentalGetImage::class)
private fun processImageProxy(
    barcodeScanner: com.google.mlkit.vision.barcode.BarcodeScanner,
    imageProxy: ImageProxy,
    onBarcodeDetected: (String) -> Unit
) {
    val mediaImage = imageProxy.image
    if (mediaImage != null) {
        val inputImage = InputImage.fromMediaImage(
            mediaImage,
            imageProxy.imageInfo.rotationDegrees
        )

        barcodeScanner.process(inputImage)
            .addOnSuccessListener { barcodes ->
                for (barcode in barcodes) {
                    barcode.rawValue?.let { value ->
                        // Aceita QUALQUER código detectado (QR Code ou código de barras)
                        // Formatos suportados: QR_CODE, CODE_128, CODE_39, CODE_93, CODABAR,
                        // EAN_13, EAN_8, ITF, UPC_A, UPC_E, PDF417, AZTEC, DATA_MATRIX
                        if (value.isNotBlank()) {
                            Log.d("QrCodeScanner", "Código detectado - Formato: ${barcode.format}, Valor: $value")
                            onBarcodeDetected(value)
                        }
                    }
                }
            }
            .addOnFailureListener { e ->
                Log.e("QrCodeScanner", "Erro ao processar imagem", e)
            }
            .addOnCompleteListener {
                imageProxy.close()
            }
    } else {
        imageProxy.close()
    }
}
