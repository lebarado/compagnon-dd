import { useState, type Dispatch } from 'react'
import { armeDe, armureDe, attaqueArme, formatMod } from '../regles/calculs'
import { entreeDe, poidsTotal, toutEquipement, type Entree } from '../regles/equipement'
import { correspond } from '../regles/noms'
import { nouvelId, type Action, type ObjetInventaire, type Personnage, type Pieces } from '../etat/personnage'
import { Feuille, FeuilleRegle, Pave, type Affichable } from '../composants/Feuille'

const PIECES: { id: keyof Pieces; nom: string }[] = [
  { id: 'pp', nom: 'pp' },
  { id: 'po', nom: 'po' },
  { id: 'pe', nom: 'pe' },
  { id: 'pa', nom: 'pa' },
  { id: 'pc', nom: 'pc' },
]

function description(x: Entree): Affichable {
  if (x.genre === 'arme') {
    const a = x.e
    return {
      nom: a.nom,
      page: a.page,
      resume: `${a.degats} ${a.typeDegats}`,
      detail: [`Arme ${a.categorie === 'courante' ? 'courante' : 'de guerre'}, ${a.portee === 'distance' ? 'à distance' : 'de corps à corps'}`, `Dégâts : ${a.degats} ${a.typeDegats}`, `Propriétés : ${a.proprietes.join(', ') || '—'}`, `Botte : ${a.botte}`, `${a.poids} kg · ${a.prix}`],
    }
  }
  if (x.genre === 'armure') {
    const a = x.e
    const dex = a.dexMax === null ? '' : a.dexMax !== undefined ? ` + Dex (max ${a.dexMax})` : a.categorie === 'bouclier' ? '' : ' + Dex'
    return {
      nom: a.nom,
      page: a.page,
      resume: a.categorie === 'bouclier' ? `+${a.ca} CA` : `CA ${a.ca}${dex}`,
      detail: [a.categorie === 'bouclier' ? `+${a.ca} à la CA` : `CA ${a.ca}${dex}`, a.force ? `Force ${a.force} requise` : '', a.discretion ? 'Désavantage en Discrétion' : '', `${a.poids} kg · ${a.prix}`].filter(Boolean),
    }
  }
  return { nom: x.e.nom, page: x.e.page, resume: x.e.resume ?? '', detail: [x.e.resume ?? '', [x.e.poids ? `${x.e.poids} kg` : '', x.e.prix ?? ''].filter(Boolean).join(' · ')].filter(Boolean) }
}

function FeuilleAjout({ onAjouter, onFermer }: { onAjouter: (o: ObjetInventaire) => void; onFermer: () => void }) {
  const [recherche, setRecherche] = useState('')
  const resultats = recherche.trim() ? toutEquipement().filter((x) => correspond(x.e.nom, recherche)).slice(0, 40) : []
  return (
    <Feuille titre="Ajouter" onFermer={onFermer}>
      <input className="champ" autoFocus placeholder="Arme, armure, objet…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      <ul className="liste-choix">
        {resultats.map((x) => (
          <li key={x.e.id}>
            <button
              className="choix-principal"
              onClick={() => {
                onAjouter({ uid: nouvelId(), ref: x.e.id, nom: x.e.nom, quantite: 1, poids: x.e.poids })
                onFermer()
              }}
            >
              <strong>{x.e.nom}</strong>
              <small>{description(x).resume}</small>
            </button>
          </li>
        ))}
        {recherche.trim() && (
          <li>
            <button
              className="choix-principal"
              onClick={() => {
                onAjouter({ uid: nouvelId(), nom: recherche.trim(), quantite: 1 })
                onFermer()
              }}
            >
              <strong>+ « {recherche.trim()} »</strong>
              <small>Objet libre</small>
            </button>
          </li>
        )}
      </ul>
    </Feuille>
  )
}

