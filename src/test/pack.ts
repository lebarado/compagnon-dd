import { existsSync, readFileSync } from 'node:fs'
import { definirRegles } from '../regles/pack'
import { personnageVierge, type Personnage } from '../etat/personnage'
import type { Pack } from '../regles/types'

/**
 * Les tests de règles lisent le pack local (public/pack-manuel.json, généré par tools/construire_pack.py).
 * Il n'existe pas sur GitHub : ces tests y sont sautés, seuls les tests sans données tournent.
 */
const chemin = new URL('../../public/pack-manuel.json', import.meta.url)
export const packPresent = existsSync(chemin)

export function chargerPackTest(): Pack {
  const pack = JSON.parse(readFileSync(chemin, 'utf8')) as Pack
  // Armure et bouclier de test, en attendant (ou en plus de) l'équipement du pack.
  pack.equipement.armures = [
    ...pack.equipement.armures.filter((a) => !a.id.startsWith('test-')),
    { id: 'test-cuir', nom: 'Armure de cuir (test)', categorie: 'legere', ca: 11, poids: 5, prix: '10 po', page: 219 },
    { id: 'test-maille', nom: 'Cotte de mailles (test)', categorie: 'lourde', ca: 16, dexMax: null, poids: 27.5, prix: '75 po', page: 219 },
    { id: 'test-bouclier', nom: 'Bouclier (test)', categorie: 'bouclier', ca: 2, poids: 3, prix: '10 po', page: 219 },
  ]
  definirRegles(pack)
  return pack
}

/** Nain Moine Fermier de référence : For 12, Dex 16, Con 14, Int 8, Sag 15, Cha 10. */
export function moine(niveau = 1, surcharge: Partial<Personnage> = {}): Personnage {
  return {
    ...personnageVierge(),
    nom: 'Test',
    espece: 'nain',
    historique: 'fermier',
    classe: 'moine',
    niveau,
    caracsBase: { for: 12, dex: 16, con: 14, int: 8, sag: 15, cha: 10 },
    competencesClasse: ['acrobaties', 'discretion'],
    sousClasse: niveau >= 3 ? 'paume' : null,
    ...surcharge,
  }
}

export const equipe = (ref: string) => ({ uid: ref, ref, nom: ref, quantite: 1, equipe: true })
