import {
  indicadoresObra,
  avancePartida,
  totalNetoPartida,
  estrategiaCurvaS,
} from '../lib/calculos.js'
import { hashSimulado } from './seed.js'
import { fechaISO } from '../lib/format.js'

// Capa "servidor" simulada. Cuando exista el backend PHP, cada función
// de aquí se traduce a un endpoint, y las reglas de permiso viven allí.
// La interfaz NUNCA recibe datos que el rol no puede ver.

export class ApiError extends Error {
  constructor(status, mensaje) {
    super(mensaje)
    this.status = status
  }
}

// ---------- helpers de permisos ----------

function usuario(db, usuarioId) {
  const u = db.usuarios.find((x) => x.id === usuarioId)
  if (!u) throw new ApiError(401, 'Sesión no válida')
  return u
}

function membresia(db, usuarioId, obraId) {
  return db.membresias.find((m) => m.usuarioId === usuarioId && m.obraId === obraId) || null
}

// Rol efectivo en la obra: admin tiene rol admin en todas.
function rolEnObra(db, usuarioId, obraId) {
  const u = usuario(db, usuarioId)
  if (u.rolGlobal === 'admin') return 'admin'
  return membresia(db, usuarioId, obraId)?.rol ?? null
}

export function puedeVerCostos(db, usuarioId, obraId) {
  const rol = rolEnObra(db, usuarioId, obraId)
  return rol === 'admin' || rol === 'supervisor' || rol === 'finanzas'
}

export function puedeVerSueldos(db, usuarioId, obraId) {
  const rol = rolEnObra(db, usuarioId, obraId)
  return ['admin', 'supervisor', 'rrhh', 'finanzas'].includes(rol)
}

// Solo los trabajadores reportan avance; el resto supervisa el registro.
export function puedeReportar(db, usuarioId, obraId) {
  return rolEnObra(db, usuarioId, obraId) === 'trabajador'
}

// La planificación diaria la define el supervisor de la obra o administración.
export function puedePlanificar(db, usuarioId, obraId) {
  const rol = rolEnObra(db, usuarioId, obraId)
  return rol === 'admin' || rol === 'supervisor'
}

// Solo administración (gerente general y administradora) emite reportes formales.
export function puedeExportar(db, usuarioId) {
  return usuario(db, usuarioId).rolGlobal === 'admin'
}

function exigirMiembro(db, usuarioId, obraId) {
  const rol = rolEnObra(db, usuarioId, obraId)
  if (!rol) throw new ApiError(403, 'No tienes acceso a esta obra')
  return rol
}

// Editar datos de la obra (datos, presupuesto, materiales, GG): supervisor
// de la obra o administración. Finanzas solo registra gastos (regla aparte).
function exigirEditor(db, usuarioId, obraId) {
  const rol = exigirMiembro(db, usuarioId, obraId)
  if (rol !== 'admin' && rol !== 'supervisor') {
    throw new ApiError(403, 'Solo el supervisor o administración puede editar la obra')
  }
  return rol
}

function auditar(db, obraId, usuarioId, descripcion) {
  db.auditoria.push({
    id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    obraId,
    usuarioId,
    fecha: fechaISO(),
    descripcion,
  })
}

// ---------- helpers de datos ----------

function ejecutadaDe(db, partidaId) {
  return db.lineasReporte
    .filter((l) => l.partidaId === partidaId)
    .reduce((s, l) => s + l.cantidad, 0)
}

function partidasConAvance(db, obraId) {
  return db.partidas
    .filter((p) => p.obraId === obraId)
    .sort((a, b) => a.orden - b.orden)
    .map((p) => {
      const ejecutada = ejecutadaDe(db, p.id)
      return { ...p, ejecutada, avance: avancePartida(ejecutada, p.planificada) }
    })
}

function statsHoy(db, obraId, hoy) {
  const deHoy = db.reportes.filter((r) => r.obraId === obraId && r.fecha === hoy)
  return {
    reportaronHoy: new Set(deHoy.map((r) => r.usuarioId)).size,
    huboSinFaenaHoy: deHoy.some((r) => r.sinFaena),
  }
}

// Avance programado según el plan diario por partida (cantidad planificada
// por fecha). Las partidas sin plan aportan su fracción por curva S.
// Devuelve null si no hay planificación cargada — se usa la curva S general.
export function programadoPorPlan(db, obra, hasta) {
  const planDias = (db.planDias || []).filter((d) => d.obraId === obra.id && d.fecha <= hasta)
  const partidas = db.partidas.filter((p) => p.obraId === obra.id)
  const total = partidas.reduce((s, p) => s + (p.presupuesto || 0), 0)
  if (total <= 0 || !planDias.length) return null
  const planPorPartida = new Map()
  for (const d of planDias) {
    planPorPartida.set(d.partidaId, (planPorPartida.get(d.partidaId) || 0) + d.cantidad)
  }
  const curva = estrategiaCurvaS(obra, hasta)
  let ganado = 0
  for (const p of partidas) {
    const frac = planPorPartida.has(p.id)
      ? avancePartida(planPorPartida.get(p.id), p.planificada)
      : curva
    ganado += (p.presupuesto || 0) * frac
  }
  return ganado / total
}

function indicadoresDe(db, obra, hoy = fechaISO()) {
  const partidas = partidasConAvance(db, obra.id)
  const gastoReal = db.gastos
    .filter((g) => g.obraId === obra.id)
    .reduce((s, g) => s + g.monto, 0)
  const { reportaronHoy, huboSinFaenaHoy } = statsHoy(db, obra.id, hoy)
  // La documentación diaria se mide sobre las cuentas de terreno (trabajadores),
  // no sobre toda la nómina (supervisor y prevencionista no reportan avance).
  const dotacionReportes = db.membresias.filter(
    (m) => m.obraId === obra.id && m.rol === 'trabajador',
  ).length
  const estrategia = (o, hasta) => programadoPorPlan(db, o, hasta) ?? estrategiaCurvaS(o, hasta)
  return indicadoresObra({
    obra: { ...obra, dotacionActiva: dotacionReportes },
    partidas,
    gastoReal,
    materialesPct: obra.materialesPct ?? 0,
    reportaronHoy,
    huboSinFaenaHoy,
    hoy,
    estrategia,
  })
}

