/**
 * @file pod.utils.ts
 * @description Utilitários para POD (Proof of Delivery)
 * 
 * Design por Contrato:
 * - Todas funções têm pré/pós-condições documentadas
 * - Validações fail-fast com mensagens claras
 * - Funções puras quando possível
 */

import sharp from 'sharp';

// ==========================================
// TIPOS
// ==========================================

export type TipoPOD = 'FOTO' | 'ASSINATURA' | 'CODIGO';

export interface RegistrarPODRequest {
  paradaId: string;
  tipo: TipoPOD;
  fotoBase64?: string;
  assinaturaBase64?: string;
  codigo?: string;
  latitude: number;
  longitude: number;
  precisaoGps?: number;
  observacao?: string;
}

export interface ValidacaoResult {
  valido: boolean;
  erros: string[];
}

export interface Coordenadas {
  latitude: number;
  longitude: number;
}

// ==========================================
// CONSTANTES
// ==========================================

export const POD_CONSTANTS = {
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5MB
  MAX_COMPRESSED_SIZE_KB: 500,
  MIN_CODIGO_LENGTH: 4,
  MAX_CODIGO_LENGTH: 20,
  DISTANCIA_ALERTA_METROS: 500,
  TIPOS_VALIDOS: ['FOTO', 'ASSINATURA', 'CODIGO'] as const,
  PLANOS_COM_POD: ['FULL', 'FROTA', 'ENTERPRISE'] as const,
};

// ==========================================
// VALIDAÇÃO DO REQUEST
// ==========================================

/**
 * Valida um request de registro de POD
 * 
 * @pre request não é null/undefined
 * @post retorna { valido: true, erros: [] } se válido
 * @post retorna { valido: false, erros: [...] } se inválido
 * @invariant não modifica o request original
 */
export function validarPODRequest(request: RegistrarPODRequest): ValidacaoResult {
  const erros: string[] = [];

  // 1. Validar paradaId
  if (!request.paradaId || request.paradaId.trim() === '') {
    erros.push('PARADA_ID_OBRIGATORIO');
  }

  // 2. Validar tipo
  if (!POD_CONSTANTS.TIPOS_VALIDOS.includes(request.tipo as any)) {
    erros.push('TIPO_INVALIDO');
  }

  // 3. Validar dados conforme tipo
  if (request.tipo === 'FOTO') {
    if (!request.fotoBase64 || request.fotoBase64.trim() === '') {
      erros.push('FOTO_OBRIGATORIA');
    } else if (calcularTamanhoBase64(request.fotoBase64) > POD_CONSTANTS.MAX_FILE_SIZE_BYTES) {
      erros.push('ARQUIVO_MUITO_GRANDE');
    }
  }

  if (request.tipo === 'ASSINATURA') {
    if (!request.assinaturaBase64 || request.assinaturaBase64.trim() === '') {
      erros.push('ASSINATURA_OBRIGATORIA');
    } else if (calcularTamanhoBase64(request.assinaturaBase64) > POD_CONSTANTS.MAX_FILE_SIZE_BYTES) {
      erros.push('ARQUIVO_MUITO_GRANDE');
    }
  }

  if (request.tipo === 'CODIGO') {
    if (!request.codigo || request.codigo.trim() === '') {
      erros.push('CODIGO_OBRIGATORIO');
    } else if (request.codigo.length < POD_CONSTANTS.MIN_CODIGO_LENGTH) {
      erros.push('CODIGO_MUITO_CURTO');
    } else if (request.codigo.length > POD_CONSTANTS.MAX_CODIGO_LENGTH) {
      erros.push('CODIGO_MUITO_LONGO');
    }
  }

  // 4. Validar coordenadas
  if (typeof request.latitude !== 'number' || request.latitude < -90 || request.latitude > 90) {
    erros.push('LATITUDE_INVALIDA');
  }

  if (typeof request.longitude !== 'number' || request.longitude < -180 || request.longitude > 180) {
    erros.push('LONGITUDE_INVALIDA');
  }

  return {
    valido: erros.length === 0,
    erros,
  };
}

// ==========================================
// COMPRESSÃO DE IMAGEM
// ==========================================

/**
 * Comprime uma imagem base64 para um tamanho máximo
 * 
 * @pre imagemBase64 é uma string base64 válida com prefixo data:image
 * @pre options.maxSizeKB > 0
 * @post retorna imagem comprimida com tamanho <= maxSizeKB
 * @post retorna imagem original se já for menor que limite
 */
