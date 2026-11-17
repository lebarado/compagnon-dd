"""Découpe l'OCR colonne par colonne du chapitre 7 (reference/ocr-col/p240g.txt … p344d.txt) en sorts bruts.

Sortie : reference/sorts-brut.json (privé, jamais publié), une entrée par sort avec l'en-tête
(nom, niveau, école, classes, incantation, portée, composantes, durée, page imprimée) et le texte OCR
de la description, qui sert seulement à rédiger les résumés de manuel/sources/sorts_resumes_*.py.

Un sort commence à une ligne de titre (majuscules) suivie, dans les 5 lignes, de « Temps d'incantation ».

Usage : python -I tools/extraire_sorts.py
"""
import json
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
OCR = RACINE / "reference" / "ocr-col"
RE_ECOLE = re.compile(r"([A-Za-zÀ-ÿ]+) (?:du\s*(\S{0,3})\s*niveau|(mineure))\s*\((.*)$")
FINS = [("bjuration", "Abjuration"), ("ivination", "Divination"), ("nchantement", "Enchantement"), ("lusion", "Illusion"),
        ("nvocation", "Invocation"), ("vocation", "Évocation"), ("romancie", "Nécromancie"), ("ransmutation", "Transmutation"),
        ("smutation", "Transmutation"), ("ncantement", "Enchantement")]
CHIFFRES = {"I": 1, "l": 1, "!": 1, "|": 1, "i": 1}
CHAMPS = {"incantation": r"incantation", "portee": r"or[tl][ée]e", "composantes": r"omposantes", "duree": r"ur[ée]e"}


def ecole_de(mot):
    for fin, ecole in FINS:
        if mot.lower().endswith(fin):
            return ecole
    return None


def lignes():
    for n in range(240, 345):
        for c in "gd":
            f = OCR / f"p{n}{c}.txt"
            if f.exists():
                for l in f.read_text(encoding="utf-8").splitlines():
                    yield n - 1, l.rstrip()


def est_titre(l):
    t = re.sub(r"[^A-Za-zÀ-ÿ]", "", l)
    return len(t) >= 3 and sum(c.isupper() for c in t) >= 0.75 * len(t) and not l.strip().startswith("CHAPITRE")


def champ(s, cle):
    m = re.search(rf"{CHAMPS[cle]}\s*:\s*(.*)$", s, re.I)
    return m.group(1) if m and m.start() < 22 else None


def main():
    flux = list(lignes())
    debuts = []
    for i, (_, l) in enumerate(flux):
        if not est_titre(l):
            continue
        suite = [flux[j][1].strip() for j in range(i + 1, min(i + 6, len(flux)))]
        ecole_proche = any((m := RE_ECOLE.search(x)) and ecole_de(m.group(1)) for x in suite[:2])
        if ecole_proche or any(champ(x, "incantation") is not None for x in suite):
            debuts.append(i)
    # Une légende d'illustration en capitales peut précéder le vrai titre : on garde le titre le plus proche.
    debuts = [d for k, d in enumerate(debuts) if not (k + 1 < len(debuts) and debuts[k + 1] - d <= 3)]
    sorts = []
    for k, d in enumerate(debuts):
        fin = debuts[k + 1] if k + 1 < len(debuts) else len(flux)
        page, titre = flux[d]
        s = {"nom": re.sub(r"\s+", " ", titre.strip(" |—-_:;.,'\"")), "niveau": -1, "ecole": None, "classes": [], "page": page}
        texte = []
        i = d + 1
        while i < fin:
            l = flux[i][1].strip()
            m = RE_ECOLE.search(l) if s["ecole"] is None and i <= d + 3 else None
            if m and ecole_de(m.group(1)):
                s["ecole"] = ecole_de(m.group(1))
                if m.group(3):
                    s["niveau"] = 0
                else:
                    c = (m.group(2) or "?")[:1]
                    s["niveau"] = int(c) if c.isdigit() else CHIFFRES.get(c, -1)
                classes = m.group(4)
                while ")" not in classes and i + 1 < fin:
                    i += 1
                    classes += " " + flux[i][1].strip()
                s["classes"] = [c.strip(" |") for c in classes.split(")")[0].split(",") if c.strip(" |")]
                i += 1
                continue
            pris = False
            if len(texte) < 6:
                for cle in CHAMPS:
                    v = champ(l, cle)
                    if v is not None and cle not in s:
                        while cle == "composantes" and v.count("(") > v.count(")") and i + 1 < fin:
                            i += 1
                            v += " " + flux[i][1].strip()
                        s[cle] = v.strip()
                        pris = True
                        break
            if not pris:
                texte.append(flux[i][1])
            i += 1
        s["texte"] = "\n".join(texte).strip()
        sorts.append(s)
    sortie = RACINE / "reference" / "sorts-brut.json"
    sortie.write_text(json.dumps(sorts, ensure_ascii=False, indent=1), encoding="utf-8")
    incomplets = [x["nom"] for x in sorts if not all(c in x for c in CHAMPS)]
    douteux = [x["nom"] for x in sorts if x["niveau"] < 0 or not x["ecole"]]
    print(len(sorts), "sorts ;", len(incomplets), "en-têtes incomplets :", incomplets)
    print("école ou niveau illisible :", douteux)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
