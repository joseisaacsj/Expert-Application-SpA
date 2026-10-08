// Funciones puras de cálculo de indicadores de obra.
// Nada aquí se guarda en la base de datos: los indicadores siempre se calculan.

export const UMBRALES_DEFECTO = {
  // Plazo: porcentaje del plazo contractual consumido.
  // Verde hasta 33%, amarillo hasta 50%, naranja hasta 66%, crítico sobre 66%.
  plazoVerde: 0.33,
  plazoAmarillo: 0.5,
  plazoNaranja: 0.66,
  costoVerde: 1.0,
  costoAmarillo: 0.95,
  materialesVerde: 0.8,
  materialesAmarillo: 0.5,
  docVerde: 1.0,
  docAmarillo: 0.5,
}

export const NIVELES = ['verde', 'amarillo', 'naranja', 'critico']

const MS_DIA = 24 * 60 * 60 * 1000

export function diasEntre(fechaInicio, fechaFin) {
  const inicio = new Date(fechaInicio)
  const fin = new Date(fechaFin)
  return Math.max(0, Math.round((fin - inicio) / MS_DIA))
}

// Avance de una partida: ejecutado acumulado / planificado, tope 100%.
export function avancePartida(ejecutada, planificada) {
  if (!planificada || planificada <= 0) return 0
  return Math.min(1, ejecutada / planificada)
}

// Avance global ponderado por presupuesto.
// partidas: [{ presupuesto, ejecutada, planificada }]
export function avanceGlobal(partidas) {
  const presupuestoTotal = partidas.reduce((s, p) => s + (p.presupuesto || 0), 0)
  if (presupuestoTotal <= 0) return 0
  const ganado = partidas.reduce(
    (s, p) => s + (p.presupuesto || 0) * avancePartida(p.ejecutada, p.planificada),
    0,
  )
  return ganado / presupuestoTotal
}

// Avance programado lineal.
export function estrategiaLineal({ fechaInicio, plazoDias }, hoy) {
  if (!plazoDias || plazoDias <= 0) return 0
  return Math.min(1, diasEntre(fechaInicio, hoy) / plazoDias)
}

// Curva S (smoothstep): inicio lento, ritmo medio alto, cierre suave.
// p(x) = 3x² - 2x³ con x = fracción del plazo consumido.
export function estrategiaCurvaS(obra, hoy) {
  const x = estrategiaLineal(obra, hoy)
  return x * x * (3 - 2 * x)
}

export function avanceProgramado(obra, hoy, estrategia = estrategiaCurvaS) {
  return estrategia(obra, hoy)
}

// SPI: índice de desempeño de plazo.
export function spi(real, programado) {
  if (programado <= 0) return real > 0 ? Infinity : 1
  return real / programado
}

// Valor ganado y CPI: índice de desempeño de costo.
export function valorGanado(avGlobal, presupuestoTotal) {
  return avGlobal * presupuestoTotal
}

export function cpi(valorGan, gastoReal) {
  if (gastoReal <= 0) return valorGan > 0 ? Infinity : 1
  return valorGan / gastoReal
}

// Documentación del día: personas que reportaron / dotación activa.
export function documentacionDia(reportaron, dotacion) {
  if (dotacion <= 0) return 1
  return Math.min(1, reportaron / dotacion)
}

// Precio de partida estilo presupuesto de contrato:
// Total Neto CLP = cantidad × precio unitario CLP × (1 + GG + utilidad).
export function totalNetoPartida(cantidad, precioUnitarioCLP, gg = 0.325, util = 0.15) {
  return cantidad * precioUnitarioCLP * (1 + gg + util)
}

// Incidencia: peso de la partida en el presupuesto total.
export function incidencia(partidaNeto, totalNeto) {
  if (!totalNeto || totalNeto <= 0) return 0
  return partidaNeto / totalNeto
}

function nivel(valor, verde, amarillo) {
  if (valor >= verde) return 'verde'
  if (valor >= amarillo) return 'amarillo'
  return 'critico'
}

function pct(n) {
  return `${Math.round(n * 100)}%`
}

