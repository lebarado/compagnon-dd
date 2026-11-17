import { useState, type Dispatch } from 'react'
import { regles } from '../regles/pack'
import {
  attaqueSorts,
  ddSorts,
  emplacements,
  formatMod,
  incantationDe,
  niveauSortMax,
  nombreSortsMineurs,
  nombreSortsPrepares,
  ressourceRestante,
  sortsAccordes,
  sortsChoisis,
} from '../regles/calculs'
import { sortsDisponibles, tempsSort } from '../regles/options'
import { correspond, NOMS_TEMPS } from '../regles/noms'
import type { Sort } from '../regles/types'
import type { Action, Personnage } from '../etat/personnage'
import type { Place } from '../etat/combat'
import { Feuille } from '../composants/Feuille'

export function ligneSort(s: Sort): string {
  return `${s.niveau === 0 ? 'Sort mineur' : `Niveau ${s.niveau}`} · ${s.ecole}${s.rituel ? ' · rituel' : ''}${s.concentration ? ' · concentration' : ''}`
}

/** Fiche d'un sort ; « Lancer » dépense un emplacement (et la case du tour en combat). */
export function FeuilleSort({ p, sort, place, dispatch, onFermer }: { p: Personnage; sort: Sort; place?: Place; dispatch?: Dispatch<Action>; onFermer: () => void }) {
  const disponibles = emplacements(p).filter((e) => e.niveau >= sort.niveau && ressourceRestante(p, e.id) > 0)
  const connu = sortsDisponibles(p).some((s) => s.id === sort.id)
  const lancer = (emplacement?: string) => {
    dispatch?.({
      type: 'utiliser',
      place: place ?? 'libre',
      demande: { id: `sort:${sort.id}`, nom: sort.nom, couts: emplacement ? { [emplacement]: 1 } : {}, concentration: sort.concentration ? sort.nom : undefined },
    })
    onFermer()
  }
  return (
    <Feuille titre={sort.nom} onFermer={onFermer}>
      <p className="info-regle">{ligneSort(sort)}</p>
      <dl className="fiche-sort">
        <dt>Incantation</dt>
        <dd>{sort.incantation}</dd>
        <dt>Portée</dt>
        <dd>{sort.portee}</dd>
        <dt>Composantes</dt>
        <dd>{sort.composantes}</dd>
        <dt>Durée</dt>
        <dd>{sort.duree}</dd>
      </dl>
      <ul className="detail">
        {(sort.detail?.length ? sort.detail : [sort.resume]).map((l, i) => (
          <li key={i}>{l}</li>
        ))}
        {sort.niveauSup && <li>Niveau supérieur : {sort.niveauSup}</li>}
      </ul>
      <p className="page-manuel">
        Manuel des joueurs, p. {sort.page}
        {incantationDe(p) ? ` · DD ${ddSorts(p)} · attaque ${formatMod(attaqueSorts(p))}` : ''}
      </p>
      {dispatch && connu && (
        <div className="lancer">
          {sort.niveau === 0 ? (
            <button className="bouton principal large" onClick={() => lancer()}>
              Lancer
            </button>
          ) : disponibles.length ? (
            disponibles.map((e) => (
              <button key={e.id} className="bouton principal" onClick={() => lancer(e.id)}>
                {e.id === 'pacte' ? `Pacte (niv. ${e.niveau})` : `Niveau ${e.niveau}`} · {ressourceRestante(p, e.id)}
              </button>
            ))
          ) : (
            <p className="aide">Plus d'emplacement de niveau {sort.niveau} ou plus.</p>
          )}
        </div>
      )}
    </Feuille>
  )
}

