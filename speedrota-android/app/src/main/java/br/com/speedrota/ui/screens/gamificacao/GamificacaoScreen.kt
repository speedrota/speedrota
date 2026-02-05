package br.com.speedrota.ui.screens.gamificacao

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import br.com.speedrota.data.model.*
import br.com.speedrota.ui.theme.Primary

/**
 * Tela de Gamificação - Badges, Ranking, Conquistas
 * 
 * DESIGN POR CONTRATO:
 * @pre Usuário autenticado
 * @post Exibe perfil, badges, ranking e resumo semanal
 * 
 * @author SpeedRota Team
 * @version 1.0.0
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GamificacaoScreen(
    viewModel: GamificacaoViewModel = hiltViewModel(),
    onBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("🎮", fontSize = 24.sp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Conquistas")
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
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Header com Perfil
            uiState.perfil?.let { perfil ->
                PerfilHeader(perfil = perfil)
            }

            // Tabs de navegação
            TabsNavegacao(
                abaAtiva = uiState.abaAtiva,
                onAbaChange = { viewModel.selecionarAba(it) }
            )

            // Conteúdo da aba selecionada
            when (uiState.abaAtiva) {
                AbaGamificacao.BADGES -> BadgesContent(
                    badges = uiState.badges,
                    categoriaSelecionada = uiState.categoriaSelecionada,
                    isLoading = uiState.isLoadingBadges,
                    onCategoriaChange = { viewModel.carregarBadges(it) }
                )
                AbaGamificacao.RANKING -> RankingContent(
                    ranking = uiState.ranking,
                    isLoading = uiState.isLoadingRanking
                )
                AbaGamificacao.RESUMO -> ResumoContent(
                    resumo = uiState.resumoSemanal
                )
            }
        }
    }
}

@Composable
private fun PerfilHeader(perfil: PerfilGamificacaoData) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                Brush.horizontalGradient(
                    listOf(Primary, Primary.copy(alpha = 0.8f))
                )
            )
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Avatar com nível
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.2f))
                    .border(3.dp, Color.White, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "${perfil.nivel}",
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = "Nível",
                        fontSize = 10.sp,
                        color = Color.White.copy(alpha = 0.9f)
                    )
                }
            }

            Spacer(modifier = Modifier.width(16.dp))

            // Info do nível
            Column(modifier = Modifier.weight(1f)) {
                // Barra de progresso
                LinearProgressIndicator(
                    progress = { perfil.progressoNivel.toFloat() },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(12.dp)
                        .clip(RoundedCornerShape(6.dp)),
                    color = Color.White,
                    trackColor = Color.White.copy(alpha = 0.3f)
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = "${perfil.pontosAtuais} / ${perfil.pontosProximoNivel} pts",
                    fontSize = 12.sp,
                    color = Color.White.copy(alpha = 0.9f)
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Stats rápidos
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    StatChip("🏆 ${perfil.badgesConquistados}/${perfil.totalBadges}")
                    StatChip("📍 #${perfil.posicaoRanking}")
                    StatChip("🔥 ${perfil.sequenciaAtual} dias")
                }
            }
        }
    }
}

@Composable
private fun StatChip(text: String) {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = Color.White.copy(alpha = 0.2f)
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            fontSize = 11.sp,
            color = Color.White
        )
    }
}

@Composable
private fun TabsNavegacao(
    abaAtiva: AbaGamificacao,
    onAbaChange: (AbaGamificacao) -> Unit
) {
    TabRow(
        selectedTabIndex = abaAtiva.ordinal,
        containerColor = MaterialTheme.colorScheme.surface,
        contentColor = Primary
    ) {
        Tab(
            selected = abaAtiva == AbaGamificacao.BADGES,
            onClick = { onAbaChange(AbaGamificacao.BADGES) },
            text = { Text("🏆 Badges") }
        )
        Tab(
            selected = abaAtiva == AbaGamificacao.RANKING,
            onClick = { onAbaChange(AbaGamificacao.RANKING) },
            text = { Text("📊 Ranking") }
        )
        Tab(
            selected = abaAtiva == AbaGamificacao.RESUMO,
            onClick = { onAbaChange(AbaGamificacao.RESUMO) },
            text = { Text("📋 Resumo") }
        )
    }
}

@Composable
private fun BadgesContent(
    badges: List<Badge>,
    categoriaSelecionada: String?,
    isLoading: Boolean,
    onCategoriaChange: (String?) -> Unit
) {
    val categorias = listOf(
        null to "Todos",
        "ENTREGAS" to "📦 Entregas",
        "STREAK" to "🔥 Sequência",
        "DISTANCIA" to "🛣️ Distância",
        "VELOCIDADE" to "⚡ Velocidade",
        "PRECISAO" to "🎯 Precisão",
        "FORNECEDOR" to "🏭 Fornecedor",
        "ESPECIAL" to "⭐ Especial"
    )

    Column(modifier = Modifier.fillMaxSize()) {
        // Filtros
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(categorias) { (id, label) ->
                FilterChip(
                    selected = categoriaSelecionada == id,
                    onClick = { onCategoriaChange(id) },
                    label = { Text(label) }
                )
            }
        }

        // Grid de Badges
        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                contentPadding = PaddingValues(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.weight(1f)
            ) {
                items(badges) { badge ->
                    BadgeCard(badge = badge)
                }
            }
        }
    }
}

@Composable
private fun BadgeCard(badge: Badge) {
    val corRaridade = when (badge.raridade) {
        "LENDARIO" -> Color(0xFFF59E0B)
        "EPICO" -> Color(0xFF8B5CF6)
        "RARO" -> Color(0xFF3B82F6)
        "INCOMUM" -> Color(0xFF22C55E)
        else -> Color(0xFF94A3B8)
    }

    val progresso = minOf(1f, badge.progressoAtual.toFloat() / badge.requisito.toFloat())

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .alpha(if (badge.conquistado) 1f else 0.7f),
        colors = CardDefaults.cardColors(
            containerColor = if (badge.conquistado) 
                MaterialTheme.colorScheme.primaryContainer 
            else 
                MaterialTheme.colorScheme.surfaceVariant
        ),
        border = if (badge.conquistado) 
            androidx.compose.foundation.BorderStroke(2.dp, corRaridade) 
        else 
            null
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Ícone
            Box(contentAlignment = Alignment.Center) {
                Text(
                    text = badge.icone,
                    fontSize = 40.sp,
                    modifier = Modifier.alpha(if (badge.conquistado) 1f else 0.5f)
                )
                if (badge.conquistado) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .size(20.dp)
                    ) {
                        Text("✅", fontSize = 14.sp)
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Nome
            Text(
                text = badge.nome,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )

            // Descrição
            Text(
                text = badge.descricao,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                maxLines = 2
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Barra de progresso (se não conquistado)
            if (!badge.conquistado) {
                LinearProgressIndicator(
                    progress = { progresso },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(RoundedCornerShape(3.dp)),
                    color = corRaridade
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "${badge.progressoAtual}/${badge.requisito}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Footer
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = badge.raridade,
                    style = MaterialTheme.typography.labelSmall,
                    color = corRaridade,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "⭐ ${badge.pontos} pts",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun RankingContent(
    ranking: List<RankingItem>,
    isLoading: Boolean
) {
    if (isLoading) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator()
        }
    } else {
        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            item {
                Text(
                    text = "🏆 Ranking Semanal",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
            }

            items(ranking) { item ->
                RankingItemCard(item = item)
            }
        }
    }
}

@Composable
private fun RankingItemCard(item: RankingItem) {
    val medalha = when (item.posicao) {
        1 -> "🥇"
        2 -> "🥈"
        3 -> "🥉"
        else -> "#${item.posicao}"
    }

    val isDestaque = item.posicao <= 3

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (isDestaque) {
                when (item.posicao) {
                    1 -> Color(0xFFFEF3C7)
                    2 -> Color(0xFFE5E7EB)
                    else -> Color(0xFFFED7AA)
                }
            } else {
                MaterialTheme.colorScheme.surfaceVariant
            }
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Posição
            Text(
                text = medalha,
                fontSize = if (isDestaque) 28.sp else 16.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.width(50.dp)
            )

            // Info do usuário
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.nome,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Nível ${item.nivel}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Stats
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "${item.pontos} pts",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Bold,
                    color = Primary
                )
                Text(
                    text = "${item.entregasSemana} entregas",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun ResumoContent(resumo: ResumoSemanalData?) {
    if (resumo == null) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "📊 Sem dados disponiveis ainda",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        return
    }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Destaque
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = Color(0xFFFEF3C7)
                )
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("🌟", fontSize = 32.sp)
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = resumo.destaque,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF78350F)
                    )
                }
            }
        }

        // Stats Grid
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                ResumoStatCard(
                    valor = "${resumo.entregasSemana}",
                    label = "📦 Entregas",
                    modifier = Modifier.weight(1f)
                )
                ResumoStatCard(
                    valor = String.format("%.1f", resumo.kmSemana),
                    label = "🛣️ Km",
                    modifier = Modifier.weight(1f)
                )
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                ResumoStatCard(
                    valor = "+${resumo.pontosGanhos}",
                    label = "⭐ Pontos",
                    modifier = Modifier.weight(1f)
                )
                ResumoStatCard(
                    valor = "${resumo.novosConquistas}",
                    label = "🏆 Conquistas",
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // Metas
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "🎯 Suas Metas",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    MetaProgressBar(
                        label = "Entregas",
                        atual = resumo.meta.entregas.atual,
                        meta = resumo.meta.entregas.meta,
                        progresso = resumo.meta.entregas.progresso.toFloat()
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    MetaProgressBar(
                        label = "Km",
                        atual = resumo.meta.km.atual,
                        meta = resumo.meta.km.meta,
                        progresso = resumo.meta.km.progresso.toFloat()
                    )
                }
            }
        }

        // Posição no ranking
        if (resumo.posicaoMelhorou) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = Color(0xFFDCFCE7)
                    )
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "📈 Você subiu ${resumo.variacaoPosicao} posições no ranking!",
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF166534)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ResumoStatCard(
    valor: String,
    label: String,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = valor,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = Primary
            )
            Text(
                text = label,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun MetaProgressBar(
    label: String,
    atual: Int,
    meta: Int,
    progresso: Float
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.width(70.dp)
        )

        LinearProgressIndicator(
            progress = { minOf(1f, progresso) },
            modifier = Modifier
                .weight(1f)
                .height(10.dp)
                .clip(RoundedCornerShape(5.dp)),
            color = Primary
        )

        Spacer(modifier = Modifier.width(8.dp))

        Text(
            text = "$atual/$meta",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(60.dp),
            textAlign = TextAlign.End
        )
    }
}
