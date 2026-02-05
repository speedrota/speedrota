/**
 * @fileoverview Serviço de Re-otimização Dinâmica
 *
 * CENÁRIOS INTELIGENTES:
 * 1. Cancelamento - Cliente cancela, remove parada
 * 2. Tráfego Intenso - Detectado congestionamento, sugere alternativa
 * 3. Atraso Acumulado - Atrasado vs janela, reordena prioridades
 * 4. Cliente Ausente - Não encontrado, move para final
 * 5. Novo Pedido Urgente - Nova entrega ALTA, insere otimamente
 * 6. Endereço Incorreto - Não encontrado, pula
 * 7. Reagendamento - Nova janela, reordena
 *
 * DESIGN POR CONTRATO:
 * @pre Rota em andamento com paradas calculadas
 * @post Rota re-otimizada com mínimo impacto
 * @invariant Paradas já entregues não são alteradas
 */

import { prisma } from '../lib/prisma.js';
import { CONSTANTES } from '../config/env.js';
import { obterFatorTrafego } from './trafego.js';

// ==========================================
// TIPOS
// ==========================================

export type MotivoReotimizacao =
  | 'CANCELAMENTO'
  | 'TRAFEGO_INTENSO'
  | 'ATRASO_ACUMULADO'
  | 'CLIENTE_AUSENTE'
  | 'NOVO_PEDIDO_URGENTE'
  | 'ENDERECO_INCORRETO'
  | 'REAGENDAMENTO';

export interface ReotimizacaoRequest {
  rotaId: string;
  motivo: MotivoReotimizacao;
  paradaId?: string; // Parada afetada (quando aplicável)
  dados?: {
    novaJanelaInicio?: string;
    novaJanelaFim?: string;
    novaParada?: {
      lat: number;
      lng: number;
      endereco: string;
      cidade: string;
      uf: string;
      nome: string;
      fornecedor: string;
      prioridade: 'ALTA' | 'MEDIA' | 'BAIXA';
    };
  };
}

