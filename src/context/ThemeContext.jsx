import { useEffect, useState } from 'react'
import { ThemeContext } from './theme.js'

function temaInicial() {
  const guardado = localStorage.getItem('ea-tema')
  if (guardado === 'claro' || guardado === 'oscuro') return guardado
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro'
}

export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(temaInicial)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'oscuro')
    localStorage.setItem('ea-tema', tema)
  }, [tema])

  const alternarTema = () => setTema((t) => (t === 'oscuro' ? 'claro' : 'oscuro'))

  return (
    <ThemeContext.Provider value={{ tema, alternarTema }}>
      {children}
    </ThemeContext.Provider>
  )
}
