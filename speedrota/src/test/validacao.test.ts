/**
 * @fileoverview Testes unitários para funções de validação
 * 
 * SANITY CHECKS implementados:
 * - Coordenadas válidas
 * - Campos obrigatórios
 * - Duplicatas
 */

import { describe, it, expect } from 'vitest';
import {
  validarLatitude,
  validarLongitude,
  validarCoordenadas,
  validarOrigem,
  validarDestino,
  validarListaDestinos,
  validarParaCalculo,
} from '../utils/validacao';
import type { Origem, Destino } from '../types';

// ==========================================
// VALIDAÇÃO DE COORDENADAS
// ==========================================

describe('validarLatitude', () => {
  it('deve aceitar latitudes válidas', () => {
    expect(validarLatitude(-23.5505).valido).toBe(true);
    expect(validarLatitude(0).valido).toBe(true);
    expect(validarLatitude(-90).valido).toBe(true);
    expect(validarLatitude(90).valido).toBe(true);
  });

  it('deve rejeitar latitudes fora do range', () => {
    expect(validarLatitude(-91).valido).toBe(false);
    expect(validarLatitude(91).valido).toBe(false);
    expect(validarLatitude(-100).valido).toBe(false);
  });

  it('deve rejeitar valores não numéricos', () => {
    expect(validarLatitude(NaN).valido).toBe(false);
  });
});

describe('validarLongitude', () => {
  it('deve aceitar longitudes válidas', () => {
    expect(validarLongitude(-46.6333).valido).toBe(true);
    expect(validarLongitude(0).valido).toBe(true);
    expect(validarLongitude(-180).valido).toBe(true);
    expect(validarLongitude(180).valido).toBe(true);
  });

  it('deve rejeitar longitudes fora do range', () => {
    expect(validarLongitude(-181).valido).toBe(false);
    expect(validarLongitude(181).valido).toBe(false);
  });
});

describe('validarCoordenadas', () => {
  it('deve aceitar coordenadas no Brasil', () => {
    const resultado = validarCoordenadas(-23.5505, -46.6333);
    expect(resultado.valido).toBe(true);
    expect(resultado.avisos).toBeUndefined();
  });

  it('deve avisar sobre coordenadas fora do Brasil', () => {
    const resultado = validarCoordenadas(40.7128, -74.0060); // Nova York
    expect(resultado.valido).toBe(true);
    expect(resultado.avisos).toBeDefined();
    expect(resultado.avisos![0]).toContain('fora do Brasil');
  });
});

// ==========================================
// VALIDAÇÃO DE ORIGEM
// ==========================================

describe('validarOrigem', () => {
  it('deve aceitar origem válida via GPS', () => {
    const origem: Origem = {
      lat: -23.5505,
      lng: -46.6333,
      endereco: 'São Paulo, SP',
      fonte: 'gps',
      precisao: 10,
      timestamp: new Date(),
    };

    const resultado = validarOrigem(origem);
    expect(resultado.valido).toBe(true);
  });

  it('deve aceitar origem válida manual', () => {
    const origem: Origem = {
      lat: -22.9099,
      lng: -47.0626,
      endereco: 'Campinas, SP',
      fonte: 'manual',
      timestamp: new Date(),
    };

    const resultado = validarOrigem(origem);
    expect(resultado.valido).toBe(true);
  });

  it('deve rejeitar origem sem coordenadas', () => {
    const origem = {
      endereco: 'São Paulo',
      fonte: 'manual',
      timestamp: new Date(),
    } as Partial<Origem>;

    const resultado = validarOrigem(origem);
    expect(resultado.valido).toBe(false);
  });

  it('deve rejeitar origem sem endereço', () => {
    const origem = {
      lat: -23.5505,
      lng: -46.6333,
      endereco: '',
      fonte: 'manual',
      timestamp: new Date(),
    } as Origem;

    const resultado = validarOrigem(origem);
    expect(resultado.valido).toBe(false);
  });

  it('deve avisar sobre precisão GPS muito baixa', () => {
    const origem: Origem = {
      lat: -23.5505,
      lng: -46.6333,
      endereco: 'São Paulo, SP',
      fonte: 'gps',
      precisao: 1500, // > 1000m
      timestamp: new Date(),
    };

    const resultado = validarOrigem(origem);
    expect(resultado.valido).toBe(true);
    expect(resultado.avisos).toBeDefined();
  });
});

