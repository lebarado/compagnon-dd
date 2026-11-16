import { useState, type Dispatch } from 'react'
import { CARACS, regles, type Regle } from '../regles/regles'
import {
  bonusMaitrise,
  classeArmure,
  competence,
  competencesMaitrisees,
  credoMax,
  credoRestant,
  formatMod,
  initiative,
  maitriseSauvegarde,
  mod,
  perceptionPassive,
  pvMax,
  sauvegarde,
  traitsEtAptitudes,
  valeurCarac,
  vitesse,
} from '../regles/calculs'
import type { Action, Personnage } from '../etat/personnage'
import { Feuille, FeuilleRegle } from '../composants/Feuille'

interface Props {
  p: Personnage
  dispatch: Dispatch<Action>
  onModifier: () => void
}

const metres = (m: number) => `${String(m).replace('.', ',')} m`

/** Pavé pour un montant de dégâts, de soins ou de pv temporaires : chiffres puis un bouton. */
function PavePv({ onChoix, onFermer }: { onChoix: (a: Action) => void; onFermer: () => void }) {
  const [saisie, setSaisie] = useState('')
  const montant = Number(saisie || 0)
  const valider = (type: 'degats' | 'soins' | 'pvTemp') => {
    onChoix({ type, montant })
    onFermer()
  }
  return (
    <Feuille titre="Points de vie" onFermer={onFermer}>
      <output className="pave-valeur" aria-label="Montant">
        {saisie || '0'}
      </output>
      <div className="pave">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((c) => (
          <button key={c} className="bouton" onClick={() => setSaisie((s) => (s + c).slice(0, 3))}>
            {c}
          </button>
        ))}
        <button className="bouton discret" onClick={() => setSaisie('')}>
          C
        </button>
        <button className="bouton" onClick={() => setSaisie((s) => (s === '' ? s : (s + '0').slice(0, 3)))}>
          0
        </button>
        <button className="bouton discret" aria-label="Effacer" onClick={() => setSaisie((s) => s.slice(0, -1))}>
          ⌫
        </button>
      </div>
      <div className="pave-actions">
        <button className="bouton" disabled={montant === 0} onClick={() => valider('degats')}>
          Dégâts
        </button>
        <button className="bouton dispo" disabled={montant === 0} onClick={() => valider('soins')}>
          Soins
        </button>
        <button className="bouton" onClick={() => valider('pvTemp')}>
          PV temp.
        </button>
      </div>
    </Feuille>
  )
}

export function Perso({ p, dispatch, onModifier }: Props) {
  const [pave, setPave] = useState(false)
  const [regle, setRegle] = useState<Pick<Regle, 'nom' | 'page' | 'resume' | 'detail'> | null>(null)
  const [toutes, setToutes] = useState(false)

  const classe = regles.classes[p.classe]
  const max = pvMax(p)
  const cMax = credoMax(p)
  const cReste = credoRestant(p)
  const maitrisees = competencesMaitrisees(p)
  const competences = regles.competences.liste.filter((c) => toutes || maitrisees.includes(c.id))

  return (
    <main className="ecran">
      <header className="tete">
        <div>
          <h1>{p.nom}</h1>
          <p className="sous-titre">
            {regles.especes[p.espece].nom} · {classe.nom} {p.niveau} · {regles.historiques[p.historique].nom}
          </p>
        </div>
        <button className="bouton discret" onClick={onModifier}>
          Modifier
        </button>
      </header>

      <section className="pv" aria-label="Points de vie">
        <button className="bouton rond grand" aria-label="Perdre 1 point de vie" disabled={p.pv === 0 && p.pvTemp === 0} onClick={() => dispatch({ type: 'degats', montant: 1 })}>
          −
        </button>
        <button className="pv-valeur" aria-label={`${p.pv} points de vie sur ${max}. Saisir un montant`} onClick={() => setPave(true)}>
          <span className={`pv-actuels ${p.pv === 0 ? 'epuise' : ''}`}>{p.pv}</span>
          <span className="pv-max">/ {max} PV</span>
          {p.pvTemp > 0 && <span className="pv-temp">+{p.pvTemp} temp.</span>}
        </button>
        <button className="bouton rond grand" aria-label="Gagner 1 point de vie" disabled={p.pv >= max} onClick={() => dispatch({ type: 'soins', montant: 1 })}>
          +
        </button>
      </section>
      {p.pv === 0 && (
        <button className="alerte" onClick={() => setRegle({ nom: '0 point de vie', ...regles.pointsDeVie.zeroPv })}>
          Inconscient · jets contre la mort <span className="page">p. {regles.pointsDeVie.zeroPv.page}</span>
        </button>
      )}

      <section className="tuiles">
        <div className="tuile">
          <span className="etiquette">CA</span>
          <span className="chiffre">{classeArmure(p)}</span>
        </div>
        <div className="tuile">
          <span className="etiquette">Credo</span>
          {cMax === 0 ? (
            <>
              <span className="chiffre epuise">—</span>
              <span className="note">au niveau 2</span>
            </>
          ) : (
            <>
              <span className={`chiffre ${cReste === 0 ? 'epuise' : 'dispo'}`}>
                {cReste}
                <small> / {cMax}</small>
              </span>
              <div className="tuile-boutons">
                <button className="bouton rond" aria-label="Dépenser 1 point de Credo" disabled={cReste === 0} onClick={() => dispatch({ type: 'credo', delta: -1 })}>
                  −
                </button>
                <button className="bouton rond" aria-label="Récupérer 1 point de Credo" disabled={cReste === cMax} onClick={() => dispatch({ type: 'credo', delta: 1 })}>
                  +
                </button>
              </div>
            </>
          )}
        </div>
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
        {CARACS.map((id) => {
          const c = regles.caracteristiques.liste.find((x) => x.id === id)!
          return (
            <div key={id} title={c.nom}>
              <span className="etiquette">{c.abrev}</span>
              <strong>{formatMod(mod(p, id))}</strong>
              <span className="note">{valeurCarac(p, id)}</span>
            </div>
          )
        })}
      </section>

      <details className="depliant">
        <summary>Jets de sauvegarde</summary>
        <ul className="liste">
          {CARACS.map((id) => {
            const c = regles.caracteristiques.liste.find((x) => x.id === id)!
            const maitrise = maitriseSauvegarde(p, id)
            return (
              <li key={id} className={maitrise ? 'maitrise' : ''}>
                <span>{c.nom}</span>
                <strong>{formatMod(sauvegarde(p, id))}</strong>
              </li>
            )
          })}
        </ul>
      </details>

      <details className="depliant">
        <summary>Compétences</summary>
        <ul className="liste">
          {competences.map((c) => (
            <li key={c.id} className={maitrisees.includes(c.id) ? 'maitrise' : ''}>
              <span>{c.nom}</span>
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

      <details className="depliant">
        <summary>Traits et aptitudes</summary>
        <ul className="liste regles">
          {traitsEtAptitudes(p).map((r) => (
            <li key={r.id}>
              <button onClick={() => setRegle(r)}>
                <span>
                  <strong>{r.nom}</strong>
                  <small>{r.resume}</small>
                </span>
                <span className="page">p. {r.page}</span>
              </button>
            </li>
          ))}
        </ul>
      </details>

      {pave && <PavePv onChoix={dispatch} onFermer={() => setPave(false)} />}
      {regle && <FeuilleRegle regle={regle} onFermer={() => setRegle(null)} />}
    </main>
  )
}
