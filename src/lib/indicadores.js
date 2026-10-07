import { fechaISO } from './format.js'

// Indicadores económicos del día (UF y UTM).
// Fuente: mindicador.cl — API pública que replica los valores oficiales
// publicados por el Banco Central de Chile / CMF. En producción se puede
// cambiar por la API oficial de la CMF (api.cmfchile.cl, requiere apikey).
const API = 'https://mindicador.cl/api'
const CACHE_KEY = 'ea-indicadores'

const RESPALDO = { uf: 39500, utm: 69500, fuente: 'respaldo (sin conexión)' }

export async function obtenerIndicadores() {
  const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
  // Los valores cambian una vez al día: reusar el caché del mismo día.
  if (cache?.consultadoEl === fechaISO()) return cache

  try {
    const res = await fetch(API)
    if (!res.ok) throw new Error('API no disponible')
    const json = await res.json()
    const datos = {
      uf: json.uf.valor,
      ufFecha: json.uf.fecha,
      utm: json.utm.valor,
      utmFecha: json.utm.fecha,
      consultadoEl: fechaISO(),
      fuente: 'mindicador.cl (valor oficial del día)',
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(datos))
    return datos
  } catch {
    return cache ?? { ...RESPALDO, consultadoEl: null }
  }
}
