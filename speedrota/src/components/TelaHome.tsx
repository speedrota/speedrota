/**
 * @fileoverview Tela Home
 * 
 * DESIGN POR CONTRATO:
 * @pre Usuário autenticado com tipoUsuario definido
 * @post Exibe botões relevantes para o perfil do usuário
 * 
 * REGRAS:
 * - ENTREGADOR: Nova Rota, Histórico, Dashboard, Gamificação, QR Code
 * - GESTOR_FROTA: Gestão de Frota, E-commerce, Dashboard, Previsão
 */

import { useRouteStore } from '../store/routeStore';
import { useAuthStore } from '../store/authStore';

interface TelaHomeProps {
  onAbrirHistorico?: () => void;
}

export function TelaHome({ onAbrirHistorico }: TelaHomeProps) {
  const novaRota = useRouteStore((state) => state.novaRota);
  const carregarHistorico = useRouteStore((state) => state.carregarHistorico);
  const irPara = useRouteStore((state) => state.irPara);
  const { user } = useAuthStore();
  
  // Tipo do usuário (default: ENTREGADOR para compatibilidade)
  const tipoUsuario = user?.tipoUsuario || 'ENTREGADOR';
  const isEntregador = tipoUsuario === 'ENTREGADOR';
  const isGestorFrota = tipoUsuario === 'GESTOR_FROTA';

  const handleNovaRota = () => {
    novaRota();
  };

  const handleHistorico = () => {
    if (onAbrirHistorico) {
      onAbrirHistorico();
    } else {
      carregarHistorico();
    }
  };

  const handleDashboard = () => {
    irPara('dashboard');
  };

  const handleFrota = () => {
    irPara('menu-frota');
  };

  const handlePrevisao = () => {
    irPara('previsao');
  };

  const handleGamificacao = () => {
    irPara('gamificacao');
  };

  const handleEcommerce = () => {
    irPara('ecommerce');
  };

  const handleQrCode = () => {
    irPara('qrcode');
  };

  return (
    <div className="home-hero">
      <div className="home-brand">
        <img src="/logo.png" alt="SpeedRota" className="home-logo" />
      </div>
      <p className="home-subtitle">
        {isEntregador ? 'Suas entregas, uma rota inteligente' : 'Gerencie sua frota com eficiência'}
      </p>

      <div className="home-actions">
        {/* Botões para ENTREGADOR */}
        {isEntregador && (
          <>
            <button className="btn btn-primary btn-lg" onClick={handleNovaRota}>
              ➕ Nova Rota
            </button>

            <button className="btn btn-secondary" onClick={handleHistorico}>
              📋 Histórico de Rotas
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleDashboard}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none'
              }}
            >
              📊 Meu Dashboard
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleGamificacao}
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                color: 'white',
                border: 'none'
              }}
            >
              🎮 Conquistas
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleQrCode}
              style={{
                background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                color: 'white',
                border: 'none'
              }}
            >
              📱 QR Code NF-e
            </button>
          </>
        )}

        {/* Botões para GESTOR_FROTA */}
        {isGestorFrota && (
          <>
            {/* Nova Rota - também disponível para gestores */}
            <button className="btn btn-primary btn-lg" onClick={handleNovaRota}>
              ➕ Nova Rota
            </button>

            <button 
              className="btn btn-secondary"
              onClick={handleFrota}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none'
              }}
            >
              🚚 Gestão de Frota
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleDashboard}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none'
              }}
            >
              📊 Dashboard Analytics
            </button>

            <button
              className="btn btn-secondary"
              onClick={handlePrevisao}
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
                border: 'none'
              }}
            >
              🔮 Previsão de Demanda
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleEcommerce}
              style={{
                background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                color: 'white',
                border: 'none'
              }}
            >
              🛒 E-commerce
            </button>

            <button className="btn btn-secondary" onClick={handleHistorico}>
              📋 Histórico de Rotas
            </button>
          </>
        )}
      </div>

      <div className="mt-4 text-sm text-muted">
        {isEntregador ? (
          <>
            <p>✓ Capture origem via GPS ou manualmente</p>
            <p>✓ Extraia destinos de NF-e via OCR</p>
            <p>✓ Calcule a rota mais eficiente</p>
          </>
        ) : (
          <>
            <p>✓ Tire foto das notas → OCR extrai endereços</p>
            <p>✓ Gerencie motoristas e veículos</p>
            <p>✓ Distribua entregas automaticamente</p>
            <p>✓ Acompanhe métricas em tempo real</p>
          </>
        )}
      </div>
    </div>
  );
}
