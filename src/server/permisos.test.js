import { describe, it, expect, beforeEach } from 'vitest'
import { seed } from './seed.js'
import * as srv from './endpoints.js'

let db
beforeEach(() => {
  db = seed()
})

const OBRA = 'obra-ccm'

describe('login', () => {
  it('acepta credenciales de demo', () => {
    const { usuario } = srv.login(db, 'ccarrasco', 'demo1234')
    expect(usuario.rolGlobal).toBe('admin')
    expect(usuario.rolPrincipal).toBe('admin')
  })
  it('el rol principal refleja la membresía', () => {
    expect(srv.login(db, 'maestro1', 'demo1234').usuario.rolPrincipal).toBe('trabajador')
    expect(srv.login(db, 'mmansilla', 'demo1234').usuario.rolPrincipal).toBe('supervisor')
    expect(srv.login(db, 'finanzas', 'demo1234').usuario.rolPrincipal).toBe('finanzas')
  })
  it('rechaza contraseña incorrecta', () => {
    expect(() => srv.login(db, 'ccarrasco', 'mala')).toThrowError(
      expect.objectContaining({ status: 401 }),
    )
  })
})

describe('protección de datos sensibles (lado servidor)', () => {
  it('trabajador NO recibe presupuesto en partidas', () => {
    const detalle = srv.obtenerObra(db, 'u-maestro1', OBRA)
    for (const p of detalle.partidas) {
      expect(p).not.toHaveProperty('presupuesto')
      expect(p).not.toHaveProperty('precioUnitarioCLP')
    }
    expect(detalle).not.toHaveProperty('presupuestoTotal')
    expect(detalle).not.toHaveProperty('gastoReal')
    expect(detalle.veCostos).toBe(false)
  })

  it('trabajador recibe el indicador de costo marcado como oculto', () => {
    const detalle = srv.obtenerObra(db, 'u-maestro1', OBRA)
    const costo = detalle.indicadores.find((i) => i.id === 'costo')
    expect(costo.oculto).toBe(true)
  })

  it('supervisor SÍ ve presupuesto y gastos', () => {
    const detalle = srv.obtenerObra(db, 'u-mauricio', OBRA)
    expect(detalle.presupuestoTotal).toBeCloseTo(1554035664, 0)
    expect(detalle.gastoReal).toBeGreaterThan(0)
    expect(detalle.partidas[0].presupuesto).toBe(655646557)
  })

  it('finanzas ve costos y sueldos', () => {
    const detalle = srv.obtenerObra(db, 'u-finanzas', OBRA)
    expect(detalle.veCostos).toBe(true)
    const rrhh = srv.obtenerRRHH(db, 'u-finanzas', OBRA)
    expect(rrhh.puedeVerSueldos).toBe(true)
    expect(rrhh.dotacion[0].imponible).toBe(1500000)
  })

  it('rrhh ve sueldos pero no costos de obra', () => {
    const rrhh = srv.obtenerRRHH(db, 'u-rrhh', OBRA)
    expect(rrhh.puedeVerSueldos).toBe(true)
    expect(srv.puedeVerCostos(db, 'u-rrhh', OBRA)).toBe(false)
    expect(() => srv.obtenerPresupuesto(db, 'u-rrhh', OBRA)).toThrowError(
      expect.objectContaining({ status: 403 }),
    )
  })

  it('trabajador no accede a RRHH, APU, presupuesto, materiales ni finanzas', () => {
    for (const fn of [
      srv.obtenerRRHH,
      srv.obtenerAPU,
      srv.obtenerPresupuesto,
      srv.obtenerMateriales,
      srv.obtenerFinanzas,
    ]) {
      expect(() => fn(db, 'u-maestro1', OBRA)).toThrowError(
        expect.objectContaining({ status: 403 }),
      )
    }
  })

  it('trabajador sí puede revisar el registro de producción', () => {
    const reg = srv.obtenerRegistro(db, 'u-maestro1', OBRA)
    expect(reg.partidas.length).toBe(8)
    expect(reg.dias.length).toBeGreaterThan(0)
  })
})

