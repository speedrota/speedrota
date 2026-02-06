/**
 * @fileoverview Amostras de NF-e de diferentes fornecedores para teste de OCR
 * 
 * OBJETIVO: Validar que o parser funciona com diferentes layouts de notas
 * 
 * FORNECEDORES TESTADOS:
 * - Natura (referência - já testado ✅)
 * - Mercado Livre
 * - Shopee
 * - Amazon
 * - Magazine Luiza
 * - Americanas
 * - E-commerce genérico
 */

import { describe, it, expect } from 'vitest';
import { parsearNFe, validarDadosExtraidos } from '../services/ocr';

// ==========================================
// AMOSTRAS DE NOTAS POR FORNECEDOR
// ==========================================

/**
 * Amostra Natura REAL - Baseada em imagem de NF-e real (ELLEN KATHERINE)
 * Chave: 35260271673990005136550010176713531728760835
 * Cidade: AMERICANA/SP
 */
const AMOSTRA_NATURA_REAL = `
NF-e Nr.017.671.353
Série: 001

Recebemos de Natura Cosméticos S/A Os produtos constantes na nota fiscal indicada ao lado.
DT: 0009276658 | Pedido: 842051123 | Rota: 00010 | Volumes: 1 | Total de Itens: 10

natura AVON consultoria de beleza

DANFE
Documento Auxiliar da
Nota Fiscal Eletrônica
1 - Entrada
2 - Saída                    2
Nr. 017.671.353 - Série: 001
FL 1/1

NATURA COSMÉTICOS S/A
R Lauro Pinto Toledo, 410 SL 1      PINHAL
13317-300 - CABREUVA / SP            Tel: (11) 4389-7317

CHAVE DE ACESSO
35260271673990005136550010176713531728760835

DESTINATÁRIO / REMETENTE
NOME / RAZÃO SOCIAL                                              CNPJ/CPF
ELLEN KATHERINE SANT ANNA TESSER                               222.606.858-97
ENDEREÇO                               BAIRRO/DISTRITO          CEP
R DOUTOR JOAO ZANAGA, 609             CHACARA MACHADINHO II    13478-220
MUNICÍPIO                  FONE/FAX                  UF    INSCRIÇÃO ESTADUAL
AMERICANA                  Tel: 11915419889          SP    ISENTO

DATA DA EMISSÃO: 02/02/26
VALOR TOTAL DA NOTA: 181,88
`;

/**
 * Amostra Natura - Formato típico já validado
 */
const AMOSTRA_NATURA = `
NOTA FISCAL ELETRÔNICA - NF-e
Nº 000.123.456
EMITENTE
Natura Cosméticos S.A.
CNPJ: 71.673.990/0001-77

DESTINATÁRIO / REMETENTE
Nome/Razão Social: Maria Aparecida da Silva
Endereço: Rua das Flores, 123 - Ap 45
Bairro: Jardim das Rosas
Município: Campinas       UF: SP       CEP: 13010-000
Telefone: (19) 99999-8888

DADOS DO PRODUTO
Creme Hidratante - R$ 89,90
VALOR TOTAL: R$ 89,90
`;

/**
 * Amostra Mercado Livre - Formato típico de marketplace
 */
const AMOSTRA_MERCADO_LIVRE = `
DANFE - DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA
NF-e N° 987.654.321

EMITENTE: Loja Eletrônicos Brazil LTDA
CNPJ: 12.345.678/0001-99

DESTINATÁRIO
JOÃO CARLOS PEREIRA
CPF: 123.456.789-00
RUA QUINZE DE NOVEMBRO, Nº 500, CASA 2
BAIRRO CENTRO
SANTOS / SP
CEP 11010-100
FONE: (13) 98765-4321

PRODUTO                          QTD    VALOR
Mouse Gamer RGB                    1     89,99
Mousepad Grande                    1     45,00
------------------------
TOTAL DA NOTA: R$ 134,99

Chave de Acesso: 3523 0312 3456 7890 1234 5500 1000 0000 0012 3456 7891
`;

