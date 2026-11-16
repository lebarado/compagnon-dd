import { useState, type Dispatch } from 'react'
import { CARACS, regles } from '../regles/pack'
import {
  aptitudesAcquises,
  bonusMaitrise,
  choixEnAttente,
  classeArmure,
  classeDe,
  competence,
  competencesMaitrisees,
  expertises,
  formatMod,
  initiative,
  maitriseSauvegarde,
  mod,
  perceptionPassive,
  pvMax,
  ressourcePrincipale,
  ressourceRestante,
  ressources,
  resistances,
  sauvegarde,
  sources,
  sousClasseDe,
  traitsEtAptitudes,
  valeurCarac,
  visionNoir,
  vitesse,
} from '../regles/calculs'
import { abrevCarac, metres, nomCarac } from '../regles/noms'
import type { Action, Personnage } from '../etat/personnage'
import { NIVEAU_MAX } from '../etat/personnage'
import { ChoixDe, Feuille, FeuilleRegle, LigneRegle, Pave, type Affichable } from '../composants/Feuille'
import { EditeurChoix, FeuilleChoix } from './EditeurChoix'

interface Props {
  p: Personnage
  dispatch: Dispatch<Action>
  onPersonnages: () => void
}

function Compteur({ nom, reste, max, onMoins, onPlus, page, onInfo }: { nom: string; reste: number; max: number; onMoins: () => void; onPlus: () => void; page?: number; onInfo?: () => void }) {
  return (
    <li className="compteur">
      <button className="compteur-nom" onClick={onInfo} disabled={!onInfo}>
        <strong>{nom}</strong>
        {page && <span className="page">p. {page}</span>}
      </button>
      <div className="pas">
        <button className="bouton rond" aria-label={`Dépenser : ${nom}`} disabled={reste === 0} onClick={onMoins}>
          −
        </button>
        <output className={reste === 0 ? 'epuise' : 'dispo'}>
          {reste}/{max}
        </output>
        <button className="bouton rond" aria-label={`Récupérer : ${nom}`} disabled={reste >= max} onClick={onPlus}>
          +
        </button>
      </div>
    </li>
  )
}

/** Repos court (dés de vie) et repos long (p. 373). */
function FeuilleRepos({ p, dispatch, onFermer }: { p: Personnage; dispatch: Dispatch<Action>; onFermer: () => void }) {
  const [des, setDes] = useState<number[]>([])
  const [jet, setJet] = useState(false)
  const de = classeDe(p).deDeVie
  const restants = p.niveau - p.desDeVieDepenses - des.length
  const con = mod(p, 'con')
  const soins = des.reduce((s, v) => s + Math.max(1, v + con), 0)
  const court = regles.repos.court
  const long = regles.repos.long
  return (
    <Feuille titre="Repos" onFermer={onFermer}>
      <section className="bloc-repos">
        <h3>
          {court.nom} <span className="page">p. {court.page}</span>
        </h3>
        <p className="aide">
          Dés de vie : {restants} d{de} restant{restants > 1 ? 's' : ''}. Chaque dé rend son résultat {formatMod(con)} (minimum 1).
        </p>
        {des.length > 0 && (
          <p>
            {des.map((v) => Math.max(1, v + con)).join(' + ')} = <strong>{soins} PV</strong>
          </p>
        )}
        <div className="ligne-boutons">
          <button className="bouton" disabled={restants === 0} onClick={() => setJet(true)}>
            Dépenser un d{de}
          </button>
          <button
            className="bouton principal"
            onClick={() => {
              dispatch({ type: 'reposCourt', desDeVie: des })
              onFermer()
            }}
          >
            Terminer le repos court
          </button>
        </div>
      </section>
      <section className="bloc-repos">
        <h3>
          {long.nom} <span className="page">p. {long.page}</span>
        </h3>
        <p className="aide">{long.resume}</p>
        <button
          className="bouton principal large"
          onClick={() => {
            dispatch({ type: 'reposLong' })
            onFermer()
          }}
        >
          Terminer le repos long
        </button>
      </section>
      {jet && <ChoixDe titre={`Dé de vie`} nombre={1} faces={de} onResultat={(v) => setDes([...des, v])} onFermer={() => setJet(false)} />}
    </Feuille>
  )
}

