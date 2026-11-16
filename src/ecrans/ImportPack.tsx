import { useRef, useState } from 'react'
import { importerPack } from '../regles/pack'
import type { Pack } from '../regles/types'

/** Premier lancement sur un appareil : on charge le pack de règles tiré du manuel (fichier privé). */
export function ImportPack({ onPack, onAnnuler }: { onPack: (p: Pack) => void; onAnnuler?: () => void }) {
  const fichier = useRef<HTMLInputElement>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  return (
    <main className="ecran saisie vide">
      <h1>Règles du manuel</h1>
      <p className="aide">
        L'app a besoin du fichier <strong>pack-manuel.json</strong>, généré à partir de ton Manuel des joueurs. Il reste sur ton appareil et fonctionne hors ligne.
      </p>
      <button className="bouton principal large" onClick={() => fichier.current?.click()}>
        Choisir le fichier
      </button>
      {onAnnuler && (
        <button className="bouton discret large" onClick={onAnnuler}>
          Annuler
        </button>
      )}
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
            onPack(await importerPack(f))
          } catch (err) {
            setErreur((err as Error).message)
          }
        }}
      />
      {erreur && <p className="aide alerte-texte">{erreur}</p>}
    </main>
  )
}
