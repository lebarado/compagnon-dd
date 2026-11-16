import type { IdCarac } from '../regles/regles'
import { pvMax, credoMax } from '../regles/calculs'

/** État du personnage, sauvegardé localement. Aucune règle ici : seulement des choix et des compteurs. */
export interface Personnage {
  version: 1
  nom: string
  classe: string
  sousClasse: string | null
  espece: string
  historique: string
  niveau: number
  /** Valeurs finales saisies par le joueur (bonus d'historique inclus). */
  caracs: Record<IdCarac, number>
  /** Compétences choisies dans la liste de la classe. */
  competencesClasse: string[]
  /** Dons acquis en plus de celui de l'historique. */
  dons: string[]
  /** Écart avec le calcul à valeur fixe (dés de vie lancés, effets durables). */
  ajustementPvMax: number
  pv: number
  pvTemp: number
  /** Ressources dépensées, par identifiant (ex. « credo »). */
  depenses: Record<string, number>
  desDeVieDepenses: number
  armure: boolean
  bouclier: boolean
  equipementDepart: { classe: string; historique: string }
  etats: string[]
}

export function personnageVierge(): Personnage {
  const p: Personnage = {
    version: 1,
    nom: '',
    classe: 'moine',
    sousClasse: null,
    espece: 'nain',
    historique: 'fermier',
    niveau: 1,
    caracs: { for: 10, dex: 10, con: 10, int: 10, sag: 10, cha: 10 },
    competencesClasse: [],
    dons: [],
    ajustementPvMax: 0,
    pv: 0,
    pvTemp: 0,
    depenses: {},
    desDeVieDepenses: 0,
    armure: false,
    bouclier: false,
    equipementDepart: { classe: 'A', historique: 'A' },
    etats: [],
  }
  return { ...p, pv: pvMax(p) }
}

export type Action =
  | { type: 'creer'; personnage: Personnage }
  | { type: 'modifier'; personnage: Personnage }
  | { type: 'degats'; montant: number }
  | { type: 'soins'; montant: number }
  | { type: 'pvTemp'; montant: number }
  | { type: 'credo'; delta: number }

const borner = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

/** Les pv temporaires absorbent les dégâts avant les pv réels (manuel p. 29). */
export function appliquerDegats(p: Personnage, montant: number): Personnage {
  const d = Math.max(0, Math.floor(montant))
  const absorbe = Math.min(p.pvTemp, d)
  return { ...p, pvTemp: p.pvTemp - absorbe, pv: Math.max(0, p.pv - (d - absorbe)) }
}

/** Les soins ne dépassent jamais le maximum et ne touchent pas aux pv temporaires (p. 29, 372). */
export function appliquerSoins(p: Personnage, montant: number): Personnage {
  return { ...p, pv: borner(p.pv + Math.max(0, Math.floor(montant)), 0, pvMax(p)) }
}

/** Remet les compteurs dans leurs bornes après un changement de niveau ou de caractéristiques. */
export function recadrer(p: Personnage): Personnage {
  const credo = borner(p.depenses.credo ?? 0, 0, credoMax(p))
  return {
    ...p,
    pv: borner(p.pv, 0, pvMax(p)),
    pvTemp: Math.max(0, p.pvTemp),
    depenses: { ...p.depenses, credo },
    desDeVieDepenses: borner(p.desDeVieDepenses, 0, p.niveau),
  }
}

export function reducteur(p: Personnage | null, a: Action): Personnage | null {
  if (a.type === 'creer') return { ...a.personnage, pv: pvMax(a.personnage), pvTemp: 0, depenses: {} }
  if (!p) return p
  switch (a.type) {
    case 'modifier': {
      // Si le maximum change, les pv actuels suivent le même écart (p. 42 : le max monte, les pv aussi).
      const ecart = pvMax(a.personnage) - pvMax(p)
      return recadrer({ ...a.personnage, pv: p.pv + ecart })
    }
    case 'degats':
      return appliquerDegats(p, a.montant)
    case 'soins':
      return appliquerSoins(p, a.montant)
    case 'pvTemp':
      return { ...p, pvTemp: Math.max(0, Math.floor(a.montant)) }
    case 'credo':
      return recadrer({ ...p, depenses: { ...p.depenses, credo: (p.depenses.credo ?? 0) - a.delta } })
  }
}
