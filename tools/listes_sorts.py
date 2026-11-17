"""Lit les listes de sorts des classes (OCR par colonne) : nom, niveau, école, classes de chaque sort.

Sortie : reference/listes-sorts.json {slug: {nom, niveau, ecole, classes}} ; sert à contrôler
l'extraction du chapitre 7 (sorts manquants, niveaux et classes illisibles).
Usage : python -I tools/listes_sorts.py
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "manuel" / "sources"))
from commun import slug  # noqa: E402

RACINE = Path(__file__).resolve().parents[1]
OCR = RACINE / "reference" / "ocr-col"
PAGES = {"barde": range(63, 65), "clerc": range(72, 75), "druide": range(82, 85), "ensorceleur": range(94, 97),
         "magicien": range(119, 123), "occultiste": range(140, 143), "paladin": range(151, 153), "rodeur": range(160, 162)}
ECOLES = {"abjuration": "Abjuration", "divination": "Divination", "enchantement": "Enchantement", "evocation": "Évocation",
          "illusion": "Illusion", "invocation": "Invocation", "necromancie": "Nécromancie", "transmutation": "Transmutation"}
RE_LIGNE = re.compile(r"^(.+?)\s+([A-Za-zÀ-ÿ]+)\s*(?:[—–\-=>»_]+|C|R|M|C\s*,\s*[RM]|C\s*,\s*R\s*,\s*M|R\s*,\s*M)?\s*$")


def ecole(mot):
    m = slug(mot)
    for k, v in ECOLES.items():
        if m.endswith(k[2:]):
            return v
    return None


def main():
    sorts = {}
    for classe, pages in PAGES.items():
        niveau = None
        for n in pages:
            for c in "gd":
                f = OCR / f"p{n}{c}.txt"
                if not f.exists():
                    continue
                for l in f.read_text(encoding="utf-8").splitlines():
                    s = l.strip(" |")
                    if re.search(r"SORTS MINEURS", s, re.I):
                        niveau = 0
                        continue
                    m = re.search(r"SORTS D.+ DU\s+(\S)", s)
                    if m:
                        niveau = int(m.group(1)) if m.group(1).isdigit() else {"I": 1, "l": 1, "&": 8, "O": 9, "Ÿ": 9}.get(m.group(1))
                        continue
                    if niveau is None or s.startswith("Sort ") or not s:
                        continue
                    m = RE_LIGNE.match(s)
                    if not m or not ecole(m.group(2)):
                        continue
                    nom = m.group(1).strip(" .,;:'\"")
                    if len(nom) < 3:
                        continue
                    e = sorts.setdefault(slug(nom), {"nom": nom, "niveau": niveau, "ecole": ecole(m.group(2)), "classes": []})
                    if classe not in e["classes"]:
                        e["classes"].append(classe)
    (RACINE / "reference" / "listes-sorts.json").write_text(json.dumps(sorts, ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(sorts), "sorts dans les listes de classe")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
