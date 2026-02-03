/**
 * @fileoverview Testes do serviço OCR
 * 
 * Testa extração de dados de NF-e com diferentes formatos
 */

import { describe, it, expect } from 'vitest';
import { parsearNFe, validarDadosExtraidos } from '../services/ocr';

// ==========================================
// TESTES DO PARSER DE NF-e
// ==========================================

describe('parsearNFe', () => {
  
  describe('Extração de endereço', () => {
    it('deve extrair endereço com "Rua"', () => {
      const texto = `
        DESTINATÁRIO
        Nome: João Silva
        Rua das Flores, 123
        Bairro: Centro
        Campinas-SP
        CEP: 13010-000
      `;
      
      const resultado = parsearNFe(texto);
      
      expect(resultado).not.toBeNull();
      expect(resultado?.destinatario.endereco).toContain('Flores');
    });
    
    it('deve extrair endereço com "Avenida"', () => {
      const texto = `
        DESTINATÁRIO
        Avenida Brasil, 456
        São Paulo-SP
        CEP: 01310-100
      `;
      
      const resultado = parsearNFe(texto);
      
      expect(resultado).not.toBeNull();
      expect(resultado?.destinatario.endereco).toContain('Brasil');
    });
    
    it('deve extrair CEP em diferentes formatos', () => {
      const texto1 = `
        DESTINATÁRIO
        Rua Teste, 100
        Cidade: Campinas
        CEP: 13010-000 SP
      `;
      const texto2 = `
        DESTINATÁRIO
        Rua Teste, 100
        Cidade: Campinas
        CEP 13010000 SP
      `;
      
      const resultado1 = parsearNFe(texto1);
      const resultado2 = parsearNFe(texto2);
      
      expect(resultado1?.destinatario.cep).toBe('13010-000');
      expect(resultado2?.destinatario.cep).toBe('13010-000');
    });
  });
  
  describe('Extração de cidade e UF', () => {
    it('deve extrair cidade conhecida', () => {
      const texto = `
        DESTINATÁRIO
        Rua Teste, 100
        São Paulo
      `;
      
      const resultado = parsearNFe(texto);
      
      expect(resultado?.destinatario.cidade).toContain('PAULO');
    });
    
    it('deve extrair UF do texto', () => {
      const texto = `
        DESTINATÁRIO
        Rua Teste, 100
        Campinas-SP
        CEP: 13010-000
      `;
      
      const resultado = parsearNFe(texto);
      
      expect(resultado?.destinatario.uf).toBe('SP');
    });
  });
  
  describe('Fallback quando não encontra seção DESTINATÁRIO', () => {
    it('deve extrair dados mesmo sem seção explícita', () => {
      const texto = `
        Nota Fiscal Eletrônica
        Rua das Palmeiras, 500
        Bairro: Jardim América
        Americana-SP
        CEP: 13478-000
      `;
      
      const resultado = parsearNFe(texto);
      
      expect(resultado).not.toBeNull();
      expect(resultado?.destinatario.endereco).toContain('Palmeiras');
      expect(resultado?.destinatario.bairro).toContain('Jardim');
    });
  });
  
  describe('Texto OCR com ruído', () => {
    it('deve lidar com texto com caracteres extras', () => {
      const texto = `
        DESTINATÁRIO / REMETENTE
        
        Nome/Razão Social: Maria Santos
        
        End.: Rua XV de Novembro, n° 789
        
        Bairro: Centro   |  Cidade: Piracicaba
        
        UF: SP   CEP: 13400-000
      `;
      
      const resultado = parsearNFe(texto);
      
      expect(resultado).not.toBeNull();
      expect(resultado?.destinatario.endereco).toBeTruthy();
    });
  });
  
  describe('Validação de dados mínimos', () => {
    it('deve rejeitar texto muito curto', () => {
      const resultado = parsearNFe('abc');
      expect(resultado).toBeNull();
    });
    
    it('deve rejeitar texto sem dados úteis', () => {
      const resultado = parsearNFe('xxxxx yyyyy zzzzz 12345');
      expect(resultado).toBeNull();
    });
  });
});

// ==========================================
// TESTES DE VALIDAÇÃO
// ==========================================

describe('validarDadosExtraidos', () => {
  it('deve validar dados completos', () => {
    const dados = {
      numero: '123456',
      destinatario: {
        nome: 'João Silva',
        endereco: 'Rua das Flores, 123',
        numero: '123',
        bairro: 'Centro',
        cidade: 'Campinas',
        uf: 'SP',
        cep: '13010-000',
      },
      fornecedor: 'natura' as const, confiancaOCR: 0.8,
    };
    
    const validacao = validarDadosExtraidos(dados);
    
    expect(validacao.valido).toBe(true);
    expect(validacao.camposFaltando).toHaveLength(0);
  });
  
  it('deve rejeitar dados sem endereço e sem CEP', () => {
    const dados = {
      numero: '123456',
      destinatario: {
        nome: 'João Silva',
        endereco: '',
        numero: '',
        bairro: '',
        cidade: 'Campinas',
        uf: 'SP',
        cep: '',
      },
      fornecedor: 'natura' as const, confiancaOCR: 0.3,
    };
    
    const validacao = validarDadosExtraidos(dados);
    
    expect(validacao.valido).toBe(false);
    expect(validacao.camposFaltando.length).toBeGreaterThan(0);
  });
  
  it('deve avisar sobre baixa confiança', () => {
    const dados = {
      numero: '123456',
      destinatario: {
        nome: '',
        endereco: 'Rua Teste, 100',
        numero: '100',
        bairro: '',
        cidade: 'Campinas',
        uf: 'SP',
        cep: '13010-000',
      },
      fornecedor: 'natura' as const, confiancaOCR: 0.3,
    };
    
    const validacao = validarDadosExtraidos(dados);
    
    expect(validacao.avisos).toContain('Baixa confiança na extração - verifique os dados');
  });
});

// ==========================================
// TESTES DE CENÁRIOS REAIS
// ==========================================

describe('Cenários reais de NF-e', () => {
  it('deve parsear NF-e típica de venda', () => {
    const textoNFe = `
      NOTA FISCAL ELETRÔNICA - NF-e
      Número: 000.123.456
      
      EMITENTE
      Empresa ABC Ltda
      
      DESTINATÁRIO
      Nome: Carlos Ferreira
      CPF: 123.456.789-00
      
      Rua das Oliveiras, 250 - Ap 12
      Bairro: Vila Nova
      Limeira - SP
      CEP: 13480-000
      
      Tel: (19) 99999-8888
      
      DADOS DO PRODUTO
      Produto X - R$ 150,00
      
      VALOR TOTAL: R$ 150,00
    `;
    
    const resultado = parsearNFe(textoNFe);
    
    expect(resultado).not.toBeNull();
    expect(resultado?.destinatario.endereco).toContain('Oliveiras');
    expect(resultado?.destinatario.cidade.toUpperCase()).toContain('LIMEIRA');
    expect(resultado?.destinatario.uf).toBe('SP');
    expect(resultado?.destinatario.cep).toBe('13480-000');
  });
  
  it('deve extrair número da NF-e', () => {
    const texto = `
      NF-e N° 000.789.012
      DESTINATÁRIO
      Rua Teste, 100
      Campinas-SP
      CEP: 13010-000
    `;
    
    const resultado = parsearNFe(texto);
    
    expect(resultado?.numero).toBeTruthy();
  });
});
