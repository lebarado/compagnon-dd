import type { IdCarac } from '../regles/types'
import { regles } from '../regles/pack'
import { mod, pvMax, ressourceMax, ressources, emplacements } from '../regles/calculs'
import { changerPhase, combatVierge, nouveauTour, retirerUn, type Case, type Demande, type Ennemi, type EtatCombat, type Phase, type Place, type Utilisation } from './combat'

/** État d'un personnage, sauvegardé localement. Aucune règle ici : des choix et des compteurs. */
export interface ObjetInventaire {
  uid: string
  /** Identifiant d'arme, d'armure ou d'objet du pack ; absent pour un objet libre. */
  ref?: string
  nom: string
  quantite: number
  equipe?: boolean
  poids?: number
  note?: string
}

export interface Note {
  id: string
  categorie: 'session' | 'pnj' | 'lieu' | 'quete' | 'autre'
  titre: string
  texte: string
  date: string
}

export type Pieces = Record<'pc' | 'pa' | 'pe' | 'po' | 'pp', number>

export interface Personnage {
  version: 2
  id: string
  nom: string
  espece: string
  historique: string
  classe: string
  sousClasse: string | null
  niveau: number
  /** Valeurs tirées ou achetées, avant tout bonus. */
  caracsBase: Record<IdCarac, number>
  /** Bonus d'historique : +2/+1 ou +1/+1/+1 (p. 38). */
  bonusHistorique: Partial<Record<IdCarac, number>>
  competencesClasse: string[]
  /** Réponses aux choix, par clé « source>choix ». */
  choix: Record<string, string[]>
  sorts: { prepares: string[]; mineurs: string[] }
  /** Écart avec le calcul à valeur fixe (dés de vie lancés). */
  ajustementPvMax: number
  pv: number
  pvTemp: number
  /** Ressources dépensées par identifiant : credo, rage, sort-1… sort-9, pacte. */
  depenses: Record<string, number>
  desDeVieDepenses: number
  inventaire: ObjetInventaire[]
  pieces: Pieces
  etats: string[]
  epuisement: number
  inspiration: boolean
  jsMort: { reussites: number; echecs: number }
  combat: EtatCombat
  notes: Note[]
  /** Langues choisies à la création, en plus du Commun (p. 37). */
  langues: string[]
  /** Effet à Concentration en cours (p. 364). */
  concentration: { id: string; nom: string } | null
  /** Coéquipiers connus : saisis à la main ou reçus d'une session. */
  equipe: Coequipier[]
}

/** Ce qu'un joueur montre aux autres : ce qui se voit à la table, rien de sa fiche. */
export interface CartePublique {
  id: string
  nom: string
  espece: string
  classe: string
  niveau: number
  /** Ce qui se voit : indemne, blessé, gravement blessé (moitié des PV ou moins), 0 PV. Jamais le chiffre. */
  sante: 'indemne' | 'blesse' | 'grave' | 'zero'
  etats: string[]
  concentration: string | null
}

export interface Coequipier {
  id: string
  nom: string
  /** Texte libre (« Elfe Rôdeuse »…) pour un coéquipier saisi à la main. */
  description: string
  notes: string
  /** Dernière carte reçue en session, si ce coéquipier utilise l'app. */
  carte?: CartePublique
  vu?: string
}

export const NIVEAU_MAX = 20

export const nouvelId =() => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export function personnageVierge(): Personnage {
  return {
    version: 2,
    id: nouvelId(),
    nom: '',
    espece: '',
    historique: '',
    classe: '',
    sousClasse: null,
    niveau: 1,
    caracsBase: { for: 10, dex: 10, con: 10, int: 10, sag: 10, cha: 10 },
    bonusHistorique: {},
    competencesClasse: [],
    choix: {},
    sorts: { prepares: [], mineurs: [] },
    ajustementPvMax: 0,
    pv: 1,
    pvTemp: 0,
    depenses: {},
    desDeVieDepenses: 0,
    inventaire: [],
    pieces: { pc: 0, pa: 0, pe: 0, po: 0, pp: 0 },
    etats: [],
    epuisement: 0,
    inspiration: false,
    jsMort: { reussites: 0, echecs: 0 },
    combat: combatVierge(),
    notes: [],
    langues: [],
    concentration: null,
    equipe: [],
  }
}

