import { regles } from './pack'
import type { IdCarac } from './types'

export const nomCompetence = (id: string) => regles.competences.liste.find((c) => c.id === id)?.nom ?? id
export const nomCarac = (id: IdCarac) => regles.caracteristiques.liste.find((c) => c.id === id)?.nom ?? id
export const abrevCarac = (id: IdCarac) => regles.caracteristiques.liste.find((c) => c.id === id)?.abrev ?? id
export const metres = (m: number) => `${String(m).replace('.', ',')} m`

/** Identifiant à partir d'un nom : minuscules, sans accents, tirets. */
export function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Comparaison de recherche : insensible à la casse et aux accents. */
export function correspond(texte: string, recherche: string): boolean {
  if (!recherche.trim()) return true
  const t = slug(texte)
  return slug(recherche)
    .split('-')
    .filter(Boolean)
    .every((mot) => t.includes(mot))
}

export const NOMS_TEMPS: Record<string, string> = { action: 'Action', bonus: 'Action Bonus', reaction: 'Réaction', long: 'Plus long' }
