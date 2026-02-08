package br.com.speedrota.ui.screens.separacao

import android.graphics.Bitmap
import android.util.Base64
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.speedrota.data.api.SpeedRotaApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import javax.inject.Inject

/**
 * ViewModel para Tela de Separação de Carga
 * 
 * FLUXO:
 * 1. STEP CAIXAS - Fotografar caixas/etiquetas
 * 2. STEP NOTAS - Fotografar NF-e/DANFEs
 * 3. MATCHING AUTOMÁTICO - PED/REM/SubRota
 * 4. RESULTADO - IDs visuais para cada par
 * 
 * @pre API SpeedRotaApi injetada via Hilt
 * @post Dados reais extraídos via OCR, não simulados
 */
@HiltViewModel
class SeparacaoViewModel @Inject constructor(
    private val api: SpeedRotaApi
) : ViewModel() {

    private val _uiState = MutableStateFlow(SeparacaoUiState())
    val uiState: StateFlow<SeparacaoUiState> = _uiState.asStateFlow()

    // Cores para tags visuais
    private val coresTags = listOf(
        0xFFf97316, // 1 - Laranja
        0xFF22c55e, // 2 - Verde
        0xFF3b82f6, // 3 - Azul
        0xFFa855f7, // 4 - Roxo
        0xFFec4899, // 5 - Pink
        0xFFeab308, // 6 - Amarelo
        0xFF14b8a6, // 7 - Teal
        0xFFf43f5e, // 8 - Vermelho
    )

    fun setDestinoInfo(motoristaId: String?, motoristaNome: String?, empresaId: String?, empresaNome: String?) {
        _uiState.update { it.copy(
            motoristaId = motoristaId,
            motoristaNome = motoristaNome,
            empresaId = empresaId,
            empresaNome = empresaNome
        )}
    }

    // ============================================================
    // STEP 1: CAIXAS
    // ============================================================

    /**
     * Adiciona caixa e processa via OCR real da API
     * @pre base64Image é imagem válida em base64
     * @post Caixa adicionada com status PROCESSING, depois READY ou ERROR
     */
    fun adicionarCaixa(base64Image: String) {
        Log.d("SeparacaoVM", "=====================================")
        Log.d("SeparacaoVM", "adicionarCaixa() CHAMADO")
        Log.d("SeparacaoVM", "Imagem size: ${base64Image.length} chars")
        Log.d("SeparacaoVM", "API instance: $api")
        Log.d("SeparacaoVM", "=====================================")

        val id = "caixa-${System.currentTimeMillis()}"
        val novaCaixa = CaixaItem(
            id = id,
            thumb = base64Image,
            status = ItemStatus.PROCESSING
        )
        
        _uiState.update { it.copy(
            caixas = it.caixas + novaCaixa
        )}
        
        Log.d("SeparacaoVM", "Caixa adicionada com status PROCESSING, total: ${_uiState.value.caixas.size}")

        // Processar OCR via API REAL
        viewModelScope.launch {
            Log.d("SeparacaoVM", "Coroutine INICIADA para caixa $id")
            Log.d("SeparacaoVM", "Thread atual: ${Thread.currentThread().name}")
            try {
                Log.d("SeparacaoVM", "Chamando API OCR em IO thread...")

                // Chamar API de OCR real com Dispatchers.IO
                val response = withContext(Dispatchers.IO) {
                    Log.d("SeparacaoVM", "Dentro de withContext(IO), thread: ${Thread.currentThread().name}")
                    Log.d("SeparacaoVM", "Fazendo requisição POST para sefaz/ocr/analisar...")
                    api.analisarImagemNota(mapOf("imagem" to base64Image))
                }

                Log.d("SeparacaoVM", "=====================================")
                Log.d("SeparacaoVM", "RESPOSTA RECEBIDA")
                Log.d("SeparacaoVM", "isSuccessful: ${response.isSuccessful}")
                Log.d("SeparacaoVM", "HTTP Code: ${response.code()}")
                Log.d("SeparacaoVM", "Body success: ${response.body()?.success}")
                Log.d("SeparacaoVM", "=====================================")

                if (response.isSuccessful && response.body()?.success == true) {
                    val data = response.body()?.data
                    val textoExtraido = data?.textoExtraido ?: ""
                    val caixaData = data?.caixa // Dados de caixa extraídos pelo parser
                    
                    Log.d("SeparacaoVM", "OCR API retornou ${textoExtraido.length} chars")
                    Log.d("SeparacaoVM", "Tipo documento: ${data?.tipoDocumento}, Fornecedor: ${data?.fornecedor}")
                    Log.d("SeparacaoVM", "Dados caixa: PED=${caixaData?.pedido}, REM=${caixaData?.remessa}, CX=${caixaData?.numero}/${caixaData?.total}")

                    // Usar dados do parser de caixa se disponíveis, senão fallback para regex
                    val dadosExtraidos = CaixaDados(
                        pedido = caixaData?.pedido ?: extrairCampoDoTexto(textoExtraido, "PED"),
                        remessa = caixaData?.remessa ?: extrairCampoDoTexto(textoExtraido, "REM"),
                        subRota = caixaData?.subRota ?: extrairCampoDoTexto(textoExtraido, "SR"),
                        cep = data?.endereco?.cep ?: extrairCampoDoTexto(textoExtraido, "CEP"),
                        destinatario = data?.destinatario?.nome 
                            ?: data?.dadosAdicionais?.nomeDestinatario
                            ?: extrairCampoDoTexto(textoExtraido, "DEST"),
                        // Campos extras de caixa
                        caixaNumero = caixaData?.numero,
                        caixaTotal = caixaData?.total,
                        itens = caixaData?.itens,
                        pesoKg = caixaData?.pesoKg
                    )
                    
                    Log.d("SeparacaoVM", "OCR completo para caixa $id: PED=${dadosExtraidos.pedido}, REM=${dadosExtraidos.remessa}, CX=${dadosExtraidos.caixaNumero}/${dadosExtraidos.caixaTotal}")

                    _uiState.update { state ->
                        state.copy(
                            caixas = state.caixas.map { c ->
                                if (c.id == id) c.copy(
                                    status = ItemStatus.READY,
                                    dados = dadosExtraidos
                                ) else c
                            }
                        )
                    }
                } else {
                    val errorBody = response.errorBody()?.string()
                    val errorMsg = response.body()?.error ?: errorBody ?: "Erro desconhecido"
                    Log.e("SeparacaoVM", "=====================================")
                    Log.e("SeparacaoVM", "ERRO API OCR para caixa $id")
                    Log.e("SeparacaoVM", "HTTP Code: ${response.code()}")
                    Log.e("SeparacaoVM", "Error Body: $errorBody")
                    Log.e("SeparacaoVM", "=====================================")
                    throw Exception("HTTP ${response.code()}: $errorMsg")
                }
            } catch (e: Exception) {
                Log.e("SeparacaoVM", "=====================================")
                Log.e("SeparacaoVM", "EXCEPTION ao processar caixa $id")
                Log.e("SeparacaoVM", "Type: ${e.javaClass.simpleName}")
                Log.e("SeparacaoVM", "Message: ${e.message}")
                Log.e("SeparacaoVM", "Cause: ${e.cause}")
                Log.e("SeparacaoVM", "=====================================", e)
                _uiState.update { state ->
                    state.copy(
                        caixas = state.caixas.map { c ->
                            if (c.id == id) c.copy(status = ItemStatus.ERROR) else c
                        },
                        erro = "Erro ao processar caixa: ${e.message}"
                    )
                }
            }
        }
    }

    fun removerCaixa(id: String) {
        _uiState.update { it.copy(
            caixas = it.caixas.filter { c -> c.id != id }
        )}
    }

    fun avancarParaNotas() {
        _uiState.update { it.copy(step = SeparacaoStep.NOTAS) }
    }

    // ============================================================
    // STEP 2: NOTAS
    // ============================================================

    /**
     * Adiciona nota fiscal e processa via OCR real da API
     * @pre base64Image é imagem válida em base64
     * @post Nota adicionada com status PROCESSING, depois READY ou ERROR
     */
    fun adicionarNota(base64Image: String) {
        Log.d("SeparacaoVM", "=====================================")
        Log.d("SeparacaoVM", "adicionarNota() CHAMADO")
        Log.d("SeparacaoVM", "Imagem size: ${base64Image.length} chars")
        Log.d("SeparacaoVM", "API instance: $api")
        Log.d("SeparacaoVM", "=====================================")

        val id = "nota-${System.currentTimeMillis()}"
        val novaNota = NotaItem(
            id = id,
            thumb = base64Image,
            status = ItemStatus.PROCESSING
        )
        
        _uiState.update { it.copy(
            notas = it.notas + novaNota
        )}
        
        Log.d("SeparacaoVM", "Nota adicionada com status PROCESSING, total: ${_uiState.value.notas.size}")

        // Processar OCR via API REAL
        viewModelScope.launch {
            Log.d("SeparacaoVM", "Coroutine INICIADA para nota $id")
            Log.d("SeparacaoVM", "Thread atual: ${Thread.currentThread().name}")
            try {
                Log.d("SeparacaoVM", "Chamando API OCR em IO thread...")

                // Chamar API de OCR real com Dispatchers.IO
                val response = withContext(Dispatchers.IO) {
                    Log.d("SeparacaoVM", "Dentro de withContext(IO), thread: ${Thread.currentThread().name}")
                    Log.d("SeparacaoVM", "Fazendo requisição POST para sefaz/ocr/analisar...")
                    api.analisarImagemNota(mapOf("imagem" to base64Image))
                }

                Log.d("SeparacaoVM", "=====================================")
                Log.d("SeparacaoVM", "RESPOSTA RECEBIDA (nota)")
                Log.d("SeparacaoVM", "isSuccessful: ${response.isSuccessful}")
                Log.d("SeparacaoVM", "HTTP Code: ${response.code()}")
                Log.d("SeparacaoVM", "Body success: ${response.body()?.success}")
                Log.d("SeparacaoVM", "=====================================")

                if (response.isSuccessful && response.body()?.success == true) {
                    val data = response.body()?.data
                    val textoExtraido = data?.textoExtraido ?: ""
                    val caixaData = data?.caixa  // Dados de caixa extraídos pelo parser (DANFE Natura inclui!)
                    
                    Log.d("SeparacaoVM", "OCR API retornou ${textoExtraido.length} chars, confianca: ${data?.confianca}")
                    Log.d("SeparacaoVM", "Tipo documento: ${data?.tipoDocumento}, Fornecedor: ${data?.fornecedor}")
                    Log.d("SeparacaoVM", "Dados caixa da API: PED=${caixaData?.pedido}, REM=${caixaData?.remessa}")

                    // Montar endereço completo
                    val enderecoCompleto = data?.endereco?.let { end ->
                        listOfNotNull(
                            end.logradouro,
                            end.numero?.let { ", $it" },
                            end.complemento?.let { " - $it" },
                            end.bairro?.let { " - $it" }
                        ).joinToString("")
                    } ?: data?.dadosAdicionais?.enderecoDestinatario ?: ""
                    
                    // Extrair campos PED/REM/SubRota - PRIORIZAR dados do parser (caixaData)
                    // A API retorna caixa.pedido/remessa para etiquetas E DANFEs Natura
                    val dadosExtraidos = NotaDados(
                        pedido = caixaData?.pedido  // Prioridade 1: Parser especializado
                            ?: data?.notaFiscal?.numero  // Prioridade 2: Número da NF
                            ?: extrairCampoDoTexto(textoExtraido, "PED"),  // Fallback: regex
                        remessa = caixaData?.remessa  // Prioridade 1: Parser especializado
                            ?: extrairCampoDoTexto(textoExtraido, "REM"),  // Fallback: regex
                        subRota = caixaData?.subRota 
                            ?: extrairCampoDoTexto(textoExtraido, "SR"),
                        destinatario = data?.destinatario?.nome 
                            ?: data?.dadosAdicionais?.nomeDestinatario
                            ?: extrairCampoDoTexto(textoExtraido, "DEST")
                            ?: "Destinatário",
                        endereco = enderecoCompleto.ifEmpty { null } ?: "Endereço não identificado",
                        cidade = data?.endereco?.cidade ?: "",
                        uf = data?.endereco?.uf ?: "",
                        cep = data?.endereco?.cep ?: caixaData?.subRota?.let { null } ?: extrairCampoDoTexto(textoExtraido, "CEP") ?: ""
                    )
                    
                    Log.d("SeparacaoVM", "OCR completo para nota $id: PED=${dadosExtraidos.pedido}, REM=${dadosExtraidos.remessa}, DEST=${dadosExtraidos.destinatario}")

                    _uiState.update { state ->
                        state.copy(
                            notas = state.notas.map { n ->
                                if (n.id == id) n.copy(
                                    status = ItemStatus.READY,
                                    dados = dadosExtraidos
                                ) else n
                            }
                        )
                    }
                } else {
                    val errorBody = response.errorBody()?.string()
                    val errorMsg = response.body()?.error ?: errorBody ?: "Erro desconhecido"
                    Log.e("SeparacaoVM", "=====================================")
                    Log.e("SeparacaoVM", "ERRO API OCR para nota $id")
                    Log.e("SeparacaoVM", "HTTP Code: ${response.code()}")
                    Log.e("SeparacaoVM", "Error Body: $errorBody")
                    Log.e("SeparacaoVM", "=====================================")
                    throw Exception("HTTP ${response.code()}: $errorMsg")
                }
            } catch (e: Exception) {
                Log.e("SeparacaoVM", "=====================================")
                Log.e("SeparacaoVM", "EXCEPTION ao processar nota $id")
                Log.e("SeparacaoVM", "Type: ${e.javaClass.simpleName}")
                Log.e("SeparacaoVM", "Message: ${e.message}")
                Log.e("SeparacaoVM", "Cause: ${e.cause}")
                Log.e("SeparacaoVM", "=====================================", e)
                _uiState.update { state ->
                    state.copy(
                        notas = state.notas.map { n ->
                            if (n.id == id) n.copy(status = ItemStatus.ERROR) else n
                        },
                        erro = "Erro ao processar nota: ${e.message}"
                    )
                }
            }
        }
    }

    fun removerNota(id: String) {
        _uiState.update { it.copy(
            notas = it.notas.filter { n -> n.id != id }
        )}
    }

    fun voltarParaCaixas() {
        _uiState.update { it.copy(step = SeparacaoStep.CAIXAS) }
    }

    // ============================================================
    // STEP 3: MATCHING
    // ============================================================

    fun executarMatching() {
        viewModelScope.launch {
            _uiState.update { it.copy(
                step = SeparacaoStep.MATCHING,
                isLoading = true,
                progresso = 0f,
                progressoTexto = "Iniciando matching..."
            )}
            
            val caixasReady = _uiState.value.caixas.filter { it.status == ItemStatus.READY }
            val notasReady = _uiState.value.notas.filter { it.status == ItemStatus.READY }
            
            val pares = mutableListOf<ParMatch>()
            val caixasUsadas = mutableSetOf<String>()
            val notasUsadas = mutableSetOf<String>()
            var colorIndex = 0
            
            // PASS 1: PED exato
            _uiState.update { it.copy(progressoTexto = "Matching por PEDIDO...") }
            delay(300)
            for (caixa in caixasReady) {
                if (caixa.dados?.pedido.isNullOrEmpty() || caixasUsadas.contains(caixa.id)) continue
                
                for (nota in notasReady) {
                    if (notasUsadas.contains(nota.id)) continue
                    
                    if (!nota.dados?.pedido.isNullOrEmpty() && caixa.dados?.pedido == nota.dados?.pedido) {
                        val par = criarPar(listOf(caixa), nota, 50, listOf("PED"), colorIndex++)
                        pares.add(par)
                        caixasUsadas.add(caixa.id)
                        notasUsadas.add(nota.id)
                        break
                    }
                }
            }
            _uiState.update { it.copy(progresso = 0.25f) }
            
            // PASS 2: REM exato (AGRUPA múltiplas caixas da mesma remessa)
            _uiState.update { it.copy(progressoTexto = "Matching por REMESSA...") }
            delay(300)
            
            // Agrupar caixas por REM
            val caixasPorRem = caixasReady
                .filter { !caixasUsadas.contains(it.id) && !it.dados?.remessa.isNullOrEmpty() }
                .groupBy { it.dados?.remessa }
            
            for ((rem, caixasDoGrupo) in caixasPorRem) {
                if (rem.isNullOrEmpty()) continue
                
                // Encontrar nota com mesma REM
                val notaMatch = notasReady.find { 
                    !notasUsadas.contains(it.id) && it.dados?.remessa == rem 
                }
                
                if (notaMatch != null) {
                    val par = criarPar(caixasDoGrupo, notaMatch, 50, listOf("REM"), colorIndex++)
                    pares.add(par)
                    caixasDoGrupo.forEach { caixasUsadas.add(it.id) }
                    notasUsadas.add(notaMatch.id)
                }
            }
            _uiState.update { it.copy(progresso = 0.5f) }
            
            // PASS 3: SUB_ROTA exato
            _uiState.update { it.copy(progressoTexto = "Matching por SUB-ROTA...") }
            delay(300)
            for (caixa in caixasReady) {
                if (caixa.dados?.subRota.isNullOrEmpty() || caixasUsadas.contains(caixa.id)) continue
                
                for (nota in notasReady) {
                    if (notasUsadas.contains(nota.id)) continue
                    
                    if (!nota.dados?.subRota.isNullOrEmpty() && 
                        caixa.dados?.subRota?.uppercase() == nota.dados?.subRota?.uppercase()) {
                        val par = criarPar(listOf(caixa), nota, 40, listOf("SUB_ROTA"), colorIndex++)
                        pares.add(par)
                        caixasUsadas.add(caixa.id)
                        notasUsadas.add(nota.id)
                        break
                    }
                }
            }
            _uiState.update { it.copy(progresso = 0.75f) }
            
            // PASS 4: CEP
            _uiState.update { it.copy(progressoTexto = "Matching por CEP...") }
            delay(300)
            for (caixa in caixasReady) {
                if (caixasUsadas.contains(caixa.id)) continue
                
                for (nota in notasReady) {
                    if (notasUsadas.contains(nota.id)) continue
                    
                    val cepCaixa = caixa.dados?.cep?.replace(Regex("\\D"), "") ?: ""
                    val cepNota = nota.dados?.cep?.replace(Regex("\\D"), "") ?: ""
                    
                    if (cepCaixa.isNotEmpty() && cepNota.isNotEmpty() && cepCaixa == cepNota) {
                        val par = criarPar(listOf(caixa), nota, 30, listOf("CEP"), colorIndex++)
                        pares.add(par)
                        caixasUsadas.add(caixa.id)
                        notasUsadas.add(nota.id)
                        break
                    }
                }
            }
            
            // Identificar não pareados
            val caixasNaoPareadas = caixasReady.filter { !caixasUsadas.contains(it.id) }
            val notasNaoPareadas = notasReady.filter { !notasUsadas.contains(it.id) }
            
            _uiState.update { it.copy(
                progresso = 1f,
                progressoTexto = "Matching concluído!",
                pares = pares,
                caixasNaoPareadas = caixasNaoPareadas,
                notasNaoPareadas = notasNaoPareadas
            )}
            
            delay(500)
            
            _uiState.update { it.copy(
                step = SeparacaoStep.RESULTADO,
                isLoading = false
            )}
        }
    }
    
    // ============================================================
    // NAVEGAÇÃO ENTRE ETAPAS (para adicionar mais caixas/notas)
    // ============================================================
    
    /**
     * Volta para etapa de caixas para escanear mais
     * @post step = CAIXAS, mantém caixas/notas existentes
     */
    fun voltarParaAdicionarCaixas() {
        _uiState.update { it.copy(step = SeparacaoStep.CAIXAS) }
    }
    
    /**
     * Volta para etapa de notas para escanear mais
     * @post step = NOTAS, mantém caixas/notas existentes
     */
    fun voltarParaAdicionarNotas() {
        _uiState.update { it.copy(step = SeparacaoStep.NOTAS) }
    }
    
    /**
     * Calcula total de caixas faltantes em todos os pares
     * @return Número de caixas que ainda precisam ser escaneadas
     */
    fun calcularTotalCaixasFaltantes(): Int {
        return _uiState.value.pares.sumOf { it.caixasFaltando }
    }

    private fun criarPar(caixas: List<CaixaItem>, nota: NotaItem, score: Int, by: List<String>, colorIndex: Int): ParMatch {
        val primeiraCaixa = caixas.firstOrNull()
        val tagVisual = gerarTagVisual(
            nota.dados?.destinatario ?: primeiraCaixa?.dados?.destinatario ?: "XXX",
            nota.dados?.cep ?: primeiraCaixa?.dados?.cep ?: "00000",
            caixas.size
        )
        
        // Determinar total de volumes esperado
        val totalVolumes = primeiraCaixa?.dados?.caixaTotal 
            ?: caixas.size.coerceAtLeast(1)
        val caixasFaltando = (totalVolumes - caixas.size).coerceAtLeast(0)
        
        return ParMatch(
            id = "par-${primeiraCaixa?.id ?: "unknown"}-${nota.id}",
            tagVisual = tagVisual,
            tagCor = coresTags[colorIndex % 8],
            matchScore = score,
            caixas = caixas,
            nota = nota,
            matchedBy = by,
            totalVolumes = totalVolumes,
            caixasFaltando = caixasFaltando
        )
    }

    private fun gerarTagVisual(nome: String, cep: String, itens: Int): String {
        val nome3 = nome.replace(Regex("[^A-Za-z]"), "").take(3).uppercase().padEnd(3, 'X')
        val cep3 = cep.replace(Regex("\\D"), "").takeLast(3).padStart(3, '0')
        val itens2 = itens.toString().padStart(2, '0')
        return "$nome3-$cep3-$itens2"
    }

    // ============================================================
    // HELPERS - PARSING REAL DE TEXTO OCR
    // ============================================================

    /**
     * Extrai campos do texto OCR usando padrões regex
     * @pre texto é resultado do OCR da API
     * @post Valor extraído ou null se não encontrado
     * @invariant Nunca retorna dados fake/aleatórios
     */
    private fun extrairCampoDoTexto(texto: String, campo: String): String? {
        if (texto.isBlank()) return null
        
        return when (campo) {
            "PED" -> {
                // Padrões: "PED: 123456", "PEDIDO 123456", "PED123456"
                val regex = Regex("(?:PED|PEDIDO)[:\\s]*([0-9]{4,12})", RegexOption.IGNORE_CASE)
                regex.find(texto)?.groupValues?.getOrNull(1)
            }
            "REM" -> {
                // Padrões: "REM: 123456", "REMESSA 123456", "SHIPMENT 123456"
                val regex = Regex("(?:REM|REMESSA|SHIPMENT)[:\\s]*([0-9]{4,12})", RegexOption.IGNORE_CASE)
                regex.find(texto)?.groupValues?.getOrNull(1)
            }
            "SR" -> {
                // Padrões: "SUB_ROTA: A1", "SUBROTA SR-B2", "SR: C3"
                val regex = Regex("(?:SUB[_\\-\\s]?ROTA|SUBROTA|SR)[:\\s]*([A-Z0-9\\-]{2,10})", RegexOption.IGNORE_CASE)
                regex.find(texto)?.groupValues?.getOrNull(1)?.uppercase()
            }
            "CEP" -> {
                // Padrões: "CEP: 01310-100", "01310-100", "01310100"
                val regexComLabel = Regex("CEP[:\\s]*(\\d{5}[-]?\\d{3})", RegexOption.IGNORE_CASE)
                val regexSemLabel = Regex("(\\d{5}[-]\\d{3})")
                regexComLabel.find(texto)?.groupValues?.getOrNull(1)
                    ?: regexSemLabel.find(texto)?.groupValues?.getOrNull(1)
            }
            "DEST" -> {
                // Padrões: "DEST: Nome", "DESTINATÁRIO: Nome"
                val regex = Regex("(?:DEST|DESTINAT[ÁA]RIO)[:\\s]*([A-Za-zÀ-ú\\s]{3,50})", RegexOption.IGNORE_CASE)
                regex.find(texto)?.groupValues?.getOrNull(1)?.trim()
            }
            else -> null
        }
    }

    fun limparErro() {
        _uiState.update { it.copy(erro = null) }
    }

    fun gerarArquivoSeparacao(): String {
        val state = _uiState.value
        val linhas = StringBuilder()
        
        linhas.appendLine("═══════════════════════════════════════════════════")
        linhas.appendLine("      SEPARAÇÃO DE CARGA - ${java.text.SimpleDateFormat("dd/MM/yyyy").format(java.util.Date())}")
        linhas.appendLine("═══════════════════════════════════════════════════")
        linhas.appendLine()
        
        if (state.motoristaNome != null) {
            linhas.appendLine("Destino: 🚗 ${state.motoristaNome}")
        } else if (state.empresaNome != null) {
            linhas.appendLine("Destino: 🏢 ${state.empresaNome}")
        }
        linhas.appendLine("Total de Pares: ${state.pares.size}")
        linhas.appendLine()
        linhas.appendLine("───────────────────────────────────────────────────")
        
        state.pares.forEachIndexed { idx, par ->
            linhas.appendLine()
            linhas.appendLine("📦 ${idx + 1}. TAG: ${par.tagVisual}")
            linhas.appendLine("   Match: ${par.matchedBy.joinToString(" + ")} | Score: ${par.matchScore}pts")
            par.nota.dados?.let { dados ->
                linhas.appendLine("   Para: ${dados.destinatario}")
                linhas.appendLine("   End: ${dados.endereco}")
                linhas.appendLine("   ${dados.cidade}/${dados.uf} - CEP: ${dados.cep}")
            }
            linhas.appendLine("───────────────────────────────────────────────────")
        }
        
        if (state.caixasNaoPareadas.isNotEmpty()) {
            linhas.appendLine()
            linhas.appendLine("⚠️ CAIXAS NÃO PAREADAS:")
            state.caixasNaoPareadas.forEach { c ->
                linhas.appendLine("   - ${c.dados?.pedido ?: c.id}")
            }
        }
        
        if (state.notasNaoPareadas.isNotEmpty()) {
            linhas.appendLine()
            linhas.appendLine("⚠️ NOTAS NÃO PAREADAS:")
            state.notasNaoPareadas.forEach { n ->
                linhas.appendLine("   - ${n.dados?.destinatario ?: n.id}")
            }
        }
        
        return linhas.toString()
    }
}

