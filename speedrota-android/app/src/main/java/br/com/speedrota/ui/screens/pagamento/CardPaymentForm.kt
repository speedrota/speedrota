package br.com.speedrota.ui.screens.pagamento

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.speedrota.data.payment.CardBrand
import br.com.speedrota.ui.theme.*

/**
 * Formulário de cartão de crédito/débito
 * 
 * @description Coleta dados do cartão para tokenização
 * @pre Public Key do Mercado Pago disponível
 * @post Dados validados e prontos para tokenização
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CardPaymentForm(
    uiState: PagamentoUiState,
    valor: Double,
    plano: String,
    email: String,
    onCardNumberChange: (String) -> Unit,
    onCardholderNameChange: (String) -> Unit,
    onExpirationChange: (String) -> Unit,
    onSecurityCodeChange: (String) -> Unit,
    onCpfChange: (String) -> Unit,
    onInstallmentsChange: (Int) -> Unit,
    onProcessPayment: () -> Unit,
    modifier: Modifier = Modifier
) {
    val focusManager = LocalFocusManager.current
    
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Preview do cartão
        CardPreview(
            cardNumber = uiState.cardNumber,
            cardholderName = uiState.cardholderName,
            expirationDate = uiState.expirationDate,
            cardBrand = uiState.cardBrand
        )
        
        Spacer(modifier = Modifier.height(24.dp))
        
        // Número do cartão
        OutlinedTextField(
            value = uiState.cardNumber,
            onValueChange = { if (it.filter { c -> c.isDigit() }.length <= 19) onCardNumberChange(it) },
            label = { Text("Número do cartão") },
            placeholder = { Text("0000 0000 0000 0000") },
            leadingIcon = {
                Icon(Icons.Default.CreditCard, contentDescription = null)
            },
            trailingIcon = {
                if (uiState.cardBrand != CardBrand.UNKNOWN) {
                    CardBrandIcon(brand = uiState.cardBrand)
                }
            },
            isError = uiState.cardNumber.length > 10 && !uiState.isCardNumberValid,
            supportingText = if (uiState.cardNumber.length > 10 && !uiState.isCardNumberValid) {
                { Text("Número inválido", color = Error) }
            } else null,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Number,
                imeAction = ImeAction.Next
            ),
            keyboardActions = KeyboardActions(
                onNext = { focusManager.moveFocus(FocusDirection.Down) }
            ),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        
        Spacer(modifier = Modifier.height(12.dp))
        
        // Nome do titular
        OutlinedTextField(
            value = uiState.cardholderName,
            onValueChange = onCardholderNameChange,
            label = { Text("Nome no cartão") },
            placeholder = { Text("COMO ESTÁ NO CARTÃO") },
            leadingIcon = {
                Icon(Icons.Default.Person, contentDescription = null)
            },
            keyboardOptions = KeyboardOptions(
                capitalization = KeyboardCapitalization.Characters,
                imeAction = ImeAction.Next
            ),
            keyboardActions = KeyboardActions(
                onNext = { focusManager.moveFocus(FocusDirection.Down) }
            ),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        
        Spacer(modifier = Modifier.height(12.dp))
        
        // Validade e CVV
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedTextField(
                value = uiState.expirationDate,
                onValueChange = { if (it.filter { c -> c.isDigit() }.length <= 4) onExpirationChange(it) },
                label = { Text("Validade") },
                placeholder = { Text("MM/AA") },
                leadingIcon = {
                    Icon(Icons.Default.CalendarMonth, contentDescription = null)
                },
                isError = uiState.expirationDate.length >= 5 && !uiState.isExpirationValid,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Number,
                    imeAction = ImeAction.Next
                ),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Right) }
                ),
                singleLine = true,
                modifier = Modifier.weight(1f)
            )
            
            OutlinedTextField(
                value = uiState.securityCode,
                onValueChange = onSecurityCodeChange,
                label = { Text("CVV") },
                placeholder = { Text(if (uiState.cardBrand == CardBrand.AMEX) "0000" else "000") },
                leadingIcon = {
                    Icon(Icons.Default.Lock, contentDescription = null)
                },
                isError = uiState.securityCode.length >= 3 && !uiState.isCvvValid,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.NumberPassword,
                    imeAction = ImeAction.Next
                ),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Down) }
                ),
                singleLine = true,
                modifier = Modifier.weight(1f)
            )
        }
        
        Spacer(modifier = Modifier.height(12.dp))
        
        // CPF
        OutlinedTextField(
            value = uiState.cpf,
            onValueChange = onCpfChange,
            label = { Text("CPF do titular") },
            placeholder = { Text("000.000.000-00") },
            leadingIcon = {
                Icon(Icons.Default.Badge, contentDescription = null)
            },
            isError = uiState.cpf.filter { it.isDigit() }.length == 11 && !uiState.isCpfValid,
            supportingText = if (uiState.cpf.filter { it.isDigit() }.length == 11 && !uiState.isCpfValid) {
                { Text("CPF inválido", color = Error) }
            } else null,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Number,
                imeAction = ImeAction.Done
            ),
            keyboardActions = KeyboardActions(
                onDone = { focusManager.clearFocus() }
            ),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        
        Spacer(modifier = Modifier.height(16.dp))
        
        // Parcelas
        if (valor >= 20) {
            InstallmentSelector(
                valor = valor,
                selectedInstallments = uiState.installments,
                onInstallmentsChange = onInstallmentsChange
            )
            
            Spacer(modifier = Modifier.height(16.dp))
        }
        
        // Erro
        if (uiState.error != null) {
            Card(
                colors = CardDefaults.cardColors(containerColor = Error.copy(alpha = 0.1f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.Error,
                        contentDescription = null,
                        tint = Error
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = uiState.error,
                        color = Error,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
        
        // Botão de pagamento
        Button(
            onClick = onProcessPayment,
            enabled = !uiState.isProcessingCard && uiState.isCardNumberValid && 
                     uiState.cardholderName.length >= 3 && uiState.isExpirationValid && 
                     uiState.isCvvValid && uiState.isCpfValid,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Primary)
        ) {
            if (uiState.isProcessingCard) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = Color.White,
                    strokeWidth = 2.dp
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Processando...")
            } else {
                Icon(Icons.Default.Payment, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Pagar R$ ${String.format("%.2f", valor).replace(".", ",")}",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        // Segurança
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Icon(
                Icons.Default.Lock,
                contentDescription = null,
                modifier = Modifier.size(14.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = "Pagamento 100% seguro via Mercado Pago",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Preview visual do cartão
 */
