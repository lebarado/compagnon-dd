import { CARACS, regles as reglesCourantes } from './pack'
import { evaluer, remplir, signe, type Valeur } from './formule'
import type { Aptitude, Arme, Armure, Choix, Classe, Condition, Don, Effets, IdCarac, Pack, Regle, Ressource, SousClasse } from './types'
import type { Personnage } from '../etat/personnage'

/**
 * Fonctions pures : (personnage, règles) -> valeur. Aucune ne modifie son entrée.
 * Les pages citées sont celles du Manuel des joueurs 2024.
 */

type R = Pack
const reg = (r?: R): R => r ?? reglesCourantes

/** p. 10 */
export function modificateur(valeur: number): number {
  return Math.floor((valeur - 10) / 2)
}

/** p. 41 */
export function bonusMaitrise(niveau: number, r?: R): number {
  return reg(r).bonusMaitrise.parNiveau[niveau - 1]
}

export function formatMod(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`
}

export function classeDe(p: Personnage, r?: R): Classe {
  return reg(r).classes[p.classe]
}

export function sousClasseDe(p: Personnage, r?: R): SousClasse | null {
  return p.sousClasse ? (classeDe(p, r).sousClasses[p.sousClasse] ?? null) : null
}

/* ---------- Sources d'effets ---------- */

export type Origine = 'classe' | 'sous-classe' | 'espece' | 'historique' | 'choix'

export interface Source {
  /** Clé unique, sert de préfixe aux réponses de choix (p.choix[`${cle}>${choix.id}`]). */
  cle: string
  origine: Origine
  regle: Regle & Effets
  niveau?: number
}

/** Aptitudes de classe et de sous-classe acquises, une instance par niveau pour les aptitudes répétées. */
export function aptitudesAcquises(p: Personnage, r?: R): (Aptitude & { cle: string; origine: Origine })[] {
  const classe = classeDe(p, r)
  const liste: (Aptitude & { cle: string; origine: Origine })[] = []
  const ajouter = (a: Aptitude, origine: Origine, prefixe: string) => {
    for (const n of [a.niveau, ...(a.repeteAuxNiveaux ?? [])]) {
      if (n <= p.niveau) liste.push({ ...a, niveau: n, origine, cle: `${prefixe}:${a.id}${n === a.niveau ? '' : `@${n}`}` })
    }
  }
  for (const a of classe.aptitudes) ajouter(a, 'classe', `classe:${p.classe}`)
  for (const a of sousClasseDe(p, r)?.aptitudes ?? []) ajouter(a, 'sous-classe', `sc:${p.sousClasse}`)
  return liste.sort((a, b) => a.niveau - b.niveau)
}

/** Choix proposés par une source et réponses enregistrées. */
export function reponses(p: Personnage, cle: string, choix: Choix): string[] {
  return p.choix[`${cle}>${choix.id}`] ?? []
}

function* deplier(p: Personnage, r: R, source: Source, profondeur: number): Generator<Source> {
  yield source
  if (profondeur > 3) return
  for (const c of source.regle.choix ?? []) {
    for (const id of reponses(p, source.cle, c)) {
      if (c.type === 'don') {
        const don = r.dons[id]
        if (don) yield* deplier(p, r, { cle: `${source.cle}>${c.id}:${id}`, origine: 'choix', regle: { ...don, id } }, profondeur + 1)
      } else if (c.type === 'option') {
        const option = c.options?.find((o) => o.id === id)
        if (option) yield* deplier(p, r, { cle: `${source.cle}>${c.id}:${id}`, origine: 'choix', regle: option }, profondeur + 1)
      }
    }
  }
}

const cacheSources = new WeakMap<Personnage, { r: R; s: Source[] }>()

/** Toutes les sources actives : aptitudes, traits d'espèce, don d'historique, puis dons et options choisis. */
export function sources(p: Personnage, r?: R): Source[] {
  const rr = reg(r)
  const enCache = cacheSources.get(p)
  if (enCache?.r === rr) return enCache.s
  const s = calculerSources(p, rr)
  cacheSources.set(p, { r: rr, s })
  return s
}

function calculerSources(p: Personnage, rr: R): Source[] {
  const racines: Source[] = [
    ...aptitudesAcquises(p, rr).map((a) => ({ cle: a.cle, origine: a.origine, regle: a, niveau: a.niveau })),
    ...rr.especes[p.espece].traits.filter((t) => (t.niveau ?? 1) <= p.niveau).map((t) => ({ cle: `espece:${p.espece}:${t.id}`, origine: 'espece' as const, regle: t })),
  ]
  const donHistorique = rr.dons[rr.historiques[p.historique].don]
  if (donHistorique) racines.push({ cle: `historique:${p.historique}:don`, origine: 'historique', regle: { ...donHistorique, id: rr.historiques[p.historique].don } })
  return racines.flatMap((s) => [...deplier(p, rr, s, 0)])
}

/** Dons acquis (historique et choix), avec leur clé de source. */
export function donsAcquis(p: Personnage, r?: R): { cle: string; don: Don & { id: string } }[] {
  const rr = reg(r)
  return sources(p, rr)
    .filter((s) => s.origine === 'historique' || (s.origine === 'choix' && rr.dons[s.regle.id] && s.cle.endsWith(`:${s.regle.id}`)))
    .map((s) => ({ cle: s.cle, don: { ...rr.dons[s.regle.id], id: s.regle.id } }))
}

/** Choix encore ouverts (réponses manquantes), dans l'ordre des sources. */
export function choixEnAttente(p: Personnage, r?: R): { cle: string; source: Source; choix: Choix; manque: number }[] {
  return sources(p, r).flatMap((s) =>
    (s.regle.choix ?? [])
      .map((c) => ({ cle: `${s.cle}>${c.id}`, source: s, choix: c, manque: c.nombre - reponses(p, s.cle, c).length }))
      .filter((x) => x.manque > 0),
  )
}

/* ---------- Équipement porté ---------- */

export function armeDe(ref: string | undefined, r?: R): Arme | undefined {
  return ref ? reg(r).equipement.armes.find((a) => a.id === ref) : undefined
}

export function armureDe(ref: string | undefined, r?: R): Armure | undefined {
  return ref ? reg(r).equipement.armures.find((a) => a.id === ref) : undefined
}

export function armurePortee(p: Personnage, r?: R): Armure | undefined {
  return p.inventaire.map((o) => (o.equipe ? armureDe(o.ref, r) : undefined)).find((a) => a && a.categorie !== 'bouclier')
}

export function bouclierPorte(p: Personnage, r?: R): boolean {
  return p.inventaire.some((o) => o.equipe && armureDe(o.ref, r)?.categorie === 'bouclier')
}

export function conditionsRemplies(p: Personnage, conditions: Condition[] | undefined, r?: R): boolean {
  const armure = armurePortee(p, r)
  return (conditions ?? []).every((c) => {
    switch (c) {
      case 'sans-armure':
        return !armure
      case 'avec-armure':
        return !!armure
      case 'sans-bouclier':
        return !bouclierPorte(p, r)
      case 'pas-armure-lourde':
        return armure?.categorie !== 'lourde'
    }
  })
}

/* ---------- Caractéristiques ---------- */

/** Valeur après historique (p. 38), dons et choix de caractéristique, puis aptitudes comme Esprit et corps (p. 129). */
export function valeurCarac(p: Personnage, carac: IdCarac, r?: R): number {
  const rr = reg(r)
  let v = p.caracsBase[carac] + (p.bonusHistorique[carac] ?? 0)
  const toutes = sources(p, rr)
  for (const s of toutes) {
    for (const c of s.regle.choix ?? []) {
      if (c.type !== 'carac') continue
      for (const x of reponses(p, s.cle, c)) if (x === carac) v = Math.min(c.max ?? 20, v + 1)
    }
  }
  for (const s of toutes) {
    const bonus = s.regle.bonusCarac?.[carac]
    if (bonus) v = Math.max(v, Math.min(s.regle.bonusCarac?.max ?? 20, v + bonus))
  }
  return v
}

export function mod(p: Personnage, carac: IdCarac, r?: R): number {
  return modificateur(valeurCarac(p, carac, r))
}

/* ---------- Formules ---------- */

/** Résout les identifiants des formules du pack pour ce personnage. */
export function resolveur(p: Personnage, r?: R): (nom: string) => Valeur | undefined {
  const rr = reg(r)
  return (nom) => {
    if (nom === 'niveau') return p.niveau
    if (nom === 'bm') return bonusMaitrise(p.niveau, rr)
    if (nom.startsWith('mod.')) return mod(p, nom.slice(4) as IdCarac, rr)
    if (nom.startsWith('carac.')) return valeurCarac(p, nom.slice(6) as IdCarac, rr)
    if (nom.startsWith('table.')) return classeDe(p, rr).table[nom.slice(6)]?.[p.niveau - 1]
    if (nom === 'dd') return ddClasse(p, rr)
    if (nom === 'dd.sort') return incantationDe(p, rr) ? ddSorts(p, rr) : undefined
    if (nom === 'attaque.sort') return incantationDe(p, rr) ? attaqueSorts(p, rr) : undefined
    if (nom === 'mainsNues') {
      const m = mainsNues(p, rr)
      return `${formatMod(m.toucher)} · ${m.degats}`
    }
    if (nom === 'degats.mainsNues') return mainsNues(p, rr).degats
    if (nom === 'toucher.mainsNues') return mainsNues(p, rr).toucher
    if (nom === 'de.mainsNues') return mainsNues(p, rr).faces ?? undefined
    return undefined
  }
}

export function calculer(p: Personnage, formule: string | number, r?: R): number {
  return evaluer(formule, resolveur(p, r))
}

export function texte(p: Personnage, modele: string, r?: R): string {
  return remplir(modele, resolveur(p, r))
}

export function ddClasse(p: Personnage, r?: R): number | undefined {
  const f = classeDe(p, r).dd
  return f ? calculer(p, f, r) : undefined
}

/* ---------- Valeurs de la fiche ---------- */

/** CA de base 10 + Dex (p. 364), armure portée (p. 219), ou meilleure formule d'aptitude (Défense sans armure…). */
export function classeArmure(p: Personnage, r?: R): number {
  const rr = reg(r)
  const dex = mod(p, 'dex', rr)
  const armure = armurePortee(p, rr)
  let ca = 10 + dex
  if (armure) ca = armure.ca + (armure.dexMax === null ? 0 : Math.min(dex, armure.dexMax ?? dex))
  const effets = sources(p, rr).map((s) => s.regle)
  for (const e of effets) if (e.ca && conditionsRemplies(p, e.ca.conditions, rr)) ca = Math.max(ca, calculer(p, e.ca.formule, rr))
  if (bouclierPorte(p, rr)) ca += armureDe(p.inventaire.find((o) => o.equipe && armureDe(o.ref, rr)?.categorie === 'bouclier')?.ref, rr)?.ca ?? 2
  for (const e of effets) if (e.bonusCa && conditionsRemplies(p, e.bonusCa.conditions, rr)) ca += e.bonusCa.valeur
  return ca
}

/** Vitesse en mètres : espèce + bonus d'aptitudes dont les conditions sont remplies. */
export function vitesse(p: Personnage, r?: R): number {
  const rr = reg(r)
  let v = rr.especes[p.espece].vitesse
  for (const s of sources(p, rr)) {
    const b = s.regle.vitesse
    if (b && conditionsRemplies(p, b.conditions, rr)) v += calculer(p, b.bonus, rr)
  }
  return v
}

/**
 * Maximum de pv à valeur fixe : niveau 1 = dé de vie + Con (p. 40) ; ensuite dé/2 + 1 + Con, minimum 1 (p. 42) ;
 * plus les effets « pv par niveau » (Ténacité naine, Robuste…) et l'ajustement saisi (dés de vie lancés).
 */
export function pvMax(p: Personnage, r?: R): number {
  const rr = reg(r)
  const de = classeDe(p, rr).deDeVie
  const con = mod(p, 'con', rr)
  const base = de + con + (p.niveau - 1) * Math.max(1, de / 2 + 1 + con)
  const parNiveau = sources(p, rr).reduce((s, x) => s + (x.regle.pvMaxParNiveau ?? 0), 0)
  const fixe = sources(p, rr).reduce((s, x) => s + (x.regle.pvMaxBonus ?? 0), 0)
  return Math.max(1, base + parNiveau * p.niveau + fixe + p.ajustementPvMax)
}

export function maitriseSauvegarde(p: Personnage, carac: IdCarac, r?: R): boolean {
  if (classeDe(p, r).maitrises.sauvegardes.includes(carac)) return true
  return sources(p, r).some((s) => {
    const m = s.regle.maitriseSauvegardes
    return m === 'toutes' || (Array.isArray(m) && m.includes(carac))
  })
}

/** p. 40 */
export function sauvegarde(p: Personnage, carac: IdCarac, r?: R): number {
  return mod(p, carac, r) + (maitriseSauvegarde(p, carac, r) ? bonusMaitrise(p.niveau, r) : 0)
}

export function competencesMaitrisees(p: Personnage, r?: R): string[] {
  const rr = reg(r)
  const liste = [...rr.historiques[p.historique].competences, ...p.competencesClasse]
  for (const s of sources(p, rr)) {
    liste.push(...(s.regle.competences ?? []))
    for (const c of s.regle.choix ?? []) if (c.type === 'competence') liste.push(...reponses(p, s.cle, c))
  }
  return [...new Set(liste)]
}

export function expertises(p: Personnage, r?: R): string[] {
  return [
    ...new Set(sources(p, r).flatMap((s) => (s.regle.choix ?? []).filter((c) => c.type === 'expertise').flatMap((c) => reponses(p, s.cle, c)))),
  ]
}

/** p. 40 ; Expertise double le bonus (p. 367). */
export function competence(p: Personnage, id: string, r?: R): number {
  const rr = reg(r)
  const c = rr.competences.liste.find((x) => x.id === id)
  if (!c) throw new Error(`Compétence inconnue : ${id}`)
  const bm = bonusMaitrise(p.niveau, rr)
  let bonus = 0
  if (expertises(p, rr).includes(id)) bonus = 2 * bm
  else if (competencesMaitrisees(p, rr).includes(id)) bonus = bm
  else if (sources(p, rr).some((s) => s.regle.demiMaitrise)) bonus = Math.floor(bm / 2)
  return mod(p, c.carac, rr) + bonus
}

/** p. 41, plus les effets comme Vigilant. */
export function initiative(p: Personnage, r?: R): number {
  return mod(p, 'dex', r) + sources(p, r).reduce((s, x) => s + (x.regle.initiative ? calculer(p, x.regle.initiative, r) : 0), 0)
}

/** p. 40 */
export function perceptionPassive(p: Personnage, r?: R): number {
  return 10 + competence(p, 'perception', r)
}

export function visionNoir(p: Personnage, r?: R): number {
  return Math.max(0, ...sources(p, r).map((s) => s.regle.visionNoir ?? 0))
}

export function resistances(p: Personnage, r?: R): string[] {
  return [...new Set(sources(p, r).flatMap((s) => s.regle.resistances ?? []))]
}

/* ---------- Attaques ---------- */

/**
 * Attaque à mains nues : For + maîtrise, 1 + For dégâts (p. 362), sauf effet meilleur
 * (Arts martiaux p. 127 : dé de la table et Dex au choix).
 */
export function mainsNues(p: Personnage, r?: R): { toucher: number; degats: string; faces: number | null } {
  const rr = reg(r)
  const bm = bonusMaitrise(p.niveau, rr)
  const effet = sources(p, rr)
    .map((s) => s.regle.mainsNues)
    .filter((m): m is NonNullable<Effets['mainsNues']> => !!m && conditionsRemplies(p, m.conditions, rr))
    .map((m) => ({ faces: calculer(p, m.de, rr), carac: Math.max(...m.caracs.map((c) => mod(p, c, rr))) }))
    .sort((a, b) => b.faces - a.faces)[0]
  if (effet) return { toucher: effet.carac + bm, degats: `1d${effet.faces}${signe(effet.carac)}`, faces: effet.faces }
  const f = mod(p, 'for', rr)
  return { toucher: f + bm, degats: String(Math.max(0, 1 + f)), faces: null }
}

function maitriseArme(p: Personnage, arme: Arme, r: R): boolean {
  const cats = [...classeDe(p, r).maitrises.categoriesArmes, ...sources(p, r).flatMap((s) => s.regle.maitrisesArmes ?? [])]
  return cats.some((c) => {
    if (c === arme.id || c === arme.categorie) return true
    const [cat, prop] = c.split(':')
    return cat === arme.categorie && !!prop && arme.proprietes.some((x) => x.toLowerCase().startsWith(prop))
  })
}

/** Attaque avec une arme (p. 41, propriétés p. 213) ; armes de Moine avec Arts martiaux (p. 127). */
export function attaqueArme(p: Personnage, arme: Arme, r?: R): { toucher: number; degats: string; maitrise: boolean } {
  const rr = reg(r)
  const props = arme.proprietes.map((x) => x.toLowerCase())
  const f = mod(p, 'for', rr)
  const d = mod(p, 'dex', rr)
  let carac = arme.portee === 'distance' ? d : props.some((x) => x.startsWith('finesse')) ? Math.max(f, d) : f
  let de = arme.degats
  const moine = sources(p, rr)
    .map((s) => s.regle.mainsNues)
    .find((m) => m?.armesMoine && conditionsRemplies(p, m.conditions, rr))
  const armeDeMoine = arme.portee === 'corps-a-corps' && (arme.categorie === 'courante' || props.some((x) => x.startsWith('légère')))
  if (moine && armeDeMoine) {
    carac = Math.max(f, d)
    const faces = calculer(p, moine.de, rr)
    const actuel = Number(/d(\d+)/.exec(de)?.[1] ?? 0)
    if (/^1d\d+$/.test(de) && faces > actuel) de = `1d${faces}`
  }
  const maitrise = maitriseArme(p, arme, rr)
  return { toucher: carac + (maitrise ? bonusMaitrise(p.niveau, rr) : 0), degats: `${de}${signe(carac)}`, maitrise }
}

/* ---------- Ressources ---------- */

export function ressources(p: Personnage, r?: R): (Ressource & { max: string; valeurMax: number; origine: Origine })[] {
  const vues = new Map<string, Ressource & { valeurMax: number; origine: Origine }>()
  for (const s of sources(p, r)) {
    for (const res of s.regle.ressources ?? []) vues.set(res.id, { ...res, valeurMax: Math.max(0, calculer(p, res.max, r)), origine: s.origine })
  }
  return [...vues.values()]
}

/** Ressource mise en avant (Credo, Rage…) : la première ressource de classe disponible à ce niveau. */
export function ressourcePrincipale(p: Personnage, r?: R) {
  return ressources(p, r).find((x) => x.valeurMax > 0 && (x.origine === 'classe' || x.origine === 'sous-classe'))
}

export function ressourceMax(p: Personnage, id: string, r?: R): number {
  if (id.startsWith('sort-') || id === 'pacte') return emplacements(p, r).find((e) => e.id === id)?.max ?? 0
  return ressources(p, r).find((x) => x.id === id)?.valeurMax ?? 0
}

export function ressourceRestante(p: Personnage, id: string, r?: R): number {
  return Math.max(0, ressourceMax(p, id, r) - (p.depenses[id] ?? 0))
}

/* ---------- Incantation ---------- */

export function incantationDe(p: Personnage, r?: R) {
  const c = classeDe(p, r)
  return c.incantation ?? sousClasseDe(p, r)?.incantation ?? null
}

export function ddSorts(p: Personnage, r?: R): number {
  const inc = incantationDe(p, r)!
  return 8 + mod(p, inc.carac, r) + bonusMaitrise(p.niveau, r)
}

export function attaqueSorts(p: Personnage, r?: R): number {
  const inc = incantationDe(p, r)!
  return mod(p, inc.carac, r) + bonusMaitrise(p.niveau, r)
}

/** Emplacements de sorts disponibles (table de la classe, p. 30 de chaque classe ou table commune). */
export function emplacements(p: Personnage, r?: R): { id: string; niveau: number; max: number }[] {
  const rr = reg(r)
  const inc = incantationDe(p, rr)
  if (!inc) return []
  if (inc.type === 'pacte') {
    const max = rr.emplacementsSorts.pacte.emplacements[p.niveau - 1]
    return max ? [{ id: 'pacte', niveau: rr.emplacementsSorts.pacte.niveau[p.niveau - 1], max }] : []
  }
  return (rr.emplacementsSorts[inc.type][p.niveau - 1] ?? []).map((max, i) => ({ id: `sort-${i + 1}`, niveau: i + 1, max })).filter((e) => e.max > 0)
}

export function niveauSortMax(p: Personnage, r?: R): number {
  return Math.max(0, ...emplacements(p, r).map((e) => e.niveau))
}

export function nombreSortsMineurs(p: Personnage, r?: R): number {
  return incantationDe(p, r)?.sortsMineurs?.[p.niveau - 1] ?? 0
}

export function nombreSortsPrepares(p: Personnage, r?: R): number {
  return incantationDe(p, r)?.sortsPrepares[p.niveau - 1] ?? 0
}

/** Sorts toujours préparés accordés par les aptitudes, traits et dons. */
export function sortsAccordes(p: Personnage, r?: R): string[] {
  return [...new Set(sources(p, r).flatMap((s) => (s.regle.sorts ?? []).filter((x) => (x.niveau ?? 1) <= p.niveau).map((x) => x.id)))]
}

/** Sorts choisis par des choix de type « sort » (Initié à la magie, lignées…). */
export function sortsChoisis(p: Personnage, r?: R): string[] {
  return [...new Set(sources(p, r).flatMap((s) => (s.regle.choix ?? []).filter((c) => c.type === 'sort').flatMap((c) => reponses(p, s.cle, c))))]
}

/* ---------- Liste de la fiche ---------- */

/** Tout ce que la fiche liste comme « traits et aptitudes », avec sa page. */
export function traitsEtAptitudes(p: Personnage, r?: R): (Regle & { origine: Origine })[] {
  const vus = new Set<string>()
  return sources(p, r)
    .map((s) => ({ ...s.regle, origine: s.origine }))
    .filter((x) => {
      const cle = `${x.id}|${x.nom}`
      if (vus.has(cle)) return false
      vus.add(cle)
      return true
    })
}

export { CARACS }
