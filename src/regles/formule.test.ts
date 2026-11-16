import { describe, expect, it } from 'vitest'
import { evaluer, remplir, signe } from './formule'

const valeurs: Record<string, number | string> = { niveau: 5, bm: 3, 'mod.dex': 3, 'mod.sag': -1, 'table.artsMartiaux': 8, mainsNues: '+6 · 1d8+3' }
const r = (n: string) => valeurs[n]

describe('formules', () => {
  it('calcule avec priorités et parenthèses', () => {
    expect(evaluer('8 + mod.dex + bm', r)).toBe(14)
    expect(evaluer('2 * (niveau + 1)', r)).toBe(12)
    expect(evaluer('-mod.sag', r)).toBe(1)
    expect(evaluer(4, r)).toBe(4)
  })
  it("divise en arrondissant à l'inférieur (p. 361)", () => {
    expect(evaluer('niveau / 2', r)).toBe(2)
    expect(evaluer('7 / 2', r)).toBe(3)
  })
  it('connaît max et min', () => {
    expect(evaluer('max(1, mod.sag)', r)).toBe(1)
    expect(evaluer('min(niveau, 3, bm + 4)', r)).toBe(3)
  })
  it('refuse les identifiants inconnus et la syntaxe invalide', () => {
    expect(() => evaluer('inconnu + 1', r)).toThrow()
    expect(() => evaluer('1 +', r)).toThrow()
    expect(() => evaluer('3 3', r)).toThrow()
  })
})

describe('modèles de texte', () => {
  it('remplace les valeurs, signées ou non', () => {
    expect(remplir('1d{table.artsMartiaux}{+mod.dex}', r)).toBe('1d8+3')
    expect(remplir('1d10{+mod.dex + niveau}', r)).toBe('1d10+8')
    expect(remplir('DD {8 + mod.sag + bm}', r)).toBe('DD 10')
    expect(remplir('1d6{+mod.sag + 1}', r)).toBe('1d6')
  })
  it('insère les valeurs textuelles', () => {
    expect(remplir('{mainsNues}', r)).toBe('+6 · 1d8+3')
  })
  it('signale une expression invalide sans planter', () => {
    expect(remplir('{x + 1}', r)).toBe('[x + 1]')
  })
  it('signe', () => {
    expect([signe(2), signe(0), signe(-3)]).toEqual(['+2', '', '−3'])
  })
})
