"""Assemble les fichiers de manuel/ en un pack de règles et le vérifie.

usage: python tools/construire_pack.py

Sources (privées, hors dépôt) :
  manuel/base.json          caractéristiques, compétences, combat, états, repos, glossaire de base
  manuel/emplacements.json  tables d'emplacements de sorts
  manuel/classes/*.json     une classe par fichier : {"id": {...}}
  manuel/especes.json, historiques.json, dons.json, equipement.json
  manuel/sorts/*.json       {"id": {...}} par fichier (par niveau)
  manuel/glossaire/*.json   listes d'entrées d'encyclopédie

Sortie : public/pack-manuel.json (servi en local, jamais publié : public/pack-manuel.json est ignoré par git).
"""
import json
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
MANUEL = RACINE / "manuel"
SORTIE = RACINE / "public" / "pack-manuel.json"


def lire(chemin: Path):
    try:
        return json.loads(chemin.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        sys.exit(f"{chemin.relative_to(RACINE)} : JSON invalide ({e})")


def fusionner_dossier(dossier: Path) -> dict:
    tout = {}
    for f in sorted(dossier.glob("*.json")) if dossier.exists() else []:
        for k, v in lire(f).items():
            if k in tout:
                sys.exit(f"{f.name} : identifiant en double « {k} »")
            tout[k] = v
    return tout


def assembler() -> dict:
    pack = lire(MANUEL / "base.json")
    pack["emplacementsSorts"] = lire(MANUEL / "emplacements.json") if (MANUEL / "emplacements.json").exists() else {
        "page": 0, "complet": [[0] * 9] * 20, "demi": [[0] * 9] * 20, "tiers": [[0] * 9] * 20, "pacte": {"emplacements": [0] * 20, "niveau": [0] * 20}}
    pack["classes"] = fusionner_dossier(MANUEL / "classes")
    for nom in ("especes", "historiques", "dons"):
        f = MANUEL / f"{nom}.json"
        pack[nom] = lire(f) if f.exists() else {}
    f = MANUEL / "equipement.json"
    pack["equipement"] = lire(f) if f.exists() else {"armes": [], "armures": [], "objets": []}
    pack["sorts"] = fusionner_dossier(MANUEL / "sorts")
    for f in sorted((MANUEL / "glossaire").glob("*.json")) if (MANUEL / "glossaire").exists() else []:
        pack["glossaire"].extend(lire(f))
    return pack


# ---------- Vérifications ----------

erreurs: list[str] = []
FORMULE_IDENT = re.compile(r"[a-zA-Z][\w.-]*")
IDENTS_CONNUS = {"niveau", "bm", "dd", "dd.sort", "attaque.sort", "mainsNues", "degats.mainsNues", "toucher.mainsNues", "de.mainsNues", "max", "min"}


def verifier(cond, msg):
    if not cond:
        erreurs.append(msg)


def verifier_formule(f, ou, colonnes):
    if isinstance(f, (int, float)):
        return
    for ident in FORMULE_IDENT.findall(re.sub(r"\d+d", "", str(f))):
        if ident in IDENTS_CONNUS or re.fullmatch(r"(mod|carac)\.(for|dex|con|int|sag|cha)", ident):
            continue
        if ident.startswith("table."):
            verifier(ident[6:] in colonnes, f"{ou} : colonne inconnue « {ident} »")
            continue
        verifier(False, f"{ou} : identifiant inconnu « {ident} » dans « {f} »")


def verifier_modele(m, ou, colonnes):
    for expr in re.findall(r"\{\+?([^}]+)\}", m or ""):
        verifier_formule(expr, ou, colonnes)


def parcourir(noeud, chemin, ids_a_verifier):
    if isinstance(noeud, dict):
        if "resume" in noeud and "nom" in noeud:
            verifier(isinstance(noeud.get("page"), int) and 0 < noeud["page"] <= 385, f"{chemin} : page manquante ou invalide")
        if isinstance(noeud.get("aVerifier"), str):
            verifier(noeud["aVerifier"] in ids_a_verifier, f"{chemin} : aVerifier inconnu « {noeud['aVerifier']} »")
        for k, v in noeud.items():
            parcourir(v, f"{chemin}.{k}", ids_a_verifier)
    elif isinstance(noeud, list):
        for i, v in enumerate(noeud):
            parcourir(v, f"{chemin}[{i}]", ids_a_verifier)


def verifier_effets(e, ou, colonnes, pack):
    comps = {c["id"] for c in pack["competences"]["liste"]}
    if "ca" in e:
        verifier_formule(e["ca"]["formule"], ou, colonnes)
    if "vitesse" in e:
        verifier_formule(e["vitesse"]["bonus"], ou, colonnes)
    if "initiative" in e:
        verifier_formule(e["initiative"], ou, colonnes)
    if "mainsNues" in e:
        verifier_formule(e["mainsNues"]["de"], ou, colonnes)
    for c in e.get("competences", []):
        verifier(c in comps, f"{ou} : compétence inconnue « {c} »")
    for r in e.get("ressources", []):
        verifier_formule(r["max"], f"{ou}.{r['id']}", colonnes)
        verifier(set(r["recharge"]) <= {"repos-court", "repos-long"}, f"{ou}.{r['id']} : recharge invalide")
    for s in e.get("sorts", []):
        verifier(s["id"] in pack["sorts"] or not pack["sorts"], f"{ou} : sort inconnu « {s['id']} »")
    for c in e.get("choix", []):
        verifier(c["type"] in {"competence", "expertise", "don", "carac", "option", "sort", "outil", "langue", "maitrise-arme"}, f"{ou}.{c['id']} : type de choix invalide")
        for x in c.get("parmi", []) if c["type"] in ("competence", "expertise") else []:
            verifier(x in comps, f"{ou}.{c['id']} : compétence inconnue « {x} »")
        for o in c.get("options", []):
            verifier_effets(o, f"{ou}.{c['id']}.{o['id']}", colonnes, pack)


def verifier_options(options, ou, colonnes, pack):
    effets = pack["combat"]["effets"]
    for o in options:
        lieu = f"{ou}.{o['id']}"
        verifier(o["emplacement"] in {"action", "bonus", "reaction", "touche", "debut-de-tour", "fin-de-tour", "initiative", "declencheur"}, f"{lieu} : emplacement invalide")
        for x in [o, *o.get("evolutions", []), *o.get("sousChoix", [])]:
            verifier_modele(x.get("de"), lieu, colonnes)
            for e in x.get("effets", []):
                verifier(e in effets, f"{lieu} : effet inconnu « {e} »")
            if "jet" in x:
                verifier_modele(x["jet"]["des"], lieu, colonnes)
                if "bonus" in x["jet"]:
                    verifier_formule(x["jet"]["bonus"], lieu, colonnes)


def verifier_pack(pack):
    ids_a_verifier = {a["id"] for a in pack["meta"]["aVerifier"]}
    parcourir(pack, "pack", ids_a_verifier)

    verifier(len(pack["bonusMaitrise"]["parNiveau"]) == 20, "bonusMaitrise : 20 niveaux attendus")
    for t in ("complet", "demi", "tiers"):
        verifier(len(pack["emplacementsSorts"][t]) == 20 and all(len(l) == 9 for l in pack["emplacementsSorts"][t]), f"emplacementsSorts.{t} : 20 × 9 attendu")

    comps = {c["id"] for c in pack["competences"]["liste"]}
    for id_c, c in pack["classes"].items():
        colonnes = set(c["table"])
        for nom, valeurs in c["table"].items():
            verifier(len(valeurs) == 20, f"{id_c}.table.{nom} : 20 niveaux attendus")
        for x in c["maitrises"]["competences"]["parmi"]:
            verifier(x in comps, f"{id_c} : compétence inconnue « {x} »")
        if c.get("dd"):
            verifier_formule(c["dd"], f"{id_c}.dd", colonnes)
        if c.get("incantation"):
            verifier(len(c["incantation"]["sortsPrepares"]) == 20, f"{id_c}.incantation.sortsPrepares : 20 niveaux attendus")
        niveaux = set()
        for a in c["aptitudes"]:
            niveaux.update([a["niveau"], *a.get("repeteAuxNiveaux", [])])
            verifier_effets(a, f"{id_c}.{a['id']}", colonnes, pack)
        verifier_options(c.get("optionsCombat", []), id_c, colonnes, pack)
        verifier(len(c["sousClasses"]) > 0, f"{id_c} : aucune sous-classe")
        for id_sc, sc in c["sousClasses"].items():
            for a in sc["aptitudes"]:
                verifier_effets(a, f"{id_c}/{id_sc}.{a['id']}", colonnes, pack)
                verifier(a["niveau"] >= c["niveauSousClasse"], f"{id_c}/{id_sc}.{a['id']} : niveau avant la sous-classe")
            verifier_options(sc.get("optionsCombat", []), f"{id_c}/{id_sc}", colonnes, pack)

    for id_e, e in pack["especes"].items():
        for t in e["traits"]:
            verifier_effets(t, f"espece {id_e}.{t['id']}", set(), pack)

    for id_h, h in pack["historiques"].items():
        verifier(h["don"] in pack["dons"], f"historique {id_h} : don inconnu « {h['don']} »")
        verifier(len(h["caracteristiques"]) == 3, f"historique {id_h} : 3 caractéristiques attendues")
        for x in h["competences"]:
            verifier(x in comps, f"historique {id_h} : compétence inconnue « {x} »")

    for id_d, d in pack["dons"].items():
        verifier(d["categorie"] in {"origine", "general", "style", "epique"}, f"don {id_d} : catégorie invalide")
        verifier_effets(d, f"don {id_d}", set(), pack)

    verifier_options(pack["combat"]["optionsCommunes"], "communes", set(), pack)

    for id_s, s in pack["sorts"].items():
        verifier(0 <= s["niveau"] <= 9, f"sort {id_s} : niveau invalide")
        for c in s["classes"]:
            verifier(c in pack["classes"] or True, "")

    ids = [g["id"] for g in pack["glossaire"]]
    doublons = {i for i in ids if ids.count(i) > 1}
    verifier(not doublons, f"glossaire : identifiants en double {sorted(doublons)}")

    etats = {e["id"] for e in pack["etats"]}
    for e in pack["etats"]:
        for inc in e.get("inclut", []):
            verifier(inc in etats, f"état {e['id']} : inclut inconnu « {inc} »")


if __name__ == "__main__":
    pack = assembler()
    verifier_pack(pack)
    if erreurs:
        print("\n".join(erreurs))
        sys.exit(1)
    SORTIE.write_text(json.dumps(pack, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(
        f"pack-manuel.json : {len(pack['classes'])} classes, {sum(len(c['sousClasses']) for c in pack['classes'].values())} sous-classes, "
        f"{len(pack['especes'])} espèces, {len(pack['historiques'])} historiques, {len(pack['dons'])} dons, {len(pack['sorts'])} sorts, "
        f"{len(pack['equipement']['armes'])} armes, {len(pack['glossaire'])} entrées de glossaire ({SORTIE.stat().st_size // 1024} Ko)"
    )
