import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, CloudRainWind, Camera } from 'lucide-react'
import { obtenerRegistro } from '../lib/api.js'
import ObraNav from '../components/ObraNav.jsx'
import { fechaCorta } from '../lib/format.js'
import { useAuth } from '../context/auth.js'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default function RegistroProduccion() {
  const { id } = useParams()
  const { usuario } = useAuth()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    obtenerRegistro(id).then(setDatos).catch((e) => setError(e.message))
  }, [id])

  const totales = useMemo(() => {
    if (!datos) return {}
    const t = {}
    for (const p of datos.partidas) t[p.id] = 0
    for (const d of datos.dias) {
      for (const [pid, cant] of Object.entries(d.cantidades)) t[pid] = (t[pid] || 0) + cant
    }
    return t
  }, [datos])

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
  if (!datos) return <p className="text-slate-500">Cargando registro…</p>

  const esTrabajador = usuario?.rolPrincipal === 'trabajador'

  return (
    <div className="space-y-5">
      <div>
        <Link to={`/obras/${id}`} className="inline-flex items-center gap-1 text-sm text-brand mb-3">
          <ArrowLeft size={15} /> Volver a la obra
        </Link>
        <h1 className="text-2xl">Registro diario de producción</h1>
        <p className="text-sm text-slate-500">
          Cantidad ejecutada por día y partida, según reportes de terreno.
        </p>
      </div>

      <ObraNav
        obraId={id}
        veCostos={!['trabajador', 'rrhh'].includes(usuario?.rolPrincipal)}
        esTrabajador={esTrabajador}
        puedePlanificar={['admin', 'supervisor'].includes(usuario?.rolPrincipal)}
      />

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-ink-muted/40 bg-white dark:bg-ink-soft">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-ink-muted/40">
              <th className="px-3 py-3 font-medium whitespace-nowrap">Fecha</th>
              <th className="px-3 py-3 font-medium whitespace-nowrap">Reportó</th>
              {datos.partidas.map((p) => (
                <th key={p.id} className="px-3 py-3 font-medium text-right whitespace-nowrap" title={p.nombre}>
                  {p.item} <span className="text-slate-400">({p.unidad})</span>
                </th>
              ))}
              <th className="px-3 py-3 font-medium">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {datos.dias.map((d) => {
              const esHoy = d.fecha === new Date().toISOString().slice(0, 10)
              return (
                <tr
                  key={d.id}
                  className={`border-b border-slate-100 dark:border-ink-muted/20 last:border-0 ${
                    esHoy ? 'bg-brand/5' : ''
                  }`}
                >
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="font-medium text-ink dark:text-white">{fechaCorta(d.fecha)}</span>
                    <span className="block text-[10px] text-slate-400">
                      {DIAS[new Date(`${d.fecha}T12:00`).getDay()]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                    {d.sinFaena ? (
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <CloudRainWind size={13} /> Sin faena
                      </span>
                    ) : (
                      d.usuario
                    )}
                  </td>
                  {datos.partidas.map((p) => (
                    <td key={p.id} className="px-3 py-2.5 text-right tabular-nums">
                      {d.cantidades[p.id] ? (
                        <span className="font-medium text-ink dark:text-white">
                          {d.cantidades[p.id].toLocaleString('es-CL')}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-ink-muted">—</span>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-xs text-slate-500 max-w-56">
                    <span className="flex items-center gap-1">
                      {d.fotos > 0 && <Camera size={12} className="text-slate-400 shrink-0" />}
                      {d.observaciones}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="text-xs font-medium border-t border-slate-200 dark:border-ink-muted/40">
              <td className="px-3 py-2.5" colSpan={2}>Totales acumulados</td>
              {datos.partidas.map((p) => (
                <td key={p.id} className="px-3 py-2.5 text-right tabular-nums">
                  {(totales[p.id] || 0).toLocaleString('es-CL')}
                </td>
              ))}
              <td />
            </tr>
            <tr className="text-xs text-slate-500">
              <td className="px-3 py-2.5" colSpan={2}>% de cada partida</td>
              {datos.partidas.map((p) => {
                const pctPartida = p.planificada > 0 ? (totales[p.id] || 0) / p.planificada : 0
                return (
                  <td key={p.id} className="px-3 py-2.5 text-right tabular-nums">
                    {Math.round(pctPartida * 100)}%
                  </td>
                )
              })}
              <td />
            </tr>
            <tr className="text-xs font-medium border-t border-slate-200 dark:border-ink-muted/40">
              <td className="px-3 py-3" colSpan={2}>Avance total de la obra</td>
              <td className="px-3 py-3" colSpan={datos.partidas.length}>
                <span className="text-ink dark:text-white">
                  {Math.round(datos.avanceGlobal * 100)}% ejecutado del total
                </span>
                <span className="text-slate-400">
                  {' '}— programado a hoy: {Math.round(datos.avanceProgramado * 100)}%
                </span>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Solo el personal de terreno registra producción; esta vista es de supervisión.
      </p>
    </div>
  )
}
