import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Trash2, Plus, Check } from 'lucide-react'
import { crearObra, obtenerObrasParaClonar } from '../lib/api.js'
import { UMBRALES_DEFECTO } from '../lib/calculos.js'
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
  const [umbrales, setUmbrales] = useState({ ...UMBRALES_DEFECTO })
  const [clonables, setClonables] = useState([])

  useEffect(() => {
    obtenerObrasParaClonar().then(setClonables).catch(() => {})
  }, [])

  const presupuestoTotal = useMemo(
    () => partidas.reduce((s, p) => s + (Number(p.presupuesto) || 0), 0),
    [partidas],
  )

  function agregarPartida() {
    setPartidas([...partidas, { nombre: '', unidad: 'm²', planificada: '', presupuesto: '' }])
  }

  function cambiarPartida(i, campo, valor) {
    const copia = [...partidas]
    copia[i] = { ...copia[i], [campo]: valor }
    setPartidas(copia)
  }

  function importarCsv(e) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    const reader = new FileReader()
    reader.onload = () => {
      const lineas = String(reader.result)
        .split(/\r?\n/)
        .map((l) => l.split(/[;,]/).map((c) => c.trim()))
        .filter((cols) => cols.length >= 4 && cols[0])
      const nuevas = lineas.map(([nombre, unidad, planificada, presupuesto]) => ({
        nombre,
        unidad: unidad || 'un',
        planificada: Number(planificada) || 0,
        presupuesto: Number(presupuesto) || 0,
      }))
      setPartidas([...partidas, ...nuevas])
    }
    reader.readAsText(archivo)
    e.target.value = ''
  }

  function clonar(obraId) {
    const origen = clonables.find((o) => o.id === obraId)
    if (origen) setPartidas(origen.partidas.map((p) => ({ ...p })))
  }

  function validarPaso() {
    if (paso === 0) return datos.nombre.trim() && datos.fechaInicio && datos.plazoDias > 0
    if (paso === 1) return partidas.length > 0 && partidas.every((p) => p.nombre.trim() && Number(p.planificada) > 0)
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
        partidas: partidas.map((p) => ({
          ...p,
          planificada: Number(p.planificada),
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
    <div className="max-w-3xl mx-auto">
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
          <div className="flex flex-wrap gap-2">
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
          </div>

          <div className="bg-white dark:bg-ink-soft rounded-2xl border border-slate-200 dark:border-ink-muted/40 p-4 space-y-3">
            {partidas.length === 0 && (
              <p className="text-sm text-slate-500 py-4 text-center">
                Sin partidas. Agrega manualmente, importa un CSV (nombre;unidad;cantidad;presupuesto) o clona otra obra.
              </p>
            )}
            {partidas.map((p, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input className={`${inputClase} col-span-5`} placeholder="Nombre de la partida"
                  value={p.nombre} onChange={(e) => cambiarPartida(i, 'nombre', e.target.value)} />
                <input className={`${inputClase} col-span-2`} placeholder="Unidad" value={p.unidad}
                  onChange={(e) => cambiarPartida(i, 'unidad', e.target.value)} />
                <input className={`${inputClase} col-span-2`} type="number" min="0" placeholder="Cantidad"
                  value={p.planificada} onChange={(e) => cambiarPartida(i, 'planificada', e.target.value)} />
                <input className={`${inputClase} col-span-2`} type="number" min="0" placeholder="$ presupuesto"
                  value={p.presupuesto} onChange={(e) => cambiarPartida(i, 'presupuesto', e.target.value)} />
                <button type="button" aria-label="Quitar partida"
                  onClick={() => setPartidas(partidas.filter((_, j) => j !== i))}
                  className="col-span-1 p-2 text-slate-400 hover:text-semaforo-critico">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {partidas.length > 0 && (
              <p className="text-sm text-slate-500 text-right pt-2">
                Presupuesto total: <strong className="text-ink dark:text-white">{clp(presupuestoTotal)}</strong>
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
            <dt className="text-slate-500">Presupuesto</dt><dd>{clp(presupuestoTotal)}</dd>
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
