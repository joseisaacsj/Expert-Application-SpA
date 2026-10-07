import { describe, it, expect, beforeEach } from 'vitest'
import { seed } from './seed.js'
import * as srv from './endpoints.js'

let db
beforeEach(() => {
  db = seed()
})

describe('login', () => {
  it('acepta credenciales de demo', () => {
    const { usuario } = srv.login(db, 'admin', 'demo1234')
    expect(usuario.rolGlobal).toBe('admin')
  })
  it('rechaza contraseña incorrecta', () => {
    expect(() => srv.login(db, 'admin', 'mala')).toThrowError(
      expect.objectContaining({ status: 401 }),
    )
  })
})

describe('protección de datos sensibles (lado servidor)', () => {
  it('trabajador NO recibe presupuesto en partidas', () => {
    const detalle = srv.obtenerObra(db, 'u-trab', 'obra-lampa')
    for (const p of detalle.partidas) {
      expect(p).not.toHaveProperty('presupuesto')
    }
    expect(detalle).not.toHaveProperty('presupuestoTotal')
    expect(detalle).not.toHaveProperty('gastoReal')
  })

  it('trabajador recibe el indicador de costo marcado como oculto', () => {
    const detalle = srv.obtenerObra(db, 'u-trab', 'obra-lampa')
    const costo = detalle.indicadores.find((i) => i.id === 'costo')
    expect(costo.oculto).toBe(true)
  })

  it('supervisor SÍ ve presupuesto y gastos', () => {
    const detalle = srv.obtenerObra(db, 'u-sup', 'obra-lampa')
    expect(detalle.presupuestoTotal).toBe(100000000)
    expect(detalle.gastoReal).toBe(47000000)
    expect(detalle.partidas[0].presupuesto).toBe(8000000)
  })

  it('jefe de cuadrilla NO ve costos', () => {
    const detalle = srv.obtenerObra(db, 'u-jefe', 'obra-lampa')
    expect(detalle).not.toHaveProperty('gastoReal')
    expect(detalle.partidas[0]).not.toHaveProperty('presupuesto')
  })

  it('rrhh NO ve sueldos sin permiso explícito', () => {
    const rrhh = srv.obtenerRRHH(db, 'u-rrhh', 'obra-lampa')
    for (const d of rrhh.dotacion) {
      expect(d).not.toHaveProperty('sueldo')
    }
    expect(rrhh.puedeVerSueldos).toBe(false)
  })

  it('rrhh CON permiso ver_sueldos sí los recibe', () => {
    const m = db.membresias.find((x) => x.usuarioId === 'u-rrhh' && x.obraId === 'obra-lampa')
    m.permisos.push('ver_sueldos')
    const rrhh = srv.obtenerRRHH(db, 'u-rrhh', 'obra-lampa')
    expect(rrhh.dotacion[0].sueldo).toBe(1450000)
  })

  it('usuario sin membresía no puede entrar a la obra', () => {
    expect(() => srv.obtenerObra(db, 'u-trab', 'obra-maipu')).toThrowError(
      expect.objectContaining({ status: 403 }),
    )
  })

  it('trabajador no accede a la vista RRHH', () => {
    expect(() => srv.obtenerRRHH(db, 'u-trab', 'obra-lampa')).toThrowError(
      expect.objectContaining({ status: 403 }),
    )
  })
})

describe('tablero por rol', () => {
  it('admin ve las 4 obras', () => {
    expect(srv.obtenerTablero(db, 'u-admin')).toHaveLength(4)
  })
  it('trabajador solo ve su obra', () => {
    const t = srv.obtenerTablero(db, 'u-trab')
    expect(t).toHaveLength(1)
    expect(t[0].id).toBe('obra-lampa')
  })
  it('ninguna tarjeta expone montos', () => {
    for (const o of srv.obtenerTablero(db, 'u-admin')) {
      expect(o).not.toHaveProperty('presupuestoTotal')
      expect(o).not.toHaveProperty('gastoReal')
    }
  })
})

describe('reportes', () => {
  const datos = {
    clientId: 'cli-test-1',
    obraId: 'obra-lampa',
    fecha: '2026-10-07',
    observaciones: 'prueba',
    lineas: [{ partidaId: 'obra-lampa-p2', cantidad: 10 }],
    fotos: [],
  }

  it('crea reporte y el avance se refleja', () => {
    const antes = srv.obtenerObra(db, 'u-sup', 'obra-lampa')
    srv.crearReporte(db, 'u-jefe', datos)
    const despues = srv.obtenerObra(db, 'u-sup', 'obra-lampa')
    const antes_p2 = antes.partidas.find((p) => p.id === 'obra-lampa-p2')
    const despues_p2 = despues.partidas.find((p) => p.id === 'obra-lampa-p2')
    expect(despues_p2.ejecutada).toBe(antes_p2.ejecutada + 10)
  })

  it('reenvío con mismo clientId NO duplica', () => {
    srv.crearReporte(db, 'u-jefe', datos)
    const { duplicado } = srv.crearReporte(db, 'u-jefe', datos)
    expect(duplicado).toBe(true)
    const lineas = db.lineasReporte.filter((l) => l.partidaId === 'obra-lampa-p2')
    const ejecutada = lineas.reduce((s, l) => s + l.cantidad, 0)
    expect(ejecutada).toBe(610) // 600 seed + 10, no 620
  })

  it('rechaza partida de otra obra', () => {
    expect(() =>
      srv.crearReporte(db, 'u-jefe', {
        ...datos,
        clientId: 'cli-x',
        lineas: [{ partidaId: 'obra-maipu-p1', cantidad: 5 }],
      }),
    ).toThrowError(expect.objectContaining({ status: 400 }))
  })

  it('reporte sin líneas debe ser "Sin faena"', () => {
    expect(() =>
      srv.crearReporte(db, 'u-jefe', { ...datos, clientId: 'cli-y', lineas: [] }),
    ).toThrowError(expect.objectContaining({ status: 400 }))
  })
})

describe('crear obra', () => {
  it('supervisor puede crear obra con partidas nuevas', () => {
    const { obra } = srv.crearObra(db, 'u-sup', {
      nombre: 'Obra nueva',
      ubicacion: 'Santiago',
      fechaInicio: '2026-10-07',
      plazoDias: 60,
      partidas: [{ nombre: 'Excavación', unidad: 'm³', planificada: 100, presupuesto: 5000000 }],
      estado: 'activa',
    })
    expect(obra.estado).toBe('activa')
    const auditoria = db.auditoria.find((a) => a.obraId === obra.id)
    expect(auditoria.descripcion).toContain('línea base protegida')
  })

  it('trabajador NO puede crear obras', () => {
    expect(() =>
      srv.crearObra(db, 'u-trab', {
        nombre: 'X',
        fechaInicio: '2026-10-07',
        plazoDias: 10,
        partidas: [{ nombre: 'P', planificada: 1 }],
      }),
    ).toThrowError(expect.objectContaining({ status: 403 }))
  })
})
