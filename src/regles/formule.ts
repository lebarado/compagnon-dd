/**
 * Petit langage de formules utilisé par le pack de règles.
 *
 *   nombres, + - * /, parenthèses, max(a, b, …), min(a, b, …)
 *   identifiants : niveau, bm, mod.dex, carac.con, table.rages, dd, …
 *
 * La division arrondit à l'entier inférieur (manuel p. 361).
 * Les modèles de texte remplacent {expr} par sa valeur et {+expr} par sa valeur signée
 * (« +3 », « −1 », rien si 0) : « 1d{table.artsMartiaux}{+mod.dex} » → « 1d6+3 ».
 */

export type Valeur = number | string
export type Resolveur = (nom: string) => Valeur | undefined

class Lecteur {
  private i = 0
  constructor(
    private readonly s: string,
    private readonly resoudre: Resolveur,
  ) {}

  lire(): number {
    const v = this.expression()
    this.espaces()
    if (this.i < this.s.length) throw new Error(`Formule invalide « ${this.s} » à la position ${this.i}`)
    return v
  }

  private espaces() {
    while (this.s[this.i] === ' ') this.i++
  }

  private expression(): number {
    let v = this.terme()
    for (;;) {
      this.espaces()
      const c = this.s[this.i]
      if (c !== '+' && c !== '-') return v
      this.i++
      const d = this.terme()
      v = c === '+' ? v + d : v - d
    }
  }

  private terme(): number {
    let v = this.facteur()
    for (;;) {
      this.espaces()
      const c = this.s[this.i]
      if (c !== '*' && c !== '/') return v
      this.i++
      const d = this.facteur()
      v = c === '*' ? v * d : Math.floor(v / d)
    }
  }

  private facteur(): number {
    this.espaces()
    const c = this.s[this.i]
    if (c === '-') {
      this.i++
      return -this.facteur()
    }
    if (c === '(') {
      this.i++
      const v = this.expression()
      this.attendre(')')
      return v
    }
    const nombre = /^\d+(\.\d+)?/.exec(this.s.slice(this.i))
    if (nombre) {
      this.i += nombre[0].length
      return Number(nombre[0])
    }
    const ident = /^[a-zA-Z][\w.-]*/.exec(this.s.slice(this.i))
    if (!ident) throw new Error(`Formule invalide « ${this.s} » à la position ${this.i}`)
    this.i += ident[0].length
    this.espaces()
    if (this.s[this.i] === '(') {
      this.i++
      const args = [this.expression()]
      this.espaces()
      while (this.s[this.i] === ',') {
        this.i++
        args.push(this.expression())
        this.espaces()
      }
      this.attendre(')')
      if (ident[0] === 'max') return Math.max(...args)
      if (ident[0] === 'min') return Math.min(...args)
      throw new Error(`Fonction inconnue « ${ident[0]} » dans « ${this.s} »`)
    }
    const v = this.resoudre(ident[0])
    if (typeof v !== 'number') throw new Error(`Valeur inconnue « ${ident[0]} » dans « ${this.s} »`)
    return v
  }

  private attendre(c: string) {
    this.espaces()
    if (this.s[this.i] !== c) throw new Error(`« ${c} » attendu dans « ${this.s} »`)
    this.i++
  }
}

export function evaluer(formule: string | number, resoudre: Resolveur): number {
  if (typeof formule === 'number') return formule
  return new Lecteur(formule, resoudre).lire()
}

export function signe(n: number): string {
  if (n === 0) return ''
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`
}

/** Remplit un modèle de texte. Une expression qui échoue est laissée telle quelle, entre crochets. */
export function remplir(modele: string, resoudre: Resolveur): string {
  return modele.replace(/\{(\+?)([^}]+)\}/g, (_, signeDemande: string, expr: string) => {
    const nu = expr.trim()
    const direct = resoudre(nu)
    if (typeof direct === 'string') return direct
    try {
      const v = evaluer(nu, resoudre)
      return signeDemande ? signe(v) : String(v)
    } catch {
      return `[${nu}]`
    }
  })
}
