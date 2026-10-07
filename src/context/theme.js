import { createContext, useContext } from 'react'

export const ThemeContext = createContext(null)

export function useTema() {
  return useContext(ThemeContext)
}
