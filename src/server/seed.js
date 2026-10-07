import { fechaISO } from '../lib/format.js'

// Hash simulado para el demo (cyrb53). En el backend PHP real se usará
// password_hash() con bcrypt. Las contraseñas nunca se guardan en texto.
export function hashSimulado(texto) {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < texto.length; i++) {
    const ch = texto.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return `sim:${(h2 >>> 0).toString(16)}${(h1 >>> 0).toString(16)}`
}

function diasAtras(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return fechaISO(d)
}

let seq = 0
const id = (p) => `${p}-${++seq}`

// Genera reportes pasados para dejar el ejecutado acumulado deseado.
// lineasPorReporte: [{ usuario, hace, observaciones, sinFaena?, lineas: {partidaId: cantidad} }]
function reporte(obraId, usuarioId, hace, lineas, observaciones = '', sinFaena = false) {
  return {
    id: id('rep'),
    clientId: `seed-${++seq}`,
    obraId,
    usuarioId,
    fecha: diasAtras(hace),
    observaciones,
    sinFaena,
    creadoEn: diasAtras(hace),
    estado: 'enviado',
    _lineas: lineas,
  }
}

export function seed() {
  seq = 0
  const hoy = fechaISO()

  const organizacion = { id: 'org-1', nombre: 'Expert Applicator SpA' }

  const usuarios = [
    { id: 'u-admin', usuario: 'admin', nombre: 'Carolina Fuentes', rolGlobal: 'admin', passwordHash: hashSimulado('demo1234') },
    { id: 'u-sup', usuario: 'supervisora', nombre: 'Marcela Rojas', rolGlobal: 'usuario', passwordHash: hashSimulado('demo1234') },
    { id: 'u-jefe', usuario: 'jefecuadrilla', nombre: 'Pedro Salinas', rolGlobal: 'usuario', passwordHash: hashSimulado('demo1234') },
    { id: 'u-trab', usuario: 'trabajador', nombre: 'Juan Pérez', rolGlobal: 'usuario', passwordHash: hashSimulado('demo1234') },
    { id: 'u-maestro', usuario: 'maestro', nombre: 'Luis Contreras', rolGlobal: 'usuario', passwordHash: hashSimulado('demo1234') },
    { id: 'u-rrhh', usuario: 'rrhh', nombre: 'Valentina Soto', rolGlobal: 'usuario', passwordHash: hashSimulado('demo1234') },
  ]

  // --- Obras ---
  const obras = [
    {
      id: 'obra-lampa',
      nombre: 'Remodelación Nave Industrial - Lampa',
      ubicacion: 'Lampa, Región Metropolitana',
      estado: 'activa',
      fechaInicio: diasAtras(53),
      plazoDias: 100,
      materialesPct: 0.85,
      umbrales: null, // usa los de defecto
      activadaEn: diasAtras(53),
      creadaPor: 'u-sup',
    },
    {
      id: 'obra-maipu',
      nombre: 'Ampliación Planta de Frío - Maipú',
      ubicacion: 'Maipú, Región Metropolitana',
      estado: 'activa',
      fechaInicio: diasAtras(30),
      plazoDias: 90,
      materialesPct: 0.9,
      umbrales: null,
      activadaEn: diasAtras(30),
      creadaPor: 'u-sup',
    },
    {
      id: 'obra-quilicura',
      nombre: 'Reparación Cubierta Bodega Sur - Quilicura',
      ubicacion: 'Quilicura, Región Metropolitana',
      estado: 'activa',
      fechaInicio: diasAtras(60),
      plazoDias: 80,
      materialesPct: 0.3,
      umbrales: null,
      activadaEn: diasAtras(60),
      creadaPor: 'u-sup',
    },
    {
      id: 'obra-pudahuel',
      nombre: 'Remodelación Oficinas Industriales - Pudahuel',
      ubicacion: 'Pudahuel, Región Metropolitana',
      estado: 'finalizada',
      fechaInicio: diasAtras(140),
      plazoDias: 90,
      materialesPct: 1,
      umbrales: null,
      activadaEn: diasAtras(140),
      creadaPor: 'u-sup',
    },
  ]

  // --- Partidas: [nombre, unidad, planificada, presupuesto] ---
  // --- Partidas: [nombre, unidad, planificada, presupuesto neto CLP] ---
  // precioUnitarioCLP derivado asumiendo GG 32,5% + utilidad 15% (factor 1,475).
  const partidas = []
  const agregarPartidas = (obraId, lista) =>
    lista.forEach(([nombre, unidad, planificada, presupuesto], i) =>
      partidas.push({
        id: `${obraId}-p${i + 1}`,
        obraId,
        nombre,
        unidad,
        planificada,
        presupuesto,
        precioUnitarioUF: null,
        precioUnitarioCLP: Math.round(presupuesto / planificada / 1.475),
        orden: i + 1,
      }),
    )

  agregarPartidas('obra-lampa', [
    ['Demolición de tabiques', 'm²', 400, 8000000],
    ['Radier industrial', 'm²', 850, 25500000],
    ['Estructura metálica', 'kg', 12000, 36000000],
    ['Pintura industrial', 'm²', 1800, 18000000],
    ['Instalación eléctrica', 'ml', 600, 12500000],
  ])
  agregarPartidas('obra-maipu', [
    ['Preparación de terreno', 'm²', 500, 5000000],
    ['Fundaciones', 'm³', 800, 18000000],
    ['Enfierradura y estructura', 'kg', 20000, 17000000],
  ])
  agregarPartidas('obra-quilicura', [
    ['Reparación de cubierta', 'm²', 1200, 24000000],
    ['Sellado de uniones', 'ml', 3000, 9000000],
    ['Pintura anticorrosiva', 'm²', 1200, 12000000],
  ])
  agregarPartidas('obra-pudahuel', [
    ['Demolición interior', 'm²', 300, 4500000],
    ['Tabiques y cielos', 'm²', 500, 12000000],
    ['Instalaciones y terminaciones', 'glb', 1, 9000000],
  ])

  // --- Membresías (rol por obra) ---
  const membresias = [
    { id: 'm-1', usuarioId: 'u-sup', obraId: 'obra-lampa', rol: 'supervisor', permisos: [] },
    { id: 'm-2', usuarioId: 'u-sup', obraId: 'obra-maipu', rol: 'supervisor', permisos: [] },
    { id: 'm-3', usuarioId: 'u-sup', obraId: 'obra-quilicura', rol: 'supervisor', permisos: [] },
    { id: 'm-4', usuarioId: 'u-sup', obraId: 'obra-pudahuel', rol: 'supervisor', permisos: [] },
    { id: 'm-5', usuarioId: 'u-jefe', obraId: 'obra-lampa', rol: 'jefe_cuadrilla', permisos: [] },
    { id: 'm-6', usuarioId: 'u-jefe', obraId: 'obra-quilicura', rol: 'jefe_cuadrilla', permisos: [] },
    { id: 'm-7', usuarioId: 'u-trab', obraId: 'obra-lampa', rol: 'trabajador', permisos: [] },
    { id: 'm-8', usuarioId: 'u-maestro', obraId: 'obra-lampa', rol: 'jefe_cuadrilla', permisos: [] },
    { id: 'm-9', usuarioId: 'u-maestro', obraId: 'obra-maipu', rol: 'jefe_cuadrilla', permisos: [] },
    { id: 'm-10', usuarioId: 'u-rrhh', obraId: 'obra-lampa', rol: 'rrhh', permisos: [] },
    { id: 'm-11', usuarioId: 'u-rrhh', obraId: 'obra-maipu', rol: 'rrhh', permisos: [] },
    { id: 'm-12', usuarioId: 'u-rrhh', obraId: 'obra-quilicura', rol: 'rrhh', permisos: [] },
    { id: 'm-13', usuarioId: 'u-rrhh', obraId: 'obra-pudahuel', rol: 'rrhh', permisos: [] },
  ]

  // --- Dotación (nómina de obra; sueldos son dato sensible) ---
  const dotacion = [
    { id: 'd-1', obraId: 'obra-lampa', nombre: 'Pedro Salinas', cargo: 'Jefe de cuadrilla', sueldo: 1450000, activo: true },
    { id: 'd-2', obraId: 'obra-lampa', nombre: 'Juan Pérez', cargo: 'Maestro constructor', sueldo: 980000, activo: true },
    { id: 'd-3', obraId: 'obra-lampa', nombre: 'Luis Contreras', cargo: 'Soldador', sueldo: 1100000, activo: true },
    { id: 'd-4', obraId: 'obra-lampa', nombre: 'Óscar Muñoz', cargo: 'Ayudante', sueldo: 650000, activo: true },
    { id: 'd-5', obraId: 'obra-maipu', nombre: 'Luis Contreras', cargo: 'Jefe de cuadrilla', sueldo: 1450000, activo: true },
    { id: 'd-6', obraId: 'obra-maipu', nombre: 'Rosa Díaz', cargo: 'Maestra', sueldo: 980000, activo: true },
    { id: 'd-7', obraId: 'obra-maipu', nombre: 'Álvaro Neira', cargo: 'Ayudante', sueldo: 650000, activo: true },
    { id: 'd-8', obraId: 'obra-quilicura', nombre: 'Pedro Salinas', cargo: 'Jefe de cuadrilla', sueldo: 1450000, activo: true },
    { id: 'd-9', obraId: 'obra-quilicura', nombre: 'Mario Soto', cargo: 'Impermeabilizador', sueldo: 950000, activo: true },
  ]

  // --- Reportes (el ejecutado se deriva de sus líneas) ---
  const reportes = [
    // Lampa — históricos
    reporte('obra-lampa', 'u-jefe', 40, { 'obra-lampa-p1': 400, 'obra-lampa-p2': 300, 'obra-lampa-p3': 3000 }, 'Demolición terminada, inicio de radier.'),
    reporte('obra-lampa', 'u-jefe', 20, { 'obra-lampa-p2': 300, 'obra-lampa-p3': 2400, 'obra-lampa-p5': 100 }, 'Avance en estructura y primer tramo eléctrico.'),
    // Lampa — hoy: 3 personas reportaron (dotación activa = 4)
    reporte('obra-lampa', 'u-trab', 0, { 'obra-lampa-p4': 200 }, 'Primera mano en sector norte.'),
    reporte('obra-lampa', 'u-maestro', 0, { 'obra-lampa-p5': 50 }, 'Canalización sector poniente.'),
    reporte('obra-lampa', 'u-jefe', 0, { 'obra-lampa-p4': 160 }, 'Pintura avanza según lo previsto.'),

    // Maipú — al día (~33% programado, ~33% real)
    reporte('obra-maipu', 'u-maestro', 15, { 'obra-maipu-p1': 170, 'obra-maipu-p2': 260, 'obra-maipu-p3': 6800 }, 'Terreno listo, fundaciones en marcha.'),
    reporte('obra-maipu', 'u-maestro', 0, {}, 'Lluvia en la mañana, sin faena.', true),

    // Quilicura — crítica (75% programado, ~31% real, materiales 30%)
    reporte('obra-quilicura', 'u-jefe', 30, { 'obra-quilicura-p1': 300, 'obra-quilicura-p2': 900, 'obra-quilicura-p3': 540 }, 'Se retrasa por falta de material de sellado.'),
    reporte('obra-quilicura', 'u-jefe', 0, { 'obra-quilicura-p2': 0 }, 'Se reitera falta de materiales en bodega.'),

    // Pudahuel — finalizada (100%)
    reporte('obra-pudahuel', 'u-sup', 100, { 'obra-pudahuel-p1': 300, 'obra-pudahuel-p2': 500 }, 'Avance completo de demolición y tabiques.'),
    reporte('obra-pudahuel', 'u-sup', 55, { 'obra-pudahuel-p3': 1 }, 'Terminaciones entregadas.'),
  ]

  const lineasReporte = []
  for (const r of reportes) {
    for (const [partidaId, cantidad] of Object.entries(r._lineas)) {
      if (cantidad > 0) lineasReporte.push({ id: id('lin'), reporteId: r.id, partidaId, cantidad })
    }
    delete r._lineas
  }

  const fotos = [
    { id: 'f-1', reporteId: reportes[0].id, nombre: 'demolicion-terminada.jpg' },
    { id: 'f-2', reporteId: reportes[1].id, nombre: 'estructura-avance.jpg' },
  ]

  // --- Gastos ---
  const gastos = [
    { id: 'g-1', obraId: 'obra-lampa', categoria: 'Mano de obra', monto: 28000000, fecha: diasAtras(30) },
    { id: 'g-2', obraId: 'obra-lampa', categoria: 'Materiales', monto: 15000000, fecha: diasAtras(18) },
    { id: 'g-3', obraId: 'obra-lampa', categoria: 'Equipos', monto: 4000000, fecha: diasAtras(5) },
    { id: 'g-4', obraId: 'obra-maipu', categoria: 'Mano de obra', monto: 8000000, fecha: diasAtras(12) },
    { id: 'g-5', obraId: 'obra-maipu', categoria: 'Materiales', monto: 5000000, fecha: diasAtras(4) },
    { id: 'g-6', obraId: 'obra-quilicura', categoria: 'Mano de obra', monto: 9000000, fecha: diasAtras(20) },
    { id: 'g-7', obraId: 'obra-quilicura', categoria: 'Arriendos', monto: 5000000, fecha: diasAtras(8) },
    { id: 'g-8', obraId: 'obra-pudahuel', categoria: 'Mano de obra', monto: 15000000, fecha: diasAtras(90) },
    { id: 'g-9', obraId: 'obra-pudahuel', categoria: 'Materiales', monto: 9000000, fecha: diasAtras(70) },
  ]

  // Estructuras preparadas para alcance futuro (sin funcionalidad en demo)
  const materiales = []
  const estadosPago = []

  const auditoria = [
    { id: 'a-1', obraId: 'obra-lampa', usuarioId: 'u-sup', fecha: diasAtras(53), descripcion: 'Obra activada: línea base protegida (5 partidas).' },
    { id: 'a-2', obraId: 'obra-quilicura', usuarioId: 'u-sup', fecha: diasAtras(60), descripcion: 'Obra activada: línea base protegida (3 partidas).' },
  ]

  return {
    version: 1,
    sembradoEn: hoy,
    organizacion,
    usuarios,
    obras,
    partidas,
    membresias,
    dotacion,
    reportes,
    lineasReporte,
    fotos,
    gastos,
    materiales,
    estadosPago,
    auditoria,
  }
}
