// Extrait les icônes utilisées par l'app du jeu game-icons.net (CC BY 3.0, via @iconify-json/game-icons)
// et écrit src/composants/icones-data.ts. Lancer : node tools/icones.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const jeu = JSON.parse(readFileSync('node_modules/@iconify-json/game-icons/icons.json', 'utf8'))

const ICONES = {
  // Onglets
  perso: 'hooded-figure', combat: 'crossed-swords', sorts: 'spell-book', sac: 'knapsack', carnet: 'quill-ink', regles: 'book-cover',
  // Chiffres et actions
  pv: 'hearts', degats: 'broken-heart', soins: 'health-increase', pvTemp: 'heart-tower', ca: 'checked-shield', initiative: 'sprint',
  vitesse: 'walking-boot', repos: 'campfire', niveau: 'upgrade', mort: 'skull-crossed-bones', action: 'sword-clash', bonus: 'fast-forward-button',
  reaction: 'shield-reflect', touche: 'anvil-impact', autres: 'sparkles', etats: 'aura', tour: 'hourglass', sort: 'magic-swirl',
  inspiration: 'stars-stack', des: 'dice-twenty-faces-twenty', pieces: 'two-coins', recherche: 'magnifying-glass', note: 'scroll-quill',
  ressource: 'crystal-ball',
  // Classes
  barbare: 'battle-axe', barde: 'lyre', clerc: 'holy-symbol', druide: 'oak-leaf', ensorceleur: 'fire-ray', guerrier: 'visored-helm',
  magicien: 'wizard-staff', moine: 'fist', occultiste: 'warlock-eye', paladin: 'templar-shield', rodeur: 'pocket-bow', roublard: 'plain-dagger',
  // Espèces
  aasimar: 'angel-wings', drakeide: 'dragon-head', elfe: 'elf-ear', gnome: 'pointy-hat', goliath: 'giant', halfelin: 'hobbit-door',
  humain: 'person', nain: 'dwarf-face', orc: 'orc-head', tieffelin: 'devil-mask',
}

const sortie = {}
for (const [nom, id] of Object.entries(ICONES)) {
  const i = jeu.icons[id]
  if (!i) throw new Error(`icône absente : ${id}`)
  // Le fond noir carré de game-icons est retiré : seul le tracé (fill="currentColor") reste.
  sortie[nom] = i.body.replace(/<path d="M0 0h512v512H0z"\/>/, '').replace(/fill="#fff"/g, 'fill="currentColor"')
}
writeFileSync(
  'src/composants/icones-data.ts',
  `// Généré par tools/icones.mjs. Icônes de game-icons.net (Lorc, Delapouite et al.), licence CC BY 3.0.\n` +
    `export const ICONES = ${JSON.stringify(sortie, null, 1)} as const\n`,
)
console.log(Object.keys(sortie).length, 'icônes')
