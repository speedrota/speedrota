package br.com.speedrota.ui.screens.separacao

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * Tela de Separação de Carga
 * 
 * FLUXO:
 * 1. STEP CAIXAS - Fotografar caixas/etiquetas
 * 2. STEP NOTAS - Fotografar NF-e/DANFEs
 * 3. MATCHING AUTOMÁTICO - PED/REM/SubRota
 * 4. RESULTADO - IDs visuais para cada par
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SeparacaoScreen(
    viewModel: SeparacaoViewModel = hiltViewModel(),
    motoristaId: String? = null,
    motoristaNome: String? = null,
    empresaId: String? = null,
    empresaNome: String? = null,
    onConcluir: () -> Unit,
    onBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    
    // Estado de permissão de câmera
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED
        )
    }
    
    // URIs temporárias para fotos
    var caixaPhotoUri by remember { mutableStateOf<Uri?>(null) }
    var notaPhotoUri by remember { mutableStateOf<Uri?>(null) }

    // Função para criar URI temporária
    fun createTempPhotoUri(prefix: String): Uri {
        val tempFile = File.createTempFile(
            "${prefix}_${System.currentTimeMillis()}",
            ".jpg",
            context.cacheDir
        )
        return FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            tempFile
        )
    }

    // Launcher para solicitar permissão
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        hasCameraPermission = isGranted
    }
    
    // Launcher para câmera - CAIXA (usa TakePicture para maior confiabilidade)
    val cameraLauncherCaixa = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture()
    ) { success ->
        android.util.Log.d("SeparacaoScreen", "=====================================")
        android.util.Log.d("SeparacaoScreen", "cameraLauncherCaixa callback - success: $success")
        android.util.Log.d("SeparacaoScreen", "caixaPhotoUri: $caixaPhotoUri")

        if (success && caixaPhotoUri != null) {
            try {
                android.util.Log.d("SeparacaoScreen", "Abrindo InputStream para URI...")
                val inputStream = context.contentResolver.openInputStream(caixaPhotoUri!!)
                val bitmap = BitmapFactory.decodeStream(inputStream)
                inputStream?.close()

                if (bitmap != null) {
                    android.util.Log.d("SeparacaoScreen", "Bitmap carregado: ${bitmap.width}x${bitmap.height}")
                    val base64 = bitmapToBase64(bitmap)
                    android.util.Log.d("SeparacaoScreen", "Base64 gerado: ${base64.length} chars")
                    android.util.Log.d("SeparacaoScreen", "Chamando viewModel.adicionarCaixa()...")
                    viewModel.adicionarCaixa(base64)
                    android.util.Log.d("SeparacaoScreen", "viewModel.adicionarCaixa() CHAMADO!")
                } else {
                    android.util.Log.e("SeparacaoScreen", "ERRO: Bitmap é null após decode!")
                }
            } catch (e: Exception) {
                android.util.Log.e("SeparacaoScreen", "ERRO ao processar foto caixa: ${e.message}", e)
            }
        } else {
            android.util.Log.w("SeparacaoScreen", "Foto cancelada ou URI null")
        }
        android.util.Log.d("SeparacaoScreen", "=====================================")
    }
    
    // Launcher para câmera - NOTA (usa TakePicture para maior confiabilidade)
    val cameraLauncherNota = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture()
    ) { success ->
        android.util.Log.d("SeparacaoScreen", "=====================================")
        android.util.Log.d("SeparacaoScreen", "cameraLauncherNota callback - success: $success")
        android.util.Log.d("SeparacaoScreen", "notaPhotoUri: $notaPhotoUri")

        if (success && notaPhotoUri != null) {
            try {
                android.util.Log.d("SeparacaoScreen", "Abrindo InputStream para URI...")
                val inputStream = context.contentResolver.openInputStream(notaPhotoUri!!)
                val bitmap = BitmapFactory.decodeStream(inputStream)
                inputStream?.close()

                if (bitmap != null) {
                    android.util.Log.d("SeparacaoScreen", "Bitmap carregado: ${bitmap.width}x${bitmap.height}")
                    val base64 = bitmapToBase64(bitmap)
                    android.util.Log.d("SeparacaoScreen", "Base64 gerado: ${base64.length} chars")
                    android.util.Log.d("SeparacaoScreen", "Chamando viewModel.adicionarNota()...")
                    viewModel.adicionarNota(base64)
                    android.util.Log.d("SeparacaoScreen", "viewModel.adicionarNota() CHAMADO!")
                } else {
                    android.util.Log.e("SeparacaoScreen", "ERRO: Bitmap é null após decode!")
                }
            } catch (e: Exception) {
                android.util.Log.e("SeparacaoScreen", "ERRO ao processar foto nota: ${e.message}", e)
            }
        } else {
            android.util.Log.w("SeparacaoScreen", "Foto cancelada ou URI null")
        }
        android.util.Log.d("SeparacaoScreen", "=====================================")
    }
    
    // Launcher para selecionar múltiplas imagens (lote) - Caixas
    val imageLauncherCaixas = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetMultipleContents()
    ) { uris ->
        android.util.Log.d("SeparacaoScreen", "imageLauncherCaixas: ${uris.size} imagens selecionadas")
        uris.forEach { uri ->
            try {
                android.util.Log.d("SeparacaoScreen", "Processando URI: $uri")
                val inputStream = context.contentResolver.openInputStream(uri)
                val bitmap = android.graphics.BitmapFactory.decodeStream(inputStream)
                inputStream?.close()
                bitmap?.let {
                    android.util.Log.d("SeparacaoScreen", "Bitmap decodificado: ${it.width}x${it.height}")
                    val base64 = bitmapToBase64(it)
                    android.util.Log.d("SeparacaoScreen", "Base64 gerado: ${base64.length} chars")
                    viewModel.adicionarCaixa(base64)
                    android.util.Log.d("SeparacaoScreen", "adicionarCaixa() chamado!")
                }
            } catch (e: Exception) {
                android.util.Log.e("SeparacaoScreen", "Erro ao processar imagem: ${e.message}", e)
            }
        }
    }
    
    // Launcher para selecionar múltiplas imagens (lote) - Notas
    val imageLauncherNotas = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetMultipleContents()
    ) { uris ->
        android.util.Log.d("SeparacaoScreen", "imageLauncherNotas: ${uris.size} imagens selecionadas")
        uris.forEach { uri ->
            try {
                android.util.Log.d("SeparacaoScreen", "Processando URI: $uri")
                val inputStream = context.contentResolver.openInputStream(uri)
                val bitmap = android.graphics.BitmapFactory.decodeStream(inputStream)
                inputStream?.close()
                bitmap?.let {
                    android.util.Log.d("SeparacaoScreen", "Bitmap decodificado: ${it.width}x${it.height}")
                    val base64 = bitmapToBase64(it)
                    android.util.Log.d("SeparacaoScreen", "Base64 gerado: ${base64.length} chars")
                    viewModel.adicionarNota(base64)
                    android.util.Log.d("SeparacaoScreen", "adicionarNota() chamado!")
                }
            } catch (e: Exception) {
                android.util.Log.e("SeparacaoScreen", "Erro ao processar imagem: ${e.message}", e)
            }
        }
    }
    
    // Inicializar com dados do destino
    LaunchedEffect(Unit) {
        viewModel.setDestinoInfo(motoristaId, motoristaNome, empresaId, empresaNome)
    }
    
    val destinoInfo = when {
        motoristaNome != null -> "🚗 $motoristaNome"
        empresaNome != null -> "🏢 $empresaNome"
        else -> ""
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Column {
                        Text("📦 Separação de Carga", fontSize = 18.sp)
                        if (destinoInfo.isNotEmpty()) {
                            Text(
                                destinoInfo, 
                                fontSize = 12.sp, 
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                            )
                        }
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
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            Color(0xFF1e1b4b),
                            Color(0xFF312e81),
                            Color(0xFF1e1b4b)
                        )
                    )
                )
                .padding(paddingValues)
        ) {
            // Step Indicator
            StepIndicator(
                currentStep = uiState.step,
                caixasCount = uiState.caixas.size,
                notasCount = uiState.notas.size
            )
            
            // Conteúdo baseado no step
            when (uiState.step) {
                SeparacaoStep.CAIXAS -> CaixasStep(
                    caixas = uiState.caixas,
                    onFotografar = { 
                        if (hasCameraPermission) {
                            val uri = createTempPhotoUri("caixa")
                            caixaPhotoUri = uri
                            android.util.Log.d("SeparacaoScreen", "Iniciando câmera para CAIXA, URI: $uri")
                            cameraLauncherCaixa.launch(uri)
                        } else {
                            permissionLauncher.launch(Manifest.permission.CAMERA)
                        }
                    },
                    onSelecionar = { imageLauncherCaixas.launch("image/*") },
                    onRemover = { viewModel.removerCaixa(it) },
                    onAvancar = { viewModel.avancarParaNotas() }
                )
                SeparacaoStep.NOTAS -> NotasStep(
                    notas = uiState.notas,
                    caixasCount = uiState.caixas.filter { it.status == ItemStatus.READY }.size,
                    onFotografar = { 
                        if (hasCameraPermission) {
                            val uri = createTempPhotoUri("nota")
                            notaPhotoUri = uri
                            android.util.Log.d("SeparacaoScreen", "Iniciando câmera para NOTA, URI: $uri")
                            cameraLauncherNota.launch(uri)
                        } else {
                            permissionLauncher.launch(Manifest.permission.CAMERA)
                        }
                    },
                    onSelecionar = { imageLauncherNotas.launch("image/*") },
                    onRemover = { viewModel.removerNota(it) },
                    onVoltar = { viewModel.voltarParaCaixas() },
                    onMatching = { viewModel.executarMatching() }
                )
                SeparacaoStep.MATCHING -> MatchingStep(
                    progresso = uiState.progresso,
                    progressoTexto = uiState.progressoTexto
                )
                SeparacaoStep.RESULTADO -> ResultadoStep(
                    pares = uiState.pares,
                    caixasNaoPareadas = uiState.caixasNaoPareadas,
                    notasNaoPareadas = uiState.notasNaoPareadas,
                    onBaixarArquivo = { 
                        val arquivo = viewModel.gerarArquivoSeparacao()
                        // TODO: Salvar arquivo
                    },
                    onGerarRota = onConcluir
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
private fun StepIndicator(
    currentStep: SeparacaoStep,
    caixasCount: Int,
    notasCount: Int
) {
    val steps = listOf(
        StepInfo("Caixas", SeparacaoStep.CAIXAS, caixasCount > 0),
        StepInfo("Notas", SeparacaoStep.NOTAS, notasCount > 0),
        StepInfo("Match", SeparacaoStep.MATCHING, currentStep == SeparacaoStep.RESULTADO),
        StepInfo("Resultado", SeparacaoStep.RESULTADO, false)
    )
    
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically
    ) {
        steps.forEachIndexed { index, step ->
            val isActive = step.step == currentStep
            val isDone = steps.indexOf(steps.find { it.step == currentStep }) > index || step.isDone
            
            Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .background(
                            color = when {
                                isActive -> Color(0xFF3b82f6)
                                isDone -> Color(0xFF22c55e)
                                else -> Color.White.copy(alpha = 0.2f)
                            },
                            shape = CircleShape
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "${index + 1}",
                        color = if (isActive || isDone) Color.White else Color.White.copy(alpha = 0.5f),
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = step.label,
                    color = if (isActive) Color.White else Color.White.copy(alpha = 0.5f),
                    fontSize = 10.sp
                )
            }
            
            if (index < steps.size - 1) {
                Box(
                    modifier = Modifier
                        .width(24.dp)
                        .height(2.dp)
                        .background(Color.White.copy(alpha = 0.2f))
                )
            }
        }
    }
}

data class StepInfo(val label: String, val step: SeparacaoStep, val isDone: Boolean)

@Composable
private fun CaixasStep(
    caixas: List<CaixaItem>,
    onFotografar: () -> Unit,
    onSelecionar: () -> Unit,
    onRemover: (String) -> Unit,
    onAvancar: () -> Unit
) {
    val caixasReady = caixas.filter { it.status == ItemStatus.READY }
    
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Área de scan
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.1f)),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("📦", fontSize = 48.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "Fotografar Caixas",
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        "Tire fotos das etiquetas para leitura automática",
                        color = Color.White.copy(alpha = 0.7f),
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = onFotografar,
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF3b82f6))
                        ) {
                            Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("📷 Foto", fontSize = 14.sp)
                        }
                        
                        OutlinedButton(
                            onClick = onSelecionar,
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
                        ) {
                            Icon(Icons.Default.Folder, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("📂 + Lote", fontSize = 14.sp)
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "💡 Tire foto OU selecione várias caixas de uma vez",
                        color = Color.White.copy(alpha = 0.5f),
                        fontSize = 12.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
        
        // Lista de caixas
        if (caixas.isNotEmpty()) {
            item {
                Text(
                    "📦 Caixas Escaneadas (${caixas.size})",
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
            }
            
            items(caixas) { caixa ->
                CaixaCard(caixa = caixa, onRemover = { onRemover(caixa.id) })
            }
        }
        
        // Botão avançar
        item {
            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = onAvancar,
                enabled = caixasReady.isNotEmpty(),
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF8b5cf6),
                    disabledContainerColor = Color.White.copy(alpha = 0.2f)
                )
            ) {
                Text("Próxima Etapa: Notas →")
            }
            
            Text(
                if (caixasReady.isNotEmpty()) "${caixasReady.size} caixa(s) pronta(s)"
                else "Escaneie pelo menos 1 caixa para continuar",
                color = Color.White.copy(alpha = 0.6f),
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
            )
        }
    }
}

