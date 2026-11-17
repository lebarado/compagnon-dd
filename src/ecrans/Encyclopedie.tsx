import { useMemo, useState, type ReactNode } from 'react'
import { regles } from '../regles/pack'
import { correspond, nomCarac, nomCompetence } from '../regles/noms'
import type { Aptitude, Sort } from '../regles/types'
import { FeuilleRegle, LigneRegle, type Affichable } from '../composants/Feuille'
import { aIcone, Embleme, Icone, type NomIcone } from '../composants/Icone'
import { FeuilleSort, ligneSort } from './Sorts'
import type { Personnage } from '../etat/personnage'

/**
 * Encyclopédie du manuel : un accueil par rubriques, des sections claires dans chaque rubrique,
 * une page par classe et par espèce, et une recherche dans tout le pack.
 */

type IdRubrique = 'regles' | 'etats' | 'sorts' | 'classes' | 'especes' | 'historiques' | 'dons' | 'equipement'
type Page = { type: 'accueil' } | { type: 'rubrique'; id: IdRubrique } | { type: 'classe'; id: string } | { type: 'sous-classe'; classe: string; id: string } | { type: 'espece'; id: string }

interface Entree extends Affichable {
  cle: string
  rubrique: IdRubrique
  sous: string
  sort?: Sort
  /** Où mène l'entrée : sa propre page (classe, espèce) plutôt qu'un panneau. */
  page_?: Page
  index: string
}

const RUBRIQUES: { id: IdRubrique; nom: string; icone: NomIcone; aide: string }[] = [
  { id: 'regles', nom: 'Règles du jeu', icone: 'regles', aide: 'Actions, combat, déplacement, repos…' },
  { id: 'etats', nom: 'États', icone: 'etats', aide: 'Agrippé, À terre, Empoisonné…' },
  { id: 'sorts', nom: 'Sorts', icone: 'sorts', aide: 'Par niveau et par classe' },
  { id: 'classes', nom: 'Classes', icone: 'classes', aide: 'Aptitudes et sous-classes' },
  { id: 'especes', nom: 'Espèces', icone: 'especes', aide: 'Traits de chaque espèce' },
  { id: 'historiques', nom: 'Historiques', icone: 'historiques', aide: 'Ce que chacun apporte' },
  { id: 'dons', nom: 'Dons', icone: 'dons', aide: 'Origine, généraux, styles…' },
  { id: 'equipement', nom: 'Équipement', icone: 'equipement', aide: 'Armes, armures, objets' },
]

/** Ordre de lecture des règles, du plus utile en partie au plus rare. */
const ORDRE_REGLES = ['Actions', 'Combat', 'Points de vie', 'Repos', 'Déplacement', 'Vision et lumière', "Zones d'effet", 'Dangers', 'Règles générales']
const NOMS_DONS = { origine: "Dons d'origine", general: 'Dons généraux', style: 'Styles de combat', epique: 'Faveurs épiques' } as const
const NOMS_ARMURES = { legere: 'Armures légères', intermediaire: 'Armures intermédiaires', lourde: 'Armures lourdes', bouclier: 'Boucliers' } as const

const nomRubrique = (id: IdRubrique) => RUBRIQUES.find((r) => r.id === id)!.nom

function detailAptitude(a: Aptitude): Affichable {
  return { nom: a.nom, page: a.page, resume: a.resume, detail: a.detail }
}

