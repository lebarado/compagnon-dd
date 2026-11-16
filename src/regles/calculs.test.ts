import { describe, expect, it } from 'vitest'
import { regles } from './regles'
import {
  aptitudesAcquises,
  bonusMaitrise,
  classeArmure,
  competence,
  competencesMaitrisees,
  credoMax,
  credoRestant,
  ddCredo,
  deArtsMartiaux,
  formatMod,
  initiative,
  maitriseSauvegarde,
  modificateur,
  perceptionPassive,
  pvMax,
  sauvegarde,
  valeurCarac,
  vitesse,
} from './calculs'
import { personnageVierge, type Personnage } from '../etat/personnage'

/** Nain Moine Fermier de référence : For 12, Dex 16, Con 14, Int 8, Sag 15, Cha 10. */
function moine(niveau = 1, surcharge: Partial<Personnage> = {}): Personnage {
  return {
    ...personnageVierge(),
    nom: 'Test',
    niveau,
    caracs: { for: 12, dex: 16, con: 14, int: 8, sag: 15, cha: 10 },
    competencesClasse: ['acrobaties', 'discretion'],
    sousClasse: niveau >= 3 ? 'paume' : null,
    ...surcharge,
  }
}

const NIVEAUX = Array.from({ length: 20 }, (_, i) => i + 1)

describe('modificateur de caractéristique (p. 10)', () => {
  it('suit la table du manuel pour toutes les valeurs de 1 à 30', () => {
    for (const ligne of (regles.caracteristiques as any).modificateur.table) {
      for (let v = ligne.de; v <= ligne.a; v++) expect(modificateur(v)).toBe(ligne.mod)
    }
  })
  it('affiche le signe', () => {
    expect(formatMod(3)).toBe('+3')
    expect(formatMod(0)).toBe('+0')
    expect(formatMod(-1)).toBe('−1')
  })
})

describe('table du Moine (p. 128)', () => {
  it('bonus de maîtrise', () => {
    expect(NIVEAUX.map((n) => bonusMaitrise(n))).toEqual([2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6])
  })
  it("dé d'Arts martiaux", () => {
    expect(NIVEAUX.map((n) => deArtsMartiaux(moine(n)))).toEqual([
      6, 6, 6, 6, 8, 8, 8, 8, 8, 8, 10, 10, 10, 10, 10, 10, 12, 12, 12, 12,
    ])
  })
  it('points de Credo : aucun au niveau 1, puis égal au niveau', () => {
    expect(credoMax(moine(1))).toBe(0)
    for (const n of NIVEAUX.slice(1)) expect(credoMax(moine(n))).toBe(n)
  })
  it('Vitesse : 9 m de Nain + Déplacement sans armure', () => {
    expect(NIVEAUX.map((n) => vitesse(moine(n)))).toEqual([
      9, 12, 12, 12, 12, 13.5, 13.5, 13.5, 13.5, 15, 15, 15, 15, 16.5, 16.5, 16.5, 16.5, 18, 18, 18,
    ])
  })
  it('pas de bonus de Vitesse avec une armure ou un bouclier', () => {
    expect(vitesse(moine(6, { armure: true }))).toBe(9)
    expect(vitesse(moine(6, { bouclier: true }))).toBe(9)
  })
})

describe("classe d'armure", () => {
  it('Défense sans armure : 10 + Dex + Sag (p. 127)', () => {
    expect(classeArmure(moine(1))).toBe(10 + 3 + 2)
  })
  it('avec une armure, la formule de base 10 + Dex (p. 364)', () => {
    expect(classeArmure(moine(1, { armure: true }))).toBe(13)
  })
  it('ne descend pas sous 10 + Dex si la Sagesse est négative', () => {
    const p = moine(1, { caracs: { for: 10, dex: 14, con: 10, int: 10, sag: 8, cha: 10 } })
    expect(classeArmure(p)).toBe(12)
  })
})

describe('points de vie maximum', () => {
  it('niveau 1 : 8 + Con (p. 40) + Ténacité naine (p. 194) + Robuste (p. 202)', () => {
    expect(pvMax(moine(1))).toBe(8 + 2 + 1 + 2)
  })
  it('niveau 5 : 5 + Con par niveau supplémentaire (p. 42)', () => {
    expect(pvMax(moine(5))).toBe(8 + 2 + 4 * (5 + 2) + 5 * 1 + 5 * 2)
  })
  it('au moins 1 pv par niveau même avec une Constitution très basse', () => {
    const faible = { for: 10, dex: 10, con: 1, int: 10, sag: 10, cha: 10 }
    expect(pvMax(moine(3, { caracs: faible }))).toBe(8 - 5 + 2 * 1 + 3 + 6)
  })
  it("tient compte de l'ajustement manuel", () => {
    expect(pvMax(moine(1, { ajustementPvMax: 3 }))).toBe(16)
  })
  it('un point de modificateur de Constitution en plus = 1 pv par niveau (p. 42)', () => {
    const base = moine(8)
    const plus = moine(8, { caracs: { ...base.caracs, con: 16 } })
    expect(pvMax(plus) - pvMax(base)).toBe(8)
  })
})

