import { useEffect, type ReactNode } from 'react'
import type { Regle } from '../regles/regles'

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
export function FeuilleRegle({ regle, onFermer }: { regle: Pick<Regle, 'nom' | 'page' | 'resume' | 'detail'>; onFermer: () => void }) {
  const lignes = regle.detail?.length ? regle.detail : [regle.resume]
  return (
    <Feuille titre={regle.nom} onFermer={onFermer}>
      <ul className="detail">
        {lignes.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p className="page-manuel">Manuel des joueurs, p. {regle.page}</p>
    </Feuille>
  )
}
