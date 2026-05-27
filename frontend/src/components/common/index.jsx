import { X, Loader2, InboxIcon } from 'lucide-react'
import { STATUS_LABELS, STATUS_COLORS } from '../../utils'

export function StatusBadge({ status }) {
  return (
    <span className={`badge ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

export function Spinner({ size = 'md' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }
  return <Loader2 className={`${sizes[size]} animate-spin text-primary-600`} />
}

export function LoadingPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Spinner size="lg" />
    </div>
  )
}

export function EmptyState({ title = 'Sin resultados', description = '', icon: Icon = InboxIcon }) {
  return (
    <div className="text-center py-12">
      <Icon className="mx-auto h-12 w-12 text-gray-300 mb-4" />
      <p className="text-gray-500 font-medium">{title}</p>
      {description && <p className="text-gray-400 text-sm mt-1">{description}</p>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${sizes[size]} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  )
}

export function ConfirmModal({ open, onClose, onConfirm, title, description, confirmLabel = 'Confirmar', danger = false }) {
  if (!open) return null
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-gray-600 mb-6">{description}</p>
      <div className="flex gap-3 justify-end">
        <button className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-gray-500 mt-1 text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  )
}

export function FormField({ label, error, children, required }) {
  return (
    <div>
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

export function Alert({ type = 'info', message }) {
  const styles = {
    info: 'bg-blue-50 text-blue-800 border-blue-200',
    success: 'bg-green-50 text-green-800 border-green-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  }
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${styles[type]}`}>
      {message}
    </div>
  )
}

export { Pagination } from './Pagination'
export { FiltrosTramites } from './FiltrosTramites'
