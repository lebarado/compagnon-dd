import { regles as reglesParDefaut, type Aptitude, type IdCarac, type Regle, type Regles } from './regles'
import type { Personnage } from '../etat/personnage'

/**
 * Fonctions pures : (personnage, règles) -> valeur. Aucune ne modifie son entrée.
 * Les pages citées sont celles du Manuel des joueurs 2024.
 */

/** p. 10 */
export function modificateur(valeur: number): number {
  return Math.floor((valeur - 10) / 2)
}

/** p. 128 (table du Moine) et p. 41 */
export function bonusMaitrise(niveau: number, r: Regles = reglesParDefaut): number {
  return r.bonusMaitrise.parNiveau[niveau - 1]
}

export function formatMod(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`
}

/** Aptitudes de classe et de sous-classe acquises au niveau actuel, dans l'ordre des niveaux. */
export function aptitudesAcquises(p: Personnage, r: Regles = reglesParDefaut): Aptitude[] {
  const classe = r.classes[p.classe]
  const sous = p.sousClasse ? (classe.sousClasses[p.sousClasse]?.aptitudes ?? []) : []
  return [...classe.aptitudes, ...sous].filter((a) => a.niveau <= p.niveau).sort((a, b) => a.niveau - b.niveau)
}

/** Dons du personnage : celui de l'historique puis ceux acquis ensuite. */
export function donsAcquis(p: Personnage, r: Regles = reglesParDefaut): string[] {
  return [r.historiques[p.historique].don, ...p.dons]
}

/** Valeur de caractéristique après les aptitudes qui l'augmentent (Esprit et corps, p. 129). */
export function valeurCarac(p: Personnage, carac: IdCarac, r: Regles = reglesParDefaut): number {
  let v = p.caracs[carac]
  for (const a of aptitudesAcquises(p, r)) {
    const bonus = a.bonusCarac?.[carac]
    if (bonus && a.bonusCarac) v = Math.max(v, Math.min(a.bonusCarac.max, v + bonus))
  }
  return v
}

export function mod(p: Personnage, carac: IdCarac, r: Regles = reglesParDefaut): number {
  return modificateur(valeurCarac(p, carac, r))
}

/** Faces du dé d'Arts martiaux (6, 8, 10, 12), ou null si la classe n'en a pas. p. 128 */
export function deArtsMartiaux(p: Personnage, r: Regles = reglesParDefaut): number | null {
  return r.classes[p.classe].table.artsMartiaux?.[p.niveau - 1] ?? null
}

/** p. 128 */
export function credoMax(p: Personnage, r: Regles = reglesParDefaut): number {
  return r.classes[p.classe].table.pointsDeCredo?.[p.niveau - 1] ?? 0
}

export function credoRestant(p: Personnage, r: Regles = reglesParDefaut): number {
  return Math.max(0, credoMax(p, r) - (p.depenses.credo ?? 0))
}

/** DD des aptitudes de Credo : 8 + mod Sag + bonus de maîtrise. p. 128 */
export function ddCredo(p: Personnage, r: Regles = reglesParDefaut): number {
  return 8 + mod(p, 'sag', r) + bonusMaitrise(p.niveau, r)
}

/** Vitesse en mètres : espèce + Déplacement sans armure (sans armure ni bouclier). p. 128, 194 */
export function vitesse(p: Personnage, r: Regles = reglesParDefaut): number {
  const bonus = p.armure || p.bouclier ? 0 : (r.classes[p.classe].table.bonusVitesseM?.[p.niveau - 1] ?? 0)
  return r.especes[p.espece].vitesseM + bonus
}

/**
 * CA de base : 10 + mod Dex (p. 364), ou la formule d'une aptitude si elle est meilleure
 * (Défense sans armure, p. 127 : 10 + Dex + Sag sans armure). On n'applique qu'une formule.
 */
export function classeArmure(p: Personnage, r: Regles = reglesParDefaut): number {
  let ca = 10 + mod(p, 'dex', r)
  for (const a of aptitudesAcquises(p, r)) {
    if (!a.ca) continue
    if (a.ca.condition === 'sans-armure' && p.armure) continue
    ca = Math.max(ca, a.ca.base + a.ca.mods.reduce((s, c) => s + mod(p, c, r), 0))
  }
  return ca
}

/**
 * Maximum de pv à valeur fixe :
 * niveau 1 = dé de vie + mod Con (p. 40) ; niveaux suivants = dé/2 + 1 + mod Con, minimum 1 (p. 42) ;
 * plus les traits et dons qui donnent des pv par niveau (Ténacité naine p. 194, Robuste p. 202).
 */
export function pvMax(p: Personnage, r: Regles = reglesParDefaut): number {
  const de = r.classes[p.classe].deDeVie
  const con = mod(p, 'con', r)
  const base = de + con + (p.niveau - 1) * Math.max(1, de / 2 + 1 + con)
  const traits = r.especes[p.espece].traits.reduce((s, t) => s + (t.pvMaxParNiveau ?? 0), 0)
  const dons = donsAcquis(p, r).reduce((s, id) => s + (r.dons[id]?.pvMaxParNiveau ?? 0), 0)
  return Math.max(1, base + (traits + dons) * p.niveau + p.ajustementPvMax)
}

export function maitriseSauvegarde(p: Personnage, carac: IdCarac, r: Regles = reglesParDefaut): boolean {
  return (
    r.classes[p.classe].maitrises.sauvegardes.includes(carac) ||
    aptitudesAcquises(p, r).some((a) => a.maitriseToutesSauvegardes)
  )
}

/** p. 40 */
export function sauvegarde(p: Personnage, carac: IdCarac, r: Regles = reglesParDefaut): number {
  return mod(p, carac, r) + (maitriseSauvegarde(p, carac, r) ? bonusMaitrise(p.niveau, r) : 0)
}

export function competencesMaitrisees(p: Personnage, r: Regles = reglesParDefaut): string[] {
  return [...new Set([...r.historiques[p.historique].competences, ...p.competencesClasse])]
}

/** p. 40 */
export function competence(p: Personnage, id: string, r: Regles = reglesParDefaut): number {
  const c = r.competences.liste.find((x) => x.id === id)
  if (!c) throw new Error(`Compétence inconnue : ${id}`)
  return mod(p, c.carac, r) + (competencesMaitrisees(p, r).includes(id) ? bonusMaitrise(p.niveau, r) : 0)
}

/** p. 41 */
export function initiative(p: Personnage, r: Regles = reglesParDefaut): number {
  return mod(p, 'dex', r)
}

/** p. 40 */
export function perceptionPassive(p: Personnage, r: Regles = reglesParDefaut): number {
  return 10 + competence(p, 'perception', r)
}

/** Tout ce que la fiche liste comme « traits et aptitudes », avec sa page. */
export function traitsEtAptitudes(p: Personnage, r: Regles = reglesParDefaut): Regle[] {
  const dons: Regle[] = donsAcquis(p, r)
    .filter((id) => r.dons[id])
    .map((id) => ({ id, ...r.dons[id] }))
  return [...aptitudesAcquises(p, r), ...r.especes[p.espece].traits, ...dons]
}