export function Sac({ p, dispatch }: { p: Personnage; dispatch: Dispatch<Action> }) {
  const [ajout, setAjout] = useState(false)
  const [piece, setPiece] = useState<keyof Pieces | null>(null)
  const [ouvert, setOuvert] = useState<ObjetInventaire | null>(null)
  const [poids, setPoids] = useState(false)
  const maj = (o: ObjetInventaire) => dispatch({ type: 'objet', objet: o })

  return (
    <main className="ecran">
      <header className="tete">
        <h1>Sac</h1>
        <button className="bouton principal" onClick={() => setAjout(true)}>
          Ajouter
        </button>
      </header>

      <section className="bandeau pieces">
        {PIECES.map((x) => (
          <button key={x.id} onClick={() => setPiece(x.id)} aria-label={`${p.pieces[x.id]} ${x.nom}, modifier`}>
            <span className="etiquette">{x.nom}</span>
            <strong>{p.pieces[x.id]}</strong>
          </button>
        ))}
      </section>

      <ul className="inventaire">
        {p.inventaire.map((o) => {
          const arme = armeDe(o.ref)
          const armure = armureDe(o.ref)
          const att = arme ? attaqueArme(p, arme) : null
          return (
            <li key={o.uid} className={o.equipe ? 'equipe' : ''}>
              <button className="objet-nom" onClick={() => setOuvert(o)}>
                <strong>{o.nom}</strong>
                {att && (
                  <small>
                    {formatMod(att.toucher)} · {att.degats} {arme!.typeDegats}
                    {!att.maitrise && ' · non maîtrisée'}
                  </small>
                )}
                {armure && <small>{description({ genre: 'armure', e: armure }).resume}</small>}
                {o.note && <small>{o.note}</small>}
              </button>
              {(arme || armure) && (
                <button className={`puce ${o.equipe ? 'choisi' : ''}`} aria-pressed={!!o.equipe} onClick={() => maj({ ...o, equipe: !o.equipe })}>
                  {o.equipe ? 'Équipé' : 'Équiper'}
                </button>
              )}
              <div className="pas">
                <button className="bouton rond" aria-label={`Retirer un ${o.nom}`} onClick={() => (o.quantite > 1 ? maj({ ...o, quantite: o.quantite - 1 }) : dispatch({ type: 'retirerObjet', uid: o.uid }))}>
                  −
                </button>
                <output>{o.quantite}</output>
                <button className="bouton rond" aria-label={`Ajouter un ${o.nom}`} onClick={() => maj({ ...o, quantite: o.quantite + 1 })}>
                  +
                </button>
              </div>
            </li>
          )
        })}
        {p.inventaire.length === 0 && <li className="aide centre">Sac vide.</li>}
      </ul>

      <button className="bouton discret large" onClick={() => setPoids(!poids)}>
        {poids ? `Poids total : ${String(poidsTotal(p.inventaire)).replace('.', ',')} kg` : 'Afficher le poids'}
      </button>

      {ajout && <FeuilleAjout onAjouter={maj} onFermer={() => setAjout(false)} />}
      {piece && (
        <Pave
          titre={`Pièces : ${piece}`}
          onFermer={() => setPiece(null)}
          actions={[
            { nom: 'Retirer', onValider: (n) => dispatch({ type: 'pieces', pieces: { ...p.pieces, [piece]: Math.max(0, p.pieces[piece] - n) } }) },
            { nom: 'Ajouter', classe: 'dispo', onValider: (n) => dispatch({ type: 'pieces', pieces: { ...p.pieces, [piece]: p.pieces[piece] + n } }) },
            { nom: 'Fixer', zeroAutorise: true, onValider: (n) => dispatch({ type: 'pieces', pieces: { ...p.pieces, [piece]: n } }) },
          ]}
        />
      )}
      {ouvert &&
        (() => {
          const x = entreeDe(ouvert.ref)
          const regle: Affichable = x ? description(x) : { nom: ouvert.nom, page: 0, resume: 'Objet libre' }
          return (
            <FeuilleRegle regle={regle.page ? regle : { ...regle, page: 213 }} onFermer={() => setOuvert(null)}>
              <label className="bloc">
                <span className="etiquette">Note</span>
                <input className="champ" defaultValue={ouvert.note ?? ''} onBlur={(e) => maj({ ...ouvert, note: e.target.value || undefined })} placeholder="Charges, détails…" />
              </label>
              <button
                className="bouton large"
                onClick={() => {
                  dispatch({ type: 'retirerObjet', uid: ouvert.uid })
                  setOuvert(null)
                }}
              >
                Jeter
              </button>
            </FeuilleRegle>
          )
        })()}
    </main>
  )
}