export interface ReotimizacaoResult {
  success: boolean;
  motivo: MotivoReotimizacao;
  mensagem: string;
  acaoTomada: string;
  paradasAlteradas: number;
  novaDistanciaKm?: number;
  novoTempoMin?: number;
  economiaKm?: number;
  economiaMin?: number;
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

/**
 * Haversine com correção urbana
 */
function haversineCorrigido(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c * CONSTANTES.FATOR_CORRECAO_URBANA;
}

/**
 * Ordena paradas restantes por prioridade e janela
 */
function ordenarParadasRestantes<T extends {
  id: string;
  prioridade?: string | null;
  janelaFim?: string | null;
  statusEntrega?: string;
}>(paradas: T[]): T[] {
  const pesosPrioridade: Record<string, number> = {
    ALTA: 0,
    MEDIA: 1,
    BAIXA: 2,
  };

  // Filtrar apenas paradas pendentes
  const pendentes = paradas.filter(p => p.statusEntrega === 'PENDENTE');

  return pendentes.sort((a, b) => {
    const prioA = pesosPrioridade[a.prioridade || 'MEDIA'] ?? 1;
    const prioB = pesosPrioridade[b.prioridade || 'MEDIA'] ?? 1;
    if (prioA !== prioB) return prioA - prioB;

    const janelaA = a.janelaFim ? parseInt(a.janelaFim.replace(':', '')) : 2400;
    const janelaB = b.janelaFim ? parseInt(b.janelaFim.replace(':', '')) : 2400;
    return janelaA - janelaB;
  });
}

/**
 * Recalcula distâncias e tempos para paradas reordenadas
 */
async function recalcularMetricas(
  rotaId: string,
  origem: { lat: number; lng: number },
  paradas: Array<{ id: string; lat: number; lng: number; ordem: number }>
): Promise<{ distanciaTotal: number; tempoTotal: number }> {
  let distanciaTotal = 0;
  let tempoTotal = 0;
  let pontoAnterior = origem;

  for (const parada of paradas) {
    const distancia = haversineCorrigido(
      pontoAnterior.lat,
      pontoAnterior.lng,
      parada.lat,
      parada.lng
    );
    const tempo = (distancia / CONSTANTES.VELOCIDADE_URBANA_KMH) * 60;

    distanciaTotal += distancia;
    tempoTotal += tempo;

    await prisma.parada.update({
      where: { id: parada.id },
      data: {
        ordem: parada.ordem,
        distanciaAnterior: distancia,
        tempoAnterior: tempo,
      },
    });

    pontoAnterior = { lat: parada.lat, lng: parada.lng };
  }

  return { distanciaTotal, tempoTotal };
}

// ==========================================
// HANDLERS POR CENÁRIO
// ==========================================

/**
 * Cenário 1: CANCELAMENTO
 * Remove parada cancelada e recalcula rota
 */
async function handleCancelamento(
  rotaId: string,
  paradaId: string
): Promise<ReotimizacaoResult> {
  // Buscar rota
  const rota = await prisma.rota.findUnique({
    where: { id: rotaId },
    include: { paradas: { orderBy: { ordem: 'asc' } } },
  });

  if (!rota) throw new Error('Rota não encontrada');

  const paradaCancelada = rota.paradas.find(p => p.id === paradaId);
  if (!paradaCancelada) throw new Error('Parada não encontrada');

  // Remover parada
  await prisma.parada.delete({ where: { id: paradaId } });

  // Reordenar paradas restantes
  const paradasRestantes = rota.paradas
    .filter(p => p.id !== paradaId && p.statusEntrega === 'PENDENTE')
    .map((p, index) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      ordem: index + 1,
    }));

  // Recalcular métricas
  const origem = { lat: rota.origemLat, lng: rota.origemLng };
  const { distanciaTotal, tempoTotal } = await recalcularMetricas(
    rotaId,
    origem,
    paradasRestantes
  );

  // Atualizar rota
  await prisma.rota.update({
    where: { id: rotaId },
    data: {
      distanciaTotalKm: distanciaTotal,
      tempoViagemMin: tempoTotal,
    },
  });

  const economiaKm = (rota.distanciaTotalKm || 0) - distanciaTotal;
  const economiaMin = (rota.tempoViagemMin || 0) - tempoTotal;

  return {
    success: true,
    motivo: 'CANCELAMENTO',
    mensagem: `Parada "${paradaCancelada.nome}" removida`,
    acaoTomada: 'Rota recalculada sem a parada cancelada',
    paradasAlteradas: paradasRestantes.length,
    novaDistanciaKm: distanciaTotal,
    novoTempoMin: tempoTotal,
    economiaKm,
    economiaMin,
  };
}

/**
 * Cenário 2: TRÁFEGO INTENSO
 * Verifica tráfego e sugere reordenação se necessário
 */
