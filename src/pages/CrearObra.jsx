import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Trash2, Plus, Check } from 'lucide-react'
import { crearObra, obtenerObrasParaClonar } from '../lib/api.js'
import { UMBRALES_DEFECTO, totalNetoPartida, incidencia } from '../lib/calculos.js'
import Modal from '../components/Modal.jsx'
import { clp } from '../lib/format.js'

const PASOS = ['Datos generales', 'Partidas', 'Umbrales', 'Revisión']

function PasoIndicador({ actual }) {
  return (
    <ol className="flex items-center gap-2 mb-6 flex-wrap">
      {PASOS.map((p, i) => (
        <li key={p} className="flex items-center gap-2">
          <span
            className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-medium ${
              i < actual
                ? 'bg-semaforo-verde text-white'
                : i === actual
                  ? 'bg-brand text-white'
                  : 'bg-slate-200 dark:bg-ink-muted/40 text-slate-500'
            }`}
          >
            {i < actual ? <Check size={13} /> : i + 1}
          </span>
          <span className={`text-xs ${i === actual ? 'font-medium text-ink dark:text-white' : 'text-slate-500'}`}>
            {p}
          </span>
          {i < PASOS.length - 1 && <span className="w-4 h-px bg-slate-300 dark:bg-ink-muted" />}
        </li>
      ))}
    </ol>
  )
}

const inputClase =
  'w-full rounded-lg border border-slate-300 dark:border-ink-muted bg-transparent px-3 py-2 text-sm'
const celdaClase =
  'w-full rounded-md border border-slate-200 dark:border-ink-muted/60 bg-transparent px-2 py-1.5 text-sm tabular-nums'

// Parsea números con formato chileno (miles con punto, decimales con coma).
function numCL(texto) {
  const limpio = String(texto ?? '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  return Number(limpio) || 0
}

const partidaVacia = () => ({
  nombre: '',
  unidad: 'M2',
  planificada: '',
  precioUnitarioUF: '',
  precioUnitarioCLP: '',
})

export default function CrearObra() {
  const navigate = useNavigate()
  const [paso, setPaso] = useState(0)
  const [error, setError] = useState('')
  const [modalConfirmar, setModalConfirmar] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const [datos, setDatos] = useState({
    nombre: '',
    ubicacion: '',
    fechaInicio: '',
    plazoDias: 60,
  })
  const [partidas, setPartidas] = useState([])
  const [ggPct, setGgPct] = useState(32.5) // % gastos generales (por defecto como en la hoja)
  const [utilPct, setUtilPct] = useState(15) // % utilidad
  const [umbrales, setUmbrales] = useState({ ...UMBRALES_DEFECTO })
  const [clonables, setClonables] = useState([])

  useEffect(() => {
    obtenerObrasParaClonar().then(setClonables).catch(() => {})
  }, [])

  // Totales calculados por partida (solo vista: el servidor los recalcula).
  const partidasCalc = useMemo(
    () =>
      partidas.map((p) => {
        const cant = Number(p.planificada) || 0
        const pUF = Number(p.precioUnitarioUF) || 0
        const pCLP = Number(p.precioUnitarioCLP) || 0
        return {
          ...p,
          totalUF: cant * pUF,
          totalCLP: cant * pCLP,
          totalNeto: totalNetoPartida(cant, pCLP, ggPct / 100, utilPct / 100),
        }
      }),
    [partidas, ggPct, utilPct],
  )

  const presupuestoTotal = useMemo(
    () => partidasCalc.reduce((s, p) => s + p.totalNeto, 0),
    [partidasCalc],
  )

  function agregarPartida() {
    setPartidas([...partidas, partidaVacia()])
  }

  function cambiarPartida(i, campo, valor) {
    const copia = [...partidas]
    copia[i] = { ...copia[i], [campo]: valor }
    setPartidas(copia)
  }

  // Importa CSV exportado de Excel en formato chileno:
  // separador ';', decimales con coma, columnas de la hoja de control:
  // Descripción;Unidad;Cantidad;P.Unit UF;Total UF;P.Unit CLP;…
  function importarCsv(e) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    const reader = new FileReader()
    reader.onload = () => {
      const filas = String(reader.result)
        .split(/\r?\n/)
        .map((l) => l.split(';').map((c) => c.trim()))
      // Saltar portada/encabezado: las filas de partida tienen ≥6 columnas
      // y su columna 2 (cantidad) es numérica.
      const nuevas = filas
        .filter((cols) => cols.length >= 6 && numCL(cols[2]) > 0 && !/descripci/i.test(cols[0]))
        .map((cols) => ({
          nombre: cols[0],
          unidad: cols[1] || 'un',
          planificada: numCL(cols[2]),
          precioUnitarioUF: numCL(cols[3]) || '',
          precioUnitarioCLP: numCL(cols[5]) || '',
        }))
        .filter((p) => p.nombre)
      if (nuevas.length) setPartidas([...partidas, ...nuevas])
    }
    reader.readAsText(archivo, 'windows-1252')
    e.target.value = ''
  }

  function clonar(obraId) {
    const origen = clonables.find((o) => o.id === obraId)
    if (origen) {
      setPartidas(
        origen.partidas.map((p) => ({
          nombre: p.nombre,
          unidad: p.unidad,
          planificada: p.planificada,
          precioUnitarioUF: p.precioUnitarioUF ?? '',
          precioUnitarioCLP: p.precioUnitarioCLP ?? '',
        })),
      )
    }
  }

  function validarPaso() {
    if (paso === 0) return datos.nombre.trim() && datos.fechaInicio && datos.plazoDias > 0
    if (paso === 1)
      return partidas.length > 0 && partidas.every((p) => p.nombre.trim() && Number(p.planificada) > 0)
    return true
  }

  async function confirmar(activar) {
    setEnviando(true)
    setError('')
    try {
      const { obra } = await crearObra({
        ...datos,
        plazoDias: Number(datos.plazoDias),
        umbrales,
        ggPct: ggPct / 100,
        utilPct: utilPct / 100,
        partidas: partidas.map((p) => ({
          nombre: p.nombre,
          unidad: p.unidad,
          planificada: Number(p.planificada),
          precioUnitarioUF: Number(p.precioUnitarioUF) || null,
          precioUnitarioCLP: Number(p.precioUnitarioCLP) || null,
          presupuesto: Number(p.presupuesto) || 0,
        })),
        estado: activar ? 'activa' : 'borrador',
      })
      navigate(`/obras/${obra.id}`)
    } catch (e) {
      setError(e.message)
      setModalConfirmar(false)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-brand mb-3">
        <ArrowLeft size={15} /> Volver al tablero
      </Link>
      <h1 className="text-2xl mb-4">Nueva obra</h1>
      <PasoIndicador actual={paso} />

      {error && <p role="alert" className="text-sm text-semaforo-critico mb-4">{error}</p>}

      {paso === 0 && (
        <div className="space-y-4 bg-white dark:bg-ink-soft rounded-2xl border border-slate-200 dark:border-ink-muted/40 p-6">
          <div>
            <label htmlFor="nombre" className="block text-sm font-medium mb-1">Nombre de la obra *</label>
            <input id="nombre" className={inputClase} value={datos.nombre}
              onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
          </div>
          <div>
            <label htmlFor="ubicacion" className="block text-sm font-medium mb-1">Ubicación</label>
            <input id="ubicacion" className={inputClase} value={datos.ubicacion}
              onChange={(e) => setDatos({ ...datos, ubicacion: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="inicio" className="block text-sm font-medium mb-1">Fecha de inicio *</label>
              <input id="inicio" type="date" className={`${inputClase} cursor-pointer`}
                value={datos.fechaInicio}
                onChange={(e) => setDatos({ ...datos, fechaInicio: e.target.value })}
                onClick={(e) => e.target.showPicker?.()} />
            </div>
            <div>
              <label htmlFor="plazo" className="block text-sm font-medium mb-1">Plazo (días) *</label>
              <input id="plazo" type="number" min="1" className={inputClase} value={datos.plazoDias}
                onChange={(e) => setDatos({ ...datos, plazoDias: e.target.value })} />
            </div>
          </div>
        </div>
      )}

      {paso === 1 && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" onClick={agregarPartida}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-dark">
              <Plus size={15} /> Agregar partida
            </button>
            <label className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-ink-muted text-sm cursor-pointer hover:border-brand">
              Importar CSV
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={importarCsv} />
            </label>
            <select
              className={`${inputClase} w-auto`}
              defaultValue=""
              onChange={(e) => e.target.value && clonar(e.target.value)}
              aria-label="Clonar partidas de otra obra"
            >
              <option value="" disabled>Clonar de otra obra…</option>
              {clonables.map((o) => (
                <option key={o.id} value={o.id}>{o.nombre}</option>
              ))}
            </select>
            <div className="flex items-center gap-3 ml-auto text-sm">
              <label className="flex items-center gap-1 text-slate-500">
                GG %
                <input type="number" min="0" step="0.5" value={ggPct}
                  onChange={(e) => setGgPct(Number(e.target.value))}
                  className="w-20 rounded-md border border-slate-300 dark:border-ink-muted bg-transparent px-2 py-1.5 tabular-nums" />
              </label>
              <label className="flex items-center gap-1 text-slate-500">
                Utilidad %
                <input type="number" min="0" step="0.5" value={utilPct}
                  onChange={(e) => setUtilPct(Number(e.target.value))}
                  className="w-20 rounded-md border border-slate-300 dark:border-ink-muted bg-transparent px-2 py-1.5 tabular-nums" />
              </label>
            </div>
          </div>

          <div className="bg-white dark:bg-ink-soft rounded-2xl border border-slate-200 dark:border-ink-muted/40 overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-ink-muted/40">
                  <th className="px-3 py-2 font-medium w-64">Descripción</th>
                  <th className="px-3 py-2 font-medium w-16">Unidad</th>
                  <th className="px-3 py-2 font-medium w-24">Cantidad</th>
                  <th className="px-3 py-2 font-medium w-24">P. Unit. UF</th>
                  <th className="px-3 py-2 font-medium w-24 text-right">Total UF</th>
                  <th className="px-3 py-2 font-medium w-28">P. Unit. CLP</th>
                  <th className="px-3 py-2 font-medium w-28 text-right">Total CLP</th>
                  <th className="px-3 py-2 font-medium w-28 text-right">Total Neto CLP</th>
                  <th className="px-3 py-2 font-medium w-16 text-right">Incid. %</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {partidasCalc.map((p, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-ink-muted/20 last:border-0">
                    <td className="px-3 py-2">
                      <input className={celdaClase} placeholder="Descripción de la partida"
                        value={p.nombre} onChange={(e) => cambiarPartida(i, 'nombre', e.target.value)} />
                    </td>
                    <td className="px-3 py-2">
                      <input className={celdaClase} value={p.unidad}
                        onChange={(e) => cambiarPartida(i, 'unidad', e.target.value)} />
                    </td>
                    <td className="px-3 py-2">
                      <input className={celdaClase} type="number" min="0" step="any" value={p.planificada}
                        onChange={(e) => cambiarPartida(i, 'planificada', e.target.value)} />
                    </td>
                    <td className="px-3 py-2">
                      <input className={celdaClase} type="number" min="0" step="any" value={p.precioUnitarioUF}
                        onChange={(e) => cambiarPartida(i, 'precioUnitarioUF', e.target.value)} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                      {p.totalUF ? p.totalUF.toLocaleString('es-CL', { maximumFractionDigits: 2 }) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <input className={celdaClase} type="number" min="0" step="any" value={p.precioUnitarioCLP}
                        onChange={(e) => cambiarPartida(i, 'precioUnitarioCLP', e.target.value)} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                      {p.totalCLP ? clp(p.totalCLP) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-ink dark:text-white">
                      {p.totalNeto ? clp(p.totalNeto) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                      {presupuestoTotal ? `${(incidencia(p.totalNeto, presupuestoTotal) * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" aria-label="Quitar partida"
                        onClick={() => setPartidas(partidas.filter((_, j) => j !== i))}
                        className="p-1.5 text-slate-400 hover:text-semaforo-critico">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {partidas.length === 0 && (
              <p className="text-sm text-slate-500 py-6 text-center">
                Sin partidas. Agrega manualmente, importa un CSV (formato de la hoja de control) o clona otra obra.
              </p>
            )}
            {partidas.length > 0 && (
              <p className="text-sm text-slate-500 text-right px-4 py-3 border-t border-slate-200 dark:border-ink-muted/40">
                Total Neto (con GG {ggPct}% + utilidad {utilPct}%):{' '}
                <strong className="text-ink dark:text-white">{clp(presupuestoTotal)}</strong>
              </p>
            )}
          </div>
        </div>
      )}

      {paso === 2 && (
        <div className="bg-white dark:bg-ink-soft rounded-2xl border border-slate-200 dark:border-ink-muted/40 p-6">
          <p className="text-sm text-slate-500 mb-4">
            Umbrales del semáforo. Los valores por defecto son los recomendados; puedes ajustarlos por obra.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              ['plazoVerde', 'SPI verde ≥', 0.05],
              ['plazoAmarillo', 'SPI amarillo ≥', 0.05],
              ['costoVerde', 'CPI verde ≥', 0.05],
              ['costoAmarillo', 'CPI amarillo ≥', 0.05],
              ['materialesVerde', 'Materiales verde ≥ (0-1)', 0.05],
              ['materialesAmarillo', 'Materiales amarillo ≥ (0-1)', 0.05],
              ['docVerde', 'Doc. verde ≥ (0-1)', 0.05],
              ['docAmarillo', 'Doc. amarillo ≥ (0-1)', 0.05],
            ].map(([campo, etiqueta, step]) => (
              <div key={campo}>
                <label className="block text-sm font-medium mb-1" htmlFor={campo}>{etiqueta}</label>
                <input id={campo} type="number" step={step} min="0" max="2" className={inputClase}
                  value={umbrales[campo]}
                  onChange={(e) => setUmbrales({ ...umbrales, [campo]: Number(e.target.value) })} />
              </div>
            ))}
          </div>
        </div>
      )}

      {paso === 3 && (
        <div className="bg-white dark:bg-ink-soft rounded-2xl border border-slate-200 dark:border-ink-muted/40 p-6 space-y-3">
          <h2 className="text-lg">Revisión</h2>
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="text-slate-500">Nombre</dt><dd>{datos.nombre}</dd>
            <dt className="text-slate-500">Ubicación</dt><dd>{datos.ubicacion || '—'}</dd>
            <dt className="text-slate-500">Inicio</dt><dd>{datos.fechaInicio}</dd>
            <dt className="text-slate-500">Plazo</dt><dd>{datos.plazoDias} días</dd>
            <dt className="text-slate-500">Partidas</dt><dd>{partidas.length}</dd>
            <dt className="text-slate-500">GG / Utilidad</dt><dd>{ggPct}% / {utilPct}%</dd>
            <dt className="text-slate-500">Presupuesto neto</dt><dd>{clp(presupuestoTotal)}</dd>
          </dl>
          <p className="text-xs text-slate-500 border-t border-slate-200 dark:border-ink-muted/40 pt-3">
            Al activar, la línea base queda protegida. Los cambios posteriores se registran
            como modificaciones con fecha y responsable.
          </p>
        </div>
      )}

      <div className="flex justify-between mt-6">
        <button type="button" disabled={paso === 0} onClick={() => setPaso(paso - 1)}
          className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-ink-muted text-sm disabled:opacity-40">
          <ArrowLeft size={15} /> Anterior
        </button>
        {paso < PASOS.length - 1 ? (
          <button type="button" disabled={!validarPaso()} onClick={() => setPaso(paso + 1)}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium disabled:opacity-40 hover:bg-brand-dark">
            Siguiente <ArrowRight size={15} />
          </button>
        ) : (
          <button type="button" onClick={() => setModalConfirmar(true)}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-dark">
            <Check size={15} /> Crear obra
          </button>
        )}
      </div>

      <Modal abierto={modalConfirmar} onCerrar={() => !enviando && setModalConfirmar(false)} titulo="Confirmar creación">
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">
          ¿Crear la obra <strong>{datos.nombre}</strong>? Puedes dejarla como borrador o activarla ahora.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-end">
          <button type="button" disabled={enviando} onClick={() => confirmar(false)}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-ink-muted text-sm disabled:opacity-50">
            Guardar borrador
          </button>
          <button type="button" disabled={enviando} onClick={() => confirmar(true)}
            className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-dark disabled:opacity-50">
            {enviando ? 'Creando…' : 'Activar obra'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
