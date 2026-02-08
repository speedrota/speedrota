/**
 * @fileoverview Store global da aplicação com Zustand
 * 
 * SEPARAÇÃO DE RESPONSABILIDADES:
 * - Estado: dados da aplicação
 * - Actions: mutações do estado
 * - Selectors: derivações do estado
 * 
 * SINCRONIZAÇÃO COM BACKEND:
 * - Se usuário autenticado: salva rotas no banco
 * - Se não autenticado: apenas local (sem persistência)
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { 
  AppState, 
  EtapaFluxo, 
  Origem, 
  Destino, 
  RotaOtimizada,
  DadosNFe
} from '../types';
import { otimizarRota } from '../utils/calculos';
import { geocodificarEndereco } from '../services/geolocalizacao';
import { validarParaCalculo, validarOrigem, validarDestino } from '../utils/validacao';
import { rotaService, type RotaAPI, type CreateParadaData } from '../services/rotas';
import { tokenManager } from '../services/api';

// ==========================================
// ESTADO INICIAL
// ==========================================

const estadoInicial: AppState = {
  etapaAtual: 'home',
  origem: null,
  pontoRetorno: null,
  destinos: [],
  rotaOtimizada: null,
  carregando: false,
  erro: null,
  incluirRetorno: true, // Padrão: incluir retorno
};

// ==========================================
// EXTENDED STATE PARA SINCRONIZAÇÃO
// ==========================================

interface SyncState {
  rotaAtualId: string | null;      // ID da rota no backend
  sincronizando: boolean;          // Se está salvando no backend
  ultimaSincronizacao: Date | null;
  rotasHistorico: RotaAPI[];       // Histórico de rotas do usuário
  // Separação de carga
  motoristaSelecionado: { id: string; nome: string; email?: string } | null;
  empresaSelecionada: { id: string; nome: string } | null;
}

// ==========================================
// INTERFACE DO STORE
// ==========================================

interface RouteStore extends AppState, SyncState {
  // Navegação
  irPara: (etapa: EtapaFluxo) => void;
  
  // Origem
  definirOrigem: (origem: Origem) => void;
  limparOrigem: () => void;
  
  // Ponto de Retorno
  definirPontoRetorno: (ponto: Origem) => void;
  limparPontoRetorno: () => void;
  
  // Destinos
  adicionarDestino: (destino: Omit<Destino, 'id'>) => void;
  adicionarDestinoDeNFe: (dados: DadosNFe) => Promise<void>;
  removerDestino: (id: string) => void;
  limparDestinos: () => void;
  
  // Rota
  calcularRota: () => Promise<void>;
  alternarRetorno: () => void;
  limparRota: () => void;
  
  // Sincronização com Backend
  sincronizarComBackend: () => Promise<void>;
  carregarHistorico: () => Promise<void>;
  carregarRota: (rotaId: string) => Promise<void>;
  finalizarRotaAtual: () => Promise<void>;
  
  // UI
  setCarregando: (carregando: boolean) => void;
  setErro: (erro: string | null) => void;
  
  // Separação de carga
  setMotoristaSelecionado: (motorista: { id: string; nome: string; email?: string } | null) => void;
  setEmpresaSelecionada: (empresa: { id: string; nome: string } | null) => void;
  
  // Reset
  novaRota: () => void;
}

// ==========================================
// HELPERS
// ==========================================

const isAuthenticated = () => !!tokenManager.getToken();

// ==========================================
// STORE
// ==========================================

export const useRouteStore = create<RouteStore>((set, get) => ({
  ...estadoInicial,
  
  // Sync state inicial
  rotaAtualId: null,
  sincronizando: false,
  ultimaSincronizacao: null,
  rotasHistorico: [],
  motoristaSelecionado: null,
  empresaSelecionada: null,
  
  // ----------------------------------------
  // NAVEGAÇÃO
  // ----------------------------------------
  
  irPara: (etapa) => {
    set({ etapaAtual: etapa, erro: null });
  },
  
  // ----------------------------------------
  // ORIGEM
  // ----------------------------------------
  
  definirOrigem: (origem) => {
    const validacao = validarOrigem(origem);
    
    if (!validacao.valido) {
      set({ erro: validacao.erro });
      return;
    }
    
    // Log de avisos se houver
    if (validacao.avisos) {
      console.warn('[Store] Avisos na origem:', validacao.avisos);
    }
    
    set({ 
      origem, 
      erro: null,
      // Limpar rota anterior se origem mudou
      rotaOtimizada: null 
    });
  },
  
  limparOrigem: () => {
    set({ origem: null, rotaOtimizada: null });
  },
  
  // ----------------------------------------
  // PONTO DE RETORNO
  // ----------------------------------------
  
  definirPontoRetorno: (ponto) => {
    const validacao = validarOrigem(ponto);
    
    if (!validacao.valido) {
      set({ erro: validacao.erro });
      return;
    }
    
    set({ 
      pontoRetorno: ponto, 
      erro: null,
      rotaOtimizada: null 
    });
  },
  
  limparPontoRetorno: () => {
    set({ pontoRetorno: null, rotaOtimizada: null });
  },
  
  // ----------------------------------------
  // DESTINOS
  // ----------------------------------------
  
  adicionarDestino: (destinoSemId) => {
    const destino: Destino = {
      ...destinoSemId,
      id: uuidv4(),
    };
    
    const validacao = validarDestino(destino);
    
    if (!validacao.valido) {
      set({ erro: validacao.erro });
      return;
    }
    
    set((state) => ({
      destinos: [...state.destinos, destino],
      erro: null,
      rotaOtimizada: null, // Limpar rota quando destinos mudam
    }));
    
    console.log(`[Store] Destino adicionado: ${destino.nome} (${destino.fonte})`);
  },
  
  adicionarDestinoDeNFe: async (dados) => {
    const { adicionarDestino, setCarregando, setErro } = get();
    
    setCarregando(true);
    
    try {
      // Montar endereço completo
      const enderecoCompleto = [
        dados.destinatario.endereco,
        dados.destinatario.numero,
        dados.destinatario.complemento,
        dados.destinatario.bairro,
      ].filter(Boolean).join(', ');
      
      // Geocodificar
      const geo = await geocodificarEndereco(
        enderecoCompleto,
        dados.destinatario.cidade,
        dados.destinatario.uf,
        dados.destinatario.cep
      );
      
      // Criar destino com fornecedor detectado
      adicionarDestino({
        lat: geo.lat,
        lng: geo.lng,
        nome: dados.destinatario.nome || `NF-e ${dados.numero}`,
        endereco: enderecoCompleto,
        cidade: dados.destinatario.cidade,
        uf: dados.destinatario.uf,
        cep: dados.destinatario.cep,
        telefone: dados.destinatario.telefone,
        referencia: dados.destinatario.referencia,
        nfe: dados.numero,
        valor: dados.valor,
        peso: dados.peso,
        fornecedor: dados.fornecedor || 'outro',
        fonte: 'ocr',
        confianca: geo.confiancaValor,
      });
      
    } catch (error) {
      console.error('[Store] Erro ao adicionar destino de NF-e:', error);
      setErro(error instanceof Error ? error.message : 'Erro ao geocodificar endereço');
    } finally {
      setCarregando(false);
    }
  },
  
  removerDestino: (id) => {
    set((state) => ({
      destinos: state.destinos.filter(d => d.id !== id),
      rotaOtimizada: null,
    }));
  },
  
  limparDestinos: () => {
    set({ destinos: [], rotaOtimizada: null });
  },
  
  // ----------------------------------------
  // ROTA
  // ----------------------------------------
  
  calcularRota: async () => {
    const { origem, pontoRetorno, destinos, incluirRetorno, sincronizarComBackend } = get();
    
    // Validar pré-condições
    const validacao = validarParaCalculo(origem, destinos);
    
    if (!validacao.valido) {
      set({ erro: validacao.erro });
      return;
    }
    
    // Log de avisos
    if (validacao.avisos && validacao.avisos.length > 0) {
      console.warn('[Store] Avisos ao calcular rota:', validacao.avisos);
    }
    
    // Calcular rota otimizada localmente
    console.log('[Store] Calculando rota otimizada...');
    set({ carregando: true });
    const inicio = performance.now();
    
    const rotaOtimizada = otimizarRota(origem!, destinos, incluirRetorno, pontoRetorno);
    
    const tempo = performance.now() - inicio;
    console.log(`[Store] Rota calculada em ${tempo.toFixed(2)}ms`);
    
    // SANITY CHECK: verificar métricas
    if (rotaOtimizada.metricas.distanciaTotalKm <= 0 && destinos.length > 0) {
      console.error('[Store] SANITY CHECK FALHOU: distância total = 0');
    }
    
    set({ 
      rotaOtimizada, 
      erro: null,
      etapaAtual: 'rota',
      carregando: false,
    });
    
    // Sincronizar com backend se autenticado
    if (isAuthenticated()) {
      await sincronizarComBackend();
    }
  },
  
  alternarRetorno: () => {
    set((state) => {
      const novoValor = !state.incluirRetorno;
      
      // Se já tem rota calculada, recalcular
      if (state.rotaOtimizada && state.origem) {
        const novaRota = otimizarRota(state.origem, state.destinos, novoValor, state.pontoRetorno);
        return { incluirRetorno: novoValor, rotaOtimizada: novaRota };
      }
      
      return { incluirRetorno: novoValor };
    });
  },
  
  limparRota: () => {
    set({ rotaOtimizada: null });
  },
  
  // ----------------------------------------
  // UI
  // ----------------------------------------
  
  setCarregando: (carregando) => {
    set({ carregando });
  },
  
  setErro: (erro) => {
    set({ erro });
  },
  
  setMotoristaSelecionado: (motorista) => {
    set({ motoristaSelecionado: motorista, empresaSelecionada: null });
  },
  
  setEmpresaSelecionada: (empresa) => {
    set({ empresaSelecionada: empresa, motoristaSelecionado: null });
  },
  
  // ----------------------------------------
  // RESET
  // ----------------------------------------
  
  novaRota: () => {
    set({
      ...estadoInicial,
      etapaAtual: 'origem',
      rotaAtualId: null,
      sincronizando: false,
    });
  },
  
  // ----------------------------------------
  // SINCRONIZAÇÃO COM BACKEND
  // ----------------------------------------
  
  /**
   * Sincroniza a rota atual com o backend
   * @pre Usuário autenticado
   * @post Rota e paradas salvos no banco
   */
  sincronizarComBackend: async () => {
    const { origem, destinos, rotaOtimizada, incluirRetorno, rotaAtualId } = get();
    
    if (!origem || !isAuthenticated()) {
      console.log('[Store] Não sincronizando: sem origem ou não autenticado');
      return;
    }
    
    set({ sincronizando: true });
    
    try {
      let rotaId = rotaAtualId;
      
      // Se não tem rota no backend, criar
      if (!rotaId) {
        console.log('[Store] Criando rota no backend...');
        const novaRota = await rotaService.criar({
          origemLat: origem.lat,
          origemLng: origem.lng,
          origemEndereco: origem.endereco,
          origemFonte: origem.fonte,
          incluirRetorno,
        });
        rotaId = novaRota.id;
        set({ rotaAtualId: rotaId });
        console.log('[Store] Rota criada:', rotaId);
      }
      
      // Converter destinos para paradas do backend
      if (destinos.length > 0) {
        const paradasData: CreateParadaData[] = destinos.map((d) => ({
          lat: d.lat,
          lng: d.lng,
          endereco: d.endereco,
          cidade: d.cidade || '',
          uf: d.uf || '',
          cep: d.cep,
          nome: d.nome,
          telefone: d.telefone,
          fornecedor: d.fornecedor,
          fonte: d.fonte,
          confianca: d.confianca,
        }));
        
        console.log('[Store] Adicionando paradas em batch...');
        await rotaService.adicionarParadasBatch(rotaId, paradasData);
      }
      
      // Se tem rota otimizada, calcular no backend também
      if (rotaOtimizada) {
        console.log('[Store] Calculando rota no backend...');
        await rotaService.calcular(rotaId);
      }
      
      set({ 
        sincronizando: false, 
        ultimaSincronizacao: new Date(),
      });
      console.log('[Store] Sincronização concluída!');
      
    } catch (error) {
      console.error('[Store] Erro ao sincronizar:', error);
      set({ 
        sincronizando: false,
        erro: error instanceof Error ? error.message : 'Erro ao salvar rota',
      });
    }
  },
  
  /**
   * Carrega histórico de rotas do usuário
   */
  carregarHistorico: async () => {
    if (!isAuthenticated()) return;
    
    set({ carregando: true });
    
    try {
      const response = await rotaService.listar({
        porPagina: 50,
        ordenar: '-createdAt',
      });
      
      set({ 
        rotasHistorico: response.rotas,
        carregando: false,
      });
      console.log(`[Store] Histórico carregado: ${response.rotas.length} rotas`);
      
    } catch (error) {
      console.error('[Store] Erro ao carregar histórico:', error);
      set({ carregando: false });
    }
  },
  
  /**
   * Carrega uma rota existente para edição/visualização
   */
  carregarRota: async (rotaId: string) => {
    if (!isAuthenticated()) return;
    
    set({ carregando: true });
    
    try {
      const rota = await rotaService.obter(rotaId);
      
      // Converter rota do backend para estado local
      const origem: Origem = {
        lat: rota.origemLat,
        lng: rota.origemLng,
        endereco: rota.origemEndereco,
        fonte: rota.origemFonte,
        timestamp: new Date(),
      };
      
      const destinos: Destino[] = rota.paradas.map((p) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        nome: p.nome,
        endereco: p.endereco,
        cidade: p.cidade,
        uf: p.uf,
        cep: p.cep,
        telefone: p.telefone,
        fornecedor: p.fornecedor,
        fonte: p.fonte,
        confianca: p.confianca,
      }));
      
      // Reconstruir rota otimizada se já estava calculada
      let rotaOtimizada: RotaOtimizada | null = null;
      if (rota.status !== 'RASCUNHO') {
        rotaOtimizada = otimizarRota(origem, destinos, rota.incluirRetorno, null);
      }
      
      set({
        rotaAtualId: rota.id,
        origem,
        destinos,
        incluirRetorno: rota.incluirRetorno,
        rotaOtimizada,
        carregando: false,
        etapaAtual: rotaOtimizada ? 'rota' : 'destinos',
      });
      
      console.log('[Store] Rota carregada:', rotaId);
      
    } catch (error) {
      console.error('[Store] Erro ao carregar rota:', error);
      set({ 
        carregando: false,
        erro: error instanceof Error ? error.message : 'Erro ao carregar rota',
      });
    }
  },
  
  /**
   * Finaliza a rota atual
   */
  finalizarRotaAtual: async () => {
    const { rotaAtualId } = get();
    
    if (!rotaAtualId || !isAuthenticated()) return;
    
    try {
      await rotaService.finalizar(rotaAtualId);
      console.log('[Store] Rota finalizada:', rotaAtualId);
      
      // Recarregar histórico
      get().carregarHistorico();
      
    } catch (error) {
      console.error('[Store] Erro ao finalizar rota:', error);
    }
  },
}));

// ==========================================
// SELECTORS (Derivações do Estado)
// ==========================================

/**
 * Retorna true se pode calcular a rota
 */
export const usePodeCalcular = () => useRouteStore((state) => 
  state.origem !== null && state.destinos.length > 0
);

/**
 * Retorna total de destinos
 */
export const useTotalDestinos = () => useRouteStore((state) => 
  state.destinos.length
);

/**
 * Retorna destinos com baixa confiança de geocoding
 */
export const useDestinosBaixaConfianca = () => useRouteStore((state) =>
  state.destinos.filter(d => d.confianca < 0.5)
);