async function handleTrafegoIntenso(
  rotaId: string,
  paradaId?: string
): Promise<ReotimizacaoResult> {
  const rota = await prisma.rota.findUnique({
    where: { id: rotaId },
    include: { paradas: { orderBy: { ordem: 'asc' } } },
  });

  if (!rota) throw new Error('Rota não encontrada');

  const horaAtual = new Date().getHours();
  const fatorTrafego = obterFatorTrafego(horaAtual);

  // Se tráfego leve, não precisa reordenar
  if (fatorTrafego.fator < 1.3) {
    return {
      success: true,
      motivo: 'TRAFEGO_INTENSO',
      mensagem: 'Tráfego está normal',
      acaoTomada: 'Nenhuma alteração necessária',
      paradasAlteradas: 0,
    };
  }

  // Reordenar priorizando entregas com janela próxima de expirar
  const paradasPendentes = rota.paradas.filter(p => p.statusEntrega === 'PENDENTE');
  const ordenadas = ordenarParadasRestantes(paradasPendentes);

  const paradasReordenadas = ordenadas.map((p, index) => ({
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    ordem: index + 1,
  }));

  const origem = { lat: rota.origemLat, lng: rota.origemLng };
  const { distanciaTotal, tempoTotal } = await recalcularMetricas(
    rotaId,
    origem,
    paradasReordenadas
  );

  // Aplicar fator de tráfego ao tempo
  const tempoComTrafego = tempoTotal * fatorTrafego.fator;

  await prisma.rota.update({
    where: { id: rotaId },
    data: {
      distanciaTotalKm: distanciaTotal,
      tempoViagemMin: tempoComTrafego,
    },
  });

  return {
    success: true,
    motivo: 'TRAFEGO_INTENSO',
    mensagem: `${fatorTrafego.descricao} detectado`,
    acaoTomada: 'Rota reordenada priorizando janelas de tempo',
    paradasAlteradas: paradasReordenadas.length,
    novaDistanciaKm: distanciaTotal,
    novoTempoMin: tempoComTrafego,
  };
}

/**
 * Cenário 3: ATRASO ACUMULADO
 * Entregador atrasado, reordena para minimizar impacto
 */
async function handleAtrasoAcumulado(
  rotaId: string
): Promise<ReotimizacaoResult> {
  const rota = await prisma.rota.findUnique({
    where: { id: rotaId },
    include: { paradas: { orderBy: { ordem: 'asc' } } },
  });

  if (!rota) throw new Error('Rota não encontrada');

  const agora = new Date();
  const horaAtual = agora.getHours() * 60 + agora.getMinutes();

  // Identificar paradas com janela já expirada ou prestes a expirar
  const paradasPendentes = rota.paradas.filter(p => p.statusEntrega === 'PENDENTE');
  
  const paradasUrgentes: string[] = [];
  const paradasNormais: string[] = [];

  for (const parada of paradasPendentes) {
    if (parada.janelaFim) {
      const [h, m] = parada.janelaFim.split(':').map(Number);
      const fimJanela = h * 60 + m;
      
      // Se faltam menos de 30 min para expirar, é urgente
      if (fimJanela - horaAtual <= 30) {
        paradasUrgentes.push(parada.id);
      } else {
        paradasNormais.push(parada.id);
      }
    } else {
      paradasNormais.push(parada.id);
    }
  }

  // Reordenar: urgentes primeiro (por janela), depois normais
  const todasParadas = paradasPendentes.sort((a, b) => {
    const aUrgente = paradasUrgentes.includes(a.id);
    const bUrgente = paradasUrgentes.includes(b.id);

    if (aUrgente && !bUrgente) return -1;
    if (!aUrgente && bUrgente) return 1;

    // Dentro do mesmo grupo, por janela
    const janelaA = a.janelaFim ? parseInt(a.janelaFim.replace(':', '')) : 2400;
    const janelaB = b.janelaFim ? parseInt(b.janelaFim.replace(':', '')) : 2400;
    return janelaA - janelaB;
  });

  const paradasReordenadas = todasParadas.map((p, index) => ({
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    ordem: index + 1,
  }));

  const origem = { lat: rota.origemLat, lng: rota.origemLng };
  const { distanciaTotal, tempoTotal } = await recalcularMetricas(
    rotaId,
    origem,
    paradasReordenadas
  );

  await prisma.rota.update({
    where: { id: rotaId },
    data: {
      distanciaTotalKm: distanciaTotal,
      tempoViagemMin: tempoTotal,
    },
  });

  return {
    success: true,
    motivo: 'ATRASO_ACUMULADO',
    mensagem: `${paradasUrgentes.length} entregas urgentes identificadas`,
    acaoTomada: 'Rota reorganizada priorizando janelas prestes a expirar',
    paradasAlteradas: paradasReordenadas.length,
    novaDistanciaKm: distanciaTotal,
    novoTempoMin: tempoTotal,
  };
}

