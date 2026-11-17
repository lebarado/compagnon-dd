import { useState, type Dispatch } from 'react'
import { regles } from '../regles/pack'
import { nouvelId, type Action, type CartePublique, type Coequipier, type Personnage } from '../etat/personnage'
import { derniereSession, normaliserCode } from '../etat/session'
import type { ControleSession } from '../etat/useSession'
import { Feuille } from '../composants/Feuille'
import { Embleme, Icone } from '../composants/Icone'

const SANTE: Record<CartePublique['sante'], string> = { indemne: 'Indemne', blesse: 'Blessé', grave: 'Gravement blessé', zero: '0 PV' }

function resume(c: Coequipier): string {
  if (!c.carte) return c.description || 'Ajouté à la main'
  const k = c.carte
  return `${regles.especes[k.espece]?.nom ?? k.espece} · ${regles.classes[k.classe]?.nom ?? k.classe} ${k.niveau}`
}

/** Fiche d'un coéquipier : ce qu'on sait de lui et mes notes. */
function FeuilleCoequipier({ c, enLigne, onEnregistrer, onSupprimer, onFermer }: { c: Coequipier; enLigne: boolean; onEnregistrer: (c: Coequipier) => void; onSupprimer?: () => void; onFermer: () => void }) {
  const [x, setX] = useState(c)
  const fermer = () => {
    if (x.nom.trim()) onEnregistrer({ ...x, nom: x.nom.trim() })
    onFermer()
  }
  const k = x.carte
  return (
    <Feuille titre={c.nom || 'Nouveau coéquipier'} onFermer={fermer}>
      {k ? (
        <div className="coequipier">
          <Embleme classe={k.classe} espece={k.espece} taille={52} />
          <span className="choix-texte">
            <strong>{k.nom}</strong>
            <small>
              {resume(x)} · {enLigne ? 'en session' : `vu le ${new Date(x.vu ?? '').toLocaleDateString('fr-FR')}`}
            </small>
          </span>
        </div>
      ) : (
        <>
          <input className="champ" placeholder="Nom" value={x.nom} onChange={(e) => setX({ ...x, nom: e.target.value })} />
          <input className="champ" placeholder="Espèce, classe… (ce que tu sais)" value={x.description} onChange={(e) => setX({ ...x, description: e.target.value })} />
        </>
      )}
      {k && (
        <div className="puces">
          <span className={`sante ${k.sante}`}>{SANTE[k.sante]}</span>
          {k.etats.map((id) => (
            <span key={id} className="puce alerte-bord">
              {regles.etats.find((e) => e.id === id)?.nom ?? id}
            </span>
          ))}
          {k.concentration && <span className="puce">Concentration : {k.concentration}</span>}
        </div>
      )}
      <textarea
        className="champ zone-notes"
        placeholder="Mes notes : ce qu'il sait faire, ses secrets connus, ce qu'on se doit…"
        value={x.notes}
        onChange={(e) => setX({ ...x, notes: e.target.value })}
        rows={8}
      />
      <p className="aide">Ces notes restent sur ton téléphone : elles ne sont jamais envoyées.</p>
      <div className="ligne-boutons">
        {onSupprimer && (
          <button
            className="bouton"
            onClick={() => {
              onSupprimer()
              onFermer()
            }}
          >
            Retirer
          </button>
        )}
        <button className="bouton principal" onClick={fermer}>
          Enregistrer
        </button>
      </div>
    </Feuille>
  )
}