@Composable
fun CardPreview(
    cardNumber: String,
    cardholderName: String,
    expirationDate: String,
    cardBrand: CardBrand
) {
    val gradient = when (cardBrand) {
        CardBrand.VISA -> Brush.horizontalGradient(
            colors = listOf(Color(0xFF1A1F71), Color(0xFF2D3BA8))
        )
        CardBrand.MASTERCARD -> Brush.horizontalGradient(
            colors = listOf(Color(0xFFEB001B), Color(0xFFF79E1B))
        )
        CardBrand.AMEX -> Brush.horizontalGradient(
            colors = listOf(Color(0xFF006FCF), Color(0xFF00A3E0))
        )
        CardBrand.ELO -> Brush.horizontalGradient(
            colors = listOf(Color(0xFFFFCB05), Color(0xFFEF4123))
        )
        CardBrand.HIPERCARD -> Brush.horizontalGradient(
            colors = listOf(Color(0xFFB3131B), Color(0xFF8B0000))
        )
        else -> Brush.horizontalGradient(
            colors = listOf(Color(0xFF424242), Color(0xFF616161))
        )
    }
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .height(200.dp),
        shape = RoundedCornerShape(16.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(gradient)
                .padding(20.dp)
        ) {
            // Chip
            Box(
                modifier = Modifier
                    .size(40.dp, 30.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(Color(0xFFD4AF37))
                    .align(Alignment.TopStart)
            )
            
            // Bandeira
            Text(
                text = when (cardBrand) {
                    CardBrand.VISA -> "VISA"
                    CardBrand.MASTERCARD -> "●● mastercard"
                    CardBrand.AMEX -> "AMEX"
                    CardBrand.ELO -> "elo"
                    CardBrand.HIPERCARD -> "HIPERCARD"
                    else -> ""
                },
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                modifier = Modifier.align(Alignment.TopEnd)
            )
            
            // Número do cartão
            Text(
                text = cardNumber.ifEmpty { "•••• •••• •••• ••••" },
                color = Color.White,
                fontSize = 22.sp,
                fontWeight = FontWeight.Medium,
                letterSpacing = 2.sp,
                modifier = Modifier.align(Alignment.Center)
            )
            
            // Nome e validade
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomStart),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = "TITULAR",
                        color = Color.White.copy(alpha = 0.7f),
                        fontSize = 10.sp
                    )
                    Text(
                        text = cardholderName.ifEmpty { "SEU NOME AQUI" },
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
                
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "VALIDADE",
                        color = Color.White.copy(alpha = 0.7f),
                        fontSize = 10.sp
                    )
                    Text(
                        text = expirationDate.ifEmpty { "MM/AA" },
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
    }
}

