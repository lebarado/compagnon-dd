"""OCR colonne par colonne (Tesseract, français) pour les pages en deux colonnes.

usage: python tools/ocr_colonnes.py premiere_page_pdf derniere_page_pdf

Produit reference/ocr-col/p<N>g.txt (colonne gauche) et p<N>d.txt (colonne droite), N = page PDF.
L'OCR pleine page (tools/ocr_manuel.py) mélange parfois les colonnes ; ici chaque moitié est lue seule.
Les fichiers déjà produits sont sautés.
"""
import os
import subprocess
import sys
import tempfile
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import pymupdf

RACINE = Path(__file__).resolve().parent.parent
PDF = RACINE / "reference" / "manuel-des-joueurs-2024.pdf"
SORTIE = RACINE / "reference" / "ocr-col"
TESSDATA = RACINE / "reference" / "tessdata"
TESSERACT = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
DPI = 300


def traiter(numero: int) -> str:
    cibles = {c: SORTIE / f"p{numero}{c}.txt" for c in "gd"}
    if all(f.exists() for f in cibles.values()):
        return f"p{numero} déjà fait"
    doc = pymupdf.open(PDF)
    page = doc[numero - 1]
    r = page.rect
    zones = {"g": pymupdf.Rect(r.x0, r.y0, r.x0 + r.width / 2, r.y1), "d": pymupdf.Rect(r.x0 + r.width / 2, r.y0, r.x1, r.y1)}
    with tempfile.TemporaryDirectory() as tmp:
        for c, zone in zones.items():
            image = Path(tmp) / f"{c}.png"
            page.get_pixmap(dpi=DPI, colorspace=pymupdf.csGRAY, clip=zone).save(image)
            res = subprocess.run([TESSERACT, str(image), "stdout", "--tessdata-dir", str(TESSDATA), "-l", "fra", "--psm", "4"],
                                 capture_output=True, text=True, encoding="utf-8")
            if res.returncode != 0:
                return f"p{numero}{c} ERREUR {res.stderr.strip()[:200]}"
            cibles[c].write_text(res.stdout, encoding="utf-8")
    return f"p{numero} ok"


if __name__ == "__main__":
    SORTIE.mkdir(parents=True, exist_ok=True)
    debut, fin = int(sys.argv[1]), int(sys.argv[2])
    with ProcessPoolExecutor(max_workers=max(1, (os.cpu_count() or 2) - 1)) as pool:
        for ligne in pool.map(traiter, range(debut, fin + 1)):
            print(ligne, flush=True)
