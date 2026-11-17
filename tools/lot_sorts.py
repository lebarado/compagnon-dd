"""Affiche un lot de sorts bruts (reference/sorts-brut.json) sous forme compacte, pour rédiger les résumés.

usage: python -I tools/lot_sorts.py <début> <nombre> [longueur_max_du_texte]
"""
import json
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding="utf-8")
sorts = json.loads((RACINE / "reference" / "sorts-brut.json").read_text(encoding="utf-8"))
debut, nombre = int(sys.argv[1]), int(sys.argv[2])
maxi = int(sys.argv[3]) if len(sys.argv) > 3 else 1200
for i, s in enumerate(sorts[debut:debut + nombre], start=debut):
    texte = re.sub(r"\s+", " ", s.get("texte", ""))
    print(f"#{i} {s['nom']} | niv {s['niveau']} {s['ecole']} | {', '.join(s['classes'])} | p.{s['page']}")
    print(f"  T:{s.get('incantation')} | P:{s.get('portee')} | C:{s.get('composantes')} | D:{s.get('duree')}")
    print("  " + texte[:maxi])
