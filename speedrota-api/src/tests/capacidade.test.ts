/**
 * @file capacidade.test.ts
 * @description Testes unitários para Capacidade de Veículo
 * 
 * TDD Light: 3 categorias de testes
 * 1. Caso normal (happy path)
 * 2. Casos de borda (limites)
 * 3. Casos de erro (validações)
 */

import { describe, it, expect } from 'vitest';
import {
  validarCapacidade,
  validarCargaRota,
  obterCapacidadePadrao,
  CAPACIDADE_PADRAO
} from '../services/capacidade.js';

// ==========================================
// 1. TESTES DE VALIDAÇÃO DE CAPACIDADE
// ==========================================

describe('validarCapacidade', () => {
  // --- CASO NORMAL ---
  describe('Caso Normal (Happy Path)', () => {
    it('deve retornar cabe=true quando carga está dentro da capacidade', () => {
      const veiculo = {
        tipo: 'VAN' as const,
        capacidadeKg: 1000,
        capacidadeVolumes: 100
      };
      const carga = {
        pesoKg: 500,
        volumes: 50
      };

      const resultado = validarCapacidade(veiculo, carga);

      expect(resultado.cabe).toBe(true);
      expect(resultado.percentualPeso).toBe(50);
      expect(resultado.percentualVolumes).toBe(50);
      expect(resultado.alertas).toHaveLength(0);
    });

    it('deve calcular margem restante corretamente', () => {
      const veiculo = {
        tipo: 'CARRO' as const,
        capacidadeKg: 300,
        capacidadeVolumes: 30
      };
      const carga = { pesoKg: 200, volumes: 20 };

      const resultado = validarCapacidade(veiculo, carga);

      expect(resultado.margemPesoKg).toBe(100);
      expect(resultado.margemVolumes).toBe(10);
    });
  });

  // --- CASOS DE BORDA ---
  describe('Casos de Borda', () => {
    it('deve alertar quando carga está em 90% da capacidade', () => {
      const veiculo = {
        tipo: 'VAN' as const,
        capacidadeKg: 1000,
        capacidadeVolumes: 100
      };
      const carga = { pesoKg: 900, volumes: 50 };

      const resultado = validarCapacidade(veiculo, carga);

      expect(resultado.cabe).toBe(true);
      expect(resultado.alertas.some(a => a.tipo === 'LIMITE_PROXIMO')).toBe(true);
    });

    it('deve aceitar carga em exatamente 100%', () => {
      const veiculo = {
        tipo: 'VAN' as const,
        capacidadeKg: 1000,
        capacidadeVolumes: 100
      };
      const carga = { pesoKg: 1000, volumes: 100 };

      const resultado = validarCapacidade(veiculo, carga);

      expect(resultado.cabe).toBe(true);
      expect(resultado.percentualPeso).toBe(100);
    });

    it('deve aceitar carga vazia (0 kg, 0 volumes)', () => {
      const veiculo = {
        tipo: 'MOTO' as const,
        capacidadeKg: 25,
        capacidadeVolumes: 8
      };
      const carga = { pesoKg: 0, volumes: 0 };

      const resultado = validarCapacidade(veiculo, carga);

      expect(resultado.cabe).toBe(true);
      expect(resultado.percentualPeso).toBe(0);
    });
  });

  // --- CASOS DE ERRO ---
  describe('Casos de Erro', () => {
    it('deve retornar cabe=false quando peso excede capacidade', () => {
      const veiculo = {
        tipo: 'MOTO' as const,
        capacidadeKg: 25,
        capacidadeVolumes: 8
      };
      const carga = { pesoKg: 30, volumes: 5 };

      const resultado = validarCapacidade(veiculo, carga);

      expect(resultado.cabe).toBe(false);
      expect(resultado.alertas.some(a => a.tipo === 'SOBRECARGA_PESO')).toBe(true);
    });

    it('deve retornar cabe=false quando volumes excedem capacidade', () => {
      const veiculo = {
        tipo: 'CARRO' as const,
        capacidadeKg: 300,
        capacidadeVolumes: 30
      };
      const carga = { pesoKg: 100, volumes: 50 };

      const resultado = validarCapacidade(veiculo, carga);

      expect(resultado.cabe).toBe(false);
      expect(resultado.alertas.some(a => a.tipo === 'SOBRECARGA_VOLUME')).toBe(true);
    });

    it('deve lançar erro para capacidade negativa', () => {
      const veiculo = {
        tipo: 'VAN' as const,
        capacidadeKg: -100,
        capacidadeVolumes: 50
      };
      const carga = { pesoKg: 50, volumes: 25 };

      expect(() => validarCapacidade(veiculo, carga)).toThrow('Capacidade do veículo deve ser positiva');
    });

    it('deve lançar erro para carga negativa', () => {
      const veiculo = {
        tipo: 'VAN' as const,
        capacidadeKg: 1000,
        capacidadeVolumes: 100
      };
      const carga = { pesoKg: -10, volumes: 50 };

      expect(() => validarCapacidade(veiculo, carga)).toThrow('Carga não pode ser negativa');
    });
  });
});

