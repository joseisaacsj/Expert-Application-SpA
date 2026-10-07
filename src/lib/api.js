import { cargarDb, guardarDb, resetearDb } from '../server/db.js'
import * as srv from '../server/endpoints.js'
import { API_BASE_URL } from '../config/api.js'

// Capa de acceso a datos del frontend.
// Hoy llama a la capa simulada (src/server) persistida en localStorage.
// Cuando exista el backend PHP, cada función pasará a ser un fetch()
// contra API_BASE_URL sin tocar las páginas.
// API_BASE_URL queda referenciada aquí para centralizar la configuración.
void API_BASE_URL

function token() {
  return sessionStorage.getItem('ea-token') || localStorage.getItem('ea-token')
}

function usuarioId() {
  const t = token()
  return t?.startsWith('demo-token-') ? t.replace('demo-token-', '') : null
}

function ejecutar(fn) {
  const db = cargarDb()
  const resultado = fn(db)
  guardarDb(db)
  return resultado
}

// Simula latencia de red para que el demo se sienta real.
const latencia = () => new Promise((r) => setTimeout(r, 150))

export async function login(usuario, password) {
  await latencia()
  const db = cargarDb()
  return srv.login(db, usuario, password)
}

export async function obtenerTablero() {
  await latencia()
  return ejecutar((db) => srv.obtenerTablero(db, usuarioId()))
}

export async function obtenerObra(obraId) {
  await latencia()
  return ejecutar((db) => srv.obtenerObra(db, usuarioId(), obraId))
}

export async function enviarReporte(datos) {
  // En el demo, sin conexión = sin servidor: simula el fallo de red real.
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new srv.ApiError(0, 'Sin conexión')
  }
  await latencia()
  return ejecutar((db) => srv.crearReporte(db, usuarioId(), datos))
}

export async function obtenerRRHH(obraId) {
  await latencia()
  return ejecutar((db) => srv.obtenerRRHH(db, usuarioId(), obraId))
}

export async function crearObra(datos) {
  await latencia()
  return ejecutar((db) => srv.crearObra(db, usuarioId(), datos))
}

export async function obtenerUsuarios() {
  await latencia()
  return ejecutar((db) => srv.obtenerUsuarios(db, usuarioId()))
}

export async function actualizarMembresia(datos) {
  await latencia()
  return ejecutar((db) => srv.actualizarMembresia(db, usuarioId(), datos))
}

export async function obtenerObrasParaClonar() {
  await latencia()
  return ejecutar((db) =>
    db.obras.map((o) => ({
      id: o.id,
      nombre: o.nombre,
      partidas: db.partidas
        .filter((p) => p.obraId === o.id)
        .sort((a, b) => a.orden - b.orden)
        .map((p) => ({ nombre: p.nombre, unidad: p.unidad, planificada: p.planificada, presupuesto: p.presupuesto })),
    })),
  )
}

export async function resetearDemo() {
  resetearDb()
}
