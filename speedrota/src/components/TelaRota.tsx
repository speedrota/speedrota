/**
 * @fileoverview Tela de Resultado da Rota Otimizada
 * 
 * Exibe:
 * - Mapa com rota
 * - Métricas (distância, tempo, custo)
 * - Lista de paradas ordenadas com distâncias entre pontos
 * - Distância de retorno
 * - Total de km da rota
 */

import { useRouteStore } from '../store/routeStore';
import { MapaRota } from './Mapa';
import { formatarDistancia, formatarTempo, formatarMoeda } from '../utils/calculos';

export function TelaRota() {
  const { 
    rotaOtimizada, 
    pontoRetorno,
    incluirRetorno, 
    alternarRetorno,
    irPara,
    novaRota
  } = useRouteStore();
  
  if (!rotaOtimizada) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🗺️</div>
        <div className="empty-state-text">
          Nenhuma rota calculada.<br />
          Adicione origem e destinos primeiro.
        </div>
        <button className="btn btn-primary mt-2" onClick={() => irPara('origem')}>
          Iniciar Nova Rota
        </button>
      </div>
    );
  }
  
  const { origem, paradas, metricas, predicoes, distanciaRetornoKm } = rotaOtimizada;
  const destinoRetorno = rotaOtimizada.pontoRetorno || pontoRetorno || origem;
  
  // Abrir navegação externa
  const handleIniciarNavegacao = () => {
    if (paradas.length === 0) return;
    
    // Construir URL do Google Maps com waypoints
    const destino = paradas[paradas.length - 1];
    const waypoints = paradas.slice(0, -1).map(p => `${p.lat},${p.lng}`).join('|');
    
    let url = `https://www.google.com/maps/dir/${origem.lat},${origem.lng}`;
    
    if (waypoints) {
      url += `/${waypoints}`;
    }
    
    url += `/${destino.lat},${destino.lng}`;
    
    // Adicionar retorno se habilitado
    if (incluirRetorno && destinoRetorno) {
      url += `/${destinoRetorno.lat},${destinoRetorno.lng}`;
    }
    
    window.open(url, '_blank');
  };

  const handleIniciarWaze = () => {
    if (paradas.length === 0) return;
    
    // Waze aceita apenas um destino por vez
    // Vamos abrir para o primeiro destino da rota
    const primeiroDestino = paradas[0];
    
    // URL do Waze com coordenadas
    // Formato: https://waze.com/ul?ll=LAT,LNG&navigate=yes
    const url = `https://waze.com/ul?ll=${primeiroDestino.lat},${primeiroDestino.lng}&navigate=yes`;
    
    window.open(url, '_blank');
  };
  
  // Compartilhar rota via WhatsApp
  const handleCompartilharWhatsApp = () => {
    const hoje = new Date().toLocaleDateString('pt-BR');
    
    // Construir mensagem formatada
    let mensagem = `🚚 *Rota do dia - SpeedRota*\n`;
    mensagem += `📅 ${hoje}\n`;
    mensagem += `📍 ${paradas.length} entregas | ${formatarDistancia(metricas.distanciaTotalKm)} | ~${formatarTempo(metricas.tempoAjustadoMin)}\n\n`;
    
    // Origem
    mensagem += `📌 *Origem:* ${origem.endereco || 'Localização atual'}\n\n`;
    
    // Lista de paradas
    mensagem += `*Entregas:*\n`;
    paradas.forEach((parada, index) => {
      const prioridade = parada.prioridade === 'ALTA' ? '🔴' : parada.prioridade === 'BAIXA' ? '🟢' : '';
      const janela = parada.janelaInicio && parada.janelaFim ? ` ⏰${parada.janelaInicio}-${parada.janelaFim}` : '';
      mensagem += `${index + 1}️⃣ ${prioridade}${parada.nome}${janela}\n`;
      mensagem += `   📍 ${parada.endereco}\n`;
      if (parada.telefone) {
        mensagem += `   📞 ${parada.telefone}\n`;
      }
    });
    
    // Retorno
    if (incluirRetorno && destinoRetorno) {
      mensagem += `\n🔄 *Retorno:* ${destinoRetorno.endereco || 'Origem'}\n`;
    }
    
    // Métricas
    mensagem += `\n💰 Custo estimado: ${formatarMoeda(metricas.custoR$)}`;
    mensagem += `\n⛽ Combustível: ${metricas.combustivelL.toFixed(1)}L`;
    
    // Footer
    mensagem += `\n\n_Rota otimizada por SpeedRota_ 🚀`;
    mensagem += `\nhttps://speedrota.com.br`;
    
    // Abrir WhatsApp com mensagem
    const url = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
  };
  
  // Gerar URL do Waze com todos os destinos (abre sequencialmente)
  const gerarLinksWaze = () => {
    const links: { nome: string; url: string }[] = [];
    
    paradas.forEach((parada, index) => {
      links.push({
        nome: `${index + 1}. ${parada.nome}`,
        url: `https://waze.com/ul?ll=${parada.lat},${parada.lng}&navigate=yes`
      });
    });
    
    // Adicionar retorno se habilitado
    if (incluirRetorno && destinoRetorno) {
      links.push({
        nome: `${paradas.length + 1}. Retorno (Origem)`,
        url: `https://waze.com/ul?ll=${destinoRetorno.lat},${destinoRetorno.lng}&navigate=yes`
      });
    }
    
    return links;
  };
  
  return (
    <div>
      {/* Alertas */}
      {predicoes?.alertas && predicoes.alertas.length > 0 && (
        <div className="mb-2">
          {predicoes.alertas.map((alerta, i) => (
            <div key={i} className={`alerta alerta-${alerta.tipo}`}>
              <span className="alerta-icon">
                {alerta.tipo === 'warning' ? '⚠️' : alerta.tipo === 'error' ? '❌' : 'ℹ️'}
              </span>
              <div className="alerta-content">
                <div className="alerta-mensagem">{alerta.mensagem}</div>
                {alerta.acao && (
                  <div className="alerta-acao">{alerta.acao}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Mapa */}
      <MapaRota 
        origem={origem} 
        paradas={paradas} 
        incluiRetorno={incluirRetorno}
      />
      
      {/* Métricas Principais */}
      <div className="metricas-grid">
        <div className="metrica-card metrica-destaque">
          <div className="metrica-valor">{formatarDistancia(metricas.distanciaTotalKm)}</div>
          <div className="metrica-label">TOTAL DA ROTA</div>
        </div>
        <div className="metrica-card">
          <div className="metrica-valor">{formatarTempo(metricas.tempoAjustadoMin)}</div>
          <div className="metrica-label">Tempo Total</div>
        </div>
        <div className="metrica-card">
          <div className="metrica-valor">{metricas.combustivelL.toFixed(1)}L</div>
          <div className="metrica-label">Combustível</div>
        </div>
        <div className="metrica-card">
          <div className="metrica-valor">{formatarMoeda(metricas.custoR$)}</div>
          <div className="metrica-label">Custo Est.</div>
        </div>
      </div>
      
      {/* Opção de retorno */}
      <div className="toggle-group">
        <input
          type="checkbox"
          className="toggle-input"
          id="incluirRetorno"
          checked={incluirRetorno}
          onChange={alternarRetorno}
        />
        <label className="toggle-label" htmlFor="incluirRetorno">
          Incluir retorno ao ponto final
        </label>
      </div>
      
      {/* Lista de paradas com distâncias */}
      <div className="card mb-2">
        <div className="card-header">📍 Roteiro de Entregas</div>
        <div className="card-body">
          <div className="roteiro-list">
            {/* Origem */}
            <div className="roteiro-item roteiro-origem">
              <div className="roteiro-numero">📍</div>
              <div className="roteiro-content">
                <div className="roteiro-titulo">PARTIDA</div>
                <div className="roteiro-endereco">{origem.endereco}</div>
              </div>
              <div className="roteiro-km"></div>
            </div>
            
            {/* Paradas */}
            {paradas.map((parada) => (
              <div key={parada.id}>
                {/* Distância do trecho */}
                <div className="roteiro-distancia">
                  <div className="roteiro-linha"></div>
                  <div className="roteiro-km-trecho">
                    {formatarDistancia(parada.distanciaAnterior)}
                  </div>
                  <div className="roteiro-linha"></div>
                </div>
                
                {/* Parada */}
                <div className="roteiro-item">
                  <div className="roteiro-numero">{parada.ordem}</div>
                  <div className="roteiro-content">
                    <div className="roteiro-titulo">{parada.nome}</div>
                    <div className="roteiro-endereco">
                      {parada.endereco}, {parada.cidade}-{parada.uf}
                    </div>
                    <div className="roteiro-meta">
                      <span>📏 {formatarDistancia(parada.distanciaAcumulada)} acumulados</span>
                      {parada.horarioChegada && (
                        <span>🕐 ~{parada.horarioChegada}</span>
                      )}
                    </div>
                    {parada.referencia && (
                      <div className="roteiro-ref">📍 {parada.referencia}</div>
                    )}
                    {parada.telefone && (
                      <div className="roteiro-ref">📞 {parada.telefone}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Retorno */}
            {incluirRetorno && paradas.length > 0 && (
              <>
                <div className="roteiro-distancia">
                  <div className="roteiro-linha"></div>
                  <div className="roteiro-km-trecho roteiro-km-retorno">
                    {formatarDistancia(distanciaRetornoKm)}
                  </div>
                  <div className="roteiro-linha"></div>
                </div>
                
                <div className="roteiro-item roteiro-retorno">
                  <div className="roteiro-numero">🏁</div>
                  <div className="roteiro-content">
                    <div className="roteiro-titulo">RETORNO</div>
                    <div className="roteiro-endereco">{destinoRetorno.endereco}</div>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {/* Total da rota */}
          <div className="roteiro-total">
            <div className="roteiro-total-label">DISTÂNCIA TOTAL DA ROTA:</div>
            <div className="roteiro-total-valor">{formatarDistancia(metricas.distanciaTotalKm)}</div>
          </div>
        </div>
      </div>
      
      {/* Detalhes das métricas */}
      <div className="card mb-2">
        <div className="card-header">📊 Detalhes</div>
        <div className="card-body">
          <p><strong>Entregas:</strong> {paradas.length}</p>
          <p><strong>Tempo de viagem:</strong> {formatarTempo(metricas.tempoViagemMin)}</p>
          <p><strong>Tempo em entregas:</strong> {formatarTempo(metricas.tempoEntregasMin)} ({paradas.length} × 5min)</p>
          <p><strong>Fator de tráfego:</strong> {metricas.fatorTrafego}x {metricas.fatorTrafego > 1 ? '(horário de pico)' : ''}</p>
          {predicoes && (
            <p><strong>Eficiência da rota:</strong> {predicoes.eficiencia.toFixed(0)}%</p>
          )}
        </div>
      </div>
      
      {/* Ações */}
      <button 
        className="btn btn-primary btn-lg mb-2"
        onClick={handleIniciarNavegacao}
      >
        🧭 Iniciar Navegação (Google Maps)
      </button>
      
      <button 
        className="btn btn-waze btn-lg mb-2"
        onClick={handleIniciarWaze}
      >
        🚗 Iniciar Navegação (Waze)
      </button>
      
      {/* Compartilhar WhatsApp */}
      <button 
        className="btn btn-whatsapp btn-lg mb-2"
        onClick={handleCompartilharWhatsApp}
        style={{ backgroundColor: '#25D366', color: 'white' }}
      >
        📲 Compartilhar no WhatsApp
      </button>
      
      {/* Links individuais Waze */}
      {paradas.length > 1 && (
        <div className="card mb-2">
          <div className="card-header">🚗 Links Waze (por destino)</div>
          <div className="card-body">
            <p className="text-muted text-sm mb-1">Waze aceita um destino por vez. Use os links abaixo:</p>
            {gerarLinksWaze().map((link, i) => (
              <a 
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="waze-link"
              >
                {link.nome}
              </a>
            ))}
          </div>
        </div>
      )}
      
      <button 
        className="btn btn-secondary mb-2"
        onClick={() => irPara('destinos')}
      >
        ← Editar Destinos
      </button>
      
      <button 
        className="btn btn-secondary"
        onClick={novaRota}
      >
        ➕ Nova Rota
      </button>
    </div>
  );
}
