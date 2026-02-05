package br.com.speedrota.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import br.com.speedrota.ui.screens.auth.LoginScreen
import br.com.speedrota.ui.screens.auth.RegisterScreen
import br.com.speedrota.ui.screens.auth.ForgotPasswordScreen
import br.com.speedrota.ui.screens.dashboard.DashboardScreen
import br.com.speedrota.ui.screens.home.HomeScreen
import br.com.speedrota.ui.screens.historico.HistoricoScreen
import br.com.speedrota.ui.screens.origem.OrigemScreen
import br.com.speedrota.ui.screens.destinos.DestinosScreen
import br.com.speedrota.ui.screens.rota.RotaScreen
import br.com.speedrota.ui.screens.planos.PlanosScreen
import br.com.speedrota.ui.screens.pagamento.PagamentoScreen
import br.com.speedrota.ui.screens.previsao.PrevisaoScreen
import br.com.speedrota.ui.screens.gamificacao.GamificacaoScreen
import br.com.speedrota.ui.screens.ecommerce.EcommerceScreen
import br.com.speedrota.ui.screens.qrcode.QrCodeScannerScreen

/**
 * NavHost principal do SpeedRota
 */
@Composable
fun SpeedRotaNavHost() {
    val navController = rememberNavController()
    
    NavHost(
        navController = navController,
        startDestination = Screen.Login.route
    ) {
        // Auth
        composable(Screen.Login.route) {
            LoginScreen(
                onNavigateToRegister = {
                    navController.navigate(Screen.Register.route)
                },
                onNavigateToForgotPassword = {
                    navController.navigate(Screen.ForgotPassword.route)
                },
                onLoginSuccess = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                }
            )
        }
        
        composable(Screen.Register.route) {
            RegisterScreen(
                onNavigateToLogin = {
                    navController.popBackStack()
                },
                onRegisterSuccess = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                }
            )
        }
        
        composable(Screen.ForgotPassword.route) {
            ForgotPasswordScreen(
                onBack = {
                    navController.popBackStack()
                },
                onSuccess = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                }
            )
        }
        
        // Main Flow
        composable(Screen.Home.route) {
            HomeScreen(
                onNovaRota = {
                    navController.navigate(Screen.Origem.route)
                },
                onHistorico = {
                    navController.navigate(Screen.Historico.route)
                },
                onDashboard = {
                    navController.navigate(Screen.Dashboard.route)
                },
                onPrevisao = {
                    navController.navigate(Screen.Previsao.route)
                },
                onGamificacao = {
                    navController.navigate(Screen.Gamificacao.route)
                },
                onEcommerce = {
                    navController.navigate(Screen.Ecommerce.route)
                },
                onQrCodeScanner = {
                    navController.navigate(Screen.QrCodeScanner.route)
                },
                onVerPlanos = {
                    navController.navigate(Screen.Planos.route)
                },
                onLogout = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }
        
        composable(Screen.Historico.route) {
            HistoricoScreen(
                onVoltar = {
                    navController.popBackStack()
                },
                onRotaSelecionada = { rotaId ->
                    navController.navigate(Screen.Rota.createRoute(rotaId))
                }
            )
        }
        
        // Dashboard Analytics
        composable(Screen.Dashboard.route) {
            DashboardScreen(
                onBack = {
                    navController.popBackStack()
                },
                onVerPlanos = {
                    navController.navigate(Screen.Planos.route)
                }
            )
        }
        
        // ML - Previsão de Demanda
        composable(Screen.Previsao.route) {
            PrevisaoScreen(
                onBack = {
                    navController.popBackStack()
                }
            )
        }
        
        // Gamificação
        composable(Screen.Gamificacao.route) {
            GamificacaoScreen(
                onBack = {
                    navController.popBackStack()
                }
            )
        }
        
        // E-commerce (VTEX + Shopify)
        composable(Screen.Ecommerce.route) {
            EcommerceScreen(
                onNavigateBack = {
                    navController.popBackStack()
                },
                onImportarDestinos = { pedidos ->
                    // TODO: Importar pedidos para destinos
                    navController.navigate(Screen.Destinos.route)
                }
            )
        }
        
        // QR Code Scanner
        composable(Screen.QrCodeScanner.route) {
            QrCodeScannerScreen(
                onNavigateBack = {
                    navController.popBackStack()
                },
                onImportarParadas = { chaves ->
                    // TODO: Importar NF-e como destinos
                    navController.navigate(Screen.Destinos.route)
                }
            )
        }
        
        composable(Screen.Origem.route) {
            OrigemScreen(
                onOrigemConfirmada = {
                    navController.navigate(Screen.Destinos.route)
                },
                onBack = {
                    navController.popBackStack()
                }
            )
        }
        
        composable(Screen.Destinos.route) {
            DestinosScreen(
                onCalcularRota = {
                    navController.navigate(Screen.Rota.createRoute())
                },
                onBack = {
                    navController.popBackStack()
                }
            )
        }
        
        composable(
            route = Screen.Rota.route,
            arguments = listOf(navArgument("rotaId") { 
                type = NavType.StringType
                nullable = true
                defaultValue = null
            })
        ) { backStackEntry ->
            val rotaId = backStackEntry.arguments?.getString("rotaId")
            RotaScreen(
                rotaId = rotaId,
                onNovaRota = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Home.route) { inclusive = true }
                    }
                },
                onBack = {
                    navController.popBackStack()
                }
            )
        }
        
        // Planos e Pagamento
        composable(Screen.Planos.route) {
            PlanosScreen(
                onSelecionarPlano = { plano ->
                    navController.navigate(Screen.Pagamento.createRoute(plano))
                },
                onBack = {
                    navController.popBackStack()
                }
            )
        }
        
        composable(
            route = Screen.Pagamento.route,
            arguments = listOf(navArgument("plano") { type = NavType.StringType })
        ) { backStackEntry ->
            val plano = backStackEntry.arguments?.getString("plano") ?: "PRO"
            PagamentoScreen(
                plano = plano,
                onPagamentoConfirmado = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Home.route) { inclusive = true }
                    }
                },
                onBack = {
                    navController.popBackStack()
                }
            )
        }
    }
}
