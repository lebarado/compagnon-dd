import { regles } from './pack'
import { slug } from './noms'
import type { Arme, Armure, Objet } from './types'
import { nouvelId, type ObjetInventaire } from '../etat/personnage'

export type Entree = { genre: 'arme'; e: Arme } | { genre: 'armure'; e: Armure } | { genre: 'objet'; e: Objet }

export function toutEquipement(): Entree[] {
  const eq = regles.equipement
  return [
    ...eq.armes.map((e) => ({ genre: 'arme' as const, e })),
    ...eq.armures.map((e) => ({ genre: 'armure' as const, e })),
    ...eq.objets.map((e) => ({ genre: 'objet' as const, e })),
  ]
}

export function entreeDe(ref: string | undefined): Entree | undefined {
  return ref ? toutEquipement().find((x) => x.e.id === ref) : undefined
}

/** Cherche un objet du pack d'après un nom imprimé (« 5 dagues », « Paquetage d'explorateur »). */
function trouver(nom: string): Entree | undefined {
  const cible = slug(nom)
  const variantes = [cible, cible.replace(/s(-|$)/g, '$1'), cible.replace(/x$/, '')]
  const tout = toutEquipement()
  return tout.find((x) => variantes.includes(slug(x.e.nom))) ?? tout.find((x) => variantes.some((v) => v.length > 3 && slug(x.e.nom).startsWith(v)))
}

/** Transforme une liste d'équipement de départ en objets d'inventaire. */
export function objetsDepuisNoms(noms: string[], profondeur = 0): ObjetInventaire[] {
  return noms.flatMap((brut) => {
    const m = /^(\d+)\s+(.+)$/.exec(brut.trim())
    const quantite = m ? Number(m[1]) : 1
    const nom = m ? m[2] : brut.trim()
    const x = trouver(nom)
    // Un paquetage est déballé : ses objets vont directement dans le sac.
    if (x?.genre === 'objet' && x.e.contenu && profondeur === 0) return objetsDepuisNoms(x.e.contenu, 1)
    return [{ uid: nouvelId(), ref: x?.e.id, nom: x ? x.e.nom : nom, quantite, poids: x?.e.poids }]
  })
}

export function poidsTotal(inventaire: ObjetInventaire[]): number {
  return Math.round(inventaire.reduce((s, o) => s + (o.poids ?? entreeDe(o.ref)?.e.poids ?? 0) * o.quantite, 0) * 10) / 10
}
