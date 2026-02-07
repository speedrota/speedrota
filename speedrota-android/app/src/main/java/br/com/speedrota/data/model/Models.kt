package br.com.speedrota.data.model

import kotlinx.serialization.Serializable

// ==================== GENERIC ====================

/**
 * Response genérica para endpoints que retornam apenas sucesso/erro
 */
@Serializable
data class ApiResponse<T>(
    val success: Boolean = false,
    val data: T? = null,
    val message: String? = null,
    val error: String? = null
)

/**
 * Response simples sem dados
 */
@Serializable
data class SimpleApiResponse(
    val success: Boolean = false,
    val message: String? = null,
    val error: String? = null
)

// ==================== AUTH ====================

@Serializable
data class RegisterRequest(
    val nome: String,
    val email: String,
    val senha: String,
    val telefone: String? = null,
    val tipoUsuario: String = "ENTREGADOR"
)

@Serializable
data class LoginRequest(
    val email: String,
    val senha: String
)

@Serializable
data class AuthResponse(
    val success: Boolean = false,
    val data: AuthData? = null,
    val error: String? = null,
    val message: String? = null
)

@Serializable
data class AuthData(
    val user: UserData? = null,
    val token: String? = null
)

@Serializable
data class UserData(
    val id: String,
    val nome: String,
    val email: String,
    val plano: String,
    val telefone: String? = null,
    val rotasRestantes: Int? = null,
    val tipoUsuario: String = "ENTREGADOR"
)

@Serializable
data class UserResponse(
    val success: Boolean,
    val usuario: UserData? = null,
    val error: String? = null
)

// ==================== PASSWORD RECOVERY ====================

@Serializable
data class ForgotPasswordRequest(
    val email: String
)

@Serializable
data class ForgotPasswordResponse(
    val success: Boolean,
    val message: String? = null,
    val resetCode: String? = null, // Apenas em dev
    val error: String? = null
)

@Serializable
data class VerifyResetCodeRequest(
    val email: String,
    val code: String
)

@Serializable
data class VerifyResetCodeResponse(
    val success: Boolean,
    val message: String? = null,
    val error: String? = null
)

@Serializable
data class ResetPasswordRequest(
    val email: String,
    val code: String,
    val novaSenha: String
)

@Serializable
data class ResetPasswordResponse(
    val success: Boolean,
    val message: String? = null,
    val error: String? = null
)

// ==================== ROTAS ====================

@Serializable
data class Coordenada(
    val lat: Double,
    val lng: Double
)

@Serializable
data class Destino(
    val endereco: String,
    val coordenadas: Coordenada? = null,
    val fornecedor: String? = null,
    val ordem: Int? = null,
    // Novos campos - janela de tempo e prioridade
    val janelaInicio: String? = null,
    val janelaFim: String? = null,
    val prioridade: String? = null // "ALTA", "MEDIA", "BAIXA"
)

@Serializable
data class CreateRotaRequest(
    val nome: String? = null,
    val origem: String,
    val destinos: List<Destino>
)

@Serializable
data class OtimizarRotaRequest(
    val origem: Coordenada,
    val destinos: List<Destino>
)

@Serializable
data class RotaResponse(
    val success: Boolean,
    val rota: RotaData? = null,
    val error: String? = null
)

@Serializable
data class ListaRotasResponse(
    val rotas: List<RotaListItem>,
    val total: Int,
    val pagina: Int,
    val porPagina: Int,
    val totalPaginas: Int
)

@Serializable
data class RotaDetalheResponse(
    val success: Boolean,
    val data: RotaListItem? = null,
    val error: String? = null
)

@Serializable
data class RotaListItem(
    val id: String,
    val nome: String,
    val createdAt: String,
    val fornecedor: String? = null,
    val totalParadas: Int,
    val distanciaTotal: Double? = null,
    val tempoEstimado: Int? = null,
    val origemEndereco: String? = null,
    val origemLat: Double? = null,
    val origemLng: Double? = null,
    val paradas: List<ParadaItem>? = null
)

@Serializable
data class ParadaItem(
    val id: String,
    val rotaId: String,
    val endereco: String,
    val lat: Double,
    val lng: Double,
    val ordem: Int,
    val status: String? = null,
    val fornecedor: String? = null,
    val nomeDestinatario: String? = null,
    val telefone: String? = null,
    // Novos campos - janela de tempo e prioridade
    val janelaInicio: String? = null,
    val janelaFim: String? = null,
    val prioridade: String? = null, // "ALTA", "MEDIA", "BAIXA"
    val createdAt: String? = null
)

@Serializable
data class RotaData(
    val id: String,
    val nome: String? = null,
    val origem: String,
    val destinos: List<Destino>,
    val distanciaTotal: Double? = null,
    val tempoEstimado: Int? = null,
    val custoEstimado: Double? = null,
    val criadaEm: String? = null
)

@Serializable
data class OtimizarRotaResponse(
    val success: Boolean,
    val rotaOtimizada: List<Destino>? = null,
    val metricas: MetricasRota? = null,
    val error: String? = null
)

@Serializable
data class MetricasRota(
    val distanciaTotal: Double,
    val tempoEstimado: Int,
    val custoEstimado: Double,
    val economiaPercentual: Double? = null
)

// ==================== PAGAMENTOS ====================

// Request para criar preferência de pagamento
@Serializable
data class PreferenceRequest(
    val plano: String // "PRO" ou "FULL"
)

// Response da criação de preferência
@Serializable
data class PreferenceResponse(
    val success: Boolean,
    val data: PreferenceData? = null,
    val error: String? = null
)

@Serializable
data class PreferenceData(
    val preferenceId: String,
    val initPoint: String, // URL para checkout
    val sandboxInitPoint: String? = null
)

// Request para confirmar upgrade
@Serializable
data class ConfirmUpgradeRequest(
    val plano: String,
    val paymentId: String? = null
)

// Response de confirmação de upgrade
@Serializable
data class ConfirmUpgradeResponse(
    val success: Boolean,
    val data: UpgradeData? = null,
    val error: String? = null
)

@Serializable
data class UpgradeData(
    val plano: String,
    val mensagem: String
)

// Response do status do pagamento
@Serializable
data class PaymentStatusResponse(
    val success: Boolean,
    val data: PaymentStatusData? = null,
    val error: String? = null
)

