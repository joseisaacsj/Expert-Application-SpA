const ROLES_TEXTO = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  jefe_cuadrilla: 'Jefe de cuadrilla',
  trabajador: 'Trabajador',
  rrhh: 'RRHH',
}

export function rolTexto(rol) {
  return ROLES_TEXTO[rol] || rol
}
