import { describe, expect, it } from 'vitest'
import { appliquerDegats, appliquerSoins, personnageVierge, recadrer, reducteur, type Personnage } from './personnage'
import { credoRestant, pvMax } from '../regles/calculs'
import { charger, CLE, enregistrer } from './stockage'

function moine(niveau = 1): Personnage {
  const p = { ...personnageVierge(), niveau, caracs: { for: 12, dex: 16, con: 14, int: 8, sag: 15, cha: 10 } }
  return { ...p, pv: pvMax(p) }
}

describe('dégâts et soins', () => {
  it('les pv temporaires absorbent les dégâts en premier (p. 29)', () => {
    const p = appliquerDegats({ ...moine(), pvTemp: 5 }, 7)
    expect(p.pvTemp).toBe(0)
    expect(p.pv).toBe(13 - 2)
  })
  it('des dégâts inférieurs aux pv temporaires ne touchent pas les pv', () => {
    const p = appliquerDegats({ ...moine(), pvTemp: 5 }, 3)
    expect(p).toMatchObject({ pvTemp: 2, pv: 13 })
  })
  it('les pv ne descendent pas sous 0 (p. 372)', () => {
    expect(appliquerDegats(moine(), 99).pv).toBe(0)
  })
  it('les soins ne dépassent pas le maximum et ignorent les pv temporaires', () => {
    const blesse = { ...moine(), pv: 4, pvTemp: 3 }
    expect(appliquerSoins(blesse, 5)).toMatchObject({ pv: 9, pvTemp: 3 })
    expect(appliquerSoins(blesse, 50).pv).toBe(13)
  })
  it('les montants négatifs sont ignorés', () => {
    expect(appliquerDegats(moine(), -4).pv).toBe(13)
    expect(appliquerSoins({ ...moine(), pv: 4 }, -4).pv).toBe(4)
  })
})

describe('réducteur', () => {
  it('créer : pv au maximum, compteurs à zéro', () => {
    const p = reducteur(null, { type: 'creer', personnage: { ...moine(), pv: 1, pvTemp: 9 } })!
    expect(p).toMatchObject({ pv: 13, pvTemp: 0, depenses: {} })
  })
  it('les pv temporaires se remplacent, sans cumul (p. 29)', () => {
    let p = reducteur(moine(), { type: 'pvTemp', montant: 10 })!
    p = reducteur(p, { type: 'pvTemp', montant: 6 })!
    expect(p.pvTemp).toBe(6)
  })
  it('Credo : dépenser et récupérer restent entre 0 et le maximum', () => {
    let p = moine(3)
    for (let i = 0; i < 5; i++) p = reducteur(p, { type: 'credo', delta: -1 })!
    expect(credoRestant(p)).toBe(0)
    for (let i = 0; i < 9; i++) p = reducteur(p, { type: 'credo', delta: 1 })!
    expect(credoRestant(p)).toBe(3)
  })
  it('modifier : monter de niveau garde les blessures et ajoute les pv gagnés', () => {
    const blesse = { ...moine(1), pv: 5 }
    const p = reducteur(blesse, { type: 'modifier', personnage: { ...blesse, niveau: 2 } })!
    expect(pvMax(p) - pvMax(blesse)).toBe(10)
    expect(p.pv).toBe(15)
  })
  it('modifier : baisser le niveau recadre les pv et le Credo', () => {
    const haut = { ...moine(5), depenses: { credo: 4 } }
    const p = reducteur(haut, { type: 'modifier', personnage: { ...haut, niveau: 2 } })!
    expect(p.pv).toBeLessThanOrEqual(pvMax(p))
    expect(p.depenses.credo).toBe(2)
  })
})

describe('sauvegarde locale', () => {
  const memoire = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
  }
  it('enregistre puis recharge le même personnage', () => {
    const s = memoire()
    enregistrer(moine(4), s)
    expect(charger(s)).toEqual(recadrer(moine(4)))
  })
  it('renvoie null sans sauvegarde ou si elle est illisible', () => {
    const s = memoire()
    expect(charger(s)).toBeNull()
    s.setItem(CLE, '{pas du json')
    expect(charger(s)).toBeNull()
    s.setItem(CLE, JSON.stringify({ version: 99 }))
    expect(charger(s)).toBeNull()
  })
})
