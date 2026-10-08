import { NavLink } from 'react-router-dom'
import {
  LayoutList,
  FileSpreadsheet,
  Calculator,
  CalendarDays,
  CalendarRange,
  Package,
  Banknote,
  Users,
} from 'lucide-react'

// Sub-navegación de una obra: cada vista funcional tiene URL propia.
// veCostos oculta las secciones con información sensible (el servidor
// igual las bloquea; esto es solo para no mostrar enlaces rotos).
export default function ObraNav({ obraId, veCostos, esTrabajador, puedePlanificar }) {
  const base = `/obras/${obraId}`
  const items = [
    { a: base, texto: 'Resumen', icono: LayoutList, end: true },
    { a: `${base}/registro`, texto: 'Registro diario', icono: CalendarDays },
    ...(puedePlanificar
      ? [{ a: `${base}/planificacion`, texto: 'Planificación', icono: CalendarRange }]
      : []),
    ...(veCostos
      ? [
          { a: `${base}/presupuesto`, texto: 'Presupuesto', icono: FileSpreadsheet },
          { a: `${base}/apu`, texto: 'APU', icono: Calculator },
          { a: `${base}/materiales`, texto: 'Materiales', icono: Package },
          { a: `${base}/finanzas`, texto: 'Finanzas', icono: Banknote },
        ]
      : []),
    ...(!esTrabajador ? [{ a: `${base}/rrhh`, texto: 'RRHH', icono: Users }] : []),
  ]

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-ink-muted/40 -mb-px" aria-label="Secciones de la obra">
      {items.map(({ a, texto, icono: Icono, end }) => (
        <NavLink
          key={a}
          to={a}
          end={end}
          className={({ isActive }) =>
            `inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              isActive
                ? 'border-brand text-brand'
                : 'border-transparent text-slate-500 hover:text-ink dark:hover:text-white hover:border-slate-300'
            }`
          }
        >
          <Icono size={15} />
          {texto}
        </NavLink>
      ))}
    </nav>
  )
}
