export const STATUS_LABELS = {
  borrador: 'Borrador',
  pendiente_pago: 'Pendiente pago',
  pendiente_revision: 'Pendiente revisión',
  en_revision: 'En revisión',
  rechazado_coordinador: 'Rechazado por coordinador',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  caducado: 'Caducado',
  anulado: 'Anulado',
}

export const STATUS_COLORS = {
  borrador: 'bg-gray-100 text-gray-700',
  pendiente_pago: 'bg-yellow-100 text-yellow-800',
  pendiente_revision: 'bg-blue-100 text-blue-800',
  en_revision: 'bg-purple-100 text-purple-800',
  rechazado_coordinador: 'bg-orange-100 text-orange-800',
  aprobado: 'bg-green-100 text-green-800',
  rechazado: 'bg-red-100 text-red-800',
  caducado: 'bg-orange-100 text-orange-800',
  anulado: 'bg-gray-200 text-gray-600',
}

export const MOTIVO_LABELS = {
  salud: 'Salud',
  personal: 'Personal',
  laboral: 'Laboral',
  familiar: 'Familiar',
  otro: 'Otro',
}

export const ROLE_LABELS = {
  estudiante: 'Estudiante',
  coordinador: 'Coordinador',
  admin_academico: 'Admin. Académico',
  admin_sistema: 'Admin. Sistema',
}

export const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-CL')
}

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('es-CL')
}

export const formatMoney = (amount) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount)
}

export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.URL.revokeObjectURL(url)
}

export const getErrorMessage = (error) => {
  return error?.response?.data?.detail || error?.message || 'Ocurrió un error inesperado'
}
