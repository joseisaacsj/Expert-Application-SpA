import { useEffect, useState } from 'react'
import { UserCog, RotateCcw } from 'lucide-react'
import { obtenerUsuarios, obtenerObrasParaClonar, actualizarMembresia, resetearDemo } from '../lib/api.js'
import Modal from '../components/Modal.jsx'
import { rolTexto } from '../lib/roles.js'
import { useAuth } from '../context/auth.js'

const ROLES = ['supervisor', 'jefe_cuadrilla', 'trabajador', 'rrhh']

const selectClase =
  'rounded-lg border border-slate-300 dark:border-ink-muted bg-white dark:bg-ink-soft px-2 py-1.5 text-sm'

export default function Administracion() {
  const { logout } = useAuth()
  const [usuarios, setUsuarios] = useState(null)
  const [obras, setObras] = useState([])
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const [form, setForm] = useState({ usuarioId: '', obraId: '', rol: 'trabajador', verSueldos: false })

  function cargar() {
    obtenerUsuarios().then(setUsuarios).catch((e) => setError(e.message))
    obtenerObrasParaClonar().then((o) => setObras(o.map((x) => ({ id: x.id, nombre: x.nombre })))).catch(() => {})
  }
  useEffect(cargar, [])

  async function asignar() {
    if (!form.usuarioId || !form.obraId) return
    try {
      await actualizarMembresia({
        usuarioObjetivo: form.usuarioId,
        obraId: form.obraId,
        rol: form.rol,
        permisos: form.verSueldos ? ['ver_sueldos'] : [],
      })
      setModal({ titulo: 'Rol actualizado', texto: 'La membresía quedó guardada.' })
      cargar()
    } catch (e) {
      setModal({ titulo: 'Error', texto: e.message })
    }
  }

  if (error) return <p role="alert" className="text-semaforo-critico">{error}</p>
  if (!usuarios) return <p className="text-slate-500">Cargando usuarios…</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl">Administración</h1>
          <p className="text-sm text-slate-500">Usuarios y roles por obra.</p>
        </div>
        <button type="button" onClick={() => setConfirmReset(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-ink-muted text-sm hover:border-brand hover:text-brand">
          <RotateCcw size={15} /> Restablecer datos demo
        </button>
      </div>

      {/* Asignar rol */}
      <section className="bg-white dark:bg-ink-soft rounded-2xl border border-slate-200 dark:border-ink-muted/40 p-5">
        <h2 className="text-base mb-3 flex items-center gap-2">
          <UserCog size={17} className="text-brand" /> Asignar rol en una obra
        </h2>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-xs text-slate-500">
            Usuario
            <select className={`${selectClase} block mt-1`} value={form.usuarioId}
              onChange={(e) => setForm({ ...form, usuarioId: e.target.value })}>
              <option value="">Seleccionar…</option>
              {usuarios.filter((u) => u.rolGlobal !== 'admin').map((u) => (
                <option key={u.id} value={u.id}>{u.nombre} ({u.usuario})</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-500">
            Obra
            <select className={`${selectClase} block mt-1`} value={form.obraId}
              onChange={(e) => setForm({ ...form, obraId: e.target.value })}>
              <option value="">Seleccionar…</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>{o.nombre}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-500">
            Rol
            <select className={`${selectClase} block mt-1`} value={form.rol}
              onChange={(e) => setForm({ ...form, rol: e.target.value })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{rolTexto(r)}</option>
              ))}
            </select>
          </label>
          {form.rol === 'rrhh' && (
            <label className="flex items-center gap-2 text-xs text-slate-500 pb-2">
              <input type="checkbox" className="accent-brand" checked={form.verSueldos}
                onChange={(e) => setForm({ ...form, verSueldos: e.target.checked })} />
              Permitir ver sueldos
            </label>
          )}
          <button type="button" onClick={asignar} disabled={!form.usuarioId || !form.obraId}
            className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium disabled:opacity-40 hover:bg-brand-dark">
            Guardar
          </button>
        </div>
      </section>

      {/* Lista de usuarios */}
      <section className="space-y-3">
        {usuarios.map((u) => (
          <div key={u.id} className="bg-white dark:bg-ink-soft rounded-xl border border-slate-200 dark:border-ink-muted/40 p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="font-medium text-ink dark:text-white">{u.nombre}</span>
                <span className="text-xs text-slate-400 ml-2 font-mono">{u.usuario}</span>
              </div>
              <span className="text-xs text-slate-500">
                {u.rolGlobal === 'admin' ? 'Administrador general' : 'Usuario'}
              </span>
            </div>
            {u.membresias.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {u.membresias.map((m) => (
                  <li key={m.obraId} className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-ink-muted/30 text-slate-600 dark:text-slate-300">
                    {m.obra}: <strong>{rolTexto(m.rol)}</strong>
                    {m.permisos?.includes('ver_sueldos') && ' + sueldos'}
                  </li>
                ))}
              </ul>
            ) : (
              u.rolGlobal !== 'admin' && <p className="text-xs text-slate-400">Sin obras asignadas.</p>
            )}
          </div>
        ))}
      </section>

      <Modal abierto={!!modal} onCerrar={() => setModal(null)} titulo={modal?.titulo || ''}>
        <p className="text-sm text-slate-600 dark:text-slate-300">{modal?.texto}</p>
        <button type="button" onClick={() => setModal(null)}
          className="mt-4 w-full rounded-lg bg-brand text-white py-2 text-sm font-medium">
          Entendido
        </button>
      </Modal>

      <Modal abierto={confirmReset} onCerrar={() => setConfirmReset(false)} titulo="Restablecer demo">
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">
          Se borrarán todos los cambios (reportes, obras nuevas, roles) y se volverá a los datos de demo iniciales. ¿Continuar?
        </p>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => setConfirmReset(false)}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-ink-muted text-sm">
            Cancelar
          </button>
          <button type="button"
            onClick={async () => {
              await resetearDemo()
              setConfirmReset(false)
              logout()
            }}
            className="px-4 py-2 rounded-lg bg-semaforo-critico text-white text-sm font-medium">
            Restablecer
          </button>
        </div>
      </Modal>
    </div>
  )
}