@Serializable
data class PaymentStatusData(
    val id: Long? = null,
    val status: String, // "pending", "approved", "rejected"
    val statusDetail: String? = null,
    val approved: Boolean
)

// Response da assinatura atual
@Serializable
data class SubscriptionResponse(
    val success: Boolean,
    val data: SubscriptionData? = null,
    val error: String? = null
)

@Serializable
data class SubscriptionData(
    val plano: String,
    val expiraEm: String? = null,
    val ativo: Boolean,
    val rotasNoMes: Int,
    val limites: LimitesPlano
)

@Serializable
data class LimitesPlano(
    val rotasPorMes: Int? = null,
    val paradasPorRota: Int,
    val fornecedores: Int? = null,
    val historicosDias: Int,
    val pdfUpload: Boolean,
    val apiAccess: Boolean
)

// Response dos planos disponíveis
@Serializable
data class PlanosResponse(
    val success: Boolean,
    val data: List<PlanoInfo>? = null,
    val error: String? = null
)

@Serializable
data class PlanoInfo(
    val id: String,
    val nome: String,
    val preco: Double,
    val precoFormatado: String,
    val recursos: List<String>,
    val limites: LimitesPlano,
    val popular: Boolean? = false
)

// Response da public key
@Serializable
data class PublicKeyResponse(
    val success: Boolean,
    val data: PublicKeyData? = null,
    val error: String? = null
)

@Serializable
data class PublicKeyData(
    val publicKey: String
)

// ==================== PIX DIRETO ====================

// Response do PIX direto (novo endpoint)
@Serializable
data class PixDirectResponse(
    val success: Boolean,
    val data: PixDirectData? = null,
    val error: String? = null
)

@Serializable
data class PixDirectData(
    val paymentId: String,
    val qrCode: String, // Código copia e cola
    val qrCodeBase64: String, // Imagem base64 do QR Code
    val valor: Double,
    val valorFormatado: String,
    val expiracao: String? = null,
    val status: String
)

// ==================== CARTÃO ====================

// Request para pagamento com cartão
@Serializable
data class CardPaymentRequest(
    val plano: String, // "PRO" ou "FULL"
    val token: String, // Token do cartão gerado pelo SDK
    val paymentMethodId: String, // visa, mastercard, etc
    val installments: Int = 1,
    val email: String,
    val identificationType: String? = null, // CPF
    val identificationNumber: String? = null
)

// Response do pagamento com cartão
@Serializable
data class CardPaymentResponse(
    val success: Boolean,
    val data: CardPaymentData? = null,
    val error: String? = null
)

@Serializable
data class CardPaymentData(
    val paymentId: String,
    val status: String, // approved, rejected, pending
    val statusDetail: String? = null,
    val approved: Boolean
)

// ==================== LEGACY (mantido para compatibilidade) ====================

@Serializable
data class PixRequest(
    val plano: String,
    val email: String
)

@Serializable
data class PixResponse(
    val success: Boolean,
    val qrCode: String? = null,
    val qrCodeBase64: String? = null,
    val copiaCola: String? = null,
    val valor: Double? = null,
    val pagamentoId: String? = null,
    val error: String? = null
)

@Serializable
data class StatusPagamentoResponse(
    val success: Boolean,
    val status: String? = null, // "pending", "approved", "rejected"
    val plano: String? = null,
    val error: String? = null
)

// ==================== ANALYTICS ====================

/**
 * Request para endpoints de analytics
 * @pre periodo válido: 7d, 30d, 90d, 365d
 */
@Serializable
data class AnalyticsParams(
    val periodo: String = "30d",
    val dataInicio: String? = null,
    val dataFim: String? = null,
    val fornecedor: String? = null
)

/**
 * KPIs principais do dashboard
 */
@Serializable
data class AnalyticsKPIs(
    val totalRotas: Int = 0,
    val rotasFinalizadas: Int = 0,
    val totalParadas: Int = 0,
    val totalKm: Double = 0.0,
    val taxaSucesso: Double = 0.0,
    // PRO+
    val tempoTotalMin: Int? = null,
    val custoTotal: Double? = null,
    val kmMedio: Double? = null,
    val tempoMedio: Int? = null,
    // FULL+
    val paradasEntregues: Int? = null,
    val economiaPercent: Double? = null
)

@Serializable
data class AnalyticsPeriodo(
    val inicio: String,
    val fim: String
)

@Serializable
data class ComparativoAnterior(
    val rotas: Int = 0,
    val km: Double = 0.0,
    val custo: Double = 0.0
)

@Serializable
data class FeaturesDisponiveis(
    val filtrosPeriodo: Boolean = false,
    val filtrosFornecedor: Boolean = false,
    val exportCSV: Boolean = false,
    val exportPDF: Boolean = false,
    val heatmap: Boolean = false,
    val insights: Boolean = false,
    val trends: Boolean = false,
    val suppliers: Boolean = false
)

@Serializable
data class OverviewData(
    val plano: String,
    val dashboardNivel: String, // "essencial", "avancado", "completo"
    val periodo: AnalyticsPeriodo,
    val kpis: AnalyticsKPIs,
    val comparativoAnterior: ComparativoAnterior? = null,
    val featuresDisponiveis: FeaturesDisponiveis
)

@Serializable
data class OverviewResponse(
    val success: Boolean,
    val data: OverviewData? = null,
    val error: String? = null
)

/**
 * Status das entregas
 */
@Serializable
data class StatusTotais(
    val total: Int = 0,
    val entregues: Int = 0,
    val pendentes: Int = 0,
    val ausentes: Int = 0,
    val recusados: Int = 0
)

@Serializable
data class PieChartItem(
    val name: String,
    val value: Int,
    val color: String,
    val percent: Double
)

@Serializable
data class DeliveriesData(
    val totais: StatusTotais,
    val pieChartData: List<PieChartItem>
)

@Serializable
data class DeliveriesResponse(
    val success: Boolean,
    val data: DeliveriesData? = null,
    val error: String? = null
)

/**
 * Tendências por período (PRO+)
 */
@Serializable
data class TrendPoint(
    val data: String,
    val label: String,
    val rotas: Int,
    val km: Double,
    val entregas: Int
)

@Serializable
data class TrendsData(
    val periodo: AnalyticsPeriodo,
    val groupBy: String,
    val dados: List<TrendPoint>
)

