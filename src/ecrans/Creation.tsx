import { useMemo, useState } from 'react'
import { CARACS, regles } from '../regles/pack'
import { choixEnAttente, formatMod, modificateur, pvMax, valeurCarac } from '../regles/calculs'
import { nomCarac, nomCompetence } from '../regles/noms'
import { objetsDepuisNoms } from '../regles/equipement'
import type { IdCarac, Regle } from '../regles/types'
import { personnageVierge, type Personnage } from '../etat/personnage'
import { FeuilleRegle, type Affichable } from '../composants/Feuille'
import { EditeurChoix } from './EditeurChoix'

/** Création en étapes, dans l'ordre du chapitre 2 : classe, origine, caractéristiques, détails. */
const ETAPES = ['Classe', 'Historique', 'Espèce', 'Caractéristiques', 'Compétences', 'Choix', 'Équipement', 'Nom'] as const

const STANDARD = [15, 14, 13, 12, 10, 8]
const COUT_POINTS: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }
type Methode = 'standard' | 'points' | 'libre'

interface Props {
  onCreer: (p: Personnage) => void
  onAnnuler?: () => void
}

function Liste({ entrees, valeur, onChoisir, onDetail }: { entrees: (Regle & { sous: string })[]; valeur: string; onChoisir: (id: string) => void; onDetail: (r: Affichable) => void }) {
  return (
    <ul className="liste-choix">
      {entrees.map((e) => (
        <li key={e.id} className={valeur === e.id ? 'choisi' : ''}>
          <button className="choix-principal" aria-pressed={valeur === e.id} onClick={() => onChoisir(e.id)}>
            <strong>{e.nom}</strong>
            <small>{e.sous}</small>
          </button>
          <button className="lien-page" onClick={() => onDetail(e)}>
            p. {e.page}
          </button>
        </li>
      ))}
    </ul>
  )
}