export type Action =
  | { type: 'creer'; personnage: Personnage }
  | { type: 'modifier'; personnage: Personnage }
  | { type: 'degats'; montant: number }
  | { type: 'soins'; montant: number }
  | { type: 'pvTemp'; montant: number }
  | { type: 'ressource'; id: string; delta: number }
  | { type: 'utiliser'; place: Place; demande: Demande }
  | { type: 'annuler'; place: Case | 'touche'; id?: string }
  | { type: 'sousChoix'; place: Case; demande: Demande }
  | { type: 'phase'; phase: Phase }
  | { type: 'nouveauTour' }
  | { type: 'finCombat' }
  | { type: 'ennemi'; ennemi: Ennemi }
  | { type: 'retirerEnnemi'; id: string }
  | { type: 'etat'; id: string }
  | { type: 'epuisement'; delta: number }
  | { type: 'jsMort'; resultat: 'reussite' | 'echec' | 'raz' }
  | { type: 'inspiration' }
  | { type: 'reposCourt'; desDeVie: number[] }
  | { type: 'reposLong' }
  | { type: 'niveau'; pv: number | 'fixe'; sousClasse?: string | null }
  | { type: 'choix'; cle: string; valeurs: string[] }
  | { type: 'sorts'; prepares?: string[]; mineurs?: string[] }
  | { type: 'objet'; objet: ObjetInventaire }
  | { type: 'retirerObjet'; uid: string }
  | { type: 'pieces'; pieces: Pieces }
  | { type: 'note'; note: Note }
  | { type: 'retirerNote'; id: string }
  | { type: 'langues'; langues: string[] }
  | { type: 'concentration'; valeur: { id: string; nom: string } | null }
  | { type: 'coequipier'; coequipier: Coequipier }
  | { type: 'retirerCoequipier'; id: string }
  | { type: 'cartes'; cartes: CartePublique[] }

const borner = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

/** Neutralisé, directement ou par un état qui l'inclut (Étourdi, Inconscient…). */
function neutralise(p: Personnage): boolean {
  const vus = new Set<string>()
  const pile = [...p.etats]
  while (pile.length) {
    const id = pile.pop()!
    if (vus.has(id)) continue
    vus.add(id)
    pile.push(...(regles.etats.find((e) => e.id === id)?.inclut ?? []))
  }
  return vus.has('neutralise')
}

/** Les pv temporaires absorbent les dégâts avant les pv réels (p. 29). À 0 pv, des dégâts valent un échec (p. 29). */
export function appliquerDegats(p: Personnage, montant: number): Personnage {
  const d = Math.max(0, Math.floor(montant))
  if (d === 0) return p
  if (p.pv === 0) return { ...p, jsMort: { ...p.jsMort, echecs: Math.min(3, p.jsMort.echecs + 1) } }
  const absorbe = Math.min(p.pvTemp, d)
  return { ...p, pvTemp: p.pvTemp - absorbe, pv: Math.max(0, p.pv - (d - absorbe)) }
}

/** Soins plafonnés au maximum (p. 372) ; regagner un pv remet les jets contre la mort à zéro (p. 29). */
export function appliquerSoins(p: Personnage, montant: number): Personnage {
  const s = Math.max(0, Math.floor(montant))
  if (s === 0) return p
  return { ...p, pv: borner(p.pv + s, 0, pvMax(p)), jsMort: { reussites: 0, echecs: 0 } }
}

/** Remet les compteurs dans leurs bornes après un changement de niveau, de caractéristiques ou de choix. */
export function recadrer(p: Personnage): Personnage {
  const depenses: Record<string, number> = {}
  for (const [id, n] of Object.entries(p.depenses)) depenses[id] = borner(n, 0, ressourceMax(p, id))
  return { ...p, pv: borner(p.pv, 0, pvMax(p)), pvTemp: Math.max(0, p.pvTemp), depenses, desDeVieDepenses: borner(p.desDeVieDepenses, 0, p.niveau) }
}

