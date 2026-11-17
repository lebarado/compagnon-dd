import Peer, { type DataConnection } from 'peerjs'
import { pvMax } from '../regles/calculs'
import type { CartePublique, Personnage } from './personnage'

/**
 * Session de groupe en direct : les téléphones se relient entre eux (WebRTC, via le relais public PeerJS
 * pour la mise en relation). L'hôte reçoit la carte de chacun et renvoie toutes les cartes à tout le monde.
 * Seule la carte publique circule : nom, espèce, classe, niveau, santé approximative, états visibles.
 */

const PREFIXE = 'compagnon-dd-session-'
// Sans lettres ambiguës (I, O, 0, 1).
const LETTRES = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CLE = 'compagnon-dd:session'

export interface EtatSession {
  statut: 'hors' | 'connexion' | 'connecte' | 'erreur'
  code?: string
  hote?: boolean
  erreur?: string
  /** Joueurs connectés, moi compris. */
  membres: number
}

type Message = { type: 'carte'; carte: CartePublique } | { type: 'cartes'; cartes: CartePublique[] }

export function nouveauCode(): string {
  return Array.from({ length: 4 }, () => LETTRES[Math.floor(Math.random() * LETTRES.length)]).join('')
}

export function normaliserCode(saisie: string): string {
  return saisie.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
}

/** Ce que les autres voient de moi : ce qui se remarque à la table, jamais les chiffres de la fiche. */
export function carteDe(p: Personnage): CartePublique {
  const max = pvMax(p)
  const sante = p.pv === 0 ? 'zero' : p.pv >= max ? 'indemne' : p.pv * 2 <= max ? 'grave' : 'blesse'
  return { id: p.id, nom: p.nom, espece: p.espece, classe: p.classe, niveau: p.niveau, sante, etats: p.etats, concentration: p.concentration?.nom ?? null }
}

/** Dernière session, pour la reprendre après une mise en veille du téléphone. */
export function derniereSession(): { code: string; hote: boolean } | null {
  try {
    return JSON.parse(localStorage.getItem(CLE) ?? 'null')
  } catch {
    return null
  }
}

function retenir(s: { code: string; hote: boolean } | null) {
  try {
    if (s) localStorage.setItem(CLE, JSON.stringify(s))
    else localStorage.removeItem(CLE)
  } catch {
    // Stockage refusé : la reprise ne sera pas proposée.
  }
}

export class Session {
  private peer: Peer | null = null
  private connexions: DataConnection[] = []
  private versHote: DataConnection | null = null
  private cartes = new Map<string, CartePublique>()
  private maCarte: CartePublique | null = null
  private etat: EtatSession = { statut: 'hors', membres: 0 }
  private onEtat: (e: EtatSession) => void
  private onCartes: (c: CartePublique[]) => void

  constructor(onEtat: (e: EtatSession) => void, onCartes: (c: CartePublique[]) => void) {
    this.onEtat = onEtat
    this.onCartes = onCartes
  }

  private changer(e: Partial<EtatSession>) {
    this.etat = { ...this.etat, ...e }
    this.onEtat(this.etat)
  }

  private toutes(): CartePublique[] {
    return [...this.cartes.values()]
  }

  private diffuser() {
    const m: Message = { type: 'cartes', cartes: this.toutes() }
    for (const c of this.connexions) if (c.open) c.send(m)
    this.onCartes(this.toutes())
    this.changer({ membres: this.connexions.filter((c) => c.open).length + 1 })
  }

  /** Crée une session ; avec un code, la recrée (reprise après veille). */
  creer(carte: CartePublique, code = nouveauCode(), essais = 4) {
    this.quitter(false)
    this.maCarte = carte
    this.cartes = new Map([[carte.id, carte]])
    this.changer({ statut: 'connexion', code, hote: true, erreur: undefined, membres: 1 })
    const peer = new Peer(PREFIXE + code)
    this.peer = peer
    peer.on('open', () => {
      retenir({ code, hote: true })
      this.changer({ statut: 'connecte' })
    })
    peer.on('connection', (c) => this.accueillir(c))
    peer.on('disconnected', () => {
      // Perte du relais : les liens directs restent ; on tente de se réinscrire pour accueillir les nouveaux.
      if (this.peer === peer && !peer.destroyed) peer.reconnect()
    })
    peer.on('error', (e) => {
      if (this.peer !== peer) return
      if (e.type === 'unavailable-id' && essais > 0) {
        // Code encore réservé (reprise juste après une coupure) ou déjà pris : on réessaie.
        peer.destroy()
        setTimeout(() => this.peer === peer && this.creer(carte, derniereSession()?.code === code ? code : nouveauCode(), essais - 1), 2500)
        return
      }
      this.changer({ statut: 'erreur', erreur: messageErreur(e.type) })
    })
  }