@Serializable
data class TrendsResponse(
    val success: Boolean,
    val data: TrendsData? = null,
    val error: String? = null
)

/**
 * Dados por fornecedor (PRO+)
 */
@Serializable
data class SupplierData(
    val fornecedor: String,
    val nome: String,
    val cor: String,
    val emoji: String,
    val entregas: Int,
    val km: Double,
    val custo: Double,
    val percentual: Double
)

@Serializable
data class SuppliersData(
    val total: Int,
    val por_fornecedor: List<SupplierData>
)

@Serializable
data class SuppliersResponse(
    val success: Boolean,
    val data: SuppliersData? = null,
    val error: String? = null
)

// ==================== FORNECEDORES ====================

enum class Fornecedor(
    val displayName: String,
    val emoji: String,
    val colorHex: Long
) {
    NATURA("Natura", "🌿", 0xFFFF6B00),
    AVON("Avon", "💄", 0xFFE91E8C),
    BOTICARIO("O Boticário", "🧴", 0xFF006B3F),
    MERCADO_LIVRE("Mercado Livre", "📦", 0xFFFFE600),
    SHOPEE("Shopee", "🛒", 0xFFEE4D2D),
    AMAZON("Amazon", "📦", 0xFFFF9900),
    OUTRO("Outro", "📍", 0xFF6B7280)
}

// ==================== PLANOS ====================

/**
 * Planos disponíveis baseado em análise competitiva (Fev/2026)
 * 
 * INDIVIDUAIS (autônomos, MEI):
 * - FREE: Teste, 3 rotas/dia
 * - STARTER: R$29,90 - MEI/Autônomo iniciante
 * - PRO: R$59,90 - Autônomo full-time
 * - FULL: R$99,90 - Power user
 * 
 * FROTA (transportadoras, PME):
 * - FROTA_START: R$299/mês - Até 5 motoristas
 * - FROTA_PRO: R$599/mês - Até 15 motoristas
 * - FROTA_ENTERPRISE: R$999/mês - Ilimitado
 * 
 * @see SpeedRota_Pricing_Brasil_Revisado.docx
 */
enum class Plano(
    val displayName: String,
    val rotasPorDia: Int,
    val destinosPorRota: Int,
    val preco: Double,
    val categoria: CategoriaPlano = CategoriaPlano.INDIVIDUAL,
    val maxMotoristas: Int? = null,
    val features: List<String> = emptyList()
) {
    // Planos Individuais
    FREE(
        displayName = "Grátis",
        rotasPorDia = 3,
        destinosPorRota = 10,
        preco = 0.0,
        features = listOf("Roteirização básica", "3 rotas/dia", "10 paradas/rota")
    ),
    STARTER(
        displayName = "Starter",
        rotasPorDia = 10,
        destinosPorRota = 30,
        preco = 29.90,
        features = listOf("OCR de NF-e", "WhatsApp Share", "10 rotas/dia", "30 paradas/rota")
    ),
    PRO(
        displayName = "Pro",
        rotasPorDia = 999,
        destinosPorRota = 50,
        preco = 59.90,
        features = listOf("Rotas ilimitadas", "Analytics", "SEFAZ QR Code", "Histórico completo")
    ),
    FULL(
        displayName = "Full",
        rotasPorDia = 9999,
        destinosPorRota = 100,
        preco = 99.90,
        features = listOf("POD (Comprovante)", "API Access", "ML Previsão", "Suporte prioritário")
    ),
    
    // Planos Frota (B2B)
    FROTA_START(
        displayName = "Frota Start",
        rotasPorDia = 9999,
        destinosPorRota = 100,
        preco = 299.0,
        categoria = CategoriaPlano.FROTA,
        maxMotoristas = 5,
        features = listOf("Dashboard Gestor", "Tracking tempo real", "Até 5 motoristas", "Distribuição automática")
    ),
    FROTA_PRO(
        displayName = "Frota Pro",
        rotasPorDia = 99999,
        destinosPorRota = 200,
        preco = 599.0,
        categoria = CategoriaPlano.FROTA,
        maxMotoristas = 15,
        features = listOf("Até 15 motoristas", "API + POD", "Geofencing", "Analytics avançado")
    ),
    FROTA_ENTERPRISE(
        displayName = "Frota Enterprise",
        rotasPorDia = 999999,
        destinosPorRota = 500,
        preco = 999.0,
        categoria = CategoriaPlano.FROTA,
        maxMotoristas = 999,
        features = listOf("Motoristas ilimitados", "ML Otimização", "VTEX/Shopify", "Suporte dedicado")
    );
    
    val isFrota: Boolean get() = categoria == CategoriaPlano.FROTA
}

enum class CategoriaPlano {
    INDIVIDUAL,
    FROTA
}

/**
 * Promoções ativas
 */
data class Promocao(
    val codigo: String,
    val nome: String,
    val desconto: Int, // percentual
    val meses: Int,
    val planosAplicaveis: List<Plano>,
    val ativo: Boolean = true
)

object Promocoes {
    val FROTA60 = Promocao(
        codigo = "FROTA60",
        nome = "60% OFF nos primeiros 3 meses",
        desconto = 60,
        meses = 3,
        planosAplicaveis = listOf(Plano.FROTA_START, Plano.FROTA_PRO, Plano.FROTA_ENTERPRISE)
    )
    
    val MIGRACAOVUUPT = Promocao(
        codigo = "MIGRACAOVUUPT",
        nome = "Migração Vuupt - 3 meses grátis",
        desconto = 100,
        meses = 3,
        planosAplicaveis = listOf(Plano.FROTA_START, Plano.FROTA_PRO, Plano.FROTA_ENTERPRISE)
    )
    
    val ANUAL25 = Promocao(
        codigo = "ANUAL25",
        nome = "25% de desconto no plano anual",
        desconto = 25,
        meses = 12,
        planosAplicaveis = listOf(Plano.STARTER, Plano.PRO, Plano.FULL, Plano.FROTA_START, Plano.FROTA_PRO, Plano.FROTA_ENTERPRISE)
    )
    
    val todas = listOf(FROTA60, MIGRACAOVUUPT, ANUAL25)
    
    fun buscarPorCodigo(codigo: String): Promocao? {
        return todas.find { it.codigo.equals(codigo, ignoreCase = true) && it.ativo }
    }
}

