import { useEffect, useState } from 'react'
import { Lock, CheckCircle2, XCircle, CloudRainWind } from 'lucide-react'
import { obtenerTablero, obtenerRRHH } from '../lib/api.js'
import Semaforo from '../components/Semaforo.jsx'
import { clp } from '../lib/format.js'

export default function RRHH() {
  const [obras, setObras] = useState(null)
  const [obraId, setObraId] = useState('')
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    obtenerTablero()
      .then((t) => {
        const activas = t.filter((o) => o.estado === 'activa')
        setObras(activas)
        if (activas[0]) setObraId(activas[0].id)
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

  const docPct = datos && datos.total > 0 ? datos.reportaronHoy / datos.total : 1
  const docNivel = datos?.sinFaenaHoy ? 'verde' : docPct >= 1 ? 'verde' : docPct >= 0.5 ? 'amarillo' : 'critico'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl">Dotación y asistencia</h1>
          <p className="text-sm text-slate-500">Estado de reportes del día por obra.</p>
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

      {!datos || datos.obraId !== obraId ? (
        <p className="text-slate-500">Cargando dotación…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-ink-muted/40 bg-white dark:bg-ink-soft p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Dotación activa</div>
              <div className="text-2xl font-semibold">{datos.total}</div>
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
                  <th className="px-4 py-3 font-medium text-right">Sueldo</th>
                </tr>
              </thead>
              <tbody>
                {datos.dotacion.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100 dark:border-ink-muted/20 last:border-0">
                    <td className="px-4 py-3 font-medium text-ink dark:text-white">{d.nombre}</td>
                    <td className="px-4 py-3 text-slate-500">{d.cargo}</td>
                    <td className="px-4 py-3">
                      {d.reportoHoy ? (
                        <span className="inline-flex items-center gap-1 text-semaforo-verde text-xs font-medium">
                          <CheckCircle2 size={14} /> Reportado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400 text-xs font-medium">
                          <XCircle size={14} /> Pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {d.sueldo != null ? (
                        clp(d.sueldo)
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400 text-xs">
                          <Lock size={12} /> Bloqueado
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!datos.puedeVerSueldos && (
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Lock size={12} /> Los sueldos solo se muestran con permiso explícito del supervisor.
            </p>
          )}
        </>
      )}
    </div>
  )
}