// ==========================================
// 2. TESTES DE CARGA POR ROTA
// ==========================================

describe('validarCargaRota', () => {
  it('deve somar corretamente peso de todas as paradas', () => {
    const veiculo = {
      tipo: 'VAN' as const,
      capacidadeKg: 1000,
      capacidadeVolumes: 100
    };
    const itens = [
      { paradaId: 'p1', pesoKg: 100, volumes: 10 },
      { paradaId: 'p2', pesoKg: 200, volumes: 20 },
      { paradaId: 'p3', pesoKg: 150, volumes: 15 }
    ];

    const resultado = validarCargaRota(veiculo, itens);

    expect(resultado.cabe).toBe(true);
    expect(resultado.percentualPeso).toBe(45); // 450/1000 * 100
    expect(resultado.detalhes).toHaveLength(3);
    expect(resultado.detalhes[2].acumulado.pesoKg).toBe(450);
  });

  it('deve retornar cabe=false se soma excede capacidade', () => {
    const veiculo = {
      tipo: 'MOTO' as const,
      capacidadeKg: 25,
      capacidadeVolumes: 8
    };
    const itens = [
      { paradaId: 'p1', pesoKg: 10, volumes: 3 },
      { paradaId: 'p2', pesoKg: 10, volumes: 3 },
      { paradaId: 'p3', pesoKg: 10, volumes: 3 } // Total: 30kg > 25kg
    ];

    const resultado = validarCargaRota(veiculo, itens);

    expect(resultado.cabe).toBe(false);
  });
});

// ==========================================
// 3. TESTES DE CAPACIDADE PADRÃO
// ==========================================

describe('obterCapacidadePadrao', () => {
  it('deve retornar capacidade padrão para MOTO', () => {
    const cap = obterCapacidadePadrao('MOTO');

    expect(cap.capacidadeKg).toBe(25);
    expect(cap.capacidadeVolumes).toBe(8);
  });

  it('deve retornar capacidade padrão para CAMINHAO', () => {
    const cap = obterCapacidadePadrao('CAMINHAO');

    expect(cap.capacidadeKg).toBe(8000);
    expect(cap.capacidadeVolumes).toBe(500);
  });

  it('deve ter todos os tipos de veículo configurados', () => {
    const tipos = ['MOTO', 'BIKE', 'CARRO', 'VAN', 'CAMINHAO_LEVE', 'CAMINHAO'] as const;

    tipos.forEach(tipo => {
      const cap = CAPACIDADE_PADRAO[tipo];
      expect(cap).toBeDefined();
      expect(cap.capacidadeKg).toBeGreaterThan(0);
      expect(cap.capacidadeVolumes).toBeGreaterThan(0);
    });
  });
});
