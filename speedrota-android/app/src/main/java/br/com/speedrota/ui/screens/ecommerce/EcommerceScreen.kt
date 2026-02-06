package br.com.speedrota.ui.screens.ecommerce

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import br.com.speedrota.data.model.*

/**
 * Tela de Integrações E-commerce (VTEX + Shopify)
 * 
 * DESIGN POR CONTRATO:
 * @pre Usuário autenticado
 * @post Integrações exibidas e gerenciáveis
 * 
 * @author SpeedRota Team
 * @version 1.0.0
 * @since Sprint 13-14
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EcommerceScreen(
    onNavigateBack: () -> Unit,
    onImportarDestinos: (List<PedidoImportado>) -> Unit,
    viewModel: EcommerceViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var abaSelecionada by remember { mutableIntStateOf(0) }

    // Cores das plataformas
    val vtexColor = Color(0xFFF71963)
    val shopifyColor = Color(0xFF95BF47)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("🛒 E-commerce") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Voltar")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.carregarIntegracoes() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Atualizar")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Mensagens
            uiState.erro?.let { erro ->
                MensagemCard(
                    mensagem = erro,
                    tipo = "erro",
                    onDismiss = { viewModel.limparMensagens() }
                )
            }

            uiState.mensagemSucesso?.let { sucesso ->
                MensagemCard(
                    mensagem = sucesso,
                    tipo = "sucesso",
                    onDismiss = { viewModel.limparMensagens() }
                )
            }

            // Abas
            TabRow(selectedTabIndex = abaSelecionada) {
                Tab(
                    selected = abaSelecionada == 0,
                    onClick = { abaSelecionada = 0 },
                    text = { Text("⚙️ Integrações") }
                )
                Tab(
                    selected = abaSelecionada == 1,
                    onClick = { abaSelecionada = 1 },
                    enabled = uiState.integracaoSelecionada != null,
                    text = { Text("📦 Pedidos (${uiState.pedidos.size})") }
                )
            }

            // Conteúdo
            when {
                uiState.isLoading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }
                
                uiState.mostrarFormulario -> {
                    FormularioIntegracao(
                        isCriando = uiState.isCriando,
                        onSalvar = { dados -> viewModel.criarIntegracao(dados) },
                        onCancelar = { viewModel.toggleFormulario() }
                    )
                }
                
                abaSelecionada == 0 -> {
                    ListaIntegracoes(
                        integracoes = uiState.integracoes,
                        integracaoSelecionada = uiState.integracaoSelecionada,
                        isSincronizando = uiState.isSincronizando,
                        onSelecionar = { id -> viewModel.selecionarIntegracao(id) },
                        onSincronizar = { id -> viewModel.sincronizar(id) },
                        onNovaIntegracao = { viewModel.toggleFormulario() },
                        vtexColor = vtexColor,
                        shopifyColor = shopifyColor
                    )
                }
                
                abaSelecionada == 1 -> {
                    ListaPedidos(
                        pedidos = uiState.pedidos,
                        isLoading = uiState.isLoadingPedidos,
                        onToggle = { id -> viewModel.togglePedido(id) },
                        onToggleTodos = { viewModel.toggleTodos() },
                        onImportar = {
                            // Transferir para RotaDataHolder antes de navegar
                            viewModel.transferirParaDestinos()
                            onImportarDestinos(viewModel.getPedidosSelecionados())
                        },
                        onSincronizar = {
                            uiState.integracaoSelecionada?.let { id ->
                                viewModel.sincronizar(id)
                            }
                        }
                    )
                }
            }
        }
    }
}

/**
 * Card de mensagem (erro ou sucesso)
 */
@Composable
private fun MensagemCard(
    mensagem: String,
    tipo: String,
    onDismiss: () -> Unit
) {
    val backgroundColor = if (tipo == "erro") Color(0xFFFEE2E2) else Color(0xFFDCFCE7)
    val textColor = if (tipo == "erro") Color(0xFFDC2626) else Color(0xFF16A34A)

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        colors = CardDefaults.cardColors(containerColor = backgroundColor)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = mensagem,
                color = textColor,
                modifier = Modifier.weight(1f)
            )
            IconButton(onClick = onDismiss) {
                Icon(
                    Icons.Default.Close,
                    contentDescription = "Fechar",
                    tint = textColor
                )
            }
        }
    }
}

/**
 * Lista de integrações
 */