// Indicadores completos de una obra. `reportaronHoy` es la cantidad de
// personas con reporte en la fecha `hoy` (los días "Sin faena" no alertan).
export function indicadoresObra({
  obra,
  partidas,
  gastoReal,
  materialesPct,
  reportaronHoy,
  huboSinFaenaHoy,
  hoy,
  estrategia,
}) {
  const u = { ...UMBRALES_DEFECTO, ...(obra.umbrales || {}) }
  const presupuestoTotal = partidas.reduce((s, p) => s + (p.presupuesto || 0), 0)

  const real = avanceGlobal(partidas)
  const programado = avanceProgramado(obra, hoy, estrategia)
  const spiValor = spi(real, programado)
  const vg = valorGanado(real, presupuestoTotal)
  const cpiValor = cpi(vg, gastoReal)
  const docValor = documentacionDia(reportaronHoy, obra.dotacionActiva ?? 0)

  const diferenciaPts = Math.round((programado - real) * 100)
  const diasConsumidos = diasEntre(obra.fechaInicio, hoy)
  const plazoConsumido = obra.plazoDias > 0 ? Math.min(1, diasConsumidos / obra.plazoDias) : 0
  const diasRestantes = Math.max(0, obra.plazoDias - diasConsumidos)

  // Nivel del plazo: 4 bandas sobre el % del plazo contractual consumido.
  const nivelPlazo =
    plazoConsumido <= u.plazoVerde
      ? 'verde'
      : plazoConsumido <= u.plazoAmarillo
        ? 'amarillo'
        : plazoConsumido <= u.plazoNaranja
          ? 'naranja'
          : 'critico'

  const indicadores = [
    {
      id: 'plazo',
      nombre: 'Plazo',
      valor: plazoConsumido,
      valorTexto: `${diasRestantes} días`,
      nivel: nivelPlazo,
      detalle:
        `Faltan ${diasRestantes} días para el término ` +
        `(${pct(plazoConsumido)} del plazo consumido). ` +
        (diferenciaPts > 0
          ? `Avance ${diferenciaPts} pts bajo lo programado.`
          : 'Avance al día o adelantado.'),
      explicacion:
        `Semáforo por plazo consumido: ${diasConsumidos} de ${obra.plazoDias} días ` +
        `(${pct(plazoConsumido)}). Verde ≤33%, amarillo ≤50%, naranja ≤66%, rojo sobre 66%. ` +
        `SPI = avance real ${pct(real)} ÷ programado ${pct(programado)} = ` +
        `${Number.isFinite(spiValor) ? spiValor.toFixed(2) : '—'} (curva S).`,
      spi: spiValor,
      diasRestantes,
    },
    {
      id: 'costo',
      nombre: 'Costo (CPI)',
      valor: cpiValor,
      valorTexto: Number.isFinite(cpiValor) ? cpiValor.toFixed(2) : '—',
      nivel: nivel(cpiValor, u.costoVerde, u.costoAmarillo),
      detalle:
        cpiValor >= 1
          ? 'Gasto dentro del valor ganado'
          : 'El gasto supera el valor ganado',
      explicacion:
        `Valor ganado (avance global × presupuesto) ÷ gasto real acumulado.`,
    },
    {
      id: 'materiales',
      nombre: 'Materiales',
      valor: materialesPct,
      valorTexto: pct(materialesPct),
      nivel: nivel(materialesPct, u.materialesVerde, u.materialesAmarillo),
      detalle: `${pct(materialesPct)} comprado de lo requerido`,
      explicacion:
        'Porcentaje de materiales comprados respecto de lo requerido para la obra. En el demo es un dato cargado.',
    },
    {
      id: 'documentacion',
      nombre: 'Documentación',
      valor: docValor,
      valorTexto: `${reportaronHoy}/${obra.dotacionActiva ?? 0}`,
      nivel: huboSinFaenaHoy
        ? 'verde'
        : nivel(docValor, u.docVerde, u.docAmarillo),
      detalle: huboSinFaenaHoy
        ? 'Día declarado sin faena'
        : `${reportaronHoy} de ${obra.dotacionActiva ?? 0} reportaron hoy`,
      explicacion:
        'Personas que enviaron reporte hoy ÷ dotación activa. Los días declarados "Sin faena" no generan alerta.',
    },
  ]

  const peor = indicadores.reduce((a, b) =>
    NIVELES.indexOf(b.nivel) > NIVELES.indexOf(a.nivel) ? b : a,
  )

  return {
    indicadores,
    estado: peor.nivel,
    causa: peor.detalle,
    avanceReal: real,
    avanceProgramado: programado,
    plazoConsumido,
    diasRestantes,
    spi: spiValor,
    presupuestoTotal,
    gastoReal,
    valorGanado: vg,
  }
}