// ==================== RE-OTIMIZAÇÃO ====================

/**
 * Request para re-otimização
 */
@Serializable
data class ReotimizarRequest(
    val motivo: String,
    val paradaId: String? = null,
    val dados: ReotimizarDados? = null
)

@Serializable
data class ReotimizarDados(
    val novaJanelaInicio: String? = null,
    val novaJanelaFim: String? = null,
    val novaParada: NovaParadaRequest? = null
)

@Serializable
data class NovaParadaRequest(
    val lat: Double,
    val lng: Double,
    val endereco: String,
    val cidade: String,
    val uf: String,
    val nome: String,
    val fornecedor: String,
    val prioridade: String
)

/**
 * Response da re-otimização
 */
@Serializable
data class ReotimizarResponse(
    val success: Boolean,
    val motivo: String,
    val mensagem: String,
    val acaoTomada: String,
    val paradasAlteradas: Int,
    val novaDistanciaKm: Double? = null,
    val novoTempoMin: Double? = null,
    val economiaKm: Double? = null,
    val economiaMin: Double? = null
)

/**
 * Cenário de re-otimização
 */
@Serializable
data class CenarioDto(
    val motivo: String,
    val nome: String,
    val descricao: String,
    val icone: String,
    val requerParadaId: Boolean,
    val acaoAutomatica: String
)

@Serializable
data class CenariosResponse(
    val cenarios: List<CenarioDto>,
    val total: Int
)

/**
 * Verificação de tráfego
 */
@Serializable
data class VerificarTrafegoResponse(
    val requerReotimizacao: Boolean,
    val fatorTrafego: Double,
    val periodo: String,
    val sugestao: String
)

/**
 * Verificação de atrasos
 */
@Serializable
data class VerificarAtrasosResponse(
    val requerReotimizacao: Boolean,
    val paradasEmRisco: Int,
    val sugestao: String
)

// ==================== STATUS TEMPO REAL ====================

/**
 * Status de uma parada
 */
enum class StatusParada {
    PENDENTE,
    EM_TRANSITO,
    CHEGOU,
    ENTREGUE,
    FALHA,
    CANCELADO,
    PULADO
}

/**
 * Status da rota
 */
enum class StatusRotaEnum {
    PLANEJADA,
    EM_ANDAMENTO,
    PAUSADA,
    CONCLUIDA,
    CANCELADA
}

/**
 * Motivo de falha na entrega
 */
enum class MotivoFalha {
    CLIENTE_AUSENTE,
    ENDERECO_NAO_ENCONTRADO,
    RECUSADO,
    AVARIADO,
    OUTRO
}

/**
 * Request para atualizar posição
 */
@Serializable
data class PosicaoRequest(
    val lat: Double,
    val lng: Double,
    val heading: Float? = null,
    val velocidade: Float? = null,
    val precisao: Float? = null
)

/**
 * Request para atualizar status de parada
 */
@Serializable
data class AtualizarStatusParadaRequest(
    val status: String, // PENDENTE, EM_TRANSITO, CHEGOU, ENTREGUE, FALHA, CANCELADO, PULADO
    val motivoFalha: String? = null, // CLIENTE_AUSENTE, ENDERECO_NAO_ENCONTRADO, RECUSADO, AVARIADO, OUTRO
    val observacao: String? = null,
    val posicao: PosicaoRequest? = null
)

/**
 * Métricas em tempo real
 */
@Serializable
data class MetricasTempoRealDto(
    val totalParadas: Int,
    val entregues: Int,
    val pendentes: Int,
    val falhas: Int,
    val progresso: Int, // 0-100
    val tempoDecorrido: Int, // minutos
    val tempoEstimadoRestante: Int, // minutos
    val kmPercorridos: Double,
    val kmRestantes: Double,
    val velocidadeMedia: Double // km/h
)

/**
 * Próxima parada
 */
@Serializable
data class ProximaParadaDto(
    val id: String,
    val endereco: String,
    val etaMinutos: Int
)

/**
 * Dados de status da rota
 */
@Serializable
data class StatusRotaData(
    val rotaId: String,
    val status: String, // PLANEJADA, EM_ANDAMENTO, PAUSADA, CONCLUIDA, CANCELADA
    val iniciadaEm: String? = null,
    val pausadaEm: String? = null,
    val finalizadaEm: String? = null,
    val metricas: MetricasTempoRealDto? = null,
    val proximaParada: ProximaParadaDto? = null
)

/**
 * Response de status da rota
 */
@Serializable
data class StatusRotaResponse(
    val success: Boolean,
    val data: StatusRotaData? = null,
    val error: String? = null
)

/**
 * Dados de status de uma parada
 */
@Serializable
data class StatusParadaData(
    val paradaId: String,
    val status: String,
    val motivoFalha: String? = null,
    val observacao: String? = null,
    val atualizadoEm: String? = null
)

/**
 * Response de status de parada
 */
@Serializable
data class StatusParadaResponse(
    val success: Boolean,
    val data: StatusParadaData? = null,
    val error: String? = null
)

/**
 * Response de posição
 */
@Serializable
data class PosicaoResponse(
    val success: Boolean,
    val registradoEm: String? = null,
    val error: String? = null
)

/**
 * Item de histórico de status
 */
@Serializable
data class HistoricoStatusItem(
    val id: String,
    val paradaId: String,
    val status: String,
    val motivoFalha: String? = null,
    val observacao: String? = null,
    val createdAt: String
)

/**
 * Response de histórico de status
 */
@Serializable
data class HistoricoStatusResponse(
    val success: Boolean,
    val historico: List<HistoricoStatusItem> = emptyList(),
    val error: String? = null
)

/**
 * Item de histórico de posição
 */
@Serializable
data class HistoricoPosicaoItem(
    val id: String,
    val rotaId: String,
    val lat: Double,
    val lng: Double,
    val heading: Float? = null,
    val velocidade: Float? = null,
    val precisao: Float? = null,
    val createdAt: String
)

/**
 * Response de histórico de posições
 */
@Serializable
data class HistoricoPosicaoResponse(
    val success: Boolean,
    val posicoes: List<HistoricoPosicaoItem> = emptyList(),
    val total: Int = 0,
    val error: String? = null
)

// ==================== HISTÓRICO DE ROTAS ====================

