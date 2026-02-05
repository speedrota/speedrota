/**
 * @fileoverview Serviço de Tracking de Localização para Motoristas
 *
 * DESIGN POR CONTRATO:
 * @description Serviço em foreground para rastrear localização do motorista
 * @pre Permissões de localização concedidas
 * @post Posição enviada periodicamente para a API
 * @invariant Executa em foreground com notificação
 */

package br.com.speedrota.ui.screens.frota

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import kotlinx.coroutines.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

class LocationTrackingService : Service() {

    companion object {
        const val CHANNEL_ID = "speedrota_tracking"
        const val NOTIFICATION_ID = 1001
        const val ACTION_START = "START_TRACKING"
        const val ACTION_STOP = "STOP_TRACKING"
        
        // Intervalo de atualização: 30 segundos
        private const val UPDATE_INTERVAL_MS = 30_000L
        private const val FASTEST_INTERVAL_MS = 15_000L
    }

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private val client = OkHttpClient()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private val apiUrl: String
        get() = getString(br.com.speedrota.R.string.api_base_url)

    private val motoristaId: String?
        get() = getSharedPreferences("speedrota", Context.MODE_PRIVATE)
            .getString("motorista_id", null)

    private val token: String?
        get() = getSharedPreferences("speedrota", Context.MODE_PRIVATE)
            .getString("auth_token", null)

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()
        setupLocationCallback()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startTracking()
            ACTION_STOP -> stopTracking()
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        stopLocationUpdates()
        scope.cancel()
    }

    // ==========================================
    // TRACKING
    // ==========================================

    private fun startTracking() {
        Log.d("LocationTracking", "Iniciando tracking de localização")
        
        // Inicia como foreground service
        startForeground(NOTIFICATION_ID, createNotification())
        
        // Inicia atualizações de localização
        startLocationUpdates()
    }

    private fun stopTracking() {
        Log.d("LocationTracking", "Parando tracking de localização")
        stopLocationUpdates()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun startLocationUpdates() {
        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            UPDATE_INTERVAL_MS
        ).apply {
            setMinUpdateIntervalMillis(FASTEST_INTERVAL_MS)
            setWaitForAccurateLocation(false)
        }.build()

        if (ActivityCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            Log.e("LocationTracking", "Permissão de localização negada")
            return
        }

        fusedLocationClient.requestLocationUpdates(
            locationRequest,
            locationCallback,
            Looper.getMainLooper()
        )
    }

    private fun stopLocationUpdates() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
    }

    private fun setupLocationCallback() {
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { location ->
                    enviarPosicao(location)
                }
            }
        }
    }

    // ==========================================
    // API
    // ==========================================

    private fun enviarPosicao(location: Location) {
        val id = motoristaId ?: return
        val authToken = token ?: return

        scope.launch {
            try {
                val requestBody = """
                    {"lat": ${location.latitude}, "lng": ${location.longitude}}
                """.trimIndent().toRequestBody("application/json".toMediaType())

                val request = Request.Builder()
                    .url("$apiUrl/frota/motorista/$id/posicao")
                    .patch(requestBody)
                    .addHeader("Authorization", "Bearer $authToken")
                    .build()

                val response = client.newCall(request).execute()
                
                if (response.isSuccessful) {
                    Log.d("LocationTracking", "Posição enviada: ${location.latitude}, ${location.longitude}")
                    updateNotification(location)
                } else {
                    Log.w("LocationTracking", "Falha ao enviar posição: ${response.code}")
                }
            } catch (e: Exception) {
                Log.e("LocationTracking", "Erro ao enviar posição", e)
            }
        }
    }

    // ==========================================
    // NOTIFICAÇÃO
    // ==========================================

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Rastreamento de Entrega",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Mostra quando o rastreamento está ativo"
                setShowBadge(false)
            }

            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        // Intent para abrir o app
        val intent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE
        )

        // Intent para parar o tracking
        val stopIntent = Intent(this, LocationTrackingService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            1,
            stopIntent,
            PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SpeedRota - Em Rota")
            .setContentText("Rastreamento ativo")
            .setSmallIcon(br.com.speedrota.R.drawable.ic_notification)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .addAction(
                br.com.speedrota.R.drawable.ic_stop,
                "Parar",
                stopPendingIntent
            )
            .build()
    }

    private fun updateNotification(location: Location) {
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SpeedRota - Em Rota")
            .setContentText("Última atualização: ${java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date())}")
            .setSmallIcon(br.com.speedrota.R.drawable.ic_notification)
            .setOngoing(true)
            .build()

        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, notification)
    }
}

// ==========================================
// HELPER PARA INICIAR/PARAR SERVIÇO
// ==========================================

object LocationTracker {
    
    fun start(context: Context) {
        val intent = Intent(context, LocationTrackingService::class.java).apply {
            action = LocationTrackingService.ACTION_START
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }
    
    fun stop(context: Context) {
        val intent = Intent(context, LocationTrackingService::class.java).apply {
            action = LocationTrackingService.ACTION_STOP
        }
        context.startService(intent)
    }
}
