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
import RegistroProduccion from './pages/RegistroProduccion.jsx'
import Planificacion from './pages/Planificacion.jsx'
import Presupuesto from './pages/Presupuesto.jsx'
import APU from './pages/APU.jsx'
import Materiales from './pages/Materiales.jsx'
import Finanzas from './pages/Finanzas.jsx'

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
              <Route path="/obras/:id/registro" element={<RegistroProduccion />} />
              <Route path="/obras/:id/planificacion" element={<Planificacion />} />
              <Route path="/obras/:id/presupuesto" element={<Presupuesto />} />
              <Route path="/obras/:id/apu" element={<APU />} />
              <Route path="/obras/:id/materiales" element={<Materiales />} />
              <Route path="/obras/:id/finanzas" element={<Finanzas />} />
              <Route path="/obras/:id/rrhh" element={<RRHH />} />
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