function alertasDe(db, obra, ind) {
  const alertas = ind.indicadores
    .filter((i) => i.nivel !== 'verde')
    .map((i) => ({ nivel: i.nivel, texto: `${i.nombre}: ${i.detalle}` }))
  // Partidas que van más de 15 pts bajo el avance programado.
  for (const p of partidasConAvance(db, obra.id)) {
    if (p.avance < ind.avanceProgramado - 0.15) {
      alertas.push({
        nivel: 'amarillo',
        texto: `${p.nombre}: ${Math.round(p.avance * 100)}% ejecutado, esperado cerca de ${Math.round(ind.avanceProgramado * 100)}%.`,
      })
    }
  }
  return alertas
}

function obraPublica(obra) {
  const {
    id, nombre, contrato, mandante, contratista, rutContratista, ubicacion,
    alcance, estado, fechaInicio, fechaTermino, plazoDias,
    ggPct, utilPct, valorUF,
  } = obra
  return {
    id, nombre, contrato, mandante, contratista, rutContratista, ubicacion,
    alcance, estado, fechaInicio, fechaTermino, plazoDias,
    ggPct, utilPct, valorUF,
  }
}

// ---------- endpoints ----------

export function login(db, usuarioNombre, password) {
  const u = db.usuarios.find((x) => x.usuario === usuarioNombre.toLowerCase().trim())
  if (!u || u.passwordHash !== hashSimulado(password)) {
    throw new ApiError(401, 'Usuario o contraseña incorrectos')
  }
  // Rol principal para la interfaz (nav): admin o el rol de su primera membresía.
  const rolPrincipal =
    u.rolGlobal === 'admin' ? 'admin' : (db.membresias.find((m) => m.usuarioId === u.id)?.rol ?? 'usuario')
  return {
    usuario: { id: u.id, usuario: u.usuario, nombre: u.nombre, cargo: u.cargo, rolGlobal: u.rolGlobal, rolPrincipal },
    token: `demo-token-${u.id}`,
  }
}

// Tablero: obras visibles con su semáforo. Sin montos sensibles en tarjetas.
export function obtenerTablero(db, usuarioId) {
  usuario(db, usuarioId)
  const u = db.usuarios.find((x) => x.id === usuarioId)
  const esAdmin = u.rolGlobal === 'admin'
  const obras = db.obras.filter((o) => esAdmin || membresia(db, usuarioId, o.id))
  const hoy = fechaISO()
  return obras.map((o) => {
    const ind = indicadoresDe(db, o, hoy)
    return {
      ...obraPublica(o),
      rol: rolEnObra(db, usuarioId, o.id),
      estado_general: ind.estado,
      causa: ind.causa,
      avanceReal: ind.avanceReal,
      avanceProgramado: ind.avanceProgramado,
      plazoConsumido: ind.plazoConsumido,
      diasRestantes: ind.diasRestantes,
    }
  })
}

// Detalle de obra. Presupuesto, gastos y CPI solo para roles con permiso.
export function obtenerObra(db, usuarioId, obraId) {
  const rol = exigirMiembro(db, usuarioId, obraId)
  const obra = db.obras.find((o) => o.id === obraId)
  if (!obra) throw new ApiError(404, 'Obra no encontrada')

  const ind = indicadoresDe(db, obra)
  const veCostos = puedeVerCostos(db, usuarioId, obraId)

  const partidas = partidasConAvance(db, obraId).map((p) => {
    const base = {
      id: p.id,
      item: p.item,
      nombre: p.nombre,
      etapa: p.etapa,
      unidad: p.unidad,
      planificada: p.planificada,
      ejecutada: p.ejecutada,
      avance: p.avance,
      orden: p.orden,
    }
    return veCostos
      ? { ...base, presupuesto: p.presupuesto, precioUnitarioCLP: p.precioUnitarioCLP, precioUnitarioUF: p.precioUnitarioUF }
      : base
  })

  // El indicador de costo revela desempeño financiero: se omite si no hay permiso.
  const indicadores = ind.indicadores.map((i) =>
    i.id === 'costo' && !veCostos ? { ...i, oculto: true, valorTexto: 'Restringido' } : i,
  )

  const detalle = {
    ...obraPublica(obra),
    rol,
    materialesPct: obra.materialesPct,
    umbrales: obra.umbrales,
    estadoGeneral: ind.estado,
    causa: ind.causa,
    avanceReal: ind.avanceReal,
    avanceProgramado: ind.avanceProgramado,
    plazoConsumido: ind.plazoConsumido,
    diasRestantes: ind.diasRestantes,
    indicadores,
    alertas: alertasDe(db, obra, ind),
    partidas,
    auditoria: db.auditoria.filter((a) => a.obraId === obraId),
    // ¿Esta persona ya envió su reporte hoy? Alimenta el banner del reporte.
    miReporteHoy: db.reportes.some(
      (r) => r.obraId === obraId && r.usuarioId === usuarioId && r.fecha === fechaISO(),
    ),
    puedeReportar: puedeReportar(db, usuarioId, obraId) && obra.estado === 'activa',
    puedeExportar: puedeExportar(db, usuarioId),
    puedeEditar: ['admin', 'supervisor'].includes(rol),
    veCostos,
  }

  if (veCostos) {
    detalle.presupuestoTotal = ind.presupuestoTotal
    detalle.gastoReal = ind.gastoReal
    detalle.valorGanado = ind.valorGanado
  }
  return detalle
}

