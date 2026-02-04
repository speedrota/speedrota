package br.com.speedrota.ui.screens.pagamento

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import br.com.speedrota.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PagamentoScreen(
    plano: String,
    viewModel: PagamentoViewModel = hiltViewModel(),
    onPagamentoConfirmado: () -> Unit,
    onBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val clipboardManager = LocalClipboardManager.current

    // Gerar PIX ao entrar na tela
    LaunchedEffect(plano) {
        viewModel.gerarPix(plano)
    }

    // Navegar quando pagamento confirmado
    LaunchedEffect(uiState.isPagamentoConfirmado) {
        if (uiState.isPagamentoConfirmado) {
            onPagamentoConfirmado()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Pagamento via PIX") },
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
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (uiState.isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = Primary)
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Gerando PIX...")
                    }
                }
            } else if (uiState.error != null) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Error,
                            contentDescription = null,
                            tint = Error,
                            modifier = Modifier.size(64.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = uiState.error!!,
                            color = Error,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(24.dp))
                        Button(onClick = { viewModel.gerarPix(plano) }) {
                            Text("Tentar novamente")
                        }
                    }
                }
            } else {
                // Info do plano
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = Primary.copy(alpha = 0.1f)
                    )
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "Plano ${plano}",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Assinatura mensal",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Text(
                            text = "R$ ${String.format("%.2f", uiState.valor)}",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = Primary
                        )
                    }
                }
                
                Spacer(modifier = Modifier.height(24.dp))
                
                // QR Code placeholder
                Card(
                    modifier = Modifier
                        .size(200.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = Color.White
                    )
                ) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        // Em produção, usar imagem do QR Code
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                Icons.Default.QrCode2,
                                contentDescription = null,
                                modifier = Modifier.size(120.dp),
                                tint = Color.Black
                            )
                            Text(
                                text = "QR Code PIX",
                                color = Color.Black,
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(24.dp))
                
                Text(
                    text = "ou copie o código PIX",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                
                Spacer(modifier = Modifier.height(12.dp))
                
                // Código copia e cola
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = uiState.codigoCopiaCola.take(30) + "...",
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.weight(1f),
                            maxLines = 1
                        )
                        
                        IconButton(
                            onClick = {
                                clipboardManager.setText(AnnotatedString(uiState.codigoCopiaCola))
                                viewModel.setCopied()
                            }
                        ) {
                            Icon(
                                if (uiState.isCopied) Icons.Default.Check else Icons.Default.ContentCopy,
                                contentDescription = "Copiar",
                                tint = if (uiState.isCopied) Success else Primary
                            )
                        }
                    }
                }
                
                if (uiState.isCopied) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "✓ Código copiado!",
                        color = Success,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                
                Spacer(modifier = Modifier.height(24.dp))
                
                // Status do pagamento
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = when (uiState.statusPagamento) {
                            "approved" -> Success.copy(alpha = 0.1f)
                            "rejected" -> Error.copy(alpha = 0.1f)
                            else -> Warning.copy(alpha = 0.1f)
                        }
                    )
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            strokeWidth = 2.dp,
                            color = Warning
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = when (uiState.statusPagamento) {
                                    "approved" -> "Pagamento confirmado!"
                                    "rejected" -> "Pagamento recusado"
                                    else -> "Aguardando pagamento..."
                                },
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Verificando a cada 5 segundos",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(24.dp))
                
                // Instruções
                Text(
                    text = "Como pagar:",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                
                Spacer(modifier = Modifier.height(8.dp))
                
                val instrucoes = listOf(
                    "Abra o app do seu banco",
                    "Escolha pagar via PIX",
                    "Escaneie o QR Code ou cole o código",
                    "Confirme o pagamento"
                )
                
                instrucoes.forEachIndexed { index, instrucao ->
                    Row(
                        modifier = Modifier.padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(24.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Primary),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "${index + 1}",
                                color = Color.White,
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = instrucao,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }
        }
    }
}
