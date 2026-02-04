package br.com.speedrota.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "speedrota_prefs")

/**
 * Gerenciador de preferências usando DataStore
 * 
 * @description Armazena token JWT e dados do usuário localmente
 * @pre Context válido
 * @post Dados persistidos de forma segura
 */
@Singleton
class PreferencesManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private val TOKEN_KEY = stringPreferencesKey("jwt_token")
        private val USER_ID_KEY = stringPreferencesKey("user_id")
        private val USER_NAME_KEY = stringPreferencesKey("user_name")
        private val USER_EMAIL_KEY = stringPreferencesKey("user_email")
        private val USER_PLANO_KEY = stringPreferencesKey("user_plano")
    }

    // Token JWT
    val token: Flow<String?> = context.dataStore.data.map { preferences ->
        preferences[TOKEN_KEY]
    }

    suspend fun saveToken(token: String) {
        context.dataStore.edit { preferences ->
            preferences[TOKEN_KEY] = token
        }
    }

    suspend fun clearToken() {
        context.dataStore.edit { preferences ->
            preferences.remove(TOKEN_KEY)
        }
    }

    // Dados do usuário
    val userId: Flow<String?> = context.dataStore.data.map { it[USER_ID_KEY] }
    val userName: Flow<String?> = context.dataStore.data.map { it[USER_NAME_KEY] }
    val userEmail: Flow<String?> = context.dataStore.data.map { it[USER_EMAIL_KEY] }
    val userPlano: Flow<String?> = context.dataStore.data.map { it[USER_PLANO_KEY] }

    suspend fun saveUserData(id: String, nome: String, email: String, plano: String) {
        context.dataStore.edit { preferences ->
            preferences[USER_ID_KEY] = id
            preferences[USER_NAME_KEY] = nome
            preferences[USER_EMAIL_KEY] = email
            preferences[USER_PLANO_KEY] = plano
        }
    }

    suspend fun clearUserData() {
        context.dataStore.edit { preferences ->
            preferences.remove(USER_ID_KEY)
            preferences.remove(USER_NAME_KEY)
            preferences.remove(USER_EMAIL_KEY)
            preferences.remove(USER_PLANO_KEY)
        }
    }

    suspend fun clearAll() {
        context.dataStore.edit { it.clear() }
    }

    // Verifica se usuário está logado
    val isLoggedIn: Flow<Boolean> = token.map { it != null && it.isNotEmpty() }
}
