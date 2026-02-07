/**
 * Script de teste para analisar todas as notas fiscais
 * Executa OCR em cada nota e mostra o que foi extraído
 * 
 * Uso: npx tsx src/test/test-notas-ocr.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analisarImagemNota } from '../services/ocr.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NOTAS_DIR = path.join(__dirname, '..', '..', '..', 'notas');

interface ResultadoTeste {
  arquivo: string;
  sucesso: boolean;
  nome?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  fornecedor?: string;
  confianca?: number;
  erro?: string;
  textoExtraido?: string;
}

async function testarNotas() {
  console.log('='.repeat(80));
  console.log('TESTE DE OCR - ANÁLISE DE NOTAS FISCAIS');
  console.log('='.repeat(80));
  console.log(`\nDiretório: ${NOTAS_DIR}\n`);

  // Listar arquivos de imagem
  const arquivos = fs.readdirSync(NOTAS_DIR)
    .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

  console.log(`Encontradas ${arquivos.length} notas para processar\n`);

  const resultados: ResultadoTeste[] = [];

  for (let i = 0; i < arquivos.length; i++) {
    const arquivo = arquivos[i];
    const caminhoCompleto = path.join(NOTAS_DIR, arquivo);
    
    console.log(`\n[${ i + 1}/${arquivos.length}] Processando: ${arquivo}`);
    console.log('-'.repeat(60));

    try {
      // Ler imagem como base64
      const imageBuffer = fs.readFileSync(caminhoCompleto);
      const base64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

      // Processar OCR
      const resultado = await analisarImagemNota(base64);

      const teste: ResultadoTeste = {
        arquivo,
        sucesso: resultado.sucesso,
        nome: resultado.destinatario?.nome || resultado.dadosAdicionais?.nomeDestinatario,
        endereco: resultado.endereco?.logradouro,
        numero: resultado.endereco?.numero,
        bairro: resultado.endereco?.bairro,
        cidade: resultado.endereco?.cidade,
        uf: resultado.endereco?.uf,
        cep: resultado.endereco?.cep,
        fornecedor: resultado.fornecedor,
        confianca: resultado.confianca,
        erro: resultado.erro,
        textoExtraido: resultado.textoExtraido?.substring(0, 500),
      };

      resultados.push(teste);

      // Mostrar resultado
      if (resultado.sucesso) {
        console.log(`✅ Fornecedor: ${teste.fornecedor || 'não detectado'}`);
        console.log(`👤 Nome: ${teste.nome || '❌ NÃO EXTRAÍDO'}`);
        console.log(`📍 Endereço: ${teste.endereco || '❌ NÃO EXTRAÍDO'} ${teste.numero || ''}`);
        console.log(`🏘️ Bairro: ${teste.bairro || '-'}`);
        console.log(`🏙️ Cidade: ${teste.cidade || '-'} / ${teste.uf || '-'}`);
        console.log(`📮 CEP: ${teste.cep || '-'}`);
        console.log(`📊 Confiança: ${teste.confianca?.toFixed(1)}%`);
      } else {
        console.log(`❌ ERRO: ${teste.erro}`);
      }

      // Mostrar amostra do texto extraído
      if (resultado.textoExtraido) {
        console.log(`\n📄 Texto OCR (primeiros 300 chars):`);
        console.log(resultado.textoExtraido.substring(0, 300).replace(/\n/g, ' | '));
      }

    } catch (error) {
      console.log(`❌ EXCEÇÃO: ${error}`);
      resultados.push({
        arquivo,
        sucesso: false,
        erro: String(error),
      });
    }
  }

  // Resumo final
  console.log('\n' + '='.repeat(80));
  console.log('RESUMO FINAL');
  console.log('='.repeat(80));

  const comNome = resultados.filter(r => r.nome);
  const comEndereco = resultados.filter(r => r.endereco);
  const comCidade = resultados.filter(r => r.cidade);
  const comCep = resultados.filter(r => r.cep);
  const comErro = resultados.filter(r => !r.sucesso);

  console.log(`\nTotal de notas: ${resultados.length}`);
  console.log(`✅ Nome extraído: ${comNome.length}/${resultados.length} (${(comNome.length/resultados.length*100).toFixed(0)}%)`);
  console.log(`✅ Endereço extraído: ${comEndereco.length}/${resultados.length} (${(comEndereco.length/resultados.length*100).toFixed(0)}%)`);
  console.log(`✅ Cidade extraída: ${comCidade.length}/${resultados.length} (${(comCidade.length/resultados.length*100).toFixed(0)}%)`);
  console.log(`✅ CEP extraído: ${comCep.length}/${resultados.length} (${(comCep.length/resultados.length*100).toFixed(0)}%)`);
  console.log(`❌ Erros: ${comErro.length}/${resultados.length}`);

  // Notas sem endereço (problemáticas)
  const semEndereco = resultados.filter(r => !r.endereco && !r.cidade && !r.cep);
  if (semEndereco.length > 0) {
    console.log(`\n⚠️ NOTAS SEM ENDEREÇO EXTRAÍDO:`);
    semEndereco.forEach(r => {
      console.log(`   - ${r.arquivo}: ${r.erro || 'sem dados'}`);
    });
  }

  // Salvar relatório JSON
  const relatorioPath = path.join(NOTAS_DIR, 'relatorio-ocr.json');
  fs.writeFileSync(relatorioPath, JSON.stringify(resultados, null, 2));
  console.log(`\n📄 Relatório salvo em: ${relatorioPath}`);
}

testarNotas().catch(console.error);
