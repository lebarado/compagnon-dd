import { useState, type Dispatch } from 'react'
import { regles } from '../regles/pack'
import { pvMax } from '../regles/calculs'
import type { Action, Personnage } from '../etat/personnage'
import { FeuilleRegle, Pave } from './Feuille'
import { Icone } from './Icone'

/** PV : −1 / +1 en un appui, montant au pavé en touchant le chiffre ; jets contre la mort à 0 PV. */
export function PointsDeVie({ p, dispatch, compact = false }: { p: Personnage; dispatch: Dispatch<Action>; compact?: boolean }) {
  const [pave, setPave] = useState(false)
  const [regle, setRegle] = useState(false)
  /** DD du JS de Constitution à faire après des dégâts subis en Concentration. */
  const [ddConc, setDdConc] = useState<number | null>(null)
  const degats = (n: number) => {
    // JS Con DD 10 ou moitié des dégâts, 30 au plus (p. 364).
    if (p.concentration && n > 0 && p.pv > 0) setDdConc(Math.min(30, Math.max(10, Math.floor(n / 2))))
    dispatch({ type: 'degats', montant: n })
  }
  const max = pvMax(p)
  const part = max > 0 ? Math.min(100, (100 * p.pv) / max) : 0
  const niveau = p.pv === 0 ? 'zero' : part <= 25 ? 'critique' : part <= 50 ? 'blesse' : 'ok'

  return (
    <>
      <section className={`pv ${compact ? 'compact' : ''}`} aria-label="Points de vie">
        <button className="bouton rond grand degats" aria-label="Perdre 1 point de vie" disabled={p.pv === 0 && p.pvTemp === 0} onClick={() => degats(1)}>
          −
        </button>
        <button className="pv-valeur" aria-label={`${p.pv} points de vie sur ${max}. Saisir des dégâts ou des soins`} onClick={() => setPave(true)}>
          <span className="pv-ligne">
            <Icone nom={p.pv === 0 ? 'mort' : 'pv'} taille={compact ? 22 : 28} className={`pv-icone ${niveau}`} />
            <span className={`pv-actuels ${p.pv === 0 ? 'epuise' : ''}`}>{p.pv}</span>
            <span className="pv-max">/ {max}</span>
          </span>
          <span className="pv-jauge" aria-hidden="true">
            <span className={niveau} style={{ width: `${part}%` }} />
          </span>
          <span className="pv-sous">{p.pvTemp > 0 ? <span className="pv-temp">+{p.pvTemp} PV temp.</span> : 'Toucher pour saisir'}</span>
        </button>
        <button className="bouton rond grand soins" aria-label="Gagner 1 point de vie" disabled={p.pv >= max} onClick={() => dispatch({ type: 'soins', montant: 1 })}>
          +
        </button>
      </section>

      {p.concentration && (
        <section className={`concentration ${ddConc ? 'jet' : ''}`} aria-live="polite">
          <span className="concentration-texte">
            <Icone nom="sort" taille={20} className="accent" />
            <span>
              <strong>Concentration</strong> · {p.concentration.nom}
              {ddConc && <small>JS Constitution DD {ddConc}</small>}
            </span>
          </span>
          {ddConc ? (
            <span className="concentration-boutons">
              <button className="bouton petit dispo" onClick={() => setDdConc(null)}>
                Réussi
              </button>
              <button className="bouton petit alerte-bord" onClick={() => (setDdConc(null), dispatch({ type: 'concentration', valeur: null }))}>
                Raté
              </button>
            </span>
          ) : (
            <button className="bouton discret petit" aria-label={`Arrêter la Concentration : ${p.concentration.nom}`} onClick={() => dispatch({ type: 'concentration', valeur: null })}>
              Arrêter
            </button>
          )}
        </section>
      )}

      {p.pv === 0 && (
        <section className="mort">
          <button className="lien-page" onClick={() => setRegle(true)}>
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

      {pave && (
        <Pave
          titre="Points de vie"
          onFermer={() => setPave(false)}
          actions={[
            { nom: 'Dégâts', classe: 'alerte-bord degats', onValider: degats },
            { nom: 'Soins', classe: 'dispo', onValider: (n) => dispatch({ type: 'soins', montant: n }) },
            { nom: 'PV temp.', zeroAutorise: true, onValider: (n) => dispatch({ type: 'pvTemp', montant: n }) },
          ]}
        />
      )}
      {regle && <FeuilleRegle regle={{ nom: '0 point de vie', ...regles.pointsDeVie.zeroPv }} onFermer={() => setRegle(false)} />}
    </>
  )
}
