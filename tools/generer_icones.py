"""Génère les icônes PNG de la PWA à partir de public/icone.svg. usage: python tools/generer_icones.py"""
from pathlib import Path

import pymupdf

public = Path(__file__).resolve().parent.parent / "public"
doc = pymupdf.open(public / "icone.svg")
page = doc[0]
for taille in (180, 192, 512):
    zoom = taille / page.rect.width
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
    pix.save(public / f"icone-{taille}.png")
    print(f"icone-{taille}.png", pix.width, pix.height)
