"""Contrôles de cohérence de data/regles.json. usage: python tools/verifier_regles.py"""
import json
import sys
from pathlib import Path

r = json.loads(Path(__file__).resolve().parent.parent.joinpath("data", "regles.json").read_text(encoding="utf-8"))
erreurs = []


def verifier(cond, msg):
    if not cond:
        erreurs.append(msg)


verifier(len(r["bonusMaitrise"]["parNiveau"]) == 20, "bonusMaitrise: 20 niveaux attendus")
for i, bm in enumerate(r["bonusMaitrise"]["parNiveau"], start=1):
    verifier(bm == 2 + (i - 1) // 4, f"bonusMaitrise niveau {i}")

for ligne in r["caracteristiques"]["modificateur"]["table"]:
    for v in (ligne["de"], ligne["a"]):
        verifier((v - 10) // 2 == ligne["mod"], f"modificateur de {v}")

ids_carac = {c["id"] for c in r["caracteristiques"]["liste"]}
ids_comp = {c["id"] for c in r["competences"]["liste"]}
verifier(len(ids_comp) == 18, "18 compétences attendues")
for c in r["competences"]["liste"]:
    verifier(c["carac"] in ids_carac, f"compétence {c['id']}: caractéristique inconnue")

ids_a_verifier = {a["id"] for a in r["meta"]["aVerifier"]}
ids_etats = {e["id"] for e in r["etats"]}
verifier(len(ids_etats) == 15, "15 états attendus")
for e in r["etats"]:
    for inc in e.get("inclut", []):
        verifier(inc in ids_etats, f"état {e['id']}: inclut {inc} inconnu")


def parcourir(noeud, chemin):
    if isinstance(noeud, dict):
        if "page" in noeud:
            verifier(isinstance(noeud["page"], int) and 1 <= noeud["page"] <= 385, f"{chemin}: page invalide")
        if isinstance(noeud.get("aVerifier"), str):
            verifier(noeud["aVerifier"] in ids_a_verifier, f"{chemin}: aVerifier inconnu")
        if "resume" in noeud and "nom" in noeud:
            verifier("page" in noeud, f"{chemin}: règle sans page")
        for k, v in noeud.items():
            parcourir(v, f"{chemin}.{k}")
    elif isinstance(noeud, list):
        for i, v in enumerate(noeud):
            parcourir(v, f"{chemin}[{i}]")


parcourir(r, "regles")

for id_classe, classe in r["classes"].items():
    t = classe["table"]
    for nom in ("artsMartiaux", "pointsDeCredo", "bonusVitesseM"):
        if nom in t:
            verifier(len(t[nom]) == 20, f"{id_classe}.table.{nom}: 20 niveaux attendus")
            verifier(t[nom] == sorted(t[nom]), f"{id_classe}.table.{nom}: doit être croissant")
    for cmp_ in classe["maitrises"]["competences"]["parmi"]:
        verifier(cmp_ in ids_comp, f"{id_classe}: compétence {cmp_} inconnue")
    niveaux = {a["niveau"] for a in classe["aptitudes"]}
    for a in classe["aptitudes"]:
        niveaux.update(a.get("repeteAuxNiveaux", []))
    niveaux.update(classe["niveauxSousClasse"])
    verifier(niveaux == set(range(1, 21)), f"{id_classe}: niveaux sans aptitude {sorted(set(range(1, 21)) - niveaux)}")
    ids_options = {o["id"] for o in classe["optionsCombat"]}
    for id_sc, sc in classe["sousClasses"].items():
        verifier({a["niveau"] for a in sc["aptitudes"]} == set(classe["niveauxSousClasse"]), f"{id_sc}: niveaux d'aptitudes")
        for o in sc["optionsCombat"]:
            if "necessite" in o:
                verifier(o["necessite"] in ids_options, f"{id_sc}.{o['id']}: necessite inconnu")

for h in r["historiques"].values():
    verifier(h["don"] in r["dons"], "historique: don inconnu")
    for c in h["competences"]:
        verifier(c in ids_comp, f"historique: compétence {c} inconnue")

if erreurs:
    print("\n".join(erreurs))
    sys.exit(1)
print("regles.json : OK")
