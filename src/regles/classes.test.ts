import { beforeAll, describe, expect, it } from 'vitest'
import { emplacements, nombreSortsMineurs, nombreSortsPrepares, ressourceMax, sortsAccordes } from './calculs'
import { optionsDisponibles } from './options'
import { evaluer } from './formule'
import { chargerPackTest, moine, packPresent } from '../test/pack'
import type { Personnage } from '../etat/personnage'

/** Personnage de test d'une classe quelconque (caractéristiques du Moine de référence). */
const perso = (classe: string, niveau: number, sousClasse: string | null = null): Personnage =>
  moine(niveau, { classe, sousClasse, competencesClasse: [] })

const slots = (p: Personnage) => emplacements(p).map((e) => (e.id === 'pacte' ? `pacte:${e.niveau}x${e.max}` : e.max))

describe.skipIf(!packPresent)('autres classes du pack', () => {
  beforeAll(() => {
    chargerPackTest()
  })

  it('Guerrier : Second souffle 2/3/4 utilisations (p. 106)', () => {
    expect([1, 4, 10].map((n) => ressourceMax(perso('guerrier', n), 'second-souffle'))).toEqual([2, 3, 4])
    expect([2, 17].map((n) => ressourceMax(perso('guerrier', n), 'fougue'))).toEqual([1, 2])
    expect([9, 13, 17].map((n) => ressourceMax(perso('guerrier', n), 'inflexible'))).toEqual([1, 2, 3])
  })

  it('Maître de guerre : dés de Supériorité 4/5/6 et d8 → d10 → d12 (p. 110-111)', () => {
    expect([3, 7, 15].map((n) => ressourceMax(perso('guerrier', n, 'maitre-de-guerre'), 'superiorite'))).toEqual([4, 5, 6])
    const de = (n: number) => evaluer('8 + 2 * min(1, niveau / 10) + 2 * min(1, niveau / 18)', (id: string) => (id === 'niveau' ? n : undefined))
    expect([3, 10, 18].map(de)).toEqual([8, 10, 12])
  })

  it('Chevalier occulte : emplacements de tiers de lanceur (p. 109)', () => {
    expect(slots(perso('guerrier', 2))).toEqual([])
    expect(slots(perso('guerrier', 3, 'chevalier-occulte'))).toEqual([2])
    expect(slots(perso('guerrier', 7, 'chevalier-occulte'))).toEqual([4, 2])
    expect(slots(perso('guerrier', 19, 'chevalier-occulte'))).toEqual([4, 3, 3, 1])
    expect(nombreSortsMineurs(perso('guerrier', 10, 'chevalier-occulte'))).toBe(3)
  })

  it('Paladin et Rôdeur : demi-lanceurs (p. 148, 158)', () => {
    expect(slots(perso('paladin', 1))).toEqual([2])
    expect(slots(perso('paladin', 5))).toEqual([4, 2])
    expect(slots(perso('rodeur', 17))).toEqual([4, 3, 3, 3, 1])
    expect(nombreSortsPrepares(perso('rodeur', 9))).toBe(9)
    expect(ressourceMax(perso('paladin', 3), 'imposition-des-mains')).toBe(15)
  })

  it('Occultiste : Magie de pacte (p. 136)', () => {
    expect(slots(perso('occultiste', 1))).toEqual(['pacte:1x1'])
    expect(slots(perso('occultiste', 5))).toEqual(['pacte:3x2'])
    expect(slots(perso('occultiste', 17))).toEqual(['pacte:5x4'])
  })

  it('Magicien : lanceur complet, sorts préparés (p. 116)', () => {
    expect(slots(perso('magicien', 3))).toEqual([4, 2])
    expect(nombreSortsPrepares(perso('magicien', 16))).toBe(21)
    expect(nombreSortsMineurs(perso('magicien', 4))).toBe(4)
  })

  it('Roublard : Attaque sournoise 1d6 à 10d6 (p. 168)', () => {
    const op = (n: number) => optionsDisponibles(perso('roublard', n)).find((o) => o.id === 'attaque-sournoise')
    expect(op(1)?.de).toContain('{table.attaqueSournoise}')
    expect(op(5)?.sousChoix?.length).toBe(3)
    expect(op(14)?.sousChoix?.length).toBe(6)
  })

  it('sorts de sous-classe toujours préparés selon le niveau (Serment de Dévotion, p. 153)', () => {
    expect(sortsAccordes(perso('paladin', 3, 'devotion'))).toContain('bouclier-de-la-foi')
    expect(sortsAccordes(perso('paladin', 3, 'devotion'))).not.toContain('aide')
    expect(sortsAccordes(perso('paladin', 5, 'devotion'))).toContain('aide')
  })
})
