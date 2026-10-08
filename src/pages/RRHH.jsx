import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Lock, CheckCircle2, XCircle, CloudRainWind, Pencil, Plus, Trash2 } from 'lucide-react'
import { obtenerTablero, obtenerRRHH, guardarDotacion } from '../lib/api.js'
import Semaforo from '../components/Semaforo.jsx'
import ObraNav from '../components/ObraNav.jsx'
import Modal from '../components/Modal.jsx'
import { clp } from '../lib/format.js'
import { useAuth } from '../context/auth.js'

const celda =
  'w-full min-w-0 rounded-md border border-slate-200 dark:border-ink-muted/60 bg-transparent px-1.5 py-1 text-xs tabular-nums'

const personaNueva = () => ({ nombre: '', cargo: '', sueldoBase: '', tratos: '', activo: true })

export default function RRHH() {
  const { id } = useParams()
  const { usuario } = useAuth()
  const [obras, setObras] = useState(null)
  const [obraId, setObraId] = useState(id || '')
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [editando, setEditando] = useState(false)
  const [borradores, setBorradores] = useState({})
  const [nuevas, setNuevas] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [modalMsg, setModalMsg] = useState(null)

  useEffect(() => {
    obtenerTablero()
      .then((t) => {
        const activas = t.filter((o) => o.estado === 'activa')
        setObras(activas)
        setObraId((actual) => actual || activas[0]?.id || '')
      })
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!obraId) return
    obtenerRRHH(obraId)
      .then((d) => setDatos({ obraId, ...d }))
      .catch((e) => setError(e.message))
  }, [obraId])

  if (error) return <p role="alert" className="text-semaforo-critico">{error}</p>
  if (!obras) return <p className="text-slate-500">Cargando…</p>

  const docPct =
    datos && datos.totalReportadores > 0 ? datos.reportaronHoy / datos.totalReportadores : 1
  const docNivel = datos?.sinFaenaHoy
    ? 'verde'
    : docPct >= 1
      ? 'verde'
      : docPct >= 0.5
        ? 'amarillo'
        : 'critico'
  const veCostos = !['trabajador', 'rrhh'].includes(usuario?.rolPrincipal)
  const hayCambios = Object.keys(borradores).length > 0 || nuevas.length > 0

  const borrador = (d) => borradores[d.id] || { ...d }
  const cambiar = (d, campo, valor) =>
    setBorradores({ ...borradores, [d.id]: { ...borrador(d), [campo]: valor } })
  const cambiarNueva = (i, campo, valor) => {
    const copia = [...nuevas]
    copia[i] = { ...copia[i], [campo]: valor }
    setNuevas(copia)
  }
  const cancelarEdicion = () => {
    setEditando(false)
    setBorradores({})
    setNuevas([])
  }

  async function guardar() {
    setGuardando(true)
    try {
      for (const did of Object.keys(borradores)) {
        await guardarDotacion(obraId, { id: did, ...borradores[did] })
      }
      for (const n of nuevas) {
        if (n.nombre.trim()) await guardarDotacion(obraId, n)
      }
      const d = await obtenerRRHH(obraId)
      setDatos({ obraId, ...d })
      cancelarEdicion()
      setModalMsg({ titulo: 'Dotación actualizada', texto: 'Los cambios quedaron en la auditoría.' })
    } catch (e) {
      setModalMsg({ titulo: 'No se pudo guardar', texto: e.message })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl">Dotación y asistencia</h1>
          <p className="text-sm text-slate-500">Nómina de obra y estado de reportes del día.</p>
        </div>
        <div className="flex items-center gap-2">
          {datos?.puedeEditar && !editando && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-ink-muted text-sm font-medium hover:border-brand hover:text-brand"
            >
              <Pencil size={15} /> Editar dotación
            </button>
          )}
        </div>
        <select
          value={obraId}
          onChange={(e) => setObraId(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-ink-muted bg-white dark:bg-ink-soft px-3 py-2 text-sm"
          aria-label="Seleccionar obra"
        >
          {obras.map((o) => (
            <option key={o.id} value={o.id}>{o.nombre}</option>
          ))}
        </select>
      </div>

      {id && (
        <ObraNav
          obraId={id}
          veCostos={veCostos}
          esTrabajador={usuario?.rolPrincipal === 'trabajador'}
          puedePlanificar={['admin', 'supervisor'].includes(usuario?.rolPrincipal)}
        />
      )}

      {!datos || datos.obraId !== obraId ? (
        <p className="text-slate-500">Cargando dotación…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-ink-muted/40 bg-white dark:bg-ink-soft p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Nómina activa</div>
              <div className="text-2xl font-semibold">{datos.total}</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-ink-muted/40 bg-white dark:bg-ink-soft p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Cuadrillas que reportan</div>
              <div className="text-2xl font-semibold">{datos.totalReportadores}</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-ink-muted/40 bg-white dark:bg-ink-soft p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Reportaron hoy</div>
              <div className="text-2xl font-semibold">{datos.reportaronHoy}</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-ink-muted/40 bg-white dark:bg-ink-soft p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Documentación</div>
              {datos.sinFaenaHoy ? (
                <span className="inline-flex items-center gap-1 text-sm text-slate-500">
                  <CloudRainWind size={15} /> Día sin faena
                </span>
              ) : (
                <Semaforo nivel={docNivel} etiqueta={`${Math.round(docPct * 100)}%`} />
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-ink-muted/40 bg-white dark:bg-ink-soft">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-ink-muted/40">
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Cargo</th>
                  <th className="px-4 py-3 font-medium">Reporte hoy</th>
                  {editando && datos.puedeVerSueldos && <th className="px-4 py-3 font-medium text-right">Sueldo base</th>}
                  {editando && datos.puedeVerSueldos && <th className="px-4 py-3 font-medium text-right">Tratos</th>}
                  {datos.puedeVerSueldos && <th className="px-4 py-3 font-medium text-right">Imponible</th>}
                  {datos.puedeVerSueldos && <th className="px-4 py-3 font-medium text-right">Costo empresa</th>}
                  {datos.puedeVerSueldos && <th className="px-4 py-3 font-medium text-right">Proy. plazo</th>}
                  {editando && <th className="px-4 py-3 font-medium text-center">Activo</th>}
                </tr>
              </thead>
              <tbody>
                {datos.dotacion.map((d) => {
                  if (editando) {
                    const b = borrador(d)
                    const imponible = (Number(b.sueldoBase) || 0) + (Number(b.tratos) || 0)
                    return (
                      <tr key={d.id} className={`border-b border-slate-100 dark:border-ink-muted/20 ${b.activo === false ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-1.5">
                          <input className={celda} value={b.nombre}
                            onChange={(e) => cambiar(d, 'nombre', e.target.value)} />
                        </td>
                        <td className="px-4 py-1.5">
                          <input className={celda} value={b.cargo}
                            onChange={(e) => cambiar(d, 'cargo', e.target.value)} />
                        </td>
                        <td className="px-4 py-1.5 text-xs text-slate-400">
                          {!d.reporta ? 'No reporta' : d.reportoHoy ? 'Reportado' : 'Pendiente'}
                        </td>
                        {datos.puedeVerSueldos && (
                          <td className="px-4 py-1.5 w-28">
                            <input className={`${celda} text-right`} type="number" min="0" step="10000"
                              value={b.sueldoBase ?? ''}
                              onChange={(e) => cambiar(d, 'sueldoBase', e.target.value)} />
                          </td>
                        )}
                        {datos.puedeVerSueldos && (
                          <td className="px-4 py-1.5 w-24">
                            <input className={`${celda} text-right`} type="number" min="0" step="10000"
                              value={b.tratos ?? ''}
                              onChange={(e) => cambiar(d, 'tratos', e.target.value)} />
                          </td>
                        )}
                        {datos.puedeVerSueldos && (
                          <td className="px-4 py-1.5 text-right tabular-nums text-xs">{clp(imponible)}</td>
                        )}
                        {datos.puedeVerSueldos && (
                          <td className="px-4 py-1.5 text-right tabular-nums text-xs">{clp(Math.round(imponible * 1.3))}</td>
                        )}
                        {datos.puedeVerSueldos && <td />}
                        <td className="px-4 py-1.5 text-center">
                          <input type="checkbox" checked={b.activo !== false}
                            onChange={(e) => cambiar(d, 'activo', e.target.checked)}
                            className="accent-brand" aria-label={`${d.nombre} activo`} />
                        </td>
                      </tr>
                    )
                  }
                  return (
                    <tr key={d.id} className={`border-b border-slate-100 dark:border-ink-muted/20 last:border-0 ${d.activo === false ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-medium text-ink dark:text-white">
                        {d.nombre}
                        {d.activo === false && <span className="ml-2 text-xs text-slate-400">(desvinculado)</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{d.cargo}</td>
                      <td className="px-4 py-3">
                        {!d.reporta ? (
                          <span className="text-xs text-slate-400">No reporta</span>
                        ) : d.reportoHoy ? (
                          <span className="inline-flex items-center gap-1 text-semaforo-verde text-xs font-medium">
                            <CheckCircle2 size={14} /> Reportado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400 text-xs font-medium">
                            <XCircle size={14} /> Pendiente
                          </span>
                        )}
                      </td>
                      {datos.puedeVerSueldos && (
                        <td className="px-4 py-3 text-right tabular-nums">
                          {d.imponible != null ? clp(d.imponible) : '—'}
                        </td>
                      )}
                      {datos.puedeVerSueldos && (
                        <td className="px-4 py-3 text-right tabular-nums">
                          {d.costoMensual != null ? clp(d.costoMensual) : '—'}
                        </td>
                      )}
                      {datos.puedeVerSueldos && (
                        <td className="px-4 py-3 text-right tabular-nums">
                          {d.proyectado145d != null ? clp(d.proyectado145d) : '—'}
                        </td>
                      )}
                    </tr>
                  )
                })}
                {editando &&
                  nuevas.map((n, i) => (
                    <tr key={`per-${i}`} className="border-b border-brand/30 bg-brand/5">
                      <td className="px-4 py-1.5">
                        <input className={celda} placeholder="Nombre" value={n.nombre}
                          onChange={(e) => cambiarNueva(i, 'nombre', e.target.value)} />
                      </td>
                      <td className="px-4 py-1.5">
                        <input className={celda} placeholder="Cargo" value={n.cargo}
                          onChange={(e) => cambiarNueva(i, 'cargo', e.target.value)} />
                      </td>
                      <td />
                      {datos.puedeVerSueldos && (
                        <td className="px-4 py-1.5 w-28">
                          <input className={`${celda} text-right`} type="number" min="0" step="10000"
                            placeholder="Sueldo" value={n.sueldoBase}
                            onChange={(e) => cambiarNueva(i, 'sueldoBase', e.target.value)} />
                        </td>
                      )}
                      {datos.puedeVerSueldos && (
                        <td className="px-4 py-1.5 w-24">
                          <input className={`${celda} text-right`} type="number" min="0" step="10000"
                            placeholder="Tratos" value={n.tratos}
                            onChange={(e) => cambiarNueva(i, 'tratos', e.target.value)} />
                        </td>
                      )}
                      {datos.puedeVerSueldos && <td colSpan={3} />}
                      <td className="px-4 py-1.5 text-center">
                        <button type="button" aria-label="Quitar fila"
                          onClick={() => setNuevas(nuevas.filter((_, k) => k !== i))}
                          className="p-1 text-slate-400 hover:text-semaforo-critico">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {editando && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setNuevas([...nuevas, personaNueva()])}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-brand text-brand text-sm font-medium hover:bg-brand/10"
              >
                <Plus size={15} /> Agregar persona
              </button>
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={cancelarEdicion}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-ink-muted text-sm">
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!hayCambios || guardando}
                  onClick={guardar}
                  className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-dark disabled:opacity-40"
                >
                  {guardando ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          )}
          {!datos.puedeVerSueldos && (
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Lock size={12} /> Las remuneraciones solo se muestran a RRHH, Finanzas, Supervisor y Gerencia.
            </p>
          )}
        </>
      )}

      <Modal abierto={!!modalMsg} onCerrar={() => setModalMsg(null)} titulo={modalMsg?.titulo || ''}>
        <p className="text-sm text-slate-600 dark:text-slate-300">{modalMsg?.texto}</p>
        <button type="button" onClick={() => setModalMsg(null)}
          className="mt-4 w-full rounded-lg bg-brand text-white py-2 text-sm font-medium">
          Entendido
        </button>
      </Modal>
    </div>
  )
}
