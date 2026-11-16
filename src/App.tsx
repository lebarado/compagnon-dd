import { useEffect, useReducer, useState } from 'react'
import { personnageVierge, reducteur } from './etat/personnage'
import { charger, enregistrer } from './etat/stockage'
import { Perso } from './ecrans/Perso'
import { Saisie } from './ecrans/Saisie'

const ONGLETS = [
  { id: 'perso', nom: 'Perso' },
  { id: 'combat', nom: 'Combat', etape: 3 },
  { id: 'inventaire', nom: 'Inventaire', etape: 4 },
  { id: 'repos', nom: 'Repos', etape: 5 },
  { id: 'carnet', nom: 'Carnet', etape: 6 },
] as const

type IdOnglet = (typeof ONGLETS)[number]['id']

export function App() {
  const [p, dispatch] = useReducer(reducteur, null, () => charger())
  const [onglet, setOnglet] = useState<IdOnglet>('perso')
  const [edition, setEdition] = useState(false)

  useEffect(() => {
    if (p) enregistrer(p)
  }, [p])

  // Chaque changement d'écran repart du haut : les PV sont toujours la première chose visible.
  const existe = p !== null
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [onglet, edition, existe])

  if (!p) return <Saisie mode="creation" initial={personnageVierge()} onValider={(personnage) => dispatch({ type: 'creer', personnage })} />

  if (edition) {
    return (
      <Saisie
        mode="modification"
        initial={p}
        onAnnuler={() => setEdition(false)}
        onValider={(personnage) => {
          dispatch({ type: 'modifier', personnage })
          setEdition(false)
        }}
      />
    )
  }

  const actif = ONGLETS.find((o) => o.id === onglet)!

  return (
    <>
      {onglet === 'perso' ? (
        <Perso p={p} dispatch={dispatch} onModifier={() => setEdition(true)} />
      ) : (
        <main className="ecran vide">
          <h1>{actif.nom}</h1>
          <p className="aide">Cet écran arrive à l'étape {'etape' in actif ? actif.etape : ''}.</p>
        </main>
      )}
      <nav className="barre" aria-label="Écrans">
        {ONGLETS.map((o) => (
          <button key={o.id} className={o.id === onglet ? 'actif' : ''} aria-current={o.id === onglet ? 'page' : undefined} onClick={() => setOnglet(o.id)}>
            {o.nom}
          </button>
        ))}
      </nav>
    </>
  )
}
