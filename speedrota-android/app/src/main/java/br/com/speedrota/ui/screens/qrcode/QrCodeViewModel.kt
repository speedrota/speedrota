package br.com.speedrota.ui.screens.qrcode

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.speedrota.data.api.SpeedRotaApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Estado da tela QR Code Scanner
 */
data class QrCodeState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val inputText: String = "",
    val resultado: QrCodeResultado? = null,
    val importados: List<NfeImportada> = emptyList(),
    val modoScanner: ModoScanner = ModoScanner.MANUAL
)

/**
 * Resultado da extração/consulta do QR Code
 */
data class QrCodeResultado(
    val chaveAcesso: String,
    val tipoQrCode: String,
    val nomeDestinatario: String? = null,
    val endereco: String? = null,
    val valor: Double? = null,
    val dataEmissao: String? = null
)

/**
 * NF-e importada como parada
 */
data class NfeImportada(
    val id: String,
    val chaveNfe: String,
    val nome: String,
    val endereco: String
)

/**
 * Modos de escaneamento
 */
enum class ModoScanner {
    CAMERA,
    MANUAL
}

/**
 * ViewModel para QR Code Scanner
 * 
 * @pre SpeedRotaApi configurada
 * @post Gerencia estado de scan e importação de NF-e
 * @invariant Estado sempre consistente
 */
@HiltViewModel
class QrCodeViewModel @Inject constructor(
    private val api: SpeedRotaApi
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(QrCodeState())
    val uiState: StateFlow<QrCodeState> = _uiState.asStateFlow()
    
    /**
     * Atualiza texto de input
     */
    fun onInputChange(text: String) {
        _uiState.value = _uiState.value.copy(inputText = text, error = null)
    }
    
    /**
     * Alterna modo do scanner
     */
    fun alternarModo(modo: ModoScanner) {
        _uiState.value = _uiState.value.copy(
            modoScanner = modo,
            resultado = null,
            error = null
        )
    }
    
    /**
     * Processa QR Code: extrai e consulta SEFAZ
     * 
     * @pre conteudo não vazio
     * @post resultado populado ou error setado
     */
    fun processarQrCode(conteudo: String) {
        if (conteudo.isBlank()) {
            _uiState.value = _uiState.value.copy(error = "Digite ou escaneie um QR Code")
            return
        }
        
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null, resultado = null)
            
            try {
                // Primeiro: extrai para validar formato
                val extracaoResponse = api.extrairQrCode(mapOf("conteudo" to conteudo))
                
                if (!extracaoResponse.isSuccessful || extracaoResponse.body()?.success != true) {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = "Formato de QR Code não reconhecido"
                    )
                    return@launch
                }
                
                val extracaoData = extracaoResponse.body()?.data
                
                // Segundo: consulta SEFAZ
                val consultaResponse = api.consultarQrCode(mapOf("conteudo" to conteudo))
                
                if (consultaResponse.isSuccessful && consultaResponse.body()?.success == true) {
                    val consultaData = consultaResponse.body()?.data
                    
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        resultado = QrCodeResultado(
                            chaveAcesso = consultaData?.chaveAcesso ?: extracaoData?.chaveAcesso ?: "",
                            tipoQrCode = consultaData?.tipoQrCode ?: extracaoData?.tipo ?: "DESCONHECIDO",
                            nomeDestinatario = consultaData?.nfe?.destinatario?.nome,
                            endereco = consultaData?.enderecoFormatado,
                            valor = consultaData?.nfe?.valor,
                            dataEmissao = consultaData?.nfe?.dataEmissao
                        )
                    )
                } else {
                    // Consulta falhou, mas extração OK
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        resultado = QrCodeResultado(
                            chaveAcesso = extracaoData?.chaveAcesso ?: "",
                            tipoQrCode = extracaoData?.tipo ?: "DESCONHECIDO"
                        ),
                        error = "Extração OK, mas consulta SEFAZ falhou"
                    )
                }
                
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "Erro de conexão: ${e.message}"
                )
            }
        }
    }
    
    /**
     * Importa NF-e atual como parada
     * 
     * @pre resultado não nulo
     * @post NF-e adicionada à lista de importados
     */
    fun importarResultado() {
        val resultado = _uiState.value.resultado ?: return
        
        val novaImportacao = NfeImportada(
            id = "qr-${System.currentTimeMillis()}",
            chaveNfe = resultado.chaveAcesso,
            nome = resultado.nomeDestinatario ?: "Destinatário",
            endereco = resultado.endereco ?: "Endereço não disponível"
        )
        
        _uiState.value = _uiState.value.copy(
            importados = _uiState.value.importados + novaImportacao,
            resultado = null,
            inputText = ""
        )
    }
    
    /**
     * Remove parada importada
     */
    fun removerImportado(id: String) {
        _uiState.value = _uiState.value.copy(
            importados = _uiState.value.importados.filter { it.id != id }
        )
    }
    
    /**
     * Limpa resultado e input
     */
    fun limpar() {
        _uiState.value = _uiState.value.copy(
            resultado = null,
            inputText = "",
            error = null
        )
    }
    
    /**
     * Processa código de barras
     * 
     * @pre barcode não vazio (44 dígitos)
     * @post Consulta via endpoint barcode/extrair
     */
    fun processarBarcode(barcode: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            try {
                val response = api.extrairBarcode(mapOf("barcode" to barcode))
                
                if (response.isSuccessful && response.body()?.success == true) {
                    val data = response.body()?.data
                    
                    // Usar a chave extraída para consulta
                    data?.chaveAcesso?.let { chave ->
                        processarQrCode(chave)
                    } ?: run {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            error = "Não foi possível extrair chave do código de barras"
                        )
                    }
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = "Código de barras inválido"
                    )
                }
                
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "Erro: ${e.message}"
                )
            }
        }
    }
}
