import * as XLSX from 'xlsx'
import { fechaCorta } from './format.js'

// Exporta el detalle de la obra a un .xlsx real (SheetJS, 100% cliente).
// Solo exporta lo que la API entregó: si el usuario no ve costos,
// el archivo tampoco los incluye.
export function exportarObraExcel(obra) {
  const wb = XLSX.utils.book_new()

  // Hoja 1: resumen
  const resumen = [
    ['Obra', obra.nombre],
    ['Ubicación', obra.ubicacion],
    ['Estado', obra.estado],
    ['Fecha de inicio', fechaCorta(obra.fechaInicio)],
    ['Plazo (días)', obra.plazoDias],
    [],
    ['Indicador', 'Valor', 'Estado', 'Detalle'],
    ...obra.indicadores
      .filter((i) => !i.oculto)
      .map((i) => [i.nombre, i.valorTexto, i.nivel, i.detalle]),
    ['Avance real', `${Math.round(obra.avanceReal * 100)}%`],
    ['Avance programado', `${Math.round(obra.avanceProgramado * 100)}%`],
  ]
  if (obra.presupuestoTotal != null) {
    resumen.push(
      ['Presupuesto total', obra.presupuestoTotal],
      ['Gasto real', obra.gastoReal],
      ['Valor ganado', Math.round(obra.valorGanado)],
    )
  }
  const wsResumen = XLSX.utils.aoa_to_sheet(resumen)
  wsResumen['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 12 }, { wch: 45 }]
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  // Hoja 2: partidas
  const conPresupuesto = obra.partidas.some((p) => p.presupuesto != null)
  const encabezado = ['#', 'Partida', 'Unidad', 'Planificada', 'Ejecutada', 'Avance %']
  if (conPresupuesto) encabezado.push('Presupuesto')
  const filas = obra.partidas.map((p) => {
    const fila = [p.orden, p.nombre, p.unidad, p.planificada, p.ejecutada, Math.round(p.avance * 100)]
    if (conPresupuesto) fila.push(p.presupuesto)
    return fila
  })
  const wsPartidas = XLSX.utils.aoa_to_sheet([encabezado, ...filas])
  wsPartidas['!cols'] = [{ wch: 4 }, { wch: 34 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, wsPartidas, 'Partidas')

  // Hoja 3: alertas
  if (obra.alertas?.length) {
    const wsAlertas = XLSX.utils.aoa_to_sheet([
      ['Nivel', 'Alerta'],
      ...obra.alertas.map((a) => [a.nivel, a.texto]),
    ])
    wsAlertas['!cols'] = [{ wch: 10 }, { wch: 60 }]
    XLSX.utils.book_append_sheet(wb, wsAlertas, 'Alertas')
  }

  const nombreArchivo = `obra-${obra.nombre.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.xlsx`
  XLSX.writeFile(wb, nombreArchivo)
}
