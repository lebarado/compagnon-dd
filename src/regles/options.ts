import { regles } from './pack'
import { aptitudesAcquises, classeDe, conditionsRemplies, incantationDe, ressourceRestante, sortsAccordes, sortsChoisis, sousClasseDe, sources, texte, vitesse } from './calculs'
import type { Emplacement, OptionCombat, Sort } from './types'
import type { Affichable } from '../composants/Feuille'
import type { Personnage } from '../etat/personnage'

/** Applique les évolutions atteintes (Déluge de coups à trois attaques au niveau 10…). */
function evoluer(o: OptionCombat, niveau: number): OptionCombat {
  let r = o
  for (const e of o.evolutions ?? []) if (e.niveau <= niveau) r = { ...r, ...e, niveau: o.niveau, id: o.id }
  return r
}

/** Options de combat disponibles : communes, classe, sous-classe, puis traits, dons et options choisies. */
export function optionsDisponibles(p: Personnage): OptionCombat[] {
  const classe = classeDe(p)
  const liste: OptionCombat[] = [...regles.combat.optionsCommunes, ...(classe.optionsCombat ?? []), ...(sousClasseDe(p)?.optionsCombat ?? [])]
  for (const s of sources(p)) {
    const o = s.regle.optionCombat
    if (!o) continue
    liste.push({ id: s.regle.id, nom: s.regle.nom, page: s.regle.page, resume: s.regle.resume, detail: s.regle.detail, niveau: 1, ...o } as OptionCombat)
  }
  return liste
    .filter((o) => o.niveau <= p.niveau && conditionsRemplies(p, o.conditions))
    .map((o) => evoluer(o, p.niveau))
}

export function optionsPour(p: Personnage, emplacement: Emplacement): OptionCombat[] {
  return optionsDisponibles(p).filter((o) => o.emplacement === emplacement)
}

export function libelle(p: Personnage, modele?: string): string | null {
  return modele ? texte(p, modele) : null
}

/** Coût en ressources d'une option, pour l'affichage et la dépense. */
export function couts(o: { cout?: { ressource: string; nombre: number } }): Record<string, number> {
  return o.cout ? { [o.cout.ressource]: o.cout.nombre } : {}
}

export function abordable(p: Personnage, o: { cout?: { ressource: string; nombre: number } }): boolean {
  return !o.cout || ressourceRestante(p, o.cout.ressource) >= o.cout.nombre
}

/** Explication complète d'une option : son texte, sinon celui de l'aptitude dont elle découle. */
export function regleOption(p: Personnage, o: OptionCombat): Affichable {
  const apt = aptitudesAcquises(p).find((a) => a.id === (o.regle ?? o.id))
  const detail = o.detail ?? (apt?.detail?.length ? [o.resume, ...apt.detail] : [o.resume])
  return { nom: o.nom, page: o.page, resume: o.resume, detail, info: libelle(p, o.de) ?? undefined }
}

/** États actifs, avec ceux qu'ils incluent (Étourdi inclut Neutralisé…). */
export function etatsActifs(p: Personnage): Set<string> {
  const actifs = new Set<string>()
  const ajouter = (id: string) => {
    if (actifs.has(id)) return
    actifs.add(id)
    regles.etats.find((e) => e.id === id)?.inclut?.forEach(ajouter)
  }
  p.etats.forEach(ajouter)
  return actifs
}

export function contraintes(p: Personnage) {
  const actifs = etatsActifs(p)
  return {
    neutralise: actifs.has('neutralise'),
    vitesseZero: regles.etats.some((e) => e.vitesseZero && actifs.has(e.id)),
    aTerre: actifs.has('a-terre'),
    epuisement: p.epuisement,
  }
}

/** Déplacement du tour : Vitesse − 1,50 m par niveau d'Épuisement (p. 366), 0 si un état l'impose, + une Vitesse par Pointe (p. 371). */
export function deplacement(p: Personnage, effets: string[]): number {
  const k = contraintes(p)
  if (k.vitesseZero) return 0
  const v = Math.max(0, vitesse(p) - 1.5 * k.epuisement)
  return v * (1 + effets.filter((e) => e === 'pointe').length)
}

/* ---------- Sorts ---------- */

export type TempsSort = 'action' | 'bonus' | 'reaction' | 'long'

/** Classe le temps d'incantation imprimé (« Action », « Action Bonus », « Réaction… », « 1 minute »). */
export function tempsSort(s: Sort): TempsSort {
  const t = s.incantation.toLowerCase()
  if (t.startsWith('action bonus')) return 'bonus'
  if (t.startsWith('action')) return 'action'
  if (t.startsWith('réaction')) return 'reaction'
  return 'long'
}

/** Sorts que le personnage peut lancer : mineurs, préparés, toujours préparés et choisis par ses dons. */
export function sortsDisponibles(p: Personnage): Sort[] {
  const ids = new Set([...p.sorts.mineurs, ...p.sorts.prepares, ...sortsAccordes(p), ...sortsChoisis(p)])
  return [...ids].map((id) => regles.sorts[id]).filter((s): s is Sort => !!s).sort((a, b) => a.niveau - b.niveau || a.nom.localeCompare(b.nom))
}

export function sortsLancables(p: Personnage, temps: TempsSort): Sort[] {
  if (!incantationDe(p) && !sortsChoisis(p).length && !sortsAccordes(p).length) return []
  return sortsDisponibles(p).filter((s) => tempsSort(s) === temps)
}
