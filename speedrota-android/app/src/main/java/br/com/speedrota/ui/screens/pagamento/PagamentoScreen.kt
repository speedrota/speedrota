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
                    // Google Pay - redireciona para checkout Mercado Pago
                    TelaGooglePay(
                        valor = valorPlano,
                        plano = plano,
                        checkoutUrl = uiState.checkoutUrl,
                        onIniciarPagamento = { viewModel.iniciarPagamento(plano) }
                    )
                }

                MetodoPagamento.CARTAO -> {
                    // Cartão de Crédito - redireciona para checkout Mercado Pago
                    TelaCartaoCredito(
                        valor = valorPlano,
                        plano = plano,
                        checkoutUrl = uiState.checkoutUrl,
                        onIniciarPagamento = { viewModel.iniciarPagamento(plano) }
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
    val context = LocalContext.current

    // Usar URL do checkout retornada pela API, ou fallback
    val checkoutUrl = uiState.checkoutUrl.ifEmpty {
        "https://speedrota.vercel.app/planos"
    }

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
                Text("Preparando pagamento...")
            }
        }
    } else if (uiState.checkoutUrl.isNotEmpty()) {
        // Sucesso - mostra opção de abrir checkout Mercado Pago
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(16.dp)
        ) {
            Icon(
                Icons.Default.Payment,
                contentDescription = null,
                tint = Primary,
                modifier = Modifier.size(80.dp)
            )
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = "Tudo pronto!",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Clique abaixo para completar seu pagamento de forma segura pelo Mercado Pago",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Você pode pagar via PIX, cartão de crédito ou boleto",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
            
            Spacer(modifier = Modifier.height(32.dp))

            Button(
                onClick = {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(checkoutUrl))
                    context.startActivity(intent)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Primary
                )
            ) {
                Icon(Icons.Default.OpenInBrowser, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Ir para Pagamento",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
            }

            Spacer(modifier = Modifier.height(24.dp))
            
            // Métodos de pagamento disponíveis
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Default.QrCode2,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(24.dp)
                    )
                    Text(
                        text = "PIX",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Default.CreditCard,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(24.dp)
                    )
                    Text(
                        text = "Cartão",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Default.Receipt,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(24.dp)
                    )
                    Text(
                        text = "Boleto",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Informações de segurança
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Icon(
                    Icons.Default.Lock,
                    contentDescription = null,
                    modifier = Modifier.size(14.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "Pagamento 100% seguro via Mercado Pago",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    } else if (uiState.error != null) {
        // Erro - mostra mensagem e botão de retry
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(400.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(16.dp)
            ) {
                Icon(
                    Icons.Default.ErrorOutline,
                    contentDescription = null,
                    tint = Error,
                    modifier = Modifier.size(64.dp)
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Ops! Algo deu errado",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = uiState.error ?: "Erro desconhecido",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(24.dp))

                Button(
                    onClick = onGerarPix,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp)
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Tentar novamente",
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    } else {
        // Estado inicial - não deveria chegar aqui
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(300.dp),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator(color = Primary)
        }
    }
}

@Composable
fun TelaGooglePay(
    valor: Double,
    plano: String,
    checkoutUrl: String,
    onIniciarPagamento: () -> Unit
) {
    val context = LocalContext.current
    
    // Inicia pagamento automaticamente se não tiver URL
    LaunchedEffect(checkoutUrl) {
        if (checkoutUrl.isEmpty()) {
            onIniciarPagamento()
        }
    }

    // URL do checkout - usa a retornada pela API ou fallback
    val urlFinal = checkoutUrl.ifEmpty {
        "https://speedrota.vercel.app/planos"
    }

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
            onClick = {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(urlFinal))
                context.startActivity(intent)
            },
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
            text = "Você será redirecionado para o checkout seguro",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Aviso informativo
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
    checkoutUrl: String,
    onIniciarPagamento: () -> Unit
) {
    val context = LocalContext.current
    
    // Inicia pagamento automaticamente se não tiver URL
    LaunchedEffect(checkoutUrl) {
        if (checkoutUrl.isEmpty()) {
            onIniciarPagamento()
        }
    }

    // URL do checkout - usa a retornada pela API ou fallback
    val urlFinal = checkoutUrl.ifEmpty {
        "https://speedrota.vercel.app/planos"
    }

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
            text = "Parcele em até 12x no Mercado Pago",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Opções de parcelamento (ilustrativo)
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            )
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                ParcelamentoOption("1x de R$ ${String.format("%.2f", valor)} sem juros", true)
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                ParcelamentoOption("2x de R$ ${String.format("%.2f", valor / 2)} sem juros", false)
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                ParcelamentoOption("3x de R$ ${String.format("%.2f", valor / 3)} sem juros", false)
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(urlFinal))
                context.startActivity(intent)
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
        ) {
            Icon(Icons.Default.CreditCard, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "Continuar para Pagamento",
                fontWeight = FontWeight.Bold
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Aviso informativo
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
