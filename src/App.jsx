import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { useAuth } from './context/auth.js'
import { ThemeProvider } from './context/ThemeContext.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Tablero from './pages/Tablero.jsx'
import ObraDetalle from './pages/ObraDetalle.jsx'
import CrearObra from './pages/CrearObra.jsx'
import ReporteDiario from './pages/ReporteDiario.jsx'
import RRHH from './pages/RRHH.jsx'
import Administracion from './pages/Administracion.jsx'

function RutaProtegida({ children }) {
  const { usuario } = useAuth()
  const location = useLocation()
  if (!usuario) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

function SoloAdmin({ children }) {
  const { usuario } = useAuth()
  if (usuario?.rolGlobal !== 'admin') return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <RutaProtegida>
                  <Layout />
                </RutaProtegida>
              }
            >
              <Route path="/" element={<Tablero />} />
              <Route path="/obras/nueva" element={<CrearObra />} />
              <Route path="/obras/:id" element={<ObraDetalle />} />
              <Route path="/reporte" element={<ReporteDiario />} />
              <Route path="/reporte/:obraId" element={<ReporteDiario />} />
              <Route path="/rrhh" element={<RRHH />} />
              <Route
                path="/admin"
                element={
                  <SoloAdmin>
                    <Administracion />
                  </SoloAdmin>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
