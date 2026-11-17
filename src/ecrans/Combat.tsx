import { useState, type Dispatch, type ReactNode } from 'react'
import { regles } from '../regles/pack'
import { armeDe, attaqueArme, calculer, classeArmure, emplacements, mainsNues, formatMod, initiative, ressourcePrincipale, ressourceRestante, ressources, texte } from '../regles/calculs'
import { abordable, contraintes, couts, deplacement, etatsActifs, libelle, optionsPour, regleOption, sortsLancables, type TempsSort } from '../regles/options'
import { metres } from '../regles/noms'
import type { Emplacement, OptionCombat, Sort } from '../regles/types'
import type { Action, Personnage } from '../etat/personnage'
import type { Case, Demande, Place } from '../etat/combat'
import { ChoixDe, Feuille, FeuilleRegle, type Affichable } from '../composants/Feuille'
import { FeuilleSort } from './Sorts'
import { PointsDeVie } from '../composants/PointsDeVie'
import { Icone, type NomIcone } from '../composants/Icone'

interface Props {
  p: Personnage
  dispatch: Dispatch<Action>
}

interface DemandeDe {
  titre: string
  nombre: number
  faces: number
  aide?: string
  onResultat: (n: number) => void
}

function Badge({ o }: { o: { cout?: { ressource: string; nombre: number } } }) {
  if (!o.cout) return null
  const nom = o.cout.ressource.startsWith('sort-') ? `niv. ${o.cout.ressource.slice(5)}` : o.cout.ressource === 'credo' ? 'Credo' : ''
  return (
    <span className="badge">
      {o.cout.nombre}
      {nom ? ` ${nom}` : ''}
    </span>
  )
}

function Bloc({ titre, icone, note, children, className = '' }: { titre: ReactNode; icone?: NomIcone; note?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section className={`case ${className}`}>
      <header className="case-tete">
        <h2>
          {icone && <Icone nom={icone} taille={22} className="accent" />}
          {titre}
        </h2>
        {note}
      </header>
      {children}
    </section>
  )
}

/** Armes équipées (Sac) avec bonus d'attaque et dégâts, puis mains nues (p. 362). */
function Armes({ p }: { p: Personnage }) {
  const armes = p.inventaire.flatMap((o) => {
    const a = o.equipe ? armeDe(o.ref) : undefined
    return a ? [{ uid: o.uid, nom: o.nom, ...attaqueArme(p, a) }] : []
  })
  const mn = mainsNues(p)
  return (
    <span className="armes">
      {armes.map((a) => (
        <span key={a.uid}>
          {a.nom}
          <b>
            {formatMod(a.toucher)} · {a.degats}
          </b>
        </span>
      ))}
      <span>
        Mains nues
        <b>
          {formatMod(mn.toucher)} · {mn.degats}
        </b>
      </span>
      {armes.length === 0 && <span>Équipe une arme dans le Sac pour la voir ici.</span>}
    </span>
  )
}

/** Regroupe les variantes d'une même aptitude (Patience défensive gratuite ou à 1 Credo). */
function grouper(options: OptionCombat[]): OptionCombat[][] {
  const groupes = new Map<string, OptionCombat[]>()
  for (const o of options) groupes.set(o.nom, [...(groupes.get(o.nom) ?? []), o])
  return [...groupes.values()]
}

const TITRES: Record<Case, string> = { action: 'Action', bonus: 'Action Bonus', reaction: 'Réaction' }

