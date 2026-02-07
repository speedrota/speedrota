/**
 * @description Tela de escolha: Carga já separada ou fazer separação
 * Aparece após o motorista definir endereço de origem
 * 
 * @pre Endereço de origem já definido
 * @post Navega para download de rotas prontas OU para tela de matching
 */

import { useState, useEffect } from 'react';
import { useRouteStore } from '../store/routeStore';
import './EscolhaCarga.css';

interface RotaPreparada {
  id: string;
  nome?: string;
  preparadaEm: string;
  paradas: {
    id: string;
    nome: string;
    endereco: string;
    cidade: string;
    tagVisual: string | null;
    tagCor: number | null;
  }[];
  caixas: {
    id: string;
    pedido: string | null;
    remessa: string | null;
    destinatario: string | null;
    tagVisual: string | null;
    tagCor: number | null;
    numeroCaixa: number | null;
    totalCaixas: number | null;
  }[];
}

const CORES_TAG: Record<number, string> = {
  1: '#f97316', // Laranja
  2: '#22c55e', // Verde
  3: '#3b82f6', // Azul
  4: '#a855f7', // Roxo
  5: '#ec4899', // Pink
  6: '#eab308', // Amarelo
  7: '#14b8a6', // Teal
  8: '#f43f5e', // Vermelho
};

export function TelaEscolhaCarga() {
  const { irPara, carregarRota } = useRouteStore();
  const [rotasDisponiveis, setRotasDisponiveis] = useState<RotaPreparada[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  
  // Buscar rotas preparadas ao carregar
  useEffect(() => {
    buscarRotasPreparadas();
  }, []);
  
  async function buscarRotasPreparadas() {
    setCarregando(true);
    setErro(null);
    
    try {
      const token = localStorage.getItem('speedrota_token');
      const res = await fetch('/api/rotas/preparadas', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setRotasDisponiveis(data.rotas || []);
      } else {
        console.error('Erro ao buscar rotas preparadas');
      }
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setCarregando(false);
    }
  }
  
  async function baixarRota(rotaId: string) {
    setBaixando(rotaId);
    setErro(null);
    
    try {
      const token = localStorage.getItem('speedrota_token');
      const res = await fetch(`/api/rotas/${rotaId}/baixar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        await carregarRota(rotaId);
        // Ir direto para a rota (já calculada)
        irPara('rota');
      } else {
        const errData = await res.json();
        setErro(errData.error || 'Erro ao baixar rota');
      }
    } catch (error) {
      setErro('Erro de conexão ao baixar rota');
    } finally {
      setBaixando(null);
    }
  }
  
  function fazerSeparacaoManual() {
    // Ir para tela de destinos para fazer o processo completo
    irPara('destinos');
  }
  
  return (
    <div className="escolha-carga-container">
      <h2>📦 Preparação da Carga</h2>
      <p className="subtitulo">A carga já foi separada pelo armazenista?</p>
      
      {/* Opção 1: Rotas já preparadas */}
      <section className="secao-rotas-prontas">
        <h3>✅ Rotas Prontas para Carregar</h3>
        
        {carregando ? (
          <div className="carregando">
            <span className="spinner"></span>
            Buscando rotas preparadas...
          </div>
        ) : rotasDisponiveis.length > 0 ? (
          <div className="lista-rotas-prontas">
            {rotasDisponiveis.map(rota => (
              <div key={rota.id} className="card-rota-preparada">
                <div className="rota-header">
                  <span className="rota-data">
                    {new Date(rota.preparadaEm).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="rota-stats">
                    {rota.paradas.length} destinos • {rota.caixas.length} caixas
                  </span>
                </div>
                
                <div className="caixas-preview">
                  {rota.caixas.slice(0, 6).map(caixa => (
                    <span 
                      key={caixa.id} 
                      className="tag-caixa"
                      style={{ 
                        backgroundColor: caixa.tagCor ? CORES_TAG[caixa.tagCor] : '#6b7280',
                        color: 'white'
                      }}
                    >
                      {caixa.tagVisual || caixa.destinatario?.substring(0, 8)}
                    </span>
                  ))}
                  {rota.caixas.length > 6 && (
                    <span className="mais-caixas">+{rota.caixas.length - 6}</span>
                  )}
                </div>
                
                <button 
                  className="btn-baixar-rota"
                  onClick={() => baixarRota(rota.id)}
                  disabled={!!baixando}
                >
                  {baixando === rota.id ? (
                    <>
                      <span className="spinner-small"></span>
                      Baixando...
                    </>
                  ) : (
                    <>📥 Baixar Rota</>
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="sem-rotas">
            Nenhuma rota preparada disponível
          </div>
        )}
        
        {erro && (
          <div className="mensagem-erro">
            ⚠️ {erro}
          </div>
        )}
      </section>
      
      {/* Divider */}
      <div className="divider">
        <span>ou</span>
      </div>
      
      {/* Opção 2: Fazer separação manual */}
      <section className="secao-separacao-manual">
        <h3>📷 Fazer Separação Agora</h3>
        <p>Fotografe as notas e caixas para montar a rota</p>
        
        <button 
          className="btn-separacao-manual"
          onClick={fazerSeparacaoManual}
        >
          📷 Escanear Notas e Caixas
        </button>
      </section>
      
      {/* Botão voltar */}
      <button 
        className="btn-voltar"
        onClick={() => irPara('origem')}
      >
        ← Voltar para Origem
      </button>
    </div>
  );
}

export default TelaEscolhaCarga;
