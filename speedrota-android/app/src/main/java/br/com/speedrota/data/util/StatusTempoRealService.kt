package br.com.speedrota.data.util

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.os.Looper
import androidx.core.app.ActivityCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * @description Serviço de Status em Tempo Real para Android
 *
 * DESIGN POR CONTRATO:
 * @pre Permissão de localização concedida
 * @post Posição e status atualizados em tempo real
 *
 * FUNCIONALIDADES:
 * - Tracking de localização
 * - Atualização de status via API
 * - Métricas em tempo real
 */
object StatusTempoRealService {
    
    // ==========================================
    // ENUMS
    // ==========================================
    
    enum class StatusParada {
        PENDENTE,
        EM_TRANSITO,
        CHEGOU,
        ENTREGUE,
        FALHA,
        CANCELADO,
        PULADO
    }
    
    enum class StatusRota {
        PLANEJADA,
        EM_ANDAMENTO,
        PAUSADA,
        CONCLUIDA,
        CANCELADA
    }
    
    enum class MotivoFalha {
        CLIENTE_AUSENTE,
        ENDERECO_NAO_ENCONTRADO,
        RECUSADO,
        AVARIADO,
        OUTRO
    }
    
    // ==========================================
    // DATA CLASSES
    // ==========================================
    
    data class Posicao(
        val lat: Double,
        val lng: Double,
        val heading: Float? = null,
        val velocidade: Float? = null,
        val precisao: Float? = null,
        val timestamp: Long = System.currentTimeMillis()
    )
    
    data class MetricasTempoReal(
        val totalParadas: Int,
        val entregues: Int,
        val pendentes: Int,
        val falhas: Int,
        val progresso: Int, // 0-100%
        val tempoDecorrido: Int, // minutos
        val tempoEstimadoRestante: Int, // minutos
        val kmPercorridos: Double,
        val kmRestantes: Double,
        val velocidadeMedia: Double, // km/h
        val proximaParada: ProximaParada? = null
    )
    
    data class ProximaParada(
        val id: String,
        val endereco: String,
        val etaMinutos: Int
    )
    
    data class EventoStatus(
        val tipo: String, // STATUS_PARADA, STATUS_ROTA, POSICAO, METRICAS
        val rotaId: String,
        val paradaId: String? = null,
        val status: String? = null,
        val posicao: Posicao? = null,
        val metricas: MetricasTempoReal? = null,
        val timestamp: Long = System.currentTimeMillis()
    )
    
    // ==========================================
    // LOCATION TRACKING
    // ==========================================
    
    private var fusedLocationClient: FusedLocationProviderClient? = null
    private var locationCallback: LocationCallback? = null
    
    /**
     * Obtém localização atual uma vez
     */
    suspend fun obterLocalizacaoAtual(context: Context): Posicao? {
        if (!temPermissaoLocalizacao(context)) return null
        
        val client = LocationServices.getFusedLocationProviderClient(context)
        
        return suspendCancellableCoroutine { continuation ->
            try {
                client.lastLocation
                    .addOnSuccessListener { location ->
                        location?.let {
                            continuation.resume(
                                Posicao(
                                    lat = it.latitude,
                                    lng = it.longitude,
                                    heading = if (it.hasBearing()) it.bearing else null,
                                    velocidade = if (it.hasSpeed()) it.speed * 3.6f else null, // m/s -> km/h
                                    precisao = if (it.hasAccuracy()) it.accuracy else null
                                )
                            )
                        } ?: continuation.resume(null)
                    }
                    .addOnFailureListener { e ->
                        continuation.resumeWithException(e)
                    }
            } catch (e: SecurityException) {
                continuation.resumeWithException(e)
            }
        }
    }
    