describe('tablero por rol', () => {
  it('admin ve la obra del contrato', () => {
    const t = srv.obtenerTablero(db, 'u-claudio')
    expect(t).toHaveLength(1)
    expect(t[0].id).toBe(OBRA)
  })
  it('la tarjeta muestra días restantes', () => {
    const t = srv.obtenerTablero(db, 'u-mauricio')
    expect(t[0].diasRestantes).toBeGreaterThan(0)
    expect(t[0].plazoConsumido).toBeGreaterThan(0)
  })
  it('ninguna tarjeta expone montos', () => {
    for (const o of srv.obtenerTablero(db, 'u-claudio')) {
      expect(o).not.toHaveProperty('presupuestoTotal')
      expect(o).not.toHaveProperty('gastoReal')
    }
  })
})

describe('reportes', () => {
  const datos = {
    clientId: 'cli-test-1',
    obraId: OBRA,
    fecha: '2026-10-07',
    observaciones: 'prueba',
    lineas: [{ partidaId: `${OBRA}-p2`, cantidad: 10 }],
    fotos: [],
  }

  it('solo el personal de terreno puede reportar', () => {
    for (const uid of ['u-mauricio', 'u-rrhh', 'u-finanzas', 'u-claudio', 'u-jeannette']) {
      expect(() =>
        srv.crearReporte(db, uid, { ...datos, clientId: `cli-${uid}` }),
      ).toThrowError(expect.objectContaining({ status: 403 }))
    }
  })

  it('crea reporte y el avance se refleja', () => {
    const antes = srv.obtenerObra(db, 'u-mauricio', OBRA)
    srv.crearReporte(db, 'u-albanil', datos)
    const despues = srv.obtenerObra(db, 'u-mauricio', OBRA)
    const antes_p2 = antes.partidas.find((p) => p.id === `${OBRA}-p2`)
    const despues_p2 = despues.partidas.find((p) => p.id === `${OBRA}-p2`)
    expect(despues_p2.ejecutada).toBe(antes_p2.ejecutada + 10)
  })

  it('reenvío con mismo clientId NO duplica', () => {
    srv.crearReporte(db, 'u-albanil', datos)
    const { duplicado } = srv.crearReporte(db, 'u-albanil', datos)
    expect(duplicado).toBe(true)
    const lineas = db.lineasReporte.filter((l) => l.partidaId === `${OBRA}-p2`)
    const ejecutada = lineas.reduce((s, l) => s + l.cantidad, 0)
    expect(ejecutada).toBe(1610) // 1600 seed + 10, no 1620
  })

  it('rechaza partida que no existe en la obra', () => {
    expect(() =>
      srv.crearReporte(db, 'u-albanil', {
        ...datos,
        clientId: 'cli-x',
        lineas: [{ partidaId: 'otra-p1', cantidad: 5 }],
      }),
    ).toThrowError(expect.objectContaining({ status: 400 }))
  })

  it('reporte sin líneas debe ser "Sin faena"', () => {
    expect(() =>
      srv.crearReporte(db, 'u-albanil', { ...datos, clientId: 'cli-y', lineas: [] }),
    ).toThrowError(expect.objectContaining({ status: 400 }))
  })
})

describe('curva S', () => {
  it('devuelve puntos semanales programado y real', () => {
    const { puntos } = srv.obtenerCurvaS(db, 'u-mauricio', OBRA)
    expect(puntos.length).toBeGreaterThan(15)
    expect(puntos[0].programado).toBeGreaterThan(0)
    expect(puntos[0].real).not.toBeNull()
    // Las semanas futuras aún no tienen dato real.
    expect(puntos[puntos.length - 1].real).toBeNull()
  })

  it('el programado sigue el plan diario de la obra', () => {
    // Con el plan del seed, a hoy la cubierta E1 debiera estar ~69% programada.
    const { puntos } = srv.obtenerCurvaS(db, 'u-mauricio', OBRA)
    const ultimo = [...puntos].reverse().find((p) => p.real != null)
    expect(ultimo.programado).toBeGreaterThan(0.2)
    expect(ultimo.programado).toBeLessThan(0.6)
  })
})

