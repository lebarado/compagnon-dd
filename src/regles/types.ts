/**
 * Schéma du pack de règles (pack-manuel.json). Le pack est généré localement à partir du manuel
 * (tools/construire_pack.py) et n'est jamais publié : l'app le charge au premier lancement.
 * Toute entrée affichable porte la page imprimée du manuel.
 */

export type IdCarac = 'for' | 'dex' | 'con' | 'int' | 'sag' | 'cha'

export interface Regle {
  id: string
  nom: string
  page: number
  resume: string
  detail?: string[]
}

export type Recharge = Partial<Record<'repos-court' | 'repos-long', 'tout' | number>>

export interface Ressource {
  id: string
  nom: string
  /** Formule du maximum (src/regles/formule.ts). */
  max: string
  recharge: Recharge
  page?: number
}

export type Condition = 'sans-armure' | 'sans-bouclier' | 'pas-armure-lourde' | 'avec-armure'

export type TypeChoix = 'competence' | 'expertise' | 'don' | 'carac' | 'option' | 'sort' | 'outil' | 'langue' | 'maitrise-arme'

export interface Choix {
  id: string
  nom: string
  type: TypeChoix
  nombre: number
  /** Identifiants autorisés (compétences, sorts…). Absent = tous ceux du type. */
  parmi?: string[]
  /** Options décrites (style de combat, ascendance, manifestation…). */
  options?: (Regle & Effets)[]
  /** Pour type « don » : catégories autorisées. */
  categories?: string[]
  /** Pour type « sort » : niveau de sort et liste de classe. */
  niveauSort?: number
  liste?: string
  /** Pour type « carac » : points à répartir et plafond. */
  points?: number
  max?: number
}

/** Effets mécaniques qu'une aptitude, un trait, un don ou une option peut avoir. */
export interface Effets {
  ca?: { formule: string; conditions?: Condition[] }
  bonusCa?: { valeur: number; conditions?: Condition[] }
  vitesse?: { bonus: string; conditions?: Condition[] }
  vitesses?: Partial<Record<'escalade' | 'nage' | 'vol', string>>
  pvMaxParNiveau?: number
  /** Bonus fixe au maximum de pv (Faveur de vigueur). */
  pvMaxBonus?: number
  maitriseSauvegardes?: IdCarac[] | 'toutes'
  competences?: string[]
  bonusCarac?: Partial<Record<IdCarac, number>> & { max?: number }
  ressources?: Ressource[]
  choix?: Choix[]
  /** Sorts toujours préparés. */
  sorts?: { id: string; niveau?: number }[]
  resistances?: string[]
  visionNoir?: number
  maitrisesArmures?: string[]
  maitrisesArmes?: string[]
  initiative?: string
  /** Moitié du bonus de maîtrise aux tests de caractéristique non maîtrisés (Touche-à-tout). */
  demiMaitrise?: boolean
  /** Option de combat apportée par un trait, un don ou une option choisie (nom et page repris de la source). */
  optionCombat?: { emplacement: Emplacement } & Partial<Omit<OptionCombat, 'id' | 'emplacement'>>
  /** Attaque à mains nues améliorée (Arts martiaux, Bagarreur de tavernes). */
  mainsNues?: { de: string; caracs: IdCarac[]; armesMoine?: boolean; conditions?: Condition[] }
}

export interface Aptitude extends Regle, Effets {
  niveau: number
  repeteAuxNiveaux?: number[]
  aVerifier?: string
}

export type Emplacement = 'action' | 'bonus' | 'reaction' | 'touche' | 'debut-de-tour' | 'fin-de-tour' | 'initiative' | 'declencheur'

export interface SousChoix {
  id: string
  nom: string
  resume: string
  page: number
  cout?: Cout
  de?: string
}

export interface Cout {
  ressource: string
  nombre: number
}

export interface OptionCombat {
  id: string
  nom: string
  emplacement: Emplacement
  niveau: number
  page: number
  resume: string
  detail?: string[]
  court?: string
  cout?: Cout
  /** Modèle de texte affiché sous le nom (dé, bonus, DD). */
  de?: string
  effets?: string[]
  sousChoix?: SousChoix[]
  limite?: '1-par-tour'
  necessite?: string
  conditions?: Condition[]
  regle?: string
  /** À partir d'un niveau, ces champs remplacent ceux de l'option. */
  evolutions?: ({ niveau: number } & Partial<Omit<OptionCombat, 'evolutions' | 'niveau' | 'id'>>)[]
  /** Demande un résultat de dés à l'utilisateur et l'applique (minimum 1 pour des soins). */
  jet?: { des: string; applique: 'soins' | 'pvTemp'; bonus?: string }
  /** Ressources restaurées : « tout », ou jusqu'à un minimum restant. */
  restaure?: Record<string, 'tout' | number>
  /** Points de vie temporaires fixes reçus (formule). */
  pvTemp?: string
}

export interface Incantation {
  carac: IdCarac
  /** complet, demi, tiers (table commune) ou pacte (Occultiste). */
  type: 'complet' | 'demi' | 'tiers' | 'pacte'
  liste: string
  sortsMineurs?: number[]
  sortsPrepares: number[]
  page: number
  resume?: string
}

