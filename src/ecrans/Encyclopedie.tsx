import { useMemo, useState } from 'react'
import { regles } from '../regles/pack'
import { correspond, nomCarac, nomCompetence } from '../regles/noms'
import { toutEquipement } from '../regles/equipement'
import type { Sort } from '../regles/types'
import { FeuilleRegle, LigneRegle, type Affichable } from '../composants/Feuille'
import { FeuilleSort, ligneSort } from './Sorts'
import type { Personnage } from '../etat/personnage'

interface Entree extends Affichable {
  cle: string
  categorie: string
  sous: string
  sort?: Sort
  /** Texte indexé pour la recherche. */
  index: string
}

const CATEGORIES = ['Règles', 'États', 'Sorts', 'Classes', 'Espèces', 'Historiques', 'Dons', 'Équipement'] as const

/** Index unique de tout le pack : chaque entrée garde sa page du manuel. */
function construireIndex(): Entree[] {
  const r = regles
  const e: Entree[] = []
  const ajouter = (x: Omit<Entree, 'index'>) => e.push({ ...x, index: `${x.nom} ${x.resume} ${(x.detail ?? []).join(' ')}` })

  for (const g of r.glossaire) ajouter({ cle: `g:${g.id}`, categorie: 'Règles', sous: g.categorie, nom: g.nom, page: g.page, resume: g.resume, detail: g.detail })
  for (const k of ['court', 'long'] as const) ajouter({ cle: `repos:${k}`, categorie: 'Règles', sous: 'Repos', nom: r.repos[k].nom, page: r.repos[k].page, resume: r.repos[k].resume, detail: r.repos[k].benefices })
  for (const x of r.etats) ajouter({ cle: `etat:${x.id}`, categorie: 'États', sous: 'État', nom: x.nom, page: x.page, resume: x.resume, detail: x.detail })
  for (const s of Object.values(r.sorts)) ajouter({ cle: `sort:${s.id}`, categorie: 'Sorts', sous: ligneSort(s), nom: s.nom, page: s.page, resume: s.resume, detail: s.detail, sort: s })
  for (const [id, c] of Object.entries(r.classes)) {
    ajouter({
      cle: `classe:${id}`,
      categorie: 'Classes',
      sous: `d${c.deDeVie} · ${c.caracPrincipales.map(nomCarac).join(', ')}`,
      nom: c.nom,
      page: c.page,
      resume: c.resume ?? '',
      detail: [
        `Sauvegardes : ${c.maitrises.sauvegardes.map(nomCarac).join(', ')}`,
        `Compétences : ${c.maitrises.competences.nombre} parmi ${c.maitrises.competences.parmi.map(nomCompetence).join(', ')}`,
        `Armes : ${c.maitrises.armes}`,
        `Armures : ${c.maitrises.armures.join(', ') || 'aucune'}`,
        ...c.aptitudes.map((a) => `Niveau ${a.niveau} · ${a.nom} : ${a.resume}`),
        `Sous-classes : ${Object.values(c.sousClasses)
          .map((s) => `${s.nom} (p. ${s.page})`)
          .join(', ')}`,
      ],
    })
    for (const a of c.aptitudes) ajouter({ cle: `apt:${id}:${a.id}`, categorie: 'Classes', sous: `${c.nom} ${a.niveau}`, nom: a.nom, page: a.page, resume: a.resume, detail: a.detail })
    for (const [sid, sc] of Object.entries(c.sousClasses)) {
      ajouter({ cle: `sc:${id}:${sid}`, categorie: 'Classes', sous: `Sous-classe de ${c.nom}`, nom: sc.nom, page: sc.page, resume: sc.resume ?? '', detail: sc.aptitudes.map((a) => `Niveau ${a.niveau} · ${a.nom} : ${a.resume}`) })
      for (const a of sc.aptitudes) ajouter({ cle: `apt:${id}:${sid}:${a.id}`, categorie: 'Classes', sous: `${sc.nom} ${a.niveau}`, nom: a.nom, page: a.page, resume: a.resume, detail: a.detail })
    }
  }
  for (const [id, x] of Object.entries(r.especes)) {
    ajouter({ cle: `espece:${id}`, categorie: 'Espèces', sous: `Taille ${x.taille} · ${x.vitesse} m`, nom: x.nom, page: x.page, resume: x.resume ?? '', detail: x.traits.map((t) => `${t.nom} : ${t.resume}`) })
    for (const t of x.traits) ajouter({ cle: `trait:${id}:${t.id}`, categorie: 'Espèces', sous: x.nom, nom: t.nom, page: t.page, resume: t.resume, detail: t.detail })
  }
  for (const [id, h] of Object.entries(r.historiques)) {
    ajouter({
      cle: `hist:${id}`,
      categorie: 'Historiques',
      sous: h.caracteristiques.map(nomCarac).join(', '),
      nom: h.nom,
      page: h.page,
      resume: `${r.dons[h.don]?.nom ?? h.don} · ${h.competences.map(nomCompetence).join(', ')}`,
      detail: [`Caractéristiques : ${h.caracteristiques.map(nomCarac).join(', ')}`, `Don : ${r.dons[h.don]?.nom ?? h.don}`, `Compétences : ${h.competences.map(nomCompetence).join(', ')}`, `Outils : ${h.outils}`, ...h.equipement.choix.map((c) => `Équipement ${c.id} : ${[...c.objets, `${c.po} po`].join(', ')}`)],
    })
  }
  const NOMS_CAT = { origine: "Don d'origine", general: 'Don général', style: 'Style de combat', epique: 'Faveur épique' }
  for (const [id, d] of Object.entries(r.dons)) ajouter({ cle: `don:${id}`, categorie: 'Dons', sous: [NOMS_CAT[d.categorie], d.prerequis].filter(Boolean).join(' · '), nom: d.nom, page: d.page, resume: d.resume, detail: d.detail })
  for (const x of toutEquipement()) {
    const sous = x.genre === 'arme' ? `${x.e.degats} ${x.e.typeDegats} · ${x.e.proprietes.join(', ')}` : x.genre === 'armure' ? `CA ${x.e.ca}` : (x.e.categorie ?? 'Objet')
    ajouter({ cle: `eq:${x.e.id}`, categorie: 'Équipement', sous, nom: x.e.nom, page: x.e.page, resume: x.genre === 'objet' ? (x.e.resume ?? '') : sous })
  }
  for (const b of r.equipement.bottes ?? []) ajouter({ cle: `botte:${b.id}`, categorie: 'Équipement', sous: "Botte d'arme", nom: b.nom, page: b.page, resume: b.resume, detail: b.detail })
  for (const b of r.equipement.proprietes ?? []) ajouter({ cle: `prop:${b.id}`, categorie: 'Équipement', sous: "Propriété d'arme", nom: b.nom, page: b.page, resume: b.resume, detail: b.detail })
  return e.sort((a, b) => a.nom.localeCompare(b.nom))
}