/**
 * Amostra Shopee - Formato típico chinês adaptado
 */
const AMOSTRA_SHOPEE = `
NF-e NOTA FISCAL ELETRÔNICA

N° 456789123
Série: 001

♦ REMETENTE
SHOPEE MARKETPLACE LTDA
CNPJ 32.887.655/0001-21

♦ DESTINATÁRIO
ANA PAULA SANTOS FERREIRA
Av Brasil, 1500 - Bloco A Ap 302
Vila Mariana
São Paulo-SP  CEP: 04101-000
Tel: 11 91234-5678

Descrição: Fone de Ouvido Bluetooth
Qtd: 1   Valor: R$ 79,90

TOTAL: R$ 79,90
`;

/**
 * Amostra Amazon - Formato americanizado
 */
const AMOSTRA_AMAZON = `
Amazon.com.br Serviços de Varejo do Brasil Ltda
CNPJ: 15.436.940/0001-03

NOTA FISCAL ELETRÔNICA
Número: 2024/001234567

DADOS DO DESTINATÁRIO:
CARLOS EDUARDO LIMA
Rua Oscar Freire, 2500
Pinheiros
São Paulo - SP
CEP: 05409-011
(11) 3456-7890

ITENS:
Kindle Paperwhite (16GB) ............ R$ 499,00
Capa Protetora ...................... R$  99,00
-------------------------------------------------
VALOR TOTAL: R$ 598,00

Data Emissão: 05/02/2026
`;

/**
 * Amostra Magazine Luiza
 */
const AMOSTRA_MAGAZINE_LUIZA = `
MAGAZINE LUIZA S/A
CNPJ 47.960.950/0001-21

NOTA FISCAL DE VENDA AO CONSUMIDOR
NF-e nº 789456123

IDENTIFICAÇÃO DO DESTINATÁRIO
Nome: FERNANDA OLIVEIRA COSTA
Endereço: Avenida Paulista, 1000
Complemento: Sala 1210
Bairro: Bela Vista
Cidade: São Paulo    Estado: SP
CEP: 01310-100
Telefone: (11) 99876-5432

------------------------------------------
SMART TV LG 55"             1x  2.199,00
SUPORTE DE PAREDE           1x     89,90
------------------------------------------
TOTAL                       R$ 2.288,90

Forma de Pagamento: Cartão de Crédito
Parcelas: 10x R$ 228,89
`;

/**
 * Amostra Americanas
 */
const AMOSTRA_AMERICANAS = `
LOJAS AMERICANAS S.A.
CNPJ: 33.014.556/0001-96

NF-e
Número da Nota: 321.654.987
Série: 001

DADOS DO CLIENTE
Razão Social/Nome: ROBERTO SILVA SANTOS  
Logradouro: Rua Augusta, 2100
Número: S/N
Complemento: Loja 45
Bairro: Consolação
Município: SÃO PAULO
UF: SP
CEP: 01305-100
Fone/Fax: 11-5555-4444

DESCRIÇÃO DOS PRODUTOS
Notebook Samsung ............. R$ 3.499,00
Mouse sem fio ................ R$    59,90

TOTAL DA NOTA FISCAL: R$ 3.558,90
`;

/**
 * Amostra E-commerce Genérico (pequeno lojista)
 */
const AMOSTRA_ECOMMERCE_GENERICO = `
Artesanato da Maria LTDA ME
CNPJ: 98.765.432/0001-10

DANFE - NF-e 000045678

▶ DESTINATÁRIO
CLIENTE: Mariana Souza Ribeiro
END.: R Sete de Setembro, 789
CIDADE: Curitiba/PR
CEP: 80020-090
TEL: 41-99999-0000

Bolsa Artesanal Couro ........ 1 un .... R$ 189,00

VALOR DOS PRODUTOS: R$ 189,00
FRETE: R$ 15,00
TOTAL: R$ 204,00

Obrigado pela preferência!
`;

