package br.com.speedrota.ui.screens.origem

import android.Manifest
import android.content.Context
import android.location.Geocoder
import android.location.Location
import androidx.compose.runtime.mutableStateOf
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.util.Locale
import javax.inject.Inject

data class OrigemUiState(
    val endereco: String = "",
    val latitude: Double? = null,
    val longitude: Double? = null,
    val isLoadingLocation: Boolean = false,
    val isSearching: Boolean = false,
    val error: String? = null,
    val locationPermissionGranted: Boolean = false
)

@HiltViewModel
class OrigemViewModel @Inject constructor(
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val _uiState = MutableStateFlow(OrigemUiState())
    val uiState: StateFlow<OrigemUiState> = _uiState.asStateFlow()

    private val fusedLocationClient: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(context)

    fun onEnderecoChange(endereco: String) {
        _uiState.value = _uiState.value.copy(endereco = endereco, error = null)
    }

    fun onPermissionResult(granted: Boolean) {
        _uiState.value = _uiState.value.copy(locationPermissionGranted = granted)
        if (granted) {
            getCurrentLocation()
        }
    }

    @Suppress("MissingPermission")
    fun getCurrentLocation() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoadingLocation = true, error = null)
            
            try {
                val cancellationToken = CancellationTokenSource()
                val location = fusedLocationClient.getCurrentLocation(
                    Priority.PRIORITY_HIGH_ACCURACY,
                    cancellationToken.token
                ).await()
                
                if (location != null) {
                    // Reverse geocoding
                    val endereco = withContext(Dispatchers.IO) {
                        try {
                            val geocoder = Geocoder(context, Locale("pt", "BR"))
                            @Suppress("DEPRECATION")
                            val addresses = geocoder.getFromLocation(
                                location.latitude,
                                location.longitude,
                                1
                            )
                            addresses?.firstOrNull()?.let { address ->
                                buildString {
                                    address.thoroughfare?.let { append(it) }
                                    address.subThoroughfare?.let { append(", $it") }
                                    address.subLocality?.let { append(" - $it") }
                                    address.locality?.let { append(", $it") }
                                    address.adminArea?.let { append(" - $it") }
                                }
                            } ?: "Localização: ${location.latitude}, ${location.longitude}"
                        } catch (e: Exception) {
                            "Localização: ${location.latitude}, ${location.longitude}"
                        }
                    }
                    
                    _uiState.value = _uiState.value.copy(
                        endereco = endereco,
                        latitude = location.latitude,
                        longitude = location.longitude,
                        isLoadingLocation = false
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoadingLocation = false,
                        error = "Não foi possível obter localização"
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoadingLocation = false,
                    error = "Erro ao obter localização: ${e.message}"
                )
            }
        }
    }

    fun searchEndereco() {
        val endereco = _uiState.value.endereco
        if (endereco.isBlank()) {
            _uiState.value = _uiState.value.copy(error = "Digite um endereço")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSearching = true, error = null)
            
            try {
                val result = withContext(Dispatchers.IO) {
                    val geocoder = Geocoder(context, Locale("pt", "BR"))
                    @Suppress("DEPRECATION")
                    geocoder.getFromLocationName(endereco, 1)?.firstOrNull()
                }
                
                if (result != null) {
                    _uiState.value = _uiState.value.copy(
                        latitude = result.latitude,
                        longitude = result.longitude,
                        isSearching = false
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        isSearching = false,
                        error = "Endereço não encontrado"
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isSearching = false,
                    error = "Erro ao buscar endereço"
                )
            }
        }
    }

    fun isOrigemValida(): Boolean {
        return _uiState.value.endereco.isNotBlank() && 
               _uiState.value.latitude != null && 
               _uiState.value.longitude != null
    }
}
