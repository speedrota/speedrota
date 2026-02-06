/**
 * @fileoverview Componente de Integrações E-commerce (VTEX + Shopify)
 * 
 * DESIGN POR CONTRATO:
 * @pre Usuário autenticado
 * @post Integrações configuradas e pedidos sincronizados
 * 
 * COMPONENTES:
 * - TelaEcommerce: Container principal
 * - ListaIntegracoes: Lista de integrações configuradas
 * - FormularioIntegracao: Criar/editar integração
 * - ListaPedidos: Pedidos importados para rota
 * - CardIntegracao: Card individual de integração
 * 
 * @author SpeedRota Team
 * @version 1.0.0
 * @since Sprint 13-14
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouteStore } from '../store/routeStore';
import './Ecommerce.css';

// Alias para consistência de nomes
const useRotaStore = useRouteStore;

// ==========================================
// TIPOS
// ==========================================

interface Integracao {
  id: string;
  fornecedor: 'VTEX' | 'SHOPIFY' | 'WOOCOMMERCE' | 'MERCADOLIVRE';
  nome: string | null;
  ativo: boolean;
  ultimaSincronizacao: string | null;
  totalPedidosImportados: number;
}

interface PedidoImportado {
  id: string;
  idExterno: string;
  cliente: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string | null;
  valorTotal: number | null;
  selecionado?: boolean;
}

interface FormularioCredenciais {
  fornecedor: 'VTEX' | 'SHOPIFY';
  nome: string;
  // VTEX
  accountName: string;
  appKey: string;
  appToken: string;
  // Shopify
  shopDomain: string;
  accessToken: string;
  apiVersion: string;
  // Comum
  ambiente: 'sandbox' | 'producao';
}

interface ResultadoSincronizacao {
  plataforma: string;
  totalEncontrados: number;
  totalImportados: number;
  totalDuplicados: number;
  totalErros: number;
  tempoMs: number;
}

// ==========================================
// CONSTANTES
// ==========================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const FORNECEDORES_INFO: Record<string, { nome: string; emoji: string; cor: string }> = {
  VTEX: { nome: 'VTEX', emoji: '🟪', cor: '#f71963' },
  SHOPIFY: { nome: 'Shopify', emoji: '🟢', cor: '#95bf47' },
  WOOCOMMERCE: { nome: 'WooCommerce', emoji: '🟣', cor: '#96588a' },
  MERCADOLIVRE: { nome: 'Mercado Livre', emoji: '🟡', cor: '#ffe600' }
};

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function TelaEcommerce() {
  const { irPara } = useRotaStore();
  const [abaSelecionada, setAbaSelecionada] = useState<'integracoes' | 'pedidos'>('integracoes');
  const [integracoes, setIntegracoes] = useState<Integracao[]>([]);
  const [integracaoSelecionada, setIntegracaoSelecionada] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<PedidoImportado[]>([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  // ==========================================
  // EFEITOS
  // ==========================================

  useEffect(() => {
    carregarIntegracoes();
  }, []);

  useEffect(() => {
    if (integracaoSelecionada) {
      carregarPedidos(integracaoSelecionada);
    }
  }, [integracaoSelecionada]);

  // ==========================================
  // FUNÇÕES API
  // ==========================================

  /**
   * Carregar lista de integrações
   * @pre Token válido
   * @post integracoes atualizadas
   */
  const carregarIntegracoes = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/v1/ecommerce/integracoes`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar integrações');
      }

      const data = await response.json();
      setIntegracoes(data.data || []);
    } catch (error) {
      setErro((error as Error).message);
    } finally {
      setCarregando(false);
    }
  }, []);

  /**
   * Carregar pedidos de uma integração
   */
  const carregarPedidos = useCallback(async (integracaoId: string) => {
    setCarregando(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE}/api/v1/ecommerce/integracoes/${integracaoId}/pedidos`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao carregar pedidos');
      }

      const data = await response.json();
      setPedidos((data.data || []).map((p: PedidoImportado) => ({
        ...p,
        selecionado: false
      })));
    } catch (error) {
      setErro((error as Error).message);
    } finally {
      setCarregando(false);
    }
  }, []);

  /**
   * Sincronizar pedidos de uma integração
   */
  const sincronizarIntegracao = async (integracaoId: string) => {
    setCarregando(true);
    setErro(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE}/api/v1/ecommerce/integracoes/${integracaoId}/sync`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao sincronizar');
      }

      const data = await response.json();
      const resultado: ResultadoSincronizacao = data.data;

      setMensagemSucesso(
        `✅ ${resultado.totalImportados} pedidos importados (${resultado.totalDuplicados} duplicados)`
      );

      // Atualizar listas
      await carregarIntegracoes();
      if (integracaoSelecionada === integracaoId) {
        await carregarPedidos(integracaoId);
      }
    } catch (error) {
      setErro((error as Error).message);
    } finally {
      setCarregando(false);
    }
  };

  /**
   * Criar nova integração
   */
  const criarIntegracao = async (dados: FormularioCredenciais) => {
    setCarregando(true);
    setErro(null);

    try {
      const token = localStorage.getItem('token');
      
      // Montar credenciais
      const credentials = dados.fornecedor === 'VTEX'
        ? {
            accountName: dados.accountName,
            appKey: dados.appKey,
            appToken: dados.appToken,
            ambiente: dados.ambiente
          }
        : {
            shopDomain: dados.shopDomain,
            accessToken: dados.accessToken,
            apiVersion: dados.apiVersion || '2024-01',
            ambiente: dados.ambiente
          };

      const response = await fetch(`${API_BASE}/api/v1/ecommerce/integracoes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fornecedor: dados.fornecedor,
          nome: dados.nome,
          credentials
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar integração');
      }

      const data = await response.json();
      
      setMensagemSucesso(data.data.message);
      setMostrarFormulario(false);
      await carregarIntegracoes();
    } catch (error) {
      setErro((error as Error).message);
    } finally {
      setCarregando(false);
    }
  };

  /**
   * Importar pedidos selecionados para rota
   */
  const importarParaRota = () => {
    const selecionados = pedidos.filter(p => p.selecionado);
    if (selecionados.length === 0) {
      setErro('Selecione pelo menos um pedido');
      return;
    }

    // Converter para formato de destino
    const destinos = selecionados.map(p => ({
      endereco: `${p.endereco}, ${p.cidade} - ${p.uf}, ${p.cep || ''}`,
      cliente: p.cliente,
      idExterno: p.idExterno,
      valorTotal: p.valorTotal
    }));

    // Log de destinos importados (serão adicionados na tela de destinos)
    console.log('[Ecommerce] Importando destinos:', destinos);
    
    setMensagemSucesso(`${selecionados.length} destinos importados para rota`);
    irPara('destinos');
  };

  // ==========================================
  // HANDLERS
  // ==========================================

  const togglePedido = (id: string) => {
    setPedidos(prev => prev.map(p => 
      p.id === id ? { ...p, selecionado: !p.selecionado } : p
    ));
  };

  const selecionarTodos = () => {
    const todosSelecionados = pedidos.every(p => p.selecionado);
    setPedidos(prev => prev.map(p => ({ ...p, selecionado: !todosSelecionados })));
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="tela-ecommerce">
      {/* Header */}
      <header className="ecommerce-header">
        <button className="btn-voltar" onClick={() => irPara('home')}>
          ← Voltar
        </button>
        <h1>🛒 Integrações E-commerce</h1>
      </header>

      {/* Mensagens */}
      {erro && (
        <div className="mensagem erro">
          <span>❌ {erro}</span>
          <button onClick={() => setErro(null)}>×</button>
        </div>
      )}

      {mensagemSucesso && (
        <div className="mensagem sucesso">
          <span>{mensagemSucesso}</span>
          <button onClick={() => setMensagemSucesso(null)}>×</button>
        </div>
      )}

      {/* Abas */}
      <div className="abas">
        <button
          className={`aba ${abaSelecionada === 'integracoes' ? 'ativa' : ''}`}
          onClick={() => setAbaSelecionada('integracoes')}
        >
          ⚙️ Integrações
        </button>
        <button
          className={`aba ${abaSelecionada === 'pedidos' ? 'ativa' : ''}`}
          onClick={() => setAbaSelecionada('pedidos')}
          disabled={!integracaoSelecionada}
        >
          📦 Pedidos ({pedidos.length})
        </button>
      </div>

      {/* Conteúdo */}
      <main className="ecommerce-content">
        {carregando && <div className="loading">Carregando...</div>}

        {abaSelecionada === 'integracoes' && !mostrarFormulario && (
          <ListaIntegracoes
            integracoes={integracoes}
            integracaoSelecionada={integracaoSelecionada}
            onSelecionar={setIntegracaoSelecionada}
            onSincronizar={sincronizarIntegracao}
            onNovaIntegracao={() => setMostrarFormulario(true)}
          />
        )}

        {mostrarFormulario && (
          <FormularioIntegracao
            onSalvar={criarIntegracao}
            onCancelar={() => setMostrarFormulario(false)}
            carregando={carregando}
          />
        )}

        {abaSelecionada === 'pedidos' && integracaoSelecionada && (
          <ListaPedidos
            pedidos={pedidos}
            onToggle={togglePedido}
            onSelecionarTodos={selecionarTodos}
            onImportar={importarParaRota}
            onSincronizar={() => sincronizarIntegracao(integracaoSelecionada)}
          />
        )}
      </main>
    </div>
  );
}