/**
 * Rota resumida para listagem de histórico
 */
@Serializable
data class RotaHistoricoItem(
    val id: String,
    val data: String,
    val origemEndereco: String,
    val totalParadas: Int,
    val entregasRealizadas: Int,
    val entregasFalhas: Int,
    val distanciaKm: Double,
    val tempoMin: Double,
    val custoR: Double,
    val status: String,
    val fornecedores: List<String> = emptyList()
)

/**
 * Período do histórico
 */
@Serializable
data class PeriodoHistorico(
    val inicio: String,
    val fim: String,
    val dias: Int
)

/**
 * Totais do histórico
 */
@Serializable
data class TotaisHistorico(
    val rotas: Int,
    val paradas: Int,
    val entregasRealizadas: Int,
    val entregasFalhas: Int,
    val taxaSucesso: Int
)

/**
 * Distância agregada
 */
@Serializable
data class DistanciaHistorico(
    val totalKm: Double,
    val mediaKm: Double
)

/**
 * Tempo agregado
 */
@Serializable
data class TempoHistorico(
    val totalMin: Int,
    val mediaMin: Int
)

/**
 * Custo agregado
 */
@Serializable
data class CustoHistorico(
    val totalR: Double,
    val mediaR: Double,
    val combustivelL: Double
)

/**
 * Dados por fornecedor
 */
@Serializable
data class FornecedorHistorico(
    val nome: String,
    val entregas: Int,
    val percentual: Int
)

/**
 * Dados por dia
 */
@Serializable
data class DiaHistorico(
    val data: String,
    val rotas: Int,
    val entregas: Int,
    val km: Double
)

/**
 * Resumo completo do histórico
 */
@Serializable
data class ResumoHistorico(
    val periodo: PeriodoHistorico,
    val totais: TotaisHistorico,
    val distancia: DistanciaHistorico,
    val tempo: TempoHistorico,
    val custo: CustoHistorico,
    val fornecedores: List<FornecedorHistorico> = emptyList(),
    val porDia: List<DiaHistorico> = emptyList()
)

/**
 * Paginação
 */
@Serializable
data class PaginacaoHistorico(
    val pagina: Int,
    val limite: Int,
    val total: Int,
    val totalPaginas: Int
)

/**
 * Response de histórico de rotas
 */
@Serializable
data class HistoricoRotasResponse(
    val success: Boolean,
    val data: HistoricoRotasData? = null,
    val error: String? = null
)

@Serializable
data class HistoricoRotasData(
    val rotas: List<RotaHistoricoItem> = emptyList(),
    val resumo: ResumoHistorico? = null,
    val paginacao: PaginacaoHistorico? = null
)

/**
 * Response de resumo do histórico
 */
@Serializable
data class HistoricoResumoResponse(
    val success: Boolean,
    val data: ResumoHistorico? = null,
    val error: String? = null
)

/**
 * Response de fornecedores
 */
@Serializable
data class HistoricoFornecedoresResponse(
    val success: Boolean,
    val data: FornecedoresData? = null,
    val error: String? = null
)

@Serializable
data class FornecedoresData(
    val fornecedores: List<String> = emptyList()
)
// ==================== CAPACIDADE DE VEÍCULO ====================

/**
 * Tipos de veículo suportados
 */
enum class TipoVeiculo {
    MOTO, BIKE, CARRO, VAN, CAMINHAO_LEVE, CAMINHAO
}

/**
 * Capacidade de um veículo
 */
@Serializable
data class CapacidadeVeiculo(
    val tipo: String,
    val capacidadeKg: Double,
    val capacidadeVolumes: Int,
    val capacidadeM3: Double? = null
)

/**
 * Carga atual do veículo
 */
@Serializable
data class CargaAtual(
    val pesoKg: Double,
    val volumes: Int,
    val m3: Double? = null
)

/**
 * Alerta de capacidade
 */
@Serializable
data class AlertaCapacidade(
    val tipo: String, // SOBRECARGA_PESO, SOBRECARGA_VOLUME, LIMITE_PROXIMO, PESO_LEGAL_EXCEDIDO
    val mensagem: String,
    val severidade: String, // warning, error
    val percentual: Double? = null
)

/**
 * Resultado de validação de capacidade
 */
@Serializable
data class ResultadoCapacidade(
    val cabe: Boolean,
    val percentualPeso: Double,
    val percentualVolumes: Double,
    val percentualM3: Double? = null,
    val alertas: List<AlertaCapacidade> = emptyList(),
    val margemPesoKg: Double,
    val margemVolumes: Int
)

/**
 * Request para validar capacidade
 */
@Serializable
data class ValidarCapacidadeRequest(
    val veiculo: CapacidadeVeiculo,
    val carga: CargaAtual
)

/**
 * Response de validação de capacidade
 */
@Serializable
data class CapacidadeResponse(
    val success: Boolean,
    val data: ResultadoCapacidade? = null,
    val error: String? = null
)

/**
 * Response de capacidade padrão por tipo
 */
@Serializable
data class CapacidadePadraoResponse(
    val success: Boolean,
    val data: CapacidadeVeiculo? = null,
    val error: String? = null
)

/**
 * Response de todos os tipos de veículo
 */
@Serializable
data class TiposVeiculoResponse(
    val success: Boolean,
    val data: Map<String, CapacidadeVeiculo>? = null,
    val error: String? = null
)

// ==================== GEOFENCING ====================

/**
 * Tipos de evento de geofence
 */
enum class TipoEventoGeofence {
    ENTRADA, SAIDA, TEMPO_EXCEDIDO
}

/**
 * Geometria de círculo
 */
@Serializable
data class GeometriaCirculo(
    val tipo: String = "CIRCULO",
    val centro: Coordenada,
    val raioKm: Double
)

/**
 * Geometria de polígono
 */
@Serializable
data class GeometriaPoligono(
    val tipo: String = "POLIGONO",
    val vertices: List<Coordenada>
)

/**
 * Zona geofence
 */
@Serializable
data class ZonaGeofence(
    val id: String,
    val nome: String,
    val tipo: String, // CIRCULO ou POLIGONO
    val centro: Coordenada? = null,
    val raioKm: Double? = null,
    val vertices: List<Coordenada>? = null
)

/**
 * Evento de geofence
 */
