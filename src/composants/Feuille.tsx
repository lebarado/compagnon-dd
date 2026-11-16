import { useEffect, useState, type ReactNode } from 'react'

export interface Affichable {
  nom: string
  page: number
  resume: string
  detail?: string[]
  /** Ligne d'information (dé, DD…) affichée sous le titre. */
  info?: string
}

/** Panneau qui monte du bas de l'écran. Se ferme en touchant le fond, le bouton ou Échap. */
export function Feuille({ titre, onFermer, children }: { titre: string; onFermer: () => void; children: ReactNode }) {
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => e.key === 'Escape' && onFermer()
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [onFermer])

  return (
    <div className="voile" onClick={onFermer}>
      <section className="feuille" role="dialog" aria-modal="true" aria-label={titre} onClick={(e) => e.stopPropagation()}>
        <header className="feuille-tete">
          <h2>{titre}</h2>
          <button className="bouton discret" onClick={onFermer}>
            Fermer
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}

/** Explication complète d'une règle, avec sa page du manuel. */
export function FeuilleRegle({ regle, onFermer, children }: { regle: Affichable; onFermer: () => void; children?: ReactNode }) {
  const lignes = regle.detail?.length ? regle.detail : [regle.resume]
  return (
    <Feuille titre={regle.nom} onFermer={onFermer}>
      {regle.info && <p className="info-regle">{regle.info}</p>}
      <ul className="detail">
        {lignes.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      <p className="page-manuel">Manuel des joueurs, p. {regle.page}</p>
      {children}
    </Feuille>
  )
}

/** Résultat d'un ou plusieurs dés lancés à la table : un bouton par total possible. */
export function ChoixDe({
  titre,
  nombre,
  faces,
  aide,
  onResultat,
  onFermer,
}: {
  titre: string
  nombre: number
  faces: number
  aide?: string
  onResultat: (n: number) => void
  onFermer: () => void
}) {
  const valeurs = Array.from({ length: nombre * faces - nombre + 1 }, (_, i) => nombre + i)
  return (
    <Feuille titre={titre} onFermer={onFermer}>
      <p className="aide">
        Résultat de {nombre}d{faces}
        {aide ? ` · ${aide}` : ''}
      </p>
      <div className={`faces ${valeurs.length > 12 ? 'serrees' : ''}`}>
        {valeurs.map((v) => (
          <button
            key={v}
            className="bouton"
            onClick={() => {
              onResultat(v)
              onFermer()
            }}
          >
            {v}
          </button>
        ))}
      </div>
    </Feuille>
  )
}

/** Pavé numérique, puis un bouton par action. */
export function Pave({
  titre,
  actions,
  onFermer,
  initial = '',
}: {
  titre: string
  actions: { nom: string; onValider: (n: number) => void; classe?: string; zeroAutorise?: boolean }[]
  onFermer: () => void
  initial?: string
}) {
  const [saisie, setSaisie] = useState(initial)
  const montant = Number(saisie || 0)
  return (
    <Feuille titre={titre} onFermer={onFermer}>
      <output className="pave-valeur" aria-label="Montant">
        {saisie || '0'}
      </output>
      <div className="pave">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((c) => (
          <button key={c} className="bouton" onClick={() => setSaisie((s) => (s + c).slice(0, 5))}>
            {c}
          </button>
        ))}
        <button className="bouton discret" onClick={() => setSaisie('')}>
          C
        </button>
        <button className="bouton" onClick={() => setSaisie((s) => (s === '' ? s : (s + '0').slice(0, 5)))}>
          0
        </button>
        <button className="bouton discret" aria-label="Effacer" onClick={() => setSaisie((s) => s.slice(0, -1))}>
          ⌫
        </button>
      </div>
      <div className="pave-actions" style={{ gridTemplateColumns: `repeat(${actions.length}, 1fr)` }}>
        {actions.map((a) => (
          <button
            key={a.nom}
            className={`bouton ${a.classe ?? ''}`}
            disabled={!a.zeroAutorise && montant === 0}
            onClick={() => {
              a.onValider(montant)
              onFermer()
            }}
          >
            {a.nom}
          </button>
        ))}
      </div>
    </Feuille>
  )
}

/** Ligne titre + page cliquable, utilisée dans toutes les listes de règles. */
export function LigneRegle({ titre, sous, page, onClick, droite }: { titre: ReactNode; sous?: ReactNode; page?: number; onClick: () => void; droite?: ReactNode }) {
  return (
    <li>
      <button className="ligne-regle" onClick={onClick}>
        <span>
          <strong>{titre}</strong>
          {sous && <small>{sous}</small>}
        </span>
        {droite ?? (page ? <span className="page">p. {page}</span> : null)}
      </button>
    </li>
  )
}
