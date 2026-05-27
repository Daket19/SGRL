import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LoadingPage } from './components/common'
import Layout from './components/common/Layout'

// Auth
import { LoginPage, RegisterPage, ForgotPasswordPage } from './pages/auth/AuthPages'

// Páginas
import DashboardPage from './pages/student/DashboardPage'
import { LicenciasListPage, NuevaLicenciaPage, DetalleLicenciaPage } from './pages/student/LicenciasPages'
import {
  ReincorporacionesListPage, NuevaReincorporacionPage, DetalleReincorporacionPage,
  BandejaLicenciasPage, BandejaReincorporacionesPage,
  UsuariosPage, ReportesPage,
} from './pages/OtrasPages'
import TramitesAdminPage from './pages/TramitesAdminPage'
import { NotificacionesPage, PerfilPage } from './pages/NotificacionesPerfil'

function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingPage />
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />
  return children
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingPage />

  return (
    <Routes>
      {/* Públicas */}
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/verificar-email" element={<div className="p-8 text-center">Verificando correo...</div>} />

      {/* Protegidas */}
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="perfil" element={<PerfilPage />} />
        <Route path="notificaciones" element={<NotificacionesPage />} />

        {/* Estudiante */}
        <Route path="licencias" element={<RequireAuth roles={['estudiante']}><LicenciasListPage /></RequireAuth>} />
        <Route path="licencias/nueva" element={<RequireAuth roles={['estudiante']}><NuevaLicenciaPage /></RequireAuth>} />
        <Route path="licencias/:id" element={<RequireAuth roles={['estudiante']}><DetalleLicenciaPage /></RequireAuth>} />
        <Route path="reincorporaciones" element={<RequireAuth roles={['estudiante']}><ReincorporacionesListPage /></RequireAuth>} />
        <Route path="reincorporaciones/nueva" element={<RequireAuth roles={['estudiante']}><NuevaReincorporacionPage /></RequireAuth>} />
        <Route path="reincorporaciones/:id" element={<RequireAuth roles={['estudiante']}><DetalleReincorporacionPage /></RequireAuth>} />

        {/* Coordinador */}
        <Route path="bandeja/licencias" element={<RequireAuth roles={['coordinador', 'admin_academico']}><BandejaLicenciasPage role={user?.role} /></RequireAuth>} />
        <Route path="bandeja/reincorporaciones" element={<RequireAuth roles={['coordinador', 'admin_academico']}><BandejaReincorporacionesPage role={user?.role} /></RequireAuth>} />

        {/* Admin sistema */}
        <Route path="tramites" element={<RequireAuth roles={['admin_sistema']}><TramitesAdminPage /></RequireAuth>} />
        <Route path="usuarios" element={<RequireAuth roles={['admin_sistema']}><UsuariosPage /></RequireAuth>} />
        <Route path="reportes" element={<RequireAuth roles={['admin_sistema']}><ReportesPage /></RequireAuth>} />
        <Route path="notificaciones" element={<NotificacionesPage />} />
        <Route path="perfil" element={<PerfilPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster position="top-right" toastOptions={{ duration: 4000, style: { borderRadius: '12px', fontSize: '14px' } }} />
      </BrowserRouter>
    </AuthProvider>
  )
}
