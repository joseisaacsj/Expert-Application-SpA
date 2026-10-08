import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CloudRainWind,
  Lock,
  Save,
} from 'lucide-react'
import { obtenerPlanificacion, guardarPlanificacionDia } from '../lib/api.js'
import ObraNav from '../components/ObraNav.jsx'
import Modal from '../components/Modal.jsx'
import { fechaCorta, fechaISO } from '../lib/format.js'
import { diasEntre } from '../lib/calculos.js'
import { useAuth } from '../context/auth.js'

const DIAS_SEM = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// Semanas (lunes primero) del mes que contiene `fecha`.
function semanasDelMes(fecha) {
  const primero = new Date(fecha.getFullYear(), fecha.getMonth(), 1)
  const ultimo = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0)
  const offset = (primero.getDay() + 6) % 7 // lunes = 0
  const celdas = []
  for (let i = 0; i < offset; i++) celdas.push(null)
  for (let d = 1; d <= ultimo.getDate(); d++) celdas.push(new Date(fecha.getFullYear(), fecha.getMonth(), d))
  const semanas = []
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7))
  return semanas
}

const numFmt = (n) => Number(n).toLocaleString('es-CL', { maximumFractionDigits: 1 })

export default function Planificacion() {
  const { id } = useParams()
  const { usuario } = useAuth()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [mes, setMes] = useState(null)
  const [diaSel, setDiaSel] = useState(null) // 'yyyy-mm-dd'
  const [edicion, setEdicion] = useState({}) // partidaId -> cantidad (texto)
  const [modal, setModal] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    obtenerPlanificacion(id)
      .then((d) => {
        setDatos(d)
        // Mes inicial: el que contiene hoy, acotado al rango de la obra.
        const hoyD = new Date(`${fechaISO()}T12:00`)
        const ini = new Date(`${d.fechaInicio}T12:00`)
        const fin = new Date(`${d.fechaTermino}T12:00`)
        setMes(hoyD < ini ? ini : hoyD > fin ? fin : hoyD)
      })
      .catch((e) => setError(e.message))
  }, [id])

  const hoy = fechaISO()
  const semanas = useMemo(() => (mes ? semanasDelMes(mes) : []), [mes])
  const ejecDia = diaSel ? datos?.ejecPorFecha[diaSel] || {} : {}
  const sinFaenaDia = diaSel && datos?.sinFaenaFechas.includes(diaSel)

  const cambiosDia = useMemo(() => {
    if (!diaSel || !datos) return []
    const planDia = datos.planPorFecha[diaSel] || {}
    return datos.partidas
      .map((p) => ({ partidaId: p.id, cantidad: Number(edicion[p.id]) || 0 }))
      .filter((c) => c.cantidad !== (planDia[c.partidaId] || 0))
  }, [datos, diaSel, edicion])

  function abrirDia(fecha) {
    if (!datos || fecha < datos.fechaInicio || fecha > datos.fechaTermino) return
    setDiaSel(fecha)
    const inicial = {}
    for (const p of datos.partidas) {
      const v = datos.planPorFecha[fecha]?.[p.id]
      inicial[p.id] = v != null ? String(v) : ''
    }
    setEdicion(inicial)
  }

  function moverMes(delta) {
    const d = new Date(mes.getFullYear(), mes.getMonth() + delta, 1)
    const ini = new Date(`${datos.fechaInicio}T12:00`)
    const fin = new Date(`${datos.fechaTermino}T12:00`)
    if (d < new Date(ini.getFullYear(), ini.getMonth(), 1)) return
    if (d > new Date(fin.getFullYear(), fin.getMonth(), 1)) return
    setMes(d)
  }

  async function guardarDia() {
    setGuardando(true)
    try {
      await guardarPlanificacionDia(id, diaSel, cambiosDia)
      const nuevoPlan = { ...datos.planPorFecha }
      const porDia = { ...(nuevoPlan[diaSel] || {}) }
      for (const c of cambiosDia) {
        if (c.cantidad > 0) porDia[c.partidaId] = c.cantidad
        else delete porDia[c.partidaId]
      }
      if (Object.keys(porDia).length) nuevoPlan[diaSel] = porDia
      else delete nuevoPlan[diaSel]
      setDatos({ ...datos, planPorFecha: nuevoPlan })
      setDiaSel(null)
      setModal({
        titulo: 'Plan del día guardado',
        texto: 'La curva "programado" y los indicadores se recalculan con este plan. El cambio quedó en la auditoría de la obra.',
      })
    } catch (e) {
      setModal({ titulo: 'No se pudo guardar', texto: e.message })
    } finally {
      setGuardando(false)
    }
  }

  if (error) {
    return (
      <div>
        <Link to={`/obras/${id}`} className="inline-flex items-center gap-1 text-sm text-brand mb-4">
          <ArrowLeft size={15} /> Volver a la obra
        </Link>
        <p role="alert" className="text-semaforo-critico">{error}</p>
      </div>
    )
  }
  if (!datos || !mes) return <p className="text-slate-500">Cargando planificación…</p>

  const esTrabajador = usuario?.rolPrincipal === 'trabajador'
  const veCostos = !['trabajador', 'rrhh'].includes(usuario?.rolPrincipal)
  const nombreMes = mes.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-5">
      <div>
        <Link to={`/obras/${id}`} className="inline-flex items-center gap-1 text-sm text-brand mb-3">
          <ArrowLeft size={15} /> Volver a la obra
        </Link>
        <h1 className="text-2xl flex items-center gap-2">
          <CalendarRange size={22} className="text-brand" /> Planificación diaria
        </h1>
        <p className="text-sm text-slate-500">
          {datos.obraNombre} — {fechaCorta(datos.fechaInicio)} al {fechaCorta(datos.fechaTermino)} ·
          programado a hoy: <strong className="text-ink dark:text-white">{Math.round(datos.avanceProgramadoHoy * 100)}%</strong>
        </p>
      </div>

      <ObraNav
        obraId={id}
        veCostos={veCostos}
        esTrabajador={esTrabajador}
        puedePlanificar={datos.puedeEditar}
      />

      {!datos.puedeEditar && (
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <Lock size={12} /> Solo el supervisor de obra y administración modifican el plan.
          Esta vista es de consulta.
        </p>
      )}

      {/* Calendario mensual */}
      <div className="rounded-2xl border border-slate-200 dark:border-ink-muted/40 bg-white dark:bg-ink-soft p-4">
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={() => moverMes(-1)} aria-label="Mes anterior"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-ink-muted/30">
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-base font-medium capitalize text-ink dark:text-white">{nombreMes}</h2>
          <button type="button" onClick={() => moverMes(1)} aria-label="Mes siguiente"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-ink-muted/30">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400 mb-1">
          {DIAS_SEM.map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {semanas.flat().map((d, i) => {
            if (!d) return <div key={`v-${i}`} />
            const f = fechaISO(d)
            const enObra = f >= datos.fechaInicio && f <= datos.fechaTermino
            const plan = datos.planPorFecha[f]
            const nPlan = plan ? Object.keys(plan).length : 0
            const ejecuto = !!datos.ejecPorFecha[f]
            const sinFaena = datos.sinFaenaFechas.includes(f)
            const esHoy = f === hoy
            return (
              <button
                key={f}
                type="button"
                disabled={!enObra}
                onClick={() => abrirDia(f)}
                aria-label={`Día ${fechaCorta(f)}${nPlan ? `, ${nPlan} partidas planificadas` : ''}`}
                className={`min-h-16 rounded-lg border p-1.5 text-left flex flex-col transition-colors ${
                  !enObra
                    ? 'border-transparent bg-slate-50/50 dark:bg-ink/20 text-slate-300 dark:text-ink-muted cursor-default'
                    : esHoy
                      ? 'border-brand bg-brand/10'
                      : 'border-slate-200 dark:border-ink-muted/30 hover:border-brand/60'
                }`}
              >
                <span className={`text-xs font-medium ${enObra ? 'text-ink dark:text-white' : ''}`}>
                  {d.getDate()}
                </span>
                {enObra && (
                  <span className="mt-auto flex items-center gap-1 flex-wrap">
                    {nPlan > 0 && (
                      <span className="text-[10px] px-1 rounded bg-brand/15 text-brand dark:text-brand-light font-medium">
                        {nPlan} ít.
                      </span>
                    )}
                    {ejecuto && (
                      <span className="text-[10px] px-1 rounded bg-semaforo-verde/15 text-semaforo-verde font-medium">
                        real
                      </span>
                    )}
                    {sinFaena && <CloudRainWind size={11} className="text-slate-400" />}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          <span className="inline-block px-1 rounded bg-brand/15 text-brand dark:text-brand-light font-medium mr-1">n ít.</span>
          partidas planificadas ·
          <span className="inline-block px-1 rounded bg-semaforo-verde/15 text-semaforo-verde font-medium mx-1">real</span>
          con producción reportada ·
          <CloudRainWind size={11} className="inline mx-1 -mt-0.5" />
          día sin faena. Toca un día para ver o editar su plan.
        </p>
      </div>

      {/* Modal del día: plan por partida */}
      <Modal
        abierto={!!diaSel}
        onCerrar={() => !guardando && setDiaSel(null)}
        titulo={
          diaSel
            ? `Plan del ${fechaCorta(diaSel)} — día ${diasEntre(datos.fechaInicio, diaSel) + 1} de ${datos.plazoDias}`
            : ''
        }
      >
        {diaSel && (
          <div className="space-y-4">
            {sinFaenaDia && (
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <CloudRainWind size={13} /> Este día fue declarado sin faena.
              </p>
            )}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {datos.partidas.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-xs text-slate-400 mr-1.5">{p.item}</span>
                    <span className="text-ink dark:text-white">{p.nombre}</span>
                    <span className="block text-[10px] text-slate-400">
                      total {p.planificada.toLocaleString('es-CL')} {p.unidad} ·
                      ejecutado {Math.round(p.avance * 100)}%
                      {ejecDia[p.id] ? ` · real hoy: ${numFmt(ejecDia[p.id])} ${p.unidad}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center rounded-md border border-slate-300 dark:border-ink-muted overflow-hidden shrink-0">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      placeholder="0"
                      disabled={!datos.puedeEditar}
                      value={edicion[p.id] ?? ''}
                      onChange={(e) => setEdicion({ ...edicion, [p.id]: e.target.value })}
                      className="w-24 bg-transparent px-2 py-1.5 text-sm text-right tabular-nums disabled:opacity-60 focus:outline-none"
                      aria-label={`Plan ${p.item} en ${p.unidad}`}
                    />
                    <span className="px-2 py-1.5 text-xs font-medium text-slate-500 bg-slate-100 dark:bg-ink-muted/30 border-l border-slate-300 dark:border-ink-muted">
                      {p.unidad}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {datos.puedeEditar ? (
              <button
                type="button"
                disabled={cambiosDia.length === 0 || guardando}
                onClick={guardarDia}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand text-white py-2.5 text-sm font-medium disabled:opacity-40 hover:bg-brand-dark"
              >
                <Save size={15} />
                {guardando ? 'Guardando…' : `Guardar plan del día (${cambiosDia.length} cambio${cambiosDia.length !== 1 ? 's' : ''})`}
              </button>
            ) : (
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Lock size={12} /> Solo lectura para tu rol.
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Modal de resultado */}
      <Modal abierto={!!modal} onCerrar={() => setModal(null)} titulo={modal?.titulo || ''}>
        <p className="text-sm text-slate-600 dark:text-slate-300">{modal?.texto}</p>
        <button type="button" onClick={() => setModal(null)}
          className="mt-4 w-full rounded-lg bg-brand text-white py-2 text-sm font-medium">
          Entendido
        </button>
      </Modal>
    </div>
  )
}