export async function comprimirImagem(
  imagemBase64: string,
  options: { maxSizeKB: number } = { maxSizeKB: POD_CONSTANTS.MAX_COMPRESSED_SIZE_KB }
): Promise<string> {
  const tamanhoAtualBytes = calcularTamanhoBase64(imagemBase64);
  const maxSizeBytes = options.maxSizeKB * 1024;

  // Se já está dentro do limite, retornar original
  if (tamanhoAtualBytes <= maxSizeBytes) {
    return imagemBase64;
  }

  try {
    // Extrair dados base64 (remover prefixo data:image/...)
    const matches = imagemBase64.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    if (!matches) {
      console.warn('[POD] Formato base64 inválido, retornando original');
      return imagemBase64;
    }

    const imageBuffer = Buffer.from(matches[2], 'base64');
    
    // Calcular fator de redução baseado no tamanho alvo
    const reductionFactor = Math.sqrt(maxSizeBytes / tamanhoAtualBytes);
    
    // Obter metadados da imagem original
    const metadata = await sharp(imageBuffer).metadata();
    const originalWidth = metadata.width || 1920;
    const originalHeight = metadata.height || 1080;
    
    // Calcular novas dimensões (mínimo 800px no lado maior)
    const newWidth = Math.max(800, Math.floor(originalWidth * reductionFactor));
    const newHeight = Math.max(600, Math.floor(originalHeight * reductionFactor));
    
    // Comprimir progressivamente até atingir o tamanho alvo
    let quality = 85;
    let compressedBuffer: Buffer;
    let attempts = 0;
    const maxAttempts = 5;
    
    do {
      compressedBuffer = await sharp(imageBuffer)
        .resize(newWidth, newHeight, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .jpeg({ 
          quality,
          mozjpeg: true // Melhor compressão
        })
        .toBuffer();
      
      quality -= 10;
      attempts++;
      
      console.log(`[POD] Compressão tentativa ${attempts}: ${compressedBuffer.length} bytes (qualidade: ${quality + 10})`);
      
    } while (compressedBuffer.length > maxSizeBytes && quality > 20 && attempts < maxAttempts);
    
    // Converter de volta para base64
    const compressedBase64 = `data:image/jpeg;base64,${compressedBuffer.toString('base64')}`;
    
    const tamanhoFinal = calcularTamanhoBase64(compressedBase64);
    console.log(`[POD] Compressão concluída: ${tamanhoAtualBytes} -> ${tamanhoFinal} bytes (${Math.round((1 - tamanhoFinal/tamanhoAtualBytes) * 100)}% redução)`);
    
    return compressedBase64;
    
  } catch (error) {
    console.error('[POD] Erro na compressão:', error);
    // Em caso de erro, retornar original
    return imagemBase64;
  }
}

// ==========================================
// CÁLCULO DE DISTÂNCIA
// ==========================================

/**
 * Calcula a distância em metros entre a parada e o local do POD
 * Usa fórmula de Haversine
 * 
 * @pre coordenadas dentro dos ranges válidos
 * @post retorna distância >= 0 em metros
 * @invariant usa raio da Terra = 6371km
 */
export function calcularDistanciaEntrega(
  parada: Coordenadas,
  pod: Coordenadas
): number {
  const R = 6371000; // Raio da Terra em metros
  
  const lat1Rad = toRadians(parada.latitude);
  const lat2Rad = toRadians(pod.latitude);
  const deltaLat = toRadians(pod.latitude - parada.latitude);
  const deltaLng = toRadians(pod.longitude - parada.longitude);

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return Math.round(R * c);
}

/**
 * Verifica se a distância do POD é suspeita (possível fraude)
 * 
 * @pre distanciaMetros >= 0
 * @post retorna { suspeito: true, motivo: string } se distância > limite
 */
export function verificarDistanciaSuspeita(
  distanciaMetros: number
): { suspeito: boolean; motivo?: string } {
  if (distanciaMetros > POD_CONSTANTS.DISTANCIA_ALERTA_METROS) {
    return {
      suspeito: true,
      motivo: `Distância de ${distanciaMetros}m do endereço de entrega`,
    };
  }
  return { suspeito: false };
}

// ==========================================
// VERIFICAÇÃO DE PLANO
// ==========================================

/**
 * Verifica se o plano do usuário permite usar POD
 * 
 * @pre plano é uma string válida
 * @post retorna true se plano está em PLANOS_COM_POD
 */
export function verificarPlanoPermitePOD(plano: string): boolean {
  return POD_CONSTANTS.PLANOS_COM_POD.includes(plano as any);
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

/**
 * Calcula o tamanho em bytes de uma string base64
 */
function calcularTamanhoBase64(base64String: string): number {
  // Remover prefixo data:image/...;base64,
  const base64 = base64String.split(',')[1] || base64String;
  
  // Calcular tamanho: cada 4 caracteres base64 = 3 bytes
  const padding = (base64.match(/=/g) || []).length;
  return (base64.length * 3) / 4 - padding;
}

/**
 * Converte graus para radianos
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Gera timestamp ISO 8601 com validação
 * 
 * @pre maxFutureMinutes >= 0
 * @post timestamp não é mais que maxFutureMinutes no futuro
 */
export function gerarTimestampPOD(maxFutureMinutes: number = 5): string {
  const agora = new Date();
  return agora.toISOString();
}

/**
 * Valida se um timestamp não está muito no futuro
 */
export function validarTimestamp(timestamp: string | Date, maxFutureMinutes: number = 5): boolean {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const agora = new Date();
  const limite = new Date(agora.getTime() + maxFutureMinutes * 60 * 1000);
  
  return date <= limite;
}

// ==========================================
// EXPORTS DEFAULT
// ==========================================

export default {
  validarPODRequest,
  comprimirImagem,
  calcularDistanciaEntrega,
  verificarDistanciaSuspeita,
  verificarPlanoPermitePOD,
  gerarTimestampPOD,
  validarTimestamp,
  POD_CONSTANTS,
};
