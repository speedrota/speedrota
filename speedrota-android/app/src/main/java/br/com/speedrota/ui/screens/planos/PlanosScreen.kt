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
import br.com.speedrota.data.model.Plano
import br.com.speedrota.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlanosScreen(
    onSelecionarPlano: (String) -> Unit,
    onBack: () -> Unit
) {
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
                text = "Faça mais entregas, economize mais! 🚀",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Text(
                text = "Escolha o plano ideal para suas entregas",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // Plano FREE
            PlanoCard(
                nome = "Grátis",
                preco = "R$ 0",
                periodo = "/mês",
                features = listOf(
                    "2 rotas por dia",
                    "Até 5 destinos por rota",
                    "Otimização básica",
                    "Suporte por email"
                ),
                isDestaque = false,
                buttonText = "Plano Atual",
                buttonEnabled = false,
                onSelect = {}
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Plano PRO
            PlanoCard(
                nome = "Pro",
                emoji = "⭐",
                preco = "R$ 19,90",
                periodo = "/mês",
                features = listOf(
                    "10 rotas por dia",
                    "Até 20 destinos por rota",
                    "OCR aprimorado",
                    "Histórico de rotas",
                    "Suporte prioritário"
                ),
                isDestaque = true,
                buttonText = "Assinar Pro",
                buttonEnabled = true,
                onSelect = { onSelecionarPlano("PRO") }
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Plano FULL
            PlanoCard(
                nome = "Full",
                emoji = "💎",
                preco = "R$ 39,90",
                periodo = "/mês",
                features = listOf(
                    "Rotas ilimitadas",
                    "Até 50 destinos por rota",
                    "OCR premium com IA",
                    "Relatórios detalhados",
                    "API de integração",
                    "Suporte 24/7"
                ),
                isDestaque = false,
                buttonText = "Assinar Full",
                buttonEnabled = true,
                onSelect = { onSelecionarPlano("FULL") }
            )
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // Info PIX
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                )
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("💳", fontSize = 24.sp)
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = "Pagamento via PIX",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Aprovação instantânea • Sem mensalidade",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
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
    periodo: String,
    features: List<String>,
    isDestaque: Boolean,
    buttonText: String,
    buttonEnabled: Boolean,
    onSelect: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .then(
                if (isDestaque) {
                    Modifier.border(
                        width = 2.dp,
                        color = Primary,
                        shape = RoundedCornerShape(16.dp)
                    )
                } else Modifier
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
                
                if (isDestaque) {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = Primary
                        ),
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
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            // Preço
            Row(
                verticalAlignment = Alignment.Bottom
            ) {
                Text(
                    text = preco,
                    style = MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.Bold,
                    color = if (isDestaque) Primary else MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = periodo,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 4.dp)
                )
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
                    containerColor = if (isDestaque) Primary else MaterialTheme.colorScheme.surfaceVariant,
                    contentColor = if (isDestaque) Color.White else MaterialTheme.colorScheme.onSurface,
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
