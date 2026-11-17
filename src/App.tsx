import { useCallback, useEffect, useState } from 'react'
import { chargerPack, definirRegles } from './regles/pack'
import type { Pack } from './regles/types'
import { incantationDe, sortsAccordes, sortsChoisis } from './regles/calculs'
import { reducteur, type Action, type Personnage } from './etat/personnage'
import { chargerTous, enregistrerTous } from './etat/stockage'
import { Perso } from './ecrans/Perso'
import { Combat } from './ecrans/Combat'
import { Sorts } from './ecrans/Sorts'
import { Sac } from './ecrans/Sac'
import { Carnet } from './ecrans/Carnet'
import { Encyclopedie } from './ecrans/Encyclopedie'
import { Creation } from './ecrans/Creation'
import { Personnages } from './ecrans/Personnages'
import { ImportPack } from './ecrans/ImportPack'
import { Icone } from './composants/Icone'

type IdOnglet = 'perso' | 'combat' | 'sorts' | 'sac' | 'carnet' | 'regles'
type Vue = 'onglets' | 'creation' | 'personnages' | 'pack'

const initial = chargerTous()

/** Un personnage dont la classe ou l'espèce manque au pack ne peut pas être affiché. */
function compatible(p: Personnage, pack: Pack) {
  return !!pack.classes[p.classe] && !!pack.especes[p.espece] && !!pack.historiques[p.historique]
}

export function App() {
  const [pack, setPack] = useState<Pack | null | undefined>(undefined)
  const [personnages, setPersonnages] = useState<Personnage[]>(initial.personnages)
  const [actif, setActif] = useState<string | null>(initial.actif)
  const [onglet, setOnglet] = useState<IdOnglet>('perso')
  const [vue, setVue] = useState<Vue>('onglets')

  useEffect(() => {
    chargerPack().then((p) => {
      if (p) definirRegles(p)
      setPack(p)
    })
  }, [])

  useEffect(() => {
    enregistrerTous(personnages, actif)
  }, [personnages, actif])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [onglet, vue, actif])

  const p = personnages.find((x) => x.id === actif) ?? null
  const dispatch = useCallback(
    (a: Action) => setPersonnages((liste) => liste.map((x) => (x.id === actif ? (reducteur(x, a) ?? x) : x))),
    [actif],
  )
  const installer = (nouveau: Pack) => {
    definirRegles(nouveau)
    setPack(nouveau)
    setVue('onglets')
  }

  if (pack === undefined) return <main className="ecran vide" aria-busy="true" />
  if (pack === null || vue === 'pack') return <ImportPack onPack={installer} onAnnuler={pack ? () => setVue('onglets') : undefined} />

  const utilisables = personnages.filter((x) => compatible(x, pack))
  if (vue === 'creation' || utilisables.length === 0) {
    return (
      <Creation
        onAnnuler={utilisables.length ? () => setVue('onglets') : undefined}
        onCreer={(nouveau) => {
          const cree = reducteur(null, { type: 'creer', personnage: nouveau })!
          setPersonnages((l) => [...l, cree])
          setActif(cree.id)
          setOnglet('perso')
          setVue('onglets')
        }}
      />
    )
  }

  if (vue === 'personnages' || !p || !compatible(p, pack)) {
    return (
      <Personnages
        personnages={utilisables}
        actif={actif}
        version={pack.meta.version}
        onChoisir={(id) => (setActif(id), setVue('onglets'))}
        onNouveau={() => setVue('creation')}
        onSupprimer={(id) => setPersonnages((l) => l.filter((x) => x.id !== id))}
        onImporter={(liste) => setPersonnages((l) => [...l.filter((x) => !liste.some((y) => y.id === x.id)), ...liste])}
        onChangerPack={() => setVue('pack')}
        onFermer={p && compatible(p, pack) ? () => setVue('onglets') : undefined}
      />
    )
  }

  const lanceur = !!incantationDe(p) || sortsAccordes(p).length > 0 || sortsChoisis(p).length > 0
  const onglets: { id: IdOnglet; nom: string }[] = [
    { id: 'perso', nom: 'Perso' },
    { id: 'combat', nom: 'Combat' },
    ...(lanceur ? [{ id: 'sorts' as const, nom: 'Sorts' }] : []),
    { id: 'sac', nom: 'Sac' },
    { id: 'carnet', nom: 'Carnet' },
    { id: 'regles', nom: 'Règles' },
  ]
  const courant = onglet === 'sorts' && !lanceur ? 'perso' : onglet

  return (
    <>
      {courant === 'perso' && <Perso p={p} dispatch={dispatch} onPersonnages={() => setVue('personnages')} />}
      {courant === 'combat' && <Combat p={p} dispatch={dispatch} />}
      {courant === 'sorts' && <Sorts p={p} dispatch={dispatch} />}
      {courant === 'sac' && <Sac p={p} dispatch={dispatch} />}
      {courant === 'carnet' && <Carnet p={p} dispatch={dispatch} />}
      {courant === 'regles' && <Encyclopedie p={p} />}
      <nav className="barre" aria-label="Écrans" style={{ gridTemplateColumns: `repeat(${onglets.length}, 1fr)` }}>
        {onglets.map((o) => (
          <button key={o.id} className={o.id === courant ? 'actif' : ''} aria-current={o.id === courant ? 'page' : undefined} onClick={() => setOnglet(o.id)}>
            <Icone nom={o.id} taille={24} />
            <span>{o.nom}</span>
          </button>
        ))}
      </nav>
    </>
  )
}