export function Creation({ onCreer, onAnnuler }: Props) {
  const [etape, setEtape] = useState(0)
  const [p, setP] = useState<Personnage>(() => ({ ...personnageVierge(), caracsBase: { for: 8, dex: 8, con: 8, int: 8, sag: 8, cha: 8 } }))
  const [methode, setMethode] = useState<Methode>('standard')
  const [standard, setStandard] = useState<Partial<Record<IdCarac, number>>>({})
  const [mode, setMode] = useState<'2-1' | '1-1-1'>('2-1')
  const [equip, setEquip] = useState({ classe: 'A', historique: 'A' })
  const [detail, setDetail] = useState<Affichable | null>(null)

  const classe = p.classe ? regles.classes[p.classe] : null
  const historique = p.historique ? regles.historiques[p.historique] : null
  const espece = p.espece ? regles.especes[p.espece] : null
  const pret = !!classe && !!historique && !!espece

  // Valeurs de base selon la méthode.
  const base: Record<IdCarac, number> = methode === 'standard' ? (Object.fromEntries(CARACS.map((c) => [c, standard[c] ?? 8])) as Record<IdCarac, number>) : p.caracsBase
  const brouillon: Personnage = { ...p, caracsBase: base }
  const pointsDepenses = CARACS.reduce((s, c) => s + (COUT_POINTS[p.caracsBase[c]] ?? 0), 0)
  const attente = useMemo(() => (pret ? choixEnAttente({ ...brouillon, pv: 1 }) : []), [pret, brouillon])

  const bonusOk = (() => {
    const v = Object.values(p.bonusHistorique)
    return mode === '2-1' ? v.length === 2 && v.includes(2) && v.includes(1) : v.length === 3 && v.every((x) => x === 1)
  })()

  const etapeValide = [
    !!classe,
    !!historique && bonusOk,
    !!espece,
    methode === 'standard' ? CARACS.every((c) => standard[c] !== undefined) : methode === 'points' ? pointsDepenses <= 27 : true,
    !!classe && p.competencesClasse.length === classe.maitrises.competences.nombre,
    attente.length === 0,
    true,
    p.nom.trim() !== '',
  ]

  const creer = () => {
    const objets = [
      ...objetsDepuisNoms(classe!.equipementDepart.choix.find((c) => c.id === equip.classe)?.objets ?? []),
      ...objetsDepuisNoms(historique!.equipement.choix.find((c) => c.id === equip.historique)?.objets ?? []),
    ]
    const po = (classe!.equipementDepart.choix.find((c) => c.id === equip.classe)?.po ?? 0) + (historique!.equipement.choix.find((c) => c.id === equip.historique)?.po ?? 0)
    const fini: Personnage = { ...brouillon, nom: p.nom.trim(), inventaire: objets, pieces: { ...p.pieces, po } }
    onCreer({ ...fini, pv: pvMax(fini) })
  }

  const basculerBonus = (c: IdCarac) => {
    const b = { ...p.bonusHistorique }
    if (mode === '1-1-1') {
      if (b[c]) delete b[c]
      else if (Object.keys(b).length < 3) b[c] = 1
    } else {
      // Cycle 0 → +2 → +1 → 0, sans doublon de +2 ou de +1.
      const v = b[c] ?? 0
      const suivant = v === 0 ? (Object.values(b).includes(2) ? 1 : 2) : v === 2 ? 1 : 0
      delete b[c]
      if (suivant && !Object.values(b).includes(suivant)) b[c] = suivant
    }
    setP({ ...p, bonusHistorique: b })
  }

  let corps
  switch (ETAPES[etape]) {
    case 'Classe':
      corps = (
        <Liste
          valeur={p.classe}
          onDetail={setDetail}
          onChoisir={(id) => setP({ ...p, classe: id, competencesClasse: [], sousClasse: null, choix: {} })}
          entrees={Object.entries(regles.classes).map(([id, c]) => ({
            id,
            nom: c.nom,
            page: c.page,
            resume: c.resume ?? '',
            detail: c.aptitudes.filter((a) => a.niveau === 1).map((a) => `${a.nom} : ${a.resume}`),
            sous: `d${c.deDeVie} · ${c.caracPrincipales.map(nomCarac).join(', ')}${c.resume ? ` · ${c.resume}` : ''}`,
          }))}
        />
      )
      break
    case 'Historique':
      corps = (
        <>
          <Liste
            valeur={p.historique}
            onDetail={setDetail}
            onChoisir={(id) => setP({ ...p, historique: id, bonusHistorique: {} })}
            entrees={Object.entries(regles.historiques).map(([id, h]) => ({
              id,
              nom: h.nom,
              page: h.page,
              resume: '',
              detail: [`Caractéristiques : ${h.caracteristiques.map(nomCarac).join(', ')}`, `Don : ${regles.dons[h.don]?.nom ?? h.don}`, `Compétences : ${h.competences.map(nomCompetence).join(', ')}`, `Outils : ${h.outils}`],
              sous: `${h.caracteristiques.map(nomCarac).join(', ')} · ${regles.dons[h.don]?.nom ?? h.don} · ${h.competences.map(nomCompetence).join(', ')}`,
            }))}
          />
          {historique && (
            <fieldset className="bloc">
              <legend>Ajustements de caractéristique (p. 38)</legend>
              <div className="puces">
                {(['2-1', '1-1-1'] as const).map((m) => (
                  <button key={m} className={`puce ${mode === m ? 'choisi' : ''}`} onClick={() => (setMode(m), setP({ ...p, bonusHistorique: {} }))}>
                    {m === '2-1' ? '+2 et +1' : '+1, +1, +1'}
                  </button>
                ))}
              </div>
              <div className="puces">
                {historique.caracteristiques.map((c) => (
                  <button key={c} className={`puce ${p.bonusHistorique[c] ? 'choisi' : ''}`} onClick={() => basculerBonus(c)}>
                    {nomCarac(c)} {p.bonusHistorique[c] ? `+${p.bonusHistorique[c]}` : ''}
                  </button>
                ))}
              </div>
              <p className="aide">{mode === '2-1' ? 'Touche une fois pour +2, deux fois pour +1.' : 'Les trois caractéristiques gagnent +1.'}</p>
            </fieldset>
          )}
        </>
      )
      break
    case 'Espèce':
      corps = (
        <Liste
          valeur={p.espece}
          onDetail={setDetail}
          onChoisir={(id) => setP({ ...p, espece: id })}
          entrees={Object.entries(regles.especes).map(([id, e]) => ({
            id,
            nom: e.nom,
            page: e.page,
            resume: e.resume ?? '',
            detail: e.traits.map((t) => `${t.nom} : ${t.resume}`),
            sous: `Taille ${e.taille} · ${String(e.vitesse).replace('.', ',')} m · ${e.traits.map((t) => t.nom).join(', ')}`,
          }))}
        />
      )
      break
    case 'Caractéristiques':
      corps = (
        <>
          <div className="puces">
            {(
              [
                ['standard', 'Valeurs standard'],
                ['points', 'Achat de points'],
                ['libre', 'Dés ou saisie'],
              ] as const
            ).map(([m, nom]) => (
              <button key={m} className={`puce ${methode === m ? 'choisi' : ''}`} onClick={() => (setMethode(m), setP({ ...p, caracsBase: m === 'points' ? { for: 8, dex: 8, con: 8, int: 8, sag: 8, cha: 8 } : { for: 10, dex: 10, con: 10, int: 10, sag: 10, cha: 10 } }))}>
                {nom}
              </button>
            ))}
          </div>
          <p className="aide">
            {methode === 'standard' && 'Attribue 15, 14, 13, 12, 10 et 8 (p. 38).'}
            {methode === 'points' && `27 points (p. 38) : ${27 - pointsDepenses} restant${27 - pointsDepenses > 1 ? 's' : ''}.`}
            {methode === 'libre' && 'Saisis tes valeurs tirées (4d6, garder les 3 meilleurs, p. 38) ou imposées par le MD.'}
          </p>
          <fieldset className="bloc">
            {CARACS.map((c) => {
              const finale = valeurCarac(brouillon, c)
              return (
                <div className="ligne-carac" key={c}>
                  <span className="nom">
                    {nomCarac(c)}
                    {classe?.caracPrincipales.includes(c) && <span className="dispo"> ●</span>}
                  </span>
                  <span className="mod">
                    {finale} {formatMod(modificateur(finale))}
                  </span>
                  {methode === 'standard' ? (
                    <div className="valeurs-standard">
                      {STANDARD.map((v) => {
                        const prise = Object.entries(standard).find(([, x]) => x === v)?.[0]
                        return (
                          <button
                            key={v}
                            className={`mini ${standard[c] === v ? 'choisi' : ''}`}
                            disabled={!!prise && prise !== c}
                            onClick={() => setStandard({ ...standard, [c]: standard[c] === v ? undefined : v })}
                          >
                            {v}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="pas">
                      <button className="bouton rond" aria-label={`Diminuer ${nomCarac(c)}`} disabled={p.caracsBase[c] <= (methode === 'points' ? 8 : 3)} onClick={() => setP({ ...p, caracsBase: { ...p.caracsBase, [c]: p.caracsBase[c] - 1 } })}>
                        −
                      </button>
                      <output>{p.caracsBase[c]}</output>
                      <button
                        className="bouton rond"
                        aria-label={`Augmenter ${nomCarac(c)}`}
                        disabled={methode === 'points' ? p.caracsBase[c] >= 15 || pointsDepenses + (COUT_POINTS[p.caracsBase[c] + 1] - COUT_POINTS[p.caracsBase[c]]) > 27 : p.caracsBase[c] >= 18}
                        onClick={() => setP({ ...p, caracsBase: { ...p.caracsBase, [c]: p.caracsBase[c] + 1 } })}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </fieldset>
        </>
      )
      break
    case 'Compétences':
      corps = classe && (
        <EditeurChoix
          p={brouillon}
          choix={{ id: 'competences', nom: 'Compétences', type: 'competence', nombre: classe.maitrises.competences.nombre, parmi: classe.maitrises.competences.parmi }}
          valeurs={p.competencesClasse}
          onChange={(v) => setP({ ...p, competencesClasse: v })}
        />
      )
      break
    case 'Choix':
      corps = attente.length ? (
        <>
          {attente.slice(0, 1).map((c) => (
            <fieldset className="bloc" key={c.cle}>
              <legend>
                {c.source.regle.nom} : {c.choix.nom}
              </legend>
              <EditeurChoix p={brouillon} choix={c.choix} valeurs={p.choix[c.cle] ?? []} onChange={(v) => setP({ ...p, choix: { ...p.choix, [c.cle]: v } })} />
            </fieldset>
          ))}
          {attente.length > 1 && <p className="aide centre">Encore {attente.length - 1} autre{attente.length > 2 ? 's' : ''} choix ensuite.</p>}
        </>
      ) : (
        <p className="aide">Aucun choix supplémentaire au niveau 1.</p>
      )
      break
    case 'Équipement':
      corps = classe && historique && (
        <>
          {(
            [
              ['classe', classe.nom, classe.equipementDepart.choix],
              ['historique', historique.nom, historique.equipement.choix],
            ] as const
          ).map(([qui, nom, choix]) => (
            <fieldset className="bloc" key={qui}>
              <legend>Équipement de {nom}</legend>
              {choix.map((c) => (
                <button key={c.id} className={`option ${equip[qui] === c.id ? 'choisi' : ''}`} aria-pressed={equip[qui] === c.id} onClick={() => setEquip({ ...equip, [qui]: c.id })}>
                  <strong>{c.id}</strong>
                  <span>{[...c.objets, `${c.po} po`].join(', ')}</span>
                </button>
              ))}
            </fieldset>
          ))}
        </>
      )
      break
    case 'Nom':
      corps = (
        <>
          <label className="bloc">
            <span className="etiquette">Nom</span>
            <input className="champ" value={p.nom} onChange={(e) => setP({ ...p, nom: e.target.value })} placeholder="Nom du personnage" autoComplete="off" />
          </label>
          {pret && (
            <p className="aide centre">
              {espece!.nom} · {classe!.nom} 1 · {historique!.nom} · {pvMax(brouillon)} PV
            </p>
          )}
        </>
      )
      break
  }

  const derniere = etape === ETAPES.length - 1
  return (
    <main className="ecran saisie">
      <header className="tete">
        <div>
          <h1>{ETAPES[etape]}</h1>
          <p className="sous-titre">
            Nouveau personnage · étape {etape + 1} / {ETAPES.length}
          </p>
        </div>
        {onAnnuler && (
          <button className="bouton discret" onClick={onAnnuler}>
            Annuler
          </button>
        )}
      </header>
      {corps}
      <div className="navigation-etapes">
        <button className="bouton" disabled={etape === 0} onClick={() => setEtape(etape - 1)}>
          Retour
        </button>
        <button className="bouton principal" disabled={!etapeValide[etape]} onClick={() => (derniere ? creer() : setEtape(etape + 1))}>
          {derniere ? 'Créer' : 'Suivant'}
        </button>
      </div>
      {detail && <FeuilleRegle regle={detail} onFermer={() => setDetail(null)} />}
    </main>
  )
}