@Serializable
data class EventoGeofence(
    val tipo: String, // ENTRADA, SAIDA, TEMPO_EXCEDIDO
    val motoristaId: String,
    val zonaId: String,
    val lat: Double,
    val lng: Double,
    val timestamp: String
)

/**
 * Configuração de alertas por zona
 */
@Serializable
data class ConfiguracaoGeofence(
    val alertaEntrada: Boolean = true,
    val alertaSaida: Boolean = true,
    val alertaTempoExcedido: Boolean = false,
    val tempoMaximoMin: Int? = null,
    val debounceSegundos: Int = 30,
    val toleranciaMetros: Int = 50,
    val webhookUrl: String? = null
)

/**
 * Request para processar posição
 */
@Serializable
data class PosicaoGeofenceRequest(
    val motoristaId: String,
    val lat: Double,
    val lng: Double
)

/**
 * Resultado de verificação de zona
 */
@Serializable
data class ResultadoVerificacaoZona(
    val zona: String,
    val dentroZona: Boolean,
    val distanciaBordaMetros: Int? = null
)

/**
 * Response de verificação de zonas
 */
@Serializable
data class VerificacaoZonasResponse(
    val success: Boolean,
    val data: VerificacaoZonasData? = null,
    val error: String? = null
)

@Serializable
data class VerificacaoZonasData(
    val ponto: Coordenada,
    val totalZonas: Int,
    val resultados: List<ResultadoVerificacaoZona>
)

/**
 * Response de processamento de posição
 */
@Serializable
data class ProcessarPosicaoResponse(
    val success: Boolean,
    val data: ProcessarPosicaoData? = null,
    val error: String? = null
)

@Serializable
data class ProcessarPosicaoData(
    val motoristaId: String,
    val posicao: Coordenada,
    val eventosGerados: Int,
    val eventos: List<EventoGeofenceSimples> = emptyList()
)

@Serializable
data class EventoGeofenceSimples(
    val tipo: String,
    val zonaId: String,
    val timestamp: String
)

/**
 * Response de eventos de geofence
 */
@Serializable
data class EventosGeofenceResponse(
    val success: Boolean,
    val data: EventosGeofenceData? = null,
    val error: String? = null
)

@Serializable
data class EventosGeofenceData(
    val motoristaId: String,
    val periodo: PeriodoEventos,
    val total: Int,
    val eventos: List<EventoGeofence>
)

@Serializable
data class PeriodoEventos(
    val inicio: String,
    val fim: String
)

/**
 * Response de conformidade (motorista na zona?)
 */
@Serializable
data class ConformidadeResponse(
    val success: Boolean,
    val data: ConformidadeData? = null,
    val error: String? = null
)

@Serializable
data class ConformidadeData(
    val conforme: Boolean,
    val zonasAtribuidas: List<String>,
    val zonaAtual: String? = null
)

/**
 * Response de configuração de geofence
 */
@Serializable
data class ConfiguracaoGeofenceResponse(
    val success: Boolean,
    val data: ConfiguracaoGeofence? = null,
    val error: String? = null
)

// ==================== ML - PREVISÃO DE DEMANDA ====================

/**
 * Response de previsão de demanda
 */
@Serializable
data class PrevisaoDemandaResponse(
    val success: Boolean,
    val data: PrevisaoDemandaData? = null,
    val error: String? = null
)

@Serializable
data class PrevisaoDemandaData(
    val zona: String,
    val data: String,
    val horaInicio: Int,
    val horaFim: Int,
    val demandaPrevista: Int,
    val confianca: Double,
    val limiteInferior: Int,
    val limiteSuperior: Int,
    val fatores: FatoresPrevisao,
    val insights: List<InsightML>
)

@Serializable
data class FatoresPrevisao(
    val diaSemana: Double,
    val horario: Double,
    val sazonalidade: Double,
    val tendencia: Double
)

@Serializable
data class InsightML(
    val tipo: String,
    val titulo: String,
    val descricao: String,
    val valor: Double,
    val acao: String,
    val prioridade: Int
)

/**
 * Response de mapa de calor
 */
@Serializable
data class MapaCalorResponse(
    val success: Boolean,
    val data: MapaCalorData? = null,
    val error: String? = null
)

@Serializable
data class MapaCalorData(
    val data: String,
    val zonas: List<ZonaCalor>
)

@Serializable
data class ZonaCalor(
    val zona: String,
    val demandaPrevista: Int,
    val intensidade: Double,
    val melhorHorario: String
)

/**
 * Response de insights ML
 */
@Serializable
data class InsightsMLResponse(
    val success: Boolean,
    val data: List<InsightML>? = null,
    val error: String? = null
)

/**
 * Response de métricas do modelo ML
 */
@Serializable
data class MetricasMLResponse(
    val success: Boolean,
    val data: MetricasML? = null,
    val error: String? = null
)

@Serializable
data class MetricasML(
    val totalPrevisoes: Int,
    val erroMedioAbsoluto: String,
    val mape: String,
    val taxaAcerto: String,
    val confiancaMedia: String
)

// ==================== GAMIFICAÇÃO ====================

/**
 * Response de perfil de gamificação
 */
@Serializable
data class PerfilGamificacaoResponse(
    val success: Boolean,
    val data: PerfilGamificacaoData? = null,
    val error: String? = null
)

@Serializable
data class PerfilGamificacaoData(
    val usuarioId: String,
    val nivel: Int,
    val pontosAtuais: Int,
    val pontosProximoNivel: Int,
    val progressoNivel: Double,
    val totalBadges: Int,
    val badgesConquistados: Int,
    val posicaoRanking: Int,
    val sequenciaAtual: Int,
    val melhorSequencia: Int,
    val totalEntregas: Int,
    val totalKm: Double,
    val ultimaAtualizacao: String
)

/**
 * Response de badges
 */
@Serializable
data class BadgesResponse(
    val success: Boolean,
    val data: List<Badge>? = null,
    val error: String? = null
)

@Serializable
data class Badge(
    val codigo: String,
    val nome: String,
    val descricao: String,
    val icone: String,
    val tipo: String,
    val pontos: Int,
    val raridade: String,
    val conquistado: Boolean,
    val progressoAtual: Int,
    val requisito: Int,
    val dataConquista: String? = null
)

/**
 * Response de ranking
 */
@Serializable
data class RankingResponse(
    val success: Boolean,
    val data: List<RankingItem>? = null,
    val error: String? = null
)