/**
 * Cenário 4: CLIENTE AUSENTE
 * Move parada para o final da rota
 */
async function handleClienteAusente(
  rotaId: string,
  paradaId: string
): Promise<ReotimizacaoResult> {
  const rota = await prisma.rota.findUnique({
    where: { id: rotaId },
    include: { paradas: { orderBy: { ordem: 'asc' } } },
  });

  if (!rota) throw new Error('Rota não encontrada');

  const paradaAusente = rota.paradas.find(p => p.id === paradaId);
  if (!paradaAusente) throw new Error('Parada não encontrada');

  // Marcar como AUSENTE
  await prisma.parada.update({
    where: { id: paradaId },
    data: { statusEntrega: 'AUSENTE' },
  });

  // Reordenar: outras pendentes primeiro, ausente por último
  const paradasPendentes = rota.paradas.filter(
    p => p.id !== paradaId && p.statusEntrega === 'PENDENTE'
  );
  const ordenadas = ordenarParadasRestantes(paradasPendentes);

  // Adicionar ausente ao final
  const todasReordenadas = [...ordenadas, paradaAusente].map((p, index) => ({
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    ordem: index + 1,
  }));

  const origem = { lat: rota.origemLat, lng: rota.origemLng };
  const { distanciaTotal, tempoTotal } = await recalcularMetricas(
    rotaId,
    origem,
    todasReordenadas
  );

  await prisma.rota.update({
    where: { id: rotaId },
    data: {
      distanciaTotalKm: distanciaTotal,
      tempoViagemMin: tempoTotal,
    },
  });

  return {
    success: true,
    motivo: 'CLIENTE_AUSENTE',
    mensagem: `Cliente "${paradaAusente.nome}" ausente`,
    acaoTomada: 'Entrega movida para o final da rota (tentativa posterior)',
    paradasAlteradas: todasReordenadas.length,
    novaDistanciaKm: distanciaTotal,
    novoTempoMin: tempoTotal,
  };
}

/**
 * Cenário 5: NOVO PEDIDO URGENTE
 * Insere nova parada na melhor posição
 */
async function handleNovoPedidoUrgente(
  rotaId: string,
  novaParada: NonNullable<ReotimizacaoRequest['dados']>['novaParada']
): Promise<ReotimizacaoResult> {
  if (!novaParada) throw new Error('Dados da nova parada não fornecidos');

  const rota = await prisma.rota.findUnique({
    where: { id: rotaId },
    include: { paradas: { orderBy: { ordem: 'asc' } } },
  });

  if (!rota) throw new Error('Rota não encontrada');

  // Criar nova parada
  const criada = await prisma.parada.create({
    data: {
      rotaId,
      lat: novaParada.lat,
      lng: novaParada.lng,
      endereco: novaParada.endereco,
      cidade: novaParada.cidade,
      uf: novaParada.uf,
      nome: novaParada.nome,
      fornecedor: novaParada.fornecedor,
      prioridade: novaParada.prioridade,
      fonte: 'manual',
      ordem: 0,
    },
  });

  // Encontrar melhor posição para inserir
  const paradasPendentes = rota.paradas.filter(p => p.statusEntrega === 'PENDENTE');
  
  // Se é ALTA prioridade, inserir no início
  let posicaoInsercao = 0;
  if (novaParada.prioridade === 'ALTA') {
    posicaoInsercao = 0;
  } else {
    // Encontrar posição que minimiza distância adicional
    const origem = { lat: rota.origemLat, lng: rota.origemLng };
    let menorDistanciaAdicional = Infinity;

    for (let i = 0; i <= paradasPendentes.length; i++) {
      const anterior = i === 0 ? origem : paradasPendentes[i - 1];
      const proximo = i < paradasPendentes.length ? paradasPendentes[i] : origem;

      const distanciaSem = haversineCorrigido(anterior.lat, anterior.lng, proximo.lat, proximo.lng);
      const distanciaCom =
        haversineCorrigido(anterior.lat, anterior.lng, novaParada.lat, novaParada.lng) +
        haversineCorrigido(novaParada.lat, novaParada.lng, proximo.lat, proximo.lng);

      const adicional = distanciaCom - distanciaSem;
      if (adicional < menorDistanciaAdicional) {
        menorDistanciaAdicional = adicional;
        posicaoInsercao = i;
      }
    }
  }

  // Reordenar com nova parada
  const novaLista = [...paradasPendentes];
  novaLista.splice(posicaoInsercao, 0, criada);

  const paradasReordenadas = novaLista.map((p, index) => ({
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    ordem: index + 1,
  }));

  const origem = { lat: rota.origemLat, lng: rota.origemLng };
  const { distanciaTotal, tempoTotal } = await recalcularMetricas(
    rotaId,
    origem,
    paradasReordenadas
  );

  await prisma.rota.update({
    where: { id: rotaId },
    data: {
      distanciaTotalKm: distanciaTotal,
      tempoViagemMin: tempoTotal,
    },
  });

  return {
    success: true,
    motivo: 'NOVO_PEDIDO_URGENTE',
    mensagem: `Nova entrega "${novaParada.nome}" adicionada`,
    acaoTomada: `Inserida na posição ${posicaoInsercao + 1} da rota`,
    paradasAlteradas: paradasReordenadas.length,
    novaDistanciaKm: distanciaTotal,
    novoTempoMin: tempoTotal,
  };
}

