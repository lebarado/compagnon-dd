import { useState } from 'react'
import { CARACS, regles } from '../regles/pack'
import { competencesMaitrisees, donsAcquis, formatMod, modificateur, valeurCarac } from '../regles/calculs'
import { correspond, nomCarac, nomCompetence } from '../regles/noms'
import type { Choix, Regle } from '../regles/types'
import type { Personnage } from '../etat/personnage'
import { Feuille, FeuilleRegle, type Affichable } from '../composants/Feuille'
import { ChoixLangues } from '../composants/Langues'

interface Props {
  p: Personnage
  choix: Choix
  valeurs: string[]
  onChange: (valeurs: string[]) => void
}

/** Éditeur générique d'un choix (compétence, don, caractéristique, option, sort, texte libre). */
export function EditeurChoix({ p, choix, valeurs, onChange }: Props) {
  const [detail, setDetail] = useState<Affichable | null>(null)
  const [recherche, setRecherche] = useState('')
  const plein = valeurs.length >= choix.nombre
  const basculer = (id: string) => {
    if (valeurs.includes(id)) onChange(valeurs.filter((v) => v !== id))
    else if (choix.nombre === 1) onChange([id])
    else if (!plein) onChange([...valeurs, id])
  }

  const liste = (entrees: (Regle & { sous?: string })[]) => (
    <ul className="liste-choix">
      {entrees.map((e) => {
        const choisi = valeurs.includes(e.id)
        return (
          <li key={e.id} className={choisi ? 'choisi' : ''}>
            <button className="choix-principal" aria-pressed={choisi} disabled={!choisi && plein && choix.nombre > 1} onClick={() => basculer(e.id)}>
              <strong>{e.nom}</strong>
              <small>{e.sous ?? e.resume}</small>
            </button>
            <button className="lien-page" onClick={() => setDetail(e)}>
              p. {e.page}
            </button>
          </li>
        )
      })}
    </ul>
  )

  let corps
  switch (choix.type) {
    case 'competence':
    case 'expertise': {
      const dejaMaitrisees = competencesMaitrisees(p)
      const ids = choix.parmi ?? (choix.type === 'expertise' ? dejaMaitrisees : regles.competences.liste.map((c) => c.id))
      corps = (
        <ul className="liste-choix">
          {ids.map((id) => {
            const choisi = valeurs.includes(id)
            const inutile = choix.type === 'competence' && !choisi && dejaMaitrisees.includes(id)
            const c = regles.competences.liste.find((x) => x.id === id)
            return (
              <li key={id} className={choisi ? 'choisi' : inutile ? 'inclus' : ''}>
                <button className="choix-principal" aria-pressed={choisi} disabled={inutile || (!choisi && plein && choix.nombre > 1)} onClick={() => basculer(id)}>
                  <strong>
                    {choisi ? '✓ ' : ''}
                    {nomCompetence(id)} <span className="note">{c ? nomCarac(c.carac) : ''}</span>
                  </strong>
                  <small>{inutile ? 'Déjà maîtrisée' : (c?.usage ?? '')}</small>
                </button>
              </li>
            )
          })}
        </ul>
      )
      break
    }
    case 'don': {
      const pris = new Set(donsAcquis(p).map((d) => d.don.id))
      const dons = Object.entries(regles.dons)
        .filter(([id, d]) => (!choix.categories || choix.categories.includes(d.categorie)) && (d.niveauMin ?? 1) <= p.niveau && (d.repetable || !pris.has(id) || valeurs.includes(id)))
        .map(([id, d]) => ({ ...d, id, sous: [d.prerequis, d.resume].filter(Boolean).join(' · ') }))
        .filter((d) => correspond(`${d.nom} ${d.resume}`, recherche))
        .sort((a, b) => a.nom.localeCompare(b.nom))
      corps = (
        <>
          <input className="champ" placeholder="Rechercher un don" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          {liste(dons)}
        </>
      )
      break
    }
    case 'carac': {
      const compte = (c: string) => valeurs.filter((v) => v === c).length
      corps = (
        <div>
          {CARACS.filter((c) => !choix.parmi || choix.parmi.includes(c)).map((c) => {
            const avant = valeurCarac({ ...p, choix: {} }, c)
            const actuel = valeurCarac(p, c)
            return (
              <div className="ligne-carac" key={c}>
                <span className="nom">{nomCarac(c)}</span>
                <span className="mod">
                  {actuel} ({formatMod(modificateur(actuel))})
                </span>
                <div className="pas">
                  <button className="bouton rond" aria-label={`Retirer un point à ${nomCarac(c)}`} disabled={compte(c) === 0} onClick={() => onChange(valeurs.filter((v, i) => i !== valeurs.lastIndexOf(c) || v !== c))}>
                    −
                  </button>
                  <output>{compte(c) ? `+${compte(c)}` : '0'}</output>
                  <button className="bouton rond" aria-label={`Ajouter un point à ${nomCarac(c)}`} disabled={plein || avant + compte(c) >= (choix.max ?? 20)} onClick={() => onChange([...valeurs, c])}>
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )
      break
    }
    case 'option':
      corps = liste(choix.options ?? [])
      break
    case 'sort': {
      const sorts = Object.values(regles.sorts)
        .filter((s) => (choix.niveauSort === undefined || s.niveau === choix.niveauSort) && (!choix.liste || s.classes.includes(choix.liste)) && (!choix.parmi || choix.parmi.includes(s.id)))
        .filter((s) => correspond(s.nom, recherche))
        .map((s) => ({ ...s, sous: `${s.niveau === 0 ? 'Sort mineur' : `Niveau ${s.niveau}`} · ${s.resume}` }))
        .sort((a, b) => a.nom.localeCompare(b.nom))
      corps = (
        <>
          <input className="champ" placeholder="Rechercher un sort" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          {sorts.length ? liste(sorts) : <p className="aide">Aucun sort de cette liste dans le pack pour l'instant.</p>}
        </>
      )
      break
    }
    case 'langue':
      if (regles.langues) {
        corps = <ChoixLangues valeurs={valeurs} max={choix.nombre} rares onChange={onChange} />
        break
      }
      corps = <TexteLibre valeurs={valeurs} nombre={choix.nombre} onChange={onChange} />
      break
    default:
      corps = <TexteLibre valeurs={valeurs} nombre={choix.nombre} onChange={onChange} />
  }

  return (
    <div className="editeur-choix">
      <p className="aide">
        {valeurs.length} / {choix.nombre} choisi{choix.nombre > 1 ? 's' : ''}
      </p>
      {corps}
      {detail && <FeuilleRegle regle={detail} onFermer={() => setDetail(null)} />}
    </div>
  )
}

function TexteLibre({ valeurs, nombre, onChange }: { valeurs: string[]; nombre: number; onChange: (v: string[]) => void }) {
  const [saisie, setSaisie] = useState('')
  return (
    <>
      <div className="puces">
        {valeurs.map((v) => (
          <button key={v} className="puce choisi" onClick={() => onChange(valeurs.filter((x) => x !== v))}>
            {v} ✕
          </button>
        ))}
      </div>
      {valeurs.length < nombre && (
        <form
          className="ligne-saisie"
          onSubmit={(e) => {
            e.preventDefault()
            if (saisie.trim()) onChange([...valeurs, saisie.trim()])
            setSaisie('')
          }}
        >
          <input className="champ" value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder="Saisir" />
          <button className="bouton">Ajouter</button>
        </form>
      )}
    </>
  )
}

/** Feuille listant les choix en attente d'un personnage, chacun éditable. */
export function FeuilleChoix({
  p,
  enAttente,
  onChoix,
  onFermer,
}: {
  p: Personnage
  enAttente: { cle: string; choix: Choix; source: { regle: Regle } }[]
  onChoix: (cle: string, valeurs: string[]) => void
  onFermer: () => void
}) {
  const [ouvert, setOuvert] = useState(0)
  const courant = enAttente[Math.min(ouvert, enAttente.length - 1)]
  if (!courant) {
    return (
      <Feuille titre="Choix" onFermer={onFermer}>
        <p className="aide">Tous les choix sont faits.</p>
      </Feuille>
    )
  }
  return (
    <Feuille titre={`${courant.source.regle.nom} : ${courant.choix.nom}`} onFermer={onFermer}>
      {enAttente.length > 1 && (
        <div className="puces">
          {enAttente.map((c, i) => (
            <button key={c.cle} className={`puce ${i === ouvert ? 'choisi' : ''}`} onClick={() => setOuvert(i)}>
              {c.choix.nom}
            </button>
          ))}
        </div>
      )}
      <EditeurChoix p={p} choix={courant.choix} valeurs={p.choix[courant.cle] ?? []} onChange={(v) => onChoix(courant.cle, v)} />
    </Feuille>
  )
}
