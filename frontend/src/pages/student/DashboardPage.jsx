import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { licenciaService, reincorporacionService, reporteService, notifService } from '../../services'
import { FileText, RotateCcw, Bell, Users, BarChart2, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { StatusBadge, LoadingPage } from '../../components/common'
import { formatDate, formatMoney } from '../../utils'

function StatCard({ label, value, icon: Icon, color = 'primary' }) {
  const colors = {
    primary: 'bg-primary-50 text-primary-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
  }
  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-xl ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}

function RecentItem({ codigo, tipo, status, fecha, to }) {
  return (
    <Link to={to} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
      <div>
        <p className="text-sm font-medium text-gray-900">{codigo}</p>
        <p className="text-xs text-gray-400">{tipo} · {formatDate(fecha)}</p>
      </div>
      <StatusBadge status={status} />
    </Link>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({})

  useEffect(() => {
    const load = async () => {
      try {
        if (user.role === 'estudiante') {
          const [lic, rei, notif] = await Promise.all([
            licenciaService.getMias(),
            reincorporacionService.getMias(),
            notifService.getMias(),
          ])
          setData({
            licencias: lic.data,
            reincorporaciones: rei.data,
            notificaciones: notif.data.no_leidas || 0,
          })
        } else if (user.role === 'admin_sistema') {
          const { data: metricas } = await reporteService.metricas()
          setData({ metricas })
        } else {
          const [lic, rei] = await Promise.all([
            licenciaService.getBandejaCoordinador(),
            reincorporacionService.getBandejaCoordinador(),
          ])
          setData({ licencias: lic.data, reincorporaciones: rei.data })
        }
      } catch { /* silencioso */ }
      finally { setLoading(false) }
    }
    load()
  }, [user])

  if (loading) return <LoadingPage />

  if (user.role === 'admin_sistema' && data.metricas) {
    const m = data.metricas
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Panel de administración</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total licencias" value={m.total_licencias} icon={FileText} />
          <StatCard label="Total reincorp." value={m.total_reincorporaciones} icon={RotateCcw} color="green" />
          <StatCard label="Usuarios" value={m.total_usuarios} icon={Users} color="yellow" />
          <StatCard label="Ingresos totales" value={formatMoney(m.ingresos_totales)} icon={BarChart2} color="primary" />
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Licencias por estado</h2>
            <div className="space-y-2">
              {Object.entries(m.licencias_por_estado || {}).map(([estado, count]) => (
                <div key={estado} className="flex justify-between items-center">
                  <StatusBadge status={estado} />
                  <span className="font-medium text-gray-700">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Reincorporaciones por estado</h2>
            <div className="space-y-2">
              {Object.entries(m.reincorporaciones_por_estado || {}).map(([estado, count]) => (
                <div key={estado} className="flex justify-between items-center">
                  <StatusBadge status={estado} />
                  <span className="font-medium text-gray-700">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (user.role === 'estudiante') {
    const pendientes = [...(data.licencias?.items || []), ...(data.reincorporaciones?.items || [])].filter(
      t => !['aprobado', 'rechazado', 'anulado', 'caducado'].includes(t.status)
    )
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Hola, {user.nombres} 👋</h1>
        <p className="text-gray-500 mb-6 text-sm">{user.carrera} · Ciclo {user.ciclo_actual}</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <StatCard label="Licencias" value={data.licencias?.total || 0} icon={FileText} />
          <StatCard label="Reincorporaciones" value={data.reincorporaciones?.total || 0} icon={RotateCcw} color="green" />
          <StatCard label="Notif. sin leer" value={data.notificaciones || 0} icon={Bell} color="yellow" />
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Trámites activos</h2>
              <span className="text-xs text-gray-400">{pendientes.length} pendientes</span>
            </div>
            {pendientes.length === 0
              ? <p className="text-gray-400 text-sm text-center py-4">Sin trámites activos</p>
              : pendientes.slice(0, 5).map(t => (
                <RecentItem
                  key={t.id} codigo={t.codigo}
                  tipo={t.motivo ? 'Licencia' : 'Reincorporación'}
                  status={t.status} fecha={t.created_at}
                  to={t.motivo ? `/licencias/${t.id}` : `/reincorporaciones/${t.id}`}
                />
              ))
            }
          </div>
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Acciones rápidas</h2>
            <div className="space-y-3">
              <Link to="/licencias/nueva" className="flex items-center gap-3 p-3 border-2 border-dashed border-primary-200 hover:border-primary-400 rounded-xl transition-colors group">
                <div className="p-2 bg-primary-50 rounded-lg group-hover:bg-primary-100">
                  <FileText className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Solicitar licencia</p>
                  <p className="text-xs text-gray-400">Ausencia por motivos personales o de salud</p>
                </div>
              </Link>
              <Link to="/reincorporaciones/nueva" className="flex items-center gap-3 p-3 border-2 border-dashed border-green-200 hover:border-green-400 rounded-xl transition-colors group">
                <div className="p-2 bg-green-50 rounded-lg group-hover:bg-green-100">
                  <RotateCcw className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Solicitar reincorporación</p>
                  <p className="text-xs text-gray-400">Retornar a actividades académicas</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Coordinador / Admin académico
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Bandeja de revisión</h1>
      <div className="grid grid-cols-2 gap-4 mb-8">
        <StatCard label="Licencias pendientes" value={data.licencias?.total || 0} icon={FileText} color="yellow" />
        <StatCard label="Reincorp. pendientes" value={data.reincorporaciones?.total || 0} icon={RotateCcw} color="yellow" />
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Licencias por revisar</h2>
          {(data.licencias?.items || []).slice(0, 5).map(l => (
            <RecentItem key={l.id} codigo={l.codigo} tipo="Licencia" status={l.status} fecha={l.created_at} to="/bandeja/licencias" />
          ))}
          {(data.licencias?.total > 0) && <Link to="/bandeja/licencias" className="text-xs text-primary-600 mt-2 block text-center">Ver todas →</Link>}
        </div>
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Reincorporaciones por revisar</h2>
          {(data.reincorporaciones?.items || []).slice(0, 5).map(r => (
            <RecentItem key={r.id} codigo={r.codigo} tipo="Reincorporación" status={r.status} fecha={r.created_at} to="/bandeja/reincorporaciones" />
          ))}
          {(data.reincorporaciones?.total > 0) && <Link to="/bandeja/reincorporaciones" className="text-xs text-primary-600 mt-2 block text-center">Ver todas →</Link>}
        </div>
      </div>
    </div>
  )
}