/** Passage au niveau suivant (p. 42) : aptitudes gagnées, sous-classe, points de vie. */
function FeuilleNiveau({ p, dispatch, onFermer }: { p: Personnage; dispatch: Dispatch<Action>; onFermer: () => void }) {
  const classe = classeDe(p)
  const suivant = p.niveau + 1
  const [sousClasse, setSousClasse] = useState<string | null>(p.sousClasse)
  const [jet, setJet] = useState(false)
  const [detail, setDetail] = useState<Affichable | null>(null)
  const futur: Personnage = { ...p, niveau: suivant, sousClasse }
  const nouvelles = aptitudesAcquises(futur).filter((a) => a.niveau === suivant)
  const besoinSousClasse = suivant >= classe.niveauSousClasse && !sousClasse
  const fixe = classe.deDeVie / 2 + 1
  const valider = (pv: number | 'fixe') => {
    dispatch({ type: 'niveau', pv, sousClasse })
    onFermer()
  }
  return (
    <Feuille titre={`Niveau ${suivant}`} onFermer={onFermer}>
      {suivant >= classe.niveauSousClasse && !p.sousClasse && (
        <fieldset className="bloc">
          <legend>Sous-classe</legend>
          <ul className="liste-choix">
            {Object.entries(classe.sousClasses).map(([id, sc]) => (
              <li key={id} className={sousClasse === id ? 'choisi' : ''}>
                <button className="choix-principal" aria-pressed={sousClasse === id} onClick={() => setSousClasse(id)}>
                  <strong>{sc.nom}</strong>
                  <small>{sc.resume}</small>
                </button>
                <button className="lien-page" onClick={() => setDetail({ nom: sc.nom, page: sc.page, resume: sc.resume ?? '', detail: sc.aptitudes.map((a) => `Niveau ${a.niveau} · ${a.nom} : ${a.resume}`) })}>
                  p. {sc.page}
                </button>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
      <ul className="liste regles">
        {nouvelles.map((a) => (
          <LigneRegle key={a.cle} titre={a.nom} sous={a.resume} page={a.page} onClick={() => setDetail(a)} />
        ))}
        <li>
          <span className="aide">Bonus de maîtrise {formatMod(bonusMaitrise(suivant))}. Les choix éventuels se font ensuite sur la fiche.</span>
        </li>
      </ul>
      <p className="aide">
        Points de vie : valeur fixe {fixe} {formatMod(mod(p, 'con'))}, ou ton d{classe.deDeVie} {formatMod(mod(p, 'con'))} (p. 42).
      </p>
      <div className="ligne-boutons">
        <button className="bouton" disabled={besoinSousClasse} onClick={() => setJet(true)}>
          J'ai lancé le dé
        </button>
        <button className="bouton principal" disabled={besoinSousClasse} onClick={() => valider('fixe')}>
          Valeur fixe
        </button>
      </div>
      {jet && <ChoixDe titre="Dé de vie" nombre={1} faces={classe.deDeVie} onResultat={valider} onFermer={() => setJet(false)} />}
      {detail && <FeuilleRegle regle={detail} onFermer={() => setDetail(null)} />}
    </Feuille>
  )
}

/** Édition de la fiche : nom, valeurs de base, ajustement de PV. */
function FeuilleFiche({ p, dispatch, onFermer }: { p: Personnage; dispatch: Dispatch<Action>; onFermer: () => void }) {
  const [q, setQ] = useState(p)
  return (
    <Feuille titre="Modifier la fiche" onFermer={onFermer}>
      <label className="bloc">
        <span className="etiquette">Nom</span>
        <input className="champ" value={q.nom} onChange={(e) => setQ({ ...q, nom: e.target.value })} />
      </label>
      <fieldset className="bloc">
        <legend>Valeurs de base (avant bonus)</legend>
        {CARACS.map((c) => (
          <div className="ligne-carac" key={c}>
            <span className="nom">{nomCarac(c)}</span>
            <span className="mod">{valeurCarac(q, c)}</span>
            <div className="pas">
              <button className="bouton rond" aria-label={`Diminuer ${nomCarac(c)}`} onClick={() => setQ({ ...q, caracsBase: { ...q.caracsBase, [c]: Math.max(1, q.caracsBase[c] - 1) } })}>
                −
              </button>
              <output>{q.caracsBase[c]}</output>
              <button className="bouton rond" aria-label={`Augmenter ${nomCarac(c)}`} onClick={() => setQ({ ...q, caracsBase: { ...q.caracsBase, [c]: Math.min(30, q.caracsBase[c] + 1) } })}>
                +
              </button>
            </div>
          </div>
        ))}
        <div className="ligne-carac">
          <span className="nom">Ajustement PV max</span>
          <span className="mod">{pvMax(q)}</span>
          <div className="pas">
            <button className="bouton rond" aria-label="Diminuer l'ajustement" onClick={() => setQ({ ...q, ajustementPvMax: q.ajustementPvMax - 1 })}>
              −
            </button>
            <output>{q.ajustementPvMax}</output>
            <button className="bouton rond" aria-label="Augmenter l'ajustement" onClick={() => setQ({ ...q, ajustementPvMax: q.ajustementPvMax + 1 })}>
              +
            </button>
          </div>
        </div>
      </fieldset>
      <button
        className="bouton principal large"
        disabled={!q.nom.trim()}
        onClick={() => {
          dispatch({ type: 'modifier', personnage: { ...q, nom: q.nom.trim() } })
          onFermer()
        }}
      >
        Enregistrer
      </button>
    </Feuille>
  )
}

export function Perso({ p, dispatch, onPersonnages }: Props) {
  const [feuille, setFeuille] = useState<'pv' | 'repos' | 'niveau' | 'fiche' | 'choix' | null>(null)
  const [regle, setRegle] = useState<(Affichable & { cle?: string }) | null>(null)
  const [toutes, setToutes] = useState(false)

  const classe = classeDe(p)
  const sc = sousClasseDe(p)
  const max = pvMax(p)
  const res = ressources(p).filter((r) => r.valeurMax > 0)
  const principale = ressourcePrincipale(p)
  const maitrisees = competencesMaitrisees(p)
  const exp = expertises(p)
  const listeComp = regles.competences.liste.filter((c) => toutes || maitrisees.includes(c.id))
  const attente = choixEnAttente(p)
  const sourcesParId = new Map(sources(p).map((s) => [s.regle.id + '|' + s.regle.nom, s]))

  return (
    <main className="ecran">
      <header className="tete">
        <button className="titre-perso" onClick={onPersonnages}>
          <h1>{p.nom}</h1>
          <p className="sous-titre">
            {regles.especes[p.espece]?.nom} · {classe.nom} {p.niveau}
            {sc ? ` (${sc.nom})` : ''} · {regles.historiques[p.historique]?.nom}
          </p>
        </button>
        <div className="actions-tete">
          <button className="bouton discret" onClick={() => setFeuille('repos')}>
            Repos
          </button>
          {p.niveau < NIVEAU_MAX && (
            <button className="bouton discret" onClick={() => setFeuille('niveau')}>
              Niv. +
            </button>
          )}
        </div>
      </header>

      {attente.length > 0 && (
        <button className="alerte" onClick={() => setFeuille('choix')}>
          {attente.length} choix à faire <span className="page">{attente[0].choix.nom}</span>
        </button>
      )}

      <section className="pv" aria-label="Points de vie">
        <button className="bouton rond grand" aria-label="Perdre 1 point de vie" disabled={p.pv === 0 && p.pvTemp === 0} onClick={() => dispatch({ type: 'degats', montant: 1 })}>
          −
        </button>
        <button className="pv-valeur" aria-label={`${p.pv} points de vie sur ${max}. Saisir un montant`} onClick={() => setFeuille('pv')}>
          <span className={`pv-actuels ${p.pv === 0 ? 'epuise' : ''}`}>{p.pv}</span>
          <span className="pv-max">/ {max} PV</span>
          {p.pvTemp > 0 && <span className="pv-temp">+{p.pvTemp} temp.</span>}
        </button>
        <button className="bouton rond grand" aria-label="Gagner 1 point de vie" disabled={p.pv >= max} onClick={() => dispatch({ type: 'soins', montant: 1 })}>
          +
        </button>
      </section>

      {p.pv === 0 && (
        <section className="mort">
          <button className="lien-page" onClick={() => setRegle({ nom: '0 point de vie', ...regles.pointsDeVie.zeroPv })}>
            Inconscient · p. {regles.pointsDeVie.zeroPv.page}
          </button>
          {(['reussite', 'echec'] as const).map((t) => {
            const n = t === 'reussite' ? p.jsMort.reussites : p.jsMort.echecs
            return (
              <div className="ligne-mort" key={t}>
                <span>{t === 'reussite' ? 'Réussites' : 'Échecs'}</span>
                <span className="pastilles">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={`pastille ${i < n ? (t === 'reussite' ? 'dispo-fond' : 'alerte-fond') : ''}`} />
                  ))}
                </span>
                <button className="bouton" disabled={n >= 3} onClick={() => dispatch({ type: 'jsMort', resultat: t })}>
                  +1
                </button>
              </div>
            )
          })}
          <p className="aide">
            {p.jsMort.echecs >= 3 ? 'Trois échecs : mort.' : p.jsMort.reussites >= 3 ? 'Trois réussites : Stabilisé.' : '1d20 au début du tour : 10 ou plus = réussite. 1 = deux échecs, 20 = 1 PV (p. 29).'}
          </p>
        </section>
      )}

      <section className="tuiles">
        <div className="tuile">
          <span className="etiquette">CA</span>
          <span className="chiffre">{classeArmure(p)}</span>
        </div>
        {principale ? (
          <div className="tuile">
            <span className="etiquette">{principale.nom}</span>
            <span className={`chiffre ${ressourceRestante(p, principale.id) === 0 ? 'epuise' : 'dispo'}`}>
              {ressourceRestante(p, principale.id)}
              <small> / {principale.valeurMax}</small>
            </span>
            <div className="tuile-boutons">
              <button className="bouton rond" aria-label={`Dépenser : ${principale.nom}`} disabled={ressourceRestante(p, principale.id) === 0} onClick={() => dispatch({ type: 'ressource', id: principale.id, delta: -1 })}>
                −
              </button>
              <button className="bouton rond" aria-label={`Récupérer : ${principale.nom}`} disabled={ressourceRestante(p, principale.id) >= principale.valeurMax} onClick={() => dispatch({ type: 'ressource', id: principale.id, delta: 1 })}>
                +
              </button>
            </div>
          </div>
        ) : (
          <button className={`tuile ${p.inspiration ? 'tuile-active' : ''}`} onClick={() => dispatch({ type: 'inspiration' })} aria-pressed={p.inspiration}>
            <span className="etiquette">Inspiration</span>
            <span className={`chiffre ${p.inspiration ? 'dispo' : 'epuise'}`}>{p.inspiration ? '★' : '☆'}</span>
            <span className="note">p. 368</span>
          </button>
        )}
      </section>

      <section className="bandeau">
        <div>
          <span className="etiquette">Vitesse</span>
          <strong>{metres(vitesse(p))}</strong>
        </div>
        <div>
          <span className="etiquette">Maîtrise</span>
          <strong>{formatMod(bonusMaitrise(p.niveau))}</strong>
        </div>
        <div>
          <span className="etiquette">Initiative</span>
          <strong>{formatMod(initiative(p))}</strong>
        </div>
      </section>

      <section className="caracs" aria-label="Caractéristiques">
        {CARACS.map((id) => (
          <div key={id} title={nomCarac(id)}>
            <span className="etiquette">{abrevCarac(id)}</span>
            <strong>{formatMod(mod(p, id))}</strong>
            <span className="note">{valeurCarac(p, id)}</span>
          </div>
        ))}
      </section>

      <details className="depliant">
        <summary>Jets de sauvegarde</summary>
        <ul className="liste">
          {CARACS.map((id) => (
            <li key={id} className={maitriseSauvegarde(p, id) ? 'maitrise' : ''}>
              <span>{nomCarac(id)}</span>
              <strong>{formatMod(sauvegarde(p, id))}</strong>
            </li>
          ))}
        </ul>
      </details>

      <details className="depliant">
        <summary>Compétences</summary>
        <ul className="liste">
          {listeComp.map((c) => (
            <li key={c.id} className={maitrisees.includes(c.id) ? 'maitrise' : ''}>
              <span>
                {c.nom}
                {exp.includes(c.id) && <small className="dispo"> expertise</small>}
              </span>
              <strong>{formatMod(competence(p, c.id))}</strong>
            </li>
          ))}
          <li>
            <span>Perception passive</span>
            <strong>{perceptionPassive(p)}</strong>
          </li>
        </ul>
        <button className="bouton discret large" onClick={() => setToutes(!toutes)}>
          {toutes ? 'Seulement les maîtrisées' : 'Toutes les compétences'}
        </button>
      </details>

      {(res.length > 0 || p.niveau > 0) && (
        <details className="depliant">
          <summary>Ressources et dés de vie</summary>
          <ul className="liste">
            {res.map((r) => (
              <Compteur
                key={r.id}
                nom={r.nom}
                reste={ressourceRestante(p, r.id)}
                max={r.valeurMax}
                page={r.page}
                onMoins={() => dispatch({ type: 'ressource', id: r.id, delta: -1 })}
                onPlus={() => dispatch({ type: 'ressource', id: r.id, delta: 1 })}
              />
            ))}
            <li>
              <span>Dés de vie (d{classe.deDeVie})</span>
              <strong>
                {p.niveau - p.desDeVieDepenses}/{p.niveau}
              </strong>
            </li>
          </ul>
        </details>
      )}

      <details className="depliant">
        <summary>Traits et aptitudes</summary>
        <ul className="liste regles">
          {traitsEtAptitudes(p).map((r) => (
            <LigneRegle key={`${r.id}|${r.nom}`} titre={r.nom} sous={r.resume} page={r.page} onClick={() => setRegle({ ...r, cle: sourcesParId.get(r.id + '|' + r.nom)?.cle })} />
          ))}
        </ul>
      </details>

      <details className="depliant">
        <summary>Défenses et sens</summary>
        <ul className="liste">
          <li>
            <span>Résistances</span>
            <strong>{resistances(p).join(', ') || '—'}</strong>
          </li>
          <li>
            <span>Vision dans le noir</span>
            <strong>{visionNoir(p) ? metres(visionNoir(p)) : '—'}</strong>
          </li>
        </ul>
      </details>

      <button className="bouton discret large" onClick={() => setFeuille('fiche')}>
        Modifier la fiche
      </button>

      {feuille === 'pv' && (
        <Pave
          titre="Points de vie"
          onFermer={() => setFeuille(null)}
          actions={[
            { nom: 'Dégâts', onValider: (n) => dispatch({ type: 'degats', montant: n }) },
            { nom: 'Soins', classe: 'dispo', onValider: (n) => dispatch({ type: 'soins', montant: n }) },
            { nom: 'PV temp.', zeroAutorise: true, onValider: (n) => dispatch({ type: 'pvTemp', montant: n }) },
          ]}
        />
      )}
      {feuille === 'repos' && <FeuilleRepos p={p} dispatch={dispatch} onFermer={() => setFeuille(null)} />}
      {feuille === 'niveau' && <FeuilleNiveau p={p} dispatch={dispatch} onFermer={() => setFeuille(null)} />}
      {feuille === 'fiche' && <FeuilleFiche p={p} dispatch={dispatch} onFermer={() => setFeuille(null)} />}
      {feuille === 'choix' && <FeuilleChoix p={p} enAttente={attente} onChoix={(cle, valeurs) => dispatch({ type: 'choix', cle, valeurs })} onFermer={() => setFeuille(null)} />}
      {regle && (
        <FeuilleRegle regle={regle} onFermer={() => setRegle(null)}>
          {regle.cle &&
            (sources(p).find((s) => s.cle === regle.cle)?.regle.choix ?? []).map((c) => (
              <fieldset className="bloc" key={c.id}>
                <legend>{c.nom}</legend>
                <EditeurChoix p={p} choix={c} valeurs={p.choix[`${regle.cle}>${c.id}`] ?? []} onChange={(v) => dispatch({ type: 'choix', cle: `${regle.cle}>${c.id}`, valeurs: v })} />
              </fieldset>
            ))}
        </FeuilleRegle>
      )}
    </main>
  )
}
