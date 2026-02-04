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
    data object Origem : Screen("origem")
    data object Destinos : Screen("destinos")
    data object Rota : Screen("rota")
    data object Camera : Screen("camera")
    
    // Outros
    data object Planos : Screen("planos")
    data object Pagamento : Screen("pagamento/{plano}") {
        fun createRoute(plano: String) = "pagamento/$plano"
    }
    data object Perfil : Screen("perfil")
    data object Historico : Screen("historico")
}