/**
 * Cenário 6: ENDEREÇO INCORRETO
 * Marca como não encontrado e pula
 */
async function handleEnderecoIncorreto(
  rotaId: string,
  paradaId: string
): Promise<ReotimizacaoResult> {
  const rota = await prisma.rota.findUnique({
    where: { id: rotaId },
    include: { paradas: { orderBy: { ordem: 'asc' } } },
  });

  if (!rota) throw new Error('Rota não encontrada');

  const paradaProblema = rota.paradas.find(p => p.id === paradaId);
  if (!paradaProblema) throw new Error('Parada não encontrada');

  // Marcar como problema
  await prisma.parada.update({
    where: { id: paradaId },
    data: {
      statusEntrega: 'RECUSADA',
      observacao: 'Endereço não encontrado',
    },
  });

  // Reordenar sem a parada problemática
  const paradasRestantes = rota.paradas
    .filter(p => p.id !== paradaId && p.statusEntrega === 'PENDENTE')
    .map((p, index) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      ordem: index + 1,
    }));

  const origem = { lat: rota.origemLat, lng: rota.origemLng };
  const { distanciaTotal, tempoTotal } = await recalcularMetricas(
    rotaId,
    origem,
    paradasRestantes
  );

  await prisma.rota.update({
    where: { id: rotaId },
    data: {
      distanciaTotalKm: distanciaTotal,
      tempoViagemMin: tempoTotal,
    },
  });

  return {
    success: true,
    motivo: 'ENDERECO_INCORRETO',
    mensagem: `Endereço de "${paradaProblema.nome}" não encontrado`,
    acaoTomada: 'Entrega pulada e marcada para verificação',
    paradasAlteradas: paradasRestantes.length,
    novaDistanciaKm: distanciaTotal,
    novoTempoMin: tempoTotal,
  };
}

/**
 * Cenário 7: REAGENDAMENTO
 * Atualiza janela de tempo e reordena
 */
