/**
 * @description Tela de escolha: Carga já separada ou fazer separação
 * Para GESTOR_FROTA: Inclui seleção de motorista ou empresa destino
 * 
 * @pre Endereço de origem já definido
 * @post Navega para download de rotas prontas OU para tela de matching
 */

import { useState, useEffect, useRef } from 'react';
import { useRouteStore } from '../store/routeStore';
import { API_URL } from '../config';
import './EscolhaCarga.css';

// Tipo da empresa para seleção
interface EmpresaFrota {
  id: string;
  nome: string;
  cnpj?: string;
  totalMotoristas?: number;
}

// Tipo do motorista para seleção
interface MotoristaFrota {
  id: string;
  nome: string;
  telefone?: string;
  status: string;
  tipoMotorista: 'AUTONOMO' | 'AUTONOMO_PARCEIRO' | 'VINCULADO';
  empresa?: {
    id: string;
    nome: string;
  };
}

// Tipo de destino selecionado
type TipoDestino = 'motorista' | 'empresa' | null;

// Tipo do arquivo de rota exportada (.speedrota)
interface ArquivoRota {
  versao: string;
  exportadoEm: string;
  origem: {
    lat: number;
    lng: number;
    endereco: string;
  };
  paradas: {
    ordem: number;
    nome: string;
    endereco: string;
    cidade: string;
    uf: string;
    cep: string;
    lat: number;
    lng: number;
    telefone?: string;
    tagVisual?: string;
    tagCor?: number;
    pedido?: string;
    remessa?: string;
    itens?: number;
  }[];
}

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
  const { 
    irPara, 
    carregarRota, 
    definirOrigem, 
    adicionarDestino, 
    limparDestinos,
    setMotoristaSelecionado: setMotoristaStore,
    setEmpresaSelecionada: setEmpresaStore
  } = useRouteStore();
  const [rotasDisponiveis, setRotasDisponiveis] = useState<RotaPreparada[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [importandoSeparacao, setImportandoSeparacao] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const separacaoInputRef = useRef<HTMLInputElement>(null);
  
  // Estados para GESTOR_FROTA - seleção de motorista OU empresa
  const [isGestorFrota, setIsGestorFrota] = useState(false);
  const [tipoDestinoSelecionado, setTipoDestinoSelecionado] = useState<TipoDestino>(null);
  const [motoristas, setMotoristas] = useState<MotoristaFrota[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaFrota[]>([]);
  const [motoristaSelecionado, setMotoristaSelecionado] = useState<MotoristaFrota | null>(null);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<EmpresaFrota | null>(null);
  const [carregandoMotoristas, setCarregandoMotoristas] = useState(false);
  const [carregandoEmpresas, setCarregandoEmpresas] = useState(false);
  
  // Verificar se é GESTOR_FROTA e buscar dados
  useEffect(() => {
    const token = localStorage.getItem('speedrota_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.tipoUsuario === 'GESTOR_FROTA') {
          setIsGestorFrota(true);
          buscarMotoristas();
          buscarEmpresas();
        }
      } catch (e) {
        console.error('Erro ao parsear token:', e);
      }
    }
  }, []);
  
  // Buscar rotas preparadas ao carregar (ou quando seleciona motorista/empresa)
  useEffect(() => {
    const destinoSelecionado = motoristaSelecionado || empresaSelecionada;
    if (!isGestorFrota || destinoSelecionado) {
      buscarRotasPreparadas();
    }
  }, [motoristaSelecionado, empresaSelecionada, isGestorFrota]);
  
  async function buscarMotoristas() {
    setCarregandoMotoristas(true);
    try {
      const token = localStorage.getItem('speedrota_token');
      const res = await fetch(`${API_URL}/frota/motoristas/todos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setMotoristas(data.motoristas || []);
      }
    } catch (error) {
      console.error('Erro ao buscar motoristas:', error);
    } finally {
      setCarregandoMotoristas(false);
    }
  }
  
  async function buscarEmpresas() {
    setCarregandoEmpresas(true);
    try {
      const token = localStorage.getItem('speedrota_token');
      const res = await fetch(`${API_URL}/frota/empresas`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setEmpresas(data.empresas || data || []);
      }
    } catch (error) {
      console.error('Erro ao buscar empresas:', error);
    } finally {
      setCarregandoEmpresas(false);
    }
  }
  
  function selecionarMotorista(m: MotoristaFrota) {
    setMotoristaSelecionado(m);
    setEmpresaSelecionada(null);
    setTipoDestinoSelecionado('motorista');
    // Salvar na store global para TelaSeparacao
    setMotoristaStore({ id: m.id, nome: m.nome });
  }
  
  function selecionarEmpresa(e: EmpresaFrota) {
    setEmpresaSelecionada(e);
    setMotoristaSelecionado(null);
    setTipoDestinoSelecionado('empresa');
    // Salvar na store global para TelaSeparacao
    setEmpresaStore({ id: e.id, nome: e.nome });
  }
  
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
    // Todos vão para tela de Separação (Caixas → Notas → Matching → Resultado)
    // A diferença de comportamento (arquivo vs rota) é decidida na TelaSeparacao
    irPara('separacao');
  }
  
  // Função para importar arquivo .speedrota
  async function importarArquivoRota(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setImportando(true);
    setErro(null);
    
    try {
      const texto = await file.text();
      const dados: ArquivoRota = JSON.parse(texto);
      
      // Validar versão e estrutura
      if (!dados.versao || !dados.paradas || dados.paradas.length === 0) {
        throw new Error('Arquivo inválido ou sem paradas');
      }
      
      // Configurar origem
      if (dados.origem) {
        definirOrigem({
          lat: dados.origem.lat,
          lng: dados.origem.lng,
          endereco: dados.origem.endereco,
          fonte: 'manual', // Importação de arquivo é considerada entrada manual
          timestamp: new Date() // Timestamp da importação
        });
      }
      
      // Limpar destinos antigos e adicionar novos
      limparDestinos();
      
      for (const p of dados.paradas) {
        adicionarDestino({
          nome: p.nome,
          endereco: p.endereco,
          cidade: p.cidade,
          uf: p.uf,
          cep: p.cep || '',
          lat: p.lat,
          lng: p.lng,
          telefone: p.telefone,
          fornecedor: 'outro', // Fornecedor genérico para importação
          fonte: 'manual', // Importação de arquivo é considerada manual
          confianca: 1
        });
      }
      
      // Ir para a tela de rota
      irPara('rota');
    } catch (error) {
      console.error('Erro ao importar:', error);
      setErro('Erro ao importar arquivo. Verifique se é um arquivo .speedrota válido.');
    } finally {
      setImportando(false);
      // Limpar input para permitir selecionar mesmo arquivo novamente
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }
  
  function abrirSeletorArquivo() {
    fileInputRef.current?.click();
  }
  
  // Função para abrir diálogo de arquivo de separação
  async function abrirSeletorArquivoSeparacao() {
    // Tentar usar File System Access API para diálogo "Abrir"
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [{
            description: 'Arquivo de Separação',
            accept: { 'text/plain': ['.txt'] }
          }],
          multiple: false
        });
        const file = await handle.getFile();
        await processarArquivoSeparacao(file);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return; // Usuário cancelou
        console.warn('[EscolhaCarga] Fallback para input tradicional:', err);
      }
    }
    // Fallback: input tradicional
    separacaoInputRef.current?.click();
  }
  
  // Função para processar arquivo de separação
  async function processarArquivoSeparacao(file: File) {
    setImportandoSeparacao(true);
    setErro(null);
    
    try {
      const texto = await file.text();
      const linhas = texto.split('\n');
      
      // Parse do arquivo de separação
      // Formato: TAG: <tag> | Nome: <nome> | Endereço: <endereco> | CEP: <cep>
      const destinos: Array<{
        tag: string;
        nome: string;
        endereco: string;
        cep: string;
      }> = [];
      
      for (const linha of linhas) {
        if (linha.includes('TAG:') && linha.includes('Nome:') && linha.includes('Endereço:')) {
          const tagMatch = linha.match(/TAG:\s*([^|]+)/);
          const nomeMatch = linha.match(/Nome:\s*([^|]+)/);
          const enderecoMatch = linha.match(/Endereço:\s*([^|]+)/);
          const cepMatch = linha.match(/CEP:\s*([^|]+)/);
          
          if (tagMatch && nomeMatch && enderecoMatch) {
            destinos.push({
              tag: tagMatch[1].trim(),
              nome: nomeMatch[1].trim(),
              endereco: enderecoMatch[1].trim(),
              cep: cepMatch ? cepMatch[1].trim() : ''
            });
          }
        }
      }
      
      if (destinos.length === 0) {
        throw new Error('Nenhum destino encontrado no arquivo');
      }
      
      // Limpar destinos antigos e adicionar novos
      limparDestinos();
      
      for (const d of destinos) {
        adicionarDestino({
          nome: d.nome,
          endereco: d.endereco,
          cidade: '',
          uf: '',
          cep: d.cep,
          lat: 0, // Será geocodificado depois
          lng: 0,
          fornecedor: 'outro',
          fonte: 'manual',
          confianca: 1
        });
      }
      
      console.log(`[EscolhaCarga] Carregados ${destinos.length} destinos do arquivo de separação`);
      irPara('rota');
    } catch (error) {
      console.error('Erro ao processar arquivo de separação:', error);
      setErro('Erro ao processar arquivo de separação. Verifique o formato.');
    } finally {
      setImportandoSeparacao(false);
      if (separacaoInputRef.current) {
        separacaoInputRef.current.value = '';
      }
    }
  }
  
  // Handler para input file de separação (fallback)
  function handleSeparacaoFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      processarArquivoSeparacao(file);
    }
  }
  
  return (
    <div className="escolha-carga-container">
      <h2>📦 Preparação da Carga</h2>
      <p className="subtitulo">
        {isGestorFrota 
          ? 'Selecione o destino e prepare a carga'
          : 'A carga já foi separada pelo armazenista?'}
      </p>
      
      {/* GESTOR_FROTA: Seleção de motorista OU empresa */}
      {isGestorFrota && (
        <section className="secao-selecao-destino">
          <h3>🎯 Para quem é essa carga?</h3>
          
          {/* Tabs: Motorista / Empresa */}
          <div className="tabs-destino">
            <button 
              className={`tab-destino ${tipoDestinoSelecionado === 'motorista' || (!tipoDestinoSelecionado && motoristas.length > 0) ? 'active' : ''}`}
              onClick={() => setTipoDestinoSelecionado('motorista')}
            >
              🚗 Motorista
            </button>
            <button 
              className={`tab-destino ${tipoDestinoSelecionado === 'empresa' ? 'active' : ''}`}
              onClick={() => setTipoDestinoSelecionado('empresa')}
            >
              🏢 Empresa
            </button>
          </div>
          
          {/* Lista de Motoristas */}
          {(tipoDestinoSelecionado === 'motorista' || (!tipoDestinoSelecionado && motoristas.length > 0)) && (
            <div className="lista-destinos">
              {carregandoMotoristas ? (
                <div className="carregando">
                  <span className="spinner"></span>
                  Buscando motoristas...
                </div>
              ) : motoristas.length === 0 ? (
                <div className="sem-itens">
                  <p>Nenhum motorista cadastrado</p>
                  <button 
                    className="btn-cadastrar"
                    onClick={() => irPara('menu-frota')}
                  >
                    + Cadastrar Motorista
                  </button>
                </div>
              ) : (
                <>
                  {motoristas.map(m => (
                    <button
                      key={m.id}
                      className={`card-destino ${motoristaSelecionado?.id === m.id ? 'selecionado' : ''}`}
                      onClick={() => selecionarMotorista(m)}
                    >
                      <div className="destino-info">
                        <span className="destino-nome">{m.nome}</span>
                        <span className="destino-tipo">
                          {m.tipoMotorista === 'VINCULADO' 
                            ? `📦 ${m.empresa?.nome || 'Empresa'}`
                            : '🚗 Autônomo'}
                        </span>
                      </div>
                      <span className="destino-status">
                        {m.status === 'DISPONIVEL' ? '🟢' : m.status === 'EM_ROTA' ? '🔵' : '⚪'}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
          
          {/* Lista de Empresas */}
          {tipoDestinoSelecionado === 'empresa' && (
            <div className="lista-destinos">
              {carregandoEmpresas ? (
                <div className="carregando">
                  <span className="spinner"></span>
                  Buscando empresas...
                </div>
              ) : empresas.length === 0 ? (
                <div className="sem-itens">
                  <p>Nenhuma empresa cadastrada</p>
                  <button 
                    className="btn-cadastrar"
                    onClick={() => irPara('menu-frota')}
                  >
                    + Cadastrar Empresa
                  </button>
                </div>
              ) : (
                <>
                  {empresas.map(e => (
                    <button
                      key={e.id}
                      className={`card-destino ${empresaSelecionada?.id === e.id ? 'selecionado' : ''}`}
                      onClick={() => selecionarEmpresa(e)}
                    >
                      <div className="destino-info">
                        <span className="destino-nome">{e.nome}</span>
                        <span className="destino-tipo">
                          🏢 {e.cnpj || 'Empresa de Transporte'}
                        </span>
                      </div>
                      <span className="destino-status">
                        {e.totalMotoristas || 0} motoristas
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
          
          {/* Confirmação de seleção */}
          {motoristaSelecionado && (
            <div className="destino-selecionado-info">
              ✅ Preparando carga para: <strong>🚗 {motoristaSelecionado.nome}</strong>
            </div>
          )}
          {empresaSelecionada && (
            <div className="destino-selecionado-info">
              ✅ Preparando carga para: <strong>🏢 {empresaSelecionada.nome}</strong>
            </div>
          )}
        </section>
      )}
      
      {/* Bloquear opções até selecionar destino (se GESTOR_FROTA) */}
      {(!isGestorFrota || motoristaSelecionado || empresaSelecionada) && (
        <>
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
      
      {/* Opção 1.5: Importar arquivo de rota */}
      <section className="secao-importar-arquivo">
        <h3>📁 Importar Arquivo de Rota</h3>
        <p>Carregue um arquivo .speedrota exportado pelo gestor</p>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".speedrota,.json"
          onChange={importarArquivoRota}
          style={{ display: 'none' }}
        />
        
        <button 
          className="btn-importar-arquivo"
          onClick={abrirSeletorArquivo}
          disabled={importando}
        >
          {importando ? (
            <>
              <span className="spinner-small"></span>
              Importando...
            </>
          ) : (
            <>📂 Selecionar Arquivo .speedrota</>
          )}
        </button>
        
        {/* Carregar arquivo de separação */}
        <div style={{ marginTop: '12px' }}>
          <input
            ref={separacaoInputRef}
            type="file"
            accept=".txt"
            onChange={handleSeparacaoFileChange}
            style={{ display: 'none' }}
          />
          <button 
            className="btn-importar-arquivo"
            onClick={abrirSeletorArquivoSeparacao}
            disabled={importandoSeparacao}
            style={{ background: '#059669' }}
          >
            {importandoSeparacao ? (
              <>
                <span className="spinner-small"></span>
                Carregando...
              </>
            ) : (
              <>📋 Carregar Arquivo de Separação (.txt)</>
            )}
          </button>
        </div>
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
        </>
      )}
      
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
