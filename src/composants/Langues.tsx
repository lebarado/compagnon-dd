import { regles } from '../regles/pack'
import type { Personnage } from '../etat/personnage'

/** Nom d'une langue du pack, ou le texte tel quel (saisie libre d'une ancienne version). */
export function nomLangue(id: string): string {
  const l = regles.langues
  return [...(l?.courantes ?? []), ...(l?.rares ?? [])].find((x) => x.id === id)?.nom ?? id
}

/** Langues connues : Commun, choix de création, puis langues données par des aptitudes (choix de type « langue »). */
export function languesConnues(p: Personnage): string[] {
  const depuisChoix = Object.entries(p.choix)
    .filter(([cle]) => /langue/.test(cle))
    .flatMap(([, v]) => v)
  return [...new Set(['commun', ...p.langues, ...depuisChoix])].map(nomLangue)
}

/** Choix de langues (p. 37) : courantes, et rares si une aptitude le permet. Le Commun est acquis. */
export function ChoixLangues({ valeurs, max, rares, onChange }: { valeurs: string[]; max?: number; rares: boolean; onChange: (v: string[]) => void }) {
  const l = regles.langues
  if (!l) return null
  const liste = [...l.courantes, ...(rares ? l.rares : [])].filter((x) => x.id !== 'commun')
  const plein = max !== undefined && valeurs.length >= max
  return (
    <div className="puces">
      {liste.map((x) => {
        const choisi = valeurs.includes(x.id)
        return (
          <button
            key={x.id}
            className={`puce ${choisi ? 'choisi' : ''}`}
            aria-pressed={choisi}
            disabled={!choisi && plein && max !== 1}
            onClick={() => onChange(choisi ? valeurs.filter((v) => v !== x.id) : max === 1 ? [x.id] : [...valeurs, x.id])}
          >
            {x.nom}
          </button>
        )
      })}
    </div>
  )
}
