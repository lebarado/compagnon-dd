"""Refait la reconnaissance de texte du manuel avec Tesseract (français).

usage: python tools/ocr_manuel.py [premiere_page_pdf dernière_page_pdf]

Produit reference/ocr/p<N>.txt (une page PDF par fichier, numéro PDF) puis
reference/manuel-ocr.txt, avec un en-tête « ===== PDF PAGE n (manuel p. n-1) ===== » par page.
Les pages déjà traitées sont sautées : on peut relancer après une interruption.
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
SORTIE = RACINE / "reference" / "ocr"
TESSDATA = RACINE / "reference" / "tessdata"
TESSERACT = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
DPI = 300


def traiter(numero: int) -> str:
    cible = SORTIE / f"p{numero}.txt"
    if cible.exists():
        return f"p{numero} déjà fait"
    doc = pymupdf.open(PDF)
    pix = doc[numero - 1].get_pixmap(dpi=DPI, colorspace=pymupdf.csGRAY)
    with tempfile.TemporaryDirectory() as tmp:
        image = Path(tmp) / "page.png"
        pix.save(image)
        resultat = subprocess.run(
            [TESSERACT, str(image), "stdout", "--tessdata-dir", str(TESSDATA), "-l", "fra", "--psm", "3"],
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
    if resultat.returncode != 0:
        return f"p{numero} ERREUR {resultat.stderr.strip()[:200]}"
    cible.write_text(resultat.stdout, encoding="utf-8")
    return f"p{numero} ok ({len(resultat.stdout)} caractères)"


def assembler(total: int) -> None:
    morceaux = []
    for n in range(1, total + 1):
        f = SORTIE / f"p{n}.txt"
        texte = f.read_text(encoding="utf-8") if f.exists() else "[page non traitée]"
        morceaux.append(f"\n\n===== PDF PAGE {n} (manuel p. {n - 1}) =====\n\n{texte}")
    (RACINE / "reference" / "manuel-ocr.txt").write_text("".join(morceaux), encoding="utf-8")


if __name__ == "__main__":
    SORTIE.mkdir(parents=True, exist_ok=True)
    total = len(pymupdf.open(PDF))
    debut, fin = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) == 3 else (1, total)
    with ProcessPoolExecutor(max_workers=max(1, (os.cpu_count() or 2) - 1)) as pool:
        for ligne in pool.map(traiter, range(debut, fin + 1)):
            print(ligne, flush=True)
    assembler(total)
    print("manuel-ocr.txt assemblé")