describe('planificación diaria (calendario)', () => {
  const FECHA = '2026-10-15'

  it('supervisor puede guardar el plan de un día y queda en auditoría', () => {
    const r = srv.guardarPlanificacionDia(db, 'u-mauricio', OBRA, {
      fecha: FECHA,
      cantidades: [{ partidaId: `${OBRA}-p1`, cantidad: 250 }],
    })
    expect(r.ok).toBe(true)
    const entrada = db.planDias.find((d) => d.fecha === FECHA && d.partidaId === `${OBRA}-p1`)
    expect(entrada.cantidad).toBe(250)
    const aud = db.auditoria.find((a) => a.descripcion.includes(`Plan del día ${FECHA}`))
    expect(aud.usuarioId).toBe('u-mauricio')
  })

  it('trabajador, rrhh y finanzas NO pueden planificar', () => {
    for (const uid of ['u-maestro1', 'u-rrhh', 'u-finanzas']) {
      expect(() =>
        srv.guardarPlanificacionDia(db, uid, OBRA, {
          fecha: FECHA,
          cantidades: [{ partidaId: `${OBRA}-p1`, cantidad: 100 }],
        }),
      ).toThrowError(expect.objectContaining({ status: 403 }))
    }
  })

  it('admin (gerencia) sí puede planificar', () => {
    expect(() =>
      srv.guardarPlanificacionDia(db, 'u-claudio', OBRA, {
        fecha: FECHA,
        cantidades: [{ partidaId: `${OBRA}-p2`, cantidad: 100 }],
      }),
    ).not.toThrow()
  })

  it('cantidad 0 elimina el plan de esa partida en el día', () => {
    srv.guardarPlanificacionDia(db, 'u-mauricio', OBRA, {
      fecha: FECHA,
      cantidades: [{ partidaId: `${OBRA}-p3`, cantidad: 50 }],
    })
    srv.guardarPlanificacionDia(db, 'u-mauricio', OBRA, {
      fecha: FECHA,
      cantidades: [{ partidaId: `${OBRA}-p3`, cantidad: 0 }],
    })
    expect(
      db.planDias.some((d) => d.fecha === FECHA && d.partidaId === `${OBRA}-p3`),
    ).toBe(false)
  })

  it('rechaza partidas de otra obra y fechas inválidas', () => {
    expect(() =>
      srv.guardarPlanificacionDia(db, 'u-mauricio', OBRA, {
        fecha: FECHA,
        cantidades: [{ partidaId: 'otra-p1', cantidad: 5 }],
      }),
    ).toThrowError(expect.objectContaining({ status: 400 }))
    expect(() =>
      srv.guardarPlanificacionDia(db, 'u-mauricio', OBRA, {
        fecha: 'no-es-fecha',
        cantidades: [{ partidaId: `${OBRA}-p1`, cantidad: 5 }],
      }),
    ).toThrowError(expect.objectContaining({ status: 400 }))
  })

  it('sin plan diario el programado vuelve a la curva S', () => {
    db.planDias = []
    expect(srv.programadoPorPlan(db, db.obras[0], '2026-10-01')).toBeNull()
  })
})

describe('registro de producción', () => {
  it('devuelve planificada por partida y el avance total de la obra', () => {
    const reg = srv.obtenerRegistro(db, 'u-mauricio', OBRA)
    expect(reg.partidas[0].planificada).toBe(16549)
    expect(reg.avanceGlobal).toBeGreaterThan(0)
    expect(reg.avanceGlobal).toBeLessThan(1)
    expect(reg.avanceProgramado).toBeGreaterThan(0)
  })
})

