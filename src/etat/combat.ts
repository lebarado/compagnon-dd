import { regles } from '../regles/pack'
import type { Effet } from '../regles/types'

/** État de mon tour de combat. L'app ne suit que mon personnage, pas l'ordre d'initiative. */
export type Phase = 'hors' | 'attente' | 'tour'
export type Case = 'action' | 'bonus' | 'reaction'
export type Place = Case | 'touche' | 'libre'

/** Ce que l'on demande en utilisant une option. */
export interface Demande {
  id: string
  nom: string
  /** Ressources dépensées, par identifiant (credo, rage, sort-3…). */
  couts?: Record<string, number>
  /** Ressources restaurées : tout, ou jusqu'à un minimum restant (Métabolisme surnaturel, Credo parachevé). */
  restaure?: Record<string, 'tout' | number>
  effets?: string[]
  soins?: number
  pvTemp?: number
  /** Sort à Concentration lancé : remplace la Concentration en cours (p. 364). */
  concentration?: string
}

/** Trace d'une utilisation, assez précise pour l'annuler. */
export interface Utilisation {
  id: string
  nom: string
  /** Variation des dépenses, par ressource : on la retranche pour annuler. */
  delta: Record<string, number>
  effets?: string[]
  soins?: number
  pvTempAvant?: number
  /** Concentration remplacée par cette utilisation, pour l'annuler. */
  concentrationAvant?: { id: string; nom: string } | null
  sousChoix?: { id: string; nom: string; delta: Record<string, number> }
}

export interface EtatCombat {
  phase: Phase
  cases: Partial<Record<Case, Utilisation>>
  /** Options « sur une touche » utilisées ce tour (Frappe étourdissante…). */
  touches: Utilisation[]
  /** Effets actifs, avec répétitions (deux Pointes = deux entrées). */
  effets: string[]
  /** Numéro du round, compté à chaque début de mon tour. */
  round: number
}

export const combatVierge = (): EtatCombat => ({ phase: 'hors', cases: {}, touches: [], effets: [], round: 0 })

function expiration(id: string): Effet['jusqua'] | undefined {
  return regles?.combat.effets[id]?.jusqua
}

export function retirerEffets(effets: string[], quand: Effet['jusqua']): string[] {
  return effets.filter((e) => expiration(e) !== quand)
}

/** Retire une occurrence de chaque élément demandé. */
export function retirerUn(liste: string[], elements: string[]): string[] {
  const copie = [...liste]
  for (const e of elements) {
    const i = copie.indexOf(e)
    if (i >= 0) copie.splice(i, 1)
  }
  return copie
}

/**
 * Passage d'une phase à l'autre.
 * - Mon tour commence : action, action Bonus et Réaction reviennent (p. 373) ; les effets « jusqu'au début de votre tour » prennent fin.
 * - Fin de mon tour : les effets « jusqu'à la fin du tour » prennent fin ; la Réaction reste dépensée jusqu'au début de mon tour suivant.
 * - Fin du combat : tout est remis à zéro.
 */
export function changerPhase(c: EtatCombat, phase: Phase): EtatCombat {
  if (phase === 'hors') return combatVierge()
  if (phase === 'tour') return { phase, cases: {}, touches: [], effets: retirerEffets(c.effets, 'debut-de-tour'), round: (c.round ?? 0) + 1 }
  if (c.phase === 'tour') return { ...c, phase, touches: [], effets: retirerEffets(c.effets, 'fin-de-tour') }
  return { ...combatVierge(), phase, round: c.round ?? 0 }
}
