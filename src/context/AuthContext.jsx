import { useEffect, useState, useCallback } from 'react'
import { login as apiLogin } from '../lib/api.js'
import { AuthContext } from './auth.js'

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    const crudo = localStorage.getItem('ea-usuario')
    return crudo ? JSON.parse(crudo) : null
  })

  const login = useCallback(async (usuarioNombre, password) => {
    const { usuario: u, token } = await apiLogin(usuarioNombre, password)
    localStorage.setItem('ea-token', token)
    localStorage.setItem('ea-usuario', JSON.stringify(u))
    setUsuario(u)
    return u
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('ea-token')
    localStorage.removeItem('ea-usuario')
    sessionStorage.removeItem('ea-token')
    setUsuario(null)
  }, [])

  // Sincroniza sesión entre pestañas.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'ea-usuario') setUsuario(e.newValue ? JSON.parse(e.newValue) : null)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return (
    <AuthContext.Provider value={{ usuario, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