/** Index de recherche : tout le pack, aptitudes et traits compris. */
function construireIndex(): Entree[] {
  const r = regles
  const e: Entree[] = []
  const ajouter = (x: Omit<Entree, 'index'>) => e.push({ ...x, index: `${x.nom} ${x.resume} ${(x.detail ?? []).join(' ')}` })
  for (const g of r.glossaire) ajouter({ cle: `g:${g.id}`, rubrique: 'regles', sous: g.categorie, nom: g.nom, page: g.page, resume: g.resume, detail: g.detail })
  for (const k of ['court', 'long'] as const) ajouter({ cle: `repos:${k}`, rubrique: 'regles', sous: 'Repos', nom: r.repos[k].nom, page: r.repos[k].page, resume: r.repos[k].resume, detail: r.repos[k].benefices })
  for (const x of r.etats) ajouter({ cle: `etat:${x.id}`, rubrique: 'etats', sous: 'État', nom: x.nom, page: x.page, resume: x.resume, detail: x.detail })
  for (const s of Object.values(r.sorts)) ajouter({ cle: `sort:${s.id}`, rubrique: 'sorts', sous: ligneSort(s), nom: s.nom, page: s.page, resume: s.resume, detail: s.detail, sort: s })
  for (const [id, c] of Object.entries(r.classes)) {
    ajouter({ cle: `classe:${id}`, rubrique: 'classes', sous: 'Classe', nom: c.nom, page: c.page, resume: c.resume ?? '', page_: { type: 'classe', id } })
    for (const a of c.aptitudes) ajouter({ cle: `apt:${id}:${a.id}`, rubrique: 'classes', sous: `${c.nom} niv. ${a.niveau}`, ...detailAptitude(a) })
    for (const [sid, sc] of Object.entries(c.sousClasses)) {
      ajouter({ cle: `sc:${id}:${sid}`, rubrique: 'classes', sous: `Sous-classe de ${c.nom}`, nom: sc.nom, page: sc.page, resume: sc.resume ?? '', page_: { type: 'sous-classe', classe: id, id: sid } })
      for (const a of sc.aptitudes) ajouter({ cle: `apt:${id}:${sid}:${a.id}`, rubrique: 'classes', sous: `${sc.nom} niv. ${a.niveau}`, ...detailAptitude(a) })
    }
  }
  for (const [id, x] of Object.entries(r.especes)) {
    ajouter({ cle: `espece:${id}`, rubrique: 'especes', sous: 'Espèce', nom: x.nom, page: x.page, resume: x.resume ?? '', page_: { type: 'espece', id } })
    for (const t of x.traits) ajouter({ cle: `trait:${id}:${t.id}`, rubrique: 'especes', sous: x.nom, nom: t.nom, page: t.page, resume: t.resume, detail: t.detail })
  }
  for (const id of Object.keys(r.historiques)) ajouter({ cle: `hist:${id}`, rubrique: 'historiques', ...historique(id), sous: 'Historique' })
  for (const [id, d] of Object.entries(r.dons)) ajouter({ cle: `don:${id}`, rubrique: 'dons', sous: [NOMS_DONS[d.categorie], d.prerequis].filter(Boolean).join(' · '), nom: d.nom, page: d.page, resume: d.resume, detail: d.detail })
  for (const a of r.equipement.armes) ajouter({ cle: `eq:${a.id}`, rubrique: 'equipement', sous: 'Arme', nom: a.nom, page: a.page, resume: `${a.degats} ${a.typeDegats} · ${a.proprietes.join(', ')}` })
  for (const a of r.equipement.armures) ajouter({ cle: `eq:${a.id}`, rubrique: 'equipement', sous: 'Armure', nom: a.nom, page: a.page, resume: `CA ${a.ca}` })
  for (const o of r.equipement.objets) ajouter({ cle: `eq:${o.id}`, rubrique: 'equipement', sous: o.categorie ?? 'Objet', nom: o.nom, page: o.page, resume: o.resume ?? '' })
  for (const b of r.equipement.bottes ?? []) ajouter({ cle: `botte:${b.id}`, rubrique: 'equipement', sous: "Botte d'arme", nom: b.nom, page: b.page, resume: b.resume, detail: b.detail })
  for (const b of r.equipement.proprietes ?? []) ajouter({ cle: `prop:${b.id}`, rubrique: 'equipement', sous: "Propriété d'arme", nom: b.nom, page: b.page, resume: b.resume, detail: b.detail })
  return e.sort((a, b) => a.nom.localeCompare(b.nom))
}

function historique(id: string): Affichable {
  const h = regles.historiques[id]
  const don = regles.dons[h.don]
  return {
    nom: h.nom,
    page: h.page,
    resume: `Don ${don?.nom ?? h.don} · ${h.competences.map(nomCompetence).join(', ')}`,
    detail: [
      `+3 à répartir entre ${h.caracteristiques.map(nomCarac).join(', ')} (+2/+1 ou +1/+1/+1).`,
      `Don d'origine : ${don?.nom ?? h.don}${don ? ` — ${don.resume}` : ''}`,
      `Compétences maîtrisées : ${h.competences.map(nomCompetence).join(', ')}`,
      `Outil maîtrisé : ${h.outils}`,
      ...h.equipement.choix.map((c) => `Équipement ${c.id} : ${[...c.objets, `${c.po} po`].join(', ')}`),
    ],
  }
}

/** Une section titrée de lignes. */
function Section({ titre, id, children }: { titre: ReactNode; id?: string; children: ReactNode }) {
  return (
    <section className="section-regles" id={id}>
      <h2>{titre}</h2>
      <ul className="liste regles carte">{children}</ul>
    </section>
  )
}

