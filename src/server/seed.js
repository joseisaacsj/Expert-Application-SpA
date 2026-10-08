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

function diasAdelante(n) {
  return diasAtras(-n)
}

let seq = 0
const id = (p) => `${p}-${++seq}`

// Genera reportes pasados para dejar el ejecutado acumulado deseado.
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

// Datos extraídos de CONTROL_GESTION_CCM_OUTLET_LA_FABRICA_v5.xlsx
// Contrato 508-E-2026 — CCM SpA. Las fechas se anclan relativas a "hoy"
// (~36% del plazo consumido) para que la demo siempre esté en curso.
export function seed() {
  seq = 0
  const hoy = fechaISO()

  const organizacion = { id: 'org-1', nombre: 'Construcciones y Pinturas CCM SpA' }

  // --- Usuarios reales del cliente (contraseña demo1234) ---
  const usuarios = [
    { id: 'u-claudio', usuario: 'ccarrasco', nombre: 'Claudio Carrasco', cargo: 'Gerente General', rolGlobal: 'admin', passwordHash: hashSimulado('demo1234') },
    { id: 'u-jeannette', usuario: 'jcarrillo', nombre: 'Jeannette Carrillo', cargo: 'Administradora', rolGlobal: 'admin', passwordHash: hashSimulado('demo1234') },
    { id: 'u-mauricio', usuario: 'mmansilla', nombre: 'Mauricio Mansilla', cargo: 'Supervisor de Obras', rolGlobal: 'usuario', passwordHash: hashSimulado('demo1234') },
    { id: 'u-rrhh', usuario: 'rrhh', nombre: 'Encargado de RRHH', cargo: 'Encargado de RRHH', rolGlobal: 'usuario', passwordHash: hashSimulado('demo1234') },
    { id: 'u-finanzas', usuario: 'finanzas', nombre: 'Encargado de Finanzas', cargo: 'Encargado de Finanzas', rolGlobal: 'usuario', passwordHash: hashSimulado('demo1234') },
    { id: 'u-maestro1', usuario: 'maestro1', nombre: 'Maestro de Cuadrilla 1', cargo: 'Trabajador', rolGlobal: 'usuario', passwordHash: hashSimulado('demo1234') },
    { id: 'u-maestro2', usuario: 'maestro2', nombre: 'Maestro de Cuadrilla 2', cargo: 'Trabajador', rolGlobal: 'usuario', passwordHash: hashSimulado('demo1234') },
    { id: 'u-maestro3', usuario: 'maestro3', nombre: 'Maestro de Cuadrilla 3', cargo: 'Trabajador', rolGlobal: 'usuario', passwordHash: hashSimulado('demo1234') },
    { id: 'u-albanil', usuario: 'albanil', nombre: 'Albañil', cargo: 'Trabajador', rolGlobal: 'usuario', passwordHash: hashSimulado('demo1234') },
    { id: 'u-carpintero', usuario: 'carpintero', nombre: 'Carpintero', cargo: 'Trabajador', rolGlobal: 'usuario', passwordHash: hashSimulado('demo1234') },
    { id: 'u-soldador', usuario: 'soldador', nombre: 'Soldador', cargo: 'Trabajador', rolGlobal: 'usuario', passwordHash: hashSimulado('demo1234') },
  ]

  // --- Obra: Contrato 508-E-2026 — Impermeabilización Cubierta Outlet La Fábrica Etapa II ---
  // Plazo contractual: 145 días corridos (hoja INSTRUCCIONES).
  const OBRA = 'obra-ccm'
  const obras = [
    {
      id: OBRA,
      nombre: 'Impermeabilización Cubierta Outlet La Fábrica Etapa II',
      contrato: 'Contrato 508-E-2026',
      mandante: 'Grupo Patio',
      contratista: 'Construcciones y Pinturas CCM SpA',
      rutContratista: '76.293.512-0',
      ubicacion: 'Carlos Valdovinos N° 200, San Joaquín, Santiago',
      alcance:
        'Impermeabilización de cubierta y vigas etapas E1 y E2 con sistemas CAVE ' +
        '(Hydraseal + AlphaGuard Base/Top + Permafab) y TREMCO (Alumanation 301), ' +
        'reparación de canales de aguas lluvias y montaje de pasarelas tipo SASEC.',
      estado: 'activa',
      fechaInicio: diasAtras(52),
      plazoDias: 145,
      fechaTermino: diasAdelante(93),
      ufInicial: 39500,
      tasaUFMensual: 0.003,
      valorUF: 39500,
      ggPct: 0.325,
      utilPct: 0.15,
      materialesPct: 0.173, // $118.874.165 comprado / $685.263.531 requerido
      umbrales: null,
      activadaEn: diasAtras(52),
      creadaPor: 'u-mauricio',
    },
  ]

  // --- Partidas (hoja PRESUPUESTO) ---
  // item: código del contrato. etapa: E1/E2 agrupador. subpartidas: APU.
  // presupuesto = Total Neto CLP (costo directo × 1,475 con GG 32,5% + util 15%).
  const apuCubiertaCave = [
    { codigo: '15289-0', concepto: 'Hydraseal DPM Kit', unidad: 'kg', rendimiento: 0.4, precioUnitario: 15513, costoCLP: 6205 },
    { codigo: '19047-1/19119-0', concepto: 'AlphaGuard BIO Base Coat A+B', unidad: 'L', rendimiento: 1.35, precioUnitario: 8200, costoCLP: 11070 },
    { codigo: '20309-5/24443-8', concepto: 'AlphaGuard BIO Top Coat A+B', unidad: 'L', rendimiento: 0.85, precioUnitario: 9500, costoCLP: 8075 },
    { codigo: '25056-0', concepto: 'Permafab Rollo Malla 40"', unidad: 'm²', rendimiento: 1.05, precioUnitario: 2550, costoCLP: 2678 },
    { codigo: 'MO-ESP', concepto: 'Mano de Obra Especialista Aplicador', unidad: 'día', rendimiento: 0.04, precioUnitario: 35000, costoCLP: 1400 },
    { codigo: 'MO-AYU', concepto: 'Mano de Obra Ayudante Terreno', unidad: 'día', rendimiento: 0.04, precioUnitario: 25000, costoCLP: 1000 },
    { codigo: 'EQ-AIR', concepto: 'Herramientas Menores y Equipos Airless', unidad: 'gl', rendimiento: 1, precioUnitario: 1500, costoCLP: 1500 },
  ]
  const apuVigasCave = [
    { codigo: '15289-0', concepto: 'Hydraseal DPM Kit', unidad: 'kg', rendimiento: 0.4, precioUnitario: 15513, costoCLP: 6205 },
    { codigo: '19047-1/19119-0', concepto: 'AlphaGuard BIO Base Coat A+B', unidad: 'L', rendimiento: 1.35, precioUnitario: 8200, costoCLP: 11070 },
    { codigo: '20309-5/24443-8', concepto: 'AlphaGuard BIO Top Coat A+B', unidad: 'L', rendimiento: 0.85, precioUnitario: 9500, costoCLP: 8075 },
    { codigo: 'MO-VIG', concepto: 'Mano de Obra Vigas (Altura)', unidad: 'día', rendimiento: 0.05, precioUnitario: 40000, costoCLP: 2000 },
    { codigo: 'EQ-ALT', concepto: 'Equipos Alza Hombre / Seguridad', unidad: 'gl', rendimiento: 1, precioUnitario: 2000, costoCLP: 2000 },
  ]
  const apuCanales = [
    { codigo: '25338-0', concepto: 'Versaspeed 100 CI Mortero Parche', unidad: 'kg', rendimiento: 2, precioUnitario: 1722, costoCLP: 3444 },
    { codigo: '15289-0', concepto: 'Hydraseal DPM Kit', unidad: 'kg', rendimiento: 0.3, precioUnitario: 15513, costoCLP: 4654 },
    { codigo: '19047-1', concepto: 'AlphaGuard BIO Base Coat', unidad: 'L', rendimiento: 0.8, precioUnitario: 8200, costoCLP: 6560 },
    { codigo: '95399-3', concepto: 'Cave Permafab Tela 4"', unidad: 'ml', rendimiento: 1.05, precioUnitario: 377, costoCLP: 396 },
    { codigo: '20309-5', concepto: 'AlphaGuard BIO Top Coat', unidad: 'L', rendimiento: 0.5, precioUnitario: 9500, costoCLP: 4750 },
    { codigo: 'MO-CAN', concepto: 'Mano de Obra Canales y Reparación', unidad: 'día', rendimiento: 0.04, precioUnitario: 35000, costoCLP: 1400 },
  ]

  const partidasBase = [
    // [item, nombre, etapa, unidad, planificada, pUF, pCLP, netoCLP, apu]
    ['1.1.1', 'E1 - Cubierta CAVE (Hydraseal + Base + Top + Permafab)', 'Etapa 1', 'm²', 16549, 0.68, 26860, 655646557, apuCubiertaCave],
    ['1.2.1', 'E2 - Cubierta CAVE (Hydraseal + Base + Top + Permafab)', 'Etapa 2', 'm²', 5967, 0.68, 26860, 236403590, apuCubiertaCave],
    ['1.2.2', 'E2 - Cubierta TREMCO (Alumanation 301 + Permafab)', 'Etapa 2', 'm²', 3821, 0.32, 12640, 71238724, [
      { codigo: '25056-0', concepto: 'Permafab Rollo Malla 40"', unidad: 'm²', rendimiento: 1.05, precioUnitario: 2550, costoCLP: 2678 },
      { codigo: '58784-3', concepto: 'Tremco Alumanation 301', unidad: 'L', rendimiento: 0.8, precioUnitario: 7700, costoCLP: 6160 },
      { codigo: 'MO-TRE', concepto: 'Mano de Obra Aplicación Tremco', unidad: 'día', rendimiento: 0.03, precioUnitario: 35000, costoCLP: 1050 },
      { codigo: 'MO-AYU', concepto: 'Mano de Obra Ayudante', unidad: 'día', rendimiento: 0.03, precioUnitario: 25000, costoCLP: 750 },
      { codigo: 'EQ-ROD', concepto: 'Herramientas y Rodillos', unidad: 'gl', rendimiento: 1, precioUnitario: 1000, costoCLP: 1000 },
    ]],
    ['2.1.1', 'E1 - Vigas CAVE (Hydraseal + Base + Top)', 'Etapa 1', 'm²', 2068, 0.68, 26860, 81931058, apuVigasCave],
    ['2.2.1', 'E2 - Vigas CAVE (Hydraseal + Base + Top)', 'Etapa 2', 'm²', 1932, 0.68, 26860, 76542942, apuVigasCave],
    ['3.1.1', 'E1 - Canal A.LL. CAVE (Versaspeed + Hydraseal + Base + Top + Permafab)', 'Etapa 1', 'ml', 2230, 0.52, 20540, 67561195, apuCanales],
    ['3.1.2', 'E2 - Canal A.LL. CAVE (Versaspeed + Hydraseal + Base + Top + Permafab)', 'Etapa 2', 'ml', 885, 0.52, 20540, 26812403, apuCanales],
    ['4.1', 'Pasarelas tipo SASEC (Galvanizada Doble SP-302 + Barandas SR-401A)', 'Etapa final', 'ml', 810, 7.16, 282820, 337899195, [
      { codigo: 'PAS-01', concepto: 'Pasarela Galvanizada Doble SP-302 (450mm)', unidad: 'ml', rendimiento: 1, precioUnitario: 165000, costoCLP: 165000 },
      { codigo: 'BAR-01', concepto: 'Baranda SR-401A h=1.0m Pasamanos/Rodapié ambos lados', unidad: 'ml', rendimiento: 2, precioUnitario: 42000, costoCLP: 84000 },
      { codigo: 'ANC-01', concepto: 'Anclajes, Pernos y Placas de Montaje', unidad: 'gl', rendimiento: 1, precioUnitario: 12000, costoCLP: 12000 },
      { codigo: 'MO-PAS', concepto: 'Mano de Obra Montaje Pasarelas y Estructura', unidad: 'día', rendimiento: 0.2, precioUnitario: 45000, costoCLP: 9000 },
      { codigo: 'EQ-PAS', concepto: 'Herramientas, Izaje y Seguridad Montaje', unidad: 'gl', rendimiento: 1, precioUnitario: 12820, costoCLP: 12820 },
    ]],
  ]

  // Ventanas planificadas por partida: [día de inicio, día de término]
  // contados desde el inicio de la obra (día 0). Etapa 1 primero, Etapa 2
  // después y las pasarelas al final, como en el programa del contrato.
  const ventanas = [
    [0, 74],    // 1.1.1 Cubierta E1
    [54, 114],  // 1.2.1 Cubierta E2
    [74, 109],  // 1.2.2 Cubierta TREMCO E2
    [29, 69],   // 2.1.1 Vigas E1
    [69, 109],  // 2.2.1 Vigas E2
    [19, 59],   // 3.1.1 Canal E1
    [94, 124],  // 3.1.2 Canal E2
    [109, 139], // 4.1 Pasarelas
  ]
  const inicioObra = diasAtras(52)
  const masDias = (n) => {
    const d = new Date(inicioObra)
    d.setDate(d.getDate() + n)
    return fechaISO(d)
  }

  const partidas = partidasBase.map(([item, nombre, etapa, unidad, planificada, pUF, pCLP, neto, apu], i) => ({
    id: `${OBRA}-p${i + 1}`,
    obraId: OBRA,
    item,
    nombre,
    etapa,
    unidad,
    planificada,
    presupuesto: neto,
    precioUnitarioUF: pUF,
    precioUnitarioCLP: pCLP,
    fechaCompromiso: '2026-11-15',
    subpartidas: apu,
    orden: i + 1,
  }))

  // Plan diario: cantidad planificada por fecha y partida, generado desde
  // las ventanas (cantidad/día = planificada ÷ días de la ventana).
  const planDias = []
  partidas.forEach((p, i) => {
    const [dIni, dFin] = ventanas[i]
    const meta = Math.round((p.planificada / (dFin - dIni + 1)) * 10) / 10
    for (let d = dIni; d <= dFin; d++) {
      planDias.push({ id: `pd-${planDias.length + 1}`, obraId: OBRA, fecha: masDias(d), partidaId: p.id, cantidad: meta })
    }
  })

  // --- Membresías (rol por obra) ---
  const membresias = [
    { id: 'm-1', usuarioId: 'u-mauricio', obraId: OBRA, rol: 'supervisor', permisos: [] },
    { id: 'm-2', usuarioId: 'u-rrhh', obraId: OBRA, rol: 'rrhh', permisos: [] },
    { id: 'm-3', usuarioId: 'u-finanzas', obraId: OBRA, rol: 'finanzas', permisos: [] },
    { id: 'm-4', usuarioId: 'u-maestro1', obraId: OBRA, rol: 'trabajador', permisos: [] },
    { id: 'm-5', usuarioId: 'u-maestro2', obraId: OBRA, rol: 'trabajador', permisos: [] },
    { id: 'm-6', usuarioId: 'u-maestro3', obraId: OBRA, rol: 'trabajador', permisos: [] },
    { id: 'm-7', usuarioId: 'u-albanil', obraId: OBRA, rol: 'trabajador', permisos: [] },
    { id: 'm-8', usuarioId: 'u-carpintero', obraId: OBRA, rol: 'trabajador', permisos: [] },
    { id: 'm-9', usuarioId: 'u-soldador', obraId: OBRA, rol: 'trabajador', permisos: [] },
  ]

  // --- Nómina (hoja RRHH): sueldos son dato sensible ---
  const dotacion = [
    ['12.345.678-9', 'Claudio Carrasco', 'Supervisor de Obra', 1500000, 0, null],
    ['14.567.890-1', 'Cristian Carrasco', 'Prevencionista de Riesgos', 1200000, 0, null],
    ['15.678.901-2', 'Lorenzo (Jefe Cuadrilla)', 'Maestro Aplicador', 850000, 150000, 'u-maestro1'],
    ['16.789.012-3', 'Jorge', 'Maestro Aplicador', 700000, 100000, 'u-maestro2'],
    ['17.890.123-4', 'Mauricio', 'Maestro Aplicador', 700000, 100000, 'u-maestro3'],
    ['18.901.234-5', 'Rubén', 'Maestro Aplicador', 700000, 100000, 'u-albanil'],
    ['19.012.345-6', 'Ayudante 1', 'Ayudante de Terreno', 550000, 50000, 'u-carpintero'],
    ['19.123.456-7', 'Ayudante 2', 'Ayudante de Terreno', 550000, 50000, 'u-soldador'],
    ['19.234.567-8', 'Ayudante 3', 'Ayudante de Terreno', 550000, 50000, null],
    ['19.345.678-9', 'Ayudante 4', 'Ayudante de Terreno', 550000, 50000, null],
    ['19.456.789-0', 'Ayudante 5', 'Ayudante de Terreno', 550000, 50000, null],
  ].map(([rut, nombre, cargo, sueldoBase, tratos, cuentaId], i) => {
    const imponible = sueldoBase + tratos
    return {
      id: `d-${i + 1}`,
      obraId: OBRA,
      rut,
      nombre,
      cargo,
      sueldoBase,
      tratos,
      diasTrab: 30,
      imponible,
      leyesSociales: Math.round(imponible * 0.3),
      costoMensual: Math.round(imponible * 1.3),
      proyectado145d: Math.round((imponible * 1.3 * 145) / 30),
      cuentaId,
      activo: true,
    }
  })

  // --- Reportes (ejecutado ~24% ponderado, coherente con EEPP N°2) ---
  const reportes = [
    reporte(OBRA, 'u-maestro1', 40, { [`${OBRA}-p1`]: 1600 }, 'Inicio Etapa 1, sector cubierta norte.'),
    reporte(OBRA, 'u-maestro1', 25, { [`${OBRA}-p1`]: 1400, [`${OBRA}-p5`]: 250 }, 'Continuidad cubierta E1 y primer tramo de vigas E2.'),
    reporte(OBRA, 'u-maestro1', 12, { [`${OBRA}-p1`]: 1400 }, 'Top coat sector centro.'),
    reporte(OBRA, 'u-maestro2', 38, { [`${OBRA}-p2`]: 600 }, 'Preparación y base coat cubierta E2.'),
    reporte(OBRA, 'u-maestro2', 20, { [`${OBRA}-p2`]: 500 }, 'Avance cubierta E2 poniente.'),
    reporte(OBRA, 'u-maestro2', 8, { [`${OBRA}-p2`]: 500 }, 'Cierre de tramo cubierta E2.'),
    reporte(OBRA, 'u-maestro3', 35, { [`${OBRA}-p3`]: 400 }, 'Alumanation 301 sector oriente.'),
    reporte(OBRA, 'u-maestro3', 18, { [`${OBRA}-p3`]: 400, [`${OBRA}-p7`]: 100 }, 'Segunda mano Tremco y canal E2.'),
    reporte(OBRA, 'u-maestro3', 10, { [`${OBRA}-p3`]: 300 }, 'Terminación sector TREMCO.'),
    reporte(OBRA, 'u-albanil', 28, { [`${OBRA}-p4`]: 250 }, 'Vigas E1 lado sur.'),
    reporte(OBRA, 'u-albanil', 16, { [`${OBRA}-p4`]: 300, [`${OBRA}-p6`]: 220 }, 'Vigas E1 y reparación canal E1.'),
    reporte(OBRA, 'u-carpintero', 11, { [`${OBRA}-p5`]: 250 }, 'Vigas E2, trabajo en altura.'),
    reporte(OBRA, 'u-carpintero', 9, { [`${OBRA}-p7`]: 100 }, 'Canal E2 tramo oriente.'),
    reporte(OBRA, 'u-soldador', 7, { [`${OBRA}-p8`]: 60 }, 'Primer tramo pasarelas SP-302.'),
    reporte(OBRA, 'u-soldador', 5, { [`${OBRA}-p8`]: 40 }, 'Barandas SR-401A tramo inicial.'),
    reporte(OBRA, 'u-albanil', 3, {}, 'Lluvia en la mañana, se suspende faena de cubierta.', true),
    // Hoy: solo 2 de 6 cuentas de terreno han reportado.
    reporte(OBRA, 'u-soldador', 0, { [`${OBRA}-p1`]: 120 }, 'Top coat cubierta E1, cuadrilla completa.'),
    reporte(OBRA, 'u-carpintero', 0, { [`${OBRA}-p6`]: 30 }, 'Reparación canal E1 sector acceso.'),
  ]

  const lineasReporte = []
  for (const r of reportes) {
    for (const [partidaId, cantidad] of Object.entries(r._lineas)) {
      if (cantidad > 0) lineasReporte.push({ id: id('lin'), reporteId: r.id, partidaId, cantidad })
    }
    delete r._lineas
  }

  const fotos = [
    { id: 'f-1', reporteId: reportes[0].id, nombre: 'cubierta-e1-base.jpg' },
    { id: 'f-2', reporteId: reportes[6].id, nombre: 'tremco-alumanation.jpg' },
  ]

  // --- Gastos (hoja REGISTRO_DIARIO_GG + compras de materiales + nómina) ---
  const gastos = [
    { id: 'g-1', obraId: OBRA, categoria: 'Arriendo Casa Operaciones', detalle: 'Arriendo Casa Futrono/Stgo Periodo 1', monto: 1890000, fecha: diasAtras(46), responsable: 'Claudio C.', revision: 'Aprobado' },
    { id: 'g-2', obraId: OBRA, categoria: 'Arriendo Departamento', detalle: 'Arriendo Depto Stgo Periodo 1', monto: 630000, fecha: diasAtras(44), responsable: 'Claudio C.', revision: 'Aprobado' },
    { id: 'g-3', obraId: OBRA, categoria: 'Almuerzos Cuadrilla y Personal', detalle: 'Almuerzos 23-08 a 31-08', monto: 885728, fecha: diasAtras(38), responsable: 'Lorenzo M.', revision: 'Aprobado' },
    { id: 'g-4', obraId: OBRA, categoria: 'Almuerzos Cuadrilla y Personal', detalle: 'Almuerzos 01-09 a 05-09', monto: 572985, fecha: diasAtras(33), responsable: 'Lorenzo M.', revision: 'Aprobado' },
    { id: 'g-5', obraId: OBRA, categoria: 'Cenas Cuadrilla y Personal', detalle: 'Cenas 24-08 a 30-08', monto: 595000, fecha: diasAtras(39), responsable: 'Lorenzo M.', revision: 'Aprobado' },
    { id: 'g-6', obraId: OBRA, categoria: 'Cenas Cuadrilla y Personal', detalle: 'Cenas 31-08 a 06-09', monto: 595000, fecha: diasAtras(32), responsable: 'Lorenzo M.', revision: 'Aprobado' },
    { id: 'g-7', obraId: OBRA, categoria: 'Cenas Cuadrilla y Personal', detalle: 'Cenas 07-09 a 13-09', monto: 595000, fecha: diasAtras(25), responsable: 'Lorenzo M.', revision: 'Aprobado' },
    { id: 'g-8', obraId: OBRA, categoria: 'Pasajes Santiago - Futrono - Osorno', detalle: 'Pasajes Futrono-Stgo / Osorno-Stgo', monto: 206150, fecha: diasAtras(46), responsable: 'Administración', revision: 'Aprobado' },
    { id: 'g-9', obraId: OBRA, categoria: 'Pasajes Santiago - Futrono - Osorno', detalle: 'Pasajes Pedro Miño', monto: 23800, fecha: diasAtras(38), responsable: 'Administración', revision: 'Aprobado' },
    { id: 'g-10', obraId: OBRA, categoria: 'Pasajes Santiago - Futrono - Osorno', detalle: 'Pasajes Stgo-Futrono / Stgo-Osorno', monto: 580810, fecha: diasAtras(22), responsable: 'Administración', revision: 'Aprobado' },
    { id: 'g-11', obraId: OBRA, categoria: 'Pasajes Santiago - Futrono - Osorno', detalle: 'Pasajes Futrono-Stgo / Osorno-Stgo', monto: 624840, fecha: diasAtras(18), responsable: 'Administración', revision: 'Aprobado' },
    { id: 'g-12', obraId: OBRA, categoria: 'Pasajes Santiago - Futrono - Osorno', detalle: 'Pasajes Rubén', monto: 63040, fecha: diasAtras(41), responsable: 'Administración', revision: 'Aprobado' },
    { id: 'g-13', obraId: OBRA, categoria: 'Caja Chica Lorenzo / Operaciones', detalle: 'Caja Chica Lorenzo Rendición 1', monto: 382487, fecha: diasAtras(41), responsable: 'Lorenzo M.', revision: 'Aprobado' },
    { id: 'g-14', obraId: OBRA, categoria: 'Materiales', detalle: 'Compras acumuladas de insumos (facturas)', monto: 118874165, fecha: diasAtras(30), responsable: 'Administración', revision: 'Aprobado' },
    { id: 'g-15', obraId: OBRA, categoria: 'Nómina Personal y Sueldos (145d)', detalle: 'Remuneraciones período en curso', monto: 19732000, fecha: diasAtras(15), responsable: 'Finanzas', revision: 'Aprobado' },
  ]

  // --- Techo de gastos generales por categoría (hoja GASTOS_GENERALES) ---
  const ggCategorias = [
    ['Arriendo Casa Operaciones', 143.54, 5669830],
    ['Arriendo Departamento', 47.85, 1890075],
    ['Almuerzos Cuadrilla y Personal', 145.82, 5759890],
    ['Cenas Cuadrilla y Personal', 90.38, 3570010],
    ['Pasajes Santiago - Futrono - Osorno', 50.63, 1999885],
    ['Caja Chica Lorenzo / Operaciones', 38, 1501000],
    ['Arriendo Alza Hombre y Equipos', 19.58, 773410],
    ['Tablero Eléctrico Provisorio', 5.9, 233050],
    ['Exámenes Altura Física e Inducción', 1.77, 69915],
    ['Nómina Personal y Sueldos (145d)', 1186.92, 46883340],
    ['Crédito / Garantía Grupo Patio', 308.82, 12198390],
  ].map(([categoria, techoUF, techoCLP], i) => ({
    id: `gg-${i + 1}`,
    obraId: OBRA,
    categoria,
    techoUF,
    techoCLP,
  }))

  // --- Materiales (hoja MATERIALES): requerido vs comprado ---
  const materiales = [
    ['15289-0', 'HYDRASEAL DPM KIT 10KG (2 Partes)', 'und', 1061, 160, 155125],
    ['19047-1', 'ALPHAGUARD BIO BASE COAT PART A 3.2 GL', 'und', 1573, 140, 129412],
    ['19119-0', 'ALPHAGUARD BIO BASE COAT PART B 0.8 GL', 'und', 1573, 140, 41843],
    ['20309-5', 'ALPHAGUARD BIO TOP COAT PART A 2.2 GL', 'und', 630, 85, 122565],
    ['24443-8', 'ALPHAGUARD BIO TOP COAT PART B 0.9 GL', 'und', 630, 85, 67133],
    ['25056-0', "PERMAFAB ROLLO 40' X 324' (93m²)", 'und', 296, 25, 237155],
    ['25338-0', 'VERSASPEED 100 CI SACO 20 KG', 'und', 312, 200, 34447],
    ['58784-3', 'TREMCO ALUMANATION 301 5 GLN (18.9L)', 'tnt', 162, 175, 145780],
    ['17425-0', 'DURAL AQUATIGHT 100 PLUS PART A', 'und', 0, 28, 96590],
    ['19041-9', 'DURAL AQUATIGHT 100 PLUS PART B', 'und', 0, 28, 102380],
    ['94419-1', 'VULKEM 350 NF SL GRIS 5 GL (18.9L)', 'tnt', 0, 15, 115600],
    ['06307-3', 'CAVE DYMANIC 100 BLANCO 600 ML', 'und', 0, 225, 6328],
    ['95399-3', "CAVE PERMAFAB TELA POLIÉSTER 4'X300'", 'und', 36, 200, 34477],
    ['PAS-302', 'PASARELA SP-302 GALVANIZADA DOBLE 450mm', 'ml', 810, 0, 165000],
    ['BAR-401', 'BARANDA SR-401A h=1.0m (Ambos Costados)', 'ml', 810, 0, 42000],
    ['ANC-810', 'PERNOS Y PLACAS DE ANCLAJE PASARELA', 'gl', 810, 0, 12000],
  ].map(([codigo, descripcion, unidad, requerida, comprada, pUnitNeto], i) => ({
    id: `mat-${i + 1}`,
    obraId: OBRA,
    codigo,
    descripcion,
    unidad,
    requerida,
    comprada,
    faltante: Math.max(0, requerida - comprada),
    pUnitNeto,
    costoComprado: comprada * pUnitNeto,
  }))

  // --- Estados de pago (hoja ESTADOS_DE_PAGO) ---
  const estadosPago = [
    { id: 'ep-1', obraId: OBRA, numero: 'EEPP N° 1', fechaPresentacion: diasAtras(36), avanceParcial: 0.1, avanceAcumulado: 0.1, brutoUF: 3189.44, retencionUF: 159.47, netoUF: 3029.97, netoCLP: 119683815, estado: 'Pagado' },
    { id: 'ep-2', obraId: OBRA, numero: 'EEPP N° 2', fechaPresentacion: diasAtras(6), avanceParcial: 0.143, avanceAcumulado: 0.243, brutoUF: 4517.98, retencionUF: 225.9, netoUF: 4292.08, netoCLP: 169537160, estado: 'En aprobación Grupo Patio' },
  ]

  const auditoria = [
    { id: 'a-1', obraId: OBRA, usuarioId: 'u-mauricio', fecha: diasAtras(52), descripcion: 'Obra activada: línea base protegida (8 partidas, contrato 508-E-2026).' },
    { id: 'a-2', obraId: OBRA, usuarioId: 'u-jeannette', fecha: diasAtras(36), descripcion: 'Estado de pago EEPP N° 1 presentado y pagado (10% avance).' },
  ]

  return {
    version: 5,
    sembradoEn: hoy,
    organizacion,
    usuarios,
    obras,
    partidas,
    membresias,
    dotacion,
    planDias,
    reportes,
    lineasReporte,
    fotos,
    gastos,
    ggCategorias,
    materiales,
    estadosPago,
    auditoria,
  }
}
