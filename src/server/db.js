import { seed } from './seed.js'

const CLAVE = 'ea-demo-db-v1'

// En memoria cuando no hay localStorage (tests / SSR)
let memoria = null

const storage = () =>
  typeof localStorage !== 'undefined'
    ? localStorage
    : {
        getItem: () => memoria,
        setItem: (_, v) => (memoria = v),
        removeItem: () => (memoria = null),
      }

export function cargarDb() {
  const crudo = storage().getItem(CLAVE)
  if (!crudo) {
    const db = seed()
    storage().setItem(CLAVE, JSON.stringify(db))
    return db
  }
  return JSON.parse(crudo)
}

export function guardarDb(db) {
  storage().setItem(CLAVE, JSON.stringify(db))
}

export function resetearDb() {
  storage().removeItem(CLAVE)
  return cargarDb()
}
