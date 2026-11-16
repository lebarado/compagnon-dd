"""Rend des pages du PDF en PNG (moitié haute / moitié basse) pour lecture visuelle.
usage: render.py <pdf> <outdir> <dpi> <page> [page...]   (numéros de page PDF, base 1)
"""
import sys
import pymupdf

src, outdir, dpi = sys.argv[1], sys.argv[2], int(sys.argv[3])
doc = pymupdf.open(src)
for p in map(int, sys.argv[4:]):
    page = doc[p - 1]
    r = page.rect
    mid = r.y0 + r.height / 2
    over = r.height * 0.03
    for name, clip in (
        ("a", pymupdf.Rect(r.x0, r.y0, r.x1, mid + over)),
        ("b", pymupdf.Rect(r.x0, mid - over, r.x1, r.y1)),
    ):
        pix = page.get_pixmap(dpi=dpi, clip=clip, colorspace=pymupdf.csGRAY)
        out = f"{outdir}/p{p}{name}.png"
        pix.save(out)
        print(out, pix.width, pix.height)