export interface ChoixEquipement {
  id: string
  objets: string[]
  po: number
}

export interface SousClasse {
  nom: string
  page: number
  resume?: string
  aptitudes: Aptitude[]
  optionsCombat?: OptionCombat[]
  incantation?: Incantation
}

export interface Classe {
  nom: string
  page: number
  resume?: string
  caracPrincipales: IdCarac[]
  deDeVie: number
  maitrises: {
    sauvegardes: IdCarac[]
    competences: { nombre: number; parmi: string[] }
    armes: string
    /** Catégories maîtrisées : « courante », « guerre », « guerre:legere », « guerre:finesse ». */
    categoriesArmes: string[]
    armures: string[]
    outils?: string
  }
  equipementDepart: { page: number; choix: ChoixEquipement[] }
  /** Colonnes de la table de classe, une valeur par niveau (1 à 20). */
  table: Record<string, number[]>
  colonnes?: { id: string; nom: string; format?: 'de' | 'm' | 'nombre' | 'bonus' }[]
  /** Formule du DD de la classe (aptitudes à jet de sauvegarde). */
  dd?: string
  incantation?: Incantation
  aptitudes: Aptitude[]
  optionsCombat?: OptionCombat[]
  niveauSousClasse: number
  sousClasses: Record<string, SousClasse>
}

export interface Trait extends Regle, Effets {
  niveau?: number
  aVerifier?: string
}

export interface Espece {
  nom: string
  page: number
  resume?: string
  type: string
  taille: string
  vitesse: number
  traits: Trait[]
}

export interface Historique {
  nom: string
  page: number
  caracteristiques: IdCarac[]
  don: string
  /** Choix propre au don d'historique (ex. liste de sorts d'Initié à la magie). */
  choixDon?: string
  competences: string[]
  outils: string
  equipement: { choix: ChoixEquipement[] }
}

export interface Don extends Regle, Effets {
  categorie: 'origine' | 'general' | 'style' | 'epique'
  prerequis?: string
  niveauMin?: number
  repetable?: boolean
}

export interface Arme {
  id: string
  nom: string
  categorie: 'courante' | 'guerre'
  portee: 'corps-a-corps' | 'distance'
  degats: string
  typeDegats: string
  proprietes: string[]
  botte: string
  poids: number
  prix: string
  page: number
}

export interface Armure {
  id: string
  nom: string
  categorie: 'legere' | 'intermediaire' | 'lourde' | 'bouclier'
  ca: number
  /** Plafond du modificateur de Dex (null : pas de Dex, undefined : sans plafond). */
  dexMax?: number | null
  force?: number
  discretion?: boolean
  poids: number
  prix: string
  page: number
}

export interface Objet {
  id: string
  nom: string
  poids?: number
  prix?: string
  page: number
  resume?: string
  categorie?: string
  /** Contenu d'un paquetage, déballé dans l'inventaire à la création. */
  contenu?: string[]
}

export interface Sort {
  id: string
  nom: string
  niveau: number
  ecole: string
  classes: string[]
  incantation: string
  rituel?: boolean
  portee: string
  composantes: string
  duree: string
  concentration?: boolean
  page: number
  resume: string
  detail?: string[]
  niveauSup?: string
  aVerifier?: string
}

export interface EntreeGlossaire extends Regle {
  categorie: string
}

export interface Effet {
  nom: string
  jusqua: 'fin-de-tour' | 'debut-de-tour' | 'fin-du-combat'
  page: number
  resume: string
}

export interface Etat extends Regle {
  inclut?: string[]
  vitesseZero?: boolean
  cumulable?: boolean
  niveauMax?: number
}

export interface PointAVerifier {
  id: string
  page: number
  sujet: string
  probleme: string
}

export interface Pack {
  meta: { version: string; source: string; aVerifier: PointAVerifier[] }
  caracteristiques: { page: number; liste: { id: IdCarac; nom: string; abrev: string }[]; generation?: Regle[] }
  bonusMaitrise: { page: number; parNiveau: number[] }
  experience?: { page: number; parNiveau: number[] }
  competences: { page: number; liste: { id: string; nom: string; carac: IdCarac }[] }
  emplacementsSorts: {
    page: number
    complet: number[][]
    demi: number[][]
    tiers: number[][]
    pacte: { emplacements: number[]; niveau: number[] }
  }
  classes: Record<string, Classe>
  especes: Record<string, Espece>
  historiques: Record<string, Historique>
  dons: Record<string, Don>
  equipement: { armes: Arme[]; armures: Armure[]; objets: Objet[]; bottes?: Regle[]; proprietes?: Regle[] }
  sorts: Record<string, Sort>
  combat: {
    effets: Record<string, Effet>
    optionsCommunes: OptionCombat[]
    actions: (Regle & { effets?: string[] })[]
  }
  pointsDeVie: { zeroPv: { page: number; resume: string; detail: string[] } }
  etats: Etat[]
  repos: Record<'court' | 'long', Regle & { benefices: string[] }>
  glossaire: EntreeGlossaire[]
}
