package br.com.speedrota.data.util

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/**
 * @description Serviço de Notificações Push para Android
 *
 * FUNCIONALIDADES:
 * - Criar canais de notificação
 * - Exibir notificações locais
 * - Gerenciar permissões
 * - Tipos diferentes de notificação
 *
 * DESIGN POR CONTRATO:
 * @pre Context válido
 * @post Notificações exibidas conforme tipo
 */
object NotificacoesService {
    
    // IDs dos canais
    private const val CHANNEL_URGENTE = "speedrota_urgente"
    private const val CHANNEL_NORMAL = "speedrota_normal"
    private const val CHANNEL_SILENCIOSO = "speedrota_silencioso"
    
    // IDs de notificação
    private var notificationId = 1000
    
    /**
     * Tipos de notificação
     */
    enum class TipoNotificacao(
        val channelId: String,
        val icone: String,
        val titulo: String
    ) {
        TRAFEGO_INTENSO(CHANNEL_URGENTE, "🚗", "Tráfego Intenso"),
        CANCELAMENTO(CHANNEL_NORMAL, "❌", "Entrega Cancelada"),
        JANELA_EXPIRANDO(CHANNEL_URGENTE, "⏰", "Janela Expirando"),
        NOVO_PEDIDO(CHANNEL_URGENTE, "🚨", "Novo Pedido Urgente"),
        ENTREGA_CONFIRMADA(CHANNEL_NORMAL, "✅", "Entrega Confirmada"),
        ATRASO_DETECTADO(CHANNEL_URGENTE, "⚠️", "Atraso Detectado"),
        ROTA_REOTIMIZADA(CHANNEL_NORMAL, "🔄", "Rota Atualizada"),
        SISTEMA(CHANNEL_SILENCIOSO, "📢", "SpeedRota")
    }
    
    /**
     * Cria os canais de notificação
     * Deve ser chamado na inicialização do app
     * 
     * @pre Android >= O (API 26)
     * @post Canais criados
     */
    fun criarCanais(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) 
            as NotificationManager
        
        // Canal urgente - com som e vibração
        val urgente = NotificationChannel(
            CHANNEL_URGENTE,
            "Alertas Urgentes",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Tráfego, janelas expirando, novos pedidos"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 300, 100, 300)
        }
        
        // Canal normal
        val normal = NotificationChannel(
            CHANNEL_NORMAL,
            "Atualizações",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Entregas confirmadas, rotas atualizadas"
        }
        
        // Canal silencioso
        val silencioso = NotificationChannel(
            CHANNEL_SILENCIOSO,
            "Informações",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Avisos do sistema"
            setShowBadge(false)
        }
        
