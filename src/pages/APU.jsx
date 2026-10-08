import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Calculator } from 'lucide-react'
import { obtenerAPU } from '../lib/api.js'
import ObraNav from '../components/ObraNav.jsx'
import { clp } from '../lib/format.js'
import { useAuth } from '../context/auth.js'

const num = (n, d = 2) =>
  Number(n ?? 0).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: d })

export default function APU() {
  const { id } = useParams()
  const { usuario } = useAuth()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    obtenerAPU(id).then(setDatos).catch((e) => setError(e.message))
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
  if (!datos) return <p className="text-slate-500">Cargando APU…</p>

  const esTrabajador = usuario?.rolPrincipal === 'trabajador'

  return (
    <div className="space-y-5">
      <div>
        <Link to={`/obras/${id}`} className="inline-flex items-center gap-1 text-sm text-brand mb-3">
          <ArrowLeft size={15} /> Volver a la obra
        </Link>
        <h1 className="text-2xl flex items-center gap-2">
          <Calculator size={22} className="text-brand" /> Análisis de Precios Unitarios
        </h1>
        <p className="text-sm text-slate-500">
          Desglose de insumos por partida. UF de referencia: {clp(datos.valorUF)}.
        </p>
      </div>

      <ObraNav
        obraId={id}
        veCostos
        esTrabajador={esTrabajador}
        puedePlanificar={['admin', 'supervisor'].includes(usuario?.rolPrincipal)}
      />

      {datos.partidas.map((p) => {
        const total = p.subpartidas.reduce((s, x) => s + x.costoCLP, 0)
        return (
          <section
            key={p.id}
            className="rounded-xl border border-slate-200 dark:border-ink-muted/40 bg-white dark:bg-ink-soft overflow-hidden"
          >
            <header className="px-4 py-3 border-b border-slate-200 dark:border-ink-muted/40 bg-slate-50 dark:bg-ink/40">
              <h2 className="text-sm font-medium text-ink dark:text-white">
                Ítem {p.item} — {p.nombre}
              </h2>
              <p className="text-xs text-slate-500">
                {p.etapa} · Target: {num(p.targetUF)} UF/{p.unidad} = {clp(p.targetCLP)}/{p.unidad}
              </p>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-200 dark:border-ink-muted/40">
                    <th className="px-4 py-2.5 font-medium">Código / Insumo</th>
                    <th className="px-4 py-2.5 font-medium">Unidad</th>
                    <th className="px-4 py-2.5 font-medium text-right">Rendimiento</th>
                    <th className="px-4 py-2.5 font-medium text-right">P. Unit. ref.</th>
                    <th className="px-4 py-2.5 font-medium text-right">Costo directo</th>
                    <th className="px-4 py-2.5 font-medium text-right">Costo UF</th>
                  </tr>
                </thead>
                <tbody>
                  {p.subpartidas.map((s, i) => (
                    <tr key={i} className="border-b border-slate-100 dark:border-ink-muted/20 last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs text-slate-400 mr-2">{s.codigo}</span>
                        <span className="text-ink dark:text-white">{s.concepto}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{s.unidad}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{num(s.rendimiento, 3)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{clp(s.precioUnitario)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">{clp(s.costoCLP)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{num(s.costoUF, 3)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="text-xs font-medium border-t border-slate-200 dark:border-ink-muted/40">
                    <td className="px-4 py-2.5" colSpan={4}>Costo directo unitario calculado</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{clp(total)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">
                      {num(total / (datos.valorUF || 1), 3)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}
