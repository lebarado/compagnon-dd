import { personnageVierge, recadrer, type Personnage } from './personnage'

export const CLE = 'compagnon-dd:personnage'

interface Magasin {
  getItem(cle: string): string | null
  setItem(cle: string, valeur: string): void
}

/** Lit le personnage sauvegardé. Renvoie null s'il n'y en a pas ou s'il est illisible. */
export function charger(magasin: Magasin = localStorage): Personnage | null {
  try {
    const brut = magasin.getItem(CLE)
    if (!brut) return null
    const lu = JSON.parse(brut)
    if (lu?.version !== 1 || typeof lu.niveau !== 'number' || !lu.caracs) return null
    // Les champs ajoutés par une version plus récente de l'app prennent leur valeur par défaut.
    return recadrer({ ...personnageVierge(), ...lu })
  } catch {
    return null
  }
}

export function enregistrer(p: Personnage, magasin: Magasin = localStorage): void {
  try {
    magasin.setItem(CLE, JSON.stringify(p))
  } catch {
    // Stockage plein ou refusé (navigation privée) : l'app reste utilisable sans sauvegarde.
  }
}
