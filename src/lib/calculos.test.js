import { describe, it, expect } from 'vitest'
import {
  avancePartida,
  avanceGlobal,
  avanceProgramado,
  spi,
  cpi,
  valorGanado,
  documentacionDia,
  indicadoresObra,
  totalNetoPartida,
  incidencia,
  UMBRALES_DEFECTO,
} from './calculos.js'

describe('avancePartida', () => {
  it('calcula ejecutada/planificada', () => {
    expect(avancePartida(50, 100)).toBe(0.5)
  })
  it('topa en 100% aunque se ejecute de más', () => {
    expect(avancePartida(120, 100)).toBe(1)
  })
  it('devuelve 0 sin planificado', () => {
    expect(avancePartida(10, 0)).toBe(0)
  })
})

describe('avanceGlobal', () => {
  const partidas = [
    { presupuesto: 100, ejecutada: 100, planificada: 100 }, // 100%
    { presupuesto: 300, ejecutada: 50, planificada: 100 }, // 50%
  ]
  it('pondera por presupuesto', () => {
    // (100*1 + 300*0.5) / 400 = 0.625
    expect(avanceGlobal(partidas)).toBeCloseTo(0.625)
  })
  it('devuelve 0 sin presupuesto', () => {
    expect(avanceGlobal([{ presupuesto: 0, ejecutada: 5, planificada: 5 }])).toBe(0)
  })
})

describe('avanceProgramado', () => {
  it('es una curva S por defecto (más lenta al inicio y al final)', () => {
    const obra = { fechaInicio: '2026-01-01', plazoDias: 100 }
    const x = 49 / 100
    const esperado = x * x * (3 - 2 * x)
    expect(avanceProgramado(obra, '2026-02-19')).toBeCloseTo(esperado, 3)
    // En el punto medio la curva vale exactamente 0,5.
    const mitad = avanceProgramado(obra, '2026-02-20')
    expect(mitad).toBeCloseTo(0.5, 2)
  })
  it('topa en 100% pasado el plazo', () => {
    const obra = { fechaInicio: '2026-01-01', plazoDias: 10 }
    expect(avanceProgramado(obra, '2026-03-01')).toBe(1)
  })
  it('acepta estrategia reemplazable', () => {
    const obra = { fechaInicio: '2026-01-01', plazoDias: 100 }
    expect(avanceProgramado(obra, '2026-02-01', () => 0.42)).toBe(0.42)
  })
})

describe('spi y cpi', () => {
  it('spi = real/programado', () => {
    expect(spi(0.45, 0.5)).toBeCloseTo(0.9)
  })
  it('cpi = valor ganado / gasto real', () => {
    expect(cpi(100, 110)).toBeCloseTo(0.909, 2)
  })
  it('cpi sin gasto devuelve 1 si no hay valor ganado', () => {
    expect(cpi(0, 0)).toBe(1)
  })
  it('valorGanado = avance * presupuesto', () => {
    expect(valorGanado(0.5, 1000000)).toBe(500000)
  })
})

describe('documentacionDia', () => {
  it('fracción de dotación que reportó', () => {
    expect(documentacionDia(3, 4)).toBe(0.75)
  })
  it('sin dotación no genera alerta', () => {
    expect(documentacionDia(0, 0)).toBe(1)
  })
})

describe('precio de partida (formato hoja de control)', () => {
  it('total neto = cantidad × P.Unit CLP × (1 + GG + util)', () => {
    // 100 m² × $10.000 × 1,475 = $1.475.000
    expect(totalNetoPartida(100, 10000)).toBeCloseTo(1475000)
  })
  it('respeta GG y utilidad personalizados', () => {
    expect(totalNetoPartida(100, 10000, 0, 0)).toBe(1000000)
  })
  it('incidencia es el peso de la partida en el total', () => {
    expect(incidencia(250, 1000)).toBe(0.25)
    expect(incidencia(10, 0)).toBe(0)
  })
})

describe('indicadoresObra', () => {
  const base = {
    obra: { fechaInicio: '2026-01-01', plazoDias: 100, dotacionActiva: 4 },
    partidas: [{ presupuesto: 1000, ejecutada: 50, planificada: 100 }],
    gastoReal: 500,
    materialesPct: 0.9,
    reportaronHoy: 4,
    huboSinFaenaHoy: false,
    hoy: '2026-02-19', // ~49% programado vs 50% real → SPI ~1.02 verde
  }

  it('estado general es el peor indicador', () => {
    const r = indicadoresObra({ ...base, materialesPct: 0.3 })
    expect(r.estado).toBe('critico')
    expect(r.causa).toContain('30%')
  })

  it('sin faena hoy no alerta por documentación', () => {
    const r = indicadoresObra({ ...base, reportaronHoy: 0, huboSinFaenaHoy: true })
    const doc = r.indicadores.find((i) => i.id === 'documentacion')
    expect(doc.nivel).toBe('verde')
  })

  it('semáforo de plazo por fracción del plazo consumido', () => {
    // 49 de 100 días → 49% consumido → banda amarilla (entre 33% y 50%).
    const r = indicadoresObra(base)
    const plazo = r.indicadores.find((i) => i.id === 'plazo')
    expect(plazo.nivel).toBe('amarillo')
    expect(plazo.diasRestantes).toBe(51)
    expect(plazo.valorTexto).toContain('51')
  })

  it('umbrales editables por obra cambian el semáforo de plazo', () => {
    const r = indicadoresObra({
      ...base,
      obra: {
        ...base.obra,
        umbrales: { ...UMBRALES_DEFECTO, plazoVerde: 0.6 },
      },
    })
    const plazo = r.indicadores.find((i) => i.id === 'plazo')
    expect(plazo.nivel).toBe('verde') // 49% consumido < 60%
  })

  it('plazo en naranja entre 50% y 66% consumido', () => {
    const r = indicadoresObra({ ...base, hoy: '2026-02-25' }) // 55 días = 55%
    const plazo = r.indicadores.find((i) => i.id === 'plazo')
    expect(plazo.nivel).toBe('naranja')
  })

  it('obra finalizada al 100% real', () => {
    const r = indicadoresObra({
      ...base,
      partidas: [{ presupuesto: 1000, ejecutada: 100, planificada: 100 }],
    })
    expect(r.avanceReal).toBe(1)
  })
})
