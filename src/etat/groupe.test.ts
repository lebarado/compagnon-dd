import { beforeAll, describe, expect, it } from 'vitest'
import { reducteur, type Personnage } from './personnage'
import { carteDe } from './session'
import { completer } from './stockage'
import { pvMax } from '../regles/calculs'
import { chargerPackTest, moine as moineBase, packPresent } from '../test/pack'

const moine = (s: Partial<Personnage> = {}) => {
  const p = moineBase(1, s)
  return { ...p, pv: s.pv ?? pvMax(p) }
}
const r = (p: Personnage, ...actions: Parameters<typeof reducteur>[1][]) => actions.reduce<Personnage | null>(reducteur, p)!

describe.skipIf(!packPresent)('partie : concentration, rounds, groupe', () => {
  beforeAll(() => {
    chargerPackTest()
  })

  it('un sort à Concentration remplace le précédent ; annuler rend le précédent (p. 364)', () => {
    const conc = (id: string) => ({ type: 'utiliser' as const, place: 'action' as const, demande: { id, nom: id, concentration: id } })
    const p = r(moine({ concentration: { id: 'a', nom: 'a' } }), conc('b'))
    expect(p.concentration?.nom).toBe('b')
    expect(r(p, { type: 'annuler', place: 'action' }).concentration?.nom).toBe('a')
  })

  it('Neutralisé ou 0 PV mettent fin à la Concentration', () => {
    const p = moine({ concentration: { id: 'a', nom: 'a' } })
    expect(r(p, { type: 'etat', id: 'neutralise' }).concentration).toBeNull()
    expect(r(p, { type: 'degats', montant: 999 }).concentration).toBeNull()
    expect(r(p, { type: 'degats', montant: 1 }).concentration?.nom).toBe('a')
  })

  it('le round avance à chaque début de mon tour et revient à 0 en fin de combat', () => {
    const p = r(moine(), { type: 'phase', phase: 'attente' }, { type: 'phase', phase: 'tour' }, { type: 'phase', phase: 'attente' }, { type: 'phase', phase: 'tour' })
    expect(p.combat.round).toBe(2)
    expect(r(p, { type: 'phase', phase: 'hors' }).combat.round).toBe(0)
  })

  it('la carte publique ne montre ni PV ni chiffres de la fiche', () => {
    const max = pvMax(moine())
    const carte = carteDe(moine({ pv: Math.floor(max / 2) }))
    expect(carte.sante).toBe('grave')
    expect(Object.keys(carte).sort()).toEqual(['classe', 'concentration', 'espece', 'etats', 'id', 'niveau', 'nom', 'sante'])
    expect(carteDe(moine({ pv: 0 })).sante).toBe('zero')
    expect(carteDe(moine()).sante).toBe('indemne')
  })

  it('les cartes reçues créent ou mettent à jour les coéquipiers, sans toucher mes notes ni me compter', () => {
    const p = moine()
    const autre = { ...carteDe(moine()), id: 'x', nom: 'Bryn' }
    let q = r(p, { type: 'cartes', cartes: [carteDe(p), autre] })
    expect(q.equipe.map((c) => c.nom)).toEqual(['Bryn'])
    q = r(q, { type: 'coequipier', coequipier: { ...q.equipe[0], notes: 'Doit 5 po' } })
    q = r(q, { type: 'cartes', cartes: [{ ...autre, sante: 'blesse' }] })
    expect(q.equipe[0]).toMatchObject({ notes: 'Doit 5 po', carte: { sante: 'blesse' } })
  })

  it('une ancienne sauvegarde gagne langues, concentration et équipe vides', () => {
    const { langues, concentration, equipe, ...ancien } = moine()
    void langues
    void concentration
    void equipe
    const p = completer(ancien as unknown as Record<string, unknown>)!
    expect(p).toMatchObject({ langues: [], concentration: null, equipe: [] })
  })
})
