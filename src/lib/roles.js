const ROLES_TEXTO = {
  admin: 'Administración',
  supervisor: 'Supervisor de Obras',
  trabajador: 'Trabajador',
  rrhh: 'RRHH',
  finanzas: 'Finanzas',
}

export function rolTexto(rol) {
  return ROLES_TEXTO[rol] || rol
}