@Serializable
data class RankingItem(
    val posicao: Int,
    val usuarioId: String,
    val nome: String,
    val pontos: Int,
    val nivel: Int,
    val badgesCount: Int,
    val entregasSemana: Int
)

/**
 * Response de conquistas
 */
@Serializable
data class ConquistasResponse(
    val success: Boolean,
    val data: List<ConquistaItem>? = null,
    val error: String? = null
)

@Serializable
data class ConquistaItem(
    val id: String,
    val tipo: String,
    val titulo: String,
    val descricao: String,
    val icone: String,
    val dataConquista: String,
    val pontos: Int
)

/**
 * Response de resumo semanal
 */
@Serializable
data class ResumoSemanalResponse(
    val success: Boolean,
    val data: ResumoSemanalData? = null,
    val error: String? = null
)

@Serializable
data class ResumoSemanalData(
    val entregasSemana: Int,
    val kmSemana: Double,
    val pontosGanhos: Int,
    val novosConquistas: Int,
    val posicaoMelhorou: Boolean,
    val variacaoPosicao: Int,
    val destaque: String,
    val meta: MetasSemana
)

@Serializable
data class MetasSemana(
    val entregas: MetaProgresso,
    val km: MetaProgresso
)

@Serializable
data class MetaProgresso(
    val atual: Int,
    val meta: Int,
    val progresso: Double
)

/**
 * Response de leaderboard
 */
@Serializable
data class LeaderboardResponse(
    val success: Boolean,
    val data: LeaderboardData? = null,
    val error: String? = null
)

@Serializable
data class LeaderboardData(
    val periodo: String,
    val ranking: List<RankingItem>,
    val minhaPosicao: Int,
    val totalParticipantes: Int
)

// ==================== ECOMMERCE (VTEX + SHOPIFY) ====================

/**
 * Response de integrações
 */
@Serializable
data class IntegracoesResponse(
    val success: Boolean,
    val data: List<Integracao>? = null,
    val error: String? = null
)

@Serializable
data class Integracao(
    val id: String,
    val fornecedor: String,
    val nome: String? = null,
    val ativo: Boolean = true,
    val ultimaSincronizacao: String? = null,
    val totalPedidosImportados: Int = 0
)

/**
 * Request para criar integração
 */
@Serializable
data class CriarIntegracaoRequest(
    val fornecedor: String,
    val nome: String,
    val credentials: CredenciaisIntegracao
)

@Serializable
data class CredenciaisIntegracao(
    // VTEX
    val accountName: String? = null,
    val appKey: String? = null,
    val appToken: String? = null,
    // Shopify
    val shopDomain: String? = null,
    val accessToken: String? = null,
    val apiVersion: String? = null,
    // Comum
    val ambiente: String = "sandbox"
)

/**
 * Response de criar integração
 */
@Serializable
data class CriarIntegracaoApiResponse(
    val success: Boolean,
    val data: CriarIntegracaoResponse? = null,
    val error: String? = null
)

@Serializable
data class CriarIntegracaoResponse(
    val id: String,
    val testado: Boolean = false,
    val message: String? = null
)

/**
 * Response de sincronização
 */
@Serializable
data class SincronizacaoApiResponse(
    val success: Boolean,
    val data: SincronizacaoResponse? = null,
    val error: String? = null
)

@Serializable
data class SincronizacaoResponse(
    val plataforma: String,
    val totalEncontrados: Int,
    val totalImportados: Int,
    val totalDuplicados: Int,
    val totalErros: Int,
    val tempoMs: Int = 0,
    val erros: List<ErroSincronizacao>? = null
)

@Serializable
data class ErroSincronizacao(
    val idExterno: String,
    val erro: String
)

/**
 * Response de pedidos importados
 */
@Serializable
data class PedidosImportadosResponse(
    val success: Boolean,
    val data: List<PedidoImportado>? = null,
    val error: String? = null
)

@Serializable
data class PedidoImportado(
    val id: String,
    val idExterno: String,
    val cliente: String,
    val endereco: String,
    val cidade: String,
    val uf: String,
    val cep: String? = null,
    val valorTotal: Double? = null,
    val selecionado: Boolean = false
)

/**
 * Request para processar pedidos
 */
@Serializable
data class ProcessarPedidosRequest(
    val pedidoIds: List<String>,
    val paradaId: String? = null
)

/**
 * Response de processar pedidos
 */
@Serializable
data class ProcessarPedidosApiResponse(
    val success: Boolean,
    val data: ProcessarPedidosResponse? = null,
    val error: String? = null
)

@Serializable
data class ProcessarPedidosResponse(
    val processados: Int
)

// ==========================================
// SEFAZ QR CODE MODELS
// ==========================================

/**
 * Response de extração QR Code
 */
@Serializable
data class QrCodeExtracaoResponse(
    val success: Boolean,
    val data: QrCodeExtracaoData? = null,
    val error: String? = null
)

@Serializable
data class QrCodeExtracaoData(
    val tipo: String,
    val chaveAcesso: String,
    val urlOrigem: String? = null,
    val parametrosExtras: Map<String, String>? = null,
    val componentes: QrCodeComponentes? = null
)

@Serializable
data class QrCodeComponentes(
    val uf: String? = null,
    val modelo: String? = null,
    val cnpjEmitente: String? = null
)

/**
 * Response de consulta QR Code (SEFAZ)
 */
@Serializable
data class QrCodeConsultaResponse(
    val success: Boolean,
    val data: QrCodeConsultaData? = null,
    val error: String? = null
)

@Serializable
data class QrCodeConsultaData(
    val nfe: NfeData? = null,
    val chaveAcesso: String? = null,
    val tipoQrCode: String? = null,
    val enderecoFormatado: String? = null,
    val cache: Boolean? = null,
    val consultaEm: String? = null
)

@Serializable
data class NfeData(
    val chaveAcesso: String? = null,
    val tipoNfe: String? = null,
    val numero: Int? = null,
    val valor: Double? = null,
    val dataEmissao: String? = null,
    val emitente: NfeEmitente? = null,
    val destinatario: NfeDestinatario? = null
)

@Serializable
data class NfeEmitente(
    val nome: String? = null,
    val cnpj: String? = null
)

