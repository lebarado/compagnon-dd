"""Rend des pages du PDF en PNG pour lecture visuelle.

usage: rendre_pages.py <pdf> <dossier> <dpi> <page>[:zone] [page[:zone]...]   (numéros de page PDF, base 1)

Zones : a (moitié haute), b (moitié basse) — par défaut les deux —,
ou un quart : hg (haut gauche), hd (haut droite), bg (bas gauche), bd (bas droite),
ou une colonne entière : g, d.
"""
import sys

import pymupdf

src, outdir, dpi = sys.argv[1], sys.argv[2], int(sys.argv[3])
doc = pymupdf.open(src)
for arg in sys.argv[4:]:
    numero, _, zone = arg.partition(":")
    p = int(numero)
    page = doc[p - 1]
    r = page.rect
    mx, my = r.x0 + r.width / 2, r.y0 + r.height / 2
    dx, dy = r.width * 0.03, r.height * 0.03
    zones = {
        "a": pymupdf.Rect(r.x0, r.y0, r.x1, my + dy),
        "b": pymupdf.Rect(r.x0, my - dy, r.x1, r.y1),
        "hg": pymupdf.Rect(r.x0, r.y0, mx + dx, my + dy),
        "hd": pymupdf.Rect(mx - dx, r.y0, r.x1, my + dy),
        "bg": pymupdf.Rect(r.x0, my - dy, mx + dx, r.y1),
        "bd": pymupdf.Rect(mx - dx, my - dy, r.x1, r.y1),
        "g": pymupdf.Rect(r.x0, r.y0, mx + dx, r.y1),
        "d": pymupdf.Rect(mx - dx, r.y0, r.x1, r.y1),
    }
    for nom in [zone] if zone else ["a", "b"]:
        pix = page.get_pixmap(dpi=dpi, clip=zones[nom], colorspace=pymupdf.csGRAY)
        out = f"{outdir}/p{p}{nom}.png"
        pix.save(out)
        print(out, pix.width, pix.height)
