/**
 * ==========================================
 * CONTRATO: 3 Features Sprint 9-10
 * ==========================================
 * Seguindo: PDCA + Design por Contrato + TDD Light
 * Data: 05/02/2026
 * ==========================================
 */

// ==========================================
// FEATURE 1: CAPACIDADE DE VEÍCULO
// ==========================================
/**
 * @description Controle de carga do veículo (peso/volume)
 * 
 * @pre Veículo tem capacidadeKg, capacidadeVolumes, capacidadeM3
 * @pre Paradas têm peso e volumes opcionais
 * @post Sistema impede atribuição que ultrapasse capacidade
 * @post UI mostra % de ocupação em tempo real
 * 
 * @invariant cargaAtual <= capacidadeMax (sempre)
 * @invariant alertar quando > 80% da capacidade
 * 
 * CRITÉRIOS DE QUALIDADE:
 * 1. Não atribuir paradas que ultrapassem limite
 * 2. Calcular carga restante após cada entrega
 * 3. Considerar retorno (entregas diminuem carga)
 * 4. Mostrar barra visual de ocupação
 * 
 * TESTES:
 * - Caso normal: 5 paradas com 10kg cada, veículo 100kg = OK
 * - Caso borda: 5 paradas com 10kg cada, veículo 50kg = FALHA
 * - Caso erro: Parada sem peso = usar default 1kg
 */

interface CapacidadeVeiculo {
  capacidadeKg: number;
  capacidadeVolumes: number;
  capacidadeM3?: number;
}

interface CargaAtual {
  pesoKg: number;         // Soma dos pesos das paradas
  volumes: number;        // Soma dos volumes
  percentualPeso: number; // 0-100%
  percentualVolumes: number;
  podeAdicionar: (peso: number, volumes: number) => boolean;
}

// ==========================================
// FEATURE 2: GEOFENCING
// ==========================================
/**
 * @description Alertas de entrada/saída de zonas geográficas
 * 
 * @pre ZonaAtuacao tem polígono OU centro+raio
 * @pre Motorista envia posição periodicamente
 * @post Evento gerado quando cruza fronteira
 * @post Notificação push para gestor
 * 
 * @invariant Um ponto está "dentro" se:
 *   - Polígono: ray casting algorithm
 *   - Círculo: distância < raioKm
 * 
 * CRITÉRIOS DE QUALIDADE:
 * 1. Precisão: margem de erro < 50m
 * 2. Latência: evento em < 5s após cruzar
 * 3. Debounce: não disparar múltiplos eventos em < 30s
 * 4. Histórico: log de todos os eventos
 * 
 * EVENTOS:
 * - geofence.entrada
 * - geofence.saida
 * - geofence.tempo_zona (quando está > X min)
 * 
 * TESTES:
 * - Caso normal: Motorista cruza zona A → evento entrada
 * - Caso borda: Motorista na fronteira (flapping) → debounce
 * - Caso erro: Zona sem polígono/raio = ignorar
 */

interface EventoGeofence {
  id: string;
  motoristaId: string;
  zonaId: string;
  tipo: 'ENTRADA' | 'SAIDA' | 'TEMPO_EXCEDIDO';
  lat: number;
  lng: number;
  timestamp: Date;
  tempoNaZonaMin?: number;
}

// ==========================================
// FEATURE 3: INTEGRAÇÃO SEFAZ
// ==========================================
/**
 * @description Consulta NF-e diretamente na SEFAZ
 * 
 * @pre Chave de acesso NF-e (44 dígitos)
 * @pre Certificado digital A1 ou A3 (empresa)
 * @post XML da NF-e retornado e parseado
 * @post Endereço do destinatário extraído
 * 
 * @invariant Chave válida = 44 dígitos numéricos
 * @invariant UF válida (2 primeiros dígitos)
 * 
 * CRITÉRIOS DE QUALIDADE:
 * 1. Timeout: máx 10s por consulta
 * 2. Retry: 3 tentativas com backoff
 * 3. Cache: guardar XML por 7 dias
 * 4. Fallback: se SEFAZ offline, informar
 * 
 * FLUXO:
 * 1. Receber chave(s) de acesso
 * 2. Consultar SEFAZ (WS NFeConsulta)
 * 3. Parsear XML
 * 4. Extrair: dest.nome, dest.endereco, dest.cidade, dest.UF
 * 5. Criar paradas automaticamente
 * 
 * TESTES:
 * - Caso normal: Chave válida → NF-e retornada
 * - Caso borda: NF-e cancelada → não criar parada
 * - Caso erro: Chave inválida → erro 400
 */

interface ConsultaSefaz {
  chaveAcesso: string;     // 44 dígitos
  uf: string;              // Extrai dos 2 primeiros
  ambiente: 'producao' | 'homologacao';
}

interface ResultadoSefaz {
  sucesso: boolean;
  nfe?: {
    chave: string;
    numero: string;
    serie: string;
    dataEmissao: Date;
    status: 'AUTORIZADA' | 'CANCELADA' | 'DENEGADA';
    emitente: {
      cnpj: string;
      nome: string;
    };
    destinatario: {
      cpfCnpj: string;
      nome: string;
      endereco: string;
      numero: string;
      complemento?: string;
      bairro: string;
      cidade: string;
      uf: string;
      cep: string;
      telefone?: string;
    };
    volumes: number;
    pesoLiquido: number;
    pesoBruto: number;
    valorTotal: number;
  };
  erro?: string;
}

export {
  CapacidadeVeiculo,
  CargaAtual,
  EventoGeofence,
  ConsultaSefaz,
  ResultadoSefaz
};
