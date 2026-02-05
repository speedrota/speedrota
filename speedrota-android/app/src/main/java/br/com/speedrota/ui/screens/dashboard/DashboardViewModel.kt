package br.com.speedrota.ui.screens.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.speedrota.data.local.PreferencesManager
import br.com.speedrota.data.model.*
import br.com.speedrota.data.repository.AnalyticsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel do Dashboard Analytics
 * 
 * @pre Usuário autenticado
 * @post Dados carregados conforme plano
 * @invariant FREE=7d fixo, PRO+=filtros disponíveis
 */
@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val repository: AnalyticsRepository,
    private val preferencesManager: PreferencesManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()
    
    init {
        loadDashboardData()
    }
    
    /**
     * Carrega dados do dashboard
     * @pre Token válido
     * @post UI atualizada com dados
     */
    fun loadDashboardData(periodo: String? = null) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            try {
                val plano = preferencesManager.userPlano.first() ?: "FREE"
                val periodoReal = if (plano == "FREE") "7d" else periodo ?: "30d"
                
                // Carregar overview e deliveries (todos os planos)
                val overviewResult = repository.getOverview(periodoReal)
                val deliveriesResult = repository.getDeliveries(periodoReal)
                
                if (overviewResult.isSuccess && deliveriesResult.isSuccess) {
                    val overview = overviewResult.getOrNull()
                    val deliveries = deliveriesResult.getOrNull()
                    
                    // Carregar dados extras para PRO+
                    var trends: TrendsData? = null
                    var suppliers: SuppliersData? = null
                    
                    if (plano != "FREE") {
                        val trendsResult = repository.getTrends(periodoReal)
                        val suppliersResult = repository.getSuppliers(periodoReal)
                        
                        trends = trendsResult.getOrNull()
                        suppliers = suppliersResult.getOrNull()
                    }
                    
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        plano = plano,
                        periodo = periodoReal,
                        overview = overview,
                        deliveries = deliveries,
                        trends = trends,
                        suppliers = suppliers
                    )
                } else {
                    val error = overviewResult.exceptionOrNull()?.message 
                        ?: deliveriesResult.exceptionOrNull()?.message 
                        ?: "Erro ao carregar dados"
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Erro desconhecido"
                )
            }
        }
    }
    
    /**
     * Atualiza período (PRO+)
     */
    fun setPeriodo(periodo: String) {
        if (_uiState.value.plano != "FREE") {
            loadDashboardData(periodo)
        }
    }
}

/**
 * Estado da UI do Dashboard
 */
data class DashboardUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val plano: String = "FREE",
    val periodo: String = "7d",
    val overview: OverviewData? = null,
    val deliveries: DeliveriesData? = null,
    val trends: TrendsData? = null,
    val suppliers: SuppliersData? = null
)