/**
 * Amostra com endereço mal formatado (caso de borda)
 */
const AMOSTRA_ENDERECO_MAL_FORMATADO = `
NF-e 123456

DEST: Pedro Henrique
R 15 novembro 500 ap12
cep13010000
campinas sp

PRODUTO: Camiseta - R$50
`;

/**
 * Amostra com caracteres especiais e ruído OCR
 */
const AMOSTRA_COM_RUIDO = `
N0TA F1SCAL ELETR0N1CA
N° Ø123.456.789

D€ST1NATÁR10/R€M€T€NT€
N0m€: LUCAS MART1NS
Rua d@s PALM€1RAS, 456 - APT0 10
B@1rr0: V1L@ NUEV@
C1D@D€: R10 D€ J@N€1RO/RJ
C€P: 20040-020

T€L: (21) 99888-7777

V@LOR TOT@L: R$ 299,99
`;

// ==========================================
// TESTES UNITÁRIOS POR FORNECEDOR
// ==========================================

describe('OCR Multi-Fornecedor', () => {
  
  describe('Natura (referência)', () => {
    it('deve extrair dados essenciais para geocoding da nota Natura', () => {
      const resultado = parsearNFe(AMOSTRA_NATURA);
      
      expect(resultado).not.toBeNull();
      // Campos críticos para geocoding
      expect(resultado?.destinatario.cidade).toBe('CAMPINAS');
      expect(resultado?.destinatario.uf).toBe('SP');
      expect(resultado?.destinatario.cep).toBe('13010-000');
      // O endereço deve conter alguma informação útil
      expect(resultado?.destinatario.endereco.length).toBeGreaterThan(5);
    });
    
    it('deve extrair dados da nota Natura REAL (ELLEN KATHERINE - AMERICANA)', () => {
      const resultado = parsearNFe(AMOSTRA_NATURA_REAL);
      
      expect(resultado).not.toBeNull();
      
      // Campos críticos do DESTINATÁRIO (não do emitente!)
      expect(resultado?.destinatario.nome).toContain('ELLEN');
      expect(resultado?.destinatario.endereco).toContain('DOUTOR JOAO ZANAGA');
      expect(resultado?.destinatario.numero).toBe('609');
      expect(resultado?.destinatario.bairro).toContain('CHACARA MACHADINHO');
      expect(resultado?.destinatario.cidade).toBe('AMERICANA');
      expect(resultado?.destinatario.uf).toBe('SP');
      expect(resultado?.destinatario.cep).toBe('13478-220');
      
      // Validar que NÃO extraiu dados do emitente (CABREUVA é do remetente!)
      expect(resultado?.destinatario.cidade).not.toBe('CABREUVA');
      expect(resultado?.destinatario.endereco).not.toContain('TOLEDO');
    });
  });
  
  describe('Mercado Livre', () => {
    it('deve extrair dados essenciais para geocoding da nota ML', () => {
      const resultado = parsearNFe(AMOSTRA_MERCADO_LIVRE);
      
      expect(resultado).not.toBeNull();
      // Campos críticos para geocoding
      expect(resultado?.destinatario.cidade).toBe('SANTOS');
      expect(resultado?.destinatario.uf).toBe('SP');
      expect(resultado?.destinatario.cep).toBe('11010-100');
      // Nome deve ter sido extraído
      expect(resultado?.destinatario.nome).toBeTruthy();
    });
    
    it('deve extrair número da nota Mercado Livre', () => {
      const resultado = parsearNFe(AMOSTRA_MERCADO_LIVRE);
      expect(resultado?.numero).toContain('987654321');
    });
  });
  
  describe('Shopee', () => {
    it('deve extrair dados da nota Shopee', () => {
      const resultado = parsearNFe(AMOSTRA_SHOPEE);
      
      expect(resultado).not.toBeNull();
      expect(resultado?.destinatario.nome).toContain('ANA PAULA');
      expect(resultado?.destinatario.endereco).toContain('Brasil');
      expect(resultado?.destinatario.cidade).toBe('SÃO PAULO');
      expect(resultado?.destinatario.uf).toBe('SP');
      expect(resultado?.destinatario.cep).toBe('04101-000');
    });
  });
  
  describe('Amazon', () => {
    it('deve extrair dados da nota Amazon', () => {
      const resultado = parsearNFe(AMOSTRA_AMAZON);
      
      expect(resultado).not.toBeNull();
      expect(resultado?.destinatario.nome).toContain('CARLOS');
      expect(resultado?.destinatario.endereco).toContain('Oscar Freire');
      expect(resultado?.destinatario.cidade).toBe('SÃO PAULO');
      expect(resultado?.destinatario.uf).toBe('SP');
      expect(resultado?.destinatario.cep).toBe('05409-011');
    });
  });
  
  describe('Magazine Luiza', () => {
    it('deve extrair dados da nota Magazine Luiza', () => {
      const resultado = parsearNFe(AMOSTRA_MAGAZINE_LUIZA);
      
      expect(resultado).not.toBeNull();
      expect(resultado?.destinatario.nome).toContain('FERNANDA');
      expect(resultado?.destinatario.endereco).toContain('Paulista');
      expect(resultado?.destinatario.cidade).toBe('SÃO PAULO');
      expect(resultado?.destinatario.uf).toBe('SP');
      expect(resultado?.destinatario.cep).toBe('01310-100');
    });
  });
  
  describe('Americanas', () => {
    it('deve extrair dados essenciais para geocoding da nota Americanas', () => {
      const resultado = parsearNFe(AMOSTRA_AMERICANAS);
      
      expect(resultado).not.toBeNull();
      // Campos críticos - agora que LOJAS AMERICANAS não é confundida com cidade
      expect(resultado?.destinatario.cidade).toBe('SÃO PAULO');
      expect(resultado?.destinatario.uf).toBe('SP');
      expect(resultado?.destinatario.cep).toBe('01305-100');
      // Nome deve conter algo útil
      expect(resultado?.destinatario.nome).toBeTruthy();
    });
  });
  
  describe('E-commerce Genérico', () => {
    it('deve extrair dados essenciais para geocoding de pequeno e-commerce', () => {
      const resultado = parsearNFe(AMOSTRA_ECOMMERCE_GENERICO);
      
      expect(resultado).not.toBeNull();
      // Campos críticos para geocoding
      expect(resultado?.destinatario.cidade).toBe('CURITIBA');
      expect(resultado?.destinatario.uf).toBe('PR');
      expect(resultado?.destinatario.cep).toBe('80020-090');
      // Endereço deve ter alguma informação
      expect(resultado?.destinatario.endereco.length).toBeGreaterThan(5);
    });
  });
  
  describe('Casos de Borda', () => {
    it('deve tentar extrair de endereço mal formatado', () => {
      const resultado = parsearNFe(AMOSTRA_ENDERECO_MAL_FORMATADO);
      
      // Pode não extrair perfeitamente, mas deve tentar
      expect(resultado).not.toBeNull();
      // CEP deve ser normalizado
      expect(resultado?.destinatario.cep).toBe('13010-000');
    });
    
    it('deve lidar com caracteres de ruído OCR', () => {
      const resultado = parsearNFe(AMOSTRA_COM_RUIDO);
      
      // Mesmo com ruído, deve tentar extrair
      expect(resultado).not.toBeNull();
      expect(resultado?.destinatario.cep).toBe('20040-020');
    });
  });
  
  describe('Validação de Dados Extraídos', () => {
    const amostras = [
      { nome: 'Natura', texto: AMOSTRA_NATURA },
      { nome: 'Mercado Livre', texto: AMOSTRA_MERCADO_LIVRE },
      { nome: 'Shopee', texto: AMOSTRA_SHOPEE },
      { nome: 'Amazon', texto: AMOSTRA_AMAZON },
      { nome: 'Magazine Luiza', texto: AMOSTRA_MAGAZINE_LUIZA },
      { nome: 'Americanas', texto: AMOSTRA_AMERICANAS },
      { nome: 'E-commerce Genérico', texto: AMOSTRA_ECOMMERCE_GENERICO },
    ];
    
    amostras.forEach(({ nome, texto }) => {
      it(`deve validar dados extraídos da nota ${nome}`, () => {
        const resultado = parsearNFe(texto);
        
        if (resultado) {
          const validacao = validarDadosExtraidos(resultado);
          
          // Valida que pelo menos endereco ou CEP foi extraído
          expect(
            validacao.valido || 
            resultado.destinatario.endereco || 
            resultado.destinatario.cep
          ).toBeTruthy();
          
          // Verifica campos básicos
          expect(resultado.destinatario).toBeDefined();
        }
      });
    });
  });
});

