import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { notifService, authService } from '../services'
import { useAuth } from '../context/AuthContext'
import { LoadingPage, PageHeader, EmptyState, Pagination } from '../components/common'
import { formatDateTime, getErrorMessage, ROLE_LABELS } from '../utils'
import { Bell, CheckCheck, User, Shield, Filter, X } from 'lucide-react'
import toast from 'react-hot-toast'

const TIPO_LABELS = {
  tramite_recibido: 'Trámite recibido',
  cambio_estado: 'Cambio de estado',
  pago_confirmado: 'Pago confirmado',
  pago_caducado: 'Pago caducado',
  tramite_aprobado: 'Trámite aprobado',
  tramite_rechazado: 'Trámite rechazado',
  tramite_anulado: 'Trámite anulado',
  reincorporacion_sincronizada: 'Reincorporación sincronizada',
}

const PAGE_SIZE = 10

// ── Notificaciones ────────────────────────────────────────────────────────────
export function NotificacionesPage() {
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1, no_leidas: 0 })

  // Filtros
  const [tipo, setTipo] = useState('')
  const [leida, setLeida] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [filtersVisible, setFiltersVisible] = useState(false)

  const hasFilters = tipo || leida !== '' || fechaDesde || fechaHasta

  const buildParams = (currentPage = page) => {
    const p = { page: currentPage, page_size: PAGE_SIZE }
    if (tipo) p.tipo = tipo
    if (leida !== '') p.leida = leida === 'true'
    if (fechaDesde) p.fecha_inicio = fechaDesde
    if (fechaHasta) p.fecha_fin = fechaHasta
    return p
  }

  const load = async (currentPage = 1) => {
    setLoading(true)
    try {
      const { data } = await notifService.getMias(buildParams(currentPage))
      setNotifs(data.items)
      setPagination({
        total: data.total,
        total_pages: data.total_pages,
        no_leidas: data.no_leidas,
      })
    } catch { /* silencioso */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1) }, [tipo, leida, fechaDesde, fechaHasta])

  const handlePageChange = (newPage) => {
    setPage(newPage)
    load(newPage)
  }

  const handleClearFilters = () => {
    setTipo('')
    setLeida('')
    setFechaDesde('')
    setFechaHasta('')
    setPage(1)
  }

  const marcarLeida = async (id) => {
    await notifService.marcarLeida(id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
    setPagination(prev => ({ ...prev, no_leidas: Math.max(0, prev.no_leidas - 1) }))
  }

  const marcarTodas = async () => {
    await notifService.marcarTodasLeidas()
    toast.success('Todas marcadas como leídas')
    load(page)
  }

  return (
    <div>
      <PageHeader
        title="Notificaciones"
        subtitle={`${pagination.no_leidas} sin leer`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setFiltersVisible(v => !v)}
              className={`btn-secondary flex items-center gap-2 text-sm ${filtersVisible ? 'bg-gray-100' : ''}`}
            >
              <Filter className="w-4 h-4" /> Filtros
              {hasFilters && <span className="w-2 h-2 bg-primary-500 rounded-full" />}
            </button>
            {pagination.no_leidas > 0 && (
              <button onClick={marcarTodas} className="btn-secondary flex items-center gap-2 text-sm">
                <CheckCheck className="w-4 h-4" /> Marcar todas como leídas
              </button>
            )}
          </div>
        }
      />

      {/* Panel de filtros */}
      {filtersVisible && (
        <div className="card mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">Filtrar notificaciones</span>
            {hasFilters && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                <X className="w-3 h-3" /> Limpiar
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <select value={tipo} onChange={e => { setTipo(e.target.value); setPage(1) }} className="input text-sm">
              <option value="">Todos los tipos</option>
              {Object.entries(TIPO_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <select value={leida} onChange={e => { setLeida(e.target.value); setPage(1) }} className="input text-sm">
              <option value="">Todas</option>
              <option value="false">No leídas</option>
              <option value="true">Leídas</option>
            </select>
            <input
              type="date"
              value={fechaDesde}
              onChange={e => { setFechaDesde(e.target.value); setPage(1) }}
              className="input text-sm"
              title="Fecha desde"
            />
            <input
              type="date"
              value={fechaHasta}
              onChange={e => { setFechaHasta(e.target.value); setPage(1) }}
              className="input text-sm"
              title="Fecha hasta"
            />
          </div>
        </div>
      )}

      {loading
        ? <LoadingPage />
        : notifs.length === 0
          ? <EmptyState title="Sin notificaciones" icon={Bell} />
          : (
            <div className="space-y-2">
              {notifs.map(n => (
                <div
                  key={n.id}
                  onClick={() => !n.leida && marcarLeida(n.id)}
                  className={`card cursor-pointer transition-all ${!n.leida ? 'border-l-4 border-l-primary-500 bg-primary-50/30' : 'opacity-70'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-gray-900 text-sm">{n.titulo}</p>
                        {n.tipo && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                            {TIPO_LABELS[n.tipo] || n.tipo}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 text-sm">{n.mensaje}</p>
                      <p className="text-xs text-gray-400 mt-2">{formatDateTime(n.created_at)}</p>
                    </div>
                    {!n.leida && <div className="w-2 h-2 bg-primary-500 rounded-full mt-1 ml-3 flex-shrink-0" />}
                  </div>
                </div>
              ))}
            </div>
          )
      }

      <Pagination
        page={page}
        totalPages={pagination.total_pages}
        total={pagination.total}
        onChange={handlePageChange}
      />
    </div>
  )
}

// ── Perfil ────────────────────────────────────────────────────────────────────
export function PerfilPage() {
  const { user, updateUser } = useAuth()
  const [tab, setTab] = useState('info')
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({ defaultValues: user })
  const { register: regPass, handleSubmit: handlePass, reset: resetPass, formState: { isSubmitting: isSubmittingPass } } = useForm()
  const [totpSetup, setTotpSetup] = useState(null)
  const [totpCode, setTotpCode] = useState('')

  const onUpdateInfo = async (data) => {
    try {
      const { data: updated } = await authService.updateMe(data)
      updateUser(updated)
      toast.success('Perfil actualizado')
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  const onChangePass = async (data) => {
    try {
      await authService.changePassword(data)
      toast.success('Contraseña actualizada')
      resetPass()
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  const setupTotp = async () => {
    try {
      const { data } = await authService.setupTOTP()
      setTotpSetup(data)
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  const confirmTotp = async () => {
    try {
      await authService.confirmTOTP(totpCode)
      toast.success('2FA habilitado exitosamente')
      setTotpSetup(null)
      updateUser({ totp_habilitado: true })
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  return (
    <div>
      <PageHeader title="Mi perfil" />

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {[['info', 'Información', User], ['seguridad', 'Seguridad', Shield]].map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="card max-w-2xl">
          {/* Header perfil */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b">
            <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center text-primary-700 text-2xl font-bold">
              {user?.nombres?.[0]}{user?.apellidos?.[0]}
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{user?.nombres} {user?.apellidos}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
              <span className="badge bg-primary-100 text-primary-700 mt-1">{ROLE_LABELS[user?.role]}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit(onUpdateInfo)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Nombres</label>
                <input {...register('nombres')} className="input" />
              </div>
              <div>
                <label className="label">Apellidos</label>
                <input {...register('apellidos')} className="input" />
              </div>
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input {...register('telefono')} className="input" type="tel" />
            </div>
            {user?.role === 'estudiante' && (
              <>
                <div>
                  <label className="label">Carrera</label>
                  <input {...register('carrera')} className="input" />
                </div>
                <div>
                  <label className="label">Ciclo actual</label>
                  <input {...register('ciclo_actual')} className="input" />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
                  <div><span className="label">Código estudiante</span><p className="font-medium text-gray-800">{user?.codigo_estudiante}</p></div>
                  <div><span className="label">Año matrícula</span><p className="font-medium text-gray-800">{user?.anno_matricula}</p></div>
                </div>
              </>
            )}
            <div className="flex justify-end">
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === 'seguridad' && (
        <div className="space-y-6 max-w-2xl">
          {/* Cambiar contraseña */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Cambiar contraseña</h2>
            <form onSubmit={handlePass(onChangePass)} className="space-y-4">
              <div>
                <label className="label">Contraseña actual</label>
                <input {...regPass('current_password', { required: true })} type="password" className="input" />
              </div>
              <div>
                <label className="label">Nueva contraseña</label>
                <input {...regPass('new_password', { required: true, minLength: 8 })} type="password" className="input" />
              </div>
              <div>
                <label className="label">Confirmar contraseña</label>
                <input {...regPass('confirm_password', { required: true })} type="password" className="input" />
              </div>
              <div className="flex justify-end">
                <button type="submit" className="btn-primary" disabled={isSubmittingPass}>
                  {isSubmittingPass ? 'Actualizando...' : 'Actualizar contraseña'}
                </button>
              </div>
            </form>
          </div>

          {/* 2FA */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-2">Autenticación de dos pasos</h2>
            {user?.totp_habilitado ? (
              <div className="flex items-center gap-2 text-green-600">
                <Shield className="w-5 h-5" />
                <span className="text-sm font-medium">2FA habilitado — tu cuenta está protegida</span>
              </div>
            ) : totpSetup ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Escanea este código QR con tu app autenticadora (Google Authenticator, Authy):</p>
                <img src={totpSetup.qr_url} alt="QR 2FA" className="w-40 h-40 border rounded-lg" />
                <div>
                  <label className="label">Código de verificación</label>
                  <input value={totpCode} onChange={e => setTotpCode(e.target.value)} className="input" maxLength={6} placeholder="000000" />
                </div>
                <button onClick={confirmTotp} className="btn-primary">Activar 2FA</button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500 mb-3">Agrega una capa extra de seguridad a tu cuenta.</p>
                <button onClick={setupTotp} className="btn-secondary">Configurar 2FA</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