describe('jets de sauvegarde et compétences (p. 40)', () => {
  it('maîtrise Force et Dextérité au niveau 1', () => {
    const p = moine(1)
    expect(sauvegarde(p, 'for')).toBe(1 + 2)
    expect(sauvegarde(p, 'dex')).toBe(3 + 2)
    expect(sauvegarde(p, 'sag')).toBe(2)
    expect(maitriseSauvegarde(p, 'con')).toBe(false)
  })
  it('Survivant discipliné : toutes les sauvegardes au niveau 14 (p. 129)', () => {
    expect(maitriseSauvegarde(moine(13), 'cha')).toBe(false)
    expect(maitriseSauvegarde(moine(14), 'cha')).toBe(true)
    expect(sauvegarde(moine(14), 'con')).toBe(2 + 5)
  })
  it('compétences : Fermier (Dressage, Nature) + choix de classe', () => {
    const p = moine(1)
    expect(competencesMaitrisees(p).sort()).toEqual(['acrobaties', 'discretion', 'dressage', 'nature'])
    expect(competence(p, 'dressage')).toBe(2 + 2)
    expect(competence(p, 'nature')).toBe(-1 + 2)
    expect(competence(p, 'acrobaties')).toBe(3 + 2)
    expect(competence(p, 'perception')).toBe(2)
  })
  it('Perception passive et Initiative', () => {
    expect(perceptionPassive(moine(1))).toBe(12)
    expect(initiative(moine(1))).toBe(3)
  })
  it('DD de Credo : 8 + Sag + maîtrise (p. 128)', () => {
    expect(ddCredo(moine(2))).toBe(12)
    expect(ddCredo(moine(5))).toBe(13)
  })
})

describe('Esprit et corps, niveau 20 (p. 129)', () => {
  it('Dextérité et Sagesse +4, maximum 25', () => {
    const p = moine(20, { caracs: { for: 12, dex: 20, con: 14, int: 8, sag: 22, cha: 10 } })
    expect(valeurCarac(p, 'dex')).toBe(24)
    expect(valeurCarac(p, 'sag')).toBe(25)
    expect(valeurCarac(p, 'for')).toBe(12)
    expect(valeurCarac(moine(19), 'dex')).toBe(16)
  })
})

describe('Credo restant', () => {
  it('maximum moins les points dépensés, jamais négatif', () => {
    expect(credoRestant(moine(5, { depenses: { credo: 2 } }))).toBe(3)
    expect(credoRestant(moine(5, { depenses: { credo: 9 } }))).toBe(0)
  })
})

describe('aucune régression à la montée de niveau', () => {
  it('pv max, CA, Credo, Vitesse et sauvegardes ne baissent jamais', () => {
    for (const n of NIVEAUX.slice(1)) {
      const avant = moine(n - 1)
      const apres = moine(n)
      expect(pvMax(apres)).toBeGreaterThan(pvMax(avant))
      expect(classeArmure(apres)).toBeGreaterThanOrEqual(classeArmure(avant))
      expect(credoMax(apres)).toBeGreaterThanOrEqual(credoMax(avant))
      expect(vitesse(apres)).toBeGreaterThanOrEqual(vitesse(avant))
      expect(sauvegarde(apres, 'dex')).toBeGreaterThanOrEqual(sauvegarde(avant, 'dex'))
    }
  })
  it('on ne perd jamais une aptitude, et chaque niveau en apporte selon la table', () => {
    let precedentes: string[] = []
    for (const n of NIVEAUX) {
      const ids = aptitudesAcquises(moine(n)).map((a) => a.id)
      for (const id of precedentes) expect(ids).toContain(id)
      precedentes = ids
    }
    expect(aptitudesAcquises(moine(1)).map((a) => a.id)).toEqual(['arts-martiaux', 'defense-sans-armure'])
    expect(aptitudesAcquises(moine(3)).map((a) => a.id)).toContain('technique-de-la-paume')
    expect(aptitudesAcquises(moine(20)).map((a) => a.id)).toContain('paume-vibratoire')
  })
})