function BlocSession({ s }: { s: ControleSession }) {
  const [saisie, setSaisie] = useState('')
  const [rejoindre, setRejoindre] = useState(false)
  const e = s.etat
  const derniere = derniereSession()

  if (e.statut === 'connecte' || e.statut === 'connexion')
    return (
      <section className="bloc">
        <span className="etiquette">{e.hote ? 'Ta session · donne ce code aux autres' : 'Session rejointe'}</span>
        <output className="code-session">{e.code}</output>
        <p className="aide centre">
          {e.statut === 'connexion' ? 'Connexion…' : `${e.membres} joueur${e.membres > 1 ? 's' : ''} connecté${e.membres > 1 ? 's' : ''}`}
          {e.hote && e.statut === 'connecte' && ' · garde l’app ouverte : la session vit sur ce téléphone'}
        </p>
        <button className="bouton discret large" onClick={s.quitter}>
          Quitter la session
        </button>
      </section>
    )

  return (
    <section className="bloc">
      <span className="etiquette">
        <Icone nom="combat" taille={14} /> Session de groupe
      </span>
      {e.statut === 'erreur' && <p className="alerte-texte">{e.erreur}</p>}
      {derniere && (
        <button className="bouton principal large" onClick={() => s.reprendre(derniere.code, derniere.hote)}>
          Reprendre la session {derniere.code}
        </button>
      )}
      {rejoindre ? (
        <div className="ligne-boutons">
          <input
            className="champ"
            placeholder="Code"
            autoFocus
            inputMode="text"
            autoCapitalize="characters"
            value={saisie}
            onChange={(ev) => setSaisie(normaliserCode(ev.target.value))}
            aria-label="Code de session à 4 caractères"
          />
          <button className="bouton principal" disabled={saisie.length !== 4} onClick={() => s.rejoindre(saisie)}>
            Rejoindre
          </button>
        </div>
      ) : (
        <div className="ligne-boutons">
          <button className="bouton" onClick={s.creer}>
            Créer
          </button>
          <button className="bouton" onClick={() => setRejoindre(true)}>
            Rejoindre
          </button>
        </div>
      )}
      <p className="aide">Les autres voient ton nom, ton espèce, ta classe, ton niveau, ton état de santé (sans les PV) et tes états. Rien d’autre.</p>
    </section>
  )
}

export function Groupe({ p, dispatch, session }: { p: Personnage; dispatch: Dispatch<Action>; session: ControleSession }) {
  const [edition, setEdition] = useState<Coequipier | null>(null)
  const connecte = session.etat.statut === 'connecte'
  return (
    <>
      <BlocSession s={session} />
      <ul className="liste-choix">
        {p.equipe.map((c) => (
          <li key={c.id}>
            <button className="choix-principal avec-vignette" onClick={() => setEdition(c)}>
              {c.carte ? (
                <Embleme classe={c.carte.classe} espece={c.carte.espece} taille={44} />
              ) : (
                <span className="vignette">
                  <Icone nom="perso" taille={26} />
                </span>
              )}
              <span className="choix-texte">
                <strong>
                  {c.nom} {c.carte && <span className={`sante ${c.carte.sante}`}>{SANTE[c.carte.sante]}</span>}
                </strong>
                <small>
                  {resume(c)}
                  {c.carte?.etats.length ? ` · ${c.carte.etats.map((id) => regles.etats.find((e) => e.id === id)?.nom ?? id).join(', ')}` : ''}
                  {c.notes ? ` · ${c.notes.slice(0, 50)}` : ''}
                </small>
              </span>
            </button>
          </li>
        ))}
        {p.equipe.length === 0 && <li className="aide centre">Aucun coéquipier pour l’instant.</li>}
      </ul>
      <button className="bouton large" onClick={() => setEdition({ id: nouvelId(), nom: '', description: '', notes: '' })}>
        Ajouter un coéquipier à la main
      </button>
      {edition && (
        <FeuilleCoequipier
          c={edition}
          enLigne={connecte && !!edition.carte}
          onEnregistrer={(coequipier) => dispatch({ type: 'coequipier', coequipier })}
          onSupprimer={p.equipe.some((x) => x.id === edition.id) ? () => dispatch({ type: 'retirerCoequipier', id: edition.id }) : undefined}
          onFermer={() => setEdition(null)}
        />
      )}
    </>
  )
}
