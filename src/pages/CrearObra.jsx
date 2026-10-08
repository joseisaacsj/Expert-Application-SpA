import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Trash2, Plus, Check, Landmark } from 'lucide-react'
import { crearObra, obtenerObrasParaClonar } from '../lib/api.js'
import { obtenerIndicadores } from '../lib/indicadores.js'
import { UMBRALES_DEFECTO, totalNetoPartida, incidencia } from '../lib/calculos.js'
import Modal from '../components/Modal.jsx'
import { clp, fechaCorta } from '../lib/format.js'

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
  'w-full min-w-0 rounded-md border border-slate-200 dark:border-ink-muted/60 bg-transparent px-1.5 py-1 text-xs tabular-nums'

// Parsea números con formato chileno (miles con punto, decimales con coma).
function numCL(texto) {
  const limpio = String(texto ?? '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  return Number(limpio) || 0
}

const partidaVacia = () => ({
  item: '',
  nombre: '',
  etapa: '',
  unidad: 'M2',
  planificada: '',
  precioUnitarioUF: '',
  precioUnitarioCLP: '',
  subpartidas: [],
})

const subpartidaVacia = () => ({
  codigo: '',
  concepto: '',
  unidad: 'un',
  rendimiento: '',
  precioUnitario: '',
})

// Categorías base de gastos generales (mismas familias del registro real).
const GG_CATEGORIAS_BASE = () =>
  [
    'Arriendos operaciones',
    'Alimentación cuadrilla y personal',
    'Pasajes y traslados',
    'Caja chica / operaciones',
    'Equipos y herramientas',
    'Seguridad e inducciones',
    'Nómina personal indirecto',
    'Garantías y seguros',
  ].map((categoria) => ({ categoria, monto: '' }))

const ggFilaVacia = () => ({ categoria: '', monto: '' })

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
  const [ggPct, setGgPct] = useState(32.5) // % manual (solo si se desactiva el cálculo)
  const [ggManual, setGgManual] = useState(false)
  // Desglose de GG por categoría (como la hoja GASTOS_GENERALES del Excel):
  // el % se deduce automáticamente: total GG ÷ costo directo de las partidas.
  const [ggDesglose, setGgDesglose] = useState(GG_CATEGORIAS_BASE())
  const [utilPct, setUtilPct] = useState(15) // % utilidad
  const [umbrales, setUmbrales] = useState({ ...UMBRALES_DEFECTO })
  const [clonables, setClonables] = useState([])
  const [clonadaId, setClonadaId] = useState('') // '' = sin clonar
  const [indicadores, setIndicadores] = useState(null)
  const [valorUF, setValorUF] = useState('')
  const [apuAbierta, setApuAbierta] = useState(-1) // índice de partida con APU desplegado

  useEffect(() => {
    obtenerObrasParaClonar().then(setClonables).catch(() => {})
    obtenerIndicadores()
      .then((ind) => {
        setIndicadores(ind)
        setValorUF(ind.uf)
      })
      .catch(() => {})
  }, [])

  // Costo directo: suma de (cantidad × P.Unit CLP) sin GG ni utilidad.
  const directoTotal = useMemo(
    () =>
      partidas.reduce((s, p) => {
        const cant = Number(p.planificada) || 0
        const pCLP =
          Number(p.precioUnitarioCLP) ||
          Math.round((Number(p.precioUnitarioUF) || 0) * (Number(valorUF) || 0))
        return s + cant * pCLP
      }, 0),
    [partidas, valorUF],
  )

  // GG automático: total estimado por categorías ÷ costo directo.
  const ggTotalCLP = useMemo(
    () => ggDesglose.reduce((s, g) => s + (Number(g.monto) || 0), 0),
    [ggDesglose],
  )
  const ggEfectivo = ggManual
    ? Number(ggPct) || 0
    : directoTotal > 0 && ggTotalCLP > 0
      ? Math.round((ggTotalCLP / directoTotal) * 1000) / 10
      : 0

  // Totales calculados por partida (solo vista: el servidor los recalcula).
  const partidasCalc = useMemo(
    () =>
      partidas.map((p) => {
        const cant = Number(p.planificada) || 0
        const pUF = Number(p.precioUnitarioUF) || 0
        // Si solo hay precio UF, el CLP se deriva con la UF del día.
        const pCLP = Number(p.precioUnitarioCLP) || Math.round(pUF * (Number(valorUF) || 0))
        return {
          ...p,
          pCLPEfectivo: pCLP,
          totalUF: cant * pUF,
          totalCLP: cant * pCLP,
          totalNeto: totalNetoPartida(cant, pCLP, ggEfectivo / 100, utilPct / 100),
        }
      }),
    [partidas, ggEfectivo, utilPct, valorUF],
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

  // --- Subpartidas (APU) de una partida ---
  function cambiarSubpartida(i, j, campo, valor) {
    const copia = [...partidas]
    const subs = [...(copia[i].subpartidas || [])]
    subs[j] = { ...subs[j], [campo]: valor }
    copia[i] = { ...copia[i], subpartidas: subs }
    setPartidas(copia)
  }

  function agregarSubpartida(i) {
    const copia = [...partidas]
    copia[i] = { ...copia[i], subpartidas: [...(copia[i].subpartidas || []), subpartidaVacia()] }
    setPartidas(copia)
  }

  function quitarSubpartida(i, j) {
    const copia = [...partidas]
    copia[i] = { ...copia[i], subpartidas: copia[i].subpartidas.filter((_, k) => k !== j) }
    setPartidas(copia)
  }

  // Importa CSV exportado de Excel en formato chileno:
  // separador ';', decimales con coma, columnas de la hoja PRESUPUESTO:
  // Ítem;Descripción;Unidad;Cantidad;P.Unit UF;Total UF;P.Unit CLP;…
  function importarCsv(e) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    const reader = new FileReader()
    reader.onload = () => {
      const filas = String(reader.result)
        .split(/\r?\n/)
        .map((l) => l.split(';').map((c) => c.trim()))
      // Filas de partida: ≥7 columnas y cantidad numérica en la columna 3.
      const nuevas = filas
        .filter((cols) => cols.length >= 7 && numCL(cols[3]) > 0 && !/descripci|item/i.test(cols[0] + cols[1]))
        .map((cols) => ({
          item: cols[0],
          nombre: cols[1],
          etapa: /^E(\d)/i.exec(cols[1]) ? `Etapa ${/^E(\d)/i.exec(cols[1])[1]}` : '',
          unidad: (cols[2] || 'un').toLowerCase(),
          planificada: numCL(cols[3]),
          precioUnitarioUF: numCL(cols[4]) || '',
          precioUnitarioCLP: numCL(cols[6]) || '',
          subpartidas: [],
        }))
        .filter((p) => p.nombre)
      if (nuevas.length) setPartidas([...partidas, ...nuevas])
    }
    reader.readAsText(archivo, 'windows-1252')
    e.target.value = ''
  }

  function clonar(obraId) {
    // Seleccionar la opción vacía deshace el clonado y deja la tabla limpia.
    if (!obraId) {
      setClonadaId('')
      setPartidas([])
      return
    }
    const origen = clonables.find((o) => o.id === obraId)
    if (origen) {
      setClonadaId(obraId)
      setPartidas(
        origen.partidas.map((p) => ({
          item: p.item ?? '',
          nombre: p.nombre,
          etapa: p.etapa ?? '',
          unidad: p.unidad,
          planificada: p.planificada,
          precioUnitarioUF: p.precioUnitarioUF ?? '',
          precioUnitarioCLP: p.precioUnitarioCLP ?? '',
          subpartidas: (p.subpartidas || []).map((s) => ({ ...s })),
        })),
      )
      // Trae también los parámetros económicos de la obra origen.
      if (origen.ggPct != null) {
        setGgPct(Math.round(origen.ggPct * 1000) / 10)
        setUtilPct(Math.round((origen.utilPct ?? 0.15) * 1000) / 10)
      }
      if (origen.ggCategorias?.length) {
        setGgDesglose(
          origen.ggCategorias.map((c) => ({ categoria: c.categoria, monto: c.techoCLP || '' })),
        )
      }
    }
  }

  function cambiarGG(i, campo, valor) {
    const copia = [...ggDesglose]
    copia[i] = { ...copia[i], [campo]: valor }
    setGgDesglose(copia)
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
        ggPct: ggEfectivo / 100,
        utilPct: utilPct / 100,
        ggCategorias: ggManual
          ? []
          : ggDesglose
              .filter((g) => g.categoria.trim() && Number(g.monto) > 0)
              .map((g) => ({ categoria: g.categoria.trim(), techoCLP: Math.round(Number(g.monto)) })),
        valorUF: Number(valorUF) || null,
        partidas: partidasCalc.map((p) => ({
          item: p.item,
          nombre: p.nombre,
          etapa: p.etapa,
          unidad: p.unidad,
          planificada: Number(p.planificada),
          precioUnitarioUF: Number(p.precioUnitarioUF) || null,
          precioUnitarioCLP: p.pCLPEfectivo || null,
          subpartidas: (p.subpartidas || []).map((s) => ({
            codigo: s.codigo,
            concepto: s.concepto,
            unidad: s.unidad,
            rendimiento: Number(s.rendimiento) || 0,
            precioUnitario: Number(s.precioUnitario) || 0,
          })),
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
    <div className="max-w-7xl mx-auto">
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
              value={clonadaId}
              onChange={(e) => clonar(e.target.value)}
              aria-label="Clonar partidas de otra obra"
            >
              <option value="">Clonar de otra obra…</option>
              {clonables.map((o) => (
                <option key={o.id} value={o.id}>{o.nombre}</option>
              ))}
            </select>
            {clonadaId && (
              <button
                type="button"
                onClick={() => clonar('')}
                title="Deshacer clonado y vaciar partidas"
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-slate-500 border border-slate-300 dark:border-ink-muted hover:text-semaforo-critico hover:border-semaforo-critico"
              >
                <Trash2 size={13} /> Quitar clonado
              </button>
            )}
            <div className="flex items-center gap-3 ml-auto text-sm">
              <label className="flex items-center gap-1 text-slate-500">
                GG %
                <input type="number" min="0" step="0.5" value={ggEfectivo} readOnly={!ggManual}
                  onChange={(e) => setGgPct(Number(e.target.value))}
                  title={ggManual ? 'Ingreso manual' : 'Calculado: total GG ÷ costo directo'}
                  className={`w-20 rounded-md border bg-transparent px-2 py-1.5 tabular-nums ${
                    ggManual
                      ? 'border-slate-300 dark:border-ink-muted'
                      : 'border-brand/60 bg-brand/10 text-ink dark:text-white'
                  }`} />
              </label>
              <label className="flex items-center gap-1 text-xs text-slate-400">
                <input type="checkbox" checked={ggManual} onChange={(e) => setGgManual(e.target.checked)}
                  className="accent-brand" />
                manual
              </label>
              <label className="flex items-center gap-1 text-slate-500">
                Utilidad %
                <input type="number" min="0" step="0.5" value={utilPct}
                  onChange={(e) => setUtilPct(Number(e.target.value))}
                  className="w-20 rounded-md border border-slate-300 dark:border-ink-muted bg-transparent px-2 py-1.5 tabular-nums" />
              </label>
            </div>
          </div>

          {/* Indicadores económicos del día */}
          <div className="bg-white dark:bg-ink-soft rounded-2xl border border-slate-200 dark:border-ink-muted/40 p-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <Landmark size={17} className="text-brand" />
              Indicadores del día
            </span>
            <span className="text-sm text-slate-500">
              UF <strong className="text-ink dark:text-white tabular-nums">
                {valorUF ? clp(valorUF) : '…'}
              </strong>
            </span>
            <span className="text-sm text-slate-500">
              UTM <strong className="text-ink dark:text-white tabular-nums">
                {indicadores?.utm ? clp(indicadores.utm) : '…'}
              </strong>
            </span>
            <span className="text-xs text-slate-400 ml-auto">
              {indicadores
                ? `Fuente: ${indicadores.fuente}${indicadores.ufFecha ? ` · UF al ${fechaCorta(indicadores.ufFecha)}` : ''}`
                : 'Consultando indicadores…'}
            </span>
          </div>

          <div className="bg-white dark:bg-ink-soft rounded-2xl border border-slate-200 dark:border-ink-muted/40 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[11px] text-slate-500 border-b border-slate-200 dark:border-ink-muted/40">
                  <th className="px-2 py-2 font-medium w-16">Ítem</th>
                  <th className="px-2 py-2 font-medium">Descripción</th>
                  <th className="px-2 py-2 font-medium w-20">Etapa</th>
                  <th className="px-2 py-2 font-medium w-12">Unid.</th>
                  <th className="px-2 py-2 font-medium w-16">Cantidad</th>
                  <th className="px-2 py-2 font-medium w-16">P.Unit UF</th>
                  <th className="px-2 py-2 font-medium w-20 text-right">Total UF</th>
                  <th className="px-2 py-2 font-medium w-20">P.Unit CLP</th>
                  <th className="px-2 py-2 font-medium w-24 text-right">Total CLP</th>
                  <th className="px-2 py-2 font-medium w-24 text-right">Neto CLP</th>
                  <th className="px-2 py-2 font-medium w-12 text-right">Incid.</th>
                  <th className="px-2 py-2 font-medium w-12">APU</th>
                  <th className="px-2 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {partidasCalc.map((p, i) => (
                  <FragmentPartida
                    key={i}
                    p={p}
                    i={i}
                    presupuestoTotal={presupuestoTotal}
                    abierta={apuAbierta === i}
                    onToggleApu={() => setApuAbierta(apuAbierta === i ? -1 : i)}
                    onCambiar={cambiarPartida}
                    onCambiarSub={cambiarSubpartida}
                    onAgregarSub={agregarSubpartida}
                    onQuitarSub={quitarSubpartida}
                    onQuitar={() => setPartidas(partidas.filter((_, j) => j !== i))}
                  />
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
                Total Neto (con GG {ggEfectivo}% + utilidad {utilPct}%):{' '}
                <strong className="text-ink dark:text-white">{clp(presupuestoTotal)}</strong>
              </p>
            )}
          </div>

          {/* Desglose de gastos generales: el % se deduce de aquí */}
          <div className="bg-white dark:bg-ink-soft rounded-2xl border border-slate-200 dark:border-ink-muted/40 p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
              <p className="text-sm font-medium text-ink dark:text-white">
                Desglose de gastos generales
              </p>
              <p className="text-xs text-slate-400">
                El GG % se calcula solo: total estimado ÷ costo directo de las partidas.
              </p>
              {!ggManual && (
                <span className="ml-auto text-xs text-slate-500">
                  Total GG: <strong className="text-ink dark:text-white tabular-nums">{clp(ggTotalCLP)}</strong>
                  {directoTotal > 0 && (
                    <> · <strong className="text-brand tabular-nums">{ggEfectivo}%</strong> del costo directo</>
                  )}
                </span>
              )}
            </div>
            {!ggManual ? (
              <div className="space-y-1.5">
                {ggDesglose.map((g, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className="flex-1 min-w-0 rounded-md border border-slate-200 dark:border-ink-muted/60 bg-transparent px-2.5 py-1.5 text-sm"
                      placeholder="Descripción del gasto (ej: arriendos, alimentación, pasajes…)"
                      value={g.categoria}
                      onChange={(e) => cambiarGG(i, 'categoria', e.target.value)}
                    />
                    <input
                      type="number" min="0" step="1000"
                      className="w-28 shrink-0 rounded-md border border-slate-200 dark:border-ink-muted/60 bg-transparent px-2 py-1.5 text-sm text-right tabular-nums"
                      placeholder="CLP"
                      value={g.monto}
                      onChange={(e) => cambiarGG(i, 'monto', e.target.value)}
                      aria-label={`Monto ${g.categoria || `categoría ${i + 1}`}`}
                    />
                    <button type="button" aria-label="Quitar categoría"
                      onClick={() => setGgDesglose(ggDesglose.filter((_, k) => k !== i))}
                      className="p-1 text-slate-400 hover:text-semaforo-critico shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button type="button"
                  onClick={() => setGgDesglose([...ggDesglose, ggFilaVacia()])}
                  className="inline-flex items-center gap-1 text-xs text-brand hover:text-brand-dark font-medium mt-1">
                  <Plus size={13} /> Agregar categoría
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Modo manual activo: el GG % se toma del campo de arriba y este desglose no se envía.
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
              [
                'plazoVerde',
                'Plazo: verde hasta esta fracción del plazo consumido',
                'Ej: 0,33 = verde mientras no se haya consumido un tercio del plazo.',
              ],
              [
                'plazoAmarillo',
                'Plazo: amarillo hasta esta fracción del plazo consumido',
                'Ej: 0,50 = amarillo entre un tercio y la mitad del plazo.',
              ],
              [
                'plazoNaranja',
                'Plazo: naranja hasta esta fracción del plazo consumido',
                'Ej: 0,66 = naranja entre la mitad y dos tercios. Sobre esto, rojo.',
              ],
              [
                'costoVerde',
                'Desempeño de costo (CPI): verde si es mayor o igual a',
                'CPI = valor ganado ÷ gasto real. 1,00 = dentro del presupuesto.',
              ],
              [
                'costoAmarillo',
                'Desempeño de costo (CPI): amarillo si es mayor o igual a',
                'Bajo este valor el gasto supera claramente el valor ganado.',
              ],
              [
                'materialesVerde',
                'Materiales comprados: verde si la proporción es mayor o igual a',
                'Comprado ÷ requerido, de 0 a 1. Ej: 0,8 = 80% comprado.',
              ],
              [
                'materialesAmarillo',
                'Materiales comprados: amarillo si la proporción es mayor o igual a',
                'Bajo este valor el abastecimiento se considera crítico.',
              ],
              [
                'docVerde',
                'Reportes del día: verde si la proporción es mayor o igual a',
                'Personas que reportaron ÷ dotación activa. 1 = todos reportaron.',
              ],
              [
                'docAmarillo',
                'Reportes del día: amarillo si la proporción es mayor o igual a',
                'Bajo este valor la documentación diaria se considera crítica.',
              ],
            ].map(([campo, etiqueta, ayuda]) => (
              <div key={campo}>
                <label className="block text-sm font-medium mb-0.5" htmlFor={campo}>{etiqueta}</label>
                <p className="text-xs text-slate-400 mb-1.5">{ayuda}</p>
                <input id={campo} type="number" step={0.05} min="0" max="2" className={inputClase}
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
            <dt className="text-slate-500">GG / Utilidad</dt><dd>{ggEfectivo}% / {utilPct}%</dd>
            <dt className="text-slate-500">UF referencia</dt><dd>{valorUF ? clp(valorUF) : '—'}</dd>
            <dt className="text-slate-500">Presupuesto neto</dt><dd>{clp(presupuestoTotal)}</dd>
          </dl>
          <ul className="text-sm border-t border-slate-200 dark:border-ink-muted/40 pt-3 space-y-1">
            {partidasCalc.map((p, i) => (
              <li key={i} className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-slate-400 w-14 shrink-0">{p.item || `#${i + 1}`}</span>
                <span className="text-ink dark:text-white">{p.nombre}</span>
                <span className="text-xs text-slate-500">
                  {p.etapa && `${p.etapa} · `}{Number(p.planificada).toLocaleString('es-CL')} {p.unidad}
                  {p.subpartidas?.filter((s) => s.concepto?.trim()).length > 0 &&
                    ` · ${p.subpartidas.filter((s) => s.concepto?.trim()).length} insumos APU`}
                </span>
                <span className="ml-auto text-xs tabular-nums text-slate-500">{clp(p.totalNeto)}</span>
              </li>
            ))}
          </ul>
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

// Fila de partida + panel desplegable de subpartidas (APU).
function FragmentPartida({
  p, i, presupuestoTotal, abierta, onToggleApu,
  onCambiar, onCambiarSub, onAgregarSub, onQuitarSub, onQuitar,
}) {
  const subs = p.subpartidas || []
  const totalApu = subs.reduce(
    (s, x) => s + (Number(x.rendimiento) || 0) * (Number(x.precioUnitario) || 0),
    0,
  )
  return (
    <>
      <tr className="border-b border-slate-100 dark:border-ink-muted/20">
        <td className="px-1.5 py-1.5">
          <input className={celdaClase} placeholder="1.1.1" value={p.item}
            onChange={(e) => onCambiar(i, 'item', e.target.value)} />
        </td>
        <td className="px-1.5 py-1.5">
          <input className={celdaClase} placeholder="Descripción de la partida"
            value={p.nombre} onChange={(e) => onCambiar(i, 'nombre', e.target.value)} />
        </td>
        <td className="px-1.5 py-1.5">
          <input className={celdaClase} placeholder="Etapa 1" value={p.etapa}
            onChange={(e) => onCambiar(i, 'etapa', e.target.value)} />
        </td>
        <td className="px-1.5 py-1.5">
          <input className={celdaClase} value={p.unidad}
            onChange={(e) => onCambiar(i, 'unidad', e.target.value)} />
        </td>
        <td className="px-1.5 py-1.5">
          <input className={celdaClase} type="number" min="0" step="any" value={p.planificada}
            onChange={(e) => onCambiar(i, 'planificada', e.target.value)} />
        </td>
        <td className="px-1.5 py-1.5">
          <input className={celdaClase} type="number" min="0" step="any" value={p.precioUnitarioUF}
            onChange={(e) => onCambiar(i, 'precioUnitarioUF', e.target.value)} />
        </td>
        <td className="px-1.5 py-1.5 text-right tabular-nums text-slate-500">
          {p.totalUF ? p.totalUF.toLocaleString('es-CL', { maximumFractionDigits: 2 }) : '—'}
        </td>
        <td className="px-1.5 py-1.5">
          <input className={celdaClase} type="number" min="0" step="any" value={p.precioUnitarioCLP}
            placeholder={p.precioUnitarioUF && !p.precioUnitarioCLP ? `auto: ${clp(p.pCLPEfectivo)}` : ''}
            onChange={(e) => onCambiar(i, 'precioUnitarioCLP', e.target.value)} />
        </td>
        <td className="px-1.5 py-1.5 text-right tabular-nums text-slate-500">
          {p.totalCLP ? clp(p.totalCLP) : '—'}
        </td>
        <td className="px-1.5 py-1.5 text-right tabular-nums font-medium text-ink dark:text-white">
          {p.totalNeto ? clp(p.totalNeto) : '—'}
        </td>
        <td className="px-1.5 py-1.5 text-right tabular-nums text-slate-500">
          {presupuestoTotal ? `${(incidencia(p.totalNeto, presupuestoTotal) * 100).toFixed(1)}%` : '—'}
        </td>
        <td className="px-1.5 py-1.5">
          <button
            type="button"
            onClick={onToggleApu}
            className={`px-2 py-1 rounded-md text-xs font-medium ${
              abierta || subs.length > 0
                ? 'bg-brand/15 text-brand dark:text-brand-light'
                : 'text-slate-400 hover:text-brand border border-slate-200 dark:border-ink-muted/40'
            }`}
          >
            {subs.length > 0 ? `${subs.length} ins.` : 'APU'}
          </button>
        </td>
        <td className="px-1.5 py-1.5">
          <button type="button" aria-label="Quitar partida" onClick={onQuitar}
            className="p-1.5 text-slate-400 hover:text-semaforo-critico">
            <Trash2 size={15} />
          </button>
        </td>
      </tr>
      {abierta && (
        <tr className="border-b border-slate-100 dark:border-ink-muted/20 bg-slate-50/60 dark:bg-ink/30">
          <td colSpan={13} className="px-6 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Subpartidas — análisis de precio unitario (APU)
              </p>
              <button type="button" onClick={() => onAgregarSub(i)}
                className="text-xs text-brand font-medium">
                + Agregar insumo
              </button>
            </div>
            {subs.length === 0 ? (
              <p className="text-xs text-slate-400">
                Sin subpartidas. Agrega insumos con su rendimiento y precio para descomponer el precio unitario.
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-1 pr-2 font-medium w-28">Código</th>
                    <th className="py-1 pr-2 font-medium">Concepto / Insumo</th>
                    <th className="py-1 pr-2 font-medium w-16">Unidad</th>
                    <th className="py-1 pr-2 font-medium w-24">Rendimiento</th>
                    <th className="py-1 pr-2 font-medium w-28">P. Unit. $</th>
                    <th className="py-1 pr-2 font-medium w-28 text-right">Costo directo</th>
                    <th className="py-1 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s, j) => (
                    <tr key={j}>
                      <td className="py-1 pr-2">
                        <input className={celdaClase} value={s.codigo}
                          onChange={(e) => onCambiarSub(i, j, 'codigo', e.target.value)} />
                      </td>
                      <td className="py-1 pr-2">
                        <input className={celdaClase} placeholder="Ej: AlphaGuard BIO Base Coat"
                          value={s.concepto}
                          onChange={(e) => onCambiarSub(i, j, 'concepto', e.target.value)} />
                      </td>
                      <td className="py-1 pr-2">
                        <input className={celdaClase} value={s.unidad}
                          onChange={(e) => onCambiarSub(i, j, 'unidad', e.target.value)} />
                      </td>
                      <td className="py-1 pr-2">
                        <input className={celdaClase} type="number" min="0" step="any" value={s.rendimiento}
                          onChange={(e) => onCambiarSub(i, j, 'rendimiento', e.target.value)} />
                      </td>
                      <td className="py-1 pr-2">
                        <input className={celdaClase} type="number" min="0" step="any" value={s.precioUnitario}
                          onChange={(e) => onCambiarSub(i, j, 'precioUnitario', e.target.value)} />
                      </td>
                      <td className="py-1 pr-2 text-right tabular-nums text-slate-500">
                        {clp((Number(s.rendimiento) || 0) * (Number(s.precioUnitario) || 0))}
                      </td>
                      <td className="py-1">
                        <button type="button" aria-label="Quitar insumo" onClick={() => onQuitarSub(i, j)}
                          className="p-1 text-slate-400 hover:text-semaforo-critico">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {subs.length > 0 && (
              <p className="text-xs text-slate-500 text-right mt-2">
                Costo directo unitario calculado:{' '}
                <strong className="text-ink dark:text-white">{clp(totalApu)}</strong> / {p.unidad}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