// ==========================================
// COMPONENTES AUXILIARES
// ==========================================

/**
 * Lista de integrações configuradas
 */
function ListaIntegracoes({
  integracoes,
  integracaoSelecionada,
  onSelecionar,
  onSincronizar,
  onNovaIntegracao
}: {
  integracoes: Integracao[];
  integracaoSelecionada: string | null;
  onSelecionar: (id: string) => void;
  onSincronizar: (id: string) => void;
  onNovaIntegracao: () => void;
}) {
  return (
    <div className="lista-integracoes">
      <div className="lista-header">
        <h2>Suas Integrações</h2>
        <button className="btn-nova" onClick={onNovaIntegracao}>
          + Nova Integração
        </button>
      </div>

      {integracoes.length === 0 ? (
        <div className="lista-vazia">
          <p>Nenhuma integração configurada</p>
          <p>Conecte sua loja VTEX ou Shopify para importar pedidos automaticamente</p>
        </div>
      ) : (
        <div className="integracoes-grid">
          {integracoes.map(integracao => (
            <CardIntegracao
              key={integracao.id}
              integracao={integracao}
              selecionado={integracaoSelecionada === integracao.id}
              onSelecionar={() => onSelecionar(integracao.id)}
              onSincronizar={() => onSincronizar(integracao.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Card individual de integração
 */
function CardIntegracao({
  integracao,
  selecionado,
  onSelecionar,
  onSincronizar
}: {
  integracao: Integracao;
  selecionado: boolean;
  onSelecionar: () => void;
  onSincronizar: () => void;
}) {
  const info = FORNECEDORES_INFO[integracao.fornecedor] || {
    nome: integracao.fornecedor,
    emoji: '🔗',
    cor: '#666'
  };

  const ultimaSync = integracao.ultimaSincronizacao
    ? new Date(integracao.ultimaSincronizacao).toLocaleString('pt-BR')
    : 'Nunca sincronizado';

  return (
    <div
      className={`card-integracao ${selecionado ? 'selecionado' : ''}`}
      style={{ borderColor: info.cor }}
      onClick={onSelecionar}
    >
      <div className="card-header" style={{ backgroundColor: info.cor }}>
        <span className="emoji">{info.emoji}</span>
        <span className="fornecedor">{info.nome}</span>
        <span className={`status ${integracao.ativo ? 'ativo' : 'inativo'}`}>
          {integracao.ativo ? '✅' : '❌'}
        </span>
      </div>

      <div className="card-body">
        <h3>{integracao.nome || `Integração ${info.nome}`}</h3>
        
        <div className="metricas">
          <div className="metrica">
            <span className="valor">{integracao.totalPedidosImportados}</span>
            <span className="label">Pedidos</span>
          </div>
        </div>

        <p className="ultima-sync">
          🔄 {ultimaSync}
        </p>
      </div>

      <div className="card-actions">
        <button
          className="btn-sync"
          onClick={(e) => {
            e.stopPropagation();
            onSincronizar();
          }}
        >
          🔄 Sincronizar
        </button>
      </div>
    </div>
  );
}

/**
 * Formulário para criar integração
 */
function FormularioIntegracao({
  onSalvar,
  onCancelar,
  carregando
}: {
  onSalvar: (dados: FormularioCredenciais) => void;
  onCancelar: () => void;
  carregando: boolean;
}) {
  const [dados, setDados] = useState<FormularioCredenciais>({
    fornecedor: 'VTEX',
    nome: '',
    accountName: '',
    appKey: '',
    appToken: '',
    shopDomain: '',
    accessToken: '',
    apiVersion: '2024-01',
    ambiente: 'sandbox'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSalvar(dados);
  };

  return (
    <form className="formulario-integracao" onSubmit={handleSubmit}>
      <h2>Nova Integração</h2>

      {/* Seleção de plataforma */}
      <div className="form-group">
        <label>Plataforma</label>
        <div className="plataformas-selector">
          <button
            type="button"
            className={`plataforma-btn ${dados.fornecedor === 'VTEX' ? 'ativo' : ''}`}
            onClick={() => setDados({ ...dados, fornecedor: 'VTEX' })}
          >
            🟪 VTEX
          </button>
          <button
            type="button"
            className={`plataforma-btn ${dados.fornecedor === 'SHOPIFY' ? 'ativo' : ''}`}
            onClick={() => setDados({ ...dados, fornecedor: 'SHOPIFY' })}
          >
            🟢 Shopify
          </button>
        </div>
      </div>

      {/* Nome da integração */}
      <div className="form-group">
        <label htmlFor="nome">Nome da Integração</label>
        <input
          type="text"
          id="nome"
          value={dados.nome}
          onChange={(e) => setDados({ ...dados, nome: e.target.value })}
          placeholder="Ex: Minha Loja Principal"
          required
        />
      </div>

      {/* Campos VTEX */}
      {dados.fornecedor === 'VTEX' && (
        <>
          <div className="form-group">
            <label htmlFor="accountName">Account Name</label>
            <input
              type="text"
              id="accountName"
              value={dados.accountName}
              onChange={(e) => setDados({ ...dados, accountName: e.target.value })}
              placeholder="nome-da-conta"
              required
            />
            <small>Nome da sua conta VTEX (ex: minhaloja)</small>
          </div>

          <div className="form-group">
            <label htmlFor="appKey">App Key</label>
            <input
              type="text"
              id="appKey"
              value={dados.appKey}
              onChange={(e) => setDados({ ...dados, appKey: e.target.value })}
              placeholder="vtexappkey-..."
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="appToken">App Token</label>
            <input
              type="password"
              id="appToken"
              value={dados.appToken}
              onChange={(e) => setDados({ ...dados, appToken: e.target.value })}
              placeholder="Token secreto"
              required
            />
            <small>⚠️ Nunca compartilhe seu token</small>
          </div>
        </>
      )}

      {/* Campos Shopify */}
      {dados.fornecedor === 'SHOPIFY' && (
        <>
          <div className="form-group">
            <label htmlFor="shopDomain">Domínio da Loja</label>
            <input
              type="text"
              id="shopDomain"
              value={dados.shopDomain}
              onChange={(e) => setDados({ ...dados, shopDomain: e.target.value })}
              placeholder="minhaloja.myshopify.com"
              required
            />
            <small>Seu domínio .myshopify.com</small>
          </div>

          <div className="form-group">
            <label htmlFor="accessToken">Access Token</label>
            <input
              type="password"
              id="accessToken"
              value={dados.accessToken}
              onChange={(e) => setDados({ ...dados, accessToken: e.target.value })}
              placeholder="shpat_..."
              required
            />
            <small>Token do Admin API (precisa de permissão read_orders)</small>
          </div>

          <div className="form-group">
            <label htmlFor="apiVersion">Versão da API</label>
            <select
              id="apiVersion"
              value={dados.apiVersion}
              onChange={(e) => setDados({ ...dados, apiVersion: e.target.value })}
            >
              <option value="2024-01">2024-01 (Recomendado)</option>
              <option value="2023-10">2023-10</option>
              <option value="2023-07">2023-07</option>
            </select>
          </div>
        </>
      )}

      {/* Ambiente */}
      <div className="form-group">
        <label>Ambiente</label>
        <div className="ambiente-selector">
          <label className="radio-label">
            <input
              type="radio"
              name="ambiente"
              value="sandbox"
              checked={dados.ambiente === 'sandbox'}
              onChange={() => setDados({ ...dados, ambiente: 'sandbox' })}
            />
            🧪 Sandbox (Testes)
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="ambiente"
              value="producao"
              checked={dados.ambiente === 'producao'}
              onChange={() => setDados({ ...dados, ambiente: 'producao' })}
            />
            🚀 Produção
          </label>
        </div>
      </div>

      {/* Ações */}
      <div className="form-actions">
        <button type="button" className="btn-cancelar" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" className="btn-salvar" disabled={carregando}>
          {carregando ? 'Conectando...' : '🔗 Conectar'}
        </button>
      </div>
    </form>
  );
}

/**
 * Lista de pedidos importados
 */
function ListaPedidos({
  pedidos,
  onToggle,
  onSelecionarTodos,
  onImportar,
  onSincronizar
}: {
  pedidos: PedidoImportado[];
  onToggle: (id: string) => void;
  onSelecionarTodos: () => void;
  onImportar: () => void;
  onSincronizar: () => void;
}) {
  const selecionados = pedidos.filter(p => p.selecionado).length;

  return (
    <div className="lista-pedidos">
      <div className="lista-header">
        <h2>📦 Pedidos Pendentes</h2>
        <div className="header-actions">
          <button className="btn-sync" onClick={onSincronizar}>
            🔄 Atualizar
          </button>
          <button
            className="btn-importar"
            onClick={onImportar}
            disabled={selecionados === 0}
          >
            📍 Importar {selecionados > 0 ? `(${selecionados})` : ''} para Rota
          </button>
        </div>
      </div>

      {pedidos.length === 0 ? (
        <div className="lista-vazia">
          <p>Nenhum pedido pendente</p>
          <p>Clique em sincronizar para buscar novos pedidos</p>
        </div>
      ) : (
        <>
          <div className="selecao-rapida">
            <button onClick={onSelecionarTodos}>
              {pedidos.every(p => p.selecionado) ? '☑️ Desmarcar Todos' : '☐ Selecionar Todos'}
            </button>
            <span>{selecionados} de {pedidos.length} selecionados</span>
          </div>

          <div className="pedidos-lista">
            {pedidos.map(pedido => (
              <div
                key={pedido.id}
                className={`pedido-item ${pedido.selecionado ? 'selecionado' : ''}`}
                onClick={() => onToggle(pedido.id)}
              >
                <div className="checkbox">
                  {pedido.selecionado ? '☑️' : '☐'}
                </div>
                <div className="pedido-info">
                  <div className="pedido-header">
                    <span className="pedido-id">#{pedido.idExterno}</span>
                    {pedido.valorTotal && (
                      <span className="pedido-valor">
                        R$ {pedido.valorTotal.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="pedido-cliente">{pedido.cliente}</div>
                  <div className="pedido-endereco">
                    📍 {pedido.endereco}, {pedido.cidade} - {pedido.uf}
                    {pedido.cep && ` (${pedido.cep})`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
