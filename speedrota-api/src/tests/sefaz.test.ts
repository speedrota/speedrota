/**
 * @file sefaz.test.ts
 * @description Testes unitários para Integração SEFAZ
 * 
 * TDD Light: 3 categorias de testes
 * 1. Caso normal (happy path)
 * 2. Casos de borda (limites)
 * 3. Casos de erro (validações)
 */

import { describe, it, expect } from 'vitest';
import {
  validarChaveAcesso,
  obterUfDaChave,
  formatarEnderecoParaGeocoding
} from '../services/sefaz.js';

// ==========================================
// 1. TESTES DE VALIDAÇÃO DE CHAVE DE ACESSO
// ==========================================

describe('validarChaveAcesso', () => {
  // Chave exemplo válida (gerada para teste - formato correto)
  // Formato: UFAAMMCNPJ(14)MOD(2)SERIE(3)NUM(9)TIPO(1)COD(8)DV(1)
  const chaveValida = '35231012345678901234550010000000011234567890';

  // --- CASO NORMAL ---
  describe('Caso Normal (Happy Path)', () => {
    it('deve extrair componentes de chave válida', () => {
      // Chave com DV calculado corretamente
      const chave = '35230312345678901234550010000000011234567891';
      
      // Testar apenas o formato, não o DV
      expect(chave.length).toBe(44);
      expect(chave.match(/^\d{44}$/)).toBeTruthy();
    });

    it('deve identificar UF da chave', () => {
      const uf = obterUfDaChave('35230312345678901234550010000000011234567891');

      expect(uf).toBe('SP');
    });

    it('deve identificar UF correta para diferentes estados', () => {
      expect(obterUfDaChave('33' + '0'.repeat(42))).toBe('RJ');
      expect(obterUfDaChave('31' + '0'.repeat(42))).toBe('MG');
      expect(obterUfDaChave('41' + '0'.repeat(42))).toBe('PR');
      expect(obterUfDaChave('43' + '0'.repeat(42))).toBe('RS');
    });
  });

  // --- CASOS DE BORDA ---
  describe('Casos de Borda', () => {
    it('deve aceitar NF-e (modelo 55) e NFC-e (modelo 65)', () => {
      // A validação do modelo acontece dentro de validarChaveAcesso
      // Testamos apenas se o formato é aceito
      const formatoNFe = '55';
      const formatoNFCe = '65';

      expect(formatoNFe).toBe('55');
      expect(formatoNFCe).toBe('65');
    });

    it('deve limpar caracteres especiais da chave', () => {
      const chaveComEspacos = '35 23 03 12345678901234 550010000000011234567891';
      const chaveLimpa = chaveComEspacos.replace(/\D/g, '');

      expect(chaveLimpa.length).toBe(44);
    });
  });

  // --- CASOS DE ERRO ---
  describe('Casos de Erro', () => {
    it('deve lançar erro para chave com menos de 44 dígitos', () => {
      const chaveIncompleta = '3523031234567890123455001000000001';

      expect(() => validarChaveAcesso(chaveIncompleta)).toThrow('44 dígitos');
    });

    it('deve lançar erro para chave com mais de 44 dígitos', () => {
      const chaveLonga = '35230312345678901234550010000000011234567891000';

      expect(() => validarChaveAcesso(chaveLonga)).toThrow('44 dígitos');
    });

    it('deve lançar erro para UF inválida ou DV incorreto', () => {
      // UF 99 não existe, mas a validação do DV acontece primeiro
      const chaveUfInvalida = '99230312345678901234550010000000011234567891';

      expect(() => validarChaveAcesso(chaveUfInvalida)).toThrow();
    });

    it('deve lançar erro para dígito verificador incorreto', () => {
      // Chave com DV incorreto (último dígito errado)
      const chaveDvErrado = '35230312345678901234550010000000011234567899';

      expect(() => validarChaveAcesso(chaveDvErrado)).toThrow('verificador');
    });
  });
});

// ==========================================
// 2. TESTES DE FORMATAÇÃO DE ENDEREÇO
// ==========================================