@Composable
private fun CaixaCard(caixa: CaixaItem, onRemover: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.1f)),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Status indicator
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .height(48.dp)
                    .background(
                        color = when (caixa.status) {
                            ItemStatus.READY -> Color(0xFF22c55e)
                            ItemStatus.PROCESSING -> Color(0xFFf59e0b)
                            ItemStatus.ERROR -> Color(0xFFef4444)
                            else -> Color.Gray
                        },
                        shape = RoundedCornerShape(2.dp)
                    )
            )
            
            Spacer(modifier = Modifier.width(12.dp))
            
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = when (caixa.status) {
                        ItemStatus.READY -> caixa.dados?.pedido?.let { "PED $it" } 
                            ?: caixa.dados?.destinatario 
                            ?: "Caixa"
                        ItemStatus.PROCESSING -> "Processando..."
                        ItemStatus.ERROR -> "Erro OCR"
                        else -> "Aguardando..."
                    },
                    color = Color.White,
                    fontWeight = FontWeight.Medium
                )
                
                if (caixa.status == ItemStatus.READY && caixa.dados != null) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        caixa.dados.remessa?.let {
                            Text("REM: $it", color = Color.White.copy(alpha = 0.6f), fontSize = 12.sp)
                        }
                        caixa.dados.subRota?.let {
                            Text("SR: $it", color = Color.White.copy(alpha = 0.6f), fontSize = 12.sp)
                        }
                        caixa.dados.cep?.let {
                            Text("CEP: $it", color = Color.White.copy(alpha = 0.6f), fontSize = 12.sp)
                        }
                    }
                }
            }
            
            IconButton(onClick = onRemover) {
                Icon(
                    Icons.Default.Close,
                    contentDescription = "Remover",
                    tint = Color(0xFFef4444)
                )
            }
        }
    }
}