        notificationManager.createNotificationChannels(listOf(urgente, normal, silencioso))
    }
    
    /**
     * Verifica se tem permissão para notificações
     * Android 13+ requer permissão explícita
     */
    fun temPermissao(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }
    
    /**
     * Exibe uma notificação
     * 
     * @pre Permissão concedida, canais criados
     * @post Notificação exibida
     */
    fun exibir(
        context: Context,
        tipo: TipoNotificacao,
        titulo: String? = null,
        mensagem: String,
        rotaId: String? = null,
        paradaId: String? = null,
        acoes: List<Pair<String, String>> = emptyList() // (action, title)
    ): Int? {
        if (!temPermissao(context)) {
            return null
        }
        
        val id = notificationId++
        
        // Intent para abrir o app
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            rotaId?.let { putExtra("rota_id", it) }
            paradaId?.let { putExtra("parada_id", it) }
            putExtra("notification_id", id)
            putExtra("tipo", tipo.name)
        }
        
        val pendingIntent = PendingIntent.getActivity(
            context,
            id,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        val builder = NotificationCompat.Builder(context, tipo.channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(titulo ?: "${tipo.icone} ${tipo.titulo}")
            .setContentText(mensagem)
            .setStyle(NotificationCompat.BigTextStyle().bigText(mensagem))
            .setPriority(
                if (tipo.channelId == CHANNEL_URGENTE) 
                    NotificationCompat.PRIORITY_HIGH 
                else 
                    NotificationCompat.PRIORITY_DEFAULT
            )
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
        
        // Adicionar ações
        acoes.take(2).forEachIndexed { index, (action, title) ->
            val actionIntent = Intent(context, NotificationActionReceiver::class.java).apply {
                this.action = action
                putExtra("notification_id", id)
                rotaId?.let { putExtra("rota_id", it) }
                paradaId?.let { putExtra("parada_id", it) }
            }
            
            val actionPendingIntent = PendingIntent.getBroadcast(
                context,
                id * 10 + index,
                actionIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            
            builder.addAction(0, title, actionPendingIntent)
        }
        
        try {
            NotificationManagerCompat.from(context).notify(id, builder.build())
            return id
        } catch (e: SecurityException) {
            return null
        }
    }
    
    /**
     * Cancela uma notificação específica
     */
    fun cancelar(context: Context, notificationId: Int) {
        NotificationManagerCompat.from(context).cancel(notificationId)
    }
    
    /**
     * Cancela todas as notificações
     */
    fun cancelarTodas(context: Context) {
        NotificationManagerCompat.from(context).cancelAll()
    }
    
    // ==========================================
    // HELPERS PARA TIPOS ESPECÍFICOS
    // ==========================================
    
    /**
     * Notifica tráfego intenso
     */
    fun notificarTrafegoIntenso(
        context: Context,
        rotaId: String,
        fatorTrafego: Double
    ) {
        val intensidade = if (fatorTrafego >= 1.5) "pesado" else "moderado"
        exibir(
            context = context,
            tipo = TipoNotificacao.TRAFEGO_INTENSO,
            mensagem = "Trânsito $intensidade detectado na sua rota. Deseja recalcular?",
            rotaId = rotaId,
            acoes = listOf(
                "ACTION_REOTIMIZAR" to "Recalcular",
                "ACTION_IGNORAR" to "Ignorar"
            )
        )
    }
    
    /**
     * Notifica cancelamento
     */
    fun notificarCancelamento(
        context: Context,
        rotaId: String,
        paradaId: String,
        nomeCliente: String
    ) {
        exibir(
            context = context,
            tipo = TipoNotificacao.CANCELAMENTO,
            mensagem = "Cliente \"$nomeCliente\" cancelou. Rota foi atualizada automaticamente.",
            rotaId = rotaId,
            paradaId = paradaId,
            acoes = listOf("ACTION_VER_ROTA" to "Ver Rota")
        )
    }
    
    /**
     * Notifica janela expirando
     */
    fun notificarJanelaExpirando(
        context: Context,
        rotaId: String,
        paradaId: String,
        nomeCliente: String,
        minutosRestantes: Int
    ) {
        exibir(
            context = context,
            tipo = TipoNotificacao.JANELA_EXPIRANDO,
            mensagem = "Entrega para \"$nomeCliente\" expira em $minutosRestantes minutos!",
            rotaId = rotaId,
            paradaId = paradaId,
            acoes = listOf(
                "ACTION_NAVEGAR" to "Navegar",
                "ACTION_VER_ROTA" to "Ver Rota"
            )
        )
    }
    
    /**
     * Notifica novo pedido urgente
     */
    fun notificarNovoPedido(
        context: Context,
        rotaId: String,
        endereco: String
    ) {
        exibir(
            context = context,
            tipo = TipoNotificacao.NOVO_PEDIDO,
            mensagem = "Nova entrega adicionada: $endereco",
            rotaId = rotaId,
            acoes = listOf(
                "ACTION_ACEITAR" to "Aceitar",
                "ACTION_RECUSAR" to "Recusar"
            )
        )
    }
    
    /**
     * Notifica entrega confirmada
     */
    fun notificarEntregaConfirmada(
        context: Context,
        rotaId: String,
        nomeCliente: String,
        restantes: Int
    ) {
        exibir(
            context = context,
            tipo = TipoNotificacao.ENTREGA_CONFIRMADA,
            mensagem = "Entrega para \"$nomeCliente\" registrada. Faltam $restantes entregas.",
            rotaId = rotaId
        )
    }
    
    /**
     * Notifica rota re-otimizada
     */
    fun notificarRotaReotimizada(
        context: Context,
        rotaId: String,
        motivo: String,
        economiaKm: Double? = null
    ) {
        var mensagem = "Sua rota foi recalculada: $motivo"
        if (economiaKm != null && economiaKm > 0) {
            mensagem += ". Economia de ${"%.1f".format(economiaKm)} km!"
        }
        
        exibir(
            context = context,
            tipo = TipoNotificacao.ROTA_REOTIMIZADA,
            mensagem = mensagem,
            rotaId = rotaId
        )
    }
}

/**
 * BroadcastReceiver para ações das notificações
 * Registrar no AndroidManifest.xml
 */
// @AndroidEntryPoint // Se usar Hilt
class NotificationActionReceiver : android.content.BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val notificationId = intent.getIntExtra("notification_id", -1)
        val rotaId = intent.getStringExtra("rota_id")
        val paradaId = intent.getStringExtra("parada_id")
        
        // Cancelar notificação
        if (notificationId > 0) {
            NotificacoesService.cancelar(context, notificationId)
        }
        
        when (intent.action) {
            "ACTION_REOTIMIZAR" -> {
                // Abrir app na tela de rota com ação de reotimizar
                abrirApp(context, rotaId, "reotimizar")
            }
            "ACTION_VER_ROTA" -> {
                abrirApp(context, rotaId, null)
            }
            "ACTION_NAVEGAR" -> {
                // Abrir navegação direta
                abrirApp(context, rotaId, "navegar")
            }
            "ACTION_ACEITAR" -> {
                // Aceitar pedido
                abrirApp(context, rotaId, "aceitar")
            }
            "ACTION_RECUSAR" -> {
                // Recusar e remover
                abrirApp(context, rotaId, "recusar")
            }
            "ACTION_IGNORAR" -> {
                // Apenas fecha a notificação
            }
        }
    }
    
    private fun abrirApp(context: Context, rotaId: String?, action: String?) {
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            rotaId?.let { putExtra("rota_id", it) }
            action?.let { putExtra("action", it) }
        }
        context.startActivity(intent)
    }
}