async function handleReagendamento(
  rotaId: string,
  paradaId: string,
  novaJanelaInicio?: string,
  novaJanelaFim?: string
): Promise<ReotimizacaoResult> {
  const rota = await prisma.rota.findUnique({
    where: { id: rotaId },
    include: { paradas: { orderBy: { ordem: 'asc' } } },
  });

  if (!rota) throw new Error('Rota não encontrada');

  const paradaReagendada = rota.paradas.find(p => p.id === paradaId);
  if (!paradaReagendada) throw new Error('Parada não encontrada');

  // Atualizar janela
  await prisma.parada.update({
    where: { id: paradaId },
    data: {
      janelaInicio: novaJanelaInicio || paradaReagendada.janelaInicio,
      janelaFim: novaJanelaFim || paradaReagendada.janelaFim,
    },
  });

  // Reordenar considerando nova janela
  const paradasPendentes = rota.paradas.filter(p => p.statusEntrega === 'PENDENTE');
  
  // Atualizar janela na lista local
  const paradaAtualizada = paradasPendentes.find(p => p.id === paradaId);
  if (paradaAtualizada) {
    paradaAtualizada.janelaInicio = novaJanelaInicio || paradaAtualizada.janelaInicio;
    paradaAtualizada.janelaFim = novaJanelaFim || paradaAtualizada.janelaFim;
  }

  const ordenadas = ordenarParadasRestantes(paradasPendentes);
  const paradasReordenadas = ordenadas.map((p, index) => ({
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    ordem: index + 1,
  }));

  const origem = { lat: rota.origemLat, lng: rota.origemLng };
  const { distanciaTotal, tempoTotal } = await recalcularMetricas(
    rotaId,
    origem,
    paradasReordenadas
  );

  await prisma.rota.update({
    where: { id: rotaId },
    data: {
      distanciaTotalKm: distanciaTotal,
      tempoViagemMin: tempoTotal,
    },
  });

  return {
    success: true,
    motivo: 'REAGENDAMENTO',
    mensagem: `Entrega "${paradaReagendada.nome}" reagendada`,
    acaoTomada: `Nova janela: ${novaJanelaInicio || 'N/A'} - ${novaJanelaFim || 'N/A'}`,
    paradasAlteradas: paradasReordenadas.length,
    novaDistanciaKm: distanciaTotal,
    novoTempoMin: tempoTotal,
  };
}

// ==========================================
// FUNÇÃO PRINCIPAL
// ==========================================

/**
 * Processa re-otimização dinâmica
 *
 * @pre Rota existe e está em andamento
 * @post Rota re-otimizada conforme cenário
 */
export async function processarReotimizacao(
  request: ReotimizacaoRequest
): Promise<ReotimizacaoResult> {
  const { rotaId, motivo, paradaId, dados } = request;

  switch (motivo) {
    case 'CANCELAMENTO':
      if (!paradaId) throw new Error('paradaId obrigatório para cancelamento');
      return handleCancelamento(rotaId, paradaId);

    case 'TRAFEGO_INTENSO':
      return handleTrafegoIntenso(rotaId, paradaId);

    case 'ATRASO_ACUMULADO':
      return handleAtrasoAcumulado(rotaId);

    case 'CLIENTE_AUSENTE':
      if (!paradaId) throw new Error('paradaId obrigatório para cliente ausente');
      return handleClienteAusente(rotaId, paradaId);

    case 'NOVO_PEDIDO_URGENTE':
      if (!dados?.novaParada) throw new Error('novaParada obrigatório para novo pedido');
      return handleNovoPedidoUrgente(rotaId, dados.novaParada);

    case 'ENDERECO_INCORRETO':
      if (!paradaId) throw new Error('paradaId obrigatório para endereço incorreto');
      return handleEnderecoIncorreto(rotaId, paradaId);

    case 'REAGENDAMENTO':
      if (!paradaId) throw new Error('paradaId obrigatório para reagendamento');
      return handleReagendamento(
        rotaId,
        paradaId,
        dados?.novaJanelaInicio,
        dados?.novaJanelaFim
      );

    default:
      throw new Error(`Motivo de re-otimização desconhecido: ${motivo}`);
  }
}
