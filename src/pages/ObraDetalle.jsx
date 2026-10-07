import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  MapPin,
  ArrowLeft,
  FileSpreadsheet,
  CircleHelp,
  TriangleAlert,
  CalendarDays,
  ClipboardList,
} from 'lucide-react'
import { obtenerObra } from '../lib/api.js'
import { exportarObraExcel } from '../lib/excel.js'
import Semaforo, { PuntoSemaforo } from '../components/Semaforo.jsx'
import Modal from '../components/Modal.jsx'
import { clp, fechaCorta } from '../lib/format.js'
import { rolTexto } from '../lib/roles.js'

function TarjetaIndicador({ ind, onExplicar }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-ink-muted/40 bg-white dark:bg-ink-soft p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          {ind.nombre}
        </span>
        <PuntoSemaforo nivel={ind.nivel} />
      </div>
      <div className="text-2xl font-semibold text-ink dark:text-white mb-1">{ind.valorTexto}</div>
      <p className="text-xs text-slate-500 mb-2">{ind.detalle}</p>
      <button
        type="button"
        onClick={() => onExplicar(ind)}
        className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
      >
        <CircleHelp size={13} />
        ¿Cómo se calculó?
      </button>
    </div>
  )
}

function TarjetaRestringida({ nombre }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 dark:border-ink-muted/40 p-4 opacity-70">
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{nombre}</div>
      <div className="text-sm text-slate-500">Restringido por tu rol</div>
    </div>
  )
}

