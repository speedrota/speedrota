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
    
    // ==================== ROTAS ====================
    
    @GET("rotas")
    suspend fun getRotas(): List<RotaResponse>
    
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
}
