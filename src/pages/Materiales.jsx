import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Package, TriangleAlert, Pencil, Plus, Trash2 } from 'lucide-react'
import { obtenerMateriales, guardarMaterial, eliminarMaterial } from '../lib/api.js'
import ObraNav from '../components/ObraNav.jsx'
import Modal from '../components/Modal.jsx'
import { clp } from '../lib/format.js'
import { useAuth } from '../context/auth.js'
import { PuntoSemaforo } from '../components/Semaforo.jsx'

function nivelAbastecimiento(pct) {
  if (pct >= 0.8) return 'verde'
  if (pct >= 0.5) return 'amarillo'
  return 'critico'
}

const celda =
  'w-full min-w-0 rounded-md border border-slate-200 dark:border-ink-muted/60 bg-transparent px-1.5 py-1 text-xs tabular-nums'

const insumoNuevo = () => ({
  codigo: '',
  descripcion: '',
  unidad: 'und',
  requerida: '',
  comprada: '',
  pUnitNeto: '',
})

export default function Materiales() {
  const { id } = useParams()
  const { usuario } = useAuth()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [editando, setEditando] = useState(false)
  const [borradores, setBorradores] = useState({})
  const [nuevos, setNuevos] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [modalMsg, setModalMsg] = useState(null)
  const [confirmQuitar, setConfirmQuitar] = useState(null)

  useEffect(() => {
    obtenerMateriales(id).then(setDatos).catch((e) => setError(e.message))
  }, [id])

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
  if (!datos) return <p className="text-slate-500">Cargando materiales…</p>

  const esTrabajador = usuario?.rolPrincipal === 'trabajador'
  const faltantes = datos.materiales.filter((m) => m.requerida > 0 && m.faltante > 0)
  const excedentes = datos.materiales.filter((m) => m.excedente > 0)
  const hayCambios = Object.keys(borradores).length > 0 || nuevos.length > 0

  const borrador = (m) => borradores[m.id] || { ...m }
  const cambiar = (m, campo, valor) =>
    setBorradores({ ...borradores, [m.id]: { ...borrador(m), [campo]: valor } })
  const cambiarNuevo = (i, campo, valor) => {
    const copia = [...nuevos]
    copia[i] = { ...copia[i], [campo]: valor }
    setNuevos(copia)
  }
  const cancelarEdicion = () => {
    setEditando(false)
    setBorradores({})
    setNuevos([])
  }

  async function guardar() {
    setGuardando(true)
    try {
      for (const mid of Object.keys(borradores)) {
        await guardarMaterial(id, { id: mid, ...borradores[mid] })
      }
      for (const n of nuevos) {
        await guardarMaterial(id, n)
      }
      setDatos(await obtenerMateriales(id))
      cancelarEdicion()
      setModalMsg({ titulo: 'Materiales actualizados', texto: 'Los cambios quedaron en la auditoría de la obra.' })
    } catch (e) {
      setModalMsg({ titulo: 'No se pudo guardar', texto: e.message })
    } finally {
      setGuardando(false)
    }
  }

  async function quitar() {
    try {
      await eliminarMaterial(id, confirmQuitar.id)
      setDatos(await obtenerMateriales(id))
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
              <Package size={22} className="text-brand" /> Materiales e inventario
            </h1>
            <p className="text-sm text-slate-500">
              Comprado {clp(datos.totalCompradoCLP)} de {clp(datos.totalRequeridoCLP)} requerido
              ({Math.round(datos.abastecimiento * 100)}% abastecido)
              {datos.porComprarCLP > 0 && ` · por comprar: ${clp(datos.porComprarCLP)}`}.
            </p>
          </div>
          {datos.puedeEditar && !editando && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-ink-muted text-sm font-medium hover:border-brand hover:text-brand"
            >
              <Pencil size={15} /> Editar inventario
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

      {faltantes.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-semaforo-critico/30 bg-semaforo-critico/5 text-semaforo-critico px-4 py-3 text-sm">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          <span>
            {faltantes.length} insumo{faltantes.length !== 1 && 's'} con saldo por comprar.
            Los principales: {faltantes.slice(0, 3).map((m) => m.descripcion).join(', ')}.
          </span>
        </div>
      )}
      {excedentes.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-semaforo-verde/30 bg-semaforo-verde/5 text-semaforo-verde px-4 py-3 text-sm">
          <Package size={16} className="mt-0.5 shrink-0" />
          <span>
            {excedentes.length} insumo{excedentes.length !== 1 && 's'} comprado por sobre lo requerido
            (remanente de compra): {excedentes.map((m) => m.descripcion).join(', ')}.
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-ink-muted/40 bg-white dark:bg-ink-soft">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-ink-muted/40">
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Insumo</th>
              <th className="px-4 py-3 font-medium">Unidad</th>
              <th className="px-4 py-3 font-medium text-right">Requerido</th>
              <th className="px-4 py-3 font-medium text-right">Comprado</th>
              <th className="px-4 py-3 font-medium text-right">Faltante / Exc.</th>
              <th className="px-4 py-3 font-medium text-right">Comprado $</th>
              <th className="px-4 py-3 font-medium w-40">Abastecimiento</th>
              {editando && <th className="px-4 py-3 w-8" />}
            </tr>
          </thead>
          <tbody>
            {datos.materiales.map((m) => {
              const pct = m.requerida > 0 ? m.comprada / m.requerida : m.comprada > 0 ? 1 : 0
              if (editando) {
                const b = borrador(m)
                return (
                  <tr key={m.id} className="border-b border-slate-100 dark:border-ink-muted/20">
                    <td className="px-4 py-1.5">
                      <input className={`${celda} font-mono`} value={b.codigo}
                        onChange={(e) => cambiar(m, 'codigo', e.target.value)} />
                    </td>
                    <td className="px-4 py-1.5 min-w-56">
                      <input className={celda} value={b.descripcion}
                        onChange={(e) => cambiar(m, 'descripcion', e.target.value)} />
                    </td>
                    <td className="px-4 py-1.5 w-16">
                      <input className={celda} value={b.unidad}
                        onChange={(e) => cambiar(m, 'unidad', e.target.value)} />
                    </td>
                    <td className="px-4 py-1.5 w-24">
                      <input className={`${celda} text-right`} type="number" min="0" step="any" value={b.requerida}
                        onChange={(e) => cambiar(m, 'requerida', e.target.value)} />
                    </td>
                    <td className="px-4 py-1.5 w-24">
                      <input className={`${celda} text-right`} type="number" min="0" step="any" value={b.comprada}
                        onChange={(e) => cambiar(m, 'comprada', e.target.value)} />
                    </td>
                    <td className="px-4 py-1.5 w-28">
                      <input className={`${celda} text-right`} type="number" min="0" step="any"
                        placeholder="P.Unit CLP" value={b.pUnitNeto}
                        onChange={(e) => cambiar(m, 'pUnitNeto', e.target.value)} />
                    </td>
                    <td colSpan={2} />
                    <td className="px-4 py-1.5">
                      <button type="button" aria-label={`Eliminar ${m.descripcion}`} onClick={() => setConfirmQuitar(m)}
                        className="p-1 text-slate-400 hover:text-semaforo-critico">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              }
              return (
                <tr key={m.id} className="border-b border-slate-100 dark:border-ink-muted/20 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{m.codigo}</td>
                  <td className="px-4 py-2.5 text-ink dark:text-white min-w-56">{m.descripcion}</td>
                  <td className="px-4 py-2.5 text-slate-500">{m.unidad}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{m.requerida.toLocaleString('es-CL')}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{m.comprada.toLocaleString('es-CL')}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {m.faltante > 0 ? (
                      m.faltante.toLocaleString('es-CL')
                    ) : m.excedente > 0 ? (
                      <span className="text-semaforo-verde">+{m.excedente.toLocaleString('es-CL')} exc.</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{clp(m.costoComprado)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <PuntoSemaforo nivel={m.requerida > 0 ? nivelAbastecimiento(pct) : 'verde'} />
                      <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-ink-muted/40">
                        <div
                          className="h-2 rounded-full bg-brand"
                          style={{ width: `${Math.min(100, Math.round(pct * 100))}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums w-9 text-right">
                        {m.requerida > 0 ? `${Math.round(pct * 100)}%` : '—'}
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
            {editando &&
              nuevos.map((n, i) => (
                <tr key={`nuevo-${i}`} className="border-b border-brand/30 bg-brand/5">
                  <td className="px-4 py-1.5">
                    <input className={`${celda} font-mono`} placeholder="Código" value={n.codigo}
                      onChange={(e) => cambiarNuevo(i, 'codigo', e.target.value)} />
                  </td>
                  <td className="px-4 py-1.5 min-w-56">
                    <input className={celda} placeholder="Descripción del insumo" value={n.descripcion}
                      onChange={(e) => cambiarNuevo(i, 'descripcion', e.target.value)} />
                  </td>
                  <td className="px-4 py-1.5 w-16">
                    <input className={celda} value={n.unidad}
                      onChange={(e) => cambiarNuevo(i, 'unidad', e.target.value)} />
                  </td>
                  <td className="px-4 py-1.5 w-24">
                    <input className={`${celda} text-right`} type="number" min="0" step="any" placeholder="Req." value={n.requerida}
                      onChange={(e) => cambiarNuevo(i, 'requerida', e.target.value)} />
                  </td>
                  <td className="px-4 py-1.5 w-24">
                    <input className={`${celda} text-right`} type="number" min="0" step="any" placeholder="Comp." value={n.comprada}
                      onChange={(e) => cambiarNuevo(i, 'comprada', e.target.value)} />
                  </td>
                  <td className="px-4 py-1.5 w-28">
                    <input className={`${celda} text-right`} type="number" min="0" step="any" placeholder="P.Unit CLP" value={n.pUnitNeto}
                      onChange={(e) => cambiarNuevo(i, 'pUnitNeto', e.target.value)} />
                  </td>
                  <td colSpan={2} />
                  <td className="px-4 py-1.5">
                    <button type="button" aria-label="Quitar fila"
                      onClick={() => setNuevos(nuevos.filter((_, k) => k !== i))}
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
            onClick={() => setNuevos([...nuevos, insumoNuevo()])}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-brand text-brand text-sm font-medium hover:bg-brand/10"
          >
            <Plus size={15} /> Agregar insumo
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

      <Modal abierto={!!confirmQuitar} onCerrar={() => setConfirmQuitar(null)} titulo="Eliminar insumo">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          ¿Eliminar «{confirmQuitar?.descripcion}» del inventario? Quedará en la auditoría.
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
