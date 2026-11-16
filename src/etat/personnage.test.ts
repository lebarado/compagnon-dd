import { beforeAll, describe, expect, it } from 'vitest'
import { appliquerDegats, appliquerSoins, reducteur, type Personnage } from './personnage'
import { chargerTous, completer, enregistrerTous } from './stockage'
import { pvMax, ressourceRestante } from '../regles/calculs'
import { contraintes, deplacement, optionsPour } from '../regles/options'
import { chargerPackTest, moine as moineBase, packPresent } from '../test/pack'

const moine = (niveau = 1, s: Partial<Personnage> = {}) => {
  const p = moineBase(niveau, s)
  return { ...p, pv: s.pv ?? pvMax(p) }
}
const r = (p: Personnage | null, ...actions: Parameters<typeof reducteur>[1][]) => actions.reduce<Personnage | null>(reducteur, p)!

describe.skipIf(!packPresent)('état du personnage', () => {
  beforeAll(() => {
    chargerPackTest()
  })

  describe('dégâts et soins', () => {
    it('les pv temporaires absorbent en premier (p. 29)', () => {
      expect(appliquerDegats({ ...moine(), pvTemp: 5 }, 7)).toMatchObject({ pvTemp: 0, pv: 11 })
      expect(appliquerDegats({ ...moine(), pvTemp: 5 }, 3)).toMatchObject({ pvTemp: 2, pv: 13 })
    })
    it('pas sous 0 ; des dégâts à 0 pv valent un échec contre la mort (p. 29)', () => {
      const p = appliquerDegats(moine(), 99)
      expect(p.pv).toBe(0)
      expect(appliquerDegats(p, 3).jsMort.echecs).toBe(1)
    })
    it('les soins plafonnent et remettent les jets contre la mort à zéro', () => {
      const p = appliquerSoins({ ...moine(), pv: 0, jsMort: { reussites: 1, echecs: 2 } }, 50)
      expect(p).toMatchObject({ pv: 13, jsMort: { reussites: 0, echecs: 0 } })
    })
  })

  describe('combat', () => {
    it('une option dépense son coût et occupe sa case ; annuler rend tout', () => {
      const p = r(moine(5), { type: 'phase', phase: 'attente' }, { type: 'phase', phase: 'tour' }, {
        type: 'utiliser',
        place: 'bonus',
        demande: { id: 'patience-defensive', nom: 'Patience défensive', couts: { credo: 1 }, effets: ['desengagement', 'esquive'] },
      })
      expect(ressourceRestante(p, 'credo')).toBe(4)
      expect(p.combat.cases.bonus?.id).toBe('patience-defensive')
      expect(p.combat.effets).toEqual(['desengagement', 'esquive'])
      const q = r(p, { type: 'annuler', place: 'bonus' })
      expect(ressourceRestante(q, 'credo')).toBe(5)
      expect(q.combat.effets).toEqual([])
      expect(q.combat.cases.bonus).toBeUndefined()
    })

    it('refuse une option sans assez de ressource', () => {
      const p = r(moine(2, { depenses: { credo: 2 } }), { type: 'utiliser', place: 'bonus', demande: { id: 'x', nom: 'x', couts: { credo: 1 } } })
      expect(p.combat.cases.bonus).toBeUndefined()
    })

    it('fin de tour : Désengagement expire, Esquive dure ; début du tour suivant : Esquive expire (p. 365-366)', () => {
      let p = r(moine(5), { type: 'phase', phase: 'tour' }, {
        type: 'utiliser',
        place: 'bonus',
        demande: { id: 'p', nom: 'p', couts: { credo: 1 }, effets: ['desengagement', 'esquive'] },
      })
      p = r(p, { type: 'utiliser', place: 'reaction', demande: { id: 'deviation', nom: 'Déviation' } })
      p = r(p, { type: 'phase', phase: 'attente' })
      expect(p.combat.effets).toEqual(['esquive'])
      expect(p.combat.cases.reaction).toBeDefined()
      p = r(p, { type: 'phase', phase: 'tour' })
      expect(p.combat.effets).toEqual([])
      expect(p.combat.cases).toEqual({})
    })

    it('Pointe double le déplacement ; Agrippé le met à 0 ; Épuisement le réduit (p. 366, 371)', () => {
      expect(deplacement(moine(2), ['pointe'])).toBe(24)
      expect(deplacement(moine(2, { etats: ['agrippe'] }), ['pointe'])).toBe(0)
      expect(deplacement(moine(2, { epuisement: 2 }), [])).toBe(9)
      expect(contraintes(moine(2, { etats: ['etourdi'] })).neutralise).toBe(true)
    })

    it('Métabolisme surnaturel : restaure tout le Credo, une fois par Repos long', () => {
      let p = moine(5, { depenses: { credo: 4 }, pv: 10 })
      const d = { id: 'metabolisme-surnaturel', nom: 'Métabolisme', couts: { 'metabolisme-surnaturel': 1 }, restaure: { credo: 'tout' as const }, soins: 9 }
      p = r(p, { type: 'utiliser', place: 'libre', demande: d })
      expect(ressourceRestante(p, 'credo')).toBe(5)
      expect(p.pv).toBe(19)
      const q = r({ ...p, depenses: { ...p.depenses, credo: 3 } }, { type: 'utiliser', place: 'libre', demande: d })
      expect(q.depenses.credo).toBe(3)
    })

    it('options de combat selon le niveau', () => {
      const ids = (n: number, e: Parameters<typeof optionsPour>[1]) => optionsPour(moine(n), e).map((o) => o.id)
      expect(ids(1, 'bonus')).toEqual(['attaque-bonus', 'connaissance-de-la-pierre'])
      expect(ids(2, 'bonus')).toContain('deluge-de-coups')
      expect(ids(3, 'reaction')).toEqual(['attaque-opportunite', 'deviation-d-assaut'])
      expect(ids(6, 'bonus')).toContain('plenitude-physique')
      expect(optionsPour(moine(10), 'bonus').find((o) => o.id === 'deluge-de-coups')?.de).toBe('3 × {mainsNues}')
    })
  })

  describe('repos (p. 373)', () => {
    it('court : dés de vie (minimum 1 chacun) et Credo', () => {
      const p = r(moine(5, { pv: 10, depenses: { credo: 5, 'metabolisme-surnaturel': 1 } }), { type: 'reposCourt', desDeVie: [1, 6] })
      expect(p.pv).toBe(10 + 3 + 8)
      expect(p.desDeVieDepenses).toBe(2)
      expect(ressourceRestante(p, 'credo')).toBe(5)
      expect(ressourceRestante(p, 'metabolisme-surnaturel')).toBe(0)
    })
    it('long : tout revient, Épuisement −1, pv temporaires perdus', () => {
      const p = r(moine(5, { pv: 3, pvTemp: 4, epuisement: 2, desDeVieDepenses: 3, depenses: { credo: 5, 'metabolisme-surnaturel': 1 } }), { type: 'reposLong' })
      expect(p).toMatchObject({ pv: pvMax(p), pvTemp: 0, epuisement: 1, desDeVieDepenses: 0 })
      expect(ressourceRestante(p, 'metabolisme-surnaturel')).toBe(1)
    })
  })

  describe('niveau', () => {
    it('valeur fixe : +5 + Con + 3 ; les blessures restent', () => {
      const p = r(moine(1, { pv: 5 }), { type: 'niveau', pv: 'fixe' })
      expect(p.niveau).toBe(2)
      expect(p.pv).toBe(15)
    })
    it('dé lancé : le maximum suit le résultat', () => {
      const p = r(moine(1), { type: 'niveau', pv: 8 })
      expect(pvMax(p)).toBe(13 + 8 + 2 + 3)
    })
    it('sous-classe au niveau 3', () => {
      const p = r(moine(2), { type: 'niveau', pv: 'fixe', sousClasse: 'paume' })
      expect(p.sousClasse).toBe('paume')
    })
  })
})

