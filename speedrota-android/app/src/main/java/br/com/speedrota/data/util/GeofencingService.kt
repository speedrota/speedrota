package br.com.speedrota.data.util

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.os.Looper
import android.util.Log
import androidx.core.app.ActivityCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import br.com.speedrota.data.model.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.launch
import kotlin.math.*

/**
 * @description Serviço de Geofencing para Android
 *
 * DESIGN POR CONTRATO:
 * @pre Permissão de localização concedida
 * @pre Motorista com zonas atribuídas
 * @post Eventos de entrada/saída detectados e notificados
 *
 * FUNCIONALIDADES:
 * - Monitoramento contínuo de posição
 * - Detecção de entrada/saída de zonas
 * - Notificações locais de eventos
 * - Sincronização com API
 *
 * ALGORITMOS:
 * - Ray Casting para polígonos
 * - Haversine para círculos
 */
object GeofencingService {

    private const val TAG = "GeofencingService"
    private const val RAIO_TERRA_KM = 6371.0
    
    // Intervalo de atualização de posição (30 segundos)
    private const val LOCATION_INTERVAL_MS = 30_000L
    private const val LOCATION_FASTEST_INTERVAL_MS = 15_000L
    
    // Debounce para evitar eventos duplicados (30 segundos)
    private const val DEBOUNCE_MS = 30_000L

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var fusedLocationClient: FusedLocationProviderClient? = null
    private var locationCallback: LocationCallback? = null
    private var isMonitoring = false

    // Estado atual
    private val _ultimaPosicao = MutableStateFlow<Coordenada?>(null)
    val ultimaPosicao: StateFlow<Coordenada?> = _ultimaPosicao

    private val _zonasAtuais = MutableStateFlow<List<String>>(emptyList())
    val zonasAtuais: StateFlow<List<String>> = _zonasAtuais

    private val _eventosRecentes = MutableStateFlow<List<EventoGeofenceSimples>>(emptyList())
    val eventosRecentes: StateFlow<List<EventoGeofenceSimples>> = _eventosRecentes

    // Cache de zonas monitoradas
    private var zonasMonitoradas: List<ZonaGeofence> = emptyList()
    private var motoristaId: String? = null
    
    // Para debounce
    private var ultimosEventos: MutableMap<String, Long> = mutableMapOf()

    // ==========================================
    // ALGORITMOS GEOMÉTRICOS
    // ==========================================

    /**
     * Calcula distância Haversine entre dois pontos
     * 
     * @pre lat ∈ [-90, 90], lng ∈ [-180, 180]
     * @post resultado >= 0 (km)
     */
    fun haversine(p1: Coordenada, p2: Coordenada): Double {
        val dLat = Math.toRadians(p2.lat - p1.lat)
        val dLng = Math.toRadians(p2.lng - p1.lng)

        val a = sin(dLat / 2).pow(2) +
                cos(Math.toRadians(p1.lat)) *
                cos(Math.toRadians(p2.lat)) *
                sin(dLng / 2).pow(2)

        val c = 2 * atan2(sqrt(a), sqrt(1 - a))

        return RAIO_TERRA_KM * c
    }

    /**
     * Ray Casting Algorithm - Verifica se ponto está dentro de polígono
     * 
     * @pre vertices.size >= 3
     * @post true se ponto dentro, false se fora
     */
    fun pontoEmPoligono(ponto: Coordenada, vertices: List<Coordenada>): Boolean {
        if (vertices.size < 3) return false

        var dentro = false
        val n = vertices.size

        var j = n - 1
        for (i in 0 until n) {
            val vi = vertices[i]
            val vj = vertices[j]

            if (((vi.lng > ponto.lng) != (vj.lng > ponto.lng)) &&
                (ponto.lat < (vj.lat - vi.lat) * (ponto.lng - vi.lng) / (vj.lng - vi.lng) + vi.lat)
            ) {
                dentro = !dentro
            }
            j = i
        }

        return dentro
    }

    /**
     * Verifica se ponto está dentro de círculo
     * 
     * @pre raioKm > 0
     * @post true se distância <= raio
     */
    fun pontoEmCirculo(ponto: Coordenada, centro: Coordenada, raioKm: Double): Boolean {
        if (raioKm <= 0) return false
        return haversine(ponto, centro) <= raioKm
    }

    /**
     * Verifica se ponto está dentro de uma zona
     */
    fun pontoEmZona(ponto: Coordenada, zona: ZonaGeofence): Boolean {
        return when (zona.tipo) {
            "CIRCULO", "CIRCULAR" -> {
                val centro = zona.centro ?: return false
                val raio = zona.raioKm ?: return false
                pontoEmCirculo(ponto, centro, raio)
            }
            "POLIGONO" -> {
                val vertices = zona.vertices ?: return false
                pontoEmPoligono(ponto, vertices)
            }
            else -> false
        }
    }

    // ==========================================
    // MONITORAMENTO
    // ==========================================

    /**
     * Inicia monitoramento de geofence
     * 
     * @pre context válido, motoristaId não vazio
     * @pre Permissão de localização concedida
     */
    fun iniciarMonitoramento(
        context: Context,
        motoristaId: String,
        zonas: List<ZonaGeofence>,
        onEvento: (EventoGeofenceSimples) -> Unit = {}
    ) {
        if (isMonitoring) {
            Log.w(TAG, "Monitoramento já ativo")
            return
        }

        this.motoristaId = motoristaId
        this.zonasMonitoradas = zonas
        this.isMonitoring = true

        Log.i(TAG, "Iniciando monitoramento de ${zonas.size} zonas para motorista $motoristaId")

        // Criar cliente de localização
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)

