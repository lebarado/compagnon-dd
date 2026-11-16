# Compagnon D&D

PWA de fiche de personnage et de carnet de campagne pour Donjons & Dragons (règles 2024), utilisée sur téléphone à la table. Tout est en français.

## Périmètre

- Personnage actuel : Nain Moine, historique Fermier, sous-classe Credo de la Paume au niveau 3. Niveaux 1 à 20.
- La structure des règles est générique (classes, espèces, historiques, dons), mais seul le contenu de ce personnage est extrait. Ajouter une classe = extraire ses pages dans `data/regles.json` + coder ses mécaniques propres. Les sorts ne sont pas prévus.
- Les combats et les dés se jouent en vrai : pas de combat tour par tour géré par l'app, pas de lanceur de dés.
- Cinq écrans, barre en bas : PERSO, COMBAT, INVENTAIRE, REPOS ET PROGRESSION, CARNET.

## Plan (une étape livrée et validée à la fois)

1. Extraction des règles → `data/regles.json` (fait)
2. Écran PERSO + saisie initiale + PWA + mise en ligne GitHub Pages
3. Écran COMBAT
4. Écran INVENTAIRE (extraire alors les tables d'armes, chapitre 6)
5. Repos et progression (extraire alors les dons choisis et les Faveurs épiques)
6. Carnet de campagne
7. Finitions : export/import JSON, hors ligne, performance

À chaque étape : livrer quelque chose de testable, dire quoi tester en 3 lignes, attendre le retour.

État : étape 2 codée (saisie initiale + PERSO), en attente de mise en ligne et du retour sur téléphone.

## Commandes

- `npm run dev` (serveur local, aussi dans `.claude/launch.json`), `npm test`, `npm run build`, `npm run regles`.
- Les scripts appellent `node node_modules/...` directement : le `&` du dossier `D&D` casse les raccourcis `.cmd` de npm sous Windows.

## Code

- `src/regles/regles.ts` : types et accès à `data/regles.json`. `src/regles/calculs.ts` : fonctions pures.
- `src/etat/personnage.ts` : état, réducteur, dégâts et soins. `src/etat/stockage.ts` : localStorage.
- `src/ecrans/` : un fichier par écran. `src/composants/Feuille.tsx` : panneau du bas (détail d'une règle, pavé).
- Le niveau et l'ajustement de PV max dans « Modifier » sont provisoires, à remplacer par le passage de niveau guidé (étape 5).

## Contraintes de design (non négociables)

- Un écran = une intention. 5 à 7 éléments visibles au plus ; le reste se déplie.
- En combat : seulement ce qui est faisable maintenant. Un titre, le coût, le dé. L'explication est à un appui et se referme facilement.
- Boutons d'au moins 48 px, usage à une main, thème sombre par défaut.
- Une couleur d'accent, une pour « disponible », une pour « épuisé ». Pas de décoration.
- PV, CA et Credo sont les plus gros chiffres de l'écran.
- PV, Credo, objets : un ou deux appuis, sans formulaire.
- En cas d'hésitation entre une fonctionnalité et un écran léger : écran léger, fonctionnalité proposée en option.

## Technique

- React + Vite + TypeScript, `vite-plugin-pwa`, Vitest. Pas de backend, aucune dépendance lourde.
- Hébergement : GitHub Pages (dépôt public). `reference/` est dans `.gitignore` et ne doit jamais être publié.
- Règles (`data/regles.json`) et état du personnage (stockage local, export/import JSON) sont séparés.
- Calculs (modificateurs, CA, dé d'Arts martiaux, Credo max, PV max…) dans des fonctions pures testées. Aucune régression à la montée de niveau.

## Règles : conventions de `data/regles.json`

- Ne jamais inventer une règle. En cas de doute 2014/2024 : 2024. Signaler toute ambiguïté à l'utilisateur au lieu de trancher.
- Chaque règle porte `page` = numéro imprimé du manuel. L'app l'affiche (« p. XX »).
- Textes reformulés, jamais copiés : `resume` (une ligne, pour l'écran) et `detail` (liste, pour le dépliant).
- `meta.aVerifier` liste les points douteux ; une règle concernée y renvoie par `aVerifier: "<id>"`.
- `optionsCombat[].emplacement` : `action`, `bonus`, `reaction`, `touche`, `debut-de-tour`, `fin-de-tour`, `initiative`, `declencheur`.
- Vocabulaire de l'édition française : Pointe (Dash), Soutien (Help), Furtivité (Hide), Intention (Ready), Agrippé (Grappled), Neutralisé (Incapacitated), Credo (Focus), Déluge de coups, Patience défensive, Porté par le vent.

## Accès au manuel

Le PDF (`reference/manuel-des-joueurs-2024.pdf`, 265 Mo, scan) ne doit jamais être lu en entier.

- **Page PDF = page imprimée + 1.**
- Texte OCR : `reference/manuel.txt`, une section `===== PDF PAGE n (manuel p. n-1) =====` par page, colonne gauche puis droite. Chercher avec Grep, lire seulement les lignes utiles. Régénérer : `python -I tools/extraire_texte.py reference/manuel-des-joueurs-2024.pdf reference/manuel.txt` (PyMuPDF requis ; `pdftotext` n'est pas installé).
- L'OCR est souvent tronqué (moitié de colonne manquante, tables mélangées). Dans ce cas, rendre la page en image et la lire : `python -I tools/rendre_pages.py reference/manuel-des-joueurs-2024.pdf <dossier> 52 <page PDF>…` produit `p<N>a.png` (haut) et `p<N>b.png` (bas), lisibles à 52 dpi.
- Pages imprimées utiles : caractéristiques 10, compétences 14, combat 23-29, création 40-42, Moine 127-129, Paume 133, Fermier 181, Nain 194, dons 199-202 et suivantes, glossaire (actions, états, repos) 360-377.
