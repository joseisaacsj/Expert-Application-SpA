// URL base centralizada del backend. Cuando exista el backend PHP real,
// solo se cambia esta constante (y la implementación de src/lib/api.js
// pasará de la capa simulada a fetch()).
export const API_BASE_URL = 'http://localhost/backend'

export const API_ENDPOINTS = {
  login: `${API_BASE_URL}/login.php`,
  obras: `${API_BASE_URL}/obras.php`,
  reportes: `${API_BASE_URL}/reportes.php`,
  usuarios: `${API_BASE_URL}/usuarios.php`,
}
