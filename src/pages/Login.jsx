import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Sun, Moon } from 'lucide-react'
import { useAuth } from '../context/auth.js'
import { useTema } from '../context/theme.js'

const USUARIOS_DEMO = [
  { usuario: 'ccarrasco', nombre: 'Claudio Carrasco', rol: 'Gerente General' },
  { usuario: 'jcarrillo', nombre: 'Jeannette Carrillo', rol: 'Administradora' },
  { usuario: 'mmansilla', nombre: 'Mauricio Mansilla', rol: 'Supervisor de Obras' },
  { usuario: 'finanzas', nombre: 'Encargado de Finanzas', rol: 'Finanzas' },
  { usuario: 'rrhh', nombre: 'Encargado de RRHH', rol: 'RRHH' },
  { usuario: 'maestro1', nombre: 'Maestro de Cuadrilla 1', rol: 'Trabajador' },
  { usuario: 'maestro2', nombre: 'Maestro de Cuadrilla 2', rol: 'Trabajador' },
  { usuario: 'maestro3', nombre: 'Maestro de Cuadrilla 3', rol: 'Trabajador' },
  { usuario: 'albanil', nombre: 'Albañil', rol: 'Trabajador' },
  { usuario: 'carpintero', nombre: 'Carpintero', rol: 'Trabajador' },
  { usuario: 'soldador', nombre: 'Soldador', rol: 'Trabajador' },
]

export default function Login() {
  const { login } = useAuth()
  const { tema, alternarTema } = useTema()
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      await login(usuario, password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-brand/5 to-transparent">
      <button
        type="button"
        onClick={alternarTema}
        aria-label="Cambiar tema"
        className="absolute top-4 right-4 p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-ink-muted/30"
      >
        {tema === 'oscuro' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="w-full max-w-3xl grid gap-6 sm:grid-cols-[1fr_1.1fr] sm:items-start">
        <div>
          <div className="text-center mb-8">
            <img src="/logo.png" alt="Saint-Jérôme" className="h-16 w-auto mx-auto mb-3 rounded-md bg-white px-3 py-1 shadow-sm" />
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Control de obras y remodelaciones industriales
            </p>
          </div>

          <form
            onSubmit={entrar}
            className="bg-white dark:bg-ink-soft rounded-2xl border border-slate-200 dark:border-ink-muted/40 p-6 shadow-sm space-y-4"
          >
          <div>
            <label htmlFor="usuario" className="block text-sm font-medium mb-1">
              Usuario
            </label>
            <input
              id="usuario"
              type="text"
              autoComplete="username"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 dark:border-ink-muted bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 dark:border-ink-muted bg-transparent px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-semaforo-critico">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-60 text-white font-medium py-2.5 text-sm transition-colors"
          >
            <LogIn size={16} />
            {cargando ? 'Ingresando…' : 'Ingresar'}
          </button>
          </form>
        </div>

        <div className="bg-white/60 dark:bg-ink-soft/60 rounded-2xl border border-slate-200 dark:border-ink-muted/40 p-4">
          <p className="text-xs text-center text-slate-500 mb-3">
            Usuarios de demo — contraseña <code className="font-mono">demo1234</code>
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            {USUARIOS_DEMO.map((u) => (
              <button
                key={u.usuario}
                type="button"
                onClick={() => {
                  setUsuario(u.usuario)
                  setPassword('demo1234')
                }}
                className="flex items-center justify-between px-3 py-1.5 rounded-lg border border-slate-200 dark:border-ink-muted/40 bg-white dark:bg-ink-soft text-sm hover:border-brand transition-colors text-left"
              >
                <span>
                  <span className="font-medium text-ink dark:text-white">{u.nombre}</span>
                  <span className="text-slate-400 ml-2 font-mono text-xs">{u.usuario}</span>
                </span>
                <span className="text-xs text-slate-500">{u.rol}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
