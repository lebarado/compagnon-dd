import { useEffect, useMemo, useRef, useState, type Dispatch } from 'react'
import type { Action, Personnage } from './personnage'
import { carteDe, derniereSession, Session, type EtatSession } from './session'

export interface ControleSession {
  etat: EtatSession
  creer: () => void
  rejoindre: (code: string) => void
  reprendre: (code: string, hote: boolean) => void
  quitter: () => void
}

/** Garde la session ouverte d'un écran à l'autre et envoie ma carte à chaque changement visible. */
export function useSession(p: Personnage | null, dispatch: Dispatch<Action>): ControleSession {
  const [etat, setEtat] = useState<EtatSession>({ statut: 'hors', membres: 0 })
  const dispatchRef = useRef(dispatch)
  dispatchRef.current = dispatch
  const session = useMemo(() => new Session(setEtat, (cartes) => dispatchRef.current({ type: 'cartes', cartes })), [])
  const carte = p ? carteDe(p) : null
  const cle = JSON.stringify(carte)

  useEffect(() => {
    if (carte) session.majCarte(carte)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, session])

  // Au lancement (ou au retour de veille avec rechargement), on reprend la dernière session non quittée.
  const repris = useRef(false)
  useEffect(() => {
    if (repris.current || !carte) return
    repris.current = true
    const d = derniereSession()
    if (d) (d.hote ? session.creer(carte, d.code) : session.rejoindre(d.code, carte, 1))
    // En mode strict (développement), React démonte puis remonte : on autorise une nouvelle reprise.
    return () => {
      repris.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!carte, session])

  useEffect(() => () => session.quitter(false), [session])

  return {
    etat,
    creer: () => carte && session.creer(carte),
    rejoindre: (code) => carte && session.rejoindre(code, carte),
    reprendre: (code, hote) => carte && (hote ? session.creer(carte, code) : session.rejoindre(code, carte)),
    quitter: () => session.quitter(),
  }
}