@Composable
private fun NotasStep(
    notas: List<NotaItem>,
    caixasCount: Int,
    onFotografar: () -> Unit,
    onSelecionar: () -> Unit,
    onRemover: (String) -> Unit,
    onVoltar: () -> Unit,
    onMatching: () -> Unit
) {
    val notasReady = notas.filter { it.status == ItemStatus.READY }
    
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Área de scan
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.1f)),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("📄", fontSize = 48.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "Fotografar Notas",
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        "Tire fotos das NF-e/DANFE para fazer o matching",
                        color = Color.White.copy(alpha = 0.7f),
                        fontSize = 14.sp,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = onFotografar,
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF3b82f6))
                        ) {
                            Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("📷 Foto", fontSize = 14.sp)
                        }
                        
                        OutlinedButton(
                            onClick = onSelecionar,
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
                        ) {
                            Icon(Icons.Default.Folder, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("📂 + Lote", fontSize = 14.sp)
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "💡 Tire foto OU selecione várias notas de uma vez",
                        color = Color.White.copy(alpha = 0.5f),
                        fontSize = 12.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
        
        // Lista de notas
        if (notas.isNotEmpty()) {
            item {
                Text(
                    "📄 Notas Escaneadas (${notas.size})",
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
            }
            
            items(notas) { nota ->
                NotaCard(nota = nota, onRemover = { onRemover(nota.id) })
            }
        }
        
        // Resumo
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Card(
                    modifier = Modifier.weight(1f),
                    colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.1f))
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("📦 Caixas", color = Color.White.copy(alpha = 0.7f), fontSize = 14.sp)
                        Text("$caixasCount", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                    }
                }
                Card(
                    modifier = Modifier.weight(1f),
                    colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.1f))
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("📄 Notas", color = Color.White.copy(alpha = 0.7f), fontSize = 14.sp)
                        Text("${notasReady.size}", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
        
        // Botões
        item {
            Spacer(modifier = Modifier.height(16.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = onVoltar,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
                ) {
                    Text("← Voltar")
                }
                Button(
                    onClick = onMatching,
                    enabled = notasReady.isNotEmpty(),
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFFf97316),
                        disabledContainerColor = Color.White.copy(alpha = 0.2f)
                    )
                ) {
                    Text("🔍 Matching")
                }
            }
        }
    }
}