  private accueillir(c: DataConnection) {
    c.on('open', () => {
      this.connexions = [...this.connexions.filter((x) => x.peer !== c.peer), c]
      this.diffuser()
    })
    c.on('data', (d) => {
      const m = d as Message
      if (m?.type === 'carte' && m.carte?.id) {
        this.cartes.set(m.carte.id, m.carte)
        this.diffuser()
      }
    })
    c.on('close', () => {
      this.connexions = this.connexions.filter((x) => x !== c)
      this.changer({ membres: this.connexions.filter((x) => x.open).length + 1 })
    })
  }

  /** Rejoint une session ; si l'hôte disparaît un moment (veille), on réessaie quelques fois. */
  rejoindre(code: string, carte: CartePublique, essais = 0) {
    this.quitter(false)
    this.maCarte = carte
    this.changer({ statut: 'connexion', code, hote: false, erreur: undefined, membres: 0 })
    const peer = new Peer()
    this.peer = peer
    const reessayer = (erreur: string) => {
      if (this.peer !== peer) return
      if (essais < 5) {
        peer.destroy()
        setTimeout(() => this.peer === peer && this.rejoindre(code, this.maCarte ?? carte, essais + 1), 4000)
      } else this.changer({ statut: 'erreur', erreur })
    }
    peer.on('open', () => {
      const c = peer.connect(PREFIXE + code, { reliable: true })
      this.versHote = c
      c.on('open', () => {
        retenir({ code, hote: false })
        essais = 0
        this.changer({ statut: 'connecte' })
        if (this.maCarte) c.send({ type: 'carte', carte: this.maCarte } satisfies Message)
      })
      c.on('data', (d) => {
        const m = d as Message
        if (m?.type === 'cartes') {
          this.onCartes(m.cartes)
          this.changer({ membres: m.cartes.length })
        }
      })
      c.on('close', () => {
        if (this.versHote === c) reessayer("Liaison perdue avec l'hôte de la session.")
      })
    })
    peer.on('error', (e) => {
      if (this.peer !== peer) return
      // Code inconnu au premier essai : erreur tout de suite ; pendant une reconnexion, l'hôte revient peut-être.
      if (e.type === 'peer-unavailable' && essais === 0) this.changer({ statut: 'erreur', erreur: messageErreur(e.type) })
      else reessayer(messageErreur(e.type))
    })
  }

  /** Ma carte a changé (PV, états…) : les autres la reçoivent. */
  majCarte(carte: CartePublique) {
    if (JSON.stringify(carte) === JSON.stringify(this.maCarte)) return
    this.maCarte = carte
    if (this.etat.statut !== 'connecte') return
    if (this.etat.hote) {
      this.cartes.set(carte.id, carte)
      this.diffuser()
    } else if (this.versHote?.open) this.versHote.send({ type: 'carte', carte } satisfies Message)
  }

  quitter(oublier = true) {
    const peer = this.peer
    this.peer = null
    this.versHote = null
    this.connexions = []
    peer?.destroy()
    if (oublier) {
      retenir(null)
      this.changer({ statut: 'hors', code: undefined, hote: undefined, erreur: undefined, membres: 0 })
    }
  }
}

function messageErreur(type: string): string {
  switch (type) {
    case 'peer-unavailable':
      return 'Aucune session avec ce code. Vérifie le code, ou demande à l’hôte de la relancer.'
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return 'Connexion impossible : vérifie que le téléphone est en ligne.'
    case 'browser-incompatible':
      return 'Ce navigateur ne permet pas les sessions en direct.'
    case 'unavailable-id':
      return 'Ce code est déjà utilisé. Crée une nouvelle session.'
    default:
      return 'La session a rencontré un problème. Réessaie.'
  }
}