/** Choix des sorts mineurs et préparés, filtrés par la liste de la classe et le niveau accessible. */
function FeuillePreparer({ p, dispatch, onFermer }: { p: Personnage; dispatch: Dispatch<Action>; onFermer: () => void }) {
  const inc = incantationDe(p)!
  const [recherche, setRecherche] = useState('')
  const [mineurs, setMineurs] = useState(p.sorts.mineurs)
  const [prepares, setPrepares] = useState(p.sorts.prepares)
  const maxMineurs = nombreSortsMineurs(p)
  const maxPrepares = nombreSortsPrepares(p)
  const niveauMax = niveauSortMax(p)
  const accordes = new Set(sortsAccordes(p))
  const liste = Object.values(regles.sorts)
    .filter((s) => s.classes.includes(inc.liste) && s.niveau <= niveauMax && (s.niveau > 0 || maxMineurs > 0) && !accordes.has(s.id))
    .filter((s) => correspond(s.nom, recherche))
    .sort((a, b) => a.niveau - b.niveau || a.nom.localeCompare(b.nom))
  const basculer = (s: Sort) => {
    if (s.niveau === 0) setMineurs(mineurs.includes(s.id) ? mineurs.filter((x) => x !== s.id) : mineurs.length < maxMineurs ? [...mineurs, s.id] : mineurs)
    else setPrepares(prepares.includes(s.id) ? prepares.filter((x) => x !== s.id) : prepares.length < maxPrepares ? [...prepares, s.id] : prepares)
  }
  return (
    <Feuille titre="Préparer les sorts" onFermer={onFermer}>
      <p className="aide">
        Sorts mineurs {mineurs.length}/{maxMineurs} · préparés {prepares.length}/{maxPrepares} · jusqu'au niveau {niveauMax} (p. {inc.page})
      </p>
      <input className="champ" placeholder="Rechercher" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      <ul className="liste-choix">
        {liste.map((s) => {
          const choisi = (s.niveau === 0 ? mineurs : prepares).includes(s.id)
          return (
            <li key={s.id} className={choisi ? 'choisi' : ''}>
              <button className="choix-principal" aria-pressed={choisi} onClick={() => basculer(s)}>
                <strong>{s.nom}</strong>
                <small>
                  {ligneSort(s)} · {s.resume}
                </small>
              </button>
            </li>
          )
        })}
        {liste.length === 0 && <li className="aide">Aucun sort de cette liste dans le pack pour l'instant.</li>}
      </ul>
      <button
        className="bouton principal large"
        onClick={() => {
          dispatch({ type: 'sorts', mineurs, prepares })
          onFermer()
        }}
      >
        Enregistrer
      </button>
    </Feuille>
  )
}

export function Sorts({ p, dispatch }: { p: Personnage; dispatch: Dispatch<Action> }) {
  const [ouvert, setOuvert] = useState<Sort | null>(null)
  const [preparer, setPreparer] = useState(false)
  const inc = incantationDe(p)
  const sorts = sortsDisponibles(p)
  const accordes = new Set([...sortsAccordes(p), ...sortsChoisis(p)])
  const parNiveau = new Map<number, Sort[]>()
  for (const s of sorts) parNiveau.set(s.niveau, [...(parNiveau.get(s.niveau) ?? []), s])

  return (
    <main className="ecran">
      <header className="tete">
        <div>
          <h1>Sorts</h1>
          {inc && (
            <p className="sous-titre">
              DD {ddSorts(p)} · attaque {formatMod(attaqueSorts(p))} · {regles.caracteristiques.liste.find((c) => c.id === inc.carac)?.nom}
            </p>
          )}
        </div>
        {inc && (
          <button className="bouton discret" onClick={() => setPreparer(true)}>
            Préparer
          </button>
        )}
      </header>

      {emplacements(p).length > 0 && (
        <section className="case">
          <header className="case-tete">
            <h2>Emplacements</h2>
          </header>
          <ul className="liste">
            {emplacements(p).map((e) => {
              const reste = ressourceRestante(p, e.id)
              return (
                <li key={e.id} className="emplacement">
                  <span>{e.id === 'pacte' ? `Pacte · niveau ${e.niveau}` : `Niveau ${e.niveau}`}</span>
                  <span className="pastilles">
                    {Array.from({ length: e.max }, (_, i) => (
                      <button
                        key={i}
                        className={`pastille ${i < reste ? 'dispo-fond' : ''}`}
                        aria-label={i < reste ? `Dépenser un emplacement de niveau ${e.niveau}` : `Récupérer un emplacement de niveau ${e.niveau}`}
                        onClick={() => dispatch({ type: 'ressource', id: e.id, delta: i < reste ? -1 : 1 })}
                      />
                    ))}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {sorts.length === 0 && <p className="aide centre">{inc ? 'Aucun sort préparé. Touche « Préparer ».' : "Ce personnage ne lance pas de sorts pour l'instant."}</p>}

      {[...parNiveau.entries()].map(([niveau, liste]) => (
        <section className="case" key={niveau}>
          <header className="case-tete">
            <h2>{niveau === 0 ? 'Sorts mineurs' : `Niveau ${niveau}`}</h2>
          </header>
          <ul className="liste regles">
            {liste.map((s) => (
              <li key={s.id}>
                <button className="ligne-regle" onClick={() => setOuvert(s)}>
                  <span>
                    <strong>
                      {s.nom}
                      {accordes.has(s.id) && <small className="dispo"> toujours préparé</small>}
                    </strong>
                    <small>
                      {NOMS_TEMPS[tempsSort(s)]} · {s.portee}
                      {s.concentration ? ' · C' : ''} · {s.resume}
                    </small>
                  </span>
                  <span className="page">p. {s.page}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {ouvert && <FeuilleSort p={p} sort={ouvert} dispatch={dispatch} onFermer={() => setOuvert(null)} />}
      {preparer && <FeuillePreparer p={p} dispatch={dispatch} onFermer={() => setPreparer(false)} />}
    </main>
  )
}
