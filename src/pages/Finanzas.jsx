import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Banknote, Lock, FileCheck2, Pencil, Plus, Trash2 } from 'lucide-react'
import { obtenerFinanzas, agregarGasto, guardarTechoGG, eliminarTechoGG } from '../lib/api.js'
import ObraNav from '../components/ObraNav.jsx'
import Modal from '../components/Modal.jsx'
import { clp, fechaCorta, fechaISO } from '../lib/format.js'
import { useAuth } from '../context/auth.js'
import { PuntoSemaforo } from '../components/Semaforo.jsx'

function nivelGG(pct) {
  if (pct >= 1) return 'critico'
  if (pct >= 0.8) return 'naranja'
  if (pct >= 0.5) return 'amarillo'
  return 'verde'
}

const celda =
  'w-full min-w-0 rounded-md border border-slate-200 dark:border-ink-muted/60 bg-transparent px-1.5 py-1 text-xs tabular-nums'

export default function Finanzas() {
  const { id } = useParams()
  const { usuario } = useAuth()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')

  const [gastoForm, setGastoForm] = useState(null)
  const [editandoTechos, setEditandoTechos] = useState(false)
  const [borradores, setBorradores] = useState({})
  const [nuevasCat, setNuevasCat] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [modalMsg, setModalMsg] = useState(null)
  const [confirmQuitarCat, setConfirmQuitarCat] = useState(null)

  const recargar = () => obtenerFinanzas(id).then(setDatos).catch((e) => setError(e.message))
  useEffect(() => {
    recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  if (!datos) return <p className="text-slate-500">Cargando finanzas…</p>

  const esTrabajador = usuario?.rolPrincipal === 'trabajador'
  const pctGG = datos.techoGG > 0 ? datos.ejecutadoGG / datos.techoGG : 0

  const borrador = (c) => borradores[c.id] || { ...c }
  const cambiar = (c, campo, valor) =>
    setBorradores({ ...borradores, [c.id]: { ...borrador(c), [campo]: valor } })
  const cambiarNueva = (i, campo, valor) => {
    const copia = [...nuevasCat]
    copia[i] = { ...copia[i], [campo]: valor }
    setNuevasCat(copia)
  }
  const cancelarTechos = () => {
    setEditandoTechos(false)
    setBorradores({})
    setNuevasCat([])
  }

  async function enviarGasto() {
    setGuardando(true)
    try {
      await agregarGasto(id, {
        categoria: gastoForm.categoria,
        detalle: gastoForm.detalle,
        monto: gastoForm.monto,
        fecha: gastoForm.fecha,
        responsable: gastoForm.responsable,
      })
      await recargar()
      setGastoForm(null)
      setModalMsg({ titulo: 'Gasto registrado', texto: 'Quedó en el registro diario y en la auditoría.' })
    } catch (e) {
      setModalMsg({ titulo: 'No se pudo registrar', texto: e.message })
    } finally {
      setGuardando(false)
    }
  }

  async function guardarTechos() {
    setGuardando(true)
    try {
      for (const cid of Object.keys(borradores)) {
        const b = borradores[cid]
        await guardarTechoGG(id, { id: cid, categoria: b.categoria, techoCLP: b.techoCLP })
      }
      for (const n of nuevasCat) {
        if (n.categoria.trim() && Number(n.techoCLP) > 0) {
          await guardarTechoGG(id, { categoria: n.categoria, techoCLP: n.techoCLP })
        }
      }
      await recargar()
      cancelarTechos()
      setModalMsg({ titulo: 'Techos actualizados', texto: 'Los ajustes quedaron en la auditoría.' })
    } catch (e) {
      setModalMsg({ titulo: 'No se pudo guardar', texto: e.message })
    } finally {
      setGuardando(false)
    }
  }

  async function quitarCategoria() {
    try {
      await eliminarTechoGG(id, confirmQuitarCat.id)
      await recargar()
      setConfirmQuitarCat(null)
    } catch (e) {
      setConfirmQuitarCat(null)
      setModalMsg({ titulo: 'No se pudo eliminar', texto: e.message })
    }
  }

  const remanenteTxt = datos.remanenteGG >= 0
    ? `remanente disponible ${clp(datos.remanenteGG)}`
    : `déficit sobre techo ${clp(-datos.remanenteGG)}`

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/obras/${id}`} className="inline-flex items-center gap-1 text-sm text-brand mb-3">
          <ArrowLeft size={15} /> Volver a la obra
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl flex items-center gap-2">
              <Banknote size={22} className="text-brand" /> Finanzas de la obra
            </h1>
            <p className="text-sm text-slate-500">
              Gastos generales ejecutados {clp(datos.ejecutadoGG)} de un techo de {clp(datos.techoGG)}
              {' '}· <span className={datos.remanenteGG >= 0 ? 'text-semaforo-verde' : 'text-semaforo-critico'}>{remanenteTxt}</span>.
            </p>
          </div>
          {datos.puedeRegistrarGasto && (
            <button
              type="button"
              onClick={() =>
                setGastoForm({
                  categoria: datos.ggCategorias[0]?.categoria || '',
                  detalle: '',
                  monto: '',
                  fecha: fechaISO(),
                  responsable: '',
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-medium"
            >
              <Plus size={15} /> Registrar gasto
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

      {/* Estados de pago */}
      <section aria-label="Estados de pago">
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <FileCheck2 size={15} /> Estados de pago (EEPP)
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-ink-muted/40 bg-white dark:bg-ink-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-ink-muted/40">
                <th className="px-4 py-3 font-medium">EEPP</th>
                <th className="px-4 py-3 font-medium">Presentación</th>
                <th className="px-4 py-3 font-medium text-right">Avance parcial</th>
                <th className="px-4 py-3 font-medium text-right">Avance acum.</th>
                <th className="px-4 py-3 font-medium text-right">Neto UF</th>
                <th className="px-4 py-3 font-medium text-right">Neto CLP</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {datos.estadosPago.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 dark:border-ink-muted/20 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-ink dark:text-white">{e.numero}</td>
                  <td className="px-4 py-2.5 text-slate-500">{fechaCorta(e.fechaPresentacion)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{Math.round(e.avanceParcial * 1000) / 10}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{Math.round(e.avanceAcumulado * 1000) / 10}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{e.netoUF.toLocaleString('es-CL')}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{clp(e.netoCLP)}</td>
                  <td className="px-4 py-2.5">
                    <PuntoSemaforo nivel={e.estado === 'Pagado' ? 'verde' : 'amarillo'} />
                    <span className="text-xs text-slate-500 ml-2">{e.estado}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Gastos generales por categoría */}
      <section aria-label="Gastos generales">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide">
            Gastos generales — consumo {Math.round(pctGG * 100)}% del techo
          </h2>
          {datos.puedeEditar && !editandoTechos && (
            <button
              type="button"
              onClick={() => setEditandoTechos(true)}
              className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
            >
              <Pencil size={13} /> Ajustar techos
            </button>
          )}
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-ink-muted/40 bg-white dark:bg-ink-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-ink-muted/40">
                <th className="px-4 py-3 font-medium">Categoría</th>
                <th className="px-4 py-3 font-medium text-right">Techo UF</th>
                <th className="px-4 py-3 font-medium text-right">Techo CLP</th>
                <th className="px-4 py-3 font-medium text-right">Ejecutado</th>
                <th className="px-4 py-3 font-medium text-right">Remanente</th>
                <th className="px-4 py-3 font-medium w-36">Consumo</th>
                {editandoTechos && <th className="px-4 py-3 w-8" />}
              </tr>
            </thead>
            <tbody>
              {datos.ggCategorias.map((c) => {
                if (editandoTechos) {
                  const b = borrador(c)
                  return (
                    <tr key={c.id} className="border-b border-slate-100 dark:border-ink-muted/20">
                      <td className="px-4 py-1.5">
                        <input className={celda} value={b.categoria}
                          onChange={(e) => cambiar(c, 'categoria', e.target.value)} />
                      </td>
                      <td className="px-4 py-1.5 text-right tabular-nums text-slate-500 text-xs">{c.techoUF ?? '—'}</td>
                      <td className="px-4 py-1.5 w-32">
                        <input className={`${celda} text-right`} type="number" min="0" step="1000" value={b.techoCLP}
                          onChange={(e) => cambiar(c, 'techoCLP', e.target.value)} />
                      </td>
                      <td className="px-4 py-1.5 text-right tabular-nums text-xs">{clp(c.ejecutado)}</td>
                      <td className="px-4 py-1.5 text-right tabular-nums text-xs text-slate-500">{clp(c.remanente)}</td>
                      <td />
                      <td className="px-4 py-1.5">
                        <button type="button" aria-label={`Eliminar ${c.categoria}`} onClick={() => setConfirmQuitarCat(c)}
                          className="p-1 text-slate-400 hover:text-semaforo-critico">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                }
                return (
                  <tr key={c.id} className="border-b border-slate-100 dark:border-ink-muted/20 last:border-0">
                    <td className="px-4 py-2.5 text-ink dark:text-white">{c.categoria}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{c.techoUF ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{clp(c.techoCLP)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{clp(c.ejecutado)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${c.remanente < 0 ? 'text-semaforo-critico font-medium' : 'text-semaforo-verde'}`}>
                      {c.remanente < 0 ? `−${clp(-c.remanente)}` : clp(c.remanente)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <PuntoSemaforo nivel={nivelGG(c.pct)} />
                        <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-ink-muted/40">
                          <div
                            className="h-2 rounded-full bg-brand"
                            style={{ width: `${Math.min(100, Math.round(c.pct * 100))}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums w-9 text-right">{Math.round(c.pct * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {editandoTechos &&
                nuevasCat.map((n, i) => (
                  <tr key={`cat-${i}`} className="border-b border-brand/30 bg-brand/5">
                    <td className="px-4 py-1.5">
                      <input className={celda} placeholder="Nueva categoría" value={n.categoria}
                        onChange={(e) => cambiarNueva(i, 'categoria', e.target.value)} />
                    </td>
                    <td />
                    <td className="px-4 py-1.5 w-32">
                      <input className={`${celda} text-right`} type="number" min="0" step="1000"
                        placeholder="Techo CLP" value={n.techoCLP}
                        onChange={(e) => cambiarNueva(i, 'techoCLP', e.target.value)} />
                    </td>
                    <td colSpan={3} />
                    <td className="px-4 py-1.5">
                      <button type="button" aria-label="Quitar fila"
                        onClick={() => setNuevasCat(nuevasCat.filter((_, k) => k !== i))}
                        className="p-1 text-slate-400 hover:text-semaforo-critico">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {editandoTechos && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => setNuevasCat([...nuevasCat, { categoria: '', techoCLP: '' }])}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-brand text-brand text-sm font-medium hover:bg-brand/10"
            >
              <Plus size={15} /> Agregar categoría
            </button>
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={cancelarTechos}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-ink-muted text-sm">
                Cancelar
              </button>
              <button
                type="button"
                disabled={guardando}
                onClick={guardarTechos}
                className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-dark disabled:opacity-40"
              >
                {guardando ? 'Guardando…' : 'Guardar techos'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Nómina */}
      <section aria-label="Nómina">
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
          Remuneraciones del personal
        </h2>
        {datos.puedeVerSueldos ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-ink-muted/40 bg-white dark:bg-ink-soft">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-ink-muted/40">
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Cargo</th>
                  <th className="px-4 py-3 font-medium text-right">Imponible</th>
                  <th className="px-4 py-3 font-medium text-right">Costo mensual empresa</th>
                  <th className="px-4 py-3 font-medium text-right">Proyectado 145 días</th>
                </tr>
              </thead>
              <tbody>
                {datos.nomina.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100 dark:border-ink-muted/20 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-ink dark:text-white">{d.nombre}</td>
                    <td className="px-4 py-2.5 text-slate-500">{d.cargo}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{d.imponible != null ? clp(d.imponible) : '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{d.costoMensual != null ? clp(d.costoMensual) : '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{d.proyectado145d != null ? clp(d.proyectado145d) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Lock size={12} /> Tu rol no tiene acceso a remuneraciones.
          </p>
        )}
      </section>

      {/* Registro de gastos diarios */}
      <section aria-label="Registro de gastos">
        <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
          Registro diario de gastos
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-ink-muted/40 bg-white dark:bg-ink-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-ink-muted/40">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Categoría</th>
                <th className="px-4 py-3 font-medium">Detalle</th>
                <th className="px-4 py-3 font-medium">Responsable</th>
                <th className="px-4 py-3 font-medium text-right">Monto</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {datos.gastos.map((g) => (
                <tr key={g.id} className="border-b border-slate-100 dark:border-ink-muted/20 last:border-0">
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{fechaCorta(g.fecha)}</td>
                  <td className="px-4 py-2.5 text-ink dark:text-white">{g.categoria}</td>
                  <td className="px-4 py-2.5 text-slate-500">{g.detalle}</td>
                  <td className="px-4 py-2.5 text-slate-500">{g.responsable}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{clp(g.monto)}</td>
                  <td className="px-4 py-2.5">
                    <PuntoSemaforo nivel={g.revision === 'Aprobado' ? 'verde' : 'amarillo'} />
                    <span className="text-xs text-slate-500 ml-2">{g.revision}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Registrar gasto */}
      <Modal abierto={!!gastoForm} onCerrar={() => setGastoForm(null)} titulo="Registrar gasto">
        {gastoForm && (
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="block text-xs text-slate-500 mb-1">Categoría</span>
              <select
                className="w-full rounded-lg border border-slate-300 dark:border-ink-muted bg-transparent px-3 py-2 text-sm"
                value={gastoForm.categoria}
                onChange={(e) => setGastoForm({ ...gastoForm, categoria: e.target.value })}
              >
                {datos.ggCategorias.map((c) => (
                  <option key={c.id} value={c.categoria}>{c.categoria}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="block text-xs text-slate-500 mb-1">Detalle</span>
              <input
                className="w-full rounded-lg border border-slate-300 dark:border-ink-muted bg-transparent px-3 py-2 text-sm"
                placeholder="Ej: almuerzos cuadrilla semana 12"
                value={gastoForm.detalle}
                onChange={(e) => setGastoForm({ ...gastoForm, detalle: e.target.value })}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="block text-xs text-slate-500 mb-1">Monto CLP</span>
                <input
                  type="number" min="0"
                  className="w-full rounded-lg border border-slate-300 dark:border-ink-muted bg-transparent px-3 py-2 text-sm"
                  value={gastoForm.monto}
                  onChange={(e) => setGastoForm({ ...gastoForm, monto: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="block text-xs text-slate-500 mb-1">Fecha</span>
                <input
                  type="date"
                  className="w-full rounded-lg border border-slate-300 dark:border-ink-muted bg-transparent px-3 py-2 text-sm cursor-pointer"
                  value={gastoForm.fecha}
                  onChange={(e) => setGastoForm({ ...gastoForm, fecha: e.target.value })}
                  onClick={(e) => e.target.showPicker?.()}
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="block text-xs text-slate-500 mb-1">Responsable (opcional)</span>
              <input
                className="w-full rounded-lg border border-slate-300 dark:border-ink-muted bg-transparent px-3 py-2 text-sm"
                placeholder={usuario?.nombre}
                value={gastoForm.responsable}
                onChange={(e) => setGastoForm({ ...gastoForm, responsable: e.target.value })}
              />
            </label>
            <button
              type="button"
              disabled={guardando || !gastoForm.categoria || !(Number(gastoForm.monto) > 0)}
              onClick={enviarGasto}
              className="w-full rounded-lg bg-brand text-white py-2 text-sm font-medium hover:bg-brand-dark disabled:opacity-40"
            >
              {guardando ? 'Guardando…' : 'Registrar gasto'}
            </button>
          </div>
        )}
      </Modal>

      <Modal abierto={!!confirmQuitarCat} onCerrar={() => setConfirmQuitarCat(null)} titulo="Eliminar categoría">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          ¿Eliminar la categoría «{confirmQuitarCat?.categoria}»? Solo es posible si no tiene gastos.
        </p>
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={() => setConfirmQuitarCat(null)}
            className="flex-1 rounded-lg border border-slate-300 dark:border-ink-muted py-2 text-sm">
            Cancelar
          </button>
          <button type="button" onClick={quitarCategoria}
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
