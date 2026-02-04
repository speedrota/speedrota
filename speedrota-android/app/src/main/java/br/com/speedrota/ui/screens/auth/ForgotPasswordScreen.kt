package br.com.speedrota.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel

/**
 * Tela de recuperação de senha
 * 
 * @description Fluxo de 3 etapas: email → código → nova senha
 * @pre Usuário registrado no sistema
 * @post Senha redefinida e usuário pode fazer login
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ForgotPasswordScreen(
    viewModel: ForgotPasswordViewModel = hiltViewModel(),
    onBack: () -> Unit,
    onSuccess: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val focusManager = LocalFocusManager.current

    // Navega de volta quando sucesso
    LaunchedEffect(uiState.step) {
        if (uiState.step == RecoveryStep.SUCCESS) {
            // Pequeno delay para mostrar mensagem de sucesso
            kotlinx.coroutines.delay(2000)
            onSuccess()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(24.dp)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Header com botão voltar
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (uiState.step != RecoveryStep.SUCCESS) {
                IconButton(
                    onClick = { 
                        if (uiState.step == RecoveryStep.EMAIL) {
                            onBack()
                        } else {
                            viewModel.voltar()
                        }
                    }
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Voltar"
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(32.dp))

        // Ícone e título
        when (uiState.step) {
            RecoveryStep.SUCCESS -> {
                Icon(
                    imageVector = Icons.Default.CheckCircle,
                    contentDescription = null,
                    tint = Color(0xFF22C55E),
                    modifier = Modifier.size(80.dp)
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Text(
                    text = "Senha Redefinida!",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF22C55E)
                )
                
                Spacer(modifier = Modifier.height(8.dp))
                
                Text(
                    text = "Sua senha foi alterada com sucesso.\nVocê será redirecionado para o login.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )
            }
            
            else -> {
                Text(
                    text = "🔐",
                    fontSize = 64.sp
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Text(
                    text = when (uiState.step) {
                        RecoveryStep.EMAIL -> "Esqueceu a senha?"
                        RecoveryStep.CODE -> "Verificar código"
                        RecoveryStep.NEW_PASSWORD -> "Nova senha"
                        else -> ""
                    },
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                
                Spacer(modifier = Modifier.height(8.dp))
                
                Text(
                    text = when (uiState.step) {
                        RecoveryStep.EMAIL -> "Digite seu email para receber o código de recuperação"
                        RecoveryStep.CODE -> "Digite o código de 6 dígitos enviado para ${uiState.email}"
                        RecoveryStep.NEW_PASSWORD -> "Digite sua nova senha"
                        else -> ""
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )
            }
        }
        
        Spacer(modifier = Modifier.height(32.dp))

        // Conteúdo por etapa
        when (uiState.step) {
            RecoveryStep.EMAIL -> EmailStep(
                email = uiState.email,
                onEmailChange = viewModel::onEmailChange,
                onSubmit = {
                    focusManager.clearFocus()
                    viewModel.solicitarCodigo()
                },
                isLoading = uiState.isLoading,
                error = uiState.error,
                focusManager = focusManager
            )
            
            RecoveryStep.CODE -> CodeStep(
                code = uiState.code,
                onCodeChange = viewModel::onCodeChange,
                onSubmit = {
                    focusManager.clearFocus()
                    viewModel.verificarCodigo()
                },
                onReenviar = viewModel::reenviarCodigo,
                isLoading = uiState.isLoading,
                error = uiState.error,
                focusManager = focusManager
            )
            
            RecoveryStep.NEW_PASSWORD -> NewPasswordStep(
                novaSenha = uiState.novaSenha,
                confirmarSenha = uiState.confirmarSenha,
                onNovaSenhaChange = viewModel::onNovaSenhaChange,
                onConfirmarSenhaChange = viewModel::onConfirmarSenhaChange,
                onSubmit = {
                    focusManager.clearFocus()
                    viewModel.redefinirSenha()
                },
                isLoading = uiState.isLoading,
                error = uiState.error,
                focusManager = focusManager
            )
            
            RecoveryStep.SUCCESS -> {
                // Nada mais a mostrar, apenas aguarda redirecionamento
                CircularProgressIndicator(
                    modifier = Modifier.padding(16.dp),
                    color = Color(0xFF22C55E)
                )
            }
        }
    }
}

// ==================== COMPONENTES DE CADA ETAPA ====================

@Composable
private fun EmailStep(
    email: String,
    onEmailChange: (String) -> Unit,
    onSubmit: () -> Unit,
    isLoading: Boolean,
    error: String?,
    focusManager: androidx.compose.ui.focus.FocusManager
) {
    OutlinedTextField(
        value = email,
        onValueChange = onEmailChange,
        label = { Text("Email") },
        leadingIcon = {
            Icon(Icons.Default.Email, contentDescription = null)
        },
        keyboardOptions = KeyboardOptions(
            keyboardType = KeyboardType.Email,
            imeAction = ImeAction.Done
        ),
        keyboardActions = KeyboardActions(
            onDone = {
                focusManager.clearFocus()
                onSubmit()
            }
        ),
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            unfocusedBorderColor = MaterialTheme.colorScheme.surfaceVariant
        )
    )
    
    ErrorMessage(error)
    
    Spacer(modifier = Modifier.height(24.dp))
    
    Button(
        onClick = onSubmit,
        enabled = !isLoading,
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary
        )
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(24.dp),
                color = MaterialTheme.colorScheme.onPrimary
            )
        } else {
            Text(
                text = "Enviar código",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun CodeStep(
    code: String,
    onCodeChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onReenviar: () -> Unit,
    isLoading: Boolean,
    error: String?,
    focusManager: androidx.compose.ui.focus.FocusManager
) {
    OutlinedTextField(
        value = code,
        onValueChange = onCodeChange,
        label = { Text("Código de 6 dígitos") },
        placeholder = { Text("000000") },
        keyboardOptions = KeyboardOptions(
            keyboardType = KeyboardType.Number,
            imeAction = ImeAction.Done
        ),
        keyboardActions = KeyboardActions(
            onDone = {
                focusManager.clearFocus()
                onSubmit()
            }
        ),
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
        textStyle = LocalTextStyle.current.copy(
            textAlign = TextAlign.Center,
            letterSpacing = 8.sp,
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold
        ),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            unfocusedBorderColor = MaterialTheme.colorScheme.surfaceVariant
        )
    )
    
    ErrorMessage(error)
    
    Spacer(modifier = Modifier.height(16.dp))
    
    TextButton(onClick = onReenviar, enabled = !isLoading) {
        Text(
            text = "Reenviar código",
            color = MaterialTheme.colorScheme.primary
        )
    }
    
    Spacer(modifier = Modifier.height(16.dp))
    
    Button(
        onClick = onSubmit,
        enabled = !isLoading && code.length == 6,
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary
        )
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(24.dp),
                color = MaterialTheme.colorScheme.onPrimary
            )
        } else {
            Text(
                text = "Verificar",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun NewPasswordStep(
    novaSenha: String,
    confirmarSenha: String,
    onNovaSenhaChange: (String) -> Unit,
    onConfirmarSenhaChange: (String) -> Unit,
    onSubmit: () -> Unit,
    isLoading: Boolean,
    error: String?,
    focusManager: androidx.compose.ui.focus.FocusManager
) {
    var senhaVisivel by remember { mutableStateOf(false) }
    var confirmarVisivel by remember { mutableStateOf(false) }
    
    // Nova senha
    OutlinedTextField(
        value = novaSenha,
        onValueChange = onNovaSenhaChange,
        label = { Text("Nova senha") },
        leadingIcon = {
            Icon(Icons.Default.Lock, contentDescription = null)
        },
        trailingIcon = {
            IconButton(onClick = { senhaVisivel = !senhaVisivel }) {
                Icon(
                    imageVector = if (senhaVisivel) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                    contentDescription = if (senhaVisivel) "Ocultar" else "Mostrar"
                )
            }
        },
        visualTransformation = if (senhaVisivel) VisualTransformation.None else PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(
            keyboardType = KeyboardType.Password,
            imeAction = ImeAction.Next
        ),
        keyboardActions = KeyboardActions(
            onNext = { focusManager.moveFocus(FocusDirection.Down) }
        ),
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
        supportingText = {
            Text("Mínimo de 6 caracteres")
        },
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            unfocusedBorderColor = MaterialTheme.colorScheme.surfaceVariant
        )
    )
    
    Spacer(modifier = Modifier.height(16.dp))
    
    // Confirmar senha
    OutlinedTextField(
        value = confirmarSenha,
        onValueChange = onConfirmarSenhaChange,
        label = { Text("Confirmar senha") },
        leadingIcon = {
            Icon(Icons.Default.Lock, contentDescription = null)
        },
        trailingIcon = {
            IconButton(onClick = { confirmarVisivel = !confirmarVisivel }) {
                Icon(
                    imageVector = if (confirmarVisivel) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                    contentDescription = if (confirmarVisivel) "Ocultar" else "Mostrar"
                )
            }
        },
        visualTransformation = if (confirmarVisivel) VisualTransformation.None else PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(
            keyboardType = KeyboardType.Password,
            imeAction = ImeAction.Done
        ),
        keyboardActions = KeyboardActions(
            onDone = {
                focusManager.clearFocus()
                onSubmit()
            }
        ),
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            unfocusedBorderColor = MaterialTheme.colorScheme.surfaceVariant
        )
    )
    
    ErrorMessage(error)
    
    Spacer(modifier = Modifier.height(24.dp))
    
    Button(
        onClick = onSubmit,
        enabled = !isLoading && novaSenha.length >= 6 && confirmarSenha.isNotEmpty(),
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary
        )
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(24.dp),
                color = MaterialTheme.colorScheme.onPrimary
            )
        } else {
            Text(
                text = "Redefinir senha",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun ErrorMessage(error: String?) {
    if (error != null) {
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = error,
            color = MaterialTheme.colorScheme.error,
            style = MaterialTheme.typography.bodySmall,
            textAlign = TextAlign.Center
        )
    }
}