@Serializable
data class NfeDestinatario(
    val nome: String? = null,
    val logradouro: String? = null,
    val numero: String? = null,
    val bairro: String? = null,
    val cidade: String? = null,
    val uf: String? = null,
    val cep: String? = null
)

/**
 * Response de importação QR Code
 */
@Serializable
data class QrCodeImportacaoResponse(
    val success: Boolean,
    val data: QrCodeImportacaoData? = null,
    val error: String? = null
)

@Serializable
data class QrCodeImportacaoData(
    val paradaId: String,
    val chaveNfe: String,
    val nomeDestinatario: String? = null,
    val endereco: String? = null
)

/**
 * Response de extração barcode
 */
@Serializable
data class BarcodeExtracaoResponse(
    val success: Boolean,
    val data: BarcodeExtracaoData? = null,
    val error: String? = null
)

@Serializable
data class BarcodeExtracaoData(
    val chaveAcesso: String,
    val barcodeOriginal: String? = null,
    val componentes: QrCodeComponentes? = null
)

/**
 * Response de análise OCR de imagem de nota fiscal
 */
@Serializable
data class OcrAnaliseResponse(
    val success: Boolean,
    val data: OcrAnaliseData? = null,
    val error: String? = null
)

@Serializable
data class OcrAnaliseData(
    val chaveAcesso: String? = null,
    val textoExtraido: String? = null,
    val confianca: Double? = null,
    val tipoDocumento: String? = null,
    val fornecedor: String? = null,  // Fornecedor detectado: MERCADOLIVRE_AMAZON, SHOPEE, TIKTOK_KWAI, NATURA_AVON
    val dadosAdicionais: OcrDadosAdicionais? = null,
    // Campos adicionais para endereço parseado diretamente
    val endereco: OcrEndereco? = null,
    val destinatario: OcrDestinatario? = null,
    val notaFiscal: OcrNotaFiscal? = null
)

@Serializable
data class OcrDadosAdicionais(
    val numeroNota: String? = null,
    val dataEmissao: String? = null,
    val valorTotal: Double? = null,
    val cnpjEmitente: String? = null,
    val nomeEmitente: String? = null,
    val nomeDestinatario: String? = null,
    val enderecoDestinatario: String? = null
)

@Serializable
data class OcrEndereco(
    val logradouro: String? = null,
    val numero: String? = null,
    val complemento: String? = null,
    val bairro: String? = null,
    val cidade: String? = null,
    val uf: String? = null,
    val cep: String? = null,
    val enderecoCompleto: String? = null
)

@Serializable
data class OcrDestinatario(
    val nome: String? = null,
    val cpfCnpj: String? = null,
    val telefone: String? = null
)

@Serializable
data class OcrNotaFiscal(
    val numero: String? = null,
    val serie: String? = null,
    val dataEmissao: String? = null,
    val valorTotal: Double? = null,
    val chaveAcesso: String? = null
)

// ==================== MATCHING CAIXA ↔ NF-e ====================

@Serializable
data class ListaCaixasResponse(
    val caixas: List<CaixaEscaneadaData> = emptyList()
)

@Serializable
data class CaixaEscaneadaData(
    val id: String,
    val pedido: String? = null,
    val remessa: String? = null,
    val destinatario: String? = null,
    val cep: String? = null,
    val bairro: String? = null,
    val cidade: String? = null,
    val uf: String? = null,
    val itens: Int? = null,
    val pesoKg: Double? = null,
    val tagVisual: String? = null,
    val tagCor: Int? = null,
    val numeroCaixa: Int? = null,
    val totalCaixas: Int? = null,
    val statusMatch: String = "PENDENTE",
    val matchScore: Double? = null
)

@Serializable
data class AdicionarCaixaResponse(
    val success: Boolean = false,
    val caixaId: String? = null,
    val dados: CaixaEscaneadaData? = null,
    val error: String? = null
)

@Serializable
data class MatchingResponse(
    val matches: List<MatchData> = emptyList(),
    val totalPareados: Int = 0,
    val totalSemMatch: Int = 0
)

@Serializable
data class MatchData(
    val caixaId: String,
    val paradaId: String,
    val score: Int,
    val tagVisual: String,
    val tagCor: Int,
    val destinatario: String? = null,
    val endereco: String? = null,
    val numeroCaixa: Int? = null,
    val totalCaixas: Int? = null
)

@Serializable
data class MatchesResponse(
    val matches: List<MatchData> = emptyList()
)

// ==================== PREPARAÇÃO DE ROTAS ====================

@Serializable
data class RotasPreparadasResponse(
    val rotas: List<RotaPreparadaData> = emptyList()
)

@Serializable
data class RotaPreparadaData(
    val id: String,
    val preparadaEm: String? = null,
    val preparadaPorId: String? = null,
    val paradas: List<ParadaPreviewData>? = null,
    val caixas: List<CaixaPreviewData>? = null
)

@Serializable
data class ParadaPreviewData(
    val id: String,
    val nome: String,
    val endereco: String,
    val cidade: String,
    val tagVisual: String? = null,
    val tagCor: Int? = null
)

@Serializable
data class CaixaPreviewData(
    val id: String,
    val pedido: String? = null,
    val remessa: String? = null,
    val destinatario: String? = null,
    val tagVisual: String? = null,
    val tagCor: Int? = null,
    val numeroCaixa: Int? = null,
    val totalCaixas: Int? = null
)

@Serializable
data class BaixarRotaResponse(
    val success: Boolean = false,
    val message: String? = null,
    val rota: RotaDetalhadaData? = null,
    val error: String? = null
)

@Serializable
data class RotaDetalhadaData(
    val id: String,
    val status: String? = null,
    val statusPreparacao: String? = null,
    val origemEndereco: String? = null,
    val distanciaTotalKm: Double? = null,
    val tempoViagemMin: Double? = null
)

@Serializable
data class PrepararRotaResponse(
    val success: Boolean = false,
    val message: String? = null,
    val error: String? = null
)

@Serializable
data class StatusPreparacaoResponse(
    val rotaId: String,
    val status: String,
    val preparadaPor: String? = null,
    val preparadaEm: String? = null,
    val baixadaPor: String? = null,
    val baixadaEm: String? = null,
    val totalCaixas: Int = 0,
    val caixasPareadas: Int = 0,
    val totalParadas: Int = 0,
    val prontaParaBaixar: Boolean = false
)

