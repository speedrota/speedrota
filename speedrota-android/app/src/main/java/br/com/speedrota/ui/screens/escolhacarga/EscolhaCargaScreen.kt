package br.com.speedrota.ui.screens.escolhacarga

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import br.com.speedrota.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

/**
 * Tela de Escolha de Carga
 * 
 * Exibida após definir origem, pergunta:
 * - A carga já foi separada pelo armazenista?
 *   - SIM: Baixar rota pronta
 *   - NÃO: Fazer separação manual
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EscolhaCargaScreen(
    viewModel: EscolhaCargaViewModel = hiltViewModel(),
    onBaixarRota: (rotaId: String) -> Unit,
    onFazerSeparacao: () -> Unit,
    onBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    
    // Navegar quando baixar rota
    LaunchedEffect(uiState.rotaBaixada) {
        uiState.rotaBaixada?.let { rotaId ->
            onBaixarRota(rotaId)
            viewModel.limparRotaBaixada()
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Preparação da Carga") },
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
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(paddingValues)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Título
            item {
                Text(
                    text = if (uiState.isGestorFrota) "📦 Selecione o motorista e prepare a carga" else "📦 A carga já foi separada?",
                    style = MaterialTheme.typography.headlineSmall,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }
            
            // GESTOR_FROTA: Seleção de Motorista
            if (uiState.isGestorFrota) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFeff6ff)),
                        shape = RoundedCornerShape(16.dp),
                        border = androidx.compose.foundation.BorderStroke(2.dp, Primary)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("🚗", fontSize = 24.sp)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Para qual motorista?",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = Primary
                                )
                            }
                            
                            Spacer(modifier = Modifier.height(12.dp))
                            
                            if (uiState.carregandoMotoristas) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(80.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    CircularProgressIndicator(color = Primary)
                                }
                            } else if (uiState.motoristas.isEmpty()) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(Color(0xFFf9fafb), shape = RoundedCornerShape(8.dp))
                                        .padding(24.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text("Nenhum motorista cadastrado", color = Color.Gray)
                                        Spacer(modifier = Modifier.height(8.dp))
                                        OutlinedButton(onClick = { /* navegar para menu-frota */ }) {
                                            Text("+ Cadastrar Motorista")
                                        }
                                    }
                                }
                            } else {
                                uiState.motoristas.forEach { motorista ->
                                    val isSelected = uiState.motoristaSelecionado?.id == motorista.id
                                    OutlinedCard(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 4.dp),
                                        onClick = { viewModel.selecionarMotorista(motorista) },
                                        border = if (isSelected) 
                                            androidx.compose.foundation.BorderStroke(2.dp, Primary) 
                                        else 
                                            androidx.compose.foundation.BorderStroke(1.dp, Color.LightGray),
                                        colors = CardDefaults.outlinedCardColors(
                                            containerColor = if (isSelected) Color(0xFFdbeafe) else Color.White
                                        )
                                    ) {
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(12.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column {
                                                Text(
                                                    text = motorista.nome,
                                                    fontWeight = FontWeight.Bold,
                                                    color = Color.Black
                                                )
                                                Text(
                                                    text = if (motorista.tipoMotorista == "VINCULADO") 
                                                        "📦 ${motorista.empresaNome ?: "Empresa"}" 
                                                    else 
                                                        "🚗 Autônomo",
                                                    fontSize = 12.sp,
                                                    color = Color.Gray
                                                )
                                            }
                                            Text(
                                                text = when (motorista.status) {
                                                    "DISPONIVEL" -> "🟢"
                                                    "EM_ROTA" -> "🔵"
                                                    else -> "⚪"
                                                },
                                                fontSize = 20.sp
                                            )
                                        }
                                    }
                                }
                            }
                            
                            // Motorista selecionado
                            uiState.motoristaSelecionado?.let { motorista ->
                                Spacer(modifier = Modifier.height(12.dp))
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(Success, shape = RoundedCornerShape(8.dp))
                                        .padding(12.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = "✅ Preparando carga para: ${motorista.nome}",
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }
                }
            }
            
            // Só mostra opções de rota se não é gestor OU se já selecionou motorista
            if (!uiState.isGestorFrota || uiState.motoristaSelecionado != null) {
            // Seção: Rotas Prontas
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFf0fdf4)),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("✅", fontSize = 24.sp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Rotas Prontas para Carregar",
                                style = MaterialTheme.typography.titleMedium,
                                color = Success
                            )
                        }
                        
                        Spacer(modifier = Modifier.height(12.dp))
                        
                        if (uiState.isLoading) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(100.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator(color = Success)
                            }
                        } else if (uiState.rotasDisponiveis.isEmpty()) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(
                                        Color(0xFFf9fafb),
                                        shape = RoundedCornerShape(8.dp)
                                    )
                                    .padding(24.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "Nenhuma rota preparada disponível",
                                    color = Color.Gray
                                )
                            }
                        } else {
                            uiState.rotasDisponiveis.forEach { rota ->
                                RotaPreparadaCard(
                                    rota = rota,
                                    baixando = uiState.baixando,
                                    onBaixar = { viewModel.baixarRota(rota.id) }
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                            }
                        }
                    }
                }
            }
            
            // Divider "ou"
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    HorizontalDivider(modifier = Modifier.weight(1f))
                    Text(
                        text = "ou",
                        modifier = Modifier.padding(horizontal = 16.dp),
                        color = Color.Gray
                    )
                    HorizontalDivider(modifier = Modifier.weight(1f))
                }
            }
            
            // Seção: Fazer Separação Manual
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFeff6ff)),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("📷", fontSize = 24.sp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Fazer Separação Agora",
                                style = MaterialTheme.typography.titleMedium,
                                color = Primary
                            )
                        }
                        
                        Spacer(modifier = Modifier.height(8.dp))
                        
                        Text(
                            text = "Fotografe as notas e caixas para montar a rota",
                            color = Color.Gray,
                            textAlign = TextAlign.Center
                        )
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        Button(
                            onClick = onFazerSeparacao,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(56.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Primary)
                        ) {
                            Icon(Icons.Default.CameraAlt, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Escanear Notas e Caixas", fontSize = 16.sp)
                        }
                    }
                }
            }
            } // Fecha o if (!uiState.isGestorFrota || uiState.motoristaSelecionado != null)
            
            // Espaço extra
            item {
                Spacer(modifier = Modifier.height(32.dp))
            }
        }
        
        // Erro
        uiState.erro?.let { erro ->
            Snackbar(
                modifier = Modifier
                    .padding(16.dp)
                    .padding(paddingValues),
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

@Composable
private fun RotaPreparadaCard(
    rota: EscolhaCargaViewModel.RotaPreparada,
    baixando: Boolean,
    onBaixar: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = formatarData(rota.preparadaEm),
                    fontSize = 12.sp,
                    color = Color.Gray
                )
                Text(
                    text = "${rota.totalParadas} destinos • ${rota.totalCaixas} caixas",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium
                )
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            // Tags preview
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                items(rota.caixasPreview) { caixa ->
                    Box(
                        modifier = Modifier
                            .background(
                                color = Color(EscolhaCargaViewModel.CORES_TAG[caixa.tagCor] ?: 0xFF6b7280.toInt()),
                                shape = RoundedCornerShape(4.dp)
                            )
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = caixa.tagVisual ?: caixa.destinatario?.take(8) ?: "?",
                            color = Color.White,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
                
                if (rota.totalCaixas > 6) {
                    item {
                        Box(
                            modifier = Modifier
                                .background(
                                    color = Color(0xFFe5e7eb),
                                    shape = RoundedCornerShape(4.dp)
                                )
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = "+${rota.totalCaixas - 6}",
                                fontSize = 11.sp,
                                color = Color.Gray
                            )
                        }
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            // Botão baixar
            Button(
                onClick = onBaixar,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                enabled = !baixando,
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Success)
            ) {
                if (baixando) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Baixando...")
                } else {
                    Icon(Icons.Default.Download, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Baixar Rota")
                }
            }
        }
    }
}

private fun formatarData(dataString: String): String {
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
        val outputFormat = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
        val date = inputFormat.parse(dataString)
        date?.let { outputFormat.format(it) } ?: dataString
    } catch (e: Exception) {
        dataString.take(10)
    }
}
