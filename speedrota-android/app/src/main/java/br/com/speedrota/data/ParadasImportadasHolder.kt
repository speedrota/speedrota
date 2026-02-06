package br.com.speedrota.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Holder para paradas importadas via QR Code/OCR
 * 
 * @description Singleton que armazena temporariamente as paradas importadas
 *              para transferência entre QrCodeScannerScreen e DestinosScreen
 * 
 * @pre QrCodeViewModel adiciona paradas via addParada()
 * @post DestinosViewModel consome via consumeParadas()
 * @invariant Paradas são limpas após consumo para evitar duplicação
 */
@Singleton
class ParadasImportadasHolder @Inject constructor() {
    
    /**
     * Representa uma parada importada de NF-e/QR Code
     */
    data class ParadaImportada(
        val id: String,
        val chaveNfe: String,
        val nome: String,
        val endereco: String
    )
    
    private val _paradasPendentes = MutableStateFlow<List<ParadaImportada>>(emptyList())
    val paradasPendentes: StateFlow<List<ParadaImportada>> = _paradasPendentes.asStateFlow()
    
    /**
     * Adiciona paradas importadas para serem consumidas pela tela de Destinos
     * 
     * @param paradas Lista de paradas com endereço
     */
    fun addParadas(paradas: List<ParadaImportada>) {
        _paradasPendentes.value = _paradasPendentes.value + paradas
        android.util.Log.d("ParadasHolder", "Adicionadas ${paradas.size} paradas. Total: ${_paradasPendentes.value.size}")
    }
    
    /**
     * Adiciona uma única parada
     */
    fun addParada(parada: ParadaImportada) {
        addParadas(listOf(parada))
    }
    
    /**
     * Consome e limpa as paradas pendentes
     * 
     * @return Lista de paradas pendentes (limpa após retorno)
     */
    fun consumeParadas(): List<ParadaImportada> {
        val paradas = _paradasPendentes.value
        _paradasPendentes.value = emptyList()
        android.util.Log.d("ParadasHolder", "Consumidas ${paradas.size} paradas")
        return paradas
    }
    
    /**
     * Verifica se há paradas pendentes
     */
    fun hasParadasPendentes(): Boolean = _paradasPendentes.value.isNotEmpty()
    
    /**
     * Limpa todas as paradas pendentes sem consumir
     */
    fun clear() {
        _paradasPendentes.value = emptyList()
    }
}