@Composable
private fun NotaCard(nota: NotaItem, onRemover: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.1f)),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Status indicator
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .height(48.dp)
                    .background(
                        color = when (nota.status) {
                            ItemStatus.READY -> Color(0xFF22c55e)
                            ItemStatus.PROCESSING -> Color(0xFFf59e0b)
                            ItemStatus.ERROR -> Color(0xFFef4444)
                            else -> Color.Gray
                        },
                        shape = RoundedCornerShape(2.dp)
                    )
            )
            
            Spacer(modifier = Modifier.width(12.dp))
            
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = when (nota.status) {
                        ItemStatus.READY -> nota.dados?.destinatario ?: "NF-e"
                        ItemStatus.PROCESSING -> "Processando..."
                        ItemStatus.ERROR -> "Erro OCR"
                        else -> "Aguardando..."
                    },
                    color = Color.White,
                    fontWeight = FontWeight.Medium
                )
                
                if (nota.status == ItemStatus.READY && nota.dados != null) {
                    Text(
                        "${nota.dados.cidade}/${nota.dados.uf} - CEP: ${nota.dados.cep}",
                        color = Color.White.copy(alpha = 0.6f),
                        fontSize = 12.sp
                    )
                }
            }
            
            IconButton(onClick = onRemover) {
                Icon(
                    Icons.Default.Close,
                    contentDescription = "Remover",
                    tint = Color(0xFFef4444)
                )
            }
        }
    }
}