// ==========================================
// VALIDAÇÃO DE DESTINO
// ==========================================

describe('validarDestino', () => {
  const destinoValido: Destino = {
    id: '123',
    lat: -22.7394,
    lng: -47.3317,
    nome: 'Cliente Teste',
    endereco: 'Av. Brasil, 100',
    cidade: 'Americana',
    uf: 'SP',
    fonte: 'manual', fornecedor: 'outro',
    confianca: 0.9,
  };

  it('deve aceitar destino válido', () => {
    const resultado = validarDestino(destinoValido);
    expect(resultado.valido).toBe(true);
  });

  it('deve rejeitar destino sem ID', () => {
    const destino = { ...destinoValido, id: '' };
    expect(validarDestino(destino).valido).toBe(false);
  });

  it('deve rejeitar destino sem nome', () => {
    const destino = { ...destinoValido, nome: '' };
    expect(validarDestino(destino).valido).toBe(false);
  });

  it('deve rejeitar destino sem cidade', () => {
    const destino = { ...destinoValido, cidade: '' };
    expect(validarDestino(destino).valido).toBe(false);
  });

  it('deve rejeitar UF inválida', () => {
    const destino = { ...destinoValido, uf: 'SPP' };
    expect(validarDestino(destino).valido).toBe(false);
  });

  it('deve avisar sobre baixa confiança de geocoding', () => {
    const destino = { ...destinoValido, confianca: 0.3 };
    const resultado = validarDestino(destino);
    expect(resultado.valido).toBe(true);
    expect(resultado.avisos).toBeDefined();
  });
});

// ==========================================
// VALIDAÇÃO DE LISTA DE DESTINOS
// ==========================================

describe('validarListaDestinos', () => {
  const criarDestino = (id: string, lat: number, lng: number): Destino => ({
    id,
    lat,
    lng,
    nome: `Destino ${id}`,
    endereco: 'Rua Teste, 123',
    cidade: 'São Paulo',
    uf: 'SP',
    fonte: 'manual', fornecedor: 'outro',
    confianca: 0.9,
  });

  it('deve rejeitar lista vazia', () => {
    const resultado = validarListaDestinos([]);
    expect(resultado.valido).toBe(false);
    expect(resultado.erro).toContain('pelo menos 1 destino');
  });

  it('deve aceitar lista com um destino', () => {
    const destinos = [criarDestino('1', -23.5505, -46.6333)];
    const resultado = validarListaDestinos(destinos);
    expect(resultado.valido).toBe(true);
  });

  it('deve detectar destinos duplicados (coordenadas muito próximas)', () => {
    const destinos = [
      criarDestino('1', -23.5505, -46.6333),
      criarDestino('2', -23.5505, -46.6333), // Mesmas coordenadas
    ];
    
    const resultado = validarListaDestinos(destinos);
    expect(resultado.valido).toBe(true);
    expect(resultado.avisos).toBeDefined();
    expect(resultado.avisos!.some(a => a.includes('duplicados'))).toBe(true);
  });
});

// ==========================================
// VALIDAÇÃO PARA CÁLCULO
// ==========================================

describe('validarParaCalculo', () => {
  const origem: Origem = {
    lat: -23.5505,
    lng: -46.6333,
    endereco: 'São Paulo, SP',
    fonte: 'gps',
    timestamp: new Date(),
  };

  const destino: Destino = {
    id: '1',
    lat: -22.7394,
    lng: -47.3317,
    nome: 'Cliente',
    endereco: 'Rua Teste',
    cidade: 'Americana',
    uf: 'SP',
    fonte: 'manual', fornecedor: 'outro',
    confianca: 0.9,
  };

  it('deve rejeitar se origem não definida', () => {
    const resultado = validarParaCalculo(null, [destino]);
    expect(resultado.valido).toBe(false);
    expect(resultado.erro).toContain('origem');
  });

  it('deve rejeitar se não há destinos', () => {
    const resultado = validarParaCalculo(origem, []);
    expect(resultado.valido).toBe(false);
  });

  it('deve aceitar com origem e destino válidos', () => {
    const resultado = validarParaCalculo(origem, [destino]);
    expect(resultado.valido).toBe(true);
  });
});
