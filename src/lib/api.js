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

export async function obtenerRegistro(obraId) {
  await latencia()
  return ejecutar((db) => srv.obtenerRegistro(db, usuarioId(), obraId))
}

export async function obtenerPlanificacion(obraId) {
  await latencia()
  return ejecutar((db) => srv.obtenerPlanificacion(db, usuarioId(), obraId))
}

export async function guardarPlanificacionDia(obraId, fecha, cantidades) {
  await latencia()
  return ejecutar((db) => srv.guardarPlanificacionDia(db, usuarioId(), obraId, { fecha, cantidades }))
}

export async function obtenerCurvaS(obraId) {
  await latencia()
  return ejecutar((db) => srv.obtenerCurvaS(db, usuarioId(), obraId))
}

export async function obtenerAPU(obraId) {
  await latencia()
  return ejecutar((db) => srv.obtenerAPU(db, usuarioId(), obraId))
}

export async function obtenerPresupuesto(obraId) {
  await latencia()
  return ejecutar((db) => srv.obtenerPresupuesto(db, usuarioId(), obraId))
}

export async function obtenerMateriales(obraId) {
  await latencia()
  return ejecutar((db) => srv.obtenerMateriales(db, usuarioId(), obraId))
}

export async function obtenerFinanzas(obraId) {
  await latencia()
  return ejecutar((db) => srv.obtenerFinanzas(db, usuarioId(), obraId))
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
      ggPct: o.ggPct ?? null,
      utilPct: o.utilPct ?? null,
      ggCategorias: db.ggCategorias
        .filter((c) => c.obraId === o.id)
        .map((c) => ({ categoria: c.categoria, techoCLP: c.techoCLP })),
      partidas: db.partidas
        .filter((p) => p.obraId === o.id)
        .sort((a, b) => a.orden - b.orden)
        .map((p) => ({
          item: p.item,
          nombre: p.nombre,
          etapa: p.etapa,
          unidad: p.unidad,
          planificada: p.planificada,
          presupuesto: p.presupuesto,
          precioUnitarioUF: p.precioUnitarioUF,
          precioUnitarioCLP: p.precioUnitarioCLP,
          subpartidas: p.subpartidas,
        })),
    })),
  )
}

export async function actualizarObra(obraId, datos) {
  await latencia()
  return ejecutar((db) => srv.actualizarObra(db, usuarioId(), obraId, datos))
}

export async function guardarPartida(obraId, partida) {
  await latencia()
  return ejecutar((db) => srv.guardarPartida(db, usuarioId(), obraId, partida))
}

export async function eliminarPartida(obraId, partidaId) {
  await latencia()
  return ejecutar((db) => srv.eliminarPartida(db, usuarioId(), obraId, partidaId))
}

export async function guardarMaterial(obraId, material) {
  await latencia()
  return ejecutar((db) => srv.guardarMaterial(db, usuarioId(), obraId, material))
}

export async function eliminarMaterial(obraId, materialId) {
  await latencia()
  return ejecutar((db) => srv.eliminarMaterial(db, usuarioId(), obraId, materialId))
}

export async function agregarGasto(obraId, gasto) {
  await latencia()
  return ejecutar((db) => srv.agregarGasto(db, usuarioId(), obraId, gasto))
}

export async function guardarTechoGG(obraId, categoria) {
  await latencia()
  return ejecutar((db) => srv.guardarTechoGG(db, usuarioId(), obraId, categoria))
}

export async function eliminarTechoGG(obraId, catId) {
  await latencia()
  return ejecutar((db) => srv.eliminarTechoGG(db, usuarioId(), obraId, catId))
}

export async function guardarDotacion(obraId, persona) {
  await latencia()
  return ejecutar((db) => srv.guardarDotacion(db, usuarioId(), obraId, persona))
}

export async function resetearDemo() {
  resetearDb()
}