@Composable
private fun ListaIntegracoes(
    integracoes: List<Integracao>,
    integracaoSelecionada: String?,
    isSincronizando: Boolean,
    onSelecionar: (String) -> Unit,
    onSincronizar: (String) -> Unit,
    onNovaIntegracao: () -> Unit,
    vtexColor: Color,
    shopifyColor: Color
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Suas Integrações",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            Button(onClick = onNovaIntegracao) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(4.dp))
                Text("Nova")
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        if (integracoes.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "Nenhuma integração configurada",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Conecte sua loja VTEX ou Shopify",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(integracoes) { integracao ->
                    IntegracaoCard(
                        integracao = integracao,
                        selecionado = integracaoSelecionada == integracao.id,
                        isSincronizando = isSincronizando,
                        cor = if (integracao.fornecedor == "VTEX") vtexColor else shopifyColor,
                        onSelecionar = { onSelecionar(integracao.id) },
                        onSincronizar = { onSincronizar(integracao.id) }
                    )
                }
            }
        }
    }
}

/**
 * Card de integração
 */
@Composable
private fun IntegracaoCard(
    integracao: Integracao,
    selecionado: Boolean,
    isSincronizando: Boolean,
    cor: Color,
    onSelecionar: () -> Unit,
    onSincronizar: () -> Unit
) {
    val emoji = if (integracao.fornecedor == "VTEX") "🟪" else "🟢"
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onSelecionar() }
            .border(
                width = if (selecionado) 2.dp else 0.dp,
                color = if (selecionado) cor else Color.Transparent,
                shape = RoundedCornerShape(12.dp)
            ),
        elevation = CardDefaults.cardElevation(defaultElevation = if (selecionado) 4.dp else 1.dp)
    ) {
        Column {
            // Header colorido
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(cor)
                    .padding(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = emoji,
                            style = MaterialTheme.typography.titleMedium
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = integracao.fornecedor,
                            color = Color.White,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Text(
                        text = if (integracao.ativo) "✅" else "❌",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }

            // Body
            Column(
                modifier = Modifier.padding(16.dp)
            ) {
                Text(
                    text = integracao.nome ?: "Integração ${integracao.fornecedor}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Medium
                )

                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    horizontalArrangement = Arrangement.spacedBy(24.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "${integracao.totalPedidosImportados}",
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold,
                            color = cor
                        )
                        Text(
                            text = "Pedidos",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "🔄 ${integracao.ultimaSincronizacao?.let { 
                        "Última sync: $it" 
                    } ?: "Nunca sincronizado"}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Actions
            Divider()
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp)
            ) {
                Button(
                    onClick = onSincronizar,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isSincronizando,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.secondaryContainer,
                        contentColor = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                ) {
                    if (isSincronizando) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                    } else {
                        Icon(Icons.Default.Refresh, contentDescription = null)
                        Spacer(modifier = Modifier.width(4.dp))
                    }
                    Text("Sincronizar")
                }
            }
        }
    }
}

/**
 * Formulário para criar integração
 */
