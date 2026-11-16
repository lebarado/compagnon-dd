"""Extrait le texte OCR du manuel, colonne par colonne (gauche puis droite).
usage: extract.py <pdf> <sortie.txt>
Chaque page est précédée de '===== PDF PAGE n (manuel p. n-1) ====='.
"""
import sys
import pymupdf

src, dst = sys.argv[1], sys.argv[2]
doc = pymupdf.open(src)
with open(dst, "w", encoding="utf-8") as f:
    for i, page in enumerate(doc, start=1):
        mid = page.rect.x0 + page.rect.width / 2
        blocks = [b for b in page.get_text("blocks") if b[6] == 0 and b[4].strip()]
        full, left, right = [], [], []
        for b in blocks:
            x0, y0, x1, y1, text = b[:5]
            if x0 < mid - page.rect.width * 0.08 and x1 > mid + page.rect.width * 0.08:
                full.append(b)
            elif (x0 + x1) / 2 < mid:
                left.append(b)
            else:
                right.append(b)
        f.write(f"\n\n===== PDF PAGE {i} (manuel p. {i - 1}) =====\n")
        for label, col in (("pleine largeur", full), ("colonne gauche", left), ("colonne droite", right)):
            if not col:
                continue
            f.write(f"\n--- {label} ---\n")
            for b in sorted(col, key=lambda b: (round(b[1]), b[0])):
                f.write(b[4].rstrip() + "\n")
print("pages:", len(doc))
