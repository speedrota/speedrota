package br.com.speedrota.ui.screens.pagamento

import android.app.Activity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.speedrota.data.payment.GooglePayUtil
import br.com.speedrota.ui.theme.*
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.wallet.PaymentData
import com.google.android.gms.wallet.PaymentDataRequest
import com.google.android.gms.wallet.PaymentsClient
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

/**
 * Componente de pagamento com Google Pay
 * 
 * @description Permite pagamentos via Google Pay integrado com Mercado Pago
 * @pre Google Play Services instalado e conta Google configurada
 * @post Token de pagamento obtido e enviado para processamento
 */
@Composable
fun GooglePayButton(
    valor: Double,
    plano: String,
    email: String,
    merchantId: String,
    isAvailable: Boolean,
    isLoading: Boolean,
    onGooglePayResult: (token: String, email: String) -> Unit,
    onError: (String) -> Unit,
    onAvailabilityChecked: (Boolean) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val activity = context as? Activity
    val scope = rememberCoroutineScope()
    
    var paymentsClient by remember { mutableStateOf<PaymentsClient?>(null) }
    var showUnavailableMessage by remember { mutableStateOf(false) }
    
    // Inicializar cliente e verificar disponibilidade
    LaunchedEffect(Unit) {
        activity?.let { act ->
            paymentsClient = GooglePayUtil.createPaymentsClient(act)
            
            try {
                val isReadyToPayRequest = GooglePayUtil.isReadyToPayRequest()
                val response = paymentsClient?.isReadyToPay(isReadyToPayRequest)?.await()
                val available = response ?: false
                onAvailabilityChecked(available)
                showUnavailableMessage = !available
            } catch (e: Exception) {
                onAvailabilityChecked(false)
                showUnavailableMessage = true
            }
        }
    }
    
    // Launcher para resultado do Google Pay
    val googlePayLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartIntentSenderForResult()
    ) { result ->
        when (result.resultCode) {
            Activity.RESULT_OK -> {
                result.data?.let { intent ->
                    val paymentData = PaymentData.getFromIntent(intent)
                    paymentData?.let { data ->
                        val token = GooglePayUtil.extractPaymentToken(data)
                        val payerEmail = GooglePayUtil.extractEmail(data) ?: email
                        
                        if (token != null) {
                            onGooglePayResult(token, payerEmail)
                        } else {
                            onError("Não foi possível obter o token de pagamento")
                        }
                    }
                }
            }
            Activity.RESULT_CANCELED -> {
                // Usuário cancelou
            }
            else -> {
                onError("Erro ao processar pagamento com Google Pay")
            }
        }
    }
    
    // Função para iniciar pagamento
    fun startGooglePay() {
        scope.launch {
            try {
                val priceInCents = (valor * 100).toLong()
                val paymentDataRequest = GooglePayUtil.createPaymentDataRequest(
                    priceInCents = priceInCents,
                    merchantId = merchantId
                )
                
                paymentsClient?.let { client ->
                    val task = client.loadPaymentData(paymentDataRequest)
                    
                    task.addOnCompleteListener { completedTask ->
                        if (completedTask.isSuccessful) {
                            completedTask.result?.let { paymentData ->
                                val token = GooglePayUtil.extractPaymentToken(paymentData)
                                val payerEmail = GooglePayUtil.extractEmail(paymentData) ?: email
                                
                                if (token != null) {
                                    onGooglePayResult(token, payerEmail)
                                } else {
                                    onError("Token não encontrado")
                                }
                            }
                        } else {
                            val exception = completedTask.exception
                            if (exception is ApiException) {
                                val statusCode = exception.statusCode
                                when (statusCode) {
                                    CommonStatusCodes.CANCELED -> {
                                        // Usuário cancelou
                                    }
                                    else -> {
                                        onError("Erro Google Pay: $statusCode")
                                    }
                                }
                            } else {
                                onError(exception?.message ?: "Erro desconhecido")
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                onError(e.message ?: "Erro ao iniciar Google Pay")
            }
        }
    }
    
    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        if (!isAvailable && showUnavailableMessage) {
            // Google Pay não disponível
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.Warning,
                        contentDescription = null,
                        modifier = Modifier.size(48.dp),
                        tint = Warning
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    Text(
                        text = "Google Pay indisponível",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    Text(
                        text = "O Google Pay não está configurado neste dispositivo. Adicione um cartão no Google Wallet ou use outra forma de pagamento.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                }
            }
        } else {
            // Botão Google Pay
            Spacer(modifier = Modifier.height(16.dp))
            
            // Valor
            Text(
                text = "R$ ${String.format("%.2f", valor).replace(".", ",")}",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = Primary
            )
            
            Text(
                text = "Plano $plano",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // Botão estilizado do Google Pay
            Button(
                onClick = { startGooglePay() },
                enabled = isAvailable && !isLoading,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.Black
                ),
                shape = RoundedCornerShape(8.dp)
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Processando...", color = Color.White)
                } else {
                    // Logo do Google Pay (texto estilizado)
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = "G",
                            color = Color(0xFF4285F4),
                            fontWeight = FontWeight.Bold,
                            fontSize = 20.sp
                        )
                        Text(
                            text = "o",
                            color = Color(0xFFEA4335),
                            fontWeight = FontWeight.Bold,
                            fontSize = 20.sp
                        )
                        Text(
                            text = "o",
                            color = Color(0xFFFBBC05),
                            fontWeight = FontWeight.Bold,
                            fontSize = 20.sp
                        )
                        Text(
                            text = "g",
                            color = Color(0xFF4285F4),
                            fontWeight = FontWeight.Bold,
                            fontSize = 20.sp
                        )
                        Text(
                            text = "l",
                            color = Color(0xFF34A853),
                            fontWeight = FontWeight.Bold,
                            fontSize = 20.sp
                        )
                        Text(
                            text = "e",
                            color = Color(0xFFEA4335),
                            fontWeight = FontWeight.Bold,
                            fontSize = 20.sp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Pay",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 20.sp
                        )
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // Informações
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = Primary.copy(alpha = 0.1f)
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.Security,
                            contentDescription = null,
                            tint = Primary,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Pagamento seguro",
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    Text(
                        text = "Use os cartões salvos na sua conta Google para pagar de forma rápida e segura.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Benefícios
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                BenefitRow(icon = Icons.Default.Speed, text = "Pagamento instantâneo")
                BenefitRow(icon = Icons.Default.Lock, text = "Seus dados protegidos")
                BenefitRow(icon = Icons.Default.CreditCard, text = "Use seus cartões salvos")
            }
        }
    }
}

@Composable
private fun BenefitRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    text: String
) {
    Row(
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = Success,
            modifier = Modifier.size(20.dp)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = text,
            style = MaterialTheme.typography.bodyMedium
        )
    }
}
