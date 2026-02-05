/**
 * @fileoverview TelaDashboard - Seletor de dashboard baseado no plano
 *
 * DESIGN POR CONTRATO:
 * @pre Usuário autenticado
 * @post Renderiza dashboard apropriado para o plano do usuário
 * @invariant Plano FREE = DashboardEssencial, PRO = DashboardAvancado, FULL+ = DashboardCompleto
 */

import { useAuthStore } from '../../store/authStore';
import { DashboardEssencial } from './DashboardEssencial';
import { DashboardAvancado } from './DashboardAvancado';
import { DashboardCompleto } from './DashboardCompleto';

interface TelaDashboardProps {
  onAbrirPlanos?: () => void;
}

export function TelaDashboard({ onAbrirPlanos }: TelaDashboardProps) {
  const { user } = useAuthStore();
  const plano = user?.plano || 'FREE';

  // Renderiza dashboard baseado no plano
  switch (plano) {
    case 'FREE':
      return <DashboardEssencial onAbrirPlanos={onAbrirPlanos} />;
    case 'PRO':
      return <DashboardAvancado onAbrirPlanos={onAbrirPlanos} />;
    case 'FULL':
    case 'ENTERPRISE':
      return <DashboardCompleto />;
    default:
      return <DashboardEssencial onAbrirPlanos={onAbrirPlanos} />;
  }
}

export default TelaDashboard;