/** Applique coûts et restaurations ; renvoie null si une ressource manque. */
function depenser(p: Personnage, d: Demande): { depenses: Record<string, number>; delta: Record<string, number> } | null {
  const depenses = { ...p.depenses }
  for (const [id, n] of Object.entries(d.couts ?? {})) {
    if (ressourceMax(p, id) - (depenses[id] ?? 0) < n) return null
    depenses[id] = (depenses[id] ?? 0) + n
  }
  for (const [id, v] of Object.entries(d.restaure ?? {})) {
    const max = ressourceMax(p, id)
    depenses[id] = v === 'tout' ? 0 : Math.min(depenses[id] ?? 0, Math.max(0, max - v))
  }
  const delta: Record<string, number> = {}
  for (const id of new Set([...Object.keys(depenses), ...Object.keys(p.depenses)])) {
    const ecart = (depenses[id] ?? 0) - (p.depenses[id] ?? 0)
    if (ecart) delta[id] = ecart
  }
  return { depenses, delta }
}

function annulerDelta(depenses: Record<string, number>, delta: Record<string, number>): Record<string, number> {
  const d = { ...depenses }
  for (const [id, n] of Object.entries(delta)) d[id] = Math.max(0, (d[id] ?? 0) - n)
  return d
}

function utiliser(p: Personnage, place: Place, d: Demande): Personnage {
  const res = depenser(p, d)
  if (!res) return p
  let q: Personnage = { ...p, depenses: res.depenses }
  const u: Utilisation = { id: d.id, nom: d.nom, delta: res.delta, effets: d.effets }
  if (d.concentration) {
    u.concentrationAvant = q.concentration
    q = { ...q, concentration: { id: d.id, nom: d.concentration } }
  }
  if (d.soins) {
    const avant = q.pv
    q = appliquerSoins(q, d.soins)
    u.soins = q.pv - avant
  }
  if (d.pvTemp !== undefined) {
    u.pvTempAvant = q.pvTemp
    q = { ...q, pvTemp: Math.max(q.pvTemp, d.pvTemp) }
  }
  const combat: EtatCombat = { ...q.combat, effets: [...q.combat.effets, ...(d.effets ?? [])] }
  if (place === 'touche') combat.touches = [...combat.touches, u]
  else if (place !== 'libre') combat.cases = { ...combat.cases, [place]: u }
  return { ...q, combat }
}

function annuler(p: Personnage, place: Case | 'touche', id?: string): Personnage {
  const u = place === 'touche' ? p.combat.touches.find((t) => t.id === id) : p.combat.cases[place]
  if (!u) return p
  let depenses = annulerDelta(p.depenses, u.delta)
  if (u.sousChoix) depenses = annulerDelta(depenses, u.sousChoix.delta)
  const combat: EtatCombat = { ...p.combat, effets: retirerUn(p.combat.effets, u.effets ?? []) }
  if (place === 'touche') combat.touches = combat.touches.filter((t) => t !== u)
  else {
    const cases = { ...combat.cases }
    delete cases[place]
    combat.cases = cases
  }
  const concentration = u.concentrationAvant !== undefined ? u.concentrationAvant : p.concentration
  return recadrer({ ...p, depenses, combat, concentration, pv: Math.max(0, p.pv - (u.soins ?? 0)), pvTemp: u.pvTempAvant ?? p.pvTemp })
}

