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
}