// ==========================================
// MÉTRICAS DE QUALIDADE OCR
// ==========================================

describe('Métricas de Qualidade OCR', () => {
  const todasAmostras = [
    AMOSTRA_NATURA,
    AMOSTRA_MERCADO_LIVRE,
    AMOSTRA_SHOPEE,
    AMOSTRA_AMAZON,
    AMOSTRA_MAGAZINE_LUIZA,
    AMOSTRA_AMERICANAS,
    AMOSTRA_ECOMMERCE_GENERICO,
  ];
  
  it('deve ter taxa de sucesso >= 80% nas amostras', () => {
    let sucessos = 0;
    
    todasAmostras.forEach(amostra => {
      const resultado = parsearNFe(amostra);
      if (resultado && (resultado.destinatario.endereco || resultado.destinatario.cep)) {
        sucessos++;
      }
    });
    
    const taxa = (sucessos / todasAmostras.length) * 100;
    console.log(`[OCR Quality] Taxa de sucesso: ${taxa.toFixed(1)}% (${sucessos}/${todasAmostras.length})`);
    
    expect(taxa).toBeGreaterThanOrEqual(80);
  });
  
  it('deve extrair CEP em >= 90% das amostras', () => {
    let cepsExtraidos = 0;
    
    todasAmostras.forEach(amostra => {
      const resultado = parsearNFe(amostra);
      if (resultado?.destinatario.cep && resultado.destinatario.cep.length >= 8) {
        cepsExtraidos++;
      }
    });
    
    const taxa = (cepsExtraidos / todasAmostras.length) * 100;
    console.log(`[OCR Quality] CEPs extraídos: ${taxa.toFixed(1)}% (${cepsExtraidos}/${todasAmostras.length})`);
    
    expect(taxa).toBeGreaterThanOrEqual(90);
  });
  
  it('deve extrair cidade em >= 85% das amostras', () => {
    let cidadesExtraidas = 0;
    
    todasAmostras.forEach(amostra => {
      const resultado = parsearNFe(amostra);
      if (resultado?.destinatario.cidade && resultado.destinatario.cidade.length > 2) {
        cidadesExtraidas++;
      }
    });
    
    const taxa = (cidadesExtraidas / todasAmostras.length) * 100;
    console.log(`[OCR Quality] Cidades extraídas: ${taxa.toFixed(1)}% (${cidadesExtraidas}/${todasAmostras.length})`);
    
    expect(taxa).toBeGreaterThanOrEqual(85);
  });
});

// Export das amostras para uso em outros testes
export {
  AMOSTRA_NATURA,
  AMOSTRA_MERCADO_LIVRE,
  AMOSTRA_SHOPEE,
  AMOSTRA_AMAZON,
  AMOSTRA_MAGAZINE_LUIZA,
  AMOSTRA_AMERICANAS,
  AMOSTRA_ECOMMERCE_GENERICO,
  AMOSTRA_ENDERECO_MAL_FORMATADO,
  AMOSTRA_COM_RUIDO,
};
