import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Camera,
  CloudOff,
  CheckCircle2,
  Clock,
  Trash2,
  Send,
  ArrowLeft,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { obtenerTablero, obtenerObra, enviarReporte } from '../lib/api.js'
import {
  guardarPendiente,
  comprimirFoto,
  sincronizarPendientes,
} from '../lib/offline.js'
import Modal from '../components/Modal.jsx'
import { fechaISO } from '../lib/format.js'

function avisarPendientes() {
  window.dispatchEvent(new Event('ea-pendientes'))
}

const inputClase =
  'w-full rounded-lg border border-slate-300 dark:border-ink-muted bg-transparent px-3 py-2.5 text-base'

function EstadoChip({ estado }) {
  const map = {
    pendiente: { icono: Clock, texto: 'Pendiente', clase: 'text-semaforo-amarillo bg-semaforo-amarillo/10' },
    guardado: { icono: CloudOff, texto: 'Guardado en el teléfono', clase: 'text-semaforo-amarillo bg-semaforo-amarillo/10' },
    enviado: { icono: CheckCircle2, texto: 'Enviado', clase: 'text-semaforo-verde bg-semaforo-verde/10' },
  }
  const { icono: Icono, texto, clase } = map[estado] || map.pendiente
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${clase}`}>
      <Icono size={12} /> {texto}
    </span>
  )
}

export default function ReporteDiario() {
  const { obraId } = useParams()
  const [obras, setObras] = useState(null)
  const [obra, setObra] = useState(null)
  const [error, setError] = useState('')

  const [lineas, setLineas] = useState([{ partidaId: '', cantidad: '' }])
  const [observaciones, setObservaciones] = useState('')
  const [sinFaena, setSinFaena] = useState(false)
  const [fotos, setFotos] = useState([])
  const [enviados, setEnviados] = useState([]) // reportes de esta sesión con su estado
  const [modal, setModal] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [yaReporte, setYaReporte] = useState(false)

  useEffect(() => {
    obtenerTablero().then((t) => setObras(t.filter((o) => o.estado === 'activa'))).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!obraId) return
    obtenerObra(obraId).then(setObra).catch((e) => setError(e.message))
  }, [obraId])

  // Sincroniza al volver la señal mientras se está en la pantalla.
  useEffect(() => {
    const online = () => sincronizarPendientes().then(avisarPendientes).catch(() => {})
    window.addEventListener('online', online)
    return () => window.removeEventListener('online', online)
  }, [])

  const partidasValidas = useMemo(
    () => lineas.filter((l) => l.partidaId && Number(l.cantidad) > 0),
    [lineas],
  )

  async function tomarFoto(e) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    const comprimida = await comprimirFoto(archivo)
    setFotos([...fotos, comprimida])
    e.target.value = ''
  }

  async function enviar() {
    setEnviando(true)
    const reporte = {
      clientId: crypto.randomUUID(),
      obraId: obra.id,
      fecha: fechaISO(),
      observaciones,
      sinFaena,
      lineas: partidasValidas.map((l) => ({ partidaId: l.partidaId, cantidad: Number(l.cantidad) })),
      fotos,
    }
    let estado
    try {
      await enviarReporte(reporte)
      estado = 'enviado'
    } catch {
      // Sin conexión o fallo: queda guardado en el teléfono (IndexedDB)
      await guardarPendiente(reporte)
      estado = 'guardado'
    }
    setEnviados([{ ...reporte, estado, hora: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) }, ...enviados])
    if (estado === 'enviado') setYaReporte(true)
    avisarPendientes()
    setModal({
      titulo: estado === 'enviado' ? 'Reporte enviado' : 'Reporte guardado en el teléfono',
      texto:
        estado === 'enviado'
          ? 'Tu reporte del día quedó registrado en la obra.'
          : 'No hay conexión. El reporte se enviará automáticamente cuando recuperes la señal.',
    })
    setLineas([{ partidaId: '', cantidad: '' }])
    setObservaciones('')
    setSinFaena(false)
    setFotos([])
    setEnviando(false)
  }

  async function reintentarPendientes() {
    setEnviando(true)
    await sincronizarPendientes((p, resultado) => {
      if (resultado === 'enviado') {
        setEnviados((prev) =>
          prev.map((r) => (r.clientId === p.clientId ? { ...r, estado: 'enviado' } : r)),
        )
      }
      avisarPendientes()
    }).catch(() => {})
    setEnviando(false)
  }

  if (error) return <p role="alert" className="text-semaforo-critico">{error}</p>

  // Paso 1: elegir obra
  if (!obraId) {
    if (!obras) return <p className="text-slate-500">Cargando…</p>
    return (
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl mb-2">Reporte diario</h1>
        <p className="text-sm text-slate-500 mb-4">Elige la obra que vas a reportar hoy.</p>
        <div className="space-y-2">
          {obras.map((o) => (
            <Link key={o.id} to={`/reporte/${o.id}`}
              className="block rounded-xl border border-slate-200 dark:border-ink-muted/40 bg-white dark:bg-ink-soft p-4 hover:border-brand transition-colors">
              <span className="font-medium text-ink dark:text-white">{o.nombre}</span>
              <span className="block text-xs text-slate-500 mt-1">tu rol: {o.rol}</span>
            </Link>
          ))}
          {obras.length === 0 && <p className="text-slate-500 text-sm">No tienes obras activas asignadas.</p>}
        </div>
      </div>
    )
  }

  if (!obra) return <p className="text-slate-500">Cargando obra…</p>

  // Solo el personal de terreno reporta; el resto supervisa en el registro.
  if (obra.puedeReportar === false) {
    return (
      <div className="max-w-lg mx-auto">
        <Link to={`/obras/${obra.id}/registro`} className="inline-flex items-center gap-1 text-sm text-brand mb-3">
          <ArrowLeft size={15} /> Ir al registro de producción
        </Link>
        <h1 className="text-2xl mb-2">Reporte diario</h1>
        <div className="rounded-xl border border-semaforo-amarillo/30 bg-semaforo-amarillo/10 text-semaforo-amarillo px-4 py-3 text-sm">
          Tu cargo supervisa el avance: revisa el Registro Diario de Producción de la obra.
          Solo el personal de terreno envía reportes.
        </div>
      </div>
    )
  }

  // El personal de terreno solo reporta partidas en m² o ml.
  const partidasReportables = obra.partidas.filter((p) =>
    ['m²', 'm2', 'ml'].includes((p.unidad || '').toLowerCase()),
  )
  const puedeEnviar = !enviando && (sinFaena || partidasValidas.length > 0)
  const enLinea = navigator.onLine
  const documentado = yaReporte || obra.miReporteHoy

  return (
    <div className="max-w-lg mx-auto">
      <Link to="/reporte" className="inline-flex items-center gap-1 text-sm text-brand mb-3">
        <ArrowLeft size={15} /> Cambiar obra
      </Link>
      <h1 className="text-2xl mb-1">Reporte diario</h1>
      <p className="text-sm text-slate-500 mb-1">
        {obra.nombre} · hoy {new Date().toLocaleDateString('es-CL')}
      </p>
      <p className="text-xs text-slate-400 mb-4 flex items-center gap-1">
        {enLinea ? <Wifi size={12} /> : <WifiOff size={12} />}
        {enLinea
          ? 'Conexión: en línea'
          : 'Sin conexión: el reporte queda guardado en el teléfono y se envía al recuperar señal'}
      </p>

      {/* Estado del reporte de hoy, como en el prototipo */}
      {documentado ? (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-semaforo-verde/30 bg-semaforo-verde/10 text-semaforo-verde px-4 py-3 text-sm font-medium">
          <CheckCircle2 size={17} />
          Reporte de hoy enviado. Gracias.
        </div>
      ) : (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-semaforo-critico/30 bg-semaforo-critico/10 text-semaforo-critico px-4 py-3 text-sm font-medium">
          <Clock size={17} />
          Aún no documentas el trabajo de hoy. Tu supervisor será avisado a las 18:00.
        </div>
      )}

      <div className="bg-white dark:bg-ink-soft rounded-2xl border border-slate-200 dark:border-ink-muted/40 p-5 space-y-5">
        {/* Sin faena */}
        <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-ink-muted/40 cursor-pointer">
          <input
            type="checkbox"
            checked={sinFaena}
            onChange={(e) => setSinFaena(e.target.checked)}
            className="w-5 h-5 accent-brand"
          />
          <span>
            <span className="block text-sm font-medium">Sin faena</span>
            <span className="block text-xs text-slate-500">Hoy no se trabajó en esta obra (no genera alerta).</span>
          </span>
        </label>

        {!sinFaena && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Avance del día</p>
            {lineas.map((l, i) => (
              <div key={i} className="flex gap-2">
                <select
                  className={`${inputClase} flex-1`}
                  value={l.partidaId}
                  onChange={(e) => {
                    const c = [...lineas]
                    c[i] = { ...c[i], partidaId: e.target.value }
                    setLineas(c)
                  }}
                  aria-label={`Partida ${i + 1}`}
                >
                  <option value="">Selecciona partida…</option>
                  {partidasReportables.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.item ? `${p.item} — ` : ''}{p.nombre} ({p.unidad})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Cantidad"
                  className={`${inputClase} w-28`}
                  value={l.cantidad}
                  onChange={(e) => {
                    const c = [...lineas]
                    c[i] = { ...c[i], cantidad: e.target.value }
                    setLineas(c)
                  }}
                  aria-label={`Cantidad ${i + 1}`}
                />
                {lineas.length > 1 && (
                  <button type="button" aria-label="Quitar línea"
                    onClick={() => setLineas(lineas.filter((_, j) => j !== i))}
                    className="p-2 text-slate-400 hover:text-semaforo-critico">
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            ))}
            <button type="button"
              onClick={() => setLineas([...lineas, { partidaId: '', cantidad: '' }])}
              className="text-sm text-brand font-medium">
              + Agregar otra partida
            </button>
          </div>
        )}

        <div>
          <label htmlFor="obs" className="block text-sm font-medium mb-1">Observaciones</label>
          <textarea
            id="obs"
            rows={3}
            className={inputClase}
            placeholder="Qué se hizo hoy, problemas, clima…"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </div>

        <div>
          <span className="block text-sm font-medium mb-2">Fotos</span>
          <div className="flex flex-wrap gap-2">
            {fotos.map((f, i) => (
              <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-ink-muted/40">
                <img src={f.dataUrl} alt={f.nombre} className="w-full h-full object-cover" />
                <button type="button" aria-label="Quitar foto"
                  onClick={() => setFotos(fotos.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 p-1 rounded-full bg-ink/70 text-white">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <label className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 dark:border-ink-muted flex flex-col items-center justify-center gap-1 text-slate-400 cursor-pointer hover:border-brand hover:text-brand">
              <Camera size={20} />
              <span className="text-[10px]">Foto</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={tomarFoto} />
            </label>
          </div>
        </div>

        <button
          type="button"
          disabled={!puedeEnviar}
          onClick={enviar}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-dark disabled:opacity-40 text-white font-medium py-3 transition-colors"
        >
          <Send size={17} />
          {enviando ? 'Enviando…' : navigator.onLine ? 'Enviar reporte' : 'Guardar en el teléfono'}
        </button>
      </div>

      {/* Reportes de esta sesión */}
      {enviados.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-2">
            Tus reportes de hoy
          </h2>
          <ul className="space-y-2">
            {enviados.map((r) => (
              <li key={r.clientId} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-ink-muted/40 bg-white dark:bg-ink-soft px-4 py-3">
                <span className="text-sm">
                  {r.sinFaena ? 'Sin faena' : `${r.lineas.length} partida(s)`}
                  <span className="text-xs text-slate-400 ml-2">{r.hora}</span>
                </span>
                <EstadoChip estado={r.estado} />
              </li>
            ))}
          </ul>
          {enviados.some((r) => r.estado === 'guardado') && navigator.onLine && (
            <button type="button" onClick={reintentarPendientes}
              className="mt-3 text-sm text-brand font-medium">
              Reintentar envío de pendientes
            </button>
          )}
        </section>
      )}

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
