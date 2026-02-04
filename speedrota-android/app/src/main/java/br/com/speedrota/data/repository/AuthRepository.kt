package br.com.speedrota.data.repository

import br.com.speedrota.data.api.SpeedRotaApi
import br.com.speedrota.data.local.PreferencesManager
import br.com.speedrota.data.model.*
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repositório de autenticação
 * 
 * @description Gerencia login, registro e sessão do usuário
 * @pre API disponível
 * @post Token armazenado localmente após login/registro
 */
@Singleton
class AuthRepository @Inject constructor(
    private val api: SpeedRotaApi,
    private val preferences: PreferencesManager
) {
    
    /**
     * Registra novo usuário
     * @pre email único, senha >= 6 chars
     * @post Token salvo, usuário logado
     */
    suspend fun register(
        nome: String,
        email: String,
        senha: String,
        telefone: String? = null
    ): Result<UserData> {
        return try {
            val response = api.register(RegisterRequest(nome, email, senha, telefone))
            
            if (response.success && response.token != null && response.usuario != null) {
                preferences.saveToken(response.token)
                preferences.saveUserData(
                    id = response.usuario.id,
                    nome = response.usuario.nome,
                    email = response.usuario.email,
                    plano = response.usuario.plano
                )
                Result.success(response.usuario)
            } else {
                Result.failure(Exception(response.error ?: "Erro ao registrar"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Login do usuário
     * @pre email e senha válidos
     * @post Token salvo, usuário logado
     */
    suspend fun login(email: String, senha: String): Result<UserData> {
        return try {
            val response = api.login(LoginRequest(email, senha))
            
            if (response.success && response.token != null && response.usuario != null) {
                preferences.saveToken(response.token)
                preferences.saveUserData(
                    id = response.usuario.id,
                    nome = response.usuario.nome,
                    email = response.usuario.email,
                    plano = response.usuario.plano
                )
                Result.success(response.usuario)
            } else {
                Result.failure(Exception(response.error ?: "Email ou senha inválidos"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Busca dados do usuário atual
     * @pre Token válido
     * @post UserData atualizado
     */
    suspend fun getMe(): Result<UserData> {
        return try {
            val response = api.getMe()
            
            if (response.success && response.usuario != null) {
                preferences.saveUserData(
                    id = response.usuario.id,
                    nome = response.usuario.nome,
                    email = response.usuario.email,
                    plano = response.usuario.plano
                )
                Result.success(response.usuario)
            } else {
                Result.failure(Exception(response.error ?: "Erro ao buscar usuário"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Logout do usuário
     * @post Token e dados removidos
     */
    suspend fun logout() {
        preferences.clearAll()
    }
    
    /**
     * Verifica se está logado
     */
    suspend fun isLoggedIn(): Boolean {
        return preferences.isLoggedIn.first()
    }
    
    /**
     * Obtém token atual
     */
    suspend fun getToken(): String? {
        return preferences.token.first()
    }
}
