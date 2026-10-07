import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function Modal({ abierto, onCerrar, titulo, children, ancho = 'max-w-md' }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!abierto) return
    const anterior = document.activeElement
    ref.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onCerrar?.()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      anterior?.focus?.()
    }
  }, [abierto, onCerrar])

  if (!abierto) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-ink/60 backdrop-blur-sm"
      onClick={onCerrar}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className={`w-full ${ancho} rounded-2xl bg-white dark:bg-ink-soft shadow-xl border border-slate-200 dark:border-ink-muted/40 p-5 max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-lg">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-ink-muted/30"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
