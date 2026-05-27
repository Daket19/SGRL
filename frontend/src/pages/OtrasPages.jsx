import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { reincorporacionService, licenciaService, usuarioService, reporteService, pagoService } from '../services'
import { StatusBadge, PageHeader, LoadingPage, EmptyState, Modal, ConfirmModal, FormField, FiltrosTramites, Pagination } from '../components/common'
import { formatDate, formatDateTime, formatMoney, downloadBlob, getErrorMessage, ROLE_LABELS } from '../utils'
import { RotateCcw, ChevronLeft, Users, BarChart2, Download, Search, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const PAGE_SIZE = 10

// ── Reincorporaciones (estudiante) ────────────────────────────────────────────
export function ReincorporacionesListPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState(null)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1 })
  const [filters, setFilters] = useState({})

  const load = async (currentPage = 1, currentFilters = {}) => {
    setLoading(true)
    try {
      const { data } = await reincorporacionService.getMias({ page: currentPage, page_size: PAGE_SIZE, ...currentFilters })
      setItems(data.items)
      setPagination({ total: data.total, total_pages: data.total_pages })
    } catch { /* silencioso */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1, {}) }, [])

  const handleApply = (newFilters) => {
    setFilters(newFilters)
    setPage(1)
    load(1, newFilters)
  }

  const handlePageChange = (newPage) => {
    setPage(newPage)
    load(newPage, filters)
  }

  const handleDelete = async () => {
    try {
      await reincorporacionService.eliminar(deleteId)
      toast.success('Reincorporación eliminada')
      setDeleteId(null)
      load(page, filters)
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  if (loading) return <LoadingPage />

  return (
    <div>
      <PageHeader
        title="Mis reincorporaciones"
        actions={<Link to="/reincorporaciones/nueva" className="btn-primary flex items-center gap-2"><RotateCcw className="w-4 h-4" /> Nueva</Link>}
      />
      <FiltrosTramites onApply={handleApply} showCarrera={false} />
      {items.length === 0
        ? <EmptyState title="Sin reincorporaciones" description="Solicita tu primera reincorporación" icon={RotateCcw} />
        : items.map(r => (
          <div key={r.id} className="card flex items-center justify-between hover:border-primary-200 mb-3">
            <Link to={`/reincorporaciones/${r.id}`} className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{r.codigo}</p>
              <p className="text-sm text-gray-500">Ciclo de retorno: {r.ciclo_retorno}</p>
              <p className="text-xs text-gray-400 mt-1">Creada: {formatDate(r.created_at)}</p>
            </Link>
            <div className="flex items-center gap-3 ml-3">
              <StatusBadge status={r.status} />
              {r.status === 'borrador' && (
                <button onClick={e => { e.preventDefault(); setDeleteId(r.id) }} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))
      }
      <Pagination page={page} totalPages={pagination.total_pages} total={pagination.total} onChange={handlePageChange} />
      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar reincorporación"
        description="¿Seguro que deseas eliminar esta reincorporación en borrador? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
      />
    </div>
  )
}

export function NuevaReincorporacionPage() {
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm()

  const onSubmit = async (data) => {
    try {
      const { data: rei } = await reincorporacionService.crear({ ...data, tipo: 'post_licencia' })
      toast.success('Reincorporación creada.')
      navigate(`/reincorporaciones/${rei.id}`)
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  return (
    <div>
      <Link to="/reincorporaciones" className="flex items-center gap-1 text-sm text-gray-500 mb-4"><ChevronLeft className="w-4 h-4" /> Volver</Link>
      <PageHeader title="Solicitar reincorporación" />
      <div className="card max-w-2xl">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5 text-sm text-blue-800">
          Para solicitar tu reincorporación necesitas el número de tu Resolución Directoral, la cual fue emitida cuando tu licencia de estudios fue aprobada.
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <FormField label="N° Resolución Directoral" required error={errors.numero_rd?.message}>
            <input {...register('numero_rd', { required: 'Requerido' })} className="input" placeholder="Ej: RD-2024-001" />
          </FormField>
          <FormField label="Ciclo de retorno" required error={errors.ciclo_retorno?.message}>
            <input {...register('ciclo_retorno', { required: 'Requerido' })} className="input" placeholder="Ej: 2025-1" />
          </FormField>
          <div className="flex gap-3 justify-end">
            <Link to="/reincorporaciones" className="btn-secondary">Cancelar</Link>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Crear solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function DetalleReincorporacionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [rei, setRei] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pagoModal, setPagoModal] = useState(false)
  const [docModal, setDocModal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = () => reincorporacionService.getById(id).then(({ data }) => setRei(data)).finally(() => setLoading(false))
  useEffect(() => { load() }, [id])

  const handleDelete = async () => {
    try {
      await reincorporacionService.eliminar(id)
      toast.success('Reincorporación eliminada')
      navigate('/reincorporaciones')
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  if (loading) return <LoadingPage />
  if (!rei) return <div className="card">No encontrada</div>

  return (
    <div>
      <Link to="/reincorporaciones" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ChevronLeft className="w-4 h-4" /> Volver
      </Link>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{rei.codigo}</h1>
          <p className="text-gray-500 text-sm mt-1">Reincorporación — Post licencia de estudios</p>
        </div>
        <StatusBadge status={rei.status} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Información del trámite</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-gray-500">N° Resolución Directoral</dt><dd className="font-medium">{rei.numero_rd}</dd></div>
              <div><dt className="text-gray-500">Ciclo de retorno</dt><dd className="font-medium">{rei.ciclo_retorno}</dd></div>
              {rei.habilitado_inscripcion === 'si' && (
                <div className="col-span-2">
                  <dt className="text-gray-500">Estado en plataforma</dt>
                  <dd className="font-medium text-green-600">✓ Habilitado para inscripción y cobros</dd>
                </div>
              )}
            </dl>
          </div>

          {rei.resolucion_admin && (
            <div className="card border-l-4 border-l-primary-500">
              <h2 className="font-semibold text-gray-900 mb-2">Resolución</h2>
              <p className="text-sm text-gray-700">{rei.resolucion_admin}</p>
              {rei.numero_resolucion && <p className="text-xs text-gray-400 mt-2">N° {rei.numero_resolucion} · {formatDate(rei.fecha_resolucion)}</p>}
            </div>
          )}

          {rei.dictamen_coordinador && (
            <div className="card bg-purple-50 border-purple-100">
              <h2 className="font-semibold text-purple-900 mb-2">Dictamen del coordinador</h2>
              <p className="text-sm text-purple-800">{rei.dictamen_coordinador}</p>
            </div>
          )}

          {rei.status === 'rechazado_coordinador' && (
            <div className="card bg-orange-50 border-orange-200">
              <p className="text-sm text-orange-800 font-medium">Tu solicitud fue rechazada por el coordinador. Sube el documento correcto para continuar.</p>
            </div>
          )}

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Documentos adjuntos</h2>
              {!['aprobado', 'rechazado', 'anulado', 'caducado'].includes(rei.status) && (
                <button onClick={() => setDocModal(true)} className="btn-secondary text-sm flex items-center gap-1">
                  <Download className="w-4 h-4 rotate-180" /> Subir
                </button>
              )}
            </div>
            {rei.documentos?.length === 0
              ? <p className="text-sm text-gray-400">Sin documentos adjuntos</p>
              : rei.documentos?.map(doc => (
                <div key={doc.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{doc.nombre_original}</p>
                    <p className="text-xs text-gray-400">{doc.tipo_documento} · {(doc.tamano_bytes / 1024).toFixed(0)} KB</p>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        <div className="space-y-4">
          {rei.pago ? (
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-3">Pago</h2>
              <StatusBadge status={rei.pago.status} />
              <p className="text-2xl font-bold text-gray-900 mt-3">{formatMoney(rei.pago.monto)}</p>
              {rei.pago.status === 'completado' && (
                <>
                  <button
                    onClick={async () => {
                      try {
                        const { data } = await pagoService.descargarComprobante(rei.pago.id)
                        downloadBlob(data, `comprobante_${rei.pago.numero_comprobante}.pdf`)
                      } catch { toast.error('Error al descargar comprobante') }
                    }}
                    className="btn-secondary w-full mt-3 flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Descargar comprobante
                  </button>
                  {!rei.documentos?.length && (
                    <button onClick={() => setDocModal(true)} className="btn-primary w-full mt-2 flex items-center justify-center gap-2">
                      <Download className="w-4 h-4 rotate-180" /> Subir Resolución Directoral
                    </button>
                  )}
                </>
              )}
              {rei.pago.status === 'pendiente' && (
                <button onClick={() => setPagoModal(true)} className="btn-primary w-full mt-3">Completar pago</button>
              )}
              {rei.pago.status === 'fallido' && (
                <div className="mt-3">
                  <p className="text-sm text-red-600 mb-2">El pago fue rechazado. Puedes intentarlo nuevamente.</p>
                  <button onClick={() => setPagoModal(true)} className="btn-primary w-full">Reintentar pago</button>
                </div>
              )}
            </div>
          ) : rei.status === 'borrador' ? (
            <div className="card text-center">
              <p className="text-sm text-gray-500 mb-3">Para continuar debes realizar el pago</p>
              <p className="text-2xl font-bold text-primary-600 mb-3">{formatMoney(20000)}</p>
              <button onClick={() => setPagoModal(true)} className="btn-primary w-full">Pagar ahora</button>
            </div>
          ) : null}

          {rei.status === 'aprobado' && (
            <div className="card border-l-4 border-l-green-500 bg-green-50">
              <h2 className="font-semibold text-green-900 mb-2">Resolución de Reincorporación</h2>
              <p className="text-sm text-green-700 mb-3">Tu reincorporación fue aprobada. Descarga tu resolución oficial.</p>
              <button
                onClick={async () => {
                  const { data } = await reincorporacionService.descargarResolucion(rei.id)
                  downloadBlob(data, `resolucion_rei_${rei.numero_resolucion}.pdf`)
                }}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Descargar Resolución
              </button>
            </div>
          )}

          <div className="card text-sm text-gray-500 space-y-1">
            <p>Creada: {formatDateTime(rei.created_at)}</p>
            <p>Actualizada: {formatDateTime(rei.updated_at)}</p>
          </div>

          {rei.status === 'borrador' && (
            <button onClick={() => setConfirmDelete(true)} className="btn-secondary w-full flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 border-red-200">
              <Trash2 className="w-4 h-4" /> Eliminar reincorporación
            </button>
          )}
        </div>
      </div>

      <PagoReincorporacionModal open={pagoModal} onClose={() => setPagoModal(false)} reiId={rei.id} pagoId={rei.pago?.id} onSuccess={load} />
      <DocReincorporacionModal open={docModal} onClose={() => setDocModal(false)} reiId={rei.id} onSuccess={load} />
      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Eliminar reincorporación"
        description="¿Seguro que deseas eliminar esta reincorporación en borrador? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
      />
    </div>
  )
}

function PagoReincorporacionModal({ open, onClose, reiId, pagoId, onSuccess }) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm()
  const [currentPagoId, setCurrentPagoId] = useState(pagoId)

  const iniciar = async () => {
    if (currentPagoId) return
    try {
      const { data } = await pagoService.iniciarReincorporacion(reiId)
      setCurrentPagoId(data.id)
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  useEffect(() => { if (open) iniciar() }, [open])

  const onSubmit = async (data) => {
    try {
      await pagoService.procesar(currentPagoId, data)
      toast.success('¡Pago completado! Ahora sube tu Resolución Directoral.')
      onClose(); onSuccess()
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Realizar pago — Reincorporación" size="md">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-sm text-yellow-800">
        Entorno de prueba — usa cualquier número de tarjeta
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField label="Número de tarjeta" required>
          <input {...register('numero_tarjeta', { required: true })} className="input" placeholder="4242 4242 4242 4242" maxLength={19} />
        </FormField>
        <FormField label="Nombre del titular" required>
          <input {...register('nombre_titular', { required: true })} className="input" placeholder="Juan Pérez" />
        </FormField>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Mes"><input {...register('mes_vencimiento', { required: true })} className="input" placeholder="MM" maxLength={2} /></FormField>
          <FormField label="Año"><input {...register('anno_vencimiento', { required: true })} className="input" placeholder="AA" maxLength={2} /></FormField>
          <FormField label="CVV"><input {...register('cvv', { required: true })} className="input" placeholder="123" maxLength={4} /></FormField>
        </div>
        <FormField label="Tipo de tarjeta" required>
          <select {...register('tipo_tarjeta', { required: true })} className="input">
            <option value="visa">Visa</option>
            <option value="mastercard">Mastercard</option>
            <option value="amex">American Express</option>
          </select>
        </FormField>
        <div className="flex gap-3 justify-end mt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" className="btn-primary" disabled={isSubmitting || !currentPagoId}>
            {isSubmitting ? 'Procesando...' : `Pagar ${formatMoney(20000)}`}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function DocReincorporacionModal({ open, onClose, reiId, onSuccess }) {
  const { register, handleSubmit, formState: { isSubmitting }, reset } = useForm()
  const [file, setFile] = useState(null)

  const onSubmit = async (data) => {
    if (!file) { toast.error('Selecciona un archivo'); return }
    try {
      await reincorporacionService.subirDocumento(reiId, data.tipo_documento, file)
      toast.success('Documento subido')
      reset(); setFile(null); onClose(); onSuccess()
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Subir Resolución Directoral" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField label="Tipo de documento" required>
          <select {...register('tipo_documento', { required: true })} className="input">
            <option value="resolucion_directoral">Resolución Directoral</option>
            <option value="otro">Otro</option>
          </select>
        </FormField>
        <FormField label="Archivo (PDF, JPG, PNG — máx. 10MB)" required>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e => setFile(e.target.files[0])} className="input" />
        </FormField>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Subiendo...' : 'Subir'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Bandeja coordinador / admin académico — Licencias ─────────────────────────
export function BandejaLicenciasPage({ role }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [dictamenModal, setDictamenModal] = useState(false)
  const [resolucionModal, setResolucionModal] = useState(false)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1 })
  const [filters, setFilters] = useState({})

  const { register: regD, handleSubmit: handleD, reset: resetD, formState: { isSubmitting: isSubmittingD } } = useForm()
  const { register: regR, handleSubmit: handleR, reset: resetR, formState: { isSubmitting: isSubmittingR } } = useForm()

  const load = async (currentPage = 1, currentFilters = {}) => {
    setLoading(true)
    const fn = role === 'admin_sistema'
      ? licenciaService.getAll
      : role === 'coordinador'
        ? licenciaService.getBandejaCoordinador
        : licenciaService.getBandejaAdmin
    try {
      const { data } = await fn({ page: currentPage, page_size: PAGE_SIZE, ...currentFilters })
      setItems(data.items)
      setPagination({ total: data.total, total_pages: data.total_pages })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { setPage(1); setFilters({}); load(1, {}) }, [role])

  const handleApply = (newFilters) => {
    setFilters(newFilters)
    setPage(1)
    load(1, newFilters)
  }

  const handlePageChange = (newPage) => {
    setPage(newPage)
    load(newPage, filters)
  }

  const openRevisar = async (lic) => {
    setSelected(lic)
    setSelectedDetail(null)
    try { const { data } = await licenciaService.getById(lic.id); setSelectedDetail(data) } catch { /* silencioso */ }
    role === 'coordinador' ? setDictamenModal(true) : setResolucionModal(true)
  }

  const onDictamen = async (data) => {
    try {
      await licenciaService.emitirDictamen(selected.id, { dictamen: data.dictamen, aprobado: data.aprobado === 'true' })
      toast.success('Dictamen emitido')
      setDictamenModal(false); resetD(); load(page, filters)
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  const onResolucion = async (data) => {
    try {
      await licenciaService.emitirResolucion(selected.id, { resolucion: data.resolucion, aprobado: data.aprobado === 'true', numero_resolucion: data.numero_resolucion })
      toast.success('Resolución emitida')
      setResolucionModal(false); resetR(); load(page, filters)
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  const canRevisar = (lic) => {
    if (role === 'admin_sistema') return false
    if (role === 'coordinador') return lic.status === 'pendiente_revision'
    return lic.status === 'en_revision'
  }

  if (loading) return <LoadingPage />

  const DocsSection = () => selectedDetail?.documentos?.length > 0 ? (
    <div className="border-t pt-3 mt-2">
      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Documentos adjuntos</p>
      {selectedDetail.documentos.map(doc => (
        <div key={doc.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
          <div>
            <p className="text-sm font-medium text-gray-800">{doc.nombre_original}</p>
            <p className="text-xs text-gray-400">{doc.tipo_documento} · {(doc.tamano_bytes / 1024).toFixed(0)} KB</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                const { data } = await licenciaService.descargarDocumento(selectedDetail.id, doc.id)
                downloadBlob(data, doc.nombre_original)
              } catch { toast.error('Error al descargar') }
            }}
            className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            title="Descargar"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  ) : <p className="text-xs text-gray-400 border-t pt-3 mt-2">Sin documentos adjuntos</p>

  return (
    <div>
      <PageHeader
        title="Bandeja de licencias"
        subtitle={`${pagination.total} ${role === 'admin_sistema' ? 'trámites' : 'solicitudes'}`}
      />
      <FiltrosTramites
        onApply={handleApply}
        showCarrera={role !== 'coordinador'}
      />
      {items.length === 0
        ? <EmptyState title="Sin licencias" icon={CheckCircle} />
        : items.map(lic => (
          <div key={lic.id} className="card flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold text-gray-900">{lic.codigo}</p>
              <p className="text-sm text-gray-500">{formatDate(lic.fecha_inicio)} – {formatDate(lic.fecha_fin)}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={lic.status} />
              {canRevisar(lic) && (
                <button onClick={() => openRevisar(lic)} className="btn-primary text-sm">Revisar</button>
              )}
            </div>
          </div>
        ))
      }
      <Pagination page={page} totalPages={pagination.total_pages} total={pagination.total} onChange={handlePageChange} />

      <Modal open={dictamenModal} onClose={() => { setDictamenModal(false); resetD() }} title={`Dictamen — ${selected?.codigo}`}>
        <form onSubmit={handleD(onDictamen)} className="space-y-4">
          <FormField label="Dictamen">
            <textarea {...regD('dictamen', { required: true })} className="input" rows={4} placeholder="Escribe tu dictamen..." />
          </FormField>
          <FormField label="Decisión">
            <select {...regD('aprobado')} className="input">
              <option value="true">Favorable (aprobar)</option>
              <option value="false">Desfavorable (rechazar)</option>
            </select>
          </FormField>
          <DocsSection />
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => { setDictamenModal(false); resetD() }} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={isSubmittingD}>{isSubmittingD ? 'Procesando...' : 'Emitir dictamen'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={resolucionModal} onClose={() => { setResolucionModal(false); resetR() }} title={`Resolución — ${selected?.codigo}`}>
        <form onSubmit={handleR(onResolucion)} className="space-y-4">
          <FormField label="N° Resolución"><input {...regR('numero_resolucion', { required: true })} className="input" placeholder="RES-2024-001" /></FormField>
          <FormField label="Resolución"><textarea {...regR('resolucion', { required: true })} className="input" rows={4} /></FormField>
          <FormField label="Decisión">
            <select {...regR('aprobado')} className="input">
              <option value="true">Aprobada</option>
              <option value="false">Rechazada</option>
            </select>
          </FormField>
          <DocsSection />
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => { setResolucionModal(false); resetR() }} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={isSubmittingR}>{isSubmittingR ? 'Procesando...' : 'Emitir resolución'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ── Bandeja coordinador / admin académico — Reincorporaciones ─────────────────
export function BandejaReincorporacionesPage({ role }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [modal, setModal] = useState(false)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1 })
  const [filters, setFilters] = useState({})
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm()

  const load = async (currentPage = 1, currentFilters = {}) => {
    setLoading(true)
    const fn = role === 'admin_sistema'
      ? reincorporacionService.getAll
      : role === 'coordinador'
        ? reincorporacionService.getBandejaCoordinador
        : reincorporacionService.getBandejaAdmin
    try {
      const { data } = await fn({ page: currentPage, page_size: PAGE_SIZE, ...currentFilters })
      setItems(data.items)
      setPagination({ total: data.total, total_pages: data.total_pages })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { setPage(1); setFilters({}); load(1, {}) }, [role])

  const handleApply = (newFilters) => {
    setFilters(newFilters)
    setPage(1)
    load(1, newFilters)
  }

  const handlePageChange = (newPage) => {
    setPage(newPage)
    load(newPage, filters)
  }

  const openRevisar = async (r) => {
    setSelected(r)
    setSelectedDetail(null)
    try { const { data } = await reincorporacionService.getById(r.id); setSelectedDetail(data) } catch { /* silencioso */ }
    setModal(true)
  }

  const onSubmit = async (data) => {
    try {
      const fn = role === 'coordinador' ? reincorporacionService.emitirDictamen : reincorporacionService.emitirResolucion
      const payload = role === 'coordinador'
        ? { dictamen: data.dictamen, aprobado: data.aprobado === 'true' }
        : { resolucion: data.resolucion, aprobado: data.aprobado === 'true', numero_resolucion: data.numero_resolucion }
      await fn(selected.id, payload)
      toast.success(role === 'coordinador' ? 'Dictamen emitido' : 'Resolución emitida')
      setModal(false); reset(); load(page, filters)
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  const canRevisar = (r) => {
    if (role === 'admin_sistema') return false
    if (role === 'coordinador') return r.status === 'pendiente_revision'
    return r.status === 'en_revision'
  }

  if (loading) return <LoadingPage />

  const DocsSection = () => selectedDetail?.documentos?.length > 0 ? (
    <div className="border-t pt-3 mt-2">
      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Documentos adjuntos</p>
      {selectedDetail.documentos.map(doc => (
        <div key={doc.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
          <div>
            <p className="text-sm font-medium text-gray-800">{doc.nombre_original}</p>
            <p className="text-xs text-gray-400">{doc.tipo_documento} · {(doc.tamano_bytes / 1024).toFixed(0)} KB</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                const { data } = await reincorporacionService.descargarDocumento(selectedDetail.id, doc.id)
                downloadBlob(data, doc.nombre_original)
              } catch { toast.error('Error al descargar') }
            }}
            className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            title="Descargar"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  ) : <p className="text-xs text-gray-400 border-t pt-3 mt-2">Sin documentos adjuntos</p>

  return (
    <div>
      <PageHeader
        title="Bandeja de reincorporaciones"
        subtitle={`${pagination.total} ${role === 'admin_sistema' ? 'trámites' : 'solicitudes'}`}
      />
      <FiltrosTramites
        onApply={handleApply}
        showCarrera={role !== 'coordinador'}
      />
      {items.length === 0
        ? <EmptyState title="Sin reincorporaciones" icon={CheckCircle} />
        : items.map(r => (
          <div key={r.id} className="card flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold text-gray-900">{r.codigo}</p>
              <p className="text-sm text-gray-500">Ciclo de retorno: {r.ciclo_retorno}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={r.status} />
              {canRevisar(r) && (
                <button onClick={() => openRevisar(r)} className="btn-primary text-sm">Revisar</button>
              )}
            </div>
          </div>
        ))
      }
      <Pagination page={page} totalPages={pagination.total_pages} total={pagination.total} onChange={handlePageChange} />

      <Modal open={modal} onClose={() => { setModal(false); reset() }} title={`Revisar — ${selected?.codigo}`}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {role !== 'coordinador' && (
            <FormField label="N° Resolución"><input {...register('numero_resolucion', { required: true })} className="input" /></FormField>
          )}
          <FormField label={role === 'coordinador' ? 'Dictamen' : 'Resolución'}>
            <textarea {...register(role === 'coordinador' ? 'dictamen' : 'resolucion', { required: true })} className="input" rows={4} />
          </FormField>
          <FormField label="Decisión">
            <select {...register('aprobado')} className="input">
              <option value="true">Favorable / Aprobar</option>
              <option value="false">Desfavorable / Rechazar</option>
            </select>
          </FormField>
          <DocsSection />
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => { setModal(false); reset() }} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Procesando...' : 'Emitir'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ── Gestión de usuarios (admin sistema) ───────────────────────────────────────
const USER_PAGE_SIZE = 15

export function UsuariosPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1 })
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [carreraFilter, setCarreraFilter] = useState('')
  const [carreras, setCarreras] = useState([])
  const [createModal, setCreateModal] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm()

  // Debounce: aplica búsqueda 400ms después de que el usuario deja de escribir
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Carga opciones de carrera al montar (una sola vez)
  useEffect(() => {
    usuarioService.getAll({ page: 1, page_size: 200 }).then(({ data }) => {
      const set = new Set()
      ;(data.items || []).forEach(u => {
        if (u.carrera) set.add(u.carrera)
        if (u.carrera_asignada) set.add(u.carrera_asignada)
      })
      setCarreras([...set].sort())
    }).catch(() => {})
  }, [])

  const buildParams = (currentPage = page) => ({
    page: currentPage,
    page_size: USER_PAGE_SIZE,
    ...(search && { search }),
    ...(roleFilter && { role: roleFilter }),
    ...(statusFilter && { status: statusFilter }),
    ...(carreraFilter && { carrera: carreraFilter }),
  })

  const load = async (currentPage = page) => {
    setLoading(true)
    try {
      const { data } = await usuarioService.getAll(buildParams(currentPage))
      setUsers(data.items)
      setPagination({ total: data.total, total_pages: data.total_pages })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1) }, [search, roleFilter, statusFilter, carreraFilter])

  const handlePageChange = (newPage) => {
    setPage(newPage)
    load(newPage)
  }

  const onCreate = async (data) => {
    try {
      await usuarioService.crearStaff(data)
      toast.success('Usuario creado. Se envió contraseña temporal al correo.')
      setCreateModal(false); reset(); load(1)
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  const toggleStatus = async (user) => {
    try {
      if (user.status === 'activo') await usuarioService.deshabilitar(user.id)
      else await usuarioService.habilitar(user.id)
      toast.success('Estado actualizado')
      setConfirm(null); load(page)
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  if (loading) return <LoadingPage />

  return (
    <div>
      <PageHeader
        title="Gestión de usuarios"
        actions={<button onClick={() => setCreateModal(true)} className="btn-primary flex items-center gap-2"><Users className="w-4 h-4" /> Crear staff</button>}
      />

      {/* Filtros inline para usuarios */}
      <div className="card mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Buscar por nombre o correo..."
              className="input pl-8 text-sm"
            />
          </div>
          <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1) }} className="input text-sm">
            <option value="">Todos los roles</option>
            <option value="estudiante">Estudiante</option>
            <option value="coordinador">Coordinador</option>
            <option value="admin_academico">Admin. Académico</option>
            <option value="admin_sistema">Admin. Sistema</option>
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="input text-sm">
            <option value="">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
            <option value="pendiente_verificacion">Pendiente verificación</option>
          </select>
          <select value={carreraFilter} onChange={e => { setCarreraFilter(e.target.value); setPage(1) }} className="input text-sm">
            <option value="">Todas las carreras</option>
            {carreras.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Nombre', 'Correo', 'Rol', 'Carrera', 'Estado', 'Acciones'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.nombres} {u.apellidos}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3"><span className="badge bg-blue-50 text-blue-700">{ROLE_LABELS[u.role] || u.role}</span></td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {u.role === 'estudiante' ? (u.carrera || '—') : u.role === 'coordinador' ? (u.carrera_asignada || '—') : '—'}
                </td>
                <td className="px-4 py-3"><StatusBadge status={u.status === 'activo' ? 'aprobado' : 'anulado'} /></td>
                <td className="px-4 py-3">
                  <button onClick={() => setConfirm(u)} className={`text-xs font-medium ${u.status === 'activo' ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}>
                    {u.status === 'activo' ? 'Deshabilitar' : 'Habilitar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <div className="py-8 text-center text-gray-400 text-sm">Sin usuarios encontrados</div>}
      </div>

      <Pagination page={page} totalPages={pagination.total_pages} total={pagination.total} onChange={handlePageChange} />

      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Crear usuario staff">
        <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Nombres" required><input {...register('nombres', { required: true })} className="input" /></FormField>
            <FormField label="Apellidos" required><input {...register('apellidos', { required: true })} className="input" /></FormField>
          </div>
          <FormField label="Correo" required><input {...register('email', { required: true })} type="email" className="input" /></FormField>
          <FormField label="Contraseña" required>
            <input {...register('password', { required: true, minLength: { value: 8, message: 'Mínimo 8 caracteres' } })} type="password" className="input" placeholder="Mínimo 8 caracteres" />
          </FormField>
          <FormField label="Rol" required>
            <select {...register('role', { required: true })} className="input">
              <option value="coordinador">Coordinador</option>
              <option value="admin_academico">Admin. Académico</option>
              <option value="admin_sistema">Admin. Sistema</option>
            </select>
          </FormField>
          <FormField label="Carrera asignada (solo coordinadores)">
            <input {...register('carrera_asignada')} className="input" placeholder="Educación Inicial" />
          </FormField>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setCreateModal(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => toggleStatus(confirm)}
        title={confirm?.status === 'activo' ? 'Deshabilitar cuenta' : 'Habilitar cuenta'}
        description={`¿Confirmas ${confirm?.status === 'activo' ? 'deshabilitar' : 'habilitar'} la cuenta de ${confirm?.nombres} ${confirm?.apellidos}?`}
        danger={confirm?.status === 'activo'}
      />
    </div>
  )
}

// ── Reportes y métricas (admin sistema) ───────────────────────────────────────
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

export function ReportesPage() {
  const [metricas, setMetricas] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { reporteService.metricas().then(({ data }) => setMetricas(data)).finally(() => setLoading(false)) }, [])

  const exportar = async (tipo) => {
    try {
      const fn = tipo === 'licencias' ? reporteService.exportarLicencias : reporteService.exportarReincorporaciones
      const { data } = await fn()
      downloadBlob(data, `${tipo}_${new Date().toISOString().slice(0, 10)}.csv`)
      toast.success('Reporte descargado')
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  if (loading) return <LoadingPage />

  const licData = Object.entries(metricas?.licencias_por_estado || {}).map(([name, value]) => ({ name, value }))
  const reiData = Object.entries(metricas?.reincorporaciones_por_estado || {}).map(([name, value]) => ({ name, value }))

  return (
    <div>
      <PageHeader title="Reportes y métricas" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total licencias', value: metricas?.total_licencias },
          { label: 'Total reincorporaciones', value: metricas?.total_reincorporaciones },
          { label: 'Usuarios registrados', value: metricas?.total_usuarios },
          { label: 'Ingresos totales', value: formatMoney(metricas?.ingresos_totales || 0) },
        ].map(({ label, value }) => (
          <div key={label} className="card text-center">
            <p className="text-3xl font-bold text-primary-600">{value}</p>
            <p className="text-sm text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Licencias por estado</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={licData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                {licData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Reincorporaciones por estado</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={reiData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Exportar reportes</h2>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => exportar('licencias')} className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" /> Exportar licencias (CSV)
          </button>
          <button onClick={() => exportar('reincorporaciones')} className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" /> Exportar reincorporaciones (CSV)
          </button>
        </div>
      </div>
    </div>
  )
}
