import { useState } from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, FileText, RotateCcw, Bell, Users,
  BarChart2, LogOut, Menu, X, User, ChevronDown, Settings,
} from 'lucide-react'
import { ROLE_LABELS } from '../../utils'
import Chatbot from '../chatbot/Chatbot'

const NAV_BY_ROLE = {
  estudiante: [
    { label: 'Inicio', icon: LayoutDashboard, to: '/dashboard' },
    { label: 'Mis licencias', icon: FileText, to: '/licencias' },
    { label: 'Mis reincorporaciones', icon: RotateCcw, to: '/reincorporaciones' },
    { label: 'Notificaciones', icon: Bell, to: '/notificaciones' },
    { label: 'Mi perfil', icon: User, to: '/perfil' },
  ],
  coordinador: [
    { label: 'Inicio', icon: LayoutDashboard, to: '/dashboard' },
    { label: 'Bandeja licencias', icon: FileText, to: '/bandeja/licencias' },
    { label: 'Bandeja reincorp.', icon: RotateCcw, to: '/bandeja/reincorporaciones' },
    { label: 'Notificaciones', icon: Bell, to: '/notificaciones' },
    { label: 'Mi perfil', icon: User, to: '/perfil' },
  ],
  admin_academico: [
    { label: 'Inicio', icon: LayoutDashboard, to: '/dashboard' },
    { label: 'Bandeja licencias', icon: FileText, to: '/bandeja/licencias' },
    { label: 'Bandeja reincorp.', icon: RotateCcw, to: '/bandeja/reincorporaciones' },
    { label: 'Notificaciones', icon: Bell, to: '/notificaciones' },
    { label: 'Mi perfil', icon: User, to: '/perfil' },
  ],
  admin_sistema: [
    { label: 'Inicio', icon: LayoutDashboard, to: '/dashboard' },
    { label: 'Trámites', icon: FileText, to: '/tramites' },
    { label: 'Usuarios', icon: Users, to: '/usuarios' },
    { label: 'Reportes', icon: BarChart2, to: '/reportes' },
    { label: 'Notificaciones', icon: Bell, to: '/notificaciones' },
    { label: 'Mi perfil', icon: User, to: '/perfil' },
  ],
}

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navItems = NAV_BY_ROLE[user?.role] || []

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex flex-col
        transform transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">SGRL</p>
            <p className="text-xs text-gray-400">Gestión académica</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* User info */}
        <div className="px-4 py-3 mx-3 mt-3 bg-primary-50 rounded-xl">
          <p className="text-sm font-medium text-primary-900">{user?.nombres} {user?.apellidos}</p>
          <p className="text-xs text-primary-600">{ROLE_LABELS[user?.role]}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ label, icon: Icon, to }) => {
            const active = location.pathname === to || location.pathname.startsWith(to + '/')
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Overlay móvil */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 lg:px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1">
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1" />
          <Link to="/notificaciones" className="p-2 hover:bg-gray-100 rounded-lg">
            <Bell className="w-5 h-5 text-gray-600" />
          </Link>
          <Link to="/perfil" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-xs">
              {user?.nombres?.[0]}{user?.apellidos?.[0]}
            </div>
          </Link>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Chatbot flotante */}
      <Chatbot />
    </div>
  )
}
