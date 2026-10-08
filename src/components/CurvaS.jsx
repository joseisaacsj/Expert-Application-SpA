// Curva S: avance programado (línea continua) vs avance real (línea punteada
// con puntos). Se distingue por forma de trazo, no solo por color.
const W = 640
const H = 260
const M = { izq: 44, der: 16, arr: 16, abj: 34 }

export default function CurvaS({ puntos }) {
  if (!puntos?.length) return null

  const n = puntos.length
  const x = (i) => M.izq + (i / (n - 1)) * (W - M.izq - M.der)
  const y = (v) => M.arr + (1 - v) * (H - M.arr - M.abj)

  const prog = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.programado).toFixed(1)}`).join(' ')
  const reales = puntos.filter((p) => p.real != null)
  const realPath = reales.length
    ? reales
        .map((p) => {
          const i = puntos.indexOf(p)
          return `${i === 0 || reales.indexOf(p) === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.real).toFixed(1)}`
        })
        .join(' ')
    : null

  const ultimaReal = reales[reales.length - 1]
  const iHoy = ultimaReal ? puntos.indexOf(ultimaReal) : -1
  const ticksY = [0, 0.25, 0.5, 0.75, 1]

  return (
    <figure aria-label="Curva S: avance programado versus avance real por semana">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
        {/* Grilla horizontal */}
        {ticksY.map((t) => (
          <g key={t}>
            <line x1={M.izq} x2={W - M.der} y1={y(t)} y2={y(t)} className="stroke-slate-200 dark:stroke-ink-muted/40" strokeWidth="1" />
            <text x={M.izq - 8} y={y(t) + 4} textAnchor="end" className="fill-slate-400" fontSize="10">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}

        {/* Marcador "hoy" (última semana con dato real) */}
        {iHoy >= 0 && (
          <line x1={x(iHoy)} x2={x(iHoy)} y1={M.arr} y2={H - M.abj} className="stroke-brand" strokeWidth="1.5" strokeDasharray="3 3" />
        )}

        {/* Programado — línea continua */}
        <path d={prog} fill="none" className="stroke-ink dark:stroke-white" strokeWidth="2" />

        {/* Real — línea punteada con puntos */}
        {realPath && (
          <path d={realPath} fill="none" className="stroke-brand" strokeWidth="2.5" strokeDasharray="6 4" />
        )}
        {reales.map((p) => {
          const i = puntos.indexOf(p)
          return (
            <circle key={i} cx={x(i)} cy={y(p.real)} r="3.5" className="fill-brand">
              <title>{`Semana ${p.semana}: real ${Math.round(p.real * 100)}%, programado ${Math.round(p.programado * 100)}%`}</title>
            </circle>
          )
        })}

        {/* Etiquetas eje X cada 4 semanas */}
        {puntos.map((p, i) =>
          p.semana % 4 === 1 || i === n - 1 ? (
            <text key={i} x={x(i)} y={H - M.abj + 16} textAnchor="middle" className="fill-slate-400" fontSize="9">
              S{p.semana}
            </text>
          ) : null,
        )}
      </svg>
      <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block w-6 border-t-2 border-ink dark:border-white" aria-hidden="true" />
          Programado (curva S)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block w-6 border-t-2 border-dashed border-brand" aria-hidden="true" />
          Real acumulado
        </span>
        {ultimaReal && (
          <span>
            Hoy: real {Math.round(ultimaReal.real * 100)}% vs programado {Math.round(ultimaReal.programado * 100)}%
          </span>
        )}
      </figcaption>
    </figure>
  )
}
