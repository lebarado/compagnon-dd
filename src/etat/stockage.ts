import { combatVierge } from './combat'
import { nouvelId, personnageVierge, type Personnage } from './personnage'

/** Sauvegarde locale de tous les personnages et du personnage actif. */
export const CLE = 'compagnon-dd:personnages'
const CLE_ACTIF = 'compagnon-dd:actif'
const CLE_V1 = 'compagnon-dd:personnage'

interface Magasin {
  getItem(cle: string): string | null
  setItem(cle: string, valeur: string): void
  removeItem?(cle: string): void
}

const magasinParDefaut = (): Magasin => localStorage

/** Remplit les champs absents (sauvegarde d'une version antérieure de l'app). */
export function completer(brut: Record<string, unknown>): Personnage | null {
  if (!brut || typeof brut !== 'object') return null
  if (brut.version === 1 && brut.caracs) {
    // v1 : un seul Moine, valeurs de caractéristiques finales saisies directement.
    const { caracs, dons, armure, bouclier, equipementDepart, ...reste } = brut as Record<string, unknown>
    void dons
    void armure
    void bouclier
    void equipementDepart
    return { ...personnageVierge(), ...(reste as Partial<Personnage>), version: 2, id: nouvelId(), caracsBase: caracs as Personnage['caracsBase'], combat: combatVierge() }
  }
  if (brut.version !== 2 || typeof brut.niveau !== 'number') return null
  const p = { ...personnageVierge(), ...(brut as Partial<Personnage>) }
  return { ...p, combat: { ...combatVierge(), ...p.combat } }
}

export function chargerTous(m: Magasin = magasinParDefaut()): { personnages: Personnage[]; actif: string | null } {
  try {
    const liste = (JSON.parse(m.getItem(CLE) ?? '[]') as Record<string, unknown>[]).map(completer).filter((p): p is Personnage => !!p)
    const ancien = m.getItem(CLE_V1)
    if (ancien) {
      const p = completer(JSON.parse(ancien))
      if (p) liste.push(p)
    }
    const actif = m.getItem(CLE_ACTIF)
    return { personnages: liste, actif: liste.some((p) => p.id === actif) ? actif : (liste[0]?.id ?? null) }
  } catch {
    return { personnages: [], actif: null }
  }
}

export function enregistrerTous(personnages: Personnage[], actif: string | null, m: Magasin = magasinParDefaut()): void {
  try {
    m.setItem(CLE, JSON.stringify(personnages))
    if (actif) m.setItem(CLE_ACTIF, actif)
    m.removeItem?.(CLE_V1)
  } catch {
    // Stockage plein ou refusé : l'app reste utilisable sans sauvegarde.
  }
}

/** Export de sauvegarde : un fichier JSON avec tous les personnages. */
export function exporter(personnages: Personnage[]): Blob {
  return new Blob([JSON.stringify({ app: 'compagnon-dd', date: new Date().toISOString(), personnages }, null, 2)], { type: 'application/json' })
}

export async function importer(fichier: File): Promise<Personnage[]> {
  const brut = JSON.parse(await fichier.text())
  const liste = Array.isArray(brut?.personnages) ? brut.personnages : [brut]
  const personnages = liste.map(completer).filter((p: Personnage | null): p is Personnage => !!p)
  if (!personnages.length) throw new Error("Ce fichier ne contient aucun personnage lisible.")
  return personnages
}
