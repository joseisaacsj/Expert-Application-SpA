import { enviarReporte } from './api.js'

// Cola de reportes pendientes en IndexedDB.
// No usamos Background Sync porque en iPhone no funciona igual:
// se sincroniza al abrir la app y al detectar el evento 'online'.

const DB_NAME = 'ea-offline'
const STORE = 'reportes-pendientes'

function abrirDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'clientId' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function guardarPendiente(reporte) {
  const db = await abrirDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(reporte)
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}

export async function listarPendientes() {
  const db = await abrirDb()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function eliminarPendiente(clientId) {
  const db = await abrirDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(clientId)
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}

// Comprime una foto en el cliente antes de subirla (máx 1280px, JPEG 70%).
export async function comprimirFoto(archivo, maxPx = 1280, calidad = 0.7) {
  const bitmap = await createImageBitmap(archivo)
  const escala = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) =>
    canvas.toBlob(
      (blob) => {
        const reader = new FileReader()
        reader.onload = () =>
          resolve({ nombre: archivo.name.replace(/\.\w+$/, '.jpg'), dataUrl: reader.result })
        reader.readAsDataURL(blob)
      },
      'image/jpeg',
      calidad,
    ),
  )
}

// Intenta enviar todos los pendientes. El server los trata como
// idempotentes por clientId, así que reenviar es seguro.
export async function sincronizarPendientes(onProgreso) {
  const pendientes = await listarPendientes()
  const resultados = { enviados: 0, fallidos: 0 }
  for (const p of pendientes) {
    try {
      await enviarReporte(p)
      await eliminarPendiente(p.clientId)
      resultados.enviados++
      onProgreso?.(p, 'enviado')
    } catch {
      resultados.fallidos++
      onProgreso?.(p, 'fallido')
    }
  }
  return resultados
}

export function hayConexion() {
  return navigator.onLine
}
