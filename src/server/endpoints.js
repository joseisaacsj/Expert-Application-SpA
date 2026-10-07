import { indicadoresObra, avancePartida, totalNetoPartida } from '../lib/calculos.js'
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
  return rol === 'admin' || rol === 'supervisor'
}

export function puedeVerSueldos(db, usuarioId, obraId) {
  const rol = rolEnObra(db, usuarioId, obraId)
  if (rol === 'admin' || rol === 'supervisor') return true
  if (rol === 'rrhh') {
    return membresia(db, usuarioId, obraId)?.permisos?.includes('ver_sueldos') ?? false
  }
  return false
}

function exigirMiembro(db, usuarioId, obraId) {
  const rol = rolEnObra(db, usuarioId, obraId)
  if (!rol) throw new ApiError(403, 'No tienes acceso a esta obra')
  return rol
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

function indicadoresDe(db, obra, hoy = fechaISO()) {
  const partidas = partidasConAvance(db, obra.id)
  const gastoReal = db.gastos
    .filter((g) => g.obraId === obra.id)
    .reduce((s, g) => s + g.monto, 0)
  const { reportaronHoy, huboSinFaenaHoy } = statsHoy(db, obra.id, hoy)
  return indicadoresObra({
    obra: { ...obra, dotacionActiva: db.dotacion.filter((d) => d.obraId === obra.id && d.activo).length },
    partidas,
    gastoReal,
    materialesPct: obra.materialesPct ?? 0,
    reportaronHoy,
    huboSinFaenaHoy,
    hoy,
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
  const { id, nombre, ubicacion, estado, fechaInicio, plazoDias } = obra
  return { id, nombre, ubicacion, estado, fechaInicio, plazoDias }
}

// ---------- endpoints ----------

export function login(db, usuarioNombre, password) {
  const u = db.usuarios.find((x) => x.usuario === usuarioNombre.toLowerCase().trim())
  if (!u || u.passwordHash !== hashSimulado(password)) {
    throw new ApiError(401, 'Usuario o contraseña incorrectos')
  }
  return {
    usuario: { id: u.id, usuario: u.usuario, nombre: u.nombre, rolGlobal: u.rolGlobal },
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
      nombre: p.nombre,
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
    indicadores,
    alertas: alertasDe(db, obra, ind),
    partidas,
    auditoria: db.auditoria.filter((a) => a.obraId === obraId),
    // ¿Esta persona ya envió su reporte hoy? Alimenta el banner del reporte.
    miReporteHoy: db.reportes.some(
      (r) => r.obraId === obraId && r.usuarioId === usuarioId && r.fecha === fechaISO(),
    ),
    puedeReportar: rol !== 'rrhh' && obra.estado === 'activa',
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
  exigirMiembro(db, usuarioId, obraId)
  if (!clientId) throw new ApiError(400, 'Falta clientId (idempotencia)')

  const existente = db.reportes.find((r) => r.clientId === clientId)
  if (existente) return { reporte: existente, duplicado: true }

  const partidasObra = new Set(db.partidas.filter((p) => p.obraId === obraId).map((p) => p.id))
  for (const l of lineas) {
    if (!partidasObra.has(l.partidaId)) throw new ApiError(400, 'Partida no pertenece a la obra')
    if (!(l.cantidad > 0)) throw new ApiError(400, 'Cantidad debe ser mayor a cero')
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

// RRHH: dotación y estado de reportes. Sueldos solo con permiso explícito.
export function obtenerRRHH(db, usuarioId, obraId) {
  const rol = exigirMiembro(db, usuarioId, obraId)
  if (rol === 'trabajador' || rol === 'jefe_cuadrilla') {
    throw new ApiError(403, 'Sin acceso a la vista de RRHH')
  }
  const hoy = fechaISO()
  const reportesHoy = db.reportes.filter((r) => r.obraId === obraId && r.fecha === hoy)
  const reportaron = new Set(reportesHoy.map((r) => r.usuarioId))
  const veSueldos = puedeVerSueldos(db, usuarioId, obraId)

  const dotacion = db.dotacion
    .filter((d) => d.obraId === obraId && d.activo)
    .map((d) => {
      const usuarioCuenta = db.usuarios.find((u) => u.nombre === d.nombre)
      const base = {
        id: d.id,
        nombre: d.nombre,
        cargo: d.cargo,
        reportoHoy: usuarioCuenta ? reportaron.has(usuarioCuenta.id) : false,
      }
      return veSueldos ? { ...base, sueldo: d.sueldo } : base
    })

  return {
    dotacion,
    reportaronHoy: reportaron.size,
    total: dotacion.length,
    sinFaenaHoy: reportesHoy.some((r) => r.sinFaena),
    puedeVerSueldos: veSueldos,
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
      nombre: p.nombre.trim(),
      unidad: p.unidad || 'un',
      planificada: p.planificada,
      presupuesto,
      precioUnitarioUF: Number(p.precioUnitarioUF) || null,
      precioUnitarioCLP: pUnitCLP || null,
      orden: i + 1,
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

  const ROLES = ['supervisor', 'jefe_cuadrilla', 'trabajador', 'rrhh']
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
