package br.com.speedrota.data

import br.com.speedrota.data.model.Coordenada
import br.com.speedrota.ui.screens.destinos.DestinoItem
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Holder para dados de rota - transfere dados entre telas
 * 
 * @description Singleton que armazena origem e destinos para serem
 *              consumidos pela RotaScreen/RotaViewModel
 * 
 * @pre DestinosScreen/OrigemScreen define os dados
 * @post RotaViewModel consome os dados
 * @invariant Dados persistem até serem consumidos ou limpos
 */
@Singleton
class RotaDataHolder @Inject constructor() {
    
    /**
     * Origem da rota
     */
    data class Origem(
        val endereco: String,
        val coordenadas: Coordenada?,
        val fonte: String = "gps" // gps, manual, cep
    )
    
    private val _origem = MutableStateFlow<Origem?>(null)
    val origem: StateFlow<Origem?> = _origem.asStateFlow()
    
    private val _destinos = MutableStateFlow<List<DestinoItem>>(emptyList())
    val destinos: StateFlow<List<DestinoItem>> = _destinos.asStateFlow()
    
    private val _incluirRetorno = MutableStateFlow(true)
    val incluirRetorno: StateFlow<Boolean> = _incluirRetorno.asStateFlow()
    
    /**
     * Define a origem da rota
     */
    fun setOrigem(origem: Origem) {
        _origem.value = origem
        android.util.Log.d("RotaDataHolder", "Origem definida: ${origem.endereco}")
    }
    
    /**
     * Define os destinos da rota
     */
    fun setDestinos(destinos: List<DestinoItem>) {
        _destinos.value = destinos
        android.util.Log.d("RotaDataHolder", "Destinos definidos: ${destinos.size}")
    }
    
    /**
     * Adiciona um destino
     */
    fun addDestino(destino: DestinoItem) {
        _destinos.value = _destinos.value + destino
        android.util.Log.d("RotaDataHolder", "Destino adicionado. Total: ${_destinos.value.size}")
    }
    
    /**
     * Remove um destino
     */
    fun removeDestino(id: String) {
        _destinos.value = _destinos.value.filter { it.id != id }
    }
    
    /**
     * Define se deve incluir retorno
     */
    fun setIncluirRetorno(incluir: Boolean) {
        _incluirRetorno.value = incluir
    }
    
    /**
     * Verifica se há dados suficientes para calcular rota
     */
    fun hasDataForRoute(): Boolean {
        val temOrigem = _origem.value != null
        val temDestinos = _destinos.value.isNotEmpty()
        android.util.Log.d("RotaDataHolder", "hasDataForRoute: origem=$temOrigem, destinos=$temDestinos")
        return temOrigem && temDestinos
    }
    
    /**
     * Limpa todos os dados
     */
    fun clear() {
        _origem.value = null
        _destinos.value = emptyList()
        _incluirRetorno.value = true
        android.util.Log.d("RotaDataHolder", "Dados limpos")
    }
    
    /**
     * Obtém coordenadas da origem
     */
    fun getOrigemCoordenadas(): Coordenada? = _origem.value?.coordenadas
    
    /**
     * Obtém lista de endereços dos destinos
     */
    fun getDestinosEnderecos(): List<String> = _destinos.value.map { it.endereco }
    
    // ============================================================
    // DADOS DE SEPARAÇÃO (persistidos entre navegações)
    // ============================================================
    
    data class SeparacaoState(
        val step: String = "caixas",
        val caixasCount: Int = 0,
        val notasCount: Int = 0,
        val paresCount: Int = 0,
        val caixasNaoPareadasCount: Int = 0,
        val notasNaoPareadasCount: Int = 0
    )
    
    private val _separacaoState = MutableStateFlow<SeparacaoState?>(null)
    val separacaoState: StateFlow<SeparacaoState?> = _separacaoState.asStateFlow()
    
    /**
     * Salva estado da separação para restaurar após navegação
     */
    fun saveSeparacaoState(state: SeparacaoState) {
        _separacaoState.value = state
        android.util.Log.d("RotaDataHolder", "Separação salva: ${state.step}, ${state.paresCount} pares")
    }
    
    /**
     * Limpa estado de separação
     */
    fun clearSeparacaoState() {
        _separacaoState.value = null
    }
    
    /**
     * Verifica se tem estado de separação salvo
     */
    fun hasSeparacaoState(): Boolean = _separacaoState.value != null
}
