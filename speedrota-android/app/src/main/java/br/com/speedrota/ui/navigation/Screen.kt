package br.com.speedrota.ui.navigation

/**
 * Rotas de navegação do app
 */
sealed class Screen(val route: String) {
    // Auth
    data object Login : Screen("login")
    data object Register : Screen("register")
    data object ForgotPassword : Screen("forgot-password")
    
    // Main
    data object Home : Screen("home")
    data object MenuFrota : Screen("menu-frota") // Menu intermediário
    data object Frota : Screen("frota") // Motorista
    data object FrotaGestor : Screen("frota-gestor/{empresaId}") {
        fun createRoute(empresaId: String) = "frota-gestor/$empresaId"
    }
    data object Origem : Screen("origem")
    data object Destinos : Screen("destinos")
    data object Rota : Screen("rota?rotaId={rotaId}") {
        fun createRoute(rotaId: String? = null) = if (rotaId != null) "rota?rotaId=$rotaId" else "rota"
    }
    data object Camera : Screen("camera")
    
    // Analytics
    data object Dashboard : Screen("dashboard")
    
    // ML e Gamificação
    data object Previsao : Screen("previsao")
    data object Gamificacao : Screen("gamificacao")
    
    // E-commerce
    data object Ecommerce : Screen("ecommerce")
    
    // QR Code Scanner
    data object QrCodeScanner : Screen("qrcode-scanner")
    
    // Outros
    data object Planos : Screen("planos")
    data object Pagamento : Screen("pagamento/{plano}") {
        fun createRoute(plano: String) = "pagamento/$plano"
    }
    data object Perfil : Screen("perfil")
    data object Historico : Screen("historico")
}
