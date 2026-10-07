import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  HardHat,
  LayoutDashboard,
  ClipboardList,
  Users,
  Settings,
  Sun,
  Moon,
  LogOut,
  Wifi,
  WifiOff,
  PlusCircle,
} from 'lucide-react'
import { useAuth } from '../context/auth.js'
import { useTema } from '../context/theme.js'
import { sincronizarPendientes, listarPendientes } from '../lib/offline.js'
import { rolTexto } from '../lib/roles.js'

export default function Layout() {
  const { usuario, logout } = useAuth()
  const { tema, alternarTema } = useTema()
  const navigate = useNavigate()
  const [enLinea, setEnLinea] = useState(navigator.onLine)
  const [pendientes, setPendientes] = useState(0)
  const [sincronizando, setSincronizando] = useState(false)

  useEffect(() => {
    const contar = () => listarPendientes().then((l) => setPendientes(l.length)).catch(() => {})
    const sincronizar = () => {
      if (!navigator.onLine) return
      setSincronizando(true)
      sincronizarPendientes(contar)
        .catch(() => {})
        .finally(() => setSincronizando(false))
    }
    const online = () => {
      setEnLinea(true)
      sincronizar()
    }
    const offline = () => setEnLinea(false)

    contar()
    sincronizar() // al abrir la app con señal, se envían los pendientes
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    window.addEventListener('ea-pendientes', contar)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      window.removeEventListener('ea-pendientes', contar)
    }
  }, [])

  const esAdmin = usuario?.rolGlobal === 'admin'

  const nav = [
    { a: '/', texto: 'Tablero', icono: LayoutDashboard },
    { a: '/reporte', texto: 'Reporte diario', icono: ClipboardList },
    { a: '/rrhh', texto: 'RRHH', icono: Users },
    ...(esAdmin ? [{ a: '/admin', texto: 'Administración', icono: Settings }] : []),
  ]

  const linkClase = ({ isActive }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-brand/10 text-brand dark:text-brand-light'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-ink-muted/30'
    }`

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-ink/90 backdrop-blur border-b border-slate-200 dark:border-ink-muted/40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <NavLink to="/" className="flex items-center gap-2 font-bold text-ink dark:text-white">
            <HardHat className="text-brand" size={22} />
            <span className="hidden sm:inline">Expert Applicator</span>
          </NavLink>

          <nav className="flex-1 flex items-center gap-1 overflow-x-auto ml-2">
            {nav.map(({ a, texto, icono: Icono }) => (
              <NavLink key={a} to={a} end={a === '/'} className={linkClase}>
                <Icono size={16} />
                <span className="hidden md:inline whitespace-nowrap">{texto}</span>
              </NavLink>
            ))}
          </nav>

          <span
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
              enLinea
                ? 'bg-semaforo-verde/10 text-semaforo-verde'
                : 'bg-semaforo-amarillo/10 text-semaforo-amarillo'
            }`}
            title={enLinea ? 'Con conexión' : 'Sin conexión — los reportes se guardan en el teléfono'}
          >
            {enLinea ? <Wifi size={13} /> : <WifiOff size={13} />}
            {pendientes > 0 && (
              <span>{sincronizando ? 'Sincronizando…' : `${pendientes} pendiente${pendientes > 1 ? 's' : ''}`}</span>
            )}
          </span>

          <button
            type="button"
            onClick={alternarTema}
            aria-label="Cambiar tema"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-ink-muted/30"
          >
            {tema === 'oscuro' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="hidden sm:block text-right leading-tight">
            <div className="text-sm font-medium text-ink dark:text-white">{usuario?.nombre}</div>
            <div className="text-xs text-slate-500">{rolTexto(usuario?.rolGlobal)}</div>
          </div>

          <button
            type="button"
            onClick={() => {
              logout()
              navigate('/login')
            }}
            aria-label="Cerrar sesión"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-ink-muted/30"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

export function BotonNuevaObra() {
  return (
    <NavLink
      to="/obras/nueva"
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-medium transition-colors"
    >
      <PlusCircle size={16} />
      Nueva obra
    </NavLink>
  )
}
