import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapPin, CheckCircle2, ClipboardPen } from 'lucide-react'
import { obtenerTablero } from '../lib/api.js'
import { useAuth } from '../context/auth.js'
import Semaforo from '../components/Semaforo.jsx'
import { BotonNuevaObra } from '../components/Layout.jsx'
import { fechaCorta } from '../lib/format.js'

function Barra({ valor, esperado }) {
  const pct = Math.min(100, Math.round(valor * 100))
  const prog = Math.min(100, Math.round(esperado * 100))
  return (
    <div
      className="relative h-2 rounded-full bg-slate-200 dark:bg-ink-muted/40"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Avance real"
    >
      <div className="h-2 rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      <div
        className="absolute top-[-4px] bottom-[-4px] w-0.5 bg-ink dark:bg-white rounded"
        style={{ left: `${prog}%` }}
        title={`Programado ${prog}%`}
      />
    </div>
  )
}

const ROLES_QUE_REPORTAN = ['trabajador', 'jefe_cuadrilla', 'supervisor', 'admin']

function TarjetaObra({ obra }) {
  const navigate = useNavigate()
  const finalizada = obra.estado === 'finalizada'
  const puedeReportar = !finalizada && ROLES_QUE_REPORTAN.includes(obra.rol)
  return (
    <Link
      to={`/obras/${obra.id}`}
      className="block rounded-2xl border border-slate-200 dark:border-ink-muted/40 bg-white dark:bg-ink-soft p-5 shadow-sm hover:shadow-md hover:border-brand/50 transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="text-base leading-snug">{obra.nombre}</h3>
        {finalizada ? (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500 shrink-0 mt-0.5">
            <CheckCircle2 size={14} /> Finalizada
          </span>
        ) : (
          <Semaforo nivel={obra.estado_general} />
        )}
      </div>
      <p className="text-xs text-slate-500 flex items-center gap-1 mb-4">
        <MapPin size={12} /> {obra.ubicacion} · inicio {fechaCorta(obra.fechaInicio)}
      </p>

      {!finalizada && (
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">{obra.causa}</p>
      )}

      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span>Avance real {Math.round(obra.avanceReal * 100)}%</span>
        <span>Programado {Math.round(obra.avanceProgramado * 100)}%</span>
      </div>
      <Barra valor={obra.avanceReal} esperado={obra.avanceProgramado} />

      {puedeReportar && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            navigate(`/reporte/${obra.id}`)
          }}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-brand hover:bg-brand-dark text-ink text-sm font-semibold transition-colors"
        >
          <ClipboardPen size={16} />
          Registrar avance
        </button>
      )}
    </Link>
  )
}

export default function Tablero() {
  const { usuario } = useAuth()
  const [obras, setObras] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    obtenerTablero()
      .then(setObras)
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <p role="alert" className="text-semaforo-critico">{error}</p>
  if (!obras) return <p className="text-slate-500">Cargando obras…</p>

  const activas = obras.filter((o) => o.estado === 'activa')
  const finalizadas = obras.filter((o) => o.estado === 'finalizada')
  const puedeCrear = usuario.rolGlobal === 'admin' || obras.some((o) => o.rol === 'supervisor')

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl">Tablero de obras</h1>
          <p className="text-sm text-slate-500">
            Hola, {usuario.nombre} — {obras.length} obra{obras.length !== 1 && 's'} a tu cargo
          </p>
        </div>
        {puedeCrear && <BotonNuevaObra />}
      </div>

      <section aria-label="Obras operativas">
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
          Operativas ({activas.length})
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activas.map((o) => (
            <TarjetaObra key={o.id} obra={o} />
          ))}
        </div>
      </section>

      {finalizadas.length > 0 && (
        <section aria-label="Obras finalizadas">
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
            Finalizadas ({finalizadas.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {finalizadas.map((o) => (
              <TarjetaObra key={o.id} obra={o} />
            ))}
          </div>
        </section>
      )}

      {obras.length === 0 && (
        <p className="text-slate-500">No tienes obras asignadas todavía.</p>
      )}
    </div>
  )
}
