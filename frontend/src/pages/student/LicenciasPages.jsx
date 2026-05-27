import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { licenciaService, pagoService, reincorporacionService } from '../../services'
import { StatusBadge, PageHeader, LoadingPage, EmptyState, Modal, ConfirmModal, FormField, FiltrosTramites, Pagination } from '../../components/common'
import { formatDate, formatDateTime, formatMoney, downloadBlob, getErrorMessage, MOTIVO_LABELS } from '../../utils'
import { FileText, Plus, Upload, Download, ChevronLeft, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const PAGE_SIZE = 10

// ── Lista ─────────────────────────────────────────────────────────────────────
export function LicenciasListPage() {
  const [licencias, setLicencias] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState(null)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1 })
  const [filters, setFilters] = useState({})

  const load = async (currentPage = 1, currentFilters = {}) => {
    setLoading(true)
    try {
      const { data } = await licenciaService.getMias({ page: currentPage, page_size: PAGE_SIZE, ...currentFilters })
      setLicencias(data.items)
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
      await licenciaService.eliminar(deleteId)
      toast.success('Licencia eliminada')
      setDeleteId(null)
      load(page, filters)
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  if (loading) return <LoadingPage />

  return (
    <div>
      <PageHeader
        title="Mis licencias"
        actions={<Link to="/licencias/nueva" className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nueva licencia</Link>}
      />
      <FiltrosTramites onApply={handleApply} showCarrera={false} />
      {licencias.length === 0
        ? <EmptyState title="Sin licencias" description="Crea tu primera solicitud de licencia" icon={FileText} />
        : (
          <div className="space-y-3">
            {licencias.map(lic => (
              <div key={lic.id} className="card flex items-center justify-between hover:border-primary-200 transition-colors">
                <Link to={`/licencias/${lic.id}`} className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{lic.codigo}</p>
                  <p className="text-sm text-gray-500">{MOTIVO_LABELS[lic.motivo]} · {formatDate(lic.fecha_inicio)} – {formatDate(lic.fecha_fin)}</p>
                  <p className="text-xs text-gray-400 mt-1">Creada: {formatDate(lic.created_at)}</p>
                </Link>
                <div className="flex items-center gap-3 ml-3">
                  <StatusBadge status={lic.status} />
                  {lic.status === 'borrador' && (
                    <button onClick={e => { e.preventDefault(); setDeleteId(lic.id) }} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
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
      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar licencia"
        description="¿Seguro que deseas eliminar esta licencia en borrador? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
      />
    </div>
  )
}

// ── Nueva licencia ────────────────────────────────────────────────────────────
export function NuevaLicenciaPage() {
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm()

  const onSubmit = async (data) => {
    try {
      const { data: lic } = await licenciaService.crear(data)
      toast.success('Licencia creada. Procede al pago.')
      navigate(`/licencias/${lic.id}`)
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  return (
    <div>
      <Link to="/licencias" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ChevronLeft className="w-4 h-4" /> Volver
      </Link>
      <PageHeader title="Solicitar licencia de estudio" />
      <div className="card max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <FormField label="Motivo" required error={errors.motivo?.message}>
            <select {...register('motivo', { required: 'Requerido' })} className="input">
              <option value="">Selecciona un motivo</option>
              {Object.entries(MOTIVO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </FormField>
          <FormField label="Descripción" required error={errors.descripcion?.message}>
            <textarea {...register('descripcion', { required: 'Requerido', minLength: { value: 20, message: 'Mínimo 20 caracteres' } })}
              className="input" rows={4} placeholder="Describe el motivo de tu licencia..." />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Fecha inicio" required error={errors.fecha_inicio?.message}>
              <input {...register('fecha_inicio', { required: 'Requerido' })} type="date" className="input" />
            </FormField>
            <FormField label="Fecha fin" required error={errors.fecha_fin?.message}>
              <input {...register('fecha_fin', { required: 'Requerido' })} type="date" className="input" />
            </FormField>
          </div>
          <div className="flex gap-3 justify-end">
            <Link to="/licencias" className="btn-secondary">Cancelar</Link>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Crear licencia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Detalle licencia ──────────────────────────────────────────────────────────
export function DetalleLicenciaPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [licencia, setLicencia] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pagoModal, setPagoModal] = useState(false)
  const [docModal, setDocModal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = () => licenciaService.getById(id).then(({ data }) => setLicencia(data)).finally(() => setLoading(false))
  useEffect(() => { load() }, [id])

  const handleDelete = async () => {
    try {
      await licenciaService.eliminar(id)
      toast.success('Licencia eliminada')
      navigate('/licencias')
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  if (loading) return <LoadingPage />
  if (!licencia) return <div className="card">No encontrada</div>

  return (
    <div>
      <Link to="/licencias" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ChevronLeft className="w-4 h-4" /> Volver
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{licencia.codigo}</h1>
          <p className="text-gray-500 text-sm mt-1">Licencia de estudio</p>
        </div>
        <StatusBadge status={licencia.status} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Datos */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Información del trámite</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-gray-500">Motivo</dt><dd className="font-medium">{MOTIVO_LABELS[licencia.motivo]}</dd></div>
              <div><dt className="text-gray-500">Período</dt><dd className="font-medium">{formatDate(licencia.fecha_inicio)} – {formatDate(licencia.fecha_fin)}</dd></div>
              <div className="col-span-2"><dt className="text-gray-500">Descripción</dt><dd className="font-medium">{licencia.descripcion}</dd></div>
            </dl>
          </div>

          {/* Resolución */}
          {licencia.resolucion_admin && (
            <div className="card border-l-4 border-l-primary-500">
              <h2 className="font-semibold text-gray-900 mb-2">Resolución</h2>
              <p className="text-sm text-gray-700">{licencia.resolucion_admin}</p>
              {licencia.numero_resolucion && <p className="text-xs text-gray-400 mt-2">N° {licencia.numero_resolucion} · {formatDate(licencia.fecha_resolucion)}</p>}
            </div>
          )}

          {/* Dictamen coordinador */}
          {licencia.dictamen_coordinador && (
            <div className="card bg-purple-50 border-purple-100">
              <h2 className="font-semibold text-purple-900 mb-2">Dictamen del coordinador</h2>
              <p className="text-sm text-purple-800">{licencia.dictamen_coordinador}</p>
            </div>
          )}

          {/* Banner rechazado por coordinador */}
          {licencia.status === 'rechazado_coordinador' && (
            <div className="card bg-orange-50 border-orange-200">
              <p className="text-sm text-orange-800 font-medium">Tu solicitud fue rechazada por el coordinador. Sube el documento correcto para continuar.</p>
            </div>
          )}

          {/* Documentos */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Documentos adjuntos</h2>
              {['borrador', 'pendiente_revision', 'rechazado_coordinador'].includes(licencia.status) && (
                <button onClick={() => setDocModal(true)} className="btn-secondary text-sm flex items-center gap-1">
                  <Upload className="w-4 h-4" /> Subir
                </button>
              )}
            </div>
            {licencia.documentos.length === 0
              ? <p className="text-sm text-gray-400">Sin documentos adjuntos</p>
              : licencia.documentos.map(doc => (
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

        {/* Sidebar pago */}
        <div className="space-y-4">
          {licencia.pago ? (
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-3">Pago</h2>
              <StatusBadge status={licencia.pago.status} />
              <p className="text-2xl font-bold text-gray-900 mt-3">{formatMoney(licencia.pago.monto)}</p>
              {licencia.pago.status === 'completado' && (
                <button
                  onClick={async () => {
                    try {
                      const { data } = await pagoService.descargarComprobante(licencia.pago.id)
                      downloadBlob(data, `comprobante_${licencia.pago.numero_comprobante}.pdf`)
                    } catch { toast.error('Error al descargar comprobante') }
                  }}
                  className="btn-secondary w-full mt-3 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" /> Descargar comprobante
                </button>
              )}
              {licencia.pago.status === 'pendiente' && (
                <button onClick={() => setPagoModal(true)} className="btn-primary w-full mt-3">
                  Completar pago
                </button>
              )}
              {licencia.pago.status === 'fallido' && (
                <div className="mt-3">
                  <p className="text-sm text-red-600 mb-2">El pago fue rechazado. Puedes intentarlo nuevamente.</p>
                  <button onClick={() => setPagoModal(true)} className="btn-primary w-full">
                    Reintentar pago
                  </button>
                </div>
              )}
            </div>
          ) : licencia.status === 'borrador' ? (
            <div className="card text-center">
              <p className="text-sm text-gray-500 mb-3">Para continuar con tu trámite debes realizar el pago</p>
              <p className="text-2xl font-bold text-primary-600 mb-3">{formatMoney(15000)}</p>
              <button onClick={() => setPagoModal(true)} className="btn-primary w-full">
                Pagar ahora
              </button>
            </div>
          ) : null}

          <div className="card text-sm text-gray-500 space-y-1">
            <p>Creada: {formatDateTime(licencia.created_at)}</p>
            <p>Actualizada: {formatDateTime(licencia.updated_at)}</p>
          </div>

          {licencia.status === 'borrador' && (
            <button onClick={() => setConfirmDelete(true)} className="btn-secondary w-full flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 border-red-200">
              <Trash2 className="w-4 h-4" /> Eliminar licencia
            </button>
          )}

          {licencia.status === 'aprobado' && (
            <div className="card border-l-4 border-l-green-500 bg-green-50">
              <h2 className="font-semibold text-green-900 mb-2">Resolución Directoral</h2>
              <p className="text-sm text-green-700 mb-3">Tu licencia fue aprobada. Descarga tu Resolución Directoral para usarla en tu reincorporación.</p>
              <button
                onClick={async () => {
                  const { data } = await licenciaService.descargarResolucion(licencia.id)
                  downloadBlob(data, `resolucion_${licencia.numero_resolucion}.pdf`)
                }}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Descargar Resolución Directoral
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modales */}
      <PagoModal
        open={pagoModal}
        onClose={() => setPagoModal(false)}
        tramiteId={licencia.id}
        tipo="licencia"
        pagoId={licencia.pago?.id}
        onSuccess={load}
      />
      <DocModal
        open={docModal}
        onClose={() => setDocModal(false)}
        tramiteId={licencia.id}
        tipo="licencia"
        onSuccess={load}
      />
      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Eliminar licencia"
        description="¿Seguro que deseas eliminar esta licencia en borrador? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
      />
    </div>
  )
}

// ── Modal de pago ─────────────────────────────────────────────────────────────
function PagoModal({ open, onClose, tramiteId, tipo, pagoId, onSuccess }) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm()
  const [currentPagoId, setCurrentPagoId] = useState(pagoId)

  const iniciar = async () => {
    if (currentPagoId) return
    try {
      const fn = tipo === 'licencia' ? pagoService.iniciarLicencia : pagoService.iniciarReincorporacion
      const { data } = await fn(tramiteId)
      setCurrentPagoId(data.id)
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  useEffect(() => { if (open) iniciar() }, [open])

  const onSubmit = async (data) => {
    try {
      await pagoService.procesar(currentPagoId, data)
      toast.success('¡Pago completado exitosamente!')
      onClose()
      onSuccess()
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Realizar pago" size="md">
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
          <FormField label="Mes">
            <input {...register('mes_vencimiento', { required: true })} className="input" placeholder="MM" maxLength={2} />
          </FormField>
          <FormField label="Año">
            <input {...register('anno_vencimiento', { required: true })} className="input" placeholder="AA" maxLength={2} />
          </FormField>
          <FormField label="CVV">
            <input {...register('cvv', { required: true })} className="input" placeholder="123" maxLength={4} />
          </FormField>
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
            {isSubmitting ? 'Procesando...' : `Pagar ${formatMoney(tipo === 'licencia' ? 15000 : 20000)}`}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Modal subir documento ─────────────────────────────────────────────────────
function DocModal({ open, onClose, tramiteId, tipo, onSuccess }) {
  const { register, handleSubmit, formState: { isSubmitting }, reset } = useForm()
  const [file, setFile] = useState(null)

  const onSubmit = async (data) => {
    if (!file) { toast.error('Selecciona un archivo'); return }
    try {
      const fn = tipo === 'licencia' ? licenciaService.subirDocumento : reincorporacionService.subirDocumento
      await fn(tramiteId, data.tipo_documento, file)
      toast.success('Documento subido')
      reset(); setFile(null); onClose(); onSuccess()
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Subir documento" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField label="Tipo de documento" required>
          <select {...register('tipo_documento', { required: true })} className="input">
            <option value="certificado_medico">Certificado médico</option>
            <option value="resolucion_directoral">Resolución directoral</option>
            <option value="documento_identidad">Documento de identidad</option>
            <option value="constancia">Constancia</option>
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