// Reporte diario. Idempotente: si el clientId ya existe, devuelve el mismo
// reporte sin duplicar (reenvío seguro tras pérdida de conexión).
export function crearReporte(db, usuarioId, datos) {
  const { clientId, obraId, fecha, observaciones = '', sinFaena = false, lineas = [], fotos = [] } = datos
  if (!puedeReportar(db, usuarioId, obraId)) {
    throw new ApiError(403, 'Solo el personal de terreno puede enviar reportes de avance')
  }
  if (!clientId) throw new ApiError(400, 'Falta clientId (idempotencia)')

  const existente = db.reportes.find((r) => r.clientId === clientId)
  if (existente) return { reporte: existente, duplicado: true }

  const partidasObra = db.partidas.filter((p) => p.obraId === obraId)
  const partidasIds = new Set(partidasObra.map((p) => p.id))
  for (const l of lineas) {
    if (!partidasIds.has(l.partidaId)) throw new ApiError(400, 'Partida no pertenece a la obra')
    if (!(l.cantidad > 0)) throw new ApiError(400, 'Cantidad debe ser mayor a cero')
    // El personal de terreno solo reporta partidas en m² o ml.
    const unidad = (partidasObra.find((p) => p.id === l.partidaId)?.unidad || '').toLowerCase()
    if (!['m²', 'm2', 'ml'].includes(unidad)) {
      throw new ApiError(400, 'Solo se reporta avance en partidas medidas en m² o ml')
    }
  }
  if (!sinFaena && lineas.length === 0) {
    throw new ApiError(400, 'Un reporte debe tener líneas de avance o marcarse "Sin faena"')
  }

  const reporte = {
    id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    clientId,
    obraId,
    usuarioId,
    fecha: fecha || fechaISO(),
    observaciones,
    sinFaena,
    creadoEn: fechaISO(),
    estado: 'enviado',
  }
  db.reportes.push(reporte)
  for (const l of lineas) {
    db.lineasReporte.push({ id: `lin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, reporteId: reporte.id, partidaId: l.partidaId, cantidad: l.cantidad })
  }
  for (const f of fotos) {
    db.fotos.push({ id: `fot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, reporteId: reporte.id, nombre: f.nombre, dataUrl: f.dataUrl })
  }
  return { reporte, duplicado: false }
}

// RRHH: nómina y estado de reportes. Sueldos según rol (rrhh, finanzas,
// supervisor y administración sí; trabajadores no entran aquí).
export function obtenerRRHH(db, usuarioId, obraId) {
  const rol = exigirMiembro(db, usuarioId, obraId)
  if (rol === 'trabajador') {
    throw new ApiError(403, 'Sin acceso a la vista de RRHH')
  }
  const hoy = fechaISO()
  const reportesHoy = db.reportes.filter((r) => r.obraId === obraId && r.fecha === hoy)
  const reportaron = new Set(reportesHoy.map((r) => r.usuarioId))
  const veSueldos = puedeVerSueldos(db, usuarioId, obraId)

  const dotacion = db.dotacion
    .filter((d) => d.obraId === obraId)
    .map((d) => {
      const cuenta = d.cuentaId ? reportaron.has(d.cuentaId) : false
      const base = {
        id: d.id,
        rut: d.rut,
        nombre: d.nombre,
        cargo: d.cargo,
        diasTrab: d.diasTrab,
        activo: d.activo,
        reporta: Boolean(d.cuentaId),
        reportoHoy: cuenta,
      }
      return veSueldos
        ? {
            ...base,
            sueldoBase: d.sueldoBase,
            tratos: d.tratos,
            imponible: d.imponible,
            leyesSociales: d.leyesSociales,
            costoMensual: d.costoMensual,
            proyectado145d: d.proyectado145d,
          }
        : base
    })

  return {
    dotacion,
    reportaronHoy: reportaron.size,
    totalReportadores: db.membresias.filter((m) => m.obraId === obraId && m.rol === 'trabajador').length,
    total: dotacion.filter((d) => d.activo).length,
    sinFaenaHoy: reportesHoy.some((r) => r.sinFaena),
    puedeVerSueldos: veSueldos,
    puedeEditar: ['admin', 'supervisor', 'rrhh'].includes(rol),
  }
}

