/**
 * @file usePOD.ts
 * @description Hook para gerenciar Proof of Delivery
 * 
 * Design por Contrato:
 * @pre usuário autenticado
 * @pre plano permite POD (FULL, FROTA)
 * @post POD registrado no servidor
 */

import { useState, useCallback } from 'react';
import { API_URL } from '../config';

// ==========================================
// TIPOS
// ==========================================

export type TipoPOD = 'FOTO' | 'ASSINATURA' | 'CODIGO';

export interface PODData {
  id: string;
  paradaId: string;
  tipo: TipoPOD;
  fotoUrl?: string;
  assinaturaUrl?: string;
  codigo?: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  distanciaMetros?: number;
  alertaDistancia: boolean;
}

export interface RegistrarPODParams {
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

interface UsePODReturn {
  loading: boolean;
  error: string | null;
  podHabilitado: boolean;
  registrarPOD: (params: RegistrarPODParams) => Promise<PODData | null>;
  buscarPOD: (paradaId: string) => Promise<PODData | null>;
  verificarPlano: () => Promise<boolean>;
  capturarFoto: () => Promise<string | null>;
  capturarAssinatura: () => Promise<string | null>;
  obterGeolocalizacao: () => Promise<{ latitude: number; longitude: number; precisaoGps: number } | null>;
}

// ==========================================
// CONSTANTES
// ==========================================

const _PLANOS_COM_POD = ['FULL', 'FROTA', 'ENTERPRISE'];
void _PLANOS_COM_POD; // Reservado para uso futuro

// ==========================================
// HOOK
// ==========================================

export function usePOD(): UsePODReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [podHabilitado, setPodHabilitado] = useState(false);

  /**
   * Verificar se plano do usuário permite POD
   */
  const verificarPlano = useCallback(async (): Promise<boolean> => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setPodHabilitado(false);
        return false;
      }

      const response = await fetch(`${API_URL}/api/v1/pod/verificar-plano`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        setPodHabilitado(false);
        return false;
      }

      const data = await response.json();
      setPodHabilitado(data.podHabilitado);
      return data.podHabilitado;
    } catch (err) {
      console.error('[POD] Erro ao verificar plano:', err);
      setPodHabilitado(false);
      return false;
    }
  }, []);

  /**
   * Registrar comprovante de entrega
   * 
   * @pre paradaId válido
   * @pre dados do tipo correspondente preenchidos
   * @post POD criado no servidor
   */
  const registrarPOD = useCallback(async (params: RegistrarPODParams): Promise<PODData | null> => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Usuário não autenticado');
        return null;
      }

      const response = await fetch(`${API_URL}/api/v1/pod`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error?.message || 'Erro ao registrar comprovante';
        setError(errorMsg);
        return null;
      }

      return data.pod;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMsg);
      console.error('[POD] Erro ao registrar:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Buscar POD de uma parada
   */
  const buscarPOD = useCallback(async (paradaId: string): Promise<PODData | null> => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;

      const response = await fetch(`${API_URL}/api/v1/pod/${paradaId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data.pod;
    } catch (err) {
      console.error('[POD] Erro ao buscar:', err);
      return null;
    }
  }, []);

  /**
   * Capturar foto usando câmera do dispositivo
   * 
   * @post retorna base64 da imagem ou null
   */
  const capturarFoto = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      // Criar input file para captura
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment'; // Câmera traseira
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        try {
          // Comprimir imagem antes de converter
          const compressedBase64 = await comprimirImagem(file, 800, 0.7);
          resolve(compressedBase64);
        } catch (err) {
          console.error('[POD] Erro ao capturar foto:', err);
          resolve(null);
        }
      };

      input.oncancel = () => resolve(null);
      input.click();
    });
  }, []);

  /**
   * Capturar assinatura (placeholder - implementar canvas depois)
   */
  const capturarAssinatura = useCallback(async (): Promise<string | null> => {
    // TODO: Implementar modal com canvas para assinatura
    setError('Captura de assinatura será implementada em breve');
    return null;
  }, []);

  /**
   * Obter geolocalização atual
   * 
   * @post retorna coordenadas ou null
   */
  const obterGeolocalizacao = useCallback(async (): Promise<{ 
    latitude: number; 
    longitude: number; 
    precisaoGps: number;
  } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setError('Geolocalização não suportada');
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            precisaoGps: position.coords.accuracy,
          });
        },
        (err) => {
          console.error('[POD] Erro de geolocalização:', err);
          setError('Não foi possível obter localização');
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }, []);

  return {
    loading,
    error,
    podHabilitado,
    registrarPOD,
    buscarPOD,
    verificarPlano,
    capturarFoto,
    capturarAssinatura,
    obterGeolocalizacao,
  };
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

/**
 * Comprimir imagem para reduzir tamanho do base64
 */
async function comprimirImagem(
  file: File,
  maxWidth: number = 800,
  quality: number = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Redimensionar se necessário
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas não suportado'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Converter para base64 com compressão
        const base64 = canvas.toDataURL('image/jpeg', quality);
        resolve(base64);
      };

      img.onerror = () => reject(new Error('Erro ao carregar imagem'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

export default usePOD;
