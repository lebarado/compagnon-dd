import { beforeAll, describe, expect, it } from 'vitest'
import {
  aptitudesAcquises,
  bonusMaitrise,
  choixEnAttente,
  classeArmure,
  competence,
  competencesMaitrisees,
  ddClasse,
  formatMod,
  initiative,
  mainsNues,
  maitriseSauvegarde,
  modificateur,
  perceptionPassive,
  pvMax,
  ressourceMax,
  ressourceRestante,
  sauvegarde,
  valeurCarac,
  vitesse,
} from './calculs'
import { chargerPackTest, equipe, moine, packPresent } from '../test/pack'
import type { Pack } from './types'

const NIVEAUX = Array.from({ length: 20 }, (_, i) => i + 1)
let pack: Pack

describe('modificateur de caractéristique (p. 10)', () => {
  it('suit la formule pour 1 à 30', () => {
    const attendu: [number, number][] = [[1, -5], [3, -4], [8, -1], [10, 0], [11, 0], [15, 2], [20, 5], [25, 7], [30, 10]]
    for (const [v, m] of attendu) expect(modificateur(v)).toBe(m)
  })
  it('affiche le signe', () => {
    expect([formatMod(3), formatMod(0), formatMod(-1)]).toEqual(['+3', '+0', '−1'])
  })
})