describe('crear obra', () => {
  it('supervisor puede crear obra con partidas y subpartidas', () => {
    const { obra } = srv.crearObra(db, 'u-mauricio', {
      nombre: 'Obra nueva',
      ubicacion: 'Santiago',
      fechaInicio: '2026-10-07',
      plazoDias: 60,
      partidas: [
        {
          item: '1.1',
          nombre: 'Cubierta norte',
          etapa: 'Etapa 1',
          unidad: 'm²',
          planificada: 100,
          presupuesto: 5000000,
          subpartidas: [
            { codigo: 'X-1', concepto: 'Primer', unidad: 'L', rendimiento: 0.5, precioUnitario: 8000 },
          ],
        },
      ],
      estado: 'activa',
    })
    expect(obra.estado).toBe('activa')
    const auditoria = db.auditoria.find((a) => a.obraId === obra.id)
    expect(auditoria.descripcion).toContain('línea base protegida')
    const p = db.partidas.find((x) => x.obraId === obra.id)
    expect(p.item).toBe('1.1')
    expect(p.etapa).toBe('Etapa 1')
    expect(p.subpartidas[0].costoCLP).toBe(4000)
  })

  it('calcula el presupuesto desde P.Unit CLP en el servidor', () => {
    const { obra } = srv.crearObra(db, 'u-mauricio', {
      nombre: 'Obra con precios',
      fechaInicio: '2026-10-07',
      plazoDias: 30,
      ggPct: 0.325,
      utilPct: 0.15,
      partidas: [
        { nombre: 'Cubierta', unidad: 'M2', planificada: 1000, precioUnitarioCLP: 26860, precioUnitarioUF: 0.68 },
      ],
    })
    const p = db.partidas.find((x) => x.obraId === obra.id)
    // 1000 × 26.860 × 1,475 = 39.618.500
    expect(p.presupuesto).toBe(39618500)
    expect(p.precioUnitarioCLP).toBe(26860)
  })

  it('trabajador NO puede crear obras', () => {
    expect(() =>
      srv.crearObra(db, 'u-maestro1', {
        nombre: 'X',
        fechaInicio: '2026-10-07',
        plazoDias: 10,
        partidas: [{ nombre: 'P', planificada: 1 }],
      }),
    ).toThrowError(expect.objectContaining({ status: 403 }))
  })
})

