#!/usr/bin/env python3
"""
Script para converter DOCX para PDF
Requer: pip install docx2pdf (Windows com Word instalado)
Ou: libreoffice/pandoc em Linux
"""

import subprocess
import sys
from pathlib import Path

def convert_with_docx2pdf(input_file: Path, output_file: Path) -> bool:
    """Tenta converter usando docx2pdf (requer Word no Windows)"""
    try:
        from docx2pdf import convert
        convert(str(input_file), str(output_file))
        return True
    except Exception as e:
        print(f"docx2pdf falhou: {e}")
        return False

def convert_with_libreoffice(input_file: Path, output_dir: Path) -> bool:
    """Tenta converter usando LibreOffice"""
    try:
        result = subprocess.run([
            'libreoffice', '--headless', '--convert-to', 'pdf',
            '--outdir', str(output_dir), str(input_file)
        ], capture_output=True, text=True, timeout=120)
        return result.returncode == 0
    except Exception as e:
        print(f"LibreOffice falhou: {e}")
        return False

def convert_with_pandoc(input_file: Path, output_file: Path) -> bool:
    """Tenta converter usando Pandoc"""
    try:
        result = subprocess.run([
            'pandoc', str(input_file), '-o', str(output_file)
        ], capture_output=True, text=True, timeout=120)
        return result.returncode == 0
    except Exception as e:
        print(f"Pandoc falhou: {e}")
        return False

def main():
    input_file = Path(__file__).parent / "SpeedRota_Pricing_Brasil_Revisado.docx"
    output_file = Path(__file__).parent / "SpeedRota_Pricing_Brasil_Revisado.pdf"
    
    if not input_file.exists():
        print(f"Arquivo não encontrado: {input_file}")
        sys.exit(1)
    
    print(f"Convertendo: {input_file.name}")
    
    # Tenta diferentes métodos
    if sys.platform == 'win32':
        if convert_with_docx2pdf(input_file, output_file):
            print(f"✓ PDF criado: {output_file}")
            return
    
    if convert_with_libreoffice(input_file, input_file.parent):
        print(f"✓ PDF criado via LibreOffice")
        return
        
    if convert_with_pandoc(input_file, output_file):
        print(f"✓ PDF criado via Pandoc")
        return
    
    print("❌ Nenhum conversor disponível.")
    print("\nPara converter manualmente:")
    print("  Windows: Abra o DOCX no Word e salve como PDF")
    print("  Linux: sudo apt install pandoc texlive-latex-base")
    print("         pandoc SpeedRota_Pricing_Brasil_Revisado.docx -o SpeedRota_Pricing_Brasil_Revisado.pdf")

if __name__ == "__main__":
    main()