describe.skipIf(!packPresent)('règles du pack : Nain Moine Fermier', () => {
  beforeAll(() => {
    pack = chargerPackTest()
  })

  it('bonus de maîtrise (p. 128)', () => {
    expect(NIVEAUX.map((n) => bonusMaitrise(n))).toEqual([2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6])
  })

  it("dé d'Arts martiaux sur l'attaque à mains nues (p. 127-128)", () => {
    expect(NIVEAUX.map((n) => mainsNues(moine(n)).faces)).toEqual([6, 6, 6, 6, 8, 8, 8, 8, 8, 8, 10, 10, 10, 10, 10, 10, 12, 12, 12, 12])
    expect(mainsNues(moine(1))).toMatchObject({ toucher: 5, degats: '1d6+3' })
  })

  it('sans Arts martiaux (armure), mains nues = 1 + For (p. 362)', () => {
    expect(mainsNues(moine(1, { inventaire: [equipe('test-cuir')] }))).toMatchObject({ toucher: 3, degats: '2', faces: null })
  })

  it('points de Credo : aucun au niveau 1, puis égal au niveau', () => {
    expect(ressourceMax(moine(1), 'credo')).toBe(0)
    for (const n of NIVEAUX.slice(1)) expect(ressourceMax(moine(n), 'credo')).toBe(n)
    expect(ressourceRestante(moine(5, { depenses: { credo: 2 } }), 'credo')).toBe(3)
  })

  it('Vitesse : 9 m de Nain + Déplacement sans armure (p. 128)', () => {
    expect(NIVEAUX.map((n) => vitesse(moine(n)))).toEqual([9, 12, 12, 12, 12, 13.5, 13.5, 13.5, 13.5, 15, 15, 15, 15, 16.5, 16.5, 16.5, 16.5, 18, 18, 18])
    expect(vitesse(moine(6, { inventaire: [equipe('test-cuir')] }))).toBe(9)
    expect(vitesse(moine(6, { inventaire: [equipe('test-bouclier')] }))).toBe(9)
  })

  it('CA : Défense sans armure 10 + Dex + Sag (p. 127), armure (p. 219), bouclier +2', () => {
    expect(classeArmure(moine(1))).toBe(15)
    expect(classeArmure(moine(1, { inventaire: [equipe('test-cuir')] }))).toBe(14)
    expect(classeArmure(moine(1, { inventaire: [equipe('test-maille')] }))).toBe(16)
    // Défense sans armure n'exclut que l'armure dans le texte français (point à vérifier p. 127).
    expect(classeArmure(moine(1, { inventaire: [equipe('test-bouclier')] }))).toBe(17)
    expect(classeArmure(moine(1, { inventaire: [{ ...equipe('test-cuir'), equipe: false }] }))).toBe(15)
  })

  it('pv max : 8 + Con (p. 40), 5 + Con ensuite (p. 42), + Ténacité naine et Robuste', () => {
    expect(pvMax(moine(1))).toBe(8 + 2 + 1 + 2)
    expect(pvMax(moine(5))).toBe(8 + 2 + 4 * 7 + 5 + 10)
    expect(pvMax(moine(1, { ajustementPvMax: 3 }))).toBe(16)
    const faible = { for: 10, dex: 10, con: 1, int: 10, sag: 10, cha: 10 }
    expect(pvMax(moine(3, { caracsBase: faible }))).toBe(8 - 5 + 2 * 1 + 3 + 6)
  })

  it("bonus d'historique (p. 38)", () => {
    const p = moine(1, { bonusHistorique: { con: 2, sag: 1 } })
    expect(valeurCarac(p, 'con')).toBe(16)
    expect(valeurCarac(p, 'sag')).toBe(16)
    expect(pvMax(p)).toBe(8 + 3 + 1 + 2)
  })

  it('jets de sauvegarde et Survivant discipliné (p. 129)', () => {
    expect(sauvegarde(moine(1), 'dex')).toBe(5)
    expect(sauvegarde(moine(1), 'sag')).toBe(2)
    expect(maitriseSauvegarde(moine(13), 'cha')).toBe(false)
    expect(maitriseSauvegarde(moine(14), 'cha')).toBe(true)
  })

  it('compétences : Fermier + choix de classe', () => {
    const p = moine(1)
    expect(competencesMaitrisees(p).sort()).toEqual(['acrobaties', 'discretion', 'dressage', 'nature'])
    expect(competence(p, 'acrobaties')).toBe(5)
    expect(competence(p, 'perception')).toBe(2)
    expect(perceptionPassive(p)).toBe(12)
    expect(initiative(p)).toBe(3)
  })

  it('DD de Credo : 8 + Sag + maîtrise (p. 128)', () => {
    expect(ddClasse(moine(2))).toBe(12)
    expect(ddClasse(moine(5))).toBe(13)
  })

  it('Amélioration de caractéristique au niveau 4, puis 8 (p. 129, 202)', () => {
    expect(choixEnAttente(moine(4)).map((c) => c.cle)).toEqual(['classe:moine:don-4>don'])
    const p = moine(8, {
      choix: {
        'classe:moine:don-4>don': ['amelioration-de-caracteristique'],
        'classe:moine:don-4>don:amelioration-de-caracteristique>caracs': ['dex', 'dex'],
        'classe:moine:don-4@8>don': ['amelioration-de-caracteristique'],
        'classe:moine:don-4@8>don:amelioration-de-caracteristique>caracs': ['dex', 'sag'],
      },
    })
    expect(valeurCarac(p, 'dex')).toBe(19)
    expect(valeurCarac(p, 'sag')).toBe(16)
    expect(choixEnAttente(p)).toEqual([])
    expect(classeArmure(p)).toBe(10 + 4 + 3)
  })

  it('une amélioration ne dépasse pas 20', () => {
    const p = moine(4, {
      caracsBase: { for: 12, dex: 20, con: 14, int: 8, sag: 15, cha: 10 },
      choix: { 'classe:moine:don-4>don': ['amelioration-de-caracteristique'], 'classe:moine:don-4>don:amelioration-de-caracteristique>caracs': ['dex', 'dex'] },
    })
    expect(valeurCarac(p, 'dex')).toBe(20)
  })

  it('Esprit et corps, niveau 20 : Dex et Sag +4, maximum 25 (p. 129)', () => {
    const p = moine(20, { caracsBase: { for: 12, dex: 20, con: 14, int: 8, sag: 22, cha: 10 } })
    expect(valeurCarac(p, 'dex')).toBe(24)
    expect(valeurCarac(p, 'sag')).toBe(25)
    expect(valeurCarac(moine(19), 'dex')).toBe(16)
  })

  it('aucune régression à la montée de niveau', () => {
    let precedentes: string[] = []
    for (const n of NIVEAUX.slice(1)) {
      const avant = moine(n - 1)
      const apres = moine(n)
      expect(pvMax(apres)).toBeGreaterThan(pvMax(avant))
      expect(classeArmure(apres)).toBeGreaterThanOrEqual(classeArmure(avant))
      expect(ressourceMax(apres, 'credo')).toBeGreaterThanOrEqual(ressourceMax(avant, 'credo'))
      expect(vitesse(apres)).toBeGreaterThanOrEqual(vitesse(avant))
      const ids = aptitudesAcquises(apres).map((a) => a.cle)
      for (const id of precedentes) expect(ids).toContain(id)
      precedentes = ids
    }
    expect(pack.classes.moine.sousClasses.paume).toBeDefined()
  })
})
