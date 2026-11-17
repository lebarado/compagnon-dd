import { useRef, useState } from 'react'
import { regles } from '../regles/pack'
import { Embleme } from '../composants/Icone'
import { exporter, importer } from '../etat/stockage'
import type { Personnage } from '../etat/personnage'
import { Feuille } from '../composants/Feuille'

interface Props {
  personnages: Personnage[]
  actif: string | null
  version: string
  onChoisir: (id: string) => void
  onNouveau: () => void
  onSupprimer: (id: string) => void
  onImporter: (liste: Personnage[]) => void
  onChangerPack: () => void
  onFermer?: () => void
}

export function Personnages({ personnages, actif, version, onChoisir, onNouveau, onSupprimer, onImporter, onChangerPack, onFermer }: Props) {
  const fichier = useRef<HTMLInputElement>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [aSupprimer, setASupprimer] = useState<Personnage | null>(null)

  const telecharger = () => {
    const url = URL.createObjectURL(exporter(personnages))
    const a = document.createElement('a')
    a.href = url
    a.download = `compagnon-dd-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="ecran saisie">
      <header className="tete">
        <h1>Personnages</h1>
        {onFermer && (
          <button className="bouton discret" onClick={onFermer}>
            Fermer
          </button>
        )}
      </header>
      <ul className="liste-choix">
        {personnages.map((p) => (
          <li key={p.id} className={p.id === actif ? 'choisi' : ''}>
            <button className="choix-principal avec-vignette" onClick={() => onChoisir(p.id)}>
              <Embleme classe={p.classe} espece={p.espece} taille={48} />
              <span className="choix-texte">
                <strong>{p.nom}</strong>
                <small>
                  {regles.especes[p.espece]?.nom ?? p.espece} · {regles.classes[p.classe]?.nom ?? p.classe} {p.niveau} · {p.pv} PV
                </small>
              </span>
            </button>
            <button className="lien-page" aria-label={`Supprimer ${p.nom}`} onClick={() => setASupprimer(p)}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button className="bouton principal large" onClick={onNouveau}>
        Nouveau personnage
      </button>
      <section className="bloc">
        <span className="etiquette">Sauvegarde</span>
        <p className="aide">Les personnages restent sur cet appareil. Exporte un fichier pour les garder à l'abri ou les passer sur un autre appareil.</p>
        <div className="ligne-boutons">
          <button className="bouton" disabled={!personnages.length} onClick={telecharger}>
            Exporter
          </button>
          <button className="bouton" onClick={() => fichier.current?.click()}>
            Importer
          </button>
        </div>
        <input
          ref={fichier}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            try {
              onImporter(await importer(f))
              setErreur(null)
            } catch (err) {
              setErreur((err as Error).message)
            }
          }}
        />
        {erreur && <p className="aide alerte-texte">{erreur}</p>}
      </section>
      <section className="bloc">
        <span className="etiquette">Règles</span>
        <p className="aide">Pack de règles version {version}.</p>
        <p className="aide">Icônes : game-icons.net (Lorc, Delapouite et al.), licence CC BY 3.0.</p>
        <button className="bouton discret" onClick={onChangerPack}>
          Charger un autre pack
        </button>
      </section>
      {aSupprimer && (
        <Feuille titre={`Supprimer ${aSupprimer.nom} ?`} onFermer={() => setASupprimer(null)}>
          <p>Le personnage et son carnet seront effacés de cet appareil. Exporte-le d'abord si tu veux le garder.</p>
          <div className="ligne-boutons">
            <button className="bouton" onClick={() => setASupprimer(null)}>
              Garder
            </button>
            <button
              className="bouton principal"
              onClick={() => {
                onSupprimer(aSupprimer.id)
                setASupprimer(null)
              }}
            >
              Supprimer
            </button>
          </div>
        </Feuille>
      )}
    </main>
  )
}