describe('sauvegarde locale', () => {
  const memoire = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
  }
  it('enregistre et recharge plusieurs personnages', () => {
    const s = memoire()
    const a = { ...moineBase(1), id: 'a' }
    const b = { ...moineBase(3), id: 'b' }
    enregistrerTous([a, b], 'b', s)
    const lu = chargerTous(s)
    expect(lu.actif).toBe('b')
    expect(lu.personnages.map((p) => p.id)).toEqual(['a', 'b'])
  })
  it('migre une sauvegarde de la version 1', () => {
    const v1 = { version: 1, nom: 'Thorgar', classe: 'moine', espece: 'nain', historique: 'fermier', niveau: 2, caracs: { for: 12, dex: 16, con: 14, int: 8, sag: 15, cha: 10 }, pv: 7 }
    const p = completer(v1)!
    expect(p).toMatchObject({ version: 2, nom: 'Thorgar', niveau: 2, pv: 7, caracsBase: { dex: 16 } })
    const s = memoire()
    s.setItem('compagnon-dd:personnage', JSON.stringify(v1))
    expect(chargerTous(s).personnages).toHaveLength(1)
  })
  it('ignore une sauvegarde illisible', () => {
    const s = memoire()
    s.setItem('compagnon-dd:personnages', '{pas du json')
    expect(chargerTous(s).personnages).toEqual([])
  })
})