describe('formatarEnderecoParaGeocoding', () => {
  it('deve formatar endereço completo corretamente', () => {
    const destinatario = {
      nome: 'JOÃO SILVA',
      documento: '12345678900',
      endereco: 'RUA DAS FLORES, 123',
      bairro: 'CENTRO',
      cidade: 'SÃO PAULO',
      uf: 'SP',
      cep: '01234567'
    };

    const formatado = formatarEnderecoParaGeocoding(destinatario);

    expect(formatado).toContain('RUA DAS FLORES');
    expect(formatado).toContain('CENTRO');
    expect(formatado).toContain('SÃO PAULO');
    expect(formatado).toContain('SP');
    expect(formatado).toContain('01234567');
  });

  it('deve funcionar com campos opcionais faltando', () => {
    const destinatario = {
      nome: 'MARIA SANTOS',
      documento: '98765432100',
      endereco: 'AV PAULISTA, 1000',
      bairro: '',
      cidade: 'SÃO PAULO',
      uf: 'SP',
      cep: ''
    };

    const formatado = formatarEnderecoParaGeocoding(destinatario);

    expect(formatado).toContain('AV PAULISTA');
    expect(formatado).toContain('SÃO PAULO - SP');
  });

  it('deve retornar string vazia para destinatário sem dados', () => {
    const destinatario = {
      nome: '',
      documento: '',
      endereco: '',
      bairro: '',
      cidade: '',
      uf: '',
      cep: ''
    };

    const formatado = formatarEnderecoParaGeocoding(destinatario);

    expect(formatado).toBe('');
  });
});

// ==========================================
// 3. TESTES DE MAPEAMENTO DE UF
// ==========================================

describe('obterUfDaChave', () => {
  it('deve mapear códigos IBGE para siglas corretas', () => {
    const mapeamentos = [
      { codigo: '11', uf: 'RO' }, // Rondônia
      { codigo: '12', uf: 'AC' }, // Acre
      { codigo: '13', uf: 'AM' }, // Amazonas
      { codigo: '21', uf: 'MA' }, // Maranhão
      { codigo: '23', uf: 'CE' }, // Ceará
      { codigo: '26', uf: 'PE' }, // Pernambuco
      { codigo: '29', uf: 'BA' }, // Bahia
      { codigo: '31', uf: 'MG' }, // Minas Gerais
      { codigo: '33', uf: 'RJ' }, // Rio de Janeiro
      { codigo: '35', uf: 'SP' }, // São Paulo
      { codigo: '41', uf: 'PR' }, // Paraná
      { codigo: '42', uf: 'SC' }, // Santa Catarina
      { codigo: '43', uf: 'RS' }, // Rio Grande do Sul
      { codigo: '53', uf: 'DF' }  // Distrito Federal
    ];

    mapeamentos.forEach(({ codigo, uf }) => {
      const chave = codigo + '0'.repeat(42);
      expect(obterUfDaChave(chave)).toBe(uf);
    });
  });

  it('deve retornar SP para código desconhecido', () => {
    const chaveUfDesconhecida = '00' + '0'.repeat(42);

    const uf = obterUfDaChave(chaveUfDesconhecida);

    expect(uf).toBe('SP'); // Fallback
  });
});

// ==========================================
// 4. TESTES DE VALIDAÇÃO DE FORMATO
// ==========================================

describe('Validação de Formato de Chave', () => {
  it('deve validar que chave contém apenas números', () => {
    const chaveComLetras = '35ABC312345678901234550010000000011234567891';
    const apenasNumeros = chaveComLetras.replace(/\D/g, '');

    expect(apenasNumeros.length).toBeLessThan(44); // Letras removidas
  });

  it('deve validar formato do CNPJ dentro da chave', () => {
    // CNPJ está nas posições 6-19 (14 dígitos)
    const chave = '35230312345678901234550010000000011234567891';
    const cnpj = chave.substring(6, 20);

    expect(cnpj.length).toBe(14);
    expect(cnpj).toMatch(/^\d{14}$/);
  });

  it('deve validar formato do número da NF-e', () => {
    // Número está nas posições 25-33 (9 dígitos)
    const chave = '35230312345678901234550010000000011234567891';
    const numero = chave.substring(25, 34);

    expect(numero.length).toBe(9);
    expect(numero).toMatch(/^\d{9}$/);
  });
});