export function Encyclopedie({ p }: { p: Personnage | null }) {
  const index = useMemo(construireIndex, [])
  const [pile, setPile] = useState<Page[]>([{ type: 'accueil' }])
  const [recherche, setRecherche] = useState('')
  const [ouvert, setOuvert] = useState<Affichable | null>(null)
  const [sortOuvert, setSortOuvert] = useState<Sort | null>(null)
  const [niveauSort, setNiveauSort] = useState<number | null>(null)
  const [classeSort, setClasseSort] = useState<string | null>(p?.classe ?? null)

  const page = pile[pile.length - 1]
  const aller = (x: Page) => (setPile([...pile, x]), setRecherche(''), window.scrollTo(0, 0))
  const retour = () => setPile(pile.length > 1 ? pile.slice(0, -1) : pile)
  const ouvrir = (x: Entree) => (x.page_ ? aller(x.page_) : x.sort ? setSortOuvert(x.sort) : setOuvert(x))
  const ligne = (x: Affichable & { cle?: string }, sous?: string, onClick?: () => void) => (
    <LigneRegle key={x.cle ?? x.nom} titre={x.nom} sous={sous ?? x.resume} page={x.page} onClick={onClick ?? (() => setOuvert(x))} />
  )

  let titre = 'Règles'
  let corps: ReactNode

  if (recherche.trim()) {
    const parNom = index.filter((x) => correspond(x.nom, recherche))
    const parTexte = recherche.trim().length >= 3 ? index.filter((x) => !correspond(x.nom, recherche) && correspond(x.index, recherche)) : []
    const tous = [...parNom, ...parTexte]
    corps = tous.length ? (
      RUBRIQUES.map((r) => {
        const lot = tous.filter((x) => x.rubrique === r.id)
        return (
          lot.length > 0 && (
            <Section key={r.id} titre={<><Icone nom={r.icone} taille={18} /> {r.nom}</>}>
              {lot.slice(0, 25).map((x) => (
                <LigneRegle key={x.cle} titre={x.nom} sous={`${x.sous}${x.resume ? ` · ${x.resume}` : ''}`} page={x.page} onClick={() => ouvrir(x)} />
              ))}
            </Section>
          )
        )
      })
    ) : (
      <p className="aide centre">Rien trouvé.</p>
    )
  } else if (page.type === 'accueil') {
    corps = (
      <div className="rubriques">
        {RUBRIQUES.map((r) => (
          <button key={r.id} className="rubrique" onClick={() => aller({ type: 'rubrique', id: r.id })}>
            <Icone nom={r.icone} taille={34} />
            <strong>{r.nom}</strong>
            <small>{r.aide}</small>
          </button>
        ))}
      </div>
    )
  } else if (page.type === 'rubrique') {
    titre = nomRubrique(page.id)
    const r = regles
    switch (page.id) {
      case 'regles': {
        const groupes = new Map<string, Affichable[]>()
        for (const g of r.glossaire) groupes.set(g.categorie, [...(groupes.get(g.categorie) ?? []), g])
        groupes.set('Repos', [r.repos.court, r.repos.long].map((x) => ({ ...x, detail: x.benefices })))
        const ordre = [...ORDRE_REGLES, ...[...groupes.keys()].filter((k) => !ORDRE_REGLES.includes(k))]
        const presents = ordre.filter((k) => groupes.has(k))
        corps = (
          <>
            <div className="puces defilantes sommaire-regles">
              {presents.map((k) => (
                <button key={k} className="puce" onClick={() => document.getElementById(`section-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                  {k}
                </button>
              ))}
            </div>
            {presents.map((k) => (
              <Section key={k} id={`section-${k}`} titre={k}>
                {groupes.get(k)!.map((x) => ligne(x))}
              </Section>
            ))}
          </>
        )
        break
      }
      case 'etats':
        corps = (
          <Section titre="États (glossaire)">
            {[...r.etats].sort((a, b) => a.nom.localeCompare(b.nom)).map((x) => ligne(x))}
          </Section>
        )
        break
      case 'sorts': {
        const listes = [...new Set(Object.values(r.sorts).flatMap((s) => s.classes))].sort()
        const sorts = Object.values(r.sorts)
          .filter((s) => (niveauSort === null || s.niveau === niveauSort) && (!classeSort || s.classes.includes(classeSort)))
          .sort((a, b) => a.niveau - b.niveau || a.nom.localeCompare(b.nom))
        const niveaux = [...new Set(sorts.map((s) => s.niveau))]
        corps = (
          <>
            <div className="puces defilantes">
              <button className={`puce ${classeSort === null ? 'choisi' : ''}`} onClick={() => setClasseSort(null)}>
                Toutes classes
              </button>
              {listes.map((id) => (
                <button key={id} className={`puce ${classeSort === id ? 'choisi' : ''}`} onClick={() => setClasseSort(id)}>
                  {r.classes[id]?.nom ?? id}
                </button>
              ))}
            </div>
            <div className="puces defilantes">
              {[null, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button key={String(n)} className={`puce ${niveauSort === n ? 'choisi' : ''}`} onClick={() => setNiveauSort(n)}>
                  {n === null ? 'Tous' : n === 0 ? 'Mineurs' : `Niv. ${n}`}
                </button>
              ))}
            </div>
            {niveaux.map((n) => (
              <Section key={n} titre={`${n === 0 ? 'Sorts mineurs' : `Niveau ${n}`} · ${sorts.filter((s) => s.niveau === n).length}`}>
                {sorts
                  .filter((s) => s.niveau === n)
                  .map((s) => (
                    <LigneRegle
                      key={s.id}
                      titre={s.nom}
                      sous={`${s.ecole}${s.concentration ? ' · Concentration' : ''}${s.rituel ? ' · rituel' : ''} · ${s.resume}`}
                      page={s.page}
                      onClick={() => setSortOuvert(s)}
                    />
                  ))}
              </Section>
            ))}
            {sorts.length === 0 && <p className="aide centre">Aucun sort pour ce filtre.</p>}
          </>
        )
        break
      }
      case 'classes':
        corps = (
          <ul className="liste-choix">
            {Object.entries(r.classes).map(([id, c]) => (
              <li key={id}>
                <button className="choix-principal avec-vignette" onClick={() => aller({ type: 'classe', id })}>
                  <Embleme classe={id} taille={44} />
                  <span className="choix-texte">
                    <strong>{c.nom}</strong>
                    <small>
                      d{c.deDeVie} · {c.caracPrincipales.map(nomCarac).join(', ')}
                      {c.resume ? ` · ${c.resume}` : ''}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
        break
      case 'especes':
        corps = (
          <ul className="liste-choix">
            {Object.entries(r.especes).map(([id, x]) => (
              <li key={id}>
                <button className="choix-principal avec-vignette" onClick={() => aller({ type: 'espece', id })}>
                  <span className="vignette">{aIcone(id) && <Icone nom={id} taille={28} />}</span>
                  <span className="choix-texte">
                    <strong>{x.nom}</strong>
                    <small>
                      Taille {x.taille} · {String(x.vitesse).replace('.', ',')} m · {x.traits.map((t) => t.nom).join(', ')}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
        break
      case 'historiques':
        corps = <Section titre="Historiques">{Object.keys(r.historiques).map((id) => ligne(historique(id)))}</Section>
        break
      case 'dons':
        corps = (Object.keys(NOMS_DONS) as (keyof typeof NOMS_DONS)[]).map((cat) => {
          const lot = Object.values(r.dons)
            .filter((d) => d.categorie === cat)
            .sort((a, b) => a.nom.localeCompare(b.nom))
          return (
            lot.length > 0 && (
              <Section key={cat} titre={NOMS_DONS[cat]}>
                {lot.map((d) => ligne(d, [d.prerequis, d.resume].filter(Boolean).join(' · ')))}
              </Section>
            )
          )
        })
        break
      case 'equipement': {
        const eq = r.equipement
        const armes = (cat: string) => eq.armes.filter((a) => a.categorie === cat).map((a) => ligne({ ...a, resume: `${a.degats} ${a.typeDegats}` }, `${a.degats} ${a.typeDegats} · ${a.proprietes.join(', ')}`))
        const objets = new Map<string, typeof eq.objets>()
        for (const o of eq.objets) objets.set(o.categorie ?? 'Objets', [...(objets.get(o.categorie ?? 'Objets') ?? []), o])
        corps = (
          <>
            <Section titre="Armes courantes">{armes('courante')}</Section>
            <Section titre="Armes de guerre">{armes('guerre')}</Section>
            {(Object.keys(NOMS_ARMURES) as (keyof typeof NOMS_ARMURES)[]).map((cat) => (
              <Section key={cat} titre={NOMS_ARMURES[cat]}>
                {eq.armures.filter((a) => a.categorie === cat).map((a) => ligne({ ...a, resume: `CA ${a.ca}` }))}
              </Section>
            ))}
            {[...objets.entries()].map(([cat, lot]) => (
              <Section key={cat} titre={cat}>
                {[...lot].sort((a, b) => a.nom.localeCompare(b.nom)).map((o) => ligne({ ...o, resume: o.resume ?? '' }))}
              </Section>
            ))}
            {(eq.proprietes ?? []).length > 0 && <Section titre="Propriétés des armes">{eq.proprietes!.map((x) => ligne(x))}</Section>}
            {(eq.bottes ?? []).length > 0 && <Section titre="Bottes d'arme">{eq.bottes!.map((x) => ligne(x))}</Section>}
          </>
        )
        break
      }
    }
  } else if (page.type === 'classe') {
    const c = regles.classes[page.id]
    titre = c.nom
    const niveaux = [...new Set(c.aptitudes.map((a) => a.niveau))].sort((a, b) => a - b)
    corps = (
      <>
        <div className="fiche-tete">
          <Embleme classe={page.id} taille={64} />
          <p>{c.resume}</p>
        </div>
        <Section titre="En bref">
          <li className="ligne-info">
            <span>Dé de vie</span>
            <strong>d{c.deDeVie}</strong>
          </li>
          <li className="ligne-info">
            <span>Caractéristique principale</span>
            <strong>{c.caracPrincipales.map(nomCarac).join(', ')}</strong>
          </li>
          <li className="ligne-info">
            <span>Sauvegardes maîtrisées</span>
            <strong>{c.maitrises.sauvegardes.map(nomCarac).join(', ')}</strong>
          </li>
          <li className="ligne-info">
            <span>Compétences</span>
            <strong>
              {c.maitrises.competences.nombre} parmi {c.maitrises.competences.parmi.map(nomCompetence).join(', ')}
            </strong>
          </li>
          <li className="ligne-info">
            <span>Armes</span>
            <strong>{c.maitrises.armes}</strong>
          </li>
          <li className="ligne-info">
            <span>Armures</span>
            <strong>{c.maitrises.armures.join(', ') || 'aucune'}</strong>
          </li>
        </Section>
        <Section titre={`Sous-classes · dès le niveau ${c.niveauSousClasse}`}>
          {Object.entries(c.sousClasses).map(([sid, sc]) => (
            <LigneRegle key={sid} titre={sc.nom} sous={sc.resume} page={sc.page} onClick={() => aller({ type: 'sous-classe', classe: page.id, id: sid })} />
          ))}
        </Section>
        {niveaux.map((n) => (
          <Section key={n} titre={`Niveau ${n}`}>
            {c.aptitudes.filter((a) => a.niveau === n).map((a) => ligne(detailAptitude(a)))}
          </Section>
        ))}
      </>
    )
  } else if (page.type === 'sous-classe') {
    const c = regles.classes[page.classe]
    const sc = c.sousClasses[page.id]
    titre = sc.nom
    const niveaux = [...new Set(sc.aptitudes.map((a) => a.niveau))].sort((a, b) => a - b)
    corps = (
      <>
        <div className="fiche-tete">
          <Embleme classe={page.classe} taille={64} />
          <p>
            Sous-classe de {c.nom}. {sc.resume}
          </p>
        </div>
        {niveaux.map((n) => (
          <Section key={n} titre={`Niveau ${n}`}>
            {sc.aptitudes.filter((a) => a.niveau === n).map((a) => ligne(detailAptitude(a)))}
          </Section>
        ))}
      </>
    )
  } else {
    const x = regles.especes[page.id]
    titre = x.nom
    corps = (
      <>
        <div className="fiche-tete">
          <span className="embleme" style={{ width: 64, height: 64 }}>
            {aIcone(page.id) && <Icone nom={page.id} taille={36} />}
          </span>
          <p>
            {x.resume} Taille {x.taille}, vitesse {String(x.vitesse).replace('.', ',')} m.
          </p>
        </div>
        <Section titre="Traits">{x.traits.map((t) => ligne(t))}</Section>
      </>
    )
  }

  return (
    <main className="ecran">
      <header className="tete">
        {pile.length > 1 && !recherche.trim() ? (
          <button className="bouton discret retour" onClick={retour} aria-label="Retour">
            ‹
          </button>
        ) : null}
        <h1 className="titre-regles">{recherche.trim() ? 'Recherche' : titre}</h1>
        {page.type !== 'accueil' && !recherche.trim() && (
          <button className="bouton discret petit" onClick={() => setPile([{ type: 'accueil' }])}>
            Sommaire
          </button>
        )}
      </header>
      <input className="champ" type="search" placeholder="Chercher : Agrippé, Boule de feu, Rage…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      {corps}
      {sortOuvert && (p ? <FeuilleSort p={p} sort={sortOuvert} onFermer={() => setSortOuvert(null)} /> : <FeuilleRegle regle={sortOuvert} onFermer={() => setSortOuvert(null)} />)}
      {ouvert && <FeuilleRegle regle={ouvert} onFermer={() => setOuvert(null)} />}
    </main>
  )
}
