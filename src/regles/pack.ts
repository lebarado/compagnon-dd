import type { IdCarac, Pack } from './types'

/**
 * Règles en cours. Le pack est chargé au démarrage (IndexedDB, ou fichier pack-manuel.json servi
 * à côté de l'app, ou import manuel) puis installé ici. Les modules lisent `regles` au moment de
 * l'appel : la liaison ES est vivante, donc l'installation est vue partout.
 */
export let regles: Pack = null as unknown as Pack

export function definirRegles(p: Pack): void {
  regles = p
}

export const CARACS: IdCarac[] = ['for', 'dex', 'con', 'int', 'sag', 'cha']

const BASE = 'compagnon-dd'
const MAGASIN = 'pack'

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resoudre, rejeter) => {
    const req = indexedDB.open(BASE, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(MAGASIN)
    req.onsuccess = () => resoudre(req.result)
    req.onerror = () => rejeter(req.error)
  })
}

async function lireLocal(): Promise<Pack | null> {
  try {
    const db = await ouvrir()
    return await new Promise((resoudre) => {
      const req = db.transaction(MAGASIN).objectStore(MAGASIN).get('courant')
      req.onsuccess = () => resoudre((req.result as Pack) ?? null)
      req.onerror = () => resoudre(null)
    })
  } catch {
    return null
  }
}

export async function enregistrerPack(p: Pack): Promise<void> {
  try {
    const db = await ouvrir()
    await new Promise<void>((resoudre, rejeter) => {
      const tx = db.transaction(MAGASIN, 'readwrite')
      tx.objectStore(MAGASIN).put(p, 'courant')
      tx.oncomplete = () => resoudre()
      tx.onerror = () => rejeter(tx.error)
    })
  } catch {
    // IndexedDB indisponible : le pack reste en mémoire pour cette session.
  }
}

/** Vérifie qu'un objet a la forme d'un pack ; lève une erreur lisible sinon. */
export function validerPack(x: unknown): Pack {
  const p = x as Partial<Pack> | null
  const manque = (['meta', 'caracteristiques', 'bonusMaitrise', 'competences', 'classes', 'especes', 'historiques', 'dons', 'etats', 'repos'] as const).filter(
    (k) => !p || typeof p[k] !== 'object',
  )
  if (manque.length) throw new Error(`Ce fichier n'est pas un pack de règles (manque : ${manque.join(', ')}).`)
  return p as Pack
}

/** Pack servi à côté de l'app (développement local ou serveur maison). Absent sur GitHub Pages. */
async function lireServi(): Promise<Pack | null> {
  try {
    const rep = await fetch('./pack-manuel.json', { cache: 'no-store' })
    if (!rep.ok) return null
    return validerPack(await rep.json())
  } catch {
    return null
  }
}

export async function chargerPack(): Promise<Pack | null> {
  const [local, servi] = await Promise.all([lireLocal(), lireServi()])
  if (servi && servi.meta.version !== local?.meta.version) {
    await enregistrerPack(servi)
    return servi
  }
  return local ?? servi
}

export async function importerPack(fichier: File): Promise<Pack> {
  const pack = validerPack(JSON.parse(await fichier.text()))
  await enregistrerPack(pack)
  return pack
}
