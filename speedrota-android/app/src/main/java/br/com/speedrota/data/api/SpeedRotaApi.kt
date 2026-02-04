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
    
    @POST("pagamentos/pix")
    suspend fun gerarPix(@Body request: PixRequest): PixResponse
    
    @GET("pagamentos/{id}/status")
    suspend fun verificarStatusPagamento(@Path("id") id: String): StatusPagamentoResponse
}