export function Combat({ p, dispatch }: Props) {
  const [sort, setSort] = useState<{ s: Sort; place: Case } | null>(null)
  const onSort = (s: Sort) => setSort({ s, place: (feuille === 'bonus' ? 'bonus' : feuille === 'reaction' ? 'reaction' : 'action') as Case })
  const [regle, setRegle] = useState<Affichable | null>(null)
  const [de, setDe] = useState<DemandeDe | null>(null)
  const [feuille, setFeuille] = useState<'actions' | 'etats' | TempsSort | null>(null)
  const [etatOuvert, setEtatOuvert] = useState<string | null>(null)

  const c = p.combat
  const k = contraintes(p)
  const principale = ressourcePrincipale(p)

  /** Demande ce qu'il faut, puis utilise l'option. */
  const utiliser = (place: Place, o: OptionCombat) => {
    const demande: Demande = { id: o.id, nom: o.court ? `${o.nom} · ${o.court}` : o.nom, couts: couts(o), effets: o.effets, restaure: o.restaure }
    if (o.pvTemp) demande.pvTemp = calculer(p, o.pvTemp)
    if (o.jet) {
      const des = texte(p, o.jet.des)
      const m = /^(\d+)d(\d+)$/.exec(des)
      if (m) {
        const bonus = o.jet.bonus ? calculer(p, o.jet.bonus) : 0
        setDe({
          titre: o.nom,
          nombre: Number(m[1]),
          faces: Number(m[2]),
          aide: bonus ? `${formatMod(bonus)} ajouté` : undefined,
          onResultat: (n) => {
            const total = o.jet!.applique === 'soins' ? Math.max(1, n + bonus) : n + bonus
            dispatch({ type: 'utiliser', place, demande: { ...demande, [o.jet!.applique]: total } })
          },
        })
        return
      }
    }
    if (place === 'libre' && !o.cout && !o.effets?.length && !o.restaure && !o.pvTemp) {
      setRegle(regleOption(p, o))
      return
    }
    dispatch({ type: 'utiliser', place, demande })
  }

  const sous = (o: OptionCombat) => {
    // L'attaque liste déjà les armes et les mains nues : seul le nombre d'attaques reste utile.
    const parts = [o.id === 'attaque' && o.de === '{mainsNues}' ? null : libelle(p, o.de)]
    if (o.cout && !o.cout.ressource.startsWith('sort-') && o.cout.ressource !== 'credo' && o.cout.ressource !== principale?.id) {
      const max = ressources(p).find((r) => r.id === o.cout!.ressource)?.valeurMax
      if (max !== undefined) parts.push(`${ressourceRestante(p, o.cout.ressource)}/${max}`)
    }
    return parts.filter(Boolean).join(' · ')
  }

  const lignes = (place: Place, options: OptionCombat[], fait?: (o: OptionCombat) => boolean) =>
    grouper(options).map((groupe) => {
      if (groupe.length === 1) {
        const o = groupe[0]
        const estFait = fait?.(o) ?? false
        return (
          <div className={`ligne-option ${estFait ? 'fait' : ''}`} key={o.id}>
            <button
              className="option-principale"
              disabled={!estFait && !abordable(p, o)}
              aria-pressed={estFait}
              onClick={() => (estFait ? dispatch({ type: 'annuler', place: 'touche', id: o.id }) : utiliser(place, o))}
            >
              <span className="option-texte">
                <strong>
                  {o.nom}
                  {estFait && ' ✓'}
                </strong>
                {sous(o) && <small>{sous(o)}</small>}
                {o.id === 'attaque' && <Armes p={p} />}
              </span>
              <Badge o={o} />
            </button>
            <button className="lien-page" onClick={() => setRegle(regleOption(p, o))} aria-label={`Règle : ${o.nom}, page ${o.page}`}>
              p. {o.page}
            </button>
          </div>
        )
      }
      return (
        <div className="ligne-option groupe" key={groupe[0].nom}>
          <div className="groupe-tete">
            <strong>{groupe[0].nom}</strong>
            <button
              className="lien-page"
              onClick={() =>
                setRegle({
                  nom: groupe[0].nom,
                  page: groupe[0].page,
                  resume: groupe[0].resume,
                  detail: groupe.map((o) => `${o.court ?? o.nom}${o.cout ? ` (${o.cout.nombre})` : ''} : ${o.resume}`),
                })
              }
            >
              p. {groupe[0].page}
            </button>
          </div>
          <div className="pilules">
            {groupe.map((o) => (
              <button key={o.id} className="pilule" disabled={!abordable(p, o)} onClick={() => utiliser(place, o)}>
                <span>{o.court ?? o.nom}</span>
                {sous(o) && <small>{sous(o)}</small>}
                <Badge o={o} />
              </button>
            ))}
          </div>
        </div>
      )
    })

  /** Après usage : bouton Annuler et sous-choix payants (Rediriger…). */
  const faitCase = (place: Case) => {
    const u = c.cases[place]!
    const o = optionsPour(p, place as Emplacement).find((x) => x.id === u.id)
    return (
      <div className="fait">
        <div className="fait-ligne">
          <span>
            <strong>{u.nom}</strong> ✓
          </span>
          <button className="bouton discret petit" onClick={() => dispatch({ type: 'annuler', place })}>
            Annuler
          </button>
        </div>
        {o?.sousChoix
          ?.filter((s) => s.cout)
          .map((s) =>
            u.sousChoix?.id === s.id ? (
              <p key={s.id} className="aide">
                {s.nom} ✓
              </p>
            ) : (
              <button
                key={s.id}
                className="pilule"
                disabled={!abordable(p, s)}
                onClick={() => dispatch({ type: 'sousChoix', place, demande: { id: s.id, nom: s.nom, couts: couts(s) } })}
              >
                <span>{s.nom}</span>
                {s.de && <small>{libelle(p, s.de)}</small>}
                <Badge o={s} />
              </button>
            ),
          )}
      </div>
    )
  }

  const ligneSort = (temps: TempsSort) =>
    sortsLancables(p, temps).length > 0 && (
      <div className="ligne-option">
        <button className="option-principale" onClick={() => setFeuille(temps)}>
          <span className="option-texte">
            <strong className="avec-icone"><Icone nom="sort" taille={18} className="accent" /> Lancer un sort</strong>
            <small>{sortsLancables(p, temps).length} sorts</small>
          </span>
        </button>
      </div>
    )

  const blocCase = (place: Case, contenu: ReactNode, compact = false) => {
    const u = c.cases[place]
    if (k.neutralise)
      return (
        <Bloc titre={TITRES[place]} icone={place} key={place} className="indispo">
          <p className="aide">Impossible : Neutralisé (p. 370)</p>
        </Bloc>
      )
    if (u) return <Bloc titre={TITRES[place]} icone={place} key={place} className="utilisee">{faitCase(place)}</Bloc>
    if (compact)
      return (
        <details className="depliant" key={place}>
          <summary>
            <Icone nom={place} taille={22} className="accent" /> {TITRES[place]} <span className="dispo">disponible</span>
          </summary>
          <div className="depliant-corps">{contenu}</div>
        </details>
      )
    return (
      <Bloc titre={TITRES[place]} icone={place} key={place}>
        {contenu}
      </Bloc>
    )
  }

  const touche = optionsPour(p, 'touche')
  const toucheVisibles = touche.filter((o) => {
    if (o.necessite) return c.cases.bonus?.id === o.necessite
    return c.phase === 'tour' || c.cases.reaction?.id === 'attaque-opportunite'
  })
  const blocTouche = toucheVisibles.length > 0 && (
    <Bloc titre="Sur une touche" icone="touche" key="touche">
      {toucheVisibles.map((o) =>
        o.sousChoix && !o.cout ? (
          <div className="ligne-option groupe" key={o.id}>
            <div className="groupe-tete">
              <strong>{o.nom}</strong>
              <button className="lien-page" onClick={() => setRegle(regleOption(p, o))}>
                p. {o.page}
              </button>
            </div>
            <div className="pilules">
              {o.sousChoix.map((s) => (
                <button key={s.id} className="pilule" onClick={() => setRegle({ nom: s.nom, page: s.page, resume: s.resume, info: libelle(p, s.de) ?? undefined })}>
                  <span>{s.nom}</span>
                  {s.de && <small>{libelle(p, s.de)}</small>}
                </button>
              ))}
            </div>
          </div>
        ) : (
          lignes('touche', [o], (x) => c.touches.some((t) => t.id === x.id))
        ),
      )}
    </Bloc>
  )

  const autres = [...(c.phase === 'tour' ? [...optionsPour(p, 'debut-de-tour'), ...optionsPour(p, 'fin-de-tour')] : []), ...optionsPour(p, 'declencheur')]
  const blocAutres = autres.length > 0 && (
    <Bloc titre="Autres" icone="autres" key="autres">
      {lignes('libre', autres)}
    </Bloc>
  )

  const actifs = etatsActifs(p)
  const blocEtats = (
    <Bloc
      titre="États"
      icone="etats"
      key="etats"
      note={
        <button className="bouton discret petit" onClick={() => setFeuille('etats')}>
          Gérer
        </button>
      }
    >
      {p.etats.length === 0 && p.epuisement === 0 ? (
        <p className="aide">Aucun</p>
      ) : (
        <div className="puces">
          {p.etats.map((id) => (
            <button key={id} className="puce alerte-bord" onClick={() => setEtatOuvert(id)}>
              {regles.etats.find((e) => e.id === id)?.nom ?? id}
            </button>
          ))}
          {p.epuisement > 0 && (
            <button className="puce alerte-bord" onClick={() => setEtatOuvert('epuisement')}>
              Épuisement {p.epuisement}
            </button>
          )}
        </div>
      )}
      {p.epuisement > 0 && <p className="aide">−{2 * p.epuisement} aux tests d20 (p. 366)</p>}
    </Bloc>
  )

  const effetsVisibles = [...new Set(c.effets)].filter((e) => !(e === 'esquive' && (k.neutralise || k.vitesseZero)))
  const dep = deplacement(p, c.effets)

  let corps: ReactNode
  if (c.phase === 'hors') {
    corps = (
      <>
        <Bloc titre={<>Initiative <span className="chiffre-moyen">{formatMod(initiative(p))}</span></>} icone="initiative">
          {optionsPour(p, 'initiative').length ? lignes('libre', optionsPour(p, 'initiative')) : <p className="aide">Lance 1d20 {formatMod(initiative(p))}.</p>}
        </Bloc>
        {blocEtats}
      </>
    )
  } else if (c.phase === 'attente') {
    corps = (
      <>
        {blocCase(
          'reaction',
          <>
            {lignes('reaction', optionsPour(p, 'reaction'))}
            {ligneSort('reaction')}
          </>,
        )}
        {blocTouche}
        {blocAutres}
        {blocEtats}
      </>
    )
  } else {
    corps = (
      <>
        {blocCase(
          'action',
          <>
            {lignes('action', optionsPour(p, 'action'))}
            {ligneSort('action')}
            <div className="ligne-option">
              <button className="option-principale discrete" onClick={() => setFeuille('actions')}>
                <span className="option-texte">
                  <strong>Autre action</strong>
                  <small>Esquive, Pointe, Soutien…</small>
                </span>
              </button>
            </div>
          </>,
        )}
        {blocCase(
          'bonus',
          <>
            {lignes('bonus', optionsPour(p, 'bonus'))}
            {ligneSort('bonus')}
            {optionsPour(p, 'bonus').length === 0 && sortsLancables(p, 'bonus').length === 0 && <p className="aide">Aucune action Bonus disponible.</p>}
          </>,
        )}
        <section className="case case-ligne">
          <h2>
            <Icone nom="vitesse" taille={22} className="accent" />
            Déplacement
          </h2>
          <strong className="chiffre-moyen">{metres(dep)}</strong>
        </section>
        {k.aTerre && <p className="aide">À terre : se relever coûte la moitié de ta Vitesse (p. 360).</p>}
        {blocTouche}
        {blocCase(
          'reaction',
          <>
            {lignes('reaction', optionsPour(p, 'reaction'))}
            {ligneSort('reaction')}
          </>,
          true,
        )}
        {blocAutres}
        {blocEtats}
      </>
    )
  }

  const titrePhase = { hors: 'Hors combat', attente: 'Tour des autres', tour: 'Mon tour' }[c.phase]
  const bouton = { hors: 'Initiative jouée', attente: 'Mon tour', tour: 'Fin de tour' }[c.phase]
  const suivante = ({ hors: 'attente', attente: 'tour', tour: 'attente' } as const)[c.phase]

  return (
    <main className="ecran avec-action">
      <header className="tete-combat">
        <div className="phase">
          <Icone nom={c.phase === 'tour' ? 'combat' : c.phase === 'attente' ? 'tour' : 'initiative'} taille={26} className="accent" />
          <span className="phase-texte">
            <strong>{titrePhase}</strong>
            {c.round > 0 && <span className="round">Round {c.round}</span>}
          </span>
        </div>
        <button
          className="bouton discret inspiration"
          aria-pressed={p.inspiration}
          aria-label={p.inspiration ? 'Inspiration héroïque : dépenser' : 'Inspiration héroïque : gagner'}
          onClick={() => dispatch({ type: 'inspiration' })}
        >
          <Icone nom="inspiration" taille={24} />
        </button>
        {c.phase !== 'hors' && (
          <button className="bouton discret petit" onClick={() => dispatch({ type: 'phase', phase: 'hors' })}>
            Fin du combat
          </button>
        )}
      </header>
      <PointsDeVie p={p} dispatch={dispatch} compact />
      <section className="tuiles compactes">
        <div className="tuile">
          <Icone nom="ca" taille={64} className="filigrane" />
          <span className="etiquette">CA</span>
          <span className="chiffre">{classeArmure(p)}</span>
        </div>
        {principale && (
          <div className="tuile">
            <Icone nom="ressource" taille={64} className="filigrane" />
            <span className="etiquette">{principale.nom}</span>
            <span className={`chiffre ${ressourceRestante(p, principale.id) === 0 ? 'epuise' : 'dispo'}`}>
              {ressourceRestante(p, principale.id)}
              <small> / {principale.valeurMax}</small>
            </span>
            <div className="tuile-boutons">
              <button className="bouton rond" aria-label={`Dépenser : ${principale.nom}`} disabled={ressourceRestante(p, principale.id) === 0} onClick={() => dispatch({ type: 'ressource', id: principale.id, delta: -1 })}>
                −
              </button>
              <button className="bouton rond" aria-label={`Récupérer : ${principale.nom}`} disabled={ressourceRestante(p, principale.id) >= principale.valeurMax} onClick={() => dispatch({ type: 'ressource', id: principale.id, delta: 1 })}>
                +
              </button>
            </div>
          </div>
        )}
      </section>
      {emplacements(p).length > 0 && (
        <div className="emplacements-ligne">
          {emplacements(p).map((e) => (
            <span key={e.id} className={ressourceRestante(p, e.id) ? '' : 'epuise'}>
              {e.id === 'pacte' ? `Pacte niv. ${e.niveau}` : `Niv. ${e.niveau}`} {ressourceRestante(p, e.id)}/{e.max}
            </span>
          ))}
        </div>
      )}
      {effetsVisibles.length > 0 && (
        <div className="puces effets">
          {effetsVisibles.map((e) => {
            const def = regles.combat.effets[e]
            const n = c.effets.filter((x) => x === e).length
            return (
              <button key={e} className="puce choisi" onClick={() => def && setRegle({ nom: def.nom, page: def.page, resume: def.resume })}>
                {def?.nom ?? e}
                {n > 1 ? ` ×${n}` : ''}
              </button>
            )
          })}
        </div>
      )}
      {corps}

      <button className="bouton principal bouton-tour" onClick={() => dispatch({ type: 'phase', phase: suivante })}>
        {bouton}
      </button>

      {feuille === 'actions' && (
        <Feuille titre="Autres actions" onFermer={() => setFeuille(null)}>
          <ul className="liste-choix">
            {regles.combat.actions
              .filter((a) => a.id !== 'attaque')
              .map((a) => (
                <li key={a.id}>
                  <button
                    className="choix-principal"
                    onClick={() => {
                      dispatch({ type: 'utiliser', place: 'action', demande: { id: a.id, nom: a.nom, effets: a.effets } })
                      setFeuille(null)
                    }}
                  >
                    <strong>{a.nom}</strong>
                    <small>{a.resume}</small>
                  </button>
                  <button className="lien-page" onClick={() => setRegle(a)}>
                    p. {a.page}
                  </button>
                </li>
              ))}
          </ul>
        </Feuille>
      )}
      {(feuille === 'action' || feuille === 'bonus' || feuille === 'reaction') && (
        <Feuille titre="Lancer un sort" onFermer={() => setFeuille(null)}>
          <ul className="liste-choix">
            {sortsLancables(p, feuille).map((s) => (
              <li key={s.id}>
                <button
                  className="choix-principal"
                  onClick={() => {
                    onSort(s)
                    setFeuille(null)
                  }}
                >
                  <strong>{s.nom}</strong>
                  <small>
                    {s.niveau === 0 ? 'Sort mineur' : `Niveau ${s.niveau}`} · {s.portee} · {s.resume}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </Feuille>
      )}
      {feuille === 'etats' && (
        <Feuille titre="États" onFermer={() => setFeuille(null)}>
          <ul className="liste-choix">
            {regles.etats
              .filter((e) => e.id !== 'epuisement')
              .map((e) => {
                const choisi = p.etats.includes(e.id)
                return (
                  <li key={e.id} className={choisi ? 'choisi' : actifs.has(e.id) ? 'inclus' : ''}>
                    <button className="choix-principal" aria-pressed={choisi} onClick={() => dispatch({ type: 'etat', id: e.id })}>
                      <strong>{e.nom}</strong>
                      <small>{e.resume}</small>
                    </button>
                    <button className="lien-page" onClick={() => setRegle(e)}>
                      p. {e.page}
                    </button>
                  </li>
                )
              })}
            <li className="compteur">
              <span>
                <strong>Épuisement</strong>
              </span>
              <div className="pas">
                <button className="bouton rond" aria-label="Retirer un niveau d'Épuisement" disabled={p.epuisement === 0} onClick={() => dispatch({ type: 'epuisement', delta: -1 })}>
                  −
                </button>
                <output>{p.epuisement}</output>
                <button className="bouton rond" aria-label="Ajouter un niveau d'Épuisement" disabled={p.epuisement >= 6} onClick={() => dispatch({ type: 'epuisement', delta: 1 })}>
                  +
                </button>
              </div>
            </li>
          </ul>
        </Feuille>
      )}
      {etatOuvert && (
        <FeuilleRegle regle={regles.etats.find((e) => e.id === etatOuvert)!} onFermer={() => setEtatOuvert(null)}>
          {etatOuvert !== 'epuisement' && (
            <button
              className="bouton large"
              onClick={() => {
                dispatch({ type: 'etat', id: etatOuvert })
                setEtatOuvert(null)
              }}
            >
              Retirer cet état
            </button>
          )}
        </FeuilleRegle>
      )}
      {sort && <FeuilleSort p={p} sort={sort.s} place={sort.place} dispatch={dispatch} onFermer={() => setSort(null)} />}
      {de && <ChoixDe titre={de.titre} nombre={de.nombre} faces={de.faces} aide={de.aide} onResultat={de.onResultat} onFermer={() => setDe(null)} />}
      {regle && <FeuilleRegle regle={regle} onFermer={() => setRegle(null)} />}
    </main>
  )
}
