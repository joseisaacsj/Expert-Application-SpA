const fmtCLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

export function clp(monto) {
  return fmtCLP.format(monto ?? 0)
}

// dd/mm/aaaa
export function fechaCorta(fecha) {
  const d = new Date(fecha)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

// yyyy-mm-dd en hora local (para comparar "hoy" y inputs date)
export function fechaISO(fecha = new Date()) {
  const d = new Date(fecha)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}