    /**
     * Inicia tracking contínuo de localização
     * Retorna Flow de posições
     */
    fun iniciarTracking(context: Context): Flow<Posicao> = callbackFlow {
        if (!temPermissaoLocalizacao(context)) {
            close(SecurityException("Permissão de localização não concedida"))
            return@callbackFlow
        }
        
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
        
        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            5000 // 5 segundos
        ).apply {
            setMinUpdateIntervalMillis(2000) // Mínimo 2 segundos
            setMaxUpdateDelayMillis(10000) // Máximo 10 segundos de batch
        }.build()
        
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { location ->
                    val posicao = Posicao(
                        lat = location.latitude,
                        lng = location.longitude,
                        heading = if (location.hasBearing()) location.bearing else null,
                        velocidade = if (location.hasSpeed()) location.speed * 3.6f else null,
                        precisao = if (location.hasAccuracy()) location.accuracy else null
                    )
                    trySend(posicao)
                }
            }
        }
        
        try {
            fusedLocationClient?.requestLocationUpdates(
                locationRequest,
                locationCallback as LocationCallback,
                Looper.getMainLooper()
            )
        } catch (e: SecurityException) {
            close(e)
        }
        
        awaitClose {
            pararTracking()
        }
    }
    
    /**
     * Para tracking de localização
     */
    fun pararTracking() {
        locationCallback?.let { callback ->
            fusedLocationClient?.removeLocationUpdates(callback)
        }
        locationCallback = null
        fusedLocationClient = null
    }
    
    /**
     * Verifica se tem permissão de localização
     */
    fun temPermissaoLocalizacao(context: Context): Boolean {
        return ActivityCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }
    
    // ==========================================
    // HELPERS
    // ==========================================
    
    /**
     * Formata status para exibição
     */
    fun formatarStatus(status: StatusParada): String {
        return when (status) {
            StatusParada.PENDENTE -> "Pendente"
            StatusParada.EM_TRANSITO -> "Em Trânsito"
            StatusParada.CHEGOU -> "Chegou"
            StatusParada.ENTREGUE -> "Entregue"
            StatusParada.FALHA -> "Falha"
            StatusParada.CANCELADO -> "Cancelado"
            StatusParada.PULADO -> "Pulado"
        }
    }
    
    fun formatarStatusRota(status: StatusRota): String {
        return when (status) {
            StatusRota.PLANEJADA -> "Planejada"
            StatusRota.EM_ANDAMENTO -> "Em Andamento"
            StatusRota.PAUSADA -> "Pausada"
            StatusRota.CONCLUIDA -> "Concluída"
            StatusRota.CANCELADA -> "Cancelada"
        }
    }
    
    /**
     * Obtém cor por status
     */
    fun corPorStatus(status: StatusParada): Long {
        return when (status) {
            StatusParada.PENDENTE -> 0xFF6B7280
            StatusParada.EM_TRANSITO -> 0xFF3B82F6
            StatusParada.CHEGOU -> 0xFF8B5CF6
            StatusParada.ENTREGUE -> 0xFF22C55E
            StatusParada.FALHA -> 0xFFEF4444
            StatusParada.CANCELADO -> 0xFF9CA3AF
            StatusParada.PULADO -> 0xFFF59E0B
        }
    }
    
    /**
     * Obtém emoji por status
     */
    fun emojiPorStatus(status: StatusParada): String {
        return when (status) {
            StatusParada.PENDENTE -> "⏳"
            StatusParada.EM_TRANSITO -> "🚗"
            StatusParada.CHEGOU -> "📍"
            StatusParada.ENTREGUE -> "✅"
            StatusParada.FALHA -> "❌"
            StatusParada.CANCELADO -> "🚫"
            StatusParada.PULADO -> "⏭️"
        }
    }
    
    /**
     * Formata motivo de falha
     */
    fun formatarMotivoFalha(motivo: MotivoFalha): String {
        return when (motivo) {
            MotivoFalha.CLIENTE_AUSENTE -> "Cliente Ausente"
            MotivoFalha.ENDERECO_NAO_ENCONTRADO -> "Endereço Não Encontrado"
            MotivoFalha.RECUSADO -> "Recusado"
            MotivoFalha.AVARIADO -> "Produto Avariado"
            MotivoFalha.OUTRO -> "Outro Motivo"
        }
    }
    
    /**
     * Formata tempo em minutos para exibição
     */
    fun formatarTempo(minutos: Int): String {
        return if (minutos < 60) {
            "$minutos min"
        } else {
            val horas = minutos / 60
            val mins = minutos % 60
            "${horas}h ${mins}m"
        }
    }
    
    /**
     * Calcula distância entre dois pontos (Haversine)
     */
    fun calcularDistancia(
        lat1: Double, lng1: Double,
        lat2: Double, lng2: Double
    ): Double {
        val r = 6371.0 // Raio da Terra em km
        val dLat = Math.toRadians(lat2 - lat1)
        val dLng = Math.toRadians(lng2 - lng1)
        val a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2)
        val c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return r * c
    }
}
