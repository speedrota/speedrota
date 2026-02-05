/**
 * @fileoverview Componentes do Modo Simples do Dashboard
 *
 * FILOSOFIA:
 * - Linguagem simples e direta
 * - Foco em R$ (quanto economizou/gastou)
 * - Emojis e cores para comunicação visual
 * - Responde às 3 perguntas do entregador:
 *   1. "Quanto eu economizei?"
 *   2. "Qual fornecedor me dá mais dinheiro?"
 *   3. "Estou melhorando ou piorando?"
 */

import './ModoSimples.css';

// ==========================================
// Card Principal: Economia
// ==========================================

interface CardEconomiaProps {
  valorEconomizado: number;
  kmEconomizados: number;
  periodo: string;
}

export function CardEconomia({ valorEconomizado, kmEconomizados, periodo }: CardEconomiaProps) {
  return (
    <div className="card-economia">
      <div className="card-economia-emoji">💰</div>
      <div className="card-economia-label">Você economizou</div>
      <div className="card-economia-valor">
        R$ {valorEconomizado.toFixed(2).replace('.', ',')}
      </div>
      <div className="card-economia-sub">
        {kmEconomizados > 0 
          ? `${kmEconomizados.toFixed(1)} km a menos ${periodo}! 🎉`
          : `${periodo}! 🎉`
        }
      </div>
    </div>
  );
}

// ==========================================
// Card: Você está melhorando?
// ==========================================

interface CardMelhoriaProps {
  percentual: number;
  estaMelhorando: boolean;
  periodo: string;
}

export function CardMelhoria({ percentual, estaMelhorando, periodo }: CardMelhoriaProps) {
  const emoji = estaMelhorando ? '📈' : '📉';
  const texto = estaMelhorando ? 'Você está melhorando!' : 'Atenção: você pode melhorar!';
  const subtexto = estaMelhorando
    ? `↑ ${percentual.toFixed(0)}% ${periodo}`
    : `↓ ${percentual.toFixed(0)}% - vamos reverter isso!`;

  return (
    <div className={`card-melhoria ${estaMelhorando ? 'positivo' : 'negativo'}`}>
      <span className="card-melhoria-emoji">{emoji}</span>
      <div className="card-melhoria-content">
        <div className="card-melhoria-titulo">{texto}</div>
        <div className="card-melhoria-subtexto">{subtexto}</div>
      </div>
    </div>
  );
}

// ==========================================
// Card: Suas Entregas
// ==========================================

interface CardEntregasProps {
  entregasHoje: number;
  entregasSemana: number;
  taxaSucesso: number;
}

export function CardEntregas({ entregasHoje, entregasSemana, taxaSucesso }: CardEntregasProps) {
  const corSucesso = taxaSucesso >= 90 ? 'var(--success)' : 'var(--warning)';
  const mensagem = taxaSucesso >= 95 ? '🏆 Excelente!' : null;

  return (
    <div className="card-entregas">
      <div className="card-entregas-header">📦 Suas Entregas</div>
      <div className="card-entregas-grid">
        <div className="card-entregas-item">
          <div className="card-entregas-valor" style={{ color: 'var(--primary)' }}>
            {entregasHoje}
          </div>
          <div className="card-entregas-label">hoje</div>
        </div>
        <div className="card-entregas-divider" />
        <div className="card-entregas-item">
          <div className="card-entregas-valor" style={{ color: 'var(--primary)' }}>
            {entregasSemana}
          </div>
          <div className="card-entregas-label">semana</div>
        </div>
        <div className="card-entregas-divider" />
        <div className="card-entregas-item">
          <div className="card-entregas-valor" style={{ color: corSucesso }}>
            {taxaSucesso.toFixed(0)}%
          </div>
          <div className="card-entregas-label">sucesso</div>
        </div>
      </div>
      {mensagem && <div className="card-entregas-mensagem">{mensagem}</div>}
    </div>
  );
}

// ==========================================
// Card: Ranking de Fornecedores
// ==========================================

interface FornecedorRanking {
  posicao: number;
  nome: string;
  mediaValor: number;
}

interface CardRankingProps {
  fornecedores: FornecedorRanking[];
}

export function CardRanking({ fornecedores }: CardRankingProps) {
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="card-ranking">
      <div className="card-ranking-header">
        <div className="card-ranking-titulo">🏆 Seus Melhores Fornecedores</div>
        <div className="card-ranking-subtitulo">Qual te dá mais retorno por entrega</div>
      </div>
      <div className="card-ranking-lista">
        {fornecedores.map((fornecedor) => (
          <div key={fornecedor.nome} className="card-ranking-item">
            <span className="card-ranking-medal">{medals[fornecedor.posicao - 1]}</span>
            <div className="card-ranking-info">
              <div className="card-ranking-nome">{fornecedor.nome}</div>
            </div>
            <div className="card-ranking-valor">
              <div className="card-ranking-rs">
                R$ {fornecedor.mediaValor.toFixed(2).replace('.', ',')}
              </div>
              <div className="card-ranking-porentrega">por entrega</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// Card: Dica do Dia
// ==========================================

interface CardDicaProps {
  titulo: string;
  texto: string;
}

export function CardDica({ titulo, texto }: CardDicaProps) {
  return (
    <div className="card-dica">
      <span className="card-dica-emoji">🎯</span>
      <div className="card-dica-content">
        <div className="card-dica-titulo">{titulo}</div>
        <div className="card-dica-texto">{texto}</div>
      </div>
    </div>
  );
}

// ==========================================
// Card: Upgrade (para FREE)
// ==========================================

interface CardUpgradeProps {
  texto: string;
  textoBotao: string;
  onUpgrade: () => void;
}

export function CardUpgrade({ texto, textoBotao, onUpgrade }: CardUpgradeProps) {
  return (
    <div className="card-upgrade" onClick={onUpgrade}>
      <span className="card-upgrade-emoji">⚡</span>
      <div className="card-upgrade-content">
        <div className="card-upgrade-titulo">{texto}</div>
        <div className="card-upgrade-subtitulo">
          Faça upgrade e veja tendências, gráficos e muito mais!
        </div>
      </div>
      <button className="card-upgrade-btn">{textoBotao}</button>
    </div>
  );
}

// ==========================================
// Toggle Modo Simples/Pro
// ==========================================

interface ToggleModoProps {
  modoSimples: boolean;
  onToggle: () => void;
}

export function ToggleModo({ modoSimples, onToggle }: ToggleModoProps) {
  return (
    <div className="toggle-modo">
      <span className={`toggle-modo-label ${modoSimples ? 'ativo' : ''}`}>Simples</span>
      <button
        className={`toggle-modo-switch ${!modoSimples ? 'pro' : ''}`}
        onClick={onToggle}
        aria-label={modoSimples ? 'Mudar para modo Pro' : 'Mudar para modo Simples'}
      >
        <span className="toggle-modo-thumb" />
      </button>
      <span className={`toggle-modo-label ${!modoSimples ? 'ativo' : ''}`}>Pro</span>
    </div>
  );
}
