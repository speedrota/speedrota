/**
 * @fileoverview Serviço para converter PDF em imagens
 * 
 * Usa pdf.js para renderizar páginas do PDF em canvas
 * e depois converte para imagem para processamento OCR
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configurar worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface PDFPageImage {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Converte um arquivo PDF em imagens (uma por página)
 */
export async function pdfParaImagens(
  pdfFile: File | Blob,
  dpi: number = 200
): Promise<PDFPageImage[]> {
  console.log('[PDF] Iniciando conversão de PDF...');
  
  // Ler o arquivo como ArrayBuffer
  const arrayBuffer = await pdfFile.arrayBuffer();
  
  // Carregar o documento PDF
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  
  console.log(`[PDF] Documento carregado: ${pdfDoc.numPages} página(s)`);
  
  const images: PDFPageImage[] = [];
  
  // Processar cada página
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    console.log(`[PDF] Processando página ${pageNum}/${pdfDoc.numPages}...`);
    
    const page = await pdfDoc.getPage(pageNum);
    
    // Calcular escala baseada no DPI desejado (72 é o DPI padrão do PDF)
    const scale = dpi / 72;
    const viewport = page.getViewport({ scale });
    
    // Criar canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    
    // Fundo branco
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Renderizar página no canvas
    await page.render({
      canvasContext: ctx,
      viewport: viewport,
      canvas: canvas,
    } as any).promise;
    
    // Converter para data URL
    const dataUrl = canvas.toDataURL('image/png', 1.0);
    
    images.push({
      pageNumber: pageNum,
      dataUrl,
      width: canvas.width,
      height: canvas.height,
    });
    
    console.log(`[PDF] Página ${pageNum} convertida: ${canvas.width}x${canvas.height}`);
  }
  
  console.log(`[PDF] Conversão concluída: ${images.length} imagem(ns)`);
  
  return images;
}

/**
 * Converte apenas a primeira página do PDF em imagem
 */
export async function pdfPrimeiraPaginaParaImagem(
  pdfFile: File | Blob,
  dpi: number = 200
): Promise<string> {
  const images = await pdfParaImagens(pdfFile, dpi);
  
  if (images.length === 0) {
    throw new Error('PDF não contém páginas');
  }
  
  return images[0].dataUrl;
}

/**
 * Verifica se um arquivo é PDF
 */
export function isPDF(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/**
 * Verifica se um arquivo é imagem
 */
export function isImagem(file: File): boolean {
  return file.type.startsWith('image/');
}
