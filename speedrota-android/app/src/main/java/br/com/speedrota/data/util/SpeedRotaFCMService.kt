package br.com.speedrota.data.util

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * @description Serviço FCM para receber push notifications do servidor
 *
 * FUNCIONALIDADES:
 * - Receber mensagens push via Firebase Cloud Messaging
 * - Registrar token no backend
 * - Processar payload e exibir notificação local
 *
 * DESIGN POR CONTRATO:
 * @pre Firebase configurado no projeto
 * @post Notificações recebidas e exibidas
 * @invariant Token sempre sincronizado com backend
 */
class SpeedRotaFCMService : FirebaseMessagingService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    
    companion object {
        private const val TAG = "SpeedRotaFCM"
        
        // TODO: Mover para BuildConfig ou env
        private const val API_URL = "https://speedrota-api.up.railway.app"
        
        // Último token registrado (para evitar duplicatas)
        private var lastToken: String? = null
    }

    /**
     * Chamado quando novo token FCM é gerado
     * Deve registrar no backend
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "Novo FCM token: ${token.take(20)}...")
        
        // Salvar token localmente
        getSharedPreferences("speedrota_prefs", MODE_PRIVATE)
            .edit()
            .putString("fcm_token", token)
            .apply()
        
        // Enviar para backend
        registrarTokenNoBackend(token)
    }

    /**
     * Chamado quando mensagem push é recebida
     */
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d(TAG, "Push recebido de: ${remoteMessage.from}")

        // Processar dados do payload
        val dados = remoteMessage.data
        
        if (dados.isNotEmpty()) {
            Log.d(TAG, "Payload: $dados")
            processarPush(dados)
        }

        // Se tiver notificação (quando app em foreground, não é exibida automaticamente)
        remoteMessage.notification?.let { notification ->
            val tipo = dados["tipo"]?.let { 
                try { 
                    NotificacoesService.TipoNotificacao.valueOf(it) 
                } catch (e: Exception) { 
                    null 
                }
            } ?: NotificacoesService.TipoNotificacao.SISTEMA
            
            NotificacoesService.exibir(
                context = this,
                tipo = tipo,
                titulo = notification.title,
                mensagem = notification.body ?: "",
                rotaId = dados["rotaId"],
                paradaId = dados["paradaId"]
            )
        }
    }

    /**
     * Processa payload do push e exibe notificação apropriada
     */
    private fun processarPush(dados: Map<String, String>) {
        val tipo = dados["tipo"]?.let { 
            try { 
                NotificacoesService.TipoNotificacao.valueOf(it) 
            } catch (e: Exception) { 
                NotificacoesService.TipoNotificacao.SISTEMA
            }
        } ?: NotificacoesService.TipoNotificacao.SISTEMA
        
        val titulo = dados["titulo"]
        val mensagem = dados["mensagem"] ?: dados["body"] ?: return
        val rotaId = dados["rotaId"]
        val paradaId = dados["paradaId"]
        
        // Determinar ações baseado no tipo
        val acoes = when (tipo) {
            NotificacoesService.TipoNotificacao.TRAFEGO_INTENSO -> listOf(
                "ACTION_REOTIMIZAR" to "Recalcular",
                "ACTION_IGNORAR" to "Ignorar"
            )
            NotificacoesService.TipoNotificacao.JANELA_EXPIRANDO -> listOf(
                "ACTION_NAVEGAR" to "Navegar",
                "ACTION_VER_ROTA" to "Ver Rota"
            )
            NotificacoesService.TipoNotificacao.CANCELAMENTO,
            NotificacoesService.TipoNotificacao.ROTA_REOTIMIZADA -> listOf(
                "ACTION_VER_ROTA" to "Ver Rota"
            )
            NotificacoesService.TipoNotificacao.NOVO_PEDIDO -> listOf(
                "ACTION_ACEITAR" to "Aceitar",
                "ACTION_RECUSAR" to "Recusar"
            )
            else -> emptyList()
        }
        
        NotificacoesService.exibir(
            context = this,
            tipo = tipo,
            titulo = titulo,
            mensagem = mensagem,
            rotaId = rotaId,
            paradaId = paradaId,
            acoes = acoes
        )
    }

    /**
     * Registra token FCM no backend
     * 
     * @pre Token válido
     * @post Token salvo no servidor para usuário
     */
    private fun registrarTokenNoBackend(token: String) {
        if (token == lastToken) {
            Log.d(TAG, "Token já registrado, ignorando")
            return
        }
        
        scope.launch {
            try {
                val prefs = getSharedPreferences("speedrota_prefs", MODE_PRIVATE)
                val authToken = prefs.getString("auth_token", null)
                val deviceId = prefs.getString("device_id", null) ?: android.provider.Settings.Secure.getString(
                    contentResolver,
                    android.provider.Settings.Secure.ANDROID_ID
                )
                
                if (authToken == null) {
                    Log.w(TAG, "Usuário não autenticado, token FCM será registrado após login")
                    return@launch
                }
                
                val url = URL("$API_URL/api/v1/notificacoes/subscribe")
                val connection = url.openConnection() as HttpURLConnection
                
                connection.apply {
                    requestMethod = "POST"
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Authorization", "Bearer $authToken")
                    doOutput = true
                    connectTimeout = 15000
                    readTimeout = 15000
                }
                
                val payload = JSONObject().apply {
                    put("token", token)
                    put("platform", "android")
                    put("deviceId", deviceId)
                }.toString()
                
                connection.outputStream.use { os ->
                    os.write(payload.toByteArray())
                }
                
                val responseCode = connection.responseCode
                
                if (responseCode in 200..299) {
                    lastToken = token
                    Log.d(TAG, "Token FCM registrado com sucesso")
                } else {
                    Log.e(TAG, "Erro ao registrar token: HTTP $responseCode")
                }
                
                connection.disconnect()
                
            } catch (e: Exception) {
                Log.e(TAG, "Erro ao registrar token FCM", e)
            }
        }
    }
}

