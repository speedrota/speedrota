/**
 * @fileoverview UpgradePrompt - CTA para upgrade de plano
 */

interface UpgradePromptProps {
  planoAtual: string;
  recurso: string;
  planoNecessario: 'PRO' | 'FULL';
  onUpgrade?: () => void;
}

export function UpgradePrompt({
  planoAtual,
  recurso,
  planoNecessario,
  onUpgrade,
}: UpgradePromptProps) {
  return (
    <div className="upgrade-prompt">
      <h3>Desbloqueie {recurso}</h3>
      <p>
        Este recurso esta disponivel a partir do plano {planoNecessario}.
        Voce esta no plano {planoAtual}.
      </p>
      <button className="upgrade-prompt-btn" onClick={onUpgrade}>
        Fazer Upgrade para {planoNecessario}
      </button>
    </div>
  );
}

export default UpgradePrompt;