@Composable
private fun FormularioIntegracao(
    isCriando: Boolean,
    onSalvar: (CriarIntegracaoRequest) -> Unit,
    onCancelar: () -> Unit
) {
    var fornecedor by remember { mutableStateOf("VTEX") }
    var nome by remember { mutableStateOf("") }
    var accountName by remember { mutableStateOf("") }
    var appKey by remember { mutableStateOf("") }
    var appToken by remember { mutableStateOf("") }
    var shopDomain by remember { mutableStateOf("") }
    var accessToken by remember { mutableStateOf("") }
    var ambiente by remember { mutableStateOf("sandbox") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(
            text = "Nova Integração",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Seleção de plataforma
        Text("Plataforma", style = MaterialTheme.typography.labelLarge)
        Spacer(modifier = Modifier.height(8.dp))
        
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            FilterChip(
                selected = fornecedor == "VTEX",
                onClick = { fornecedor = "VTEX" },
                label = { Text("🟪 VTEX") },
                modifier = Modifier.weight(1f)
            )
            FilterChip(
                selected = fornecedor == "SHOPIFY",
                onClick = { fornecedor = "SHOPIFY" },
                label = { Text("🟢 Shopify") },
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Nome
        OutlinedTextField(
            value = nome,
            onValueChange = { nome = it },
            label = { Text("Nome da Integração") },
            placeholder = { Text("Ex: Minha Loja Principal") },
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Campos VTEX
        if (fornecedor == "VTEX") {
            OutlinedTextField(
                value = accountName,
                onValueChange = { accountName = it },
                label = { Text("Account Name") },
                placeholder = { Text("nome-da-conta") },
                modifier = Modifier.fillMaxWidth(),
                supportingText = { Text("Nome da sua conta VTEX") }
            )

            Spacer(modifier = Modifier.height(12.dp))

            OutlinedTextField(
                value = appKey,
                onValueChange = { appKey = it },
                label = { Text("App Key") },
                placeholder = { Text("vtexappkey-...") },
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(12.dp))

            OutlinedTextField(
                value = appToken,
                onValueChange = { appToken = it },
                label = { Text("App Token") },
                placeholder = { Text("Token secreto") },
                modifier = Modifier.fillMaxWidth()
            )
        }

        // Campos Shopify
        if (fornecedor == "SHOPIFY") {
            OutlinedTextField(
                value = shopDomain,
                onValueChange = { shopDomain = it },
                label = { Text("Domínio da Loja") },
                placeholder = { Text("minhaloja.myshopify.com") },
                modifier = Modifier.fillMaxWidth(),
                supportingText = { Text("Seu domínio .myshopify.com") }
            )

            Spacer(modifier = Modifier.height(12.dp))

            OutlinedTextField(
                value = accessToken,
                onValueChange = { accessToken = it },
                label = { Text("Access Token") },
                placeholder = { Text("shpat_...") },
                modifier = Modifier.fillMaxWidth(),
                supportingText = { Text("Token do Admin API") }
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Ambiente
        Text("Ambiente", style = MaterialTheme.typography.labelLarge)
        Spacer(modifier = Modifier.height(8.dp))
        
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            FilterChip(
                selected = ambiente == "sandbox",
                onClick = { ambiente = "sandbox" },
                label = { Text("🧪 Sandbox") },
                modifier = Modifier.weight(1f)
            )
            FilterChip(
                selected = ambiente == "producao",
                onClick = { ambiente = "producao" },
                label = { Text("🚀 Produção") },
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.height(32.dp))

        // Botões
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedButton(
                onClick = onCancelar,
                modifier = Modifier.weight(1f)
            ) {
                Text("Cancelar")
            }
            Button(
                onClick = {
                    val credentials = if (fornecedor == "VTEX") {
                        CredenciaisIntegracao(
                            accountName = accountName,
                            appKey = appKey,
                            appToken = appToken,
                            ambiente = ambiente
                        )
                    } else {
                        CredenciaisIntegracao(
                            shopDomain = shopDomain,
                            accessToken = accessToken,
                            ambiente = ambiente
                        )
                    }
                    
                    onSalvar(CriarIntegracaoRequest(
                        fornecedor = fornecedor,
                        nome = nome,
                        credentials = credentials
                    ))
                },
                modifier = Modifier.weight(1f),
                enabled = !isCriando && nome.isNotBlank()
            ) {
                if (isCriando) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Icon(Icons.Default.Check, contentDescription = null)
                }
                Spacer(modifier = Modifier.width(4.dp))
                Text("Conectar")
            }
        }
    }
}

/**
 * Lista de pedidos importados
 */
@Composable
private fun ListaPedidos(
    pedidos: List<PedidoImportado>,
    isLoading: Boolean,
    onToggle: (String) -> Unit,
    onToggleTodos: () -> Unit,
    onImportar: () -> Unit,
    onSincronizar: () -> Unit
) {
    val selecionados = pedidos.count { it.selecionado }
    val todosSelecionados = pedidos.isNotEmpty() && pedidos.all { it.selecionado }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "📦 Pedidos Pendentes",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            Row {
                IconButton(onClick = onSincronizar) {
                    Icon(Icons.Default.Refresh, contentDescription = "Atualizar")
                }
                Button(
                    onClick = onImportar,
                    enabled = selecionados > 0
                ) {
                    Text("Importar ($selecionados)")
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Seleção rápida
        if (pedidos.isNotEmpty()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = onToggleTodos) {
                    Text(if (todosSelecionados) "☑️ Desmarcar Todos" else "☐ Selecionar Todos")
                }
                Text(
                    text = "$selecionados de ${pedidos.size} selecionados",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        when {
            isLoading -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            
            pedidos.isEmpty() -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Nenhum pedido pendente")
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "Clique em sincronizar para buscar novos pedidos",
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
            
            else -> {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(pedidos) { pedido ->
                        PedidoCard(
                            pedido = pedido,
                            onClick = { onToggle(pedido.id) }
                        )
                    }
                }
            }
        }
    }
}

/**
 * Card de pedido
 */
@Composable
private fun PedidoCard(
    pedido: PedidoImportado,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        colors = CardDefaults.cardColors(
            containerColor = if (pedido.selecionado)
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
            else
                MaterialTheme.colorScheme.surface
        ),
        border = if (pedido.selecionado)
            androidx.compose.foundation.BorderStroke(2.dp, MaterialTheme.colorScheme.primary)
        else
            null
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = if (pedido.selecionado) "☑️" else "☐",
                style = MaterialTheme.typography.titleLarge
            )

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "#${pedido.idExterno}",
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                    pedido.valorTotal?.let { valor ->
                        Text(
                            text = "R$ ${String.format("%.2f", valor)}",
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF16A34A)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = pedido.cliente,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = "📍 ${pedido.endereco}, ${pedido.cidade} - ${pedido.uf}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}
