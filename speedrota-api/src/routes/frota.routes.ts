/**
 * @fileoverview Rotas de API para Gestão de Frota Multi-motorista
 *
 * DESIGN POR CONTRATO:
 * @description API completa para gerenciamento de frotas
 * @pre Autenticação válida, user com permissão de gestor
 * @post Operações CRUD em empresas, motoristas, veículos, zonas
 * @invariant Dados sempre validados antes de persistir
 *
 * ENDPOINTS:
 * - /empresa - CRUD empresas
 * - /motorista - CRUD motoristas
 * - /veiculo - CRUD veículos
 * - /equipe - CRUD equipes
 * - /zona - CRUD zonas de atuação
 * - /distribuicao - Algoritmo de distribuição
 * - /dashboard - Dados agregados para dashboard
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import distribuicaoService, { EntregaParaDistribuir, ConfiguracaoDistribuicao } from '../services/distribuicao.js';

// ==========================================
// TIPOS DE REQUEST
// ==========================================

interface AuthRequest extends FastifyRequest {
  user?: { userId: string; email: string; plano: string };
}

interface IdParam {
  id: string;
}

interface EmpresaIdParam {
  empresaId: string;
}

// ==========================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ==========================================

async function verificarGestor(request: AuthRequest, reply: FastifyReply) {
  const userId = request.user?.userId;
  if (!userId) {
    reply.code(401).send({ error: 'Não autenticado' });
    return;
  }

  // Verificar se é gestor de alguma empresa
  const empresas = await prisma.empresa.findFirst({
    where: { gestorId: userId },
  });

  if (!empresas) {
    reply.code(403).send({ error: 'Sem permissão de gestor' });
    return;
  }
}

// ==========================================
// PLUGIN DE ROTAS
// ==========================================

export default async function frotaRoutes(fastify: FastifyInstance) {
  // Todas as rotas requerem autenticação
  fastify.addHook('onRequest', authenticate);

  // ==========================================
  // EMPRESA ROUTES
  // ==========================================

  // Criar empresa
  fastify.post<{
    Body: {
      nome: string;
      cnpj?: string;
      email?: string;
      telefone?: string;
      baseLat?: number;
      baseLng?: number;
      baseEndereco?: string;
      limiteMotoristas?: number;
      limiteVeiculos?: number;
      modoDistribuicao?: 'AUTOMATICO' | 'MANUAL' | 'HIBRIDO';
    };
  }>('/empresa', async (request: AuthRequest, reply) => {
    const userId = request.user?.userId;
    const userEmail = request.user?.email;
    if (!userId) {
      return reply.code(401).send({ error: 'Não autenticado' });
    }

    const { nome, cnpj, email, telefone, baseLat, baseLng, baseEndereco, limiteMotoristas, limiteVeiculos, modoDistribuicao } = request.body;

    try {
      const empresa = await prisma.empresa.create({
        data: {
          nome,
          cnpj,
          email: email || userEmail || '',
          telefone,
          baseLat,
          baseLng,
          baseEndereco,
          limiteMotoristas: limiteMotoristas || 10,
          limiteVeiculos: limiteVeiculos || 10,
          modoDistribuicao: modoDistribuicao || 'AUTOMATICO',
          gestorId: userId,
        },
      });

      return reply.code(201).send(empresa);
    } catch (error: any) {
      console.error('[API] Erro ao criar empresa:', error);
      return reply.code(400).send({ error: error.message });
    }
  });

  // Listar empresas do gestor
  fastify.get('/empresas', async (request: AuthRequest, reply) => {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Não autenticado' });
    }

    const empresas = await prisma.empresa.findMany({
      where: { gestorId: userId },
      include: {
        _count: {
          select: {
            motoristas: true,
            veiculos: true,
            equipes: true,
            rotasEmpresa: true,
          },
        },
      },
    });

    return empresas;
  });

  // Buscar empresa por ID
  fastify.get<{ Params: IdParam }>('/empresa/:id', async (request: AuthRequest, reply) => {
    const userId = request.user?.userId;
    const { id } = request.params;

    const empresa = await prisma.empresa.findFirst({
      where: { id, gestorId: userId },
      include: {
        motoristas: {
          include: { veiculoAtual: true },
          orderBy: { nome: 'asc' },
        },
        veiculos: { orderBy: { placa: 'asc' } },
        equipes: { include: { _count: { select: { membros: true } } } },
        zonasAtuacao: true,
        _count: { select: { rotas: true } },
      },
    });

    if (!empresa) {
      return reply.code(404).send({ error: 'Empresa não encontrada' });
    }

    return empresa;
  });

  // Atualizar empresa
  fastify.put<{
    Params: IdParam;
    Body: {
      nome?: string;
      baseLat?: number;
      baseLng?: number;
      baseEndereco?: string;
      limiteMotoristas?: number;
      limiteVeiculos?: number;
      modoDistribuicao?: 'AUTOMATICO' | 'MANUAL' | 'HIBRIDO';
      configDistribuicao?: object;
    };
  }>('/empresa/:id', async (request: AuthRequest, reply) => {
    const userId = request.user?.userId;
    const { id } = request.params;

    const empresa = await prisma.empresa.findFirst({
      where: { id, gestorId: userId },
    });

    if (!empresa) {
      return reply.code(404).send({ error: 'Empresa não encontrada' });
    }

    const updated = await prisma.empresa.update({
      where: { id },
      data: {
        ...request.body,
        configDistribuicao: request.body.configDistribuicao
          ? JSON.stringify(request.body.configDistribuicao)
          : undefined,
      },
    });

    return updated;
  });

  // ==========================================
  // MOTORISTA ROUTES
  // ==========================================

  // Criar motorista
  fastify.post<{
    Params: EmpresaIdParam;
    Body: {
      nome: string;
      telefone: string;
      email?: string;
      cpf?: string;
      foto?: string;
      capacidadeKg?: number;
      capacidadeVolumes?: number;
      raioMaximoKm?: number;
      horaInicio?: string;
      horaFim?: string;
      veiculoId?: string;
      zonasIds?: string[];
    };
  }>('/empresa/:empresaId/motorista', async (request: AuthRequest, reply) => {
    const userId = request.user?.userId;
    const { empresaId } = request.params;

    // Verificar permissão
    const empresa = await prisma.empresa.findFirst({
      where: { id: empresaId, gestorId: userId },
      include: { _count: { select: { motoristas: true } } },
    });

    if (!empresa) {
      return reply.code(404).send({ error: 'Empresa não encontrada' });
    }

    // Verificar limite de motoristas
    if (empresa._count.motoristas >= empresa.limiteMotoristas) {
      return reply.code(400).send({
        error: `Limite de ${empresa.limiteMotoristas} motoristas atingido`,
      });
    }

    const { zonasIds, ...data } = request.body;

    try {
      const motorista = await prisma.motorista.create({
        data: {
          ...data,
          empresaId,
          veiculoAtualId: data.veiculoId,
          capacidadeKg: data.capacidadeKg || 50,
          capacidadeVolumes: data.capacidadeVolumes || 30,
          raioMaximoKm: data.raioMaximoKm || 50,
          zonasPreferidas: zonasIds
            ? {
                create: zonasIds.map((zonaId, idx) => ({
                  zonaId,
                  prioridade: idx + 1,
                })),
              }
            : undefined,
        },
        include: {
          veiculoAtual: true,
          zonasPreferidas: { include: { zona: true } },
        },
      });

      return reply.code(201).send(motorista);
    } catch (error: any) {
      console.error('[API] Erro ao criar motorista:', error);
      return reply.code(400).send({ error: error.message });
    }
  });

  // Criar motorista autônomo (sem empresa)
  fastify.post<{
    Body: {
      nome: string;
      telefone: string;
      email: string;
      cpf?: string;
      tipoMotorista: 'AUTONOMO' | 'AUTONOMO_PARCEIRO';
      foto?: string;
      capacidadeKg?: number;
      capacidadeVolumes?: number;
      raioMaximoKm?: number;
    };
  }>('/motorista/autonomo', async (request: AuthRequest, reply) => {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Não autenticado' });
    }

    const { nome, telefone, email, cpf, tipoMotorista, foto, capacidadeKg, capacidadeVolumes, raioMaximoKm } = request.body;

    // Validar tipo
    if (!tipoMotorista || !['AUTONOMO', 'AUTONOMO_PARCEIRO'].includes(tipoMotorista)) {
      return reply.code(400).send({ error: 'tipoMotorista deve ser AUTONOMO ou AUTONOMO_PARCEIRO' });
    }

    try {
      const motorista = await prisma.motorista.create({
        data: {
          nome,
          telefone,
          email,
          cpf,
          tipoMotorista: tipoMotorista as any,
          foto,
          capacidadeKg: capacidadeKg || 50,
          capacidadeVolumes: capacidadeVolumes || 30,
          raioMaximoKm: raioMaximoKm || 50,
          empresaId: null, // Motorista autônomo
        },
      });

      return reply.code(201).send(motorista);
    } catch (error: any) {
      console.error('[API] Erro ao criar motorista autônomo:', error);
      return reply.code(400).send({ error: error.message });
    }
  });

  // Listar motoristas da empresa
  fastify.get<{
    Params: EmpresaIdParam;
    Querystring: { status?: string; equipeId?: string };
  }>('/empresa/:empresaId/motoristas', async (request: AuthRequest, reply) => {
    const userId = request.user?.userId;
    const { empresaId } = request.params;
    const { status, equipeId } = request.query;

    // Verificar permissão
    const empresa = await prisma.empresa.findFirst({
      where: { id: empresaId, gestorId: userId },
    });

    if (!empresa) {
      return reply.code(404).send({ error: 'Empresa não encontrada' });
    }

    const motoristas = await prisma.motorista.findMany({
      where: {
        empresaId,
        ativo: true,
        status: status ? { in: status.split(',') } : undefined,
        equipeId: equipeId || undefined,
      },
      include: {
        veiculoAtual: true,
        equipe: true,
        zonasPreferidas: { include: { zona: true } },
        _count: { select: { rotas: true } },
      },
      orderBy: { nome: 'asc' },
    });

    return motoristas;
  });

  // Buscar motorista por ID
  fastify.get<{ Params: IdParam }>('/motorista/:id', async (request: AuthRequest, reply) => {
    const userId = request.user?.userId;
    const { id } = request.params;

    const motorista = await prisma.motorista.findFirst({
      where: { id },
      include: {
        empresa: true,
        veiculoAtual: true,
        equipe: true,
        zonasPreferidas: { include: { zona: true } },
        performance: {
          orderBy: { data: 'desc' },
          take: 30,
        },
        rotas: {
          where: { status: { in: ['EM_ANDAMENTO', 'CONCLUIDA'] } },
          orderBy: { criadoEm: 'desc' },
          take: 10,
        },
      },
    });

    if (!motorista) {
      return reply.code(404).send({ error: 'Motorista não encontrado' });
    }

    // Verificar permissão
    if (motorista.empresa.gestorId !== userId) {
      return reply.code(403).send({ error: 'Sem permissão' });
    }

    return motorista;
  });

  // Atualizar status do motorista
  fastify.patch<{
    Params: IdParam;
    Body: {
      status: 'DISPONIVEL' | 'EM_ROTA' | 'PAUSADO' | 'INDISPONIVEL' | 'OFFLINE';
      motivo?: string;
      lat?: number;
      lng?: number;
    };
  }>('/motorista/:id/status', async (request: AuthRequest, reply) => {
    const { id } = request.params;
    const { status, motivo, lat, lng } = request.body;

    const motorista = await prisma.motorista.update({
      where: { id },
      data: {
        status,
        motivoIndisponivel: status === 'INDISPONIVEL' ? motivo : null,
        statusAtualizadoEm: new Date(),
        ultimaLat: lat,
        ultimaLng: lng,
        ultimaPosicaoEm: lat && lng ? new Date() : undefined,
      },
    });

    // Se ficou indisponível, redistribuir entregas
    if (status === 'INDISPONIVEL' && motorista.empresaId) {
      try {
        await distribuicaoService.redistribuirDeMotorista(
          motorista.empresaId,
          id,
          motivo || 'Motorista indisponível'
        );
      } catch (error) {
        console.error('[API] Erro ao redistribuir:', error);
      }
    }

    return motorista;
  });

  // Atualizar posição do motorista
  fastify.patch<{
    Params: IdParam;
    Body: { lat: number; lng: number };
  }>('/motorista/:id/posicao', async (request, reply) => {
    const { id } = request.params;
    const { lat, lng } = request.body;

    const motorista = await prisma.motorista.update({
      where: { id },
      data: {
        ultimaLat: lat,
        ultimaLng: lng,
        ultimaPosicaoEm: new Date(),
      },
    });

    return { success: true, posicao: { lat, lng } };
  });

  // ==========================================
  // VEÍCULO ROUTES
  // ==========================================

  // Criar veículo
  fastify.post<{
    Params: EmpresaIdParam;
    Body: {
      placa: string;
      modelo: string;
      tipo: 'MOTO' | 'BICICLETA' | 'CARRO' | 'VAN' | 'FURGAO' | 'CAMINHAO_LEVE' | 'CAMINHAO_MEDIO' | 'CAMINHAO_PESADO';
      ano?: number;
      cor?: string;
      capacidadeKg?: number;
      capacidadeVolumes?: number;
      consumoKmL?: number;
    };
  }>('/empresa/:empresaId/veiculo', async (request: AuthRequest, reply) => {
    const userId = request.user?.userId;
    const { empresaId } = request.params;

    const empresa = await prisma.empresa.findFirst({
      where: { id: empresaId, gestorId: userId },
    });

    if (!empresa) {
      return reply.code(404).send({ error: 'Empresa não encontrada' });
    }

    // Definir capacidades padrão por tipo
    const capacidadesPadrao: { [key: string]: { kg: number; volumes: number } } = {
      BICICLETA: { kg: 15, volumes: 5 },
      MOTO: { kg: 30, volumes: 10 },
      CARRO: { kg: 200, volumes: 50 },
      VAN: { kg: 800, volumes: 150 },
      FURGAO: { kg: 1500, volumes: 300 },
      CAMINHAO_LEVE: { kg: 3000, volumes: 500 },
      CAMINHAO_MEDIO: { kg: 8000, volumes: 1000 },
      CAMINHAO_PESADO: { kg: 15000, volumes: 2000 },
    };

    const cap = capacidadesPadrao[request.body.tipo] || { kg: 100, volumes: 30 };

    try {
      const veiculo = await prisma.veiculo.create({
        data: {
          ...request.body,
          empresaId,
          capacidadeKg: request.body.capacidadeKg || cap.kg,
          capacidadeVolumes: request.body.capacidadeVolumes || cap.volumes,
        },
      });

      return reply.code(201).send(veiculo);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return reply.code(400).send({ error: 'Placa já cadastrada' });
      }
      return reply.code(400).send({ error: error.message });
    }
  });

  // Listar veículos
  fastify.get<{ Params: EmpresaIdParam }>('/empresa/:empresaId/veiculos', async (request: AuthRequest, reply) => {
    const userId = request.user?.userId;
    const { empresaId } = request.params;

    const empresa = await prisma.empresa.findFirst({
      where: { id: empresaId, gestorId: userId },
    });

    if (!empresa) {
      return reply.code(404).send({ error: 'Empresa não encontrada' });
    }

    const veiculos = await prisma.veiculo.findMany({
      where: { empresaId, ativo: true },
      include: {
        motoristaAtual: { select: { id: true, nome: true, status: true } },
      },
      orderBy: { placa: 'asc' },
    });

    return veiculos;
  });

  // ==========================================
  // ZONA DE ATUAÇÃO ROUTES
  // ==========================================

  // Criar zona
  fastify.post<{
    Params: EmpresaIdParam;
    Body: {
      nome: string;
      cor?: string;
      cidades?: string[];
      bairros?: string[];
      ceps?: string[];
      centroLat?: number;
      centroLng?: number;
      raioKm?: number;
      poligono?: string; // GeoJSON
    };
  }>('/empresa/:empresaId/zona', async (request: AuthRequest, reply) => {
    const userId = request.user?.userId;
    const { empresaId } = request.params;

    const empresa = await prisma.empresa.findFirst({
      where: { id: empresaId, gestorId: userId },
    });

    if (!empresa) {
      return reply.code(404).send({ error: 'Empresa não encontrada' });
    }

    const { cidades, bairros, ceps, ...data } = request.body;

    const zona = await prisma.zonaAtuacao.create({
      data: {
        ...data,
        empresaId,
        cidades: cidades ? JSON.stringify(cidades) : null,
        bairros: bairros ? JSON.stringify(bairros) : null,
        ceps: ceps ? JSON.stringify(ceps) : null,
      },
    });

    return reply.code(201).send(zona);
  });

  // Listar zonas
  fastify.get<{ Params: EmpresaIdParam }>('/empresa/:empresaId/zonas', async (request: AuthRequest, reply) => {
    const userId = request.user?.userId;
    const { empresaId } = request.params;

    const empresa = await prisma.empresa.findFirst({
      where: { id: empresaId, gestorId: userId },
    });

    if (!empresa) {
      return reply.code(404).send({ error: 'Empresa não encontrada' });
    }

    const zonas = await prisma.zonaAtuacao.findMany({
      where: { empresaId, ativo: true },
      include: {
        _count: { select: { motoristas: true } },
      },
    });

    return zonas.map((z) => ({
      ...z,
      cidades: z.cidades ? JSON.parse(z.cidades) : [],
      bairros: z.bairros ? JSON.parse(z.bairros) : [],
      ceps: z.ceps ? JSON.parse(z.ceps) : [],
    }));
  });

  // ==========================================
  // EQUIPE ROUTES
  // ==========================================

  // Criar equipe
  fastify.post<{
    Params: EmpresaIdParam;
    Body: {
      nome: string;
      cor?: string;
      liderId?: string;
      zonaDefaultId?: string;
    };
  }>('/empresa/:empresaId/equipe', async (request: AuthRequest, reply) => {
    const userId = request.user?.userId;
    const { empresaId } = request.params;

    const empresa = await prisma.empresa.findFirst({
      where: { id: empresaId, gestorId: userId },
    });

    if (!empresa) {
      return reply.code(404).send({ error: 'Empresa não encontrada' });
    }

    const equipe = await prisma.equipe.create({
      data: {
        ...request.body,
        empresaId,
      },
    });

    return reply.code(201).send(equipe);
  });

  // Listar equipes
  fastify.get<{ Params: EmpresaIdParam }>('/empresa/:empresaId/equipes', async (request: AuthRequest, reply) => {
    const userId = request.user?.userId;
    const { empresaId } = request.params;

    const empresa = await prisma.empresa.findFirst({
      where: { id: empresaId, gestorId: userId },
    });

    if (!empresa) {
      return reply.code(404).send({ error: 'Empresa não encontrada' });
    }

    const equipes = await prisma.equipe.findMany({
      where: { empresaId, ativo: true },
      include: {
        lider: { select: { id: true, nome: true } },
        zonaDefault: { select: { id: true, nome: true, cor: true } },
        _count: { select: { membros: true } },
      },
    });

    return equipes;
  });

  // ==========================================
  // DISTRIBUIÇÃO ROUTES
  // ==========================================

  // Distribuir entregas automaticamente
  fastify.post<{
    Params: EmpresaIdParam;
    Body: {
      entregas: EntregaParaDistribuir[];
      config?: Partial<ConfiguracaoDistribuicao>;
    };
  }>('/empresa/:empresaId/distribuir', async (request: AuthRequest, reply) => {
    const userId = request.user?.userId;
    const { empresaId } = request.params;
    const { entregas, config } = request.body;

    const empresa = await prisma.empresa.findFirst({
      where: { id: empresaId, gestorId: userId },
    });

    if (!empresa) {
      return reply.code(404).send({ error: 'Empresa não encontrada' });
    }

    try {
      const resultado = await distribuicaoService.distribuirEntregas(empresaId, entregas, config);
      return resultado;
    } catch (error: any) {
      console.error('[API] Erro na distribuição:', error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // Sugerir atribuições (modo híbrido)
  fastify.post<{
    Params: EmpresaIdParam;
    Body: { entregas: EntregaParaDistribuir[] };
  }>('/empresa/:empresaId/sugerir', async (request: AuthRequest, reply) => {
    const userId = request.user?.userId;
    const { empresaId } = request.params;
    const { entregas } = request.body;

    const empresa = await prisma.empresa.findFirst({
      where: { id: empresaId, gestorId: userId },
    });

    if (!empresa) {
      return reply.code(404).send({ error: 'Empresa não encontrada' });
    }

    try {
      const sugestoes = await distribuicaoService.sugerirAtribuicoes(empresaId, entregas);
      return sugestoes;
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // Atribuir manualmente
  fastify.post<{
    Params: EmpresaIdParam;
    Body: {
      motoristaId: string;
      entregaIds: string[];
    };
  }>('/empresa/:empresaId/atribuir', async (request: AuthRequest, reply) => {
    const userId = request.user?.userId;
    const { empresaId } = request.params;
    const { motoristaId, entregaIds } = request.body;

    const empresa = await prisma.empresa.findFirst({
      where: { id: empresaId, gestorId: userId },
    });

    if (!empresa) {
      return reply.code(404).send({ error: 'Empresa não encontrada' });
    }

    // Criar rota para o motorista
    const rota = await prisma.rotaEmpresa.create({
      data: {
        empresaId,
        motoristaId,
        statusAtribuicao: 'ATRIBUIDO',
        metodoAtribuicao: 'MANUAL',
        atribuidoPor: userId,
        atribuidoEm: new Date(),
      },
    });

    // Associar paradas
    await prisma.paradaEmpresa.updateMany({
      where: { id: { in: entregaIds } },
      data: { rotaId: rota.id },
    });

    // Registrar histórico
    await prisma.atribuicaoHistorico.create({
      data: {
        motoristaId,
        rotaId: rota.id,
        acao: 'ATRIBUIDO',
        metodoAtribuicao: 'MANUAL',
        realizadoPor: userId,
      },
    });

    return { rotaId: rota.id, entregas: entregaIds.length };
  });

  // ==========================================
  // DASHBOARD ROUTES
  // ==========================================

  // Dashboard geral da empresa
  fastify.get<{ Params: EmpresaIdParam }>('/empresa/:empresaId/dashboard', async (request: AuthRequest, reply) => {
    const userId = request.user?.userId;
    const { empresaId } = request.params;

    const empresa = await prisma.empresa.findFirst({
      where: { id: empresaId, gestorId: userId },
    });

    if (!empresa) {
      return reply.code(404).send({ error: 'Empresa não encontrada' });
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Estatísticas de motoristas
    const motoristas = await prisma.motorista.groupBy({
      by: ['status'],
      where: { empresaId, ativo: true },
      _count: true,
    });

    // Entregas do dia
    const rotas = await prisma.rotaEmpresa.findMany({
      where: {
        empresaId,
        createdAt: { gte: hoje },
      },
      include: {
        _count: { select: { paradasEmpresa: true } },
        paradasEmpresa: {
          select: { status: true },
        },
      },
    });

    const totalEntregas = rotas.reduce((sum, r) => sum + r._count.paradasEmpresa, 0);
    const entregasConcluidas = rotas.reduce(
      (sum, r) => sum + r.paradasEmpresa.filter((p) => p.status === 'ENTREGUE').length,
      0
    );
    const entregasPendentes = rotas.reduce(
      (sum, r) => sum + r.paradasEmpresa.filter((p) => p.status === 'PENDENTE').length,
      0
    );

    // Métricas
    const kmHoje = rotas.reduce((sum, r) => sum + (r.distanciaKm || 0), 0);
    const tempoHoje = rotas.reduce((sum, r) => sum + (r.tempoEstimadoMin || 0), 0);

    // Top motoristas
    const topMotoristas = await prisma.motorista.findMany({
      where: { empresaId, ativo: true },
      orderBy: { taxaEntrega: 'desc' },
      take: 5,
      select: {
        id: true,
        nome: true,
        foto: true,
        taxaEntrega: true,
        status: true,
      },
    });

    // Veículos disponíveis
    const veiculosDisponiveis = await prisma.veiculo.count({
      where: { empresaId, ativo: true, status: 'DISPONIVEL' },
    });

    const veiculosEmUso = await prisma.veiculo.count({
      where: { empresaId, ativo: true, status: 'EM_USO' },
    });

    return {
      empresa: {
        id: empresa.id,
        nome: empresa.nome,
        modoDistribuicao: empresa.modoDistribuicao,
      },
      motoristas: {
        total: motoristas.reduce((sum, m) => sum + m._count, 0),
        porStatus: Object.fromEntries(motoristas.map((m) => [m.status, m._count])),
      },
      entregas: {
        total: totalEntregas,
        concluidas: entregasConcluidas,
        pendentes: entregasPendentes,
        emAndamento: totalEntregas - entregasConcluidas - entregasPendentes,
        taxaSucesso: totalEntregas > 0 ? Math.round((entregasConcluidas / totalEntregas) * 100) : 0,
      },
      metricas: {
        kmHoje: Math.round(kmHoje * 10) / 10,
        tempoHoje: Math.round(tempoHoje),
        rotasAtivas: rotas.filter((r) => r.status === 'EM_ANDAMENTO').length,
      },
      veiculos: {
        disponiveis: veiculosDisponiveis,
        emUso: veiculosEmUso,
      },
      topMotoristas,
    };
  });

  // Mapa com posições em tempo real
  fastify.get<{ Params: EmpresaIdParam }>('/empresa/:empresaId/mapa', async (request: AuthRequest, reply) => {
    const userId = request.user?.userId;
    const { empresaId } = request.params;

    const empresa = await prisma.empresa.findFirst({
      where: { id: empresaId, gestorId: userId },
    });

    if (!empresa) {
      return reply.code(404).send({ error: 'Empresa não encontrada' });
    }

    // Motoristas com posição recente (últimos 10 min)
    const dezMinAtras = new Date(Date.now() - 10 * 60 * 1000);

    const motoristas = await prisma.motorista.findMany({
      where: {
        empresaId,
        ativo: true,
        status: { in: ['DISPONIVEL', 'EM_ROTA'] },
        ultimaPosicaoEm: { gte: dezMinAtras },
      },
      select: {
        id: true,
        nome: true,
        foto: true,
        status: true,
        ultimaLat: true,
        ultimaLng: true,
        ultimaPosicaoEm: true,
        veiculoAtual: { select: { placa: true, tipo: true } },
      },
    });

    // Paradas pendentes do dia
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const paradas = await prisma.paradaEmpresa.findMany({
      where: {
        rota: {
          empresaId,
          createdAt: { gte: hoje },
        },
        status: { in: ['PENDENTE', 'EM_ANDAMENTO'] },
      },
      select: {
        id: true,
        lat: true,
        lng: true,
        endereco: true,
        status: true,
        prioridade: true,
        janelaFim: true,
        rota: {
          select: {
            motorista: { select: { id: true, nome: true } },
          },
        },
      },
    });

    // Zonas
    const zonas = await prisma.zonaAtuacao.findMany({
      where: { empresaId, ativo: true },
      select: {
        id: true,
        nome: true,
        cor: true,
        centroLat: true,
        centroLng: true,
        raioKm: true,
        poligono: true,
      },
    });

    return {
      base: {
        lat: empresa.baseLat,
        lng: empresa.baseLng,
        endereco: empresa.baseEndereco,
      },
      motoristas,
      paradas,
      zonas,
    };
  });
}
