import donnees from '../../data/regles.json'

export type IdCarac = 'for' | 'dex' | 'con' | 'int' | 'sag' | 'cha'

/** Toute règle affichable : un titre, une ligne, un dépliant, une page du manuel. */
export interface Regle {
  id: string
  nom: string
  page: number
  resume: string
  detail?: string[]
}

export interface Aptitude extends Regle {
  niveau: number
  ca?: { base: number; mods: IdCarac[]; condition: string }
  maitriseToutesSauvegardes?: boolean
  bonusCarac?: Partial<Record<IdCarac, number>> & { max: number }
  repeteAuxNiveaux?: number[]
}

export interface ChoixEquipement {
  id: string
  objets: string[]
  po: number
}

export interface Classe {
  nom: string
  page: number
  deDeVie: number
  maitrises: {
    sauvegardes: IdCarac[]
    competences: { nombre: number; parmi: string[] }
  }
  equipementDepart: { page: number; choix: ChoixEquipement[] }
  table: { artsMartiaux?: number[]; pointsDeCredo?: number[]; bonusVitesseM?: number[] }
  aptitudes: Aptitude[]
  sousClasses: Record<string, { nom: string; page: number; aptitudes: Aptitude[] }>
}

export interface Trait extends Regle {
  pvMaxParNiveau?: number
}

export interface Espece {
  nom: string
  page: number
  vitesseM: number
  traits: Trait[]
}

export interface Historique {
  nom: string
  page: number
  caracteristiques: IdCarac[]
  don: string
  competences: string[]
  outils: string
  equipement: { choix: ChoixEquipement[] }
}

export interface Don {
  nom: string
  page: number
  resume: string
  detail?: string[]
  pvMaxParNiveau?: number
}

export interface Regles {
  caracteristiques: { page: number; liste: { id: IdCarac; nom: string; abrev: string }[] }
  bonusMaitrise: { page: number; parNiveau: number[] }
  competences: { page: number; liste: { id: string; nom: string; carac: IdCarac }[] }
  progression: { niveauMax: number }
  classes: Record<string, Classe>
  especes: Record<string, Espece>
  historiques: Record<string, Historique>
  dons: Record<string, Don>
  pointsDeVie: { zeroPv: { page: number; resume: string; detail: string[] } }
}

export const regles = donnees as unknown as Regles

export const CARACS: IdCarac[] = ['for', 'dex', 'con', 'int', 'sag', 'cha']
