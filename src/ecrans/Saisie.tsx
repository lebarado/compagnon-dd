import { useState } from 'react'
import { CARACS, regles, type ChoixEquipement, type IdCarac } from '../regles/regles'
import { formatMod, modificateur, pvMax } from '../regles/calculs'
import type { Personnage } from '../etat/personnage'

interface Props {
  initial: Personnage
  mode: 'creation' | 'modification'
  onValider: (p: Personnage) => void
  onAnnuler?: () => void
}

function Pas({ valeur, min, max, onChange, label }: { valeur: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="pas">
      <button className="bouton rond" aria-label={`Diminuer ${label}`} disabled={valeur <= min} onClick={() => onChange(valeur - 1)}>
        −
      </button>
      <output aria-label={label}>{valeur}</output>
      <button className="bouton rond" aria-label={`Augmenter ${label}`} disabled={valeur >= max} onClick={() => onChange(valeur + 1)}>
        +
      </button>
    </div>
  )
}

function ChoixEquip({ titre, choix, valeur, onChange }: { titre: string; choix: ChoixEquipement[]; valeur: string; onChange: (id: string) => void }) {
  return (
    <fieldset className="bloc">
      <legend>{titre}</legend>
      {choix.map((c) => (
        <button key={c.id} className={`option ${valeur === c.id ? 'choisi' : ''}`} aria-pressed={valeur === c.id} onClick={() => onChange(c.id)}>
          <strong>{c.id}</strong>
          <span>{[...c.objets, `${c.po} po`].join(', ')}</span>
        </button>
      ))}
    </fieldset>
  )
}

export function Saisie({ initial, mode, onValider, onAnnuler }: Props) {
  const [p, setP] = useState(initial)
  const classe = regles.classes[p.classe]
  const historique = regles.historiques[p.historique]
  const { nombre, parmi } = classe.maitrises.competences
  const nomCompetence = (id: string) => regles.competences.liste.find((c) => c.id === id)?.nom ?? id
  const creation = mode === 'creation'

  const basculer = (id: string) => {
    const choisies = p.competencesClasse.includes(id)
      ? p.competencesClasse.filter((c) => c !== id)
      : p.competencesClasse.length < nombre
        ? [...p.competencesClasse, id]
        : p.competencesClasse
    setP({ ...p, competencesClasse: choisies })
  }

  const manque = nombre - p.competencesClasse.length
  const pret = p.nom.trim() !== '' && manque === 0

  return (
    <main className="ecran saisie">
      <header className="tete">
        <div>
          <h1>{creation ? 'Nouveau personnage' : 'Modifier'}</h1>
          <p className="sous-titre">
            {regles.especes[p.espece].nom} · {classe.nom} · {historique.nom}
          </p>
        </div>
        {onAnnuler && (
          <button className="bouton discret" onClick={onAnnuler}>
            Annuler
          </button>
        )}
      </header>

      <label className="bloc">
        <span className="etiquette">Nom</span>
        <input className="champ" value={p.nom} onChange={(e) => setP({ ...p, nom: e.target.value })} placeholder="Nom du personnage" autoComplete="off" />
      </label>

      <fieldset className="bloc">
        <legend>Caractéristiques</legend>
        <p className="aide">
          Valeurs finales, bonus d'historique inclus ({historique.caracteristiques.map((c) => regles.caracteristiques.liste.find((x) => x.id === c)?.nom).join(', ')}).
        </p>
        {CARACS.map((id: IdCarac) => {
          const c = regles.caracteristiques.liste.find((x) => x.id === id)!
          return (
            <div className="ligne-carac" key={id}>
              <span className="nom">{c.nom}</span>
              <span className="mod">{formatMod(modificateur(p.caracs[id]))}</span>
              <Pas label={c.nom} valeur={p.caracs[id]} min={1} max={creation ? 20 : 30} onChange={(v) => setP({ ...p, caracs: { ...p.caracs, [id]: v } })} />
            </div>
          )
        })}
      </fieldset>

      <fieldset className="bloc">
        <legend>
          Compétences de {classe.nom} <span className="aide">({manque > 0 ? `encore ${manque}` : 'complet'})</span>
        </legend>
        <div className="puces">
          {parmi.map((id) => {
            const dejaHistorique = historique.competences.includes(id)
            const choisie = p.competencesClasse.includes(id)
            return (
              <button key={id} className={`puce ${choisie ? 'choisi' : ''}`} aria-pressed={choisie} disabled={dejaHistorique || (!choisie && manque === 0)} onClick={() => basculer(id)}>
                {nomCompetence(id)}
              </button>
            )
          })}
        </div>
        <p className="aide">
          {historique.nom} donne déjà : {historique.competences.map(nomCompetence).join(', ')}.
        </p>
      </fieldset>

      {creation && (
        <>
          <ChoixEquip titre={`Équipement de ${classe.nom} (p. ${classe.equipementDepart.page})`} choix={classe.equipementDepart.choix} valeur={p.equipementDepart.classe} onChange={(id) => setP({ ...p, equipementDepart: { ...p.equipementDepart, classe: id } })} />
          <ChoixEquip titre={`Équipement de ${historique.nom} (p. ${historique.page})`} choix={historique.equipement.choix} valeur={p.equipementDepart.historique} onChange={(id) => setP({ ...p, equipementDepart: { ...p.equipementDepart, historique: id } })} />
        </>
      )}

      {!creation && (
        <fieldset className="bloc">
          <legend>Niveau et points de vie</legend>
          <div className="ligne-carac">
            <span className="nom">Niveau</span>
            <span className="mod" />
            <Pas label="Niveau" valeur={p.niveau} min={1} max={regles.progression.niveauMax} onChange={(v) => setP({ ...p, niveau: v })} />
          </div>
          <div className="ligne-carac">
            <span className="nom">Ajustement PV max</span>
            <span className="mod">{pvMax(p)}</span>
            <Pas label="Ajustement PV max" valeur={p.ajustementPvMax} min={-99} max={99} onChange={(v) => setP({ ...p, ajustementPvMax: v })} />
          </div>
          <p className="aide">Réglage provisoire : le passage de niveau guidé arrive avec l'écran Repos. L'ajustement sert si tu lances tes dés de vie.</p>
        </fieldset>
      )}

      <button className="bouton principal large" disabled={!pret} onClick={() => onValider({ ...p, nom: p.nom.trim() })}>
        {creation ? 'Créer le personnage' : 'Enregistrer'}
      </button>
      {!pret && <p className="aide centre">{p.nom.trim() === '' ? 'Donne un nom au personnage.' : `Choisis encore ${manque} compétence${manque > 1 ? 's' : ''}.`}</p>}
    </main>
  )
}