/**
 * Ícone da bandeira do cartão
 */
@Composable
fun CardBrandIcon(brand: CardBrand) {
    val text = when (brand) {
        CardBrand.VISA -> "VISA"
        CardBrand.MASTERCARD -> "MC"
        CardBrand.AMEX -> "AMEX"
        CardBrand.ELO -> "ELO"
        CardBrand.HIPERCARD -> "HIPER"
        else -> ""
    }
    
    val color = when (brand) {
        CardBrand.VISA -> Color(0xFF1A1F71)
        CardBrand.MASTERCARD -> Color(0xFFEB001B)
        CardBrand.AMEX -> Color(0xFF006FCF)
        CardBrand.ELO -> Color(0xFFFFCB05)
        CardBrand.HIPERCARD -> Color(0xFFB3131B)
        else -> Color.Gray
    }
    
    if (text.isNotEmpty()) {
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(4.dp))
                .background(color.copy(alpha = 0.1f))
                .padding(horizontal = 6.dp, vertical = 2.dp)
        ) {
            Text(
                text = text,
                color = color,
                fontWeight = FontWeight.Bold,
                fontSize = 10.sp
            )
        }
    }
}

/**
 * Seletor de parcelas
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InstallmentSelector(
    valor: Double,
    selectedInstallments: Int,
    onInstallmentsChange: (Int) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    
    val maxInstallments = when {
        valor >= 100 -> 12
        valor >= 50 -> 6
        valor >= 30 -> 3
        else -> 1
    }
    
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "Parcelas",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        
        Spacer(modifier = Modifier.height(4.dp))
        
        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = it }
        ) {
            OutlinedTextField(
                value = if (selectedInstallments == 1) {
                    "À vista - R$ ${String.format("%.2f", valor).replace(".", ",")}"
                } else {
                    "${selectedInstallments}x de R$ ${String.format("%.2f", valor / selectedInstallments).replace(".", ",")} sem juros"
                },
                onValueChange = {},
                readOnly = true,
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor()
            )
            
            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false }
            ) {
                (1..maxInstallments).forEach { installments ->
                    val text = if (installments == 1) {
                        "À vista - R$ ${String.format("%.2f", valor).replace(".", ",")}"
                    } else {
                        "${installments}x de R$ ${String.format("%.2f", valor / installments).replace(".", ",")} sem juros"
                    }
                    
                    DropdownMenuItem(
                        text = { Text(text) },
                        onClick = {
                            onInstallmentsChange(installments)
                            expanded = false
                        }
                    )
                }
            }
        }
    }
}
