# Compagnon D&D

PWA de fiche de personnage et de carnet de campagne pour Donjons & Dragons (règles 2024), utilisée sur téléphone à la table. Tout est en français. Usage strictement personnel : l'utilisateur ne diffuse pas l'app.

## Périmètre

- Création de n'importe quel personnage (12 classes et leurs sous-classes, 10 espèces, 16 historiques, dons), niveaux 1 à 20.
- Écrans : Perso, Combat, Sorts (lanceurs), Sac, Carnet, Règles (encyclopédie : règles, états, sorts, dons, équipement…). Plusieurs personnages.
- Les combats et les dés se jouent en vrai : pas de lanceur de dés. L'app suit les ressources, les cases d'action du tour et les effets en cours.
- Personnage de l'utilisateur : Nain Moine Fermier, Credo de la Paume (test de référence `src/test/pack.ts`).

## Le contenu du manuel est privé

- Le dépôt GitHub est public : il ne contient **aucun** contenu du manuel. `reference/`, `manuel/`, `data/` et `public/pack-manuel.json` sont dans `.gitignore`.
- Les règles sont un « pack » JSON construit localement (`python tools/construire_pack.py` → `public/pack-manuel.json`, validé au passage). L'app le charge au premier lancement : servi par le serveur local, ou importé comme fichier sur le téléphone (écran d'import), puis gardé en IndexedDB.
- Le manuel n'est jamais recopié : `resume` (une ligne utile en partie) et `detail` (liste courte) sont reformulés. Chaque entrée porte `page` = page imprimée.
- Ne jamais inventer une règle. Les versions en ligne (SRD) ne servent pas de source : seul le manuel 2024 fait foi. Signaler toute ambiguïté à l'utilisateur (`meta.aVerifier`).

## Sources du pack (`manuel/`, privé)

- `manuel/sources/*.py` : générateurs (une classe par fichier, `commun.py` pour les aides). Lancer depuis `manuel/sources` (`python classe_guerrier.py`) puis `python tools/construire_pack.py` depuis la racine.
- `moine.json` vient d'une conversion ; ses sous-classes autres que la Paume sont ajoutées par `moine_sous_classes.py`.
- Tables d'emplacements (`manuel/emplacements.json`) écrites par Barde (complet), Guerrier (tiers), Paladin (demi), Occultiste (pacte).
- Sorts : `tools/extraire_sorts.py` découpe l'OCR en `reference/sorts-brut.json` ; les résumés sont rédigés dans `manuel/sources/sorts_*.py`. Identifiant de sort = `slug` du nom (minuscules, sans accents, œ→oe, autres caractères → `-`), identique dans `src/regles/noms.ts` et `commun.py`.
- Formules (`src/regles/formule.ts`) : `niveau`, `bm`, `mod.X`, `carac.X`, `table.COL`, `dd`, `dd.sort`, `attaque.sort`, `de.mainsNues`, `max`, `min`, division entière. Modèles de texte : `{expr}` et `{+expr}` (signé).
- `optionsCombat[].emplacement` : `action`, `bonus`, `reaction`, `touche`, `debut-de-tour`, `fin-de-tour`, `initiative`, `declencheur`.
- Vocabulaire de l'édition française : Pointe (Dash), Soutien (Help), Furtivité (Hide), Intention (Ready), Agrippé (Grappled), Neutralisé (Incapacitated), Credo (Focus), Conduit divin, Second souffle, Fougue.

## Accès au manuel

Le PDF (`reference/manuel-des-joueurs-2024.pdf`, scan) ne doit jamais être lu en entier. **Page PDF = page imprimée + 1.**

- OCR Tesseract (fra, `reference/tessdata`) : `reference/ocr/p<N>.txt` (pleine page, N = page PDF, assemblé dans `reference/manuel-ocr.txt`) et `reference/ocr-col/p<N>g.txt` / `p<N>d.txt` (colonne par colonne, plus fiable ; `python -I tools/ocr_colonnes.py <début> <fin>`).
- Quand l'OCR est douteux, lire l'image : `python -I tools/rendre_pages.py reference/manuel-des-joueurs-2024.pdf <dossier> 55 <page PDF>[:zone]…`, zones `a`/`b` (moitiés haute/basse), `g`/`d` (colonnes), `hg`, `hd`, `bg`, `bd`.
- Pages imprimées : création 38-42, classes 50-175 (Moine 126-133), historiques 178-185, espèces 186-197, dons 198-211, équipement 212-235, sorts 236-343, glossaire 360-377.

## Commandes

- `npm run dev` (aussi dans `.claude/launch.json`), `npm test`, `npm run build`, `npm run regles` (= construire le pack).
- Les scripts appellent `node node_modules/...` directement : le `&` du dossier `D&D` casse les raccourcis `.cmd` de npm sous Windows.
- En ligne : https://lebarado.github.io/compagnon-dd/ (dépôt `lebarado/compagnon-dd`). Un push sur `main` teste, compile et redéploie (`.github/workflows/pages.yml`) ; les tests qui lisent le pack sont sautés en CI. Les commits utilisent l'adresse noreply GitHub.

## Code

- `src/regles/types.ts` (schéma du pack), `pack.ts` (chargement, IndexedDB), `calculs.ts` (fonctions pures : caracs, CA, pv, ressources, sorts…), `options.ts` (options de combat), `formule.ts`, `equipement.ts`, `noms.ts`.
- `src/etat/personnage.ts` (état v2, réducteur), `combat.ts` (tour en cours), `stockage.ts` (localStorage, export/import).
- `src/ecrans/` : un fichier par écran ; `src/composants/Feuille.tsx` : panneau du bas.
- Tests : `src/regles/*.test.ts`, `src/etat/*.test.ts`. Aucune régression à la montée de niveau.

## Contraintes de design (non négociables)

- Un écran = une intention. 5 à 7 éléments visibles au plus ; le reste se déplie.
- En combat : seulement ce qui est faisable maintenant. Un titre, le coût, le dé. L'explication est à un appui et se referme facilement.
- Boutons d'au moins 48 px, usage à une main, thème sombre par défaut.
- Une couleur d'accent, une pour « disponible », une pour « épuisé ». Pas de décoration.
- PV, CA et la ressource principale sont les plus gros chiffres de l'écran.
- PV, ressources, objets : un ou deux appuis, sans formulaire.
- En cas d'hésitation entre une fonctionnalité et un écran léger : écran léger, fonctionnalité proposée en option.
