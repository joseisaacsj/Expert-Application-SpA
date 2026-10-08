import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, FileSpreadsheet, Pencil, Plus, Trash2 } from 'lucide-react'
import { obtenerPresupuesto, guardarPartida, eliminarPartida } from '../lib/api.js'
import ObraNav from '../components/ObraNav.jsx'
import Modal from '../components/Modal.jsx'
import { clp } from '../lib/format.js'
import { useAuth } from '../context/auth.js'

const num = (n, d = 2) =>
  Number(n ?? 0).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: d })

const celda =
  'w-full min-w-0 rounded-md border border-slate-200 dark:border-ink-muted/60 bg-transparent px-1.5 py-1 text-xs tabular-nums'

const partidaNueva = () => ({
  id: null,
  item: '',
  nombre: '',
  etapa: '',
  unidad: 'M2',
  cantidad: '',
  pUnitUF: '',
  pUnitCLP: '',
})

export default function Presupuesto() {
  const { id } = useParams()
  const { usuario } = useAuth()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [editando, setEditando] = useState(false)
  // Borradores: id de partida existente → campos editados; nuevas → filas nuevas.
  const [borradores, setBorradores] = useState({})
  const [nuevas, setNuevas] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [modalMsg, setModalMsg] = useState(null)
  const [confirmQuitar, setConfirmQuitar] = useState(null)

  useEffect(() => {
    obtenerPresupuesto(id).then(setDatos).catch((e) => setError(e.message))
  }, [id])

  // Agrupa por etapa conservando el orden.
  const etapas = useMemo(() => {
    if (!datos) return []
    const lista = []
    for (const p of datos.partidas) {
      const g = lista.find((e) => e.nombre === (p.etapa || 'Sin etapa'))
      if (g) g.partidas.push(p)
      else lista.push({ nombre: p.etapa || 'Sin etapa', partidas: [p] })
    }
    return lista
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
  if (!datos) return <p className="text-slate-500">Cargando presupuesto…</p>

  const esTrabajador = usuario?.rolPrincipal === 'trabajador'
  const hayCambios = Object.keys(borradores).length > 0 || nuevas.length > 0

  function borrador(p) {
    return borradores[p.id] || { ...p }
  }

  function cambiar(p, campo, valor) {
    setBorradores({ ...borradores, [p.id]: { ...borrador(p), [campo]: valor } })
  }

  function cambiarNueva(i, campo, valor) {
    const copia = [...nuevas]
    copia[i] = { ...copia[i], [campo]: valor }
    setNuevas(copia)
  }

  function cancelarEdicion() {
    setEditando(false)
    setBorradores({})
    setNuevas([])
  }

  async function guardar() {
    setGuardando(true)
    try {
      for (const pid of Object.keys(borradores)) {
        const b = borradores[pid]
        await guardarPartida(id, {
          id: pid,
          item: b.item,
          nombre: b.nombre,
          etapa: b.etapa,
          unidad: b.unidad,
          planificada: b.cantidad,
          precioUnitarioUF: b.pUnitUF,
          precioUnitarioCLP: b.pUnitCLP,
        })
      }
      for (const n of nuevas) {
        await guardarPartida(id, {
          item: n.item,
          nombre: n.nombre,
          etapa: n.etapa,
          unidad: n.unidad,
          planificada: n.cantidad,
          precioUnitarioUF: n.pUnitUF,
          precioUnitarioCLP: n.pUnitCLP,
        })
      }
      setDatos(await obtenerPresupuesto(id))
      cancelarEdicion()
      setModalMsg({ titulo: 'Presupuesto actualizado', texto: 'Los cambios quedaron en la auditoría de la obra.' })
    } catch (e) {
      setModalMsg({ titulo: 'No se pudo guardar', texto: e.message })
    } finally {
      setGuardando(false)
    }
  }

  async function quitar() {
    try {
      await eliminarPartida(id, confirmQuitar.id)
      setDatos(await obtenerPresupuesto(id))
      setConfirmQuitar(null)
    } catch (e) {
      setConfirmQuitar(null)
      setModalMsg({ titulo: 'No se pudo eliminar', texto: e.message })
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to={`/obras/${id}`} className="inline-flex items-center gap-1 text-sm text-brand mb-3">
          <ArrowLeft size={15} /> Volver a la obra
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl flex items-center gap-2">
              <FileSpreadsheet size={22} className="text-brand" /> Presupuesto base de contrato
            </h1>
            <p className="text-sm text-slate-500">
              GG {num(datos.ggPct * 100, 1)}% · Utilidad {num(datos.utilPct * 100, 0)}% · UF ref. {clp(datos.valorUF)}
            </p>
          </div>
          {datos.puedeEditar && !editando && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-ink-muted text-sm font-medium hover:border-brand hover:text-brand"
            >
              <Pencil size={15} /> Editar presupuesto
            </button>
          )}
        </div>
      </div>

      <ObraNav
        obraId={id}
        veCostos
        esTrabajador={esTrabajador}
        puedePlanificar={['admin', 'supervisor'].includes(usuario?.rolPrincipal)}
      />

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-ink-muted/40 bg-white dark:bg-ink-soft">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-ink-muted/40">
              <th className="px-3 py-3 font-medium">Ítem</th>
              <th className="px-3 py-3 font-medium">Descripción partida</th>
              <th className="px-3 py-3 font-medium">Unidad</th>
              <th className="px-3 py-3 font-medium text-right">Cantidad</th>
              <th className="px-3 py-3 font-medium text-right">P. Unit. UF</th>
              <th className="px-3 py-3 font-medium text-right">Total UF</th>
              <th className="px-3 py-3 font-medium text-right">P. Unit. CLP</th>
              <th className="px-3 py-3 font-medium text-right">Total CLP</th>
              <th className="px-3 py-3 font-medium text-right">Total Neto CLP</th>
              <th className="px-3 py-3 font-medium text-right">Incidencia</th>
              <th className="px-3 py-3 font-medium text-right">Avance</th>
              {editando && <th className="px-3 py-3 w-8" />}
            </tr>
          </thead>
          <tbody>
            {etapas.map((e) => (
              <FragmentEtapa
                key={e.nombre}
                etapa={e}
                editando={editando}
                borrador={borrador}
                cambiar={cambiar}
                onQuitar={setConfirmQuitar}
                gg={datos.ggPct}
                util={datos.utilPct}
              />
            ))}
            {editando &&
              nuevas.map((n, i) => (
                <tr key={`nueva-${i}`} className="border-b border-brand/30 bg-brand/5">
                  <td className="px-3 py-1.5">
                    <input className={celda} placeholder="Ítem" value={n.item}
                      onChange={(e) => cambiarNueva(i, 'item', e.target.value)} />
                  </td>
                  <td className="px-3 py-1.5 min-w-64">
                    <input className={celda} placeholder="Descripción de la nueva partida" value={n.nombre}
                      onChange={(e) => cambiarNueva(i, 'nombre', e.target.value)} />
                  </td>
                  <td className="px-3 py-1.5">
                    <input className={celda} value={n.unidad}
                      onChange={(e) => cambiarNueva(i, 'unidad', e.target.value)} />
                  </td>
                  <td className="px-3 py-1.5">
                    <input className={`${celda} text-right`} type="number" min="0" step="any" value={n.cantidad}
                      onChange={(e) => cambiarNueva(i, 'cantidad', e.target.value)} />
                  </td>
                  <td className="px-3 py-1.5">
                    <input className={`${celda} text-right`} type="number" min="0" step="any" value={n.pUnitUF}
                      onChange={(e) => cambiarNueva(i, 'pUnitUF', e.target.value)} />
                  </td>
                  <td />
                  <td className="px-3 py-1.5">
                    <input className={`${celda} text-right`} type="number" min="0" step="any" value={n.pUnitCLP}
                      onChange={(e) => cambiarNueva(i, 'pUnitCLP', e.target.value)} />
                  </td>
                  <td colSpan={3} className="px-3 py-1.5">
                    <input className={celda} placeholder="Etapa (opcional)" value={n.etapa}
                      onChange={(e) => cambiarNueva(i, 'etapa', e.target.value)} />
                  </td>
                  <td />
                  <td className="px-3 py-1.5">
                    <button type="button" aria-label="Quitar fila"
                      onClick={() => setNuevas(nuevas.filter((_, k) => k !== i))}
                      className="p-1 text-slate-400 hover:text-semaforo-critico">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr className="text-sm font-medium border-t-2 border-slate-300 dark:border-ink-muted/60">
              <td className="px-3 py-3" colSpan={5}>Total costo directo contrato</td>
              <td className="px-3 py-3 text-right tabular-nums">{num(datos.totalNetoUF / (1 + datos.ggPct + datos.utilPct))}</td>
              <td className="px-3 py-3" colSpan={2} />
              <td className="px-3 py-3 text-right tabular-nums">{clp(datos.totalNetoCLP)}</td>
              <td className="px-3 py-3 text-right tabular-nums">100%</td>
              <td />
              {editando && <td />}
            </tr>
          </tfoot>
        </table>
      </div>

      {editando ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setNuevas([...nuevas, partidaNueva()])}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-brand text-brand text-sm font-medium hover:bg-brand/10"
          >
            <Plus size={15} /> Agregar partida
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
      ) : (
        <p className="text-xs text-slate-500">
          Total Neto = Total CLP × (1 + GG + Utilidad). La incidencia es el peso de cada partida en el contrato.
        </p>
      )}

      <Modal abierto={!!confirmQuitar} onCerrar={() => setConfirmQuitar(null)} titulo="Eliminar partida">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          ¿Eliminar la partida «{confirmQuitar?.nombre}»? Quedará registrado en la auditoría.
        </p>
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={() => setConfirmQuitar(null)}
            className="flex-1 rounded-lg border border-slate-300 dark:border-ink-muted py-2 text-sm">
            Cancelar
          </button>
          <button type="button" onClick={quitar}
            className="flex-1 rounded-lg bg-semaforo-critico text-white py-2 text-sm font-medium">
            Eliminar
          </button>
        </div>
      </Modal>

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

function FragmentEtapa({ etapa, editando, borrador, cambiar, onQuitar, gg, util }) {
  return (
    <>
      <tr className="bg-slate-50 dark:bg-ink/40">
        <td colSpan={editando ? 12 : 11} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {etapa.nombre}
        </td>
      </tr>
      {etapa.partidas.map((p) => {
        if (!editando) {
          return (
            <tr key={p.id} className="border-b border-slate-100 dark:border-ink-muted/20">
              <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{p.item}</td>
              <td className="px-3 py-2.5 text-ink dark:text-white min-w-64">{p.nombre}</td>
              <td className="px-3 py-2.5 text-slate-500">{p.unidad}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{num(p.cantidad, 0)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{num(p.pUnitUF)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{num(p.totalUF, 0)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{clp(p.pUnitCLP)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{clp(p.totalCLP)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums font-medium">{clp(p.netoCLP)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{num(p.incidencia * 100, 1)}%</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{Math.round(p.avance * 100)}%</td>
            </tr>
          )
        }
        const b = borrador(p)
        const cant = Number(b.cantidad) || 0
        const tCLP = cant * (Number(b.pUnitCLP) || 0)
        const tUF = cant * (Number(b.pUnitUF) || 0)
        return (
          <tr key={p.id} className="border-b border-slate-100 dark:border-ink-muted/20">
            <td className="px-3 py-1.5">
              <input className={celda} value={b.item} onChange={(e) => cambiar(p, 'item', e.target.value)} />
            </td>
            <td className="px-3 py-1.5 min-w-64">
              <input className={celda} value={b.nombre} onChange={(e) => cambiar(p, 'nombre', e.target.value)} />
            </td>
            <td className="px-3 py-1.5">
              <input className={celda} value={b.unidad} onChange={(e) => cambiar(p, 'unidad', e.target.value)} />
            </td>
            <td className="px-3 py-1.5">
              <input className={`${celda} text-right`} type="number" min="0" step="any" value={b.cantidad}
                onChange={(e) => cambiar(p, 'cantidad', e.target.value)} />
            </td>
            <td className="px-3 py-1.5">
              <input className={`${celda} text-right`} type="number" min="0" step="any" value={b.pUnitUF ?? ''}
                onChange={(e) => cambiar(p, 'pUnitUF', e.target.value)} />
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums text-slate-500 text-xs">{num(tUF, 0)}</td>
            <td className="px-3 py-1.5">
              <input className={`${celda} text-right`} type="number" min="0" step="any" value={b.pUnitCLP ?? ''}
                onChange={(e) => cambiar(p, 'pUnitCLP', e.target.value)} />
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums text-slate-500 text-xs">{clp(tCLP)}</td>
            <td className="px-3 py-1.5 text-right tabular-nums font-medium text-xs">{clp(tCLP * (1 + gg + util))}</td>
            <td className="px-3 py-1.5 text-right tabular-nums text-slate-500 text-xs">{num(p.incidencia * 100, 1)}%</td>
            <td className="px-3 py-1.5 text-right tabular-nums text-xs">{Math.round(p.avance * 100)}%</td>
            <td className="px-3 py-1.5">
              <button type="button" aria-label={`Eliminar ${p.item}`} onClick={() => onQuitar(p)}
                className="p-1 text-slate-400 hover:text-semaforo-critico">
                <Trash2 size={14} />
              </button>
            </td>
          </tr>
        )
      })}
    </>
  )
}
