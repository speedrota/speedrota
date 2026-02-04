package br.com.speedrota.ui.screens.pagamento

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import br.com.speedrota.ui.theme.*

enum class MetodoPagamento {
    SELECIONAR,
    PIX,
    GOOGLE_PAY,
    CARTAO
}

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
    val context = LocalContext.current

    var metodoPagamento by remember { mutableStateOf(MetodoPagamento.SELECIONAR) }

    // Navegar quando pagamento confirmado
    LaunchedEffect(uiState.isPagamentoConfirmado) {
        if (uiState.isPagamentoConfirmado) {
            onPagamentoConfirmado()
        }
    }

    // Calcular valor do plano
    val valorPlano = when (plano.uppercase()) {
        "PRO" -> 29.90
        "FULL" -> 59.90
        else -> 0.0
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        when (metodoPagamento) {
                            MetodoPagamento.SELECIONAR -> "Escolha o pagamento"
                            MetodoPagamento.PIX -> "Pagamento via PIX"
                            MetodoPagamento.GOOGLE_PAY -> "Google Pay"
                            MetodoPagamento.CARTAO -> "Cartão de Crédito"
                        }
                    )
                },
                navigationIcon = {
                    IconButton(onClick = {
                        if (metodoPagamento != MetodoPagamento.SELECIONAR) {
                            metodoPagamento = MetodoPagamento.SELECIONAR
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
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Info do plano (sempre visível)
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
                        text = "R$ ${String.format("%.2f", valorPlano)}",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = Primary
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            when (metodoPagamento) {
                MetodoPagamento.SELECIONAR -> {
                    // Tela de seleção de método de pagamento
                    Text(
                        text = "Como você prefere pagar?",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Opção PIX
                    MetodoPagamentoCard(
                        icon = Icons.Default.QrCode2,
                        titulo = "PIX",
                        descricao = "Aprovação instantânea",
                        destaque = "Mais rápido",
                        onClick = {
                            metodoPagamento = MetodoPagamento.PIX
                            viewModel.gerarPix(plano)
                        }
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Opção Google Pay
                    MetodoPagamentoCard(
                        icon = Icons.Default.Wallet,
                        titulo = "Google Pay",
                        descricao = "Use sua carteira Google",
                        destaque = null,
                        onClick = {
                            metodoPagamento = MetodoPagamento.GOOGLE_PAY
                        }
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Opção Cartão
                    MetodoPagamentoCard(
                        icon = Icons.Default.CreditCard,
                        titulo = "Cartão de Crédito",
                        descricao = "Parcele em até 3x",
                        destaque = null,
                        onClick = {
                            metodoPagamento = MetodoPagamento.CARTAO
                        }
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    // Segurança
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.Lock,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Pagamento 100% seguro",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                MetodoPagamento.PIX -> {
                    // Tela de pagamento PIX
                    TelaPagamentoPix(
                        uiState = uiState,
                        plano = plano,
                        clipboardManager = clipboardManager,
                        onGerarPix = { viewModel.gerarPix(plano) },
                        onCopiar = { viewModel.setCopied() }
                    )
                }

                MetodoPagamento.GOOGLE_PAY -> {
                    // Tela Google Pay (simulação - requer integração real)
                    TelaGooglePay(
                        valor = valorPlano,
                        plano = plano,
                        onPagar = {
                            // Em produção, integrar com Google Pay API
                            // Por agora, mostra mensagem
                        }
                    )
                }

                MetodoPagamento.CARTAO -> {
                    // Tela de cartão de crédito
                    TelaCartaoCredito(
                        valor = valorPlano,
                        plano = plano,
                        onPagar = {
                            // Em produção, integrar com gateway de pagamento
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun MetodoPagamentoCard(
    icon: ImageVector,
    titulo: String,
    descricao: String,
    destaque: String?,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        border = CardDefaults.outlinedCardBorder()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Primary.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    icon,
                    contentDescription = null,
                    tint = Primary,
                    modifier = Modifier.size(24.dp)
                )
            }

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = titulo,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = descricao,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            if (destaque != null) {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = Success.copy(alpha = 0.1f)
                    )
                ) {
                    Text(
                        text = destaque,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = Success,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.width(8.dp))

            Icon(
                Icons.Default.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun TelaPagamentoPix(
    uiState: PagamentoUiState,
    plano: String,
    clipboardManager: androidx.compose.ui.platform.ClipboardManager,
    onGerarPix: () -> Unit,
    onCopiar: () -> Unit
) {
    if (uiState.isLoading) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(300.dp),
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
                .height(300.dp),
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
                    text = uiState.error,
                    color = Error,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(24.dp))
                Button(onClick = onGerarPix) {
                    Text("Tentar novamente")
                }
            }
        }
    } else {
        // QR Code
        Card(
            modifier = Modifier.size(200.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White)
        ) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
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
                    text = if (uiState.codigoCopiaCola.length > 30)
                        uiState.codigoCopiaCola.take(30) + "..."
                    else
                        uiState.codigoCopiaCola.ifEmpty { "Código PIX será gerado..." },
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.weight(1f),
                    maxLines = 1
                )

                IconButton(
                    onClick = {
                        if (uiState.codigoCopiaCola.isNotEmpty()) {
                            clipboardManager.setText(AnnotatedString(uiState.codigoCopiaCola))
                            onCopiar()
                        }
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
                containerColor = Warning.copy(alpha = 0.1f)
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
                        text = "Aguardando pagamento...",
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

@Composable
fun TelaGooglePay(
    valor: Double,
    plano: String,
    onPagar: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(32.dp))

        Icon(
            Icons.Default.Wallet,
            contentDescription = null,
            modifier = Modifier.size(80.dp),
            tint = Primary
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Google Pay",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Pague de forma rápida e segura com sua carteira Google",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(32.dp))

        Button(
            onClick = onPagar,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.Black
            )
        ) {
            Icon(
                Icons.Default.Wallet,
                contentDescription = null,
                tint = Color.White
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "Pagar R$ ${String.format("%.2f", valor)}",
                fontWeight = FontWeight.Bold
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Você será redirecionado para o Google Pay",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Aviso de integração
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = Warning.copy(alpha = 0.1f)
            )
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Default.Info,
                    contentDescription = null,
                    tint = Warning
                )
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = "Google Pay em breve! Por enquanto, use PIX para pagamento instantâneo.",
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}

@Composable
fun TelaCartaoCredito(
    valor: Double,
    plano: String,
    onPagar: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(32.dp))

        Icon(
            Icons.Default.CreditCard,
            contentDescription = null,
            modifier = Modifier.size(80.dp),
            tint = Primary
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Cartão de Crédito",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Parcele em até 3x sem juros",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Opções de parcelamento
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            )
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                ParcelamentoOption("1x de R$ ${String.format("%.2f", valor)}", true)
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                ParcelamentoOption("2x de R$ ${String.format("%.2f", valor / 2)}", false)
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                ParcelamentoOption("3x de R$ ${String.format("%.2f", valor / 3)}", false)
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = onPagar,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
        ) {
            Icon(Icons.Default.CreditCard, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "Continuar",
                fontWeight = FontWeight.Bold
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Aviso de integração
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = Warning.copy(alpha = 0.1f)
            )
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Default.Info,
                    contentDescription = null,
                    tint = Warning
                )
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = "Pagamento com cartão em breve! Por enquanto, use PIX para pagamento instantâneo.",
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}

@Composable
fun ParcelamentoOption(texto: String, selecionado: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = texto,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (selecionado) FontWeight.Bold else FontWeight.Normal
        )
        if (selecionado) {
            Icon(
                Icons.Default.CheckCircle,
                contentDescription = null,
                tint = Primary
            )
        }
    }
}