describe('edición de obra en marcha', () => {
  it('supervisor edita datos generales y queda en auditoría', () => {
    srv.actualizarObra(db, 'u-mauricio', OBRA, { ubicacion: 'San Joaquín, RM', plazoDias: 150 })
    const obra = db.obras.find((o) => o.id === OBRA)
    expect(obra.ubicacion).toBe('San Joaquín, RM')
    expect(obra.plazoDias).toBe(150)
    expect(db.auditoria.at(-1).descripcion).toContain('Obra actualizada')
  })

  it('trabajador, rrhh y finanzas NO pueden editar la obra', () => {
    for (const uid of ['u-maestro1', 'u-rrhh', 'u-finanzas']) {
      expect(() => srv.actualizarObra(db, uid, OBRA, { nombre: 'Hackeo' })).toThrowError(
        expect.objectContaining({ status: 403 }),
      )
    }
  })

  it('guardarPartida recalcula el presupuesto con GG+utilidad', () => {
    const p = db.partidas.find((x) => x.id === `${OBRA}-p1`)
    srv.guardarPartida(db, 'u-mauricio', OBRA, {
      id: p.id,
      item: p.item,
      nombre: p.nombre,
      unidad: p.unidad,
      planificada: 20000,
      precioUnitarioCLP: 26860,
    })
    // 20.000 × 26.860 × 1,475 = 792.370.000
    expect(db.partidas.find((x) => x.id === p.id).presupuesto).toBe(792370000)
    expect(db.auditoria.at(-1).descripcion).toContain('actualizada')
  })

  it('guardarPartida crea partida nueva', () => {
    const r = srv.guardarPartida(db, 'u-claudio', OBRA, {
      item: '5.1',
      nombre: 'Partida nueva',
      unidad: 'gl',
      planificada: 1,
      precioUnitarioCLP: 1000000,
    })
    expect(db.partidas.find((x) => x.id === r.id).nombre).toBe('Partida nueva')
  })

  it('no se puede eliminar una partida con avance registrado', () => {
    expect(() => srv.eliminarPartida(db, 'u-claudio', OBRA, `${OBRA}-p1`)).toThrowError(
      expect.objectContaining({ status: 400 }),
    )
  })

  it('guardarMaterial marca excedente y faltante recalculados', () => {
    const m = db.materiales[0]
    srv.guardarMaterial(db, 'u-mauricio', OBRA, {
      id: m.id,
      codigo: m.codigo,
      descripcion: m.descripcion,
      unidad: m.unidad,
      requerida: 100,
      comprada: 120,
      pUnitNeto: m.pUnitNeto,
    })
    const res = srv.obtenerMateriales(db, 'u-mauricio', OBRA)
    const act = res.materiales.find((x) => x.id === m.id)
    expect(act.excedente).toBe(20)
    expect(act.faltante).toBe(0)
  })

  it('agregarGasto: finanzas registra, trabajador no', () => {
    srv.agregarGasto(db, 'u-finanzas', OBRA, {
      categoria: 'Caja Chica Lorenzo / Operaciones',
      detalle: 'Caja chica semana 8',
      monto: 150000,
      fecha: '2026-10-10',
    })
    const fin = srv.obtenerFinanzas(db, 'u-finanzas', OBRA)
    const cat = fin.ggCategorias.find((c) => c.categoria === 'Caja Chica Lorenzo / Operaciones')
    // 1.501.000 techo - (382.487 + 150.000) ejecutado
    expect(cat.ejecutado).toBe(532487)
    expect(cat.remanente).toBe(1501000 - 532487)
    expect(() =>
      srv.agregarGasto(db, 'u-maestro1', OBRA, { categoria: 'X', monto: 100 }),
    ).toThrowError(expect.objectContaining({ status: 403 }))
  })

  it('guardarTechoGG ajusta el techo y guardarDotacion recalcula costos', () => {
    const cat = db.ggCategorias[0]
    srv.guardarTechoGG(db, 'u-claudio', OBRA, { id: cat.id, categoria: cat.categoria, techoCLP: 6000000 })
    expect(db.ggCategorias[0].techoCLP).toBe(6000000)

    const d = db.dotacion[2]
    srv.guardarDotacion(db, 'u-rrhh', OBRA, {
      id: d.id, nombre: d.nombre, cargo: d.cargo, sueldoBase: 900000, tratos: 100000,
    })
    const act = db.dotacion[2]
    expect(act.imponible).toBe(1000000)
    expect(act.costoMensual).toBe(1300000)
    // Finanzas NO edita dotación.
    expect(() =>
      srv.guardarDotacion(db, 'u-finanzas', OBRA, { id: d.id, nombre: 'X' }),
    ).toThrowError(expect.objectContaining({ status: 403 }))
  })

  it('remanente de GG aparece en la respuesta de finanzas', () => {
    const fin = srv.obtenerFinanzas(db, 'u-claudio', OBRA)
    expect(fin.remanenteGG).toBe(fin.techoGG - fin.ejecutadoGG)
    expect(fin.ggCategorias[0]).toHaveProperty('remanente')
    expect(fin.puedeEditar).toBe(true)
    // Finanzas puede registrar gastos pero no editar techos.
    const finFin = srv.obtenerFinanzas(db, 'u-finanzas', OBRA)
    expect(finFin.puedeRegistrarGasto).toBe(true)
    expect(finFin.puedeEditar).toBe(false)
  })
})
