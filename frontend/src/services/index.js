import api from './api'

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authService = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  verify2FA: (data) => api.post('/auth/verify-2fa', data),
  verifyEmail: (token) => api.get(`/auth/verify-email?token=${token}`),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  getMe: () => api.get('/auth/me'),
  updateMe: (data) => api.put('/auth/me', data),
  changePassword: (data) => api.post('/auth/change-password', data),
  setupTOTP: () => api.post('/auth/totp/setup'),
  confirmTOTP: (code) => api.post('/auth/totp/confirm', { totp_code: code }),
}

// ── Licencias ─────────────────────────────────────────────────────────────────
export const licenciaService = {
  crear: (data) => api.post('/licencias', data),
  getMias: (params = {}) => api.get('/licencias/mis-licencias', { params }),
  getById: (id) => api.get(`/licencias/${id}`),
  subirDocumento: (id, tipo, file) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post(`/licencias/${id}/documentos?tipo=${tipo}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  descargarResolucion: (id) =>
    api.get(`/licencias/${id}/resolucion-pdf`, { responseType: 'blob' }),
  getBandejaCoordinador: (params = {}) => api.get('/licencias/bandeja/coordinador', { params }),
  emitirDictamen: (id, data) => api.post(`/licencias/${id}/dictamen`, data),
  getBandejaAdmin: (params = {}) => api.get('/licencias/bandeja/admin-academico', { params }),
  emitirResolucion: (id, data) => api.post(`/licencias/${id}/resolucion`, data),
  getAll: (params = {}) => api.get('/licencias', { params }),
  anular: (id, motivo) => api.post(`/licencias/${id}/anular`, { motivo }),
  rehabilitar: (id) => api.post(`/licencias/${id}/rehabilitar`),
  eliminar: (id) => api.delete(`/licencias/${id}`),
  descargarDocumento: (licenciaId, documentoId) =>
    api.get(`/licencias/${licenciaId}/documentos/${documentoId}/descargar`, { responseType: 'blob' }),
}

// ── Reincorporaciones ─────────────────────────────────────────────────────────
export const reincorporacionService = {
  crear: (data) => api.post('/reincorporaciones', data),
  getMias: (params = {}) => api.get('/reincorporaciones/mis-reincorporaciones', { params }),
  getById: (id) => api.get(`/reincorporaciones/${id}`),
  subirDocumento: (id, tipo, file) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post(`/reincorporaciones/${id}/documentos?tipo=${tipo}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  descargarResolucion: (id) =>
    api.get(`/reincorporaciones/${id}/resolucion-pdf`, { responseType: 'blob' }),
  getBandejaCoordinador: (params = {}) => api.get('/reincorporaciones/bandeja/coordinador', { params }),
  emitirDictamen: (id, data) => api.post(`/reincorporaciones/${id}/dictamen`, data),
  getBandejaAdmin: (params = {}) => api.get('/reincorporaciones/bandeja/admin-academico', { params }),
  emitirResolucion: (id, data) => api.post(`/reincorporaciones/${id}/resolucion`, data),
  getAll: (params = {}) => api.get('/reincorporaciones', { params }),
  anular: (id, motivo) => api.post(`/reincorporaciones/${id}/anular`, { motivo }),
  rehabilitar: (id) => api.post(`/reincorporaciones/${id}/rehabilitar`),
  eliminar: (id) => api.delete(`/reincorporaciones/${id}`),
  descargarDocumento: (reiId, documentoId) =>
    api.get(`/reincorporaciones/${reiId}/documentos/${documentoId}/descargar`, { responseType: 'blob' }),
}

// ── Pagos ─────────────────────────────────────────────────────────────────────
export const pagoService = {
  iniciarLicencia: (licenciaId) => api.post(`/pagos/licencia/${licenciaId}/iniciar`),
  iniciarReincorporacion: (reiId) => api.post(`/pagos/reincorporacion/${reiId}/iniciar`),
  procesar: (pagoId, data) => api.post(`/pagos/${pagoId}/procesar`, data),
  descargarComprobante: (pagoId) =>
    api.get(`/pagos/${pagoId}/comprobante`, { responseType: 'blob' }),
}

// ── Notificaciones ────────────────────────────────────────────────────────────
export const notifService = {
  getMias: (params = {}) => api.get('/notificaciones', { params }),
  marcarLeida: (id) => api.post(`/notificaciones/${id}/leer`),
  marcarTodasLeidas: () => api.post('/notificaciones/leer-todas'),
}

// ── Usuarios ──────────────────────────────────────────────────────────────────
export const usuarioService = {
  crearStaff: (data) => api.post('/usuarios/staff', data),
  getAll: (params = {}) => api.get('/usuarios', { params }),
  getById: (id) => api.get(`/usuarios/${id}`),
  editar: (id, data) => api.put(`/usuarios/${id}`, data),
  deshabilitar: (id) => api.post(`/usuarios/${id}/deshabilitar`),
  habilitar: (id) => api.post(`/usuarios/${id}/habilitar`),
}

// ── Reportes ──────────────────────────────────────────────────────────────────
export const reporteService = {
  metricas: () => api.get('/reportes/metricas'),
  exportarLicencias: () => api.get('/reportes/exportar-licencias', { responseType: 'blob' }),
  exportarReincorporaciones: () => api.get('/reportes/exportar-reincorporaciones', { responseType: 'blob' }),
}

// ── Chatbot ───────────────────────────────────────────────────────────────────
export const chatbotService = {
  enviar: (mensaje, historial) => api.post('/chatbot/mensaje', { mensaje, historial }),
}
