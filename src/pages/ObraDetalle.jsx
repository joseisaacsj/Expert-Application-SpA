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
  ClipboardPen,
  Hourglass,
  Pencil,
} from 'lucide-react'
import { obtenerObra, actualizarObra } from '../lib/api.js'
import { exportarObraExcel } from '../lib/excel.js'
import Semaforo, { PuntoSemaforo } from '../components/Semaforo.jsx'
import ObraNav from '../components/ObraNav.jsx'
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
  const [editar, setEditar] = useState(null) // borrador del formulario
  const [guardando, setGuardando] = useState(false)
  const [modalMsg, setModalMsg] = useState(null)

  useEffect(() => {
    obtenerObra(id)
      .then(setObra)
      .catch((e) => setError(e.message))
  }, [id])

  function abrirEdicion() {
    setEditar({
      nombre: obra.nombre,
      contrato: obra.contrato || '',
      mandante: obra.mandante || '',
      contratista: obra.contratista || '',
      ubicacion: obra.ubicacion || '',
      alcance: obra.alcance || '',
      fechaInicio: obra.fechaInicio,
      plazoDias: obra.plazoDias,
      estado: obra.estado,
      ggPct: Math.round((obra.ggPct ?? 0.325) * 1000) / 10,
      utilPct: Math.round((obra.utilPct ?? 0.15) * 1000) / 10,
      valorUF: obra.valorUF || '',
    })
  }

  async function guardarEdicion() {
    setGuardando(true)
    try {
      await actualizarObra(id, {
        ...editar,
        plazoDias: Number(editar.plazoDias),
        ggPct: Number(editar.ggPct) / 100,
        utilPct: Number(editar.utilPct) / 100,
        valorUF: Number(editar.valorUF) || null,
      })
      setObra(await obtenerObra(id))
      setEditar(null)
      setModalMsg({ titulo: 'Obra actualizada', texto: 'Los cambios quedaron registrados en la auditoría.' })
    } catch (e) {
      setModalMsg({ titulo: 'No se pudo guardar', texto: e.message })
    } finally {
      setGuardando(false)
    }
  }

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

  const veCostos = obra.veCostos

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-brand mb-3">
          <ArrowLeft size={15} /> Volver al tablero
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl">{obra.nombre}</h1>
            <p className="text-sm text-slate-500 flex items-center gap-1 mt-1 flex-wrap">
              <MapPin size={13} /> {obra.ubicacion}
              <span className="mx-1">·</span>
              <CalendarDays size={13} /> inicio {fechaCorta(obra.fechaInicio)} · término {fechaCorta(obra.fechaTermino)}
            </p>
            {(obra.contrato || obra.mandante) && (
              <p className="text-xs text-slate-500 mt-1">
                {obra.contrato} · Mandante: {obra.mandante} · Contratista: {obra.contratista}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {obra.puedeEditar && (
              <button
                type="button"
                onClick={abrirEdicion}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-ink-muted text-sm font-medium hover:border-brand hover:text-brand transition-colors"
              >
                <Pencil size={15} />
                Editar obra
              </button>
            )}
            {obra.puedeReportar && (
              <Link
                to={`/reporte/${obra.id}`}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-semibold transition-colors"
              >
                <ClipboardPen size={16} />
                Registrar avance
              </Link>
            )}
            {obra.estado === 'finalizada' ? (
              <span className="text-sm text-slate-500 font-medium">Obra finalizada</span>
            ) : (
              <Semaforo nivel={obra.estadoGeneral} tamaño="lg" />
            )}
            {obra.puedeExportar && (
              <button
                type="button"
                onClick={() => exportarObraExcel(obra)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-ink-muted text-sm font-medium hover:border-brand hover:text-brand transition-colors"
              >
                <FileSpreadsheet size={16} />
                Exportar a Excel
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
          {obra.causa} · tu rol: <strong>{rolTexto(obra.rol)}</strong>
        </p>
        {obra.diasRestantes != null && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink dark:text-white">
            <Hourglass size={14} className="text-brand" />
            Faltan {obra.diasRestantes} días para el término
            <span className="text-xs font-normal text-slate-500">
              ({Math.round(obra.plazoConsumido * 100)}% del plazo consumido)
            </span>
          </p>
        )}
        {obra.alcance && (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 max-w-3xl">{obra.alcance}</p>
        )}
      </div>

      <ObraNav
        obraId={obra.id}
        veCostos={veCostos}
        esTrabajador={obra.rol === 'trabajador'}
        puedePlanificar={['admin', 'supervisor'].includes(obra.rol)}
      />

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
                    : a.nivel === 'naranja'
                      ? 'border-semaforo-naranja/30 bg-semaforo-naranja/5 text-semaforo-naranja'
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
                <th className="px-4 py-3 font-medium">Ítem</th>
                <th className="px-4 py-3 font-medium">Partida</th>
                <th className="px-4 py-3 font-medium">Etapa</th>
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
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.item || '—'}</td>
                  <td className="px-4 py-3 font-medium text-ink dark:text-white">{p.nombre}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{p.etapa || '—'}</td>
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
                  <td className="px-4 py-3" colSpan={8}>Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">{clp(obra.presupuestoTotal)}</td>
                </tr>
                <tr className="text-sm text-slate-500">
                  <td className="px-4 py-1" colSpan={8}>Gasto real acumulado</td>
                  <td className="px-4 py-1 text-right tabular-nums">{clp(obra.gastoReal)}</td>
                </tr>
                <tr className="text-sm text-slate-500">
                  <td className="px-4 py-1" colSpan={8}>Valor ganado</td>
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

      {/* Edición de datos generales y parámetros económicos */}
      <Modal abierto={!!editar} onCerrar={() => setEditar(null)} titulo="Editar obra">
        {editar && (
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {[
              ['nombre', 'Nombre de la obra'],
              ['contrato', 'Contrato'],
              ['mandante', 'Mandante'],
              ['contratista', 'Contratista'],
              ['ubicacion', 'Ubicación'],
            ].map(([campo, label]) => (
              <label key={campo} className="block text-sm">
                <span className="block text-xs text-slate-500 mb-1">{label}</span>
                <input
                  className="w-full rounded-lg border border-slate-300 dark:border-ink-muted bg-transparent px-3 py-2 text-sm"
                  value={editar[campo]}
                  onChange={(e) => setEditar({ ...editar, [campo]: e.target.value })}
                />
              </label>
            ))}
            <label className="block text-sm">
              <span className="block text-xs text-slate-500 mb-1">Alcance</span>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-slate-300 dark:border-ink-muted bg-transparent px-3 py-2 text-sm"
                value={editar.alcance}
                onChange={(e) => setEditar({ ...editar, alcance: e.target.value })}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="block text-xs text-slate-500 mb-1">Inicio</span>
                <input
                  type="date"
                  className="w-full rounded-lg border border-slate-300 dark:border-ink-muted bg-transparent px-3 py-2 text-sm cursor-pointer"
                  value={editar.fechaInicio}
                  onChange={(e) => setEditar({ ...editar, fechaInicio: e.target.value })}
                  onClick={(e) => e.target.showPicker?.()}
                />
              </label>
              <label className="block text-sm">
                <span className="block text-xs text-slate-500 mb-1">Plazo (días)</span>
                <input
                  type="number" min="1"
                  className="w-full rounded-lg border border-slate-300 dark:border-ink-muted bg-transparent px-3 py-2 text-sm"
                  value={editar.plazoDias}
                  onChange={(e) => setEditar({ ...editar, plazoDias: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="block text-xs text-slate-500 mb-1">GG %</span>
                <input
                  type="number" min="0" step="0.5"
                  className="w-full rounded-lg border border-slate-300 dark:border-ink-muted bg-transparent px-3 py-2 text-sm"
                  value={editar.ggPct}
                  onChange={(e) => setEditar({ ...editar, ggPct: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="block text-xs text-slate-500 mb-1">Utilidad %</span>
                <input
                  type="number" min="0" step="0.5"
                  className="w-full rounded-lg border border-slate-300 dark:border-ink-muted bg-transparent px-3 py-2 text-sm"
                  value={editar.utilPct}
                  onChange={(e) => setEditar({ ...editar, utilPct: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="block text-xs text-slate-500 mb-1">UF referencia</span>
                <input
                  type="number" min="0"
                  className="w-full rounded-lg border border-slate-300 dark:border-ink-muted bg-transparent px-3 py-2 text-sm"
                  value={editar.valorUF}
                  onChange={(e) => setEditar({ ...editar, valorUF: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="block text-xs text-slate-500 mb-1">Estado</span>
                <select
                  className="w-full rounded-lg border border-slate-300 dark:border-ink-muted bg-transparent px-3 py-2 text-sm"
                  value={editar.estado}
                  onChange={(e) => setEditar({ ...editar, estado: e.target.value })}
                >
                  <option value="borrador">Borrador</option>
                  <option value="activa">Activa</option>
                  <option value="finalizada">Finalizada</option>
                </select>
              </label>
            </div>
            <p className="text-xs text-slate-400">
              Cambiar cantidades o precios recalcula los presupuestos de partida al guardarlas en
              Presupuesto. Todo cambio queda en el registro de auditoría.
            </p>
            <button
              type="button"
              disabled={guardando}
              onClick={guardarEdicion}
              className="w-full rounded-lg bg-brand text-white py-2 text-sm font-medium hover:bg-brand-dark disabled:opacity-40"
            >
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </Modal>

      <Modal abierto={!!modalMsg} onCerrar={() => setModalMsg(null)} titulo={modalMsg?.titulo || ''}>
        <p className="text-sm text-slate-600 dark:text-slate-300">{modalMsg?.texto}</p>
        <button
          type="button"
          onClick={() => setModalMsg(null)}
          className="mt-4 w-full rounded-lg bg-brand text-white py-2 text-sm font-medium"
        >
          Entendido
        </button>
      </Modal>
    </div>
  )
}
