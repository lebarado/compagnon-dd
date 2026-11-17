import { ICONES } from './icones-data'

export type NomIcone = keyof typeof ICONES

export function aIcone(nom: string): nom is NomIcone {
  return nom in ICONES
}

/** Icône décorative (game-icons.net, CC BY 3.0), à la couleur du texte. */
export function Icone({ nom, taille = 24, className = '' }: { nom: NomIcone; taille?: number; className?: string }) {
  return (
    <svg
      className={`icone ${className}`}
      width={taille}
      height={taille}
      viewBox="0 0 512 512"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: ICONES[nom] }}
    />
  )
}

/** Portrait générique : l'emblème de la classe dans un médaillon, l'espèce en petit. */
export function Embleme({ classe, espece, taille = 56 }: { classe: string; espece?: string; taille?: number }) {
  return (
    <span className="embleme" style={{ width: taille, height: taille }} aria-hidden="true">
      {aIcone(classe) ? <Icone nom={classe} taille={taille * 0.58} /> : <Icone nom="perso" taille={taille * 0.58} />}
      {espece && aIcone(espece) && (
        <span className="embleme-espece">
          <Icone nom={espece} taille={taille * 0.3} />
        </span>
      )}
    </span>
  )
}