@Composable
private fun MatchingStep(progresso: Float, progressoTexto: String) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1e1b4b)),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                CircularProgressIndicator(
                    progress = { progresso },
                    modifier = Modifier.size(64.dp),
                    color = Color(0xFF3b82f6),
                    trackColor = Color.White.copy(alpha = 0.2f),
                    strokeWidth = 6.dp
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                LinearProgressIndicator(
                    progress = { progresso },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .clip(RoundedCornerShape(4.dp)),
                    color = Color(0xFF3b82f6),
                    trackColor = Color.White.copy(alpha = 0.2f)
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Text(
                    progressoTexto,
                    color = Color.White.copy(alpha = 0.8f),
                    fontSize = 14.sp
                )
            }
        }
    }
}

@Composable
private fun ResultadoStep(
    pares: List<ParMatch>,
    caixasNaoPareadas: List<CaixaItem>,
    notasNaoPareadas: List<NotaItem>,
    onBaixarArquivo: () -> Unit,
    onGerarRota: () -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Header resultado
        item {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("✅ Matching Concluído!", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF22c55e).copy(alpha = 0.2f))
                    ) {
                        Text(
                            "✓ ${pares.size} pareados",
                            color = Color(0xFF22c55e),
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                    if (caixasNaoPareadas.isNotEmpty() || notasNaoPareadas.isNotEmpty()) {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = Color(0xFFf59e0b).copy(alpha = 0.2f))
                        ) {
                            Text(
                                "⚠ ${caixasNaoPareadas.size + notasNaoPareadas.size} não pareados",
                                color = Color(0xFFf59e0b),
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }
        }
        
        // Lista de pares
        itemsIndexed(pares) { index, par ->
            ParCard(index = index + 1, par = par)
        }
        
        // Não pareados
        if (caixasNaoPareadas.isNotEmpty() || notasNaoPareadas.isNotEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFf59e0b).copy(alpha = 0.1f)),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("⚠️ Itens Não Pareados", color = Color(0xFFf59e0b), fontWeight = FontWeight.Bold)
                        
                        if (caixasNaoPareadas.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("📦 Caixas (${caixasNaoPareadas.size})", color = Color.White.copy(alpha = 0.7f))
                            caixasNaoPareadas.forEach { c ->
                                Text("  - ${c.dados?.pedido ?: c.id}", color = Color.White.copy(alpha = 0.6f), fontSize = 12.sp)
                            }
                        }
                        
                        if (notasNaoPareadas.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("📄 Notas (${notasNaoPareadas.size})", color = Color.White.copy(alpha = 0.7f))
                            notasNaoPareadas.forEach { n ->
                                Text("  - ${n.dados?.destinatario ?: n.id}", color = Color.White.copy(alpha = 0.6f), fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
        }
        
        // Botões de ação
        item {
            Spacer(modifier = Modifier.height(16.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = onBaixarArquivo,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
                ) {
                    Icon(Icons.Default.Download, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Baixar")
                }
                Button(
                    onClick = onGerarRota,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF22c55e))
                ) {
                    Icon(Icons.Default.Map, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Gerar Rota")
                }
            }
        }
    }
}

