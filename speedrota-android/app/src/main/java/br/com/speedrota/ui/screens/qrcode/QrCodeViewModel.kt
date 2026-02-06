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
    val modoScanner: ModoScanner = ModoScanner.MANUAL,
    val fotoCapturada: String? = null,  // Base64 da imagem capturada
    val processandoFoto: Boolean = false
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
    MANUAL,
    FOTO  // Novo modo: captura foto da nota para análise OCR
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
     * Tipos de código detectáveis
     */
    private enum class TipoCodigo {
        QR_CODE_NFE,        // QR Code com URL do SEFAZ
        CHAVE_44_DIGITOS,   // Chave de acesso NF-e (44 dígitos numéricos)
        BARCODE_NUMERICO,   // Código de barras numérico (pode conter chave ou outros dados)
        CODIGO_RASTREIO,    // Código de rastreio de transportadora
        DESCONHECIDO        // Formato não identificado
    }

    /**
     * Identifica o tipo de código escaneado
     */
    private fun identificarTipoCodigo(conteudo: String): TipoCodigo {
        val conteudoLimpo = conteudo.trim()

        return when {
            // QR Code de NF-e/NFC-e (contém URL do SEFAZ)
            conteudoLimpo.contains("nfce.fazenda", ignoreCase = true) ||
            conteudoLimpo.contains("nfe.fazenda", ignoreCase = true) ||
            conteudoLimpo.contains("sefaz", ignoreCase = true) ||
            conteudoLimpo.contains("nfce.set", ignoreCase = true) ||
            conteudoLimpo.contains("nfce.sefin", ignoreCase = true) ||
            conteudoLimpo.contains("sat.sef", ignoreCase = true) ||
            conteudoLimpo.contains("portalsped", ignoreCase = true) ||
            conteudoLimpo.matches(Regex("^https?://.*[?&]p=\\d{44}.*$", RegexOption.IGNORE_CASE)) ||
            conteudoLimpo.matches(Regex("^https?://.*[?&]chNFe=\\d{44}.*$", RegexOption.IGNORE_CASE)) -> {
                TipoCodigo.QR_CODE_NFE
            }

            // Chave de acesso de 44 dígitos (padrão NF-e)
            conteudoLimpo.replace(Regex("[^0-9]"), "").length == 44 &&
            conteudoLimpo.matches(Regex("^[0-9\\s.-]*$")) -> {
                TipoCodigo.CHAVE_44_DIGITOS
            }

            // Código numérico longo (possível código de barras com chave)
            conteudoLimpo.replace(Regex("[^0-9]"), "").length >= 43 &&
            conteudoLimpo.matches(Regex("^[0-9\\s.-]+$")) -> {
                TipoCodigo.BARCODE_NUMERICO
            }

            // Códigos de rastreio (ex: Mercado Livre, Correios, transportadoras)
            conteudoLimpo.matches(Regex("^[A-Z]{2}\\d{9}[A-Z]{2}$")) || // Padrão Correios
            conteudoLimpo.matches(Regex("^\\d{10,15}$")) || // Código numérico curto
            conteudoLimpo.matches(Regex("^[A-Z0-9]{8,20}$", RegexOption.IGNORE_CASE)) -> { // Código alfanumérico
                TipoCodigo.CODIGO_RASTREIO
            }

            else -> TipoCodigo.DESCONHECIDO
        }
    }

    /**
     * Extrai chave de 44 dígitos de qualquer conteúdo
     * Funciona com URLs de QR Code, códigos de barras puros ou texto formatado
     */
    private fun extrairChave44Digitos(conteudo: String): String? {
        // Primeiro: tenta extrair de URL com parâmetro p= ou chNFe=
        val regexUrl = Regex("[?&](?:p|chNFe)=(\\d{44})", RegexOption.IGNORE_CASE)
        regexUrl.find(conteudo)?.let { match ->
            return match.groupValues[1]
        }

        // Segundo: procura sequência de 44 dígitos
        val apenasNumeros = conteudo.replace(Regex("[^0-9]"), "")

        if (apenasNumeros.length == 44) {
            return apenasNumeros
        }

        // Terceiro: procura substring de 44 dígitos em códigos maiores
        if (apenasNumeros.length >= 44) {
            // Tenta encontrar uma chave válida (começa com UF válida: 11-53)
            for (i in 0..apenasNumeros.length - 44) {
                val possibleKey = apenasNumeros.substring(i, i + 44)
                val uf = possibleKey.substring(0, 2).toIntOrNull() ?: 0
                // UFs brasileiras vão de 11 a 53
                if (uf in 11..53) {
                    return possibleKey
                }
            }
            // Se não encontrou com UF válida, retorna os primeiros 44
            return apenasNumeros.substring(0, 44)
        }

        return null
    }

    /**
     * Processa qualquer código: QR Code, código de barras ou chave manual
     * Identifica automaticamente o tipo e roteia para o processamento correto
     *
     * @pre conteudo não vazio
     * @post resultado populado ou error setado
     */
    fun processarQrCode(conteudo: String) {
        if (conteudo.isBlank()) {
            _uiState.value = _uiState.value.copy(error = "Digite ou escaneie um código")
            return
        }
        
        val conteudoLimpo = conteudo.trim()
        val tipoCodigo = identificarTipoCodigo(conteudoLimpo)

        android.util.Log.d("QrCodeViewModel", "Processando código - Tipo: $tipoCodigo, Conteúdo: ${conteudoLimpo.take(100)}...")

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null, resultado = null)
            
            try {
                when (tipoCodigo) {
                    TipoCodigo.QR_CODE_NFE -> {
                        // Processa como QR Code de NF-e
                        processarQrCodeNfe(conteudoLimpo)
                    }

                    TipoCodigo.CHAVE_44_DIGITOS -> {
                        // Processa diretamente como chave de acesso
                        val chave = extrairChave44Digitos(conteudoLimpo)
                        if (chave != null) {
                            processarChaveAcesso(chave)
                        } else {
                            _uiState.value = _uiState.value.copy(
                                isLoading = false,
                                error = "Não foi possível extrair chave de 44 dígitos"
                            )
                        }
                    }

                    TipoCodigo.BARCODE_NUMERICO -> {
                        // Tenta extrair chave do código de barras
                        val chave = extrairChave44Digitos(conteudoLimpo)
                        if (chave != null) {
                            processarChaveAcesso(chave)
                        } else {
                            // Tenta via API de barcode
                            processarBarcodeViaApi(conteudoLimpo)
                        }
                    }

                    TipoCodigo.CODIGO_RASTREIO -> {
                        // Código de rastreio - não é NF-e, exibe informação
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            resultado = QrCodeResultado(
                                chaveAcesso = conteudoLimpo,
                                tipoQrCode = "RASTREIO",
                                nomeDestinatario = "Código de Rastreio/Etiqueta"
                            ),
                            error = "Código de rastreio detectado (não é NF-e)"
                        )
                    }

                    TipoCodigo.DESCONHECIDO -> {
                        // Tenta todos os métodos
                        tentarTodosMetodos(conteudoLimpo)
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("QrCodeViewModel", "Erro ao processar código", e)
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "Erro de conexão: ${e.message}"
                )
            }
        }
    }

    /**
     * Processa QR Code de NF-e/NFC-e
     */
    private suspend fun processarQrCodeNfe(conteudo: String) {
        try {
            // Primeiro: extrai para validar formato
            val extracaoResponse = api.extrairQrCode(mapOf("conteudo" to conteudo))

            if (!extracaoResponse.isSuccessful || extracaoResponse.body()?.success != true) {
                // Tenta extrair chave manualmente
                val chave = extrairChave44Digitos(conteudo)
                if (chave != null) {
                    processarChaveAcesso(chave)
                    return
                }

                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "QR Code não reconhecido pelo servidor. Tente copiar a chave de 44 dígitos."
                )
                return
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
                        tipoQrCode = consultaData?.tipoQrCode ?: extracaoData?.tipo ?: "NF-e",
                        nomeDestinatario = consultaData?.nfe?.destinatario?.nome,
                        endereco = consultaData?.enderecoFormatado,
                        valor = consultaData?.nfe?.valor,
                        dataEmissao = consultaData?.nfe?.dataEmissao
                    )
                )
            } else {
                // Consulta SEFAZ falhou, mas extração OK
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    resultado = QrCodeResultado(
                        chaveAcesso = extracaoData?.chaveAcesso ?: "",
                        tipoQrCode = extracaoData?.tipo ?: "NF-e"
                    ),
                    error = "Chave extraída. Consulta SEFAZ indisponível."
                )
            }
        } catch (e: Exception) {
            android.util.Log.e("QrCodeViewModel", "Erro ao processar QR Code NF-e", e)

            // Fallback: tenta extrair chave manualmente
            val chave = extrairChave44Digitos(conteudo)
            if (chave != null) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    resultado = QrCodeResultado(
                        chaveAcesso = chave,
                        tipoQrCode = "NF-e (extraída localmente)"
                    ),
                    error = "Chave extraída offline. Servidor indisponível."
                )
            } else {
                throw e
            }
        }
    }

    /**
     * Processa chave de acesso de 44 dígitos
     */
    private suspend fun processarChaveAcesso(chave: String) {
        try {
            // Consulta direta com a chave
            val consultaResponse = api.consultarQrCode(mapOf("conteudo" to chave))

            if (consultaResponse.isSuccessful && consultaResponse.body()?.success == true) {
                val consultaData = consultaResponse.body()?.data

                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    resultado = QrCodeResultado(
                        chaveAcesso = consultaData?.chaveAcesso ?: chave,
                        tipoQrCode = consultaData?.tipoQrCode ?: "NF-e",
                        nomeDestinatario = consultaData?.nfe?.destinatario?.nome,
                        endereco = consultaData?.enderecoFormatado,
                        valor = consultaData?.nfe?.valor,
                        dataEmissao = consultaData?.nfe?.dataEmissao
                    )
                )
            } else {
                // Consulta falhou, mas temos a chave
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    resultado = QrCodeResultado(
                        chaveAcesso = chave,
                        tipoQrCode = "CHAVE_44"
                    ),
                    error = "Chave válida. Consulta SEFAZ indisponível."
                )
            }
        } catch (@Suppress("UNUSED_PARAMETER") e: Exception) {
            // Erro de rede, mas temos a chave
            _uiState.value = _uiState.value.copy(
                isLoading = false,
                resultado = QrCodeResultado(
                    chaveAcesso = chave,
                    tipoQrCode = "CHAVE_44"
                ),
                error = "Chave extraída. Sem conexão para consultar SEFAZ."
            )
        }
    }

    /**
     * Processa código de barras via API
     */
    private suspend fun processarBarcodeViaApi(barcode: String) {
        try {
            val response = api.extrairBarcode(mapOf("barcode" to barcode))

            if (response.isSuccessful && response.body()?.success == true) {
                val data = response.body()?.data

                data?.chaveAcesso?.let { chave ->
                    processarChaveAcesso(chave)
                } ?: run {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        resultado = QrCodeResultado(
                            chaveAcesso = barcode,
                            tipoQrCode = "BARCODE"
                        ),
                        error = "Código de barras lido, mas não foi possível extrair chave NF-e."
                    )
                }
            } else {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    resultado = QrCodeResultado(
                        chaveAcesso = barcode,
                        tipoQrCode = "BARCODE"
                    ),
                    error = "Código de barras não reconhecido como NF-e."
                )
            }
        } catch (e: Exception) {
            _uiState.value = _uiState.value.copy(
                isLoading = false,
                resultado = QrCodeResultado(
                    chaveAcesso = barcode,
                    tipoQrCode = "BARCODE"
                ),
                error = "Erro ao processar código de barras: ${e.message}"
            )
        }
    }

    /**
     * Tenta todos os métodos de extração quando o tipo é desconhecido
     */
    private suspend fun tentarTodosMetodos(conteudo: String) {
        // 1. Tenta como QR Code
        try {
            val extracaoResponse = api.extrairQrCode(mapOf("conteudo" to conteudo))
            if (extracaoResponse.isSuccessful && extracaoResponse.body()?.success == true) {
                processarQrCodeNfe(conteudo)
                return
            }
        } catch (e: Exception) {
            android.util.Log.d("QrCodeViewModel", "QR Code extraction failed: ${e.message}")
        }

        // 2. Tenta extrair chave de 44 dígitos
        val chave = extrairChave44Digitos(conteudo)
        if (chave != null) {
            processarChaveAcesso(chave)
            return
        }

        // 3. Tenta como barcode
        try {
            val barcodeResponse = api.extrairBarcode(mapOf("barcode" to conteudo))
            if (barcodeResponse.isSuccessful && barcodeResponse.body()?.success == true) {
                val data = barcodeResponse.body()?.data
                if (data?.chaveAcesso != null) {
                    processarChaveAcesso(data.chaveAcesso)
                    return
                }
            }
        } catch (e: Exception) {
            android.util.Log.d("QrCodeViewModel", "Barcode extraction failed: ${e.message}")
        }

        // 4. Nenhum método funcionou
        _uiState.value = _uiState.value.copy(
            isLoading = false,
            resultado = QrCodeResultado(
                chaveAcesso = conteudo,
                tipoQrCode = "DESCONHECIDO"
            ),
            error = "Formato não reconhecido. Este código pode não ser uma NF-e."
        )
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
            error = null,
            fotoCapturada = null
        )
    }

    /**
     * Define a foto capturada (base64)
     */
    fun setFotoCapturada(base64: String?) {
        _uiState.value = _uiState.value.copy(
            fotoCapturada = base64,
            error = null
        )
    }

    /**
     * Processa foto da nota fiscal via OCR
     * O OCR extrai o endereço completo da nota, não apenas o código de barras
     *
     * @pre fotoCapturada não nula (base64 da imagem)
     * @post Endereço extraído da nota ou erro
     */
    fun processarFotoNota() {
        val foto = _uiState.value.fotoCapturada
        if (foto.isNullOrBlank()) {
            _uiState.value = _uiState.value.copy(error = "Nenhuma foto capturada")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                processandoFoto = true,
                isLoading = true,
                error = null,
                resultado = null
            )

            try {
                android.util.Log.d("QrCodeViewModel", "Enviando imagem para OCR (tamanho: ${foto.length} chars)")

                val response = api.analisarImagemNota(mapOf("imagem" to foto))

                android.util.Log.d("QrCodeViewModel", "Resposta OCR: success=${response.isSuccessful}, body=${response.body()}")

                if (response.isSuccessful && response.body()?.success == true) {
                    val data = response.body()?.data

                    // Montar endereço a partir da resposta do OCR
                    val enderecoCompleto = buildString {
                        // Primeiro tenta usar o endereço estruturado
                        data?.endereco?.let { end ->
                            end.enderecoCompleto?.let {
                                append(it)
                            } ?: run {
                                listOfNotNull(
                                    end.logradouro,
                                    end.numero?.let { ", $it" },
                                    end.complemento?.let { " - $it" },
                                    end.bairro?.let { " - $it" },
                                    end.cidade?.let { ", $it" },
                                    end.uf?.let { "/$it" },
                                    end.cep?.let { " - CEP: $it" }
                                ).forEach { append(it) }
                            }
                        }

                        // Se não tem endereço estruturado, tenta dados adicionais
                        if (isEmpty()) {
                            data?.dadosAdicionais?.enderecoDestinatario?.let { append(it) }
                        }
                    }

                    val nomeDestinatario = data?.destinatario?.nome
                        ?: data?.dadosAdicionais?.nomeDestinatario

                    val chaveAcesso = data?.chaveAcesso
                        ?: data?.notaFiscal?.chaveAcesso
                        ?: ""

                    val valorTotal = data?.notaFiscal?.valorTotal
                        ?: data?.dadosAdicionais?.valorTotal

                    val dataEmissao = data?.notaFiscal?.dataEmissao
                        ?: data?.dadosAdicionais?.dataEmissao

                    // Verifica se conseguiu extrair alguma informação útil
                    if (enderecoCompleto.isNotBlank() || nomeDestinatario != null || chaveAcesso.isNotBlank()) {
                        android.util.Log.d("QrCodeViewModel", "OCR sucesso - Endereço: $enderecoCompleto, Nome: $nomeDestinatario")

                        _uiState.value = _uiState.value.copy(
                            processandoFoto = false,
                            isLoading = false,
                            resultado = QrCodeResultado(
                                chaveAcesso = chaveAcesso.ifBlank { "OCR-${System.currentTimeMillis()}" },
                                tipoQrCode = data?.tipoDocumento ?: "Nota Fiscal (OCR)",
                                nomeDestinatario = nomeDestinatario,
                                endereco = enderecoCompleto.ifBlank { null },
                                valor = valorTotal,
                                dataEmissao = dataEmissao
                            ),
                            fotoCapturada = null
                        )
                    } else {
                        android.util.Log.w("QrCodeViewModel", "OCR não encontrou dados - textoExtraido: ${data?.textoExtraido?.take(200)}")

                        _uiState.value = _uiState.value.copy(
                            processandoFoto = false,
                            isLoading = false,
                            error = "Não foi possível extrair informações da imagem.\n\nDicas:\n• Fotografe toda a nota fiscal\n• Garanta boa iluminação\n• Evite reflexos e sombras"
                        )
                    }
                } else {
                    val errorMsg = response.body()?.error ?: response.errorBody()?.string() ?: "Erro ao processar imagem"
                    android.util.Log.e("QrCodeViewModel", "OCR erro: $errorMsg")

                    _uiState.value = _uiState.value.copy(
                        processandoFoto = false,
                        isLoading = false,
                        error = errorMsg
                    )
                }
            } catch (e: Exception) {
                android.util.Log.e("QrCodeViewModel", "Erro ao enviar imagem para OCR", e)
                _uiState.value = _uiState.value.copy(
                    processandoFoto = false,
                    isLoading = false,
                    error = "Erro de conexão: ${e.message}"
                )
            }
        }
    }

    /**
     * Limpa a foto capturada
     */
    fun limparFoto() {
        _uiState.value = _uiState.value.copy(
            fotoCapturada = null,
            error = null
        )
    }
    
    /**
     * Processa código de barras (método legado - redireciona para processarQrCode unificado)
     *
     * @pre barcode não vazio
     * @post Usa método unificado de processamento
     */
    fun processarBarcode(barcode: String) {
        // Usa o método unificado que detecta automaticamente o tipo
        processarQrCode(barcode)
    }
}