export function Encyclopedie({ p }: { p: Personnage | null }) {
  const index = useMemo(construireIndex, [])
  const [recherche, setRecherche] = useState('')
  const [categorie, setCategorie] = useState<string | null>(null)
  const [ouvert, setOuvert] = useState<Entree | null>(null)

  const parNom = index.filter((x) => (!categorie || x.categorie === categorie) && correspond(x.nom, recherche))
  const parTexte = recherche.trim().length >= 3 ? index.filter((x) => (!categorie || x.categorie === categorie) && !correspond(x.nom, recherche) && correspond(x.index, recherche)) : []
  const resultats = [...parNom, ...parTexte].slice(0, 150)

  return (
    <main className="ecran">
      <header className="tete">
        <h1>Règles</h1>
        <span className="note">{index.length} entrées</span>
      </header>
      <input className="champ" type="search" placeholder="Rechercher : Agrippé, Boule de feu, Repos…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      <div className="puces defilantes">
        {CATEGORIES.map((c) => (
          <button key={c} className={`puce ${categorie === c ? 'choisi' : ''}`} onClick={() => setCategorie(categorie === c ? null : c)}>
            {c}
          </button>
        ))}
      </div>
      {!recherche.trim() && !categorie ? (
        <p className="aide centre">Cherche un mot, ou choisis une catégorie.</p>
      ) : (
        <ul className="liste regles carte">
          {resultats.map((x) => (
            <LigneRegle key={x.cle} titre={x.nom} sous={`${x.sous}${x.resume && x.resume !== x.sous ? ` · ${x.resume}` : ''}`} page={x.page} onClick={() => setOuvert(x)} />
          ))}
          {resultats.length === 0 && <li className="aide centre">Rien trouvé.</li>}
        </ul>
      )}
      {ouvert?.sort && p ? (
        <FeuilleSort p={p} sort={ouvert.sort} onFermer={() => setOuvert(null)} />
      ) : (
        ouvert && <FeuilleRegle regle={{ ...ouvert, info: ouvert.sort ? ouvert.sous : undefined }} onFermer={() => setOuvert(null)} />
      )}
    </main>
  )
}