// ============================================================
// TIPOS
// ============================================================

enum class SeparacaoStep {
    CAIXAS,
    NOTAS,
    MATCHING,
    RESULTADO
}

enum class ItemStatus {
    PENDING,
    PROCESSING,
    READY,
    ERROR
}

data class CaixaDados(
    val pedido: String? = null,
    val remessa: String? = null,
    val subRota: String? = null,
    val destinatario: String? = null,
    val cep: String? = null,
    val itens: Int? = null,
    val pesoKg: Double? = null,
    // Campos de identificação da caixa
    val caixaNumero: Int? = null,  // CX 002/003 -> 2
    val caixaTotal: Int? = null    // CX 002/003 -> 3
)

data class NotaDados(
    val pedido: String? = null,
    val remessa: String? = null,
    val subRota: String? = null,
    val destinatario: String? = null,
    val endereco: String? = null,
    val cidade: String? = null,
    val uf: String? = null,
    val cep: String? = null
)

data class CaixaItem(
    val id: String,
    val thumb: String,
    val status: ItemStatus,
    val dados: CaixaDados? = null
)

data class NotaItem(
    val id: String,
    val thumb: String,
    val status: ItemStatus,
    val dados: NotaDados? = null
)

data class ParMatch(
    val id: String,
    val tagVisual: String,
    val tagCor: Long,
    val matchScore: Int,
    val caixas: List<CaixaItem>,  // Múltiplas caixas por remessa
    val nota: NotaItem,
    val matchedBy: List<String>,
    val totalVolumes: Int = 1,  // Total de volumes esperado (da nota ou caixa)
    val caixasFaltando: Int = 0  // Quantas caixas faltam escanear
) {
    // Compat: primeira caixa para código legado
    val caixa: CaixaItem get() = caixas.firstOrNull() ?: CaixaItem("empty", "", ItemStatus.ERROR)
}

data class SeparacaoUiState(
    val step: SeparacaoStep = SeparacaoStep.CAIXAS,
    val caixas: List<CaixaItem> = emptyList(),
    val notas: List<NotaItem> = emptyList(),
    val pares: List<ParMatch> = emptyList(),
    val caixasNaoPareadas: List<CaixaItem> = emptyList(),
    val notasNaoPareadas: List<NotaItem> = emptyList(),
    val isLoading: Boolean = false,
    val progresso: Float = 0f,
    val progressoTexto: String = "",
    val erro: String? = null,
    val motoristaId: String? = null,
    val motoristaNome: String? = null,
    val empresaId: String? = null,
    val empresaNome: String? = null
)