/** Recharge les ressources selon le type de repos (p. 373). */
function recharger(p: Personnage, repos: 'repos-court' | 'repos-long'): Record<string, number> {
  const depenses = { ...p.depenses }
  for (const res of ressources(p)) {
    const regle = res.recharge[repos] ?? (repos === 'repos-long' ? res.recharge['repos-court'] : undefined)
    if (regle === 'tout') depenses[res.id] = 0
    else if (typeof regle === 'number') depenses[res.id] = Math.max(0, (depenses[res.id] ?? 0) - regle)
  }
  for (const e of emplacements(p)) {
    // Emplacements de sorts : Repos long pour tous ; Magie de pacte aussi au Repos court.
    if (repos === 'repos-long' || e.id === 'pacte') depenses[e.id] = 0
  }
  return depenses
}

export function reducteur(p: Personnage | null, a: Action): Personnage | null {
  if (a.type === 'creer') {
    const q = { ...a.personnage, pvTemp: 0, depenses: {}, combat: combatVierge() }
    return { ...q, pv: pvMax(q) }
  }
  if (!p) return p
  switch (a.type) {
    case 'modifier': {
      // Si le maximum change, les pv actuels suivent le même écart (p. 42).
      const ecart = pvMax(a.personnage) - pvMax(p)
      return recadrer({ ...a.personnage, pv: p.pv + ecart })
    }
    case 'degats': {
      // À 0 PV on est Inconscient, donc Neutralisé : la Concentration prend fin (p. 364).
      const q = appliquerDegats(p, a.montant)
      return q.pv === 0 ? { ...q, concentration: null } : q
    }
    case 'soins':
      return appliquerSoins(p, a.montant)
    case 'pvTemp':
      return { ...p, pvTemp: Math.max(0, Math.floor(a.montant)) }
    case 'ressource':
      return recadrer({ ...p, depenses: { ...p.depenses, [a.id]: (p.depenses[a.id] ?? 0) - a.delta } })
    case 'utiliser':
      return utiliser(p, a.place, a.demande)
    case 'annuler':
      return annuler(p, a.place, a.id)
    case 'sousChoix': {
      const u = p.combat.cases[a.place]
      if (!u || u.sousChoix) return p
      const res = depenser(p, a.demande)
      if (!res) return p
      return {
        ...p,
        depenses: res.depenses,
        combat: { ...p.combat, cases: { ...p.combat.cases, [a.place]: { ...u, sousChoix: { id: a.demande.id, nom: a.demande.nom, delta: res.delta } } } },
      }
    }
    case 'phase':
      return { ...p, combat: changerPhase(p.combat, a.phase) }
    case 'nouveauTour':
      return { ...p, combat: nouveauTour(p.combat) }
    case 'finCombat':
      return { ...p, combat: combatVierge() }
    case 'ennemi': {
      const liste = p.combat.ennemis ?? []
      const ennemis = liste.some((e) => e.id === a.ennemi.id) ? liste.map((e) => (e.id === a.ennemi.id ? a.ennemi : e)) : [...liste, a.ennemi]
      return { ...p, combat: { ...p.combat, ennemis } }
    }
    case 'retirerEnnemi':
      return { ...p, combat: { ...p.combat, ennemis: (p.combat.ennemis ?? []).filter((e) => e.id !== a.id) } }
    case 'etat': {
      const q = { ...p, etats: p.etats.includes(a.id) ? p.etats.filter((e) => e !== a.id) : [...p.etats, a.id] }
      // Neutralisé (ou un état qui l'inclut) met fin à la Concentration (p. 364).
      return neutralise(q) ? { ...q, concentration: null } : q
    }
    case 'epuisement':
      return { ...p, epuisement: borner(p.epuisement + a.delta, 0, 6) }
    case 'jsMort': {
      if (a.resultat === 'raz') return { ...p, jsMort: { reussites: 0, echecs: 0 } }
      const j = { ...p.jsMort }
      if (a.resultat === 'reussite') j.reussites = Math.min(3, j.reussites + 1)
      else j.echecs = Math.min(3, j.echecs + 1)
      return { ...p, jsMort: j }
    }
    case 'inspiration':
      return { ...p, inspiration: !p.inspiration }
    case 'reposCourt': {
      // Chaque dé de vie : résultat + mod Con, minimum 1 (p. 373).
      const dispo = p.niveau - p.desDeVieDepenses
      const des = a.desDeVie.slice(0, dispo)
      const soins = des.reduce((s, v) => s + Math.max(1, v + mod(p, 'con')), 0)
      const q = appliquerSoins({ ...p, desDeVieDepenses: p.desDeVieDepenses + des.length }, soins)
      return { ...q, depenses: recharger(q, 'repos-court') }
    }
    case 'reposLong': {
      // Tous les pv et tous les dés de vie, −1 Épuisement, pv temporaires perdus (p. 373, 29).
      const q = { ...p, depenses: recharger(p, 'repos-long'), desDeVieDepenses: 0, pvTemp: 0, epuisement: Math.max(0, p.epuisement - 1) }
      return { ...q, pv: pvMax(q), jsMort: { reussites: 0, echecs: 0 }, combat: combatVierge(), concentration: null }
    }
    case 'niveau': {
      if (p.niveau >= NIVEAU_MAX) return p
      const fixe = regles.classes[p.classe].deDeVie / 2 + 1
      const ajustement = a.pv === 'fixe' ? 0 : a.pv - fixe
      const q: Personnage = {
        ...p,
        niveau: p.niveau + 1,
        ajustementPvMax: p.ajustementPvMax + ajustement,
        sousClasse: a.sousClasse !== undefined ? a.sousClasse : p.sousClasse,
      }
      return recadrer({ ...q, pv: p.pv + (pvMax(q) - pvMax(p)) })
    }
    case 'choix': {
      const q = { ...p, choix: { ...p.choix, [a.cle]: a.valeurs } }
      return recadrer({ ...q, pv: p.pv + (pvMax(q) - pvMax(p)) })
    }
    case 'sorts':
      return { ...p, sorts: { prepares: a.prepares ?? p.sorts.prepares, mineurs: a.mineurs ?? p.sorts.mineurs } }
    case 'objet': {
      const existe = p.inventaire.some((o) => o.uid === a.objet.uid)
      const inventaire = existe ? p.inventaire.map((o) => (o.uid === a.objet.uid ? a.objet : o)) : [...p.inventaire, a.objet]
      return recadrer({ ...p, inventaire })
    }
    case 'retirerObjet':
      return recadrer({ ...p, inventaire: p.inventaire.filter((o) => o.uid !== a.uid) })
    case 'pieces':
      return { ...p, pieces: a.pieces }
    case 'note': {
      const existe = p.notes.some((n) => n.id === a.note.id)
      return { ...p, notes: existe ? p.notes.map((n) => (n.id === a.note.id ? a.note : n)) : [a.note, ...p.notes] }
    }
    case 'retirerNote':
      return { ...p, notes: p.notes.filter((n) => n.id !== a.id) }
    case 'langues':
      return { ...p, langues: a.langues }
    case 'concentration':
      return { ...p, concentration: a.valeur }
    case 'coequipier': {
      const existe = p.equipe.some((c) => c.id === a.coequipier.id)
      // La carte reçue en session reste la plus récente, même si la fiche a été ouverte avant son arrivée.
      return {
        ...p,
        equipe: existe ? p.equipe.map((c) => (c.id === a.coequipier.id ? { ...a.coequipier, carte: c.carte, vu: c.vu } : c)) : [...p.equipe, a.coequipier],
      }
    }
    case 'retirerCoequipier':
      return { ...p, equipe: p.equipe.filter((c) => c.id !== a.id) }
    case 'cartes': {
      // Cartes reçues en session : met à jour le coéquipier du même identifiant, ou l'ajoute.
      const vu = new Date().toISOString()
      let equipe = p.equipe
      for (const carte of a.cartes) {
        if (carte.id === p.id) continue
        const c = equipe.find((x) => x.id === carte.id)
        equipe = c
          ? equipe.map((x) => (x.id === carte.id ? { ...x, nom: carte.nom, carte, vu } : x))
          : [...equipe, { id: carte.id, nom: carte.nom, description: '', notes: '', carte, vu }]
      }
      return { ...p, equipe }
    }
  }
}