// Registro Diario de Producción: matriz fecha × partida (como la hoja del
// libro). Todos los miembros la revisan; solo trabajadores escriben vía reportes.
export function obtenerRegistro(db, usuarioId, obraId) {
  exigirMiembro(db, usuarioId, obraId)
  const partidas = db.partidas
    .filter((p) => p.obraId === obraId)
    .sort((a, b) => a.orden - b.orden)
    .map((p) => ({
      id: p.id,
      item: p.item,
      nombre: p.nombre,
      unidad: p.unidad,
      planificada: p.planificada,
    }))

  const lineaPorReporte = new Map()
  for (const l of db.lineasReporte) {
    if (!lineaPorReporte.has(l.reporteId)) lineaPorReporte.set(l.reporteId, {})
    lineaPorReporte.get(l.reporteId)[l.partidaId] =
      (lineaPorReporte.get(l.reporteId)[l.partidaId] || 0) + l.cantidad
  }

  const nombreUsuario = (uid) => db.usuarios.find((u) => u.id === uid)?.nombre ?? uid
  const dias = db.reportes
    .filter((r) => r.obraId === obraId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .map((r) => ({
      id: r.id,
      fecha: r.fecha,
      usuario: nombreUsuario(r.usuarioId),
      observaciones: r.observaciones,
      sinFaena: r.sinFaena,
      cantidades: lineaPorReporte.get(r.id) || {},
      fotos: db.fotos.filter((f) => f.reporteId === r.id).length,
    }))

  // Totales de obra para el pie del registro: cuánto se ha ejecutado del total.
  const obra = db.obras.find((o) => o.id === obraId)
  const ind = indicadoresDe(db, obra)
  return {
    partidas,
    dias,
    avanceGlobal: ind.avanceReal,
    avanceProgramado: ind.avanceProgramado,
  }
}

// Planificación diaria en vista calendario: cantidad planificada por fecha
// y partida, más el ejecutado real para comparar día a día.
export function obtenerPlanificacion(db, usuarioId, obraId) {
  exigirMiembro(db, usuarioId, obraId)
  const obra = db.obras.find((o) => o.id === obraId)
  if (!obra) throw new ApiError(404, 'Obra no encontrada')

  // planPorFecha[fecha][partidaId] = cantidad planificada
  const planPorFecha = {}
  for (const d of db.planDias || []) {
    if (d.obraId !== obraId) continue
    ;(planPorFecha[d.fecha] ??= {})[d.partidaId] = d.cantidad
  }
  // ejecPorFecha[fecha][partidaId] = cantidad realmente reportada
  const reportePorId = new Map(db.reportes.map((r) => [r.id, r]))
  const ejecPorFecha = {}
  for (const l of db.lineasReporte) {
    const r = reportePorId.get(l.reporteId)
    if (r?.obraId !== obraId) continue
    ;(ejecPorFecha[r.fecha] ??= {})[l.partidaId] =
      (ejecPorFecha[r.fecha]?.[l.partidaId] || 0) + l.cantidad
  }

  return {
    obraNombre: obra.nombre,
    fechaInicio: obra.fechaInicio,
    fechaTermino: obra.fechaTermino,
    plazoDias: obra.plazoDias,
    puedeEditar: puedePlanificar(db, usuarioId, obraId),
    avanceProgramadoHoy: indicadoresDe(db, obra).avanceProgramado,
    sinFaenaFechas: db.reportes
      .filter((r) => r.obraId === obraId && r.sinFaena)
      .map((r) => r.fecha),
    partidas: partidasConAvance(db, obraId).map((p) => ({
      id: p.id,
      item: p.item,
      nombre: p.nombre,
      etapa: p.etapa,
      unidad: p.unidad,
      planificada: p.planificada,
      avance: p.avance,
    })),
    planPorFecha,
    ejecPorFecha,
  }
}

// Guarda el plan de un día (cantidad por partida). Solo supervisor o
// administración. Cantidad 0 elimina el plan de esa partida ese día.
// Queda en auditoría para que un cambio de plan nunca pase inadvertido.
export function guardarPlanificacionDia(db, usuarioId, obraId, { fecha, cantidades = [] }) {
  if (!puedePlanificar(db, usuarioId, obraId)) {
    throw new ApiError(403, 'Solo el supervisor de obra o administración puede planificar')
  }
  const obra = db.obras.find((o) => o.id === obraId)
  if (!obra) throw new ApiError(404, 'Obra no encontrada')
  if (!fecha || Number.isNaN(Date.parse(fecha))) throw new ApiError(400, 'Fecha inválida')

  db.planDias ??= []
  const partidasIds = new Set(db.partidas.filter((p) => p.obraId === obraId).map((p) => p.id))
  let cambios = 0
  for (const c of cantidades) {
    if (!partidasIds.has(c.partidaId)) throw new ApiError(400, 'Partida no pertenece a la obra')
    const cant = Number(c.cantidad) || 0
    const i = db.planDias.findIndex(
      (d) => d.obraId === obraId && d.fecha === fecha && d.partidaId === c.partidaId,
    )
    if (cant > 0) {
      if (i >= 0) {
        if (db.planDias[i].cantidad !== cant) {
          db.planDias[i].cantidad = cant
          cambios++
        }
      } else {
        db.planDias.push({
          id: `pd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          obraId,
          fecha,
          partidaId: c.partidaId,
          cantidad: cant,
        })
        cambios++
      }
    } else if (i >= 0) {
      db.planDias.splice(i, 1)
      cambios++
    }
  }
  if (cambios > 0) {
    db.auditoria.push({
      id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      obraId,
      usuarioId,
      fecha: fechaISO(),
      descripcion: `Plan del día ${fecha} actualizado (${cambios} cambio(s)).`,
    })
  }
  return { ok: true }
}

// Curva S: avance programado (curva) vs real acumulado por semana.
export function obtenerCurvaS(db, usuarioId, obraId) {
  exigirMiembro(db, usuarioId, obraId)
  const obra = db.obras.find((o) => o.id === obraId)
  if (!obra) throw new ApiError(404, 'Obra no encontrada')

  const partidas = partidasConAvance(db, obraId)
  const presupuestoTotal = partidas.reduce((s, p) => s + (p.presupuesto || 0), 0)

  // Ejecutado acumulado por fecha de reporte.
  const reportePorId = new Map(db.reportes.map((r) => [r.id, r]))
  const ejecutadoPorFecha = new Map()
  for (const l of db.lineasReporte) {
    const rep = reportePorId.get(l.reporteId)
    if (!rep || rep.obraId !== obraId) continue
    const acc = ejecutadoPorFecha.get(rep.fecha) || {}
    acc[l.partidaId] = (acc[l.partidaId] || 0) + l.cantidad
    ejecutadoPorFecha.set(rep.fecha, acc)
  }
  const fechas = [...ejecutadoPorFecha.keys()].sort()

  const ejecutadoHasta = (fechaCorte) => {
    const acum = {}
    for (const f of fechas) {
      if (f > fechaCorte) break
      for (const [pid, cant] of Object.entries(ejecutadoPorFecha.get(f))) {
        acum[pid] = (acum[pid] || 0) + cant
      }
    }
    return acum
  }

  const semanas = Math.ceil(obra.plazoDias / 7)
  const puntos = []
  for (let s = 1; s <= semanas; s++) {
    const dia = new Date(obra.fechaInicio)
    dia.setDate(dia.getDate() + s * 7 - 1)
    const fin = fechaISO(dia)
    const acum = ejecutadoHasta(fin)
    const real =
      presupuestoTotal > 0
        ? partidas.reduce(
            (sum, p) =>
              sum + (p.presupuesto || 0) * Math.min(1, (acum[p.id] || 0) / p.planificada),
            0,
          ) / presupuestoTotal
        : 0
    const x = Math.min(1, (s * 7) / obra.plazoDias)
    puntos.push({
      semana: s,
      fechaFin: fin,
      programado: programadoPorPlan(db, obra, fin) ?? Math.min(1, x * x * (3 - 2 * x)),
      real: fin <= fechaISO() ? real : null,
    })
  }
  return { puntos }
}

// APU: análisis de precios unitarios por partida (dato de costos).
export function obtenerAPU(db, usuarioId, obraId) {
  exigirMiembro(db, usuarioId, obraId)
  if (!puedeVerCostos(db, usuarioId, obraId)) {
    throw new ApiError(403, 'Sin acceso a los precios unitarios')
  }
  const valorUF = db.obras.find((o) => o.id === obraId)?.valorUF || 1
  return {
    valorUF,
    partidas: db.partidas
      .filter((p) => p.obraId === obraId)
      .sort((a, b) => a.orden - b.orden)
      .map((p) => ({
        id: p.id,
        item: p.item,
        nombre: p.nombre,
        etapa: p.etapa,
        unidad: p.unidad,
        targetUF: p.precioUnitarioUF,
        targetCLP: p.precioUnitarioCLP,
        subpartidas: (p.subpartidas || []).map((s) => ({
          ...s,
          costoUF: Math.round((s.costoCLP / valorUF) * 1000) / 1000,
        })),
      })),
  }
}

// Presupuesto: tabla completa estilo contrato (solo con permiso de costos).
export function obtenerPresupuesto(db, usuarioId, obraId) {
  exigirMiembro(db, usuarioId, obraId)
  if (!puedeVerCostos(db, usuarioId, obraId)) {
    throw new ApiError(403, 'Sin acceso al presupuesto')
  }
  const obra = db.obras.find((o) => o.id === obraId)
  const gg = obra?.ggPct ?? 0.325
  const util = obra?.utilPct ?? 0.15
  const partidas = partidasConAvance(db, obraId).map((p) => {
    const totalCLP = p.planificada * (p.precioUnitarioCLP || 0)
    const totalUF = p.planificada * (p.precioUnitarioUF || 0)
    return {
      id: p.id,
      item: p.item,
      nombre: p.nombre,
      etapa: p.etapa,
      unidad: p.unidad,
      cantidad: p.planificada,
      pUnitUF: p.precioUnitarioUF,
      totalUF,
      pUnitCLP: p.precioUnitarioCLP,
      totalCLP,
      ggUF: totalUF * gg,
      utilUF: totalUF * util,
      netoUF: totalUF * (1 + gg + util),
      netoCLP: totalCLP * (1 + gg + util),
      avance: p.avance,
      ejecutada: p.ejecutada,
    }
  })
  const totalNeto = partidas.reduce((s, p) => s + p.netoCLP, 0)
  return {
    ggPct: gg,
    utilPct: util,
    valorUF: obra?.valorUF,
    partidas: partidas.map((p) => ({ ...p, incidencia: totalNeto > 0 ? p.netoCLP / totalNeto : 0 })),
    totalNetoCLP: totalNeto,
    totalNetoUF: partidas.reduce((s, p) => s + p.netoUF, 0),
    puedeEditar: ['admin', 'supervisor'].includes(rolEnObra(db, usuarioId, obraId)),
  }
}

// Materiales: matriz requerido vs comprado (dato de costos).
export function obtenerMateriales(db, usuarioId, obraId) {
  exigirMiembro(db, usuarioId, obraId)
  if (!puedeVerCostos(db, usuarioId, obraId)) {
    throw new ApiError(403, 'Sin acceso a materiales')
  }
  const materiales = db.materiales
    .filter((m) => m.obraId === obraId)
    .map((m) => ({
      ...m,
      faltante: Math.max(0, m.requerida - m.comprada),
      excedente: Math.max(0, m.comprada - m.requerida),
      costoComprado: m.comprada * m.pUnitNeto,
      porComprarCLP: Math.max(0, m.requerida - m.comprada) * m.pUnitNeto,
    }))
  const reqCLP = materiales.reduce((s, m) => s + m.requerida * m.pUnitNeto, 0)
  const compCLP = materiales.reduce((s, m) => s + m.comprada * m.pUnitNeto, 0)
  return {
    materiales,
    totalRequeridoCLP: reqCLP,
    totalCompradoCLP: compCLP,
    porComprarCLP: materiales.reduce((s, m) => s + m.porComprarCLP, 0),
    abastecimiento: reqCLP > 0 ? compCLP / reqCLP : 0,
    puedeEditar: ['admin', 'supervisor'].includes(rolEnObra(db, usuarioId, obraId)),
  }
}

// Finanzas: GG por categoría con consumo, registro de gastos, EEPP y nómina.
// Solo roles con acceso a costos; RRHH revisa su nómina en la vista de RRHH.
export function obtenerFinanzas(db, usuarioId, obraId) {
  exigirMiembro(db, usuarioId, obraId)
  if (!puedeVerCostos(db, usuarioId, obraId)) {
    throw new ApiError(403, 'Sin acceso a finanzas')
  }
  const veSueldos = puedeVerSueldos(db, usuarioId, obraId)
  const gastos = db.gastos.filter((g) => g.obraId === obraId)

  const ggCategorias = db.ggCategorias
    .filter((c) => c.obraId === obraId)
    .map((c) => {
      const ejecutado = gastos
        .filter((g) => g.categoria === c.categoria)
        .reduce((s, g) => s + g.monto, 0)
      // Remanente > 0 = queda disponible (ahorro); < 0 = déficit sobre el techo.
      return { ...c, ejecutado, remanente: c.techoCLP - ejecutado, pct: c.techoCLP > 0 ? ejecutado / c.techoCLP : 0 }
    })

  const rol = rolEnObra(db, usuarioId, obraId)
  return {
    ggCategorias,
    techoGG: ggCategorias.reduce((s, c) => s + c.techoCLP, 0),
    ejecutadoGG: ggCategorias.reduce((s, c) => s + c.ejecutado, 0),
    remanenteGG: ggCategorias.reduce((s, c) => s + c.remanente, 0),
    gastos: [...gastos].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    estadosPago: db.estadosPago.filter((e) => e.obraId === obraId),
    nomina: db.dotacion
      .filter((d) => d.obraId === obraId && d.activo)
      .map((d) =>
        veSueldos
          ? {
              id: d.id,
              nombre: d.nombre,
              cargo: d.cargo,
              imponible: d.imponible,
              costoMensual: d.costoMensual,
              proyectado145d: d.proyectado145d,
            }
          : { id: d.id, nombre: d.nombre, cargo: d.cargo },
      ),
    puedeVerSueldos: veSueldos,
    puedeEditar: ['admin', 'supervisor'].includes(rol),
    puedeRegistrarGasto: ['admin', 'supervisor', 'finanzas'].includes(rol),
  }
}

// Crear obra (asistente). Solo admin o quien tenga rol supervisor en alguna obra.
export function crearObra(db, usuarioId, datos) {
  const u = usuario(db, usuarioId)
  const esSupervisor = db.membresias.some((m) => m.usuarioId === usuarioId && m.rol === 'supervisor')
  if (u.rolGlobal !== 'admin' && !esSupervisor) {
    throw new ApiError(403, 'Solo un supervisor o administrador puede crear obras')
  }

  const {
    nombre, ubicacion, fechaInicio, plazoDias, umbrales,
    partidas = [], estado = 'borrador',
    ggPct = 0.325, utilPct = 0.15, valorUF = null,
    ggCategorias = [],
  } = datos
  if (!nombre?.trim()) throw new ApiError(400, 'La obra necesita un nombre')
  if (!fechaInicio || !(plazoDias > 0)) throw new ApiError(400, 'Fecha de inicio y plazo son obligatorios')

  const obraId = `obra-${Date.now()}`
  const obra = {
    id: obraId,
    nombre: nombre.trim(),
    ubicacion: ubicacion?.trim() || '',
    estado,
    fechaInicio,
    plazoDias,
    materialesPct: 0,
    umbrales: umbrales || null,
    ggPct,
    utilPct,
    valorUF,
    activadaEn: estado === 'activa' ? fechaISO() : null,
    creadaPor: usuarioId,
  }
  db.obras.push(obra)

  partidas.forEach((p, i) => {
    if (!p.nombre?.trim() || !(p.planificada > 0)) {
      throw new ApiError(400, `Partida ${i + 1} inválida`)
    }
    // Si viene precio unitario CLP (o UF convertible con la UF del día), el
    // presupuesto es el Total Neto calculado en el servidor — nunca se
    // confía en el total enviado por el cliente.
    const pUnitCLP =
      Number(p.precioUnitarioCLP) ||
      Math.round((Number(p.precioUnitarioUF) || 0) * (Number(valorUF) || 0))
    const presupuesto = pUnitCLP > 0
      ? Math.round(totalNetoPartida(p.planificada, pUnitCLP, ggPct, utilPct))
      : Number(p.presupuesto) || 0
    db.partidas.push({
      id: `${obraId}-p${i + 1}`,
      obraId,
      item: p.item?.trim() || `${i + 1}`,
      nombre: p.nombre.trim(),
      etapa: p.etapa?.trim() || null,
      unidad: p.unidad || 'un',
      planificada: p.planificada,
      presupuesto,
      precioUnitarioUF: Number(p.precioUnitarioUF) || null,
      precioUnitarioCLP: pUnitCLP || null,
      subpartidas: (p.subpartidas || [])
        .filter((s) => s.concepto?.trim())
        .map((s) => ({
          codigo: s.codigo?.trim() || '',
          concepto: s.concepto.trim(),
          unidad: s.unidad || 'un',
          rendimiento: Number(s.rendimiento) || 0,
          precioUnitario: Number(s.precioUnitario) || 0,
          costoCLP: Math.round((Number(s.rendimiento) || 0) * (Number(s.precioUnitario) || 0)),
        })),
      orden: i + 1,
    })
  })

  // Techos de GG estimados por categoría (alimentan la vista de Finanzas).
  ggCategorias.forEach((c, i) => {
    if (!c.categoria?.trim() || !(c.techoCLP > 0)) return
    db.ggCategorias.push({
      id: `${obraId}-gg-${i + 1}`,
      obraId,
      categoria: c.categoria.trim(),
      techoCLP: Math.round(c.techoCLP),
      techoUF: valorUF ? Math.round((c.techoCLP / valorUF) * 100) / 100 : null,
    })
  })

  // El creador queda como supervisor de su obra.
  db.membresias.push({ id: `m-${Date.now()}`, usuarioId, obraId, rol: 'supervisor', permisos: [] })

  if (estado === 'activa') {
    db.auditoria.push({
      id: `a-${Date.now()}`,
      obraId,
      usuarioId,
      fecha: fechaISO(),
      descripcion: `Obra activada: línea base protegida (${partidas.length} partidas).`,
    })
  }
  return { obra }
}

// Cambios a la línea base de una obra activa: quedan en auditoría.
export function modificarLineaBase(db, usuarioId, obraId, descripcion) {
  const rol = exigirMiembro(db, usuarioId, obraId)
  if (rol !== 'admin' && rol !== 'supervisor') {
    throw new ApiError(403, 'Solo el supervisor puede modificar la línea base')
  }
  db.auditoria.push({
    id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    obraId,
    usuarioId,
    fecha: fechaISO(),
    descripcion,
  })
}

// Administración: usuarios y sus roles por obra.
export function obtenerUsuarios(db, usuarioId) {
  const u = usuario(db, usuarioId)
  if (u.rolGlobal !== 'admin') throw new ApiError(403, 'Solo administradores')
  return db.usuarios.map((x) => ({
    id: x.id,
    usuario: x.usuario,
    nombre: x.nombre,
    rolGlobal: x.rolGlobal,
    membresias: db.membresias
      .filter((m) => m.usuarioId === x.id)
      .map((m) => ({
        obraId: m.obraId,
        obra: db.obras.find((o) => o.id === m.obraId)?.nombre,
        rol: m.rol,
        permisos: m.permisos,
      })),
  }))
}

export function actualizarMembresia(db, usuarioId, { usuarioObjetivo, obraId, rol, permisos = [] }) {
  const u = usuario(db, usuarioId)
  const esAdmin = u.rolGlobal === 'admin'
  const esSupervisor = rolEnObra(db, usuarioId, obraId) === 'supervisor'
  if (!esAdmin && !esSupervisor) throw new ApiError(403, 'Sin permiso para asignar roles')

  const ROLES = ['supervisor', 'trabajador', 'rrhh', 'finanzas']
  if (!ROLES.includes(rol)) throw new ApiError(400, 'Rol inválido')
  if (!db.usuarios.some((x) => x.id === usuarioObjetivo)) throw new ApiError(404, 'Usuario no existe')
  if (!db.obras.some((o) => o.id === obraId)) throw new ApiError(404, 'Obra no existe')

  const existente = membresia(db, usuarioObjetivo, obraId)
  if (existente) {
    existente.rol = rol
    existente.permisos = permisos
  } else {
    db.membresias.push({ id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, usuarioId: usuarioObjetivo, obraId, rol, permisos })
  }
  return { ok: true }
}

// ---------- Edición de obra en marcha ----------
// La información llega de a poco: cada sección se puede corregir sobre la
// marcha. Todo cambio queda en la auditoría de la obra (requisito del cliente:
// nada se corrige sin dejar rastro).

const idNuevo = (prefijo) => `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

// Datos generales + parámetros económicos + umbrales + estado.
export function actualizarObra(db, usuarioId, obraId, datos) {
  exigirEditor(db, usuarioId, obraId)
  const obra = db.obras.find((o) => o.id === obraId)
  if (!obra) throw new ApiError(404, 'Obra no encontrada')

  const campos = [
    'nombre', 'contrato', 'mandante', 'contratista', 'rutContratista',
    'ubicacion', 'alcance', 'fechaInicio', 'fechaTermino', 'estado',
  ]
  const cambios = []
  for (const c of campos) {
    if (datos[c] !== undefined && datos[c] !== obra[c]) {
      obra[c] = datos[c]
      cambios.push(c)
    }
  }
  if (datos.plazoDias !== undefined && Number(datos.plazoDias) > 0 && Number(datos.plazoDias) !== obra.plazoDias) {
    obra.plazoDias = Number(datos.plazoDias)
    cambios.push('plazoDias')
  }
  for (const c of ['ggPct', 'utilPct', 'valorUF']) {
    if (datos[c] !== undefined && Number(datos[c]) !== obra[c]) {
      obra[c] = Number(datos[c])
      cambios.push(c)
    }
  }
  if (datos.umbrales) {
    obra.umbrales = { ...obra.umbrales, ...datos.umbrales }
    cambios.push('umbrales')
  }
  if (cambios.length) {
    auditar(db, obraId, usuarioId, `Obra actualizada: ${cambios.join(', ')}.`)
  }
  return { ok: true }
}

// Upsert de partida: el presupuesto se recalcula en el servidor.
export function guardarPartida(db, usuarioId, obraId, p) {
  exigirEditor(db, usuarioId, obraId)
  const obra = db.obras.find((o) => o.id === obraId)
  if (!obra) throw new ApiError(404, 'Obra no encontrada')
  if (!p.nombre?.trim()) throw new ApiError(400, 'La partida necesita un nombre')
  if (!(Number(p.planificada) > 0)) throw new ApiError(400, 'La partida necesita una cantidad')

  const gg = obra.ggPct ?? 0.325
  const util = obra.utilPct ?? 0.15
  const pCLP =
    Number(p.precioUnitarioCLP) ||
    Math.round((Number(p.precioUnitarioUF) || 0) * (Number(obra.valorUF) || 0))
  const planificada = Number(p.planificada)
  const presupuesto = pCLP > 0 ? Math.round(totalNetoPartida(planificada, pCLP, gg, util)) : 0

  const existente = db.partidas.find((x) => x.id === p.id && x.obraId === obraId)
  if (existente) {
    Object.assign(existente, {
      item: p.item?.trim() || existente.item,
      nombre: p.nombre.trim(),
      etapa: p.etapa?.trim() || null,
      unidad: p.unidad || existente.unidad,
      planificada,
      precioUnitarioUF: Number(p.precioUnitarioUF) || null,
      precioUnitarioCLP: pCLP || null,
      presupuesto,
    })
    auditar(db, obraId, usuarioId, `Partida ${existente.item} «${existente.nombre}» actualizada (cant. ${planificada} ${existente.unidad}).`)
    return { id: existente.id }
  }

  const orden = db.partidas.filter((x) => x.obraId === obraId).length + 1
  const nuevo = {
    id: idNuevo(`${obraId}-p`),
    obraId,
    item: p.item?.trim() || String(orden),
    nombre: p.nombre.trim(),
    etapa: p.etapa?.trim() || null,
    unidad: p.unidad || 'un',
    planificada,
    presupuesto,
    precioUnitarioUF: Number(p.precioUnitarioUF) || null,
    precioUnitarioCLP: pCLP || null,
    subpartidas: [],
    orden,
  }
  db.partidas.push(nuevo)
  auditar(db, obraId, usuarioId, `Partida ${nuevo.item} «${nuevo.nombre}» agregada (${planificada} ${nuevo.unidad}).`)
  return { id: nuevo.id }
}

export function eliminarPartida(db, usuarioId, obraId, partidaId) {
  exigirEditor(db, usuarioId, obraId)
  const partida = db.partidas.find((x) => x.id === partidaId && x.obraId === obraId)
  if (!partida) throw new ApiError(404, 'Partida no encontrada')
  if (db.lineasReporte.some((l) => l.partidaId === partidaId)) {
    throw new ApiError(400, 'La partida tiene avance registrado: no se puede eliminar')
  }
  db.partidas = db.partidas.filter((x) => x.id !== partidaId)
  auditar(db, obraId, usuarioId, `Partida ${partida.item} «${partida.nombre}» eliminada.`)
  return { ok: true }
}

// Upsert de material. Faltante/costo se recalculan aquí.
export function guardarMaterial(db, usuarioId, obraId, m) {
  exigirEditor(db, usuarioId, obraId)
  if (!m.descripcion?.trim()) throw new ApiError(400, 'El insumo necesita una descripción')

  const requerida = Number(m.requerida) || 0
  const comprada = Number(m.comprada) || 0
  const pUnitNeto = Number(m.pUnitNeto) || 0

  const existente = db.materiales.find((x) => x.id === m.id && x.obraId === obraId)
  const destino = existente || { id: idNuevo('mat'), obraId }
  Object.assign(destino, {
    codigo: m.codigo?.trim() || '—',
    descripcion: m.descripcion.trim(),
    unidad: m.unidad || 'un',
    requerida,
    comprada,
    faltante: Math.max(0, requerida - comprada),
    pUnitNeto,
    costoComprado: comprada * pUnitNeto,
  })
  if (!existente) db.materiales.push(destino)
  auditar(db, obraId, usuarioId, `Material «${destino.descripcion}» ${existente ? 'actualizado' : 'agregado'} (${comprada}/${requerida} ${destino.unidad}).`)
  return { id: destino.id }
}

export function eliminarMaterial(db, usuarioId, obraId, materialId) {
  exigirEditor(db, usuarioId, obraId)
  const m = db.materiales.find((x) => x.id === materialId && x.obraId === obraId)
  if (!m) throw new ApiError(404, 'Insumo no encontrado')
  db.materiales = db.materiales.filter((x) => x.id !== materialId)
  auditar(db, obraId, usuarioId, `Material «${m.descripcion}» eliminado.`)
  return { ok: true }
}

// Registro de gasto: lo puede hacer quien ve finanzas (admin, supervisor,
// finanzas). Queda como "Pendiente" hasta que administración lo apruebe.
export function agregarGasto(db, usuarioId, obraId, g) {
  const rol = exigirMiembro(db, usuarioId, obraId)
  if (!['admin', 'supervisor', 'finanzas'].includes(rol)) {
    throw new ApiError(403, 'Sin permiso para registrar gastos')
  }
  if (!g.categoria?.trim()) throw new ApiError(400, 'El gasto necesita una categoría')
  if (!(Number(g.monto) > 0)) throw new ApiError(400, 'El gasto necesita un monto')

  const u = usuario(db, usuarioId)
  const gasto = {
    id: idNuevo('g'),
    obraId,
    categoria: g.categoria.trim(),
    detalle: g.detalle?.trim() || g.categoria.trim(),
    monto: Math.round(Number(g.monto)),
    fecha: g.fecha || fechaISO(),
    responsable: g.responsable?.trim() || u.nombre,
    revision: rol === 'admin' ? 'Aprobado' : 'Pendiente',
  }
  db.gastos.push(gasto)
  auditar(db, obraId, usuarioId, `Gasto registrado: ${gasto.detalle} (${gasto.categoria}) por $${gasto.monto.toLocaleString('es-CL')}.`)
  return { id: gasto.id }
}

// Upsert del techo de GG por categoría (el "presupuesto" de cada gasto).
export function guardarTechoGG(db, usuarioId, obraId, c) {
  exigirEditor(db, usuarioId, obraId)
  if (!c.categoria?.trim()) throw new ApiError(400, 'La categoría necesita un nombre')
  const valorUF = db.obras.find((o) => o.id === obraId)?.valorUF || null
  const techoCLP = Math.round(Number(c.techoCLP) || 0)

  const existente = db.ggCategorias.find((x) => x.id === c.id && x.obraId === obraId)
  if (existente) {
    existente.categoria = c.categoria.trim()
    existente.techoCLP = techoCLP
    existente.techoUF = valorUF ? Math.round((techoCLP / valorUF) * 100) / 100 : null
    auditar(db, obraId, usuarioId, `Techo GG «${existente.categoria}» ajustado a $${techoCLP.toLocaleString('es-CL')}.`)
    return { id: existente.id }
  }
  const nuevo = {
    id: idNuevo('gg'),
    obraId,
    categoria: c.categoria.trim(),
    techoCLP,
    techoUF: valorUF ? Math.round((techoCLP / valorUF) * 100) / 100 : null,
  }
  db.ggCategorias.push(nuevo)
  auditar(db, obraId, usuarioId, `Categoría GG «${nuevo.categoria}» creada con techo $${techoCLP.toLocaleString('es-CL')}.`)
  return { id: nuevo.id }
}

export function eliminarTechoGG(db, usuarioId, obraId, catId) {
  exigirEditor(db, usuarioId, obraId)
  const c = db.ggCategorias.find((x) => x.id === catId && x.obraId === obraId)
  if (!c) throw new ApiError(404, 'Categoría no encontrada')
  if (db.gastos.some((g) => g.obraId === obraId && g.categoria === c.categoria)) {
    throw new ApiError(400, 'La categoría tiene gastos registrados: no se puede eliminar')
  }
  db.ggCategorias = db.ggCategorias.filter((x) => x.id !== catId)
  auditar(db, obraId, usuarioId, `Categoría GG «${c.categoria}» eliminada.`)
  return { ok: true }
}

// Upsert de dotación: RRHH también administra su personal.
export function guardarDotacion(db, usuarioId, obraId, d) {
  const rol = exigirMiembro(db, usuarioId, obraId)
  if (!['admin', 'supervisor', 'rrhh'].includes(rol)) {
    throw new ApiError(403, 'Sin permiso para editar la dotación')
  }
  if (!d.nombre?.trim()) throw new ApiError(400, 'La persona necesita un nombre')

  const sueldoBase = Math.round(Number(d.sueldoBase) || 0)
  const tratos = Math.round(Number(d.tratos) || 0)
  const imponible = sueldoBase + tratos
  const plazo = db.obras.find((o) => o.id === obraId)?.plazoDias || 145

  const existente = db.dotacion.find((x) => x.id === d.id && x.obraId === obraId)
  const destino = existente || { id: idNuevo('d'), obraId, cuentaId: null }
  Object.assign(destino, {
    rut: d.rut?.trim() || existente?.rut || null,
    nombre: d.nombre.trim(),
    cargo: d.cargo?.trim() || 'Sin cargo',
    sueldoBase,
    tratos,
    diasTrab: Number(d.diasTrab) || existente?.diasTrab || 30,
    imponible,
    leyesSociales: Math.round(imponible * 0.3),
    costoMensual: Math.round(imponible * 1.3),
    proyectado145d: Math.round((imponible * 1.3 * plazo) / 30),
    activo: d.activo !== undefined ? Boolean(d.activo) : true,
  })
  if (!existente) db.dotacion.push(destino)
  auditar(db, obraId, usuarioId, `Dotación: ${destino.nombre} (${destino.cargo}) ${existente ? 'actualizado' : 'incorporado'}${destino.activo === false ? ' — desactivado' : ''}.`)
  return { id: destino.id }
}
