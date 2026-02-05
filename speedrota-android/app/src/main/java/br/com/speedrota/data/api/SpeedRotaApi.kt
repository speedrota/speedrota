package br.com.speedrota.data.api

import br.com.speedrota.data.model.*
import retrofit2.http.*

/**
 * Interface da API SpeedRota
 * 
 * @description Define todos os endpoints da API
 * @pre Token JWT válido para rotas autenticadas
 * @post Retorna Response<T> para tratamento de erros
 */
interface SpeedRotaApi {

    // ==================== AUTH ====================
    
    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): AuthResponse
    
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): AuthResponse
    
    @GET("auth/me")
    suspend fun getMe(): UserResponse
    
    @POST("auth/forgot-password")
    suspend fun forgotPassword(@Body request: ForgotPasswordRequest): ForgotPasswordResponse
    
    @POST("auth/verify-reset-code")
    suspend fun verifyResetCode(@Body request: VerifyResetCodeRequest): VerifyResetCodeResponse
    
    @POST("auth/reset-password")
    suspend fun resetPassword(@Body request: ResetPasswordRequest): ResetPasswordResponse
    
    // ==================== ROTAS ====================
    
    @GET("rotas")
    suspend fun getRotas(): ListaRotasResponse
    
    @GET("rotas/{id}")
    suspend fun getRotaPorId(@Path("id") id: String): RotaDetalheResponse
    
    @POST("rotas")
    suspend fun createRota(@Body request: CreateRotaRequest): RotaResponse
    
    @POST("rotas/otimizar")
    suspend fun otimizarRota(@Body request: OtimizarRotaRequest): OtimizarRotaResponse
    
    // ==================== PAGAMENTOS ====================
    
    @GET("pagamentos/plans")
    suspend fun listarPlanos(): PlanosResponse
    
    @POST("pagamentos/create-preference")
    suspend fun criarPreferencia(@Body request: PreferenceRequest): PreferenceResponse
    
    @POST("pagamentos/create-pix")
    suspend fun criarPix(@Body request: PreferenceRequest): PixDirectResponse
    
    @POST("pagamentos/process-card-payment")
    suspend fun processarCartao(@Body request: CardPaymentRequest): CardPaymentResponse
    
    @POST("pagamentos/confirm-upgrade")
    suspend fun confirmarUpgrade(@Body request: ConfirmUpgradeRequest): ConfirmUpgradeResponse
    
    @GET("pagamentos/payment-status/{paymentId}")
    suspend fun verificarStatusPagamento(@Path("paymentId") paymentId: String): PaymentStatusResponse
    
    @GET("pagamentos/subscription")
    suspend fun obterAssinatura(): SubscriptionResponse
    
    @GET("pagamentos/public-key")
    suspend fun obterPublicKey(): PublicKeyResponse
    
    // ==================== ANALYTICS ====================
    
    /**
     * Overview analytics - KPIs principais
     * @pre Token válido
     * @post Retorna métricas baseadas no plano
     */
    @GET("analytics/overview")
    suspend fun getAnalyticsOverview(
        @Query("periodo") periodo: String = "30d",
        @Query("dataInicio") dataInicio: String? = null,
        @Query("dataFim") dataFim: String? = null,
        @Query("fornecedor") fornecedor: String? = null
    ): OverviewResponse
    
    /**
     * Status das entregas
     */
    @GET("analytics/deliveries")
    suspend fun getAnalyticsDeliveries(
        @Query("periodo") periodo: String = "30d",
        @Query("dataInicio") dataInicio: String? = null,
        @Query("dataFim") dataFim: String? = null,
        @Query("fornecedor") fornecedor: String? = null
    ): DeliveriesResponse
    
    /**
     * Tendências (PRO+)
     */
    @GET("analytics/trends")
    suspend fun getAnalyticsTrends(
        @Query("periodo") periodo: String = "30d",
        @Query("groupBy") groupBy: String = "day"
    ): TrendsResponse
    
    /**
     * Dados por fornecedor (PRO+)
     */
    @GET("analytics/suppliers")
    suspend fun getAnalyticsSuppliers(
        @Query("periodo") periodo: String = "30d",
        @Query("dataInicio") dataInicio: String? = null,
        @Query("dataFim") dataFim: String? = null
    ): SuppliersResponse
    
    // ==================== RE-OTIMIZAÇÃO ====================
    
    /**
     * Lista cenários de re-otimização disponíveis
     * @pre Token válido
     * @post Lista de cenários
     */
    @GET("reotimizar/cenarios")
    suspend fun listarCenariosReotimizacao(): CenariosResponse
    
    /**
     * Re-otimiza rota baseado em cenário
     * @pre Rota existe, motivo válido
     * @post Rota re-otimizada
     */
    @POST("reotimizar/{rotaId}")
    suspend fun reotimizarRota(
        @Path("rotaId") rotaId: String,
        @Body request: ReotimizarRequest
    ): ReotimizarResponse
    
    /**
     * Verifica se tráfego requer re-otimização
     */
    @POST("reotimizar/{rotaId}/verificar-trafego")
    suspend fun verificarTrafegoRota(
        @Path("rotaId") rotaId: String
    ): VerificarTrafegoResponse
    
    /**
     * Verifica se há atrasos que requerem re-otimização
     */
    @POST("reotimizar/{rotaId}/verificar-atrasos")
    suspend fun verificarAtrasosRota(
        @Path("rotaId") rotaId: String
    ): VerificarAtrasosResponse

    // ==================== STATUS TEMPO REAL ====================

    /**
     * Obtém status atual da rota
     * @pre Token válido, rota existe
     * @post Retorna status e métricas
     */
    @GET("status/{rotaId}")
    suspend fun getStatusRota(
        @Path("rotaId") rotaId: String
    ): StatusRotaResponse

    /**
     * Inicia execução da rota
     * @pre Rota planejada ou pausada
     * @post Rota em andamento
     */
    @PATCH("status/{rotaId}/iniciar")
    suspend fun iniciarRota(
        @Path("rotaId") rotaId: String,
        @Body posicao: PosicaoRequest? = null
    ): StatusRotaResponse

    /**
     * Pausa execução da rota
     * @pre Rota em andamento
     * @post Rota pausada
     */
    @PATCH("status/{rotaId}/pausar")
    suspend fun pausarRota(
        @Path("rotaId") rotaId: String
    ): StatusRotaResponse

    /**
     * Finaliza execução da rota
     * @pre Rota em andamento ou pausada
     * @post Rota concluída
     */
    @PATCH("status/{rotaId}/finalizar")
    suspend fun finalizarRota(
        @Path("rotaId") rotaId: String
    ): StatusRotaResponse

    /**
     * Atualiza status de uma parada
     * @pre Parada existe, status válido
     * @post Status atualizado
     */
    @PATCH("status/parada/{paradaId}")
    suspend fun atualizarStatusParada(
        @Path("paradaId") paradaId: String,
        @Body request: AtualizarStatusParadaRequest
    ): StatusParadaResponse

    /**
     * Atualiza posição do entregador
     * @pre Rota em andamento
     * @post Posição registrada
     */
    @POST("status/{rotaId}/posicao")
    suspend fun atualizarPosicao(
        @Path("rotaId") rotaId: String,
        @Body request: PosicaoRequest
    ): PosicaoResponse

    /**
     * Histórico de status de uma parada
     */
    @GET("status/{rotaId}/historico")
    suspend fun getHistoricoStatus(
        @Path("rotaId") rotaId: String,
        @Query("paradaId") paradaId: String? = null
    ): HistoricoStatusResponse

    /**
     * Histórico de posições do entregador
     */
    @GET("status/{rotaId}/posicoes")
    suspend fun getHistoricoPosicoes(
        @Path("rotaId") rotaId: String,
        @Query("limit") limit: Int? = null,
        @Query("offsetMinutos") offsetMinutos: Int? = null
    ): HistoricoPosicaoResponse

    // ==================== HISTÓRICO DE ROTAS ====================

    /**
     * Lista histórico de rotas com filtros
     * @pre Token válido
     * @post Lista paginada de rotas + resumo
     */
    @GET("historico")
    suspend fun getHistoricoRotas(
        @Query("dataInicio") dataInicio: String? = null,
        @Query("dataFim") dataFim: String? = null,
        @Query("fornecedor") fornecedor: String? = null,
        @Query("status") status: String? = null,
        @Query("pagina") pagina: Int = 1,
        @Query("limite") limite: Int = 20,
        @Query("ordenarPor") ordenarPor: String = "data",
        @Query("ordem") ordem: String = "desc"
    ): HistoricoRotasResponse

    /**
     * Resumo agregado do período
     */
    @GET("historico/resumo")
    suspend fun getHistoricoResumo(
        @Query("dataInicio") dataInicio: String? = null,
        @Query("dataFim") dataFim: String? = null,
        @Query("fornecedor") fornecedor: String? = null
    ): HistoricoResumoResponse

    /**
     * Lista fornecedores disponíveis para filtro
     */
    @GET("historico/fornecedores")
    suspend fun getHistoricoFornecedores(): HistoricoFornecedoresResponse

    // ==================== CAPACIDADE DE VEÍCULO ====================

    /**
     * Obtém capacidade padrão por tipo de veículo
     */
    @GET("capacidade/padrao/{tipo}")
    suspend fun getCapacidadePadrao(
        @Path("tipo") tipo: String
    ): CapacidadePadraoResponse

    /**
     * Lista todos os tipos de veículo e capacidades
     */
    @GET("capacidade/tipos")
    suspend fun getTiposVeiculo(): TiposVeiculoResponse

    /**
     * Valida se carga cabe no veículo
     */
    @POST("capacidade/validar")
    suspend fun validarCapacidade(
        @Body request: ValidarCapacidadeRequest
    ): CapacidadeResponse

    // ==================== GEOFENCING ====================

    /**
     * Processa posição e detecta eventos entrada/saída
     */
    @POST("geofencing/posicao")
    suspend fun processarPosicaoGeofence(
        @Body request: PosicaoGeofenceRequest
    ): ProcessarPosicaoResponse

    /**
     * Lista eventos de geofence do motorista
     */
    @GET("geofencing/eventos/{motoristaId}")
    suspend fun getEventosGeofence(
        @Path("motoristaId") motoristaId: String,
        @Query("inicio") inicio: String? = null,
        @Query("fim") fim: String? = null
    ): EventosGeofenceResponse

    /**
     * Verifica conformidade (motorista na zona atribuída?)
     */
    @GET("geofencing/conformidade/{motoristaId}")
    suspend fun verificarConformidade(
        @Path("motoristaId") motoristaId: String
    ): ConformidadeResponse

    /**
     * Obtém configuração de alertas de uma zona
     */
    @GET("geofencing/configuracao/{zonaId}")
    suspend fun getConfiguracaoGeofence(
        @Path("zonaId") zonaId: String
    ): ConfiguracaoGeofenceResponse

    /**
     * Salva configuração de alertas de uma zona
     */
    @PUT("geofencing/configuracao/{zonaId}")
    suspend fun salvarConfiguracaoGeofence(
        @Path("zonaId") zonaId: String,
        @Body config: ConfiguracaoGeofence
    ): SimpleApiResponse

    // ==================== ML - PREVISÃO DE DEMANDA ====================

    /**
     * Obtém previsão de demanda para uma zona
     * @pre Zona válida (CEP 5 dígitos)
     * @post Previsão com confiança + fatores + insights
     */
    @GET("ml/previsao/{zona}")
    suspend fun getPrevisaoDemanda(
        @Path("zona") zona: String,
        @Query("data") data: String? = null,
        @Query("horaInicio") horaInicio: Int? = null,
        @Query("horaFim") horaFim: Int? = null
    ): PrevisaoDemandaResponse

    /**
     * Obtém mapa de calor de demanda por zona
     * @post Lista de zonas com intensidade de demanda
     */
    @GET("ml/mapa-calor")
    suspend fun getMapaCalor(
        @Query("data") data: String? = null
    ): MapaCalorResponse

    /**
     * Lista insights personalizados para o motorista
     */
    @GET("ml/insights")
    suspend fun getInsightsML(
        @Query("zona") zona: String? = null,
        @Query("limite") limite: Int? = null
    ): InsightsMLResponse

    /**
     * Obtém métricas de qualidade do modelo ML
     */
    @GET("ml/metricas")
    suspend fun getMetricasML(): MetricasMLResponse

    // ==================== GAMIFICAÇÃO ====================

    /**
     * Obtém perfil de gamificação do usuário
     * @post Nível, pontos, badges, ranking
     */
    @GET("gamificacao/perfil")
    suspend fun getPerfilGamificacao(): PerfilGamificacaoResponse

    /**
     * Lista todos os badges
     */
    @GET("gamificacao/badges")
    suspend fun getBadges(): BadgesResponse

    /**
     * Lista badges de um tipo específico
     */
    @GET("gamificacao/badges/{tipo}")
    suspend fun getBadgesPorTipo(
        @Path("tipo") tipo: String
    ): BadgesResponse

    /**
     * Obtém ranking semanal
     */
    @GET("gamificacao/ranking")
    suspend fun getRankingSemanal(): RankingResponse

    /**
     * Lista conquistas do usuário
     */
    @GET("gamificacao/conquistas")
    suspend fun getConquistas(): ConquistasResponse

    /**
     * Obtém resumo semanal de gamificação
     */
    @GET("gamificacao/resumo-semanal")
    suspend fun getResumoSemanal(): ResumoSemanalResponse

    /**
     * Obtém leaderboard global
     */
    @GET("gamificacao/leaderboard")
    suspend fun getLeaderboard(
        @Query("periodo") periodo: String? = null,
        @Query("limite") limite: Int? = null
    ): LeaderboardResponse

    // ==================== ECOMMERCE (VTEX + SHOPIFY) ====================

    /**
     * Lista integrações do usuário
     * @post Lista de integrações configuradas
     */
    @GET("ecommerce/integracoes")
    suspend fun getIntegracoes(): IntegracoesResponse

    /**
     * Criar nova integração
     * @pre Credenciais válidas
     * @post Integração criada
     */
    @POST("ecommerce/integracoes")
    suspend fun criarIntegracao(
        @Body dados: CriarIntegracaoRequest
    ): CriarIntegracaoApiResponse

    /**
     * Sincronizar pedidos de uma integração
     * @pre Integração existe e está ativa
     * @post Pedidos importados
     */
    @POST("ecommerce/integracoes/{id}/sync")
    suspend fun sincronizarIntegracao(
        @Path("id") integracaoId: String
    ): SincronizacaoApiResponse

    /**
     * Listar pedidos de uma integração
     * @pre Integração existe
     * @post Lista de pedidos pendentes
     */
    @GET("ecommerce/integracoes/{id}/pedidos")
    suspend fun getPedidosIntegracao(
        @Path("id") integracaoId: String
    ): PedidosImportadosResponse

    /**
     * Marcar pedidos como processados
     * @pre Pedidos existem
     * @post Pedidos marcados como processados
     */
    @POST("ecommerce/integracoes/{id}/processar")
    suspend fun processarPedidos(
        @Path("id") integracaoId: String,
        @Body dados: ProcessarPedidosRequest
    ): ProcessarPedidosApiResponse

    // ==================== SEFAZ QR CODE ====================

    /**
     * Extrair dados de QR Code NF-e
     * @pre conteudo é string não vazia
     * @post Retorna chave extraída e tipo
     */
    @POST("sefaz/qrcode/extrair")
    suspend fun extrairQrCode(
        @Body dados: Map<String, String>
    ): retrofit2.Response<QrCodeExtracaoResponse>

    /**
     * Consultar NF-e via QR Code no SEFAZ
     * @pre QR Code válido
     * @post Dados completos da NF-e
     */
    @POST("sefaz/qrcode/consultar")
    suspend fun consultarQrCode(
        @Body dados: Map<String, String>
    ): retrofit2.Response<QrCodeConsultaResponse>

    /**
     * Importar QR Code como parada
     * @pre QR Code válido e rotaId existente
     * @post Parada criada
     */
    @POST("sefaz/qrcode/importar")
    suspend fun importarQrCode(
        @Body dados: Map<String, String>
    ): retrofit2.Response<QrCodeImportacaoResponse>

    /**
     * Extrair chave de código de barras DANFE
     * @pre barcode com 44 dígitos
     * @post Chave de acesso normalizada
     */
    @POST("sefaz/barcode/extrair")
    suspend fun extrairBarcode(
        @Body dados: Map<String, String>
    ): retrofit2.Response<BarcodeExtracaoResponse>
}