export default function ObraDetalle() {
  const { id } = useParams()
  const [obra, setObra] = useState(null)
  const [error, setError] = useState('')
  const [explicacion, setExplicacion] = useState(null)

  useEffect(() => {
    obtenerObra(id)
      .then(setObra)
      .catch((e) => setError(e.message))
  }, [id])

  if (error) {
    return (
      <div>
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-brand mb-4">
          <ArrowLeft size={15} /> Volver al tablero
        </Link>
        <p role="alert" className="text-semaforo-critico">{error}</p>
      </div>
    )
  }
  if (!obra) return <p className="text-slate-500">Cargando obra…</p>

  const veCostos = obra.presupuestoTotal != null

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-brand mb-3">
          <ArrowLeft size={15} /> Volver al tablero
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl">{obra.nombre}</h1>
            <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
              <MapPin size={13} /> {obra.ubicacion}
              <span className="mx-1">·</span>
              <CalendarDays size={13} /> inicio {fechaCorta(obra.fechaInicio)} · {obra.plazoDias} días de plazo
            </p>
          </div>
          <div className="flex items-center gap-3">
            {obra.estado === 'finalizada' ? (
              <span className="text-sm text-slate-500 font-medium">Obra finalizada</span>
            ) : (
              <Semaforo nivel={obra.estadoGeneral} tamaño="lg" />
            )}
            <button
              type="button"
              onClick={() => exportarObraExcel(obra)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-ink-muted text-sm font-medium hover:border-brand hover:text-brand transition-colors"
            >
              <FileSpreadsheet size={16} />
              Exportar a Excel
            </button>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
          {obra.causa} · tu rol: <strong>{rolTexto(obra.rol)}</strong>
        </p>
      </div>

      {/* Indicadores */}
      <section aria-label="Indicadores">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-ink-muted/40 bg-white dark:bg-ink-soft p-4">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Avance real
            </div>
            <div className="text-2xl font-semibold text-ink dark:text-white">
              {Math.round(obra.avanceReal * 100)}%
            </div>
            <p className="text-xs text-slate-500">
              programado {Math.round(obra.avanceProgramado * 100)}%
            </p>
          </div>
          {obra.indicadores.map((ind) =>
            ind.oculto ? (
              <TarjetaRestringida key={ind.id} nombre={ind.nombre} />
            ) : (
              <TarjetaIndicador key={ind.id} ind={ind} onExplicar={setExplicacion} />
            ),
          )}
        </div>
      </section>

      {/* Alertas */}
      <section aria-label="Alertas">
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">Alertas</h2>
        {obra.alertas.length === 0 ? (
          <p className="text-sm text-slate-500">Sin alertas: todos los indicadores están en verde.</p>
        ) : (
          <ul className="space-y-2">
            {obra.alertas.map((a, i) => (
              <li
                key={i}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm border ${
                  a.nivel === 'critico'
                    ? 'border-semaforo-critico/30 bg-semaforo-critico/5 text-semaforo-critico'
                    : 'border-semaforo-amarillo/30 bg-semaforo-amarillo/5 text-semaforo-amarillo'
                }`}
              >
                <TriangleAlert size={15} />
                {a.texto}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Partidas */}
      <section aria-label="Partidas">
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
          Partidas ({obra.partidas.length})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-ink-muted/40 bg-white dark:bg-ink-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-ink-muted/40">
                <th className="px-4 py-3 font-medium">Partida</th>
                <th className="px-4 py-3 font-medium">Unidad</th>
                <th className="px-4 py-3 font-medium text-right">Plan.</th>
                <th className="px-4 py-3 font-medium text-right">Ejec.</th>
                <th className="px-4 py-3 font-medium w-40">Avance</th>
                {veCostos && <th className="px-4 py-3 font-medium text-right">P. Unit.</th>}
                {veCostos && <th className="px-4 py-3 font-medium text-right">Presupuesto</th>}
              </tr>
            </thead>
            <tbody>
              {obra.partidas.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-slate-100 dark:border-ink-muted/20 last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-ink dark:text-white">{p.nombre}</td>
                  <td className="px-4 py-3 text-slate-500">{p.unidad}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.planificada.toLocaleString('es-CL')}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.ejecutada.toLocaleString('es-CL')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-ink-muted/40">
                        <div
                          className="h-2 rounded-full bg-brand"
                          style={{ width: `${Math.round(p.avance * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums w-9 text-right">
                        {Math.round(p.avance * 100)}%
                      </span>
                    </div>
                  </td>
                  {veCostos && (
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                      {p.precioUnitarioCLP ? clp(p.precioUnitarioCLP) : '—'}
                    </td>
                  )}
                  {veCostos && (
                    <td className="px-4 py-3 text-right tabular-nums">{clp(p.presupuesto)}</td>
                  )}
                </tr>
              ))}
            </tbody>
            {veCostos && (
              <tfoot>
                <tr className="text-sm font-medium border-t border-slate-200 dark:border-ink-muted/40">
                  <td className="px-4 py-3" colSpan={6}>Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">{clp(obra.presupuestoTotal)}</td>
                </tr>
                <tr className="text-sm text-slate-500">
                  <td className="px-4 py-1" colSpan={6}>Gasto real acumulado</td>
                  <td className="px-4 py-1 text-right tabular-nums">{clp(obra.gastoReal)}</td>
                </tr>
                <tr className="text-sm text-slate-500">
                  <td className="px-4 py-1" colSpan={6}>Valor ganado</td>
                  <td className="px-4 py-1 text-right tabular-nums pb-3">{clp(obra.valorGanado)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {!veCostos && (
          <p className="text-xs text-slate-500 mt-2">
            Tu rol no tiene acceso a presupuestos ni costos.
          </p>
        )}
      </section>

      {/* Auditoría */}
      {obra.auditoria?.length > 0 && (
        <section aria-label="Historial">
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
            Registro de cambios de línea base
          </h2>
          <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {obra.auditoria.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <ClipboardList size={14} className="text-slate-400" />
                <span>{a.descripcion}</span>
                <span className="text-slate-400 text-xs">— {fechaCorta(a.fecha)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Modal
        abierto={!!explicacion}
        onCerrar={() => setExplicacion(null)}
        titulo={explicacion ? `${explicacion.nombre}: ¿cómo se calculó?` : ''}
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">{explicacion?.explicacion}</p>
      </Modal>
    </div>
  )
}
