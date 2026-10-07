// Semáforo accesible: siempre color + texto, nunca solo color.
const ESTILOS = {
  verde: { punto: 'bg-semaforo-verde', texto: 'text-semaforo-verde', etiqueta: 'Al día' },
  amarillo: { punto: 'bg-semaforo-amarillo', texto: 'text-semaforo-amarillo', etiqueta: 'Al límite' },
  critico: { punto: 'bg-semaforo-critico', texto: 'text-semaforo-critico', etiqueta: 'Crítica' },
}

export default function Semaforo({ nivel, etiqueta, tamaño = 'md' }) {
  const e = ESTILOS[nivel] || ESTILOS.verde
  const punto = tamaño === 'lg' ? 'w-4 h-4' : 'w-3 h-3'
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`${punto} rounded-full ${e.punto}`} aria-hidden="true" />
      <span className={`text-sm font-medium ${e.texto}`}>{etiqueta ?? e.etiqueta}</span>
    </span>
  )
}

export function PuntoSemaforo({ nivel, tamaño = 'md' }) {
  const e = ESTILOS[nivel] || ESTILOS.verde
  const punto = tamaño === 'lg' ? 'w-4 h-4' : 'w-3 h-3'
  return <span className={`${punto} rounded-full ${e.punto} inline-block`} aria-hidden="true" />
}
