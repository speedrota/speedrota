package br.com.speedrota.ui.screens.planos

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.speedrota.data.model.CategoriaPlano
import br.com.speedrota.data.model.Plano
import br.com.speedrota.data.model.Promocoes
import br.com.speedrota.ui.theme.*

/**
 * Tela de Planos atualizada com novos planos (Fev/2026)
 * 
 * - Planos Individuais: FREE, STARTER, PRO, FULL
 * - Planos Frota: FROTA_START, FROTA_PRO, FROTA_ENTERPRISE
 * - Sistema de promoções (FROTA60, MIGRACAOVUUPT, ANUAL25)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlanosScreen(
    onSelecionarPlano: (String) -> Unit,
    onBack: () -> Unit
) {
    var categoriaAtiva by remember { mutableStateOf(CategoriaPlano.INDIVIDUAL) }
    var cupomCodigo by remember { mutableStateOf("") }
    var descontoAtivo by remember { mutableStateOf(0) }
    var cupomMensagem by remember { mutableStateOf<String?>(null) }
    
    val planosIndividuais = listOf(Plano.FREE, Plano.STARTER, Plano.PRO, Plano.FULL)
    val planosFrota = listOf(Plano.FROTA_START, Plano.FROTA_PRO, Plano.FROTA_ENTERPRISE)
    val planosAtuais = if (categoriaAtiva == CategoriaPlano.INDIVIDUAL) planosIndividuais else planosFrota
    
    fun aplicarCupom() {
        val promo = Promocoes.buscarPorCodigo(cupomCodigo)
        if (promo != null) {
            descontoAtivo = promo.desconto
            cupomMensagem = "✓ ${promo.desconto}% de desconto aplicado!"
        } else {
            descontoAtivo = 0
            cupomMensagem = "Cupom inválido ou expirado"
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Escolha seu Plano") },
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
                .verticalScroll(rememberScrollState())
        ) {
            Text(
                text = "60-70% mais barato que a concorrência! 🚀",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Text(
                text = "Único app brasileiro com IA, OCR e SEFAZ integrado",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Tabs de categoria
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = categoriaAtiva == CategoriaPlano.INDIVIDUAL,
                    onClick = { categoriaAtiva = CategoriaPlano.INDIVIDUAL },
                    label = { Text("🏍️ Entregadores") },
                    modifier = Modifier.weight(1f)
                )
                FilterChip(
                    selected = categoriaAtiva == CategoriaPlano.FROTA,
                    onClick = { categoriaAtiva = CategoriaPlano.FROTA },
                    label = { Text("🚚 Transportadoras") },
                    modifier = Modifier.weight(1f)
                )
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Banner de promoção para Frota
            if (categoriaAtiva == CategoriaPlano.FROTA) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = Color(0xFFF97316)
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("🔥", fontSize = 20.sp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                "LANÇAMENTO: 60% OFF",
                                color = Color.White,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                "Use o código FROTA60",
                                color = Color.White.copy(alpha = 0.9f),
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
            }
            
            // Campo de cupom
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = cupomCodigo,
                    onValueChange = { cupomCodigo = it.uppercase() },
                    placeholder = { Text("Código promocional") },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    shape = RoundedCornerShape(8.dp)
                )
                Button(
                    onClick = { aplicarCupom() },
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("Aplicar")
                }
            }
            
            cupomMensagem?.let { msg ->
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = msg,
                    color = if (descontoAtivo > 0) Success else Error,
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Medium
                )
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // Cards dos planos
            planosAtuais.forEach { plano ->
                val isPopular = plano == Plano.PRO || plano == Plano.FROTA_PRO
                val isMelhorValor = plano == Plano.FULL || plano == Plano.FROTA_ENTERPRISE
                val precoOriginal = plano.preco
                val precoFinal = if (descontoAtivo > 0 && plano != Plano.FREE) {
                    precoOriginal * (1 - descontoAtivo / 100.0)
                } else precoOriginal
                
                PlanoCard(
                    nome = plano.displayName,
                    emoji = when {
                        isPopular -> "⭐"
                        isMelhorValor -> "💎"
                        plano.isFrota -> "🚚"
                        else -> null
                    },
                    preco = if (precoFinal == 0.0) "Grátis" else "R$ ${String.format("%.2f", precoFinal)}",
                    precoOriginal = if (descontoAtivo > 0 && plano != Plano.FREE) "R$ ${String.format("%.2f", precoOriginal)}" else null,
                    periodo = if (precoFinal > 0) "/mês" else "",
                    features = plano.features,
                    motoristas = plano.maxMotoristas,
                    isDestaque = isPopular,
                    isMelhorValor = isMelhorValor,
                    buttonText = if (plano == Plano.FREE) "Plano Atual" else "Assinar ${plano.displayName}",
                    buttonEnabled = plano != Plano.FREE,
                    onSelect = { onSelecionarPlano(plano.name) }
                )
                
                Spacer(modifier = Modifier.height(16.dp))
            }
            
            // Comparativo para Frota
            if (categoriaAtiva == CategoriaPlano.FROTA) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                    )
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            "💰 Compare com a concorrência",
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.titleSmall
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text("5 motoristas", style = MaterialTheme.typography.bodySmall, color = Color.Gray)
                                Text("SpeedRota", fontWeight = FontWeight.Bold, color = Primary)
                                Text("R$ 299/mês", fontWeight = FontWeight.Bold, color = Primary)
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text("5 motoristas", style = MaterialTheme.typography.bodySmall, color = Color.Gray)
                                Text("Vuupt", color = Color.Gray)
                                Text("R$ 1.000+/mês", color = Color.Gray)
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "✅ 70% de economia!",
                            color = Success,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
            }
            
            // Footer
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("💳 Pagamento via PIX, Cartão ou Boleto", style = MaterialTheme.typography.bodySmall)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("🔒 Cancele quando quiser • 30 dias de garantia", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
fun PlanoCard(
    nome: String,
    emoji: String? = null,
    preco: String,
    precoOriginal: String? = null,
    periodo: String,
    features: List<String>,
    motoristas: Int? = null,
    isDestaque: Boolean,
    isMelhorValor: Boolean = false,
    buttonText: String,
    buttonEnabled: Boolean,
    onSelect: () -> Unit
) {
    val borderColor = when {
        isDestaque -> Primary
        isMelhorValor -> Color(0xFFA855F7)
        else -> MaterialTheme.colorScheme.surfaceVariant
    }
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = if (isDestaque || isMelhorValor) 2.dp else 1.dp,
                color = borderColor,
                shape = RoundedCornerShape(16.dp)
            ),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier.padding(20.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    emoji?.let {
                        Text(it, fontSize = 24.sp)
                        Spacer(modifier = Modifier.width(8.dp))
                    }
                    Text(
                        text = nome,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                }
                
                when {
                    isDestaque -> {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = Primary),
                            shape = RoundedCornerShape(4.dp)
                        ) {
                            Text(
                                text = "POPULAR",
                                color = Color.White,
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                    isMelhorValor -> {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = Color(0xFFA855F7)),
                            shape = RoundedCornerShape(4.dp)
                        ) {
                            Text(
                                text = "MELHOR VALOR",
                                color = Color.White,
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            // Preço
            Column {
                precoOriginal?.let { original ->
                    Text(
                        text = original,
                        style = MaterialTheme.typography.bodyMedium,
                        textDecoration = TextDecoration.LineThrough,
                        color = Color.Gray
                    )
                }
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        text = preco,
                        style = MaterialTheme.typography.displaySmall,
                        fontWeight = FontWeight.Bold,
                        color = if (isDestaque) Primary else MaterialTheme.colorScheme.onSurface
                    )
                    if (periodo.isNotEmpty()) {
                        Text(
                            text = periodo,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(bottom = 4.dp)
                        )
                    }
                }
            }
            
            // Motoristas (para planos Frota)
            motoristas?.let { max ->
                Spacer(modifier = Modifier.height(8.dp))
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = Color(0xFFF0FDF4)
                    ),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = "👥 Até ${if (max >= 999) "ilimitados" else max} motoristas",
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        color = Color(0xFF16A34A),
                        fontWeight = FontWeight.Medium
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Features
            features.forEach { feature ->
                Row(
                    modifier = Modifier.padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = Success,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = feature,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(20.dp))
            
            // Botão
            Button(
                onClick = onSelect,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                enabled = buttonEnabled,
                colors = ButtonDefaults.buttonColors(
                    containerColor = when {
                        isDestaque -> Primary
                        isMelhorValor -> Color(0xFFA855F7)
                        else -> MaterialTheme.colorScheme.surfaceVariant
                    },
                    contentColor = if (isDestaque || isMelhorValor) Color.White else MaterialTheme.colorScheme.onSurface,
                    disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                    disabledContentColor = MaterialTheme.colorScheme.onSurfaceVariant
                )
            ) {
                Text(
                    text = buttonText,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