        // Configurar request de localização
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, LOCATION_INTERVAL_MS)
            .setMinUpdateIntervalMillis(LOCATION_FASTEST_INTERVAL_MS)
            .build()

        // Callback de localização
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { location ->
                    processarLocalizacao(location, onEvento)
                }
            }
        }

        // Verificar permissão e iniciar updates
        if (ActivityCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            Log.e(TAG, "Permissão de localização não concedida")
            return
        }

        fusedLocationClient?.requestLocationUpdates(
            locationRequest,
            locationCallback!!,
            Looper.getMainLooper()
        )

        Log.i(TAG, "Monitoramento de geofence iniciado com sucesso")
    }

    /**
     * Para monitoramento de geofence
     */
    fun pararMonitoramento() {
        if (!isMonitoring) return

        locationCallback?.let {
            fusedLocationClient?.removeLocationUpdates(it)
        }

        isMonitoring = false
        fusedLocationClient = null
        locationCallback = null
        zonasMonitoradas = emptyList()
        motoristaId = null
        ultimosEventos.clear()

        Log.i(TAG, "Monitoramento de geofence parado")
    }

    /**
     * Processa nova localização e detecta eventos
     */
    private fun processarLocalizacao(
        location: Location,
        onEvento: (EventoGeofenceSimples) -> Unit
    ) {
        val posicao = Coordenada(location.latitude, location.longitude)
        _ultimaPosicao.value = posicao

        val zonasAtivas = mutableListOf<String>()
        val agora = System.currentTimeMillis()

        for (zona in zonasMonitoradas) {
            val estaDentro = pontoEmZona(posicao, zona)

            if (estaDentro) {
                zonasAtivas.add(zona.nome)
            }

            // Detectar mudança de estado
            val estadoAnterior = _zonasAtuais.value.contains(zona.nome)
            val chaveEvento = "${zona.id}_${if (estaDentro) "ENTRADA" else "SAIDA"}"
            val ultimoEvento = ultimosEventos[chaveEvento] ?: 0L

            // Aplicar debounce
            if ((agora - ultimoEvento) < DEBOUNCE_MS) {
                continue
            }

            if (estaDentro && !estadoAnterior) {
                // ENTRADA na zona
                val evento = EventoGeofenceSimples(
                    tipo = "ENTRADA",
                    zonaId = zona.id,
                    timestamp = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.getDefault())
                        .format(java.util.Date())
                )

                ultimosEventos[chaveEvento] = agora
                adicionarEvento(evento)
                onEvento(evento)

                Log.i(TAG, "Evento ENTRADA na zona ${zona.nome}")

            } else if (!estaDentro && estadoAnterior) {
                // SAÍDA da zona
                val evento = EventoGeofenceSimples(
                    tipo = "SAIDA",
                    zonaId = zona.id,
                    timestamp = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.getDefault())
                        .format(java.util.Date())
                )

                ultimosEventos[chaveEvento] = agora
                adicionarEvento(evento)
                onEvento(evento)

                Log.i(TAG, "Evento SAIDA da zona ${zona.nome}")
            }
        }

        _zonasAtuais.value = zonasAtivas
    }

    private fun adicionarEvento(evento: EventoGeofenceSimples) {
        val eventosAtuais = _eventosRecentes.value.toMutableList()
        eventosAtuais.add(0, evento)
        // Manter apenas os últimos 20 eventos
        if (eventosAtuais.size > 20) {
            eventosAtuais.removeAt(eventosAtuais.lastIndex)
        }
        _eventosRecentes.value = eventosAtuais
    }

    // ==========================================
    // UTILITÁRIOS
    // ==========================================

    /**
     * Verifica se está monitorando
     */
    fun isMonitorando(): Boolean = isMonitoring

    /**
     * Obtém número de zonas sendo monitoradas
     */
    fun getNumeroZonas(): Int = zonasMonitoradas.size

    /**
     * Verifica manualmente se posição está em alguma zona
     */
    fun verificarPosicaoManual(posicao: Coordenada): List<ZonaGeofence> {
        return zonasMonitoradas.filter { pontoEmZona(posicao, it) }
    }

    /**
     * Calcula distância até borda mais próxima de uma zona
     */
    fun distanciaAteBorda(posicao: Coordenada, zona: ZonaGeofence): Double {
        return when (zona.tipo) {
            "CIRCULO", "CIRCULAR" -> {
                val centro = zona.centro ?: return Double.MAX_VALUE
                val raio = zona.raioKm ?: return Double.MAX_VALUE
                abs(haversine(posicao, centro) - raio) * 1000 // metros
            }
            "POLIGONO" -> {
                val vertices = zona.vertices ?: return Double.MAX_VALUE
                vertices.minOfOrNull { haversine(posicao, it) * 1000 } ?: Double.MAX_VALUE
            }
            else -> Double.MAX_VALUE
        }
    }

    /**
     * Obtém zonas onde a posição está dentro
     */
    fun getZonasAtuais(): List<String> = _zonasAtuais.value

    /**
     * Limpa cache de eventos
     */
    fun limparEventos() {
        _eventosRecentes.value = emptyList()
        ultimosEventos.clear()
    }
}