/**
 * Helper para gerenciar FCM token
 */
object FCMTokenManager {
    private const val TAG = "FCMTokenManager"
    
    /**
     * Obtém token FCM atual
     */
    fun obterToken(callback: (String?) -> Unit) {
        try {
            com.google.firebase.messaging.FirebaseMessaging.getInstance().token
                .addOnCompleteListener { task ->
                    if (task.isSuccessful) {
                        callback(task.result)
                    } else {
                        Log.e(TAG, "Erro ao obter token FCM", task.exception)
                        callback(null)
                    }
                }
        } catch (e: Exception) {
            Log.e(TAG, "FCM não disponível", e)
            callback(null)
        }
    }
    
    /**
     * Subscreve em tópico (ex: "entregas_urgentes")
     */
    fun subscreverTopico(topico: String, callback: (Boolean) -> Unit = {}) {
        try {
            com.google.firebase.messaging.FirebaseMessaging.getInstance()
                .subscribeToTopic(topico)
                .addOnCompleteListener { task ->
                    if (task.isSuccessful) {
                        Log.d(TAG, "Subscrito em tópico: $topico")
                        callback(true)
                    } else {
                        Log.e(TAG, "Erro ao subscrever em tópico", task.exception)
                        callback(false)
                    }
                }
        } catch (e: Exception) {
            callback(false)
        }
    }
    
    /**
     * Desinscreve de tópico
     */
    fun desinscreverTopico(topico: String, callback: (Boolean) -> Unit = {}) {
        try {
            com.google.firebase.messaging.FirebaseMessaging.getInstance()
                .unsubscribeFromTopic(topico)
                .addOnCompleteListener { task ->
                    callback(task.isSuccessful)
                }
        } catch (e: Exception) {
            callback(false)
        }
    }
}