@Composable
private fun ParCard(index: Int, par: ParMatch) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = 3.dp,
                color = Color(par.tagCor),
                shape = RoundedCornerShape(12.dp)
            ),
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.1f)),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Tag
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("#$index", color = Color.White.copy(alpha = 0.5f), fontSize = 12.sp)
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(par.tagCor))
                ) {
                    Text(
                        par.tagVisual,
                        color = Color.White,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            // Destinatário
            Text(
                par.nota.dados?.destinatario ?: "Destino",
                color = Color.White,
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp
            )
            
            // Endereço
            par.nota.dados?.let { dados ->
                Text(
                    "${dados.endereco}\n${dados.cidade}/${dados.uf} - CEP: ${dados.cep}",
                    color = Color.White.copy(alpha = 0.7f),
                    fontSize = 12.sp,
                    lineHeight = 16.sp
                )
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            // Match info
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    "Match: ${par.matchedBy.joinToString(" + ")}",
                    color = Color(0xFF22c55e),
                    fontSize = 12.sp
                )
                Text(
                    "${par.matchScore}pts",
                    color = Color.White.copy(alpha = 0.5f),
                    fontSize = 12.sp
                )
            }
        }
    }
}

private fun bitmapToBase64(bitmap: Bitmap): String {
    val outputStream = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.JPEG, 80, outputStream)
    val byteArray = outputStream.toByteArray()
    return "data:image/jpeg;base64," + Base64.encodeToString(byteArray, Base64.NO_WRAP)
}
