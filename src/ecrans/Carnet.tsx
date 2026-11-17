import { useState, type Dispatch } from 'react'
import { correspond } from '../regles/noms'
import { nouvelId, type Action, type Note, type Personnage } from '../etat/personnage'
import { Feuille } from '../composants/Feuille'
import { Icone } from '../composants/Icone'
import type { ControleSession } from '../etat/useSession'
import { Groupe } from './Groupe'

const CATEGORIES: { id: Note['categorie']; nom: string }[] = [
  { id: 'session', nom: 'Sessions' },
  { id: 'pnj', nom: 'PNJ' },
  { id: 'lieu', nom: 'Lieux' },
  { id: 'quete', nom: 'Quêtes' },
  { id: 'autre', nom: 'Divers' },
]

function Editeur({ note, onEnregistrer, onSupprimer, onFermer }: { note: Note; onEnregistrer: (n: Note) => void; onSupprimer?: () => void; onFermer: () => void }) {
  const [n, setN] = useState(note)
  const fermer = () => {
    if (n.titre.trim() || n.texte.trim()) onEnregistrer({ ...n, titre: n.titre.trim() || n.texte.trim().split('\n')[0].slice(0, 40) })
    onFermer()
  }
  return (
    <Feuille titre={note.titre || 'Nouvelle note'} onFermer={fermer}>
      <div className="puces">
        {CATEGORIES.map((c) => (
          <button key={c.id} className={`puce ${n.categorie === c.id ? 'choisi' : ''}`} onClick={() => setN({ ...n, categorie: c.id })}>
            {c.nom}
          </button>
        ))}
      </div>
      <input className="champ" placeholder="Titre" value={n.titre} onChange={(e) => setN({ ...n, titre: e.target.value })} />
      <textarea className="champ zone" placeholder="Notes…" value={n.texte} onChange={(e) => setN({ ...n, texte: e.target.value })} rows={10} />
      <div className="ligne-boutons">
        {onSupprimer && (
          <button
            className="bouton"
            onClick={() => {
              onSupprimer()
              onFermer()
            }}
          >
            Supprimer
          </button>
        )}
        <button className="bouton principal" onClick={fermer}>
          Enregistrer
        </button>
      </div>
    </Feuille>
  )
}

export function Carnet({ p, dispatch, session }: { p: Personnage; dispatch: Dispatch<Action>; session: ControleSession }) {
  const [vue, setVue] = useState<'notes' | 'groupe'>(session.etat.statut === 'connecte' ? 'groupe' : 'notes')
  const [filtre, setFiltre] = useState<Note['categorie'] | null>(null)
  const [recherche, setRecherche] = useState('')
  const [edition, setEdition] = useState<Note | null>(null)
  const notes = p.notes.filter((n) => (!filtre || n.categorie === filtre) && correspond(`${n.titre} ${n.texte}`, recherche))

  const onglets = (
    <div className="onglets-carnet" role="tablist">
      {(
        [
          ['notes', 'Notes', 'note'],
          ['groupe', `Groupe${p.equipe.length ? ` · ${p.equipe.length}` : ''}`, 'perso'],
        ] as const
      ).map(([id, nom, icone]) => (
        <button key={id} role="tab" aria-selected={vue === id} className={`puce ${vue === id ? 'choisi' : ''}`} onClick={() => setVue(id)}>
          <Icone nom={icone} taille={18} /> {nom}
          {id === 'groupe' && session.etat.statut === 'connecte' && <span className="point-direct" aria-label="session en cours" />}
        </button>
      ))}
    </div>
  )

  if (vue === 'groupe')
    return (
      <main className="ecran">
        <header className="tete">
          <h1>Carnet</h1>
        </header>
        {onglets}
        <Groupe p={p} dispatch={dispatch} session={session} />
      </main>
    )

  return (
    <main className="ecran">
      <header className="tete">
        <h1>Carnet</h1>
        <button
          className="bouton principal"
          onClick={() => setEdition({ id: nouvelId(), categorie: filtre ?? 'session', titre: '', texte: '', date: new Date().toISOString().slice(0, 10) })}
        >
          Nouvelle note
        </button>
      </header>
      {onglets}
      <input className="champ" placeholder="Rechercher dans le carnet" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      <div className="puces">
        {CATEGORIES.map((c) => (
          <button key={c.id} className={`puce ${filtre === c.id ? 'choisi' : ''}`} onClick={() => setFiltre(filtre === c.id ? null : c.id)}>
            {c.nom} {p.notes.filter((n) => n.categorie === c.id).length || ''}
          </button>
        ))}
      </div>
      <ul className="liste-notes">
        {notes.map((n) => (
          <li key={n.id}>
            <button className="ligne-regle" onClick={() => setEdition(n)}>
              <span>
                <strong>{n.titre}</strong>
                <small>{n.texte.slice(0, 90) || ' '}</small>
              </span>
              <span className="note">{n.date.split('-').reverse().slice(0, 2).join('/')}</span>
            </button>
          </li>
        ))}
        {notes.length === 0 && <li className="aide centre">{p.notes.length ? 'Aucune note ne correspond.' : 'Le carnet est vide.'}</li>}
      </ul>
      {edition && (
        <Editeur
          note={edition}
          onEnregistrer={(note) => dispatch({ type: 'note', note })}
          onSupprimer={p.notes.some((n) => n.id === edition.id) ? () => dispatch({ type: 'retirerNote', id: edition.id }) : undefined}
          onFermer={() => setEdition(null)}
        />
      )}
    </main>
  )
}
