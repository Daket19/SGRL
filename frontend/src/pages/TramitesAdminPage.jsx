import { useState, useEffect } from 'react'
import { licenciaService, reincorporacionService } from '../services'
import { StatusBadge, PageHeader, LoadingPage, EmptyState, Modal, FiltrosTramites, Pagination } from '../components/common'
import { formatDate, downloadBlob } from '../utils'
import { FileText, RotateCcw, Download } from 'lucide-react'
import toast from 'react-hot-toast'

const PAGE_SIZE = 10

export default function TramitesAdminPage() {
  const [tab, setTab] = useState('licencias')

  // Licencias state
  const [licencias, setLicencias] = useState([])
  const [licLoading, setLicLoading] = useState(true)
  const [licPage, setLicPage] = useState(1)
  const [licPagination, setLicPagination] = useState({ total: 0, total_pages: 1 })
  const [licFilters, setLicFilters] = useState({})

  // Reincorporaciones state
  const [reincorporaciones, setReincorporaciones] = useState([])
  const [reiLoading, setReiLoading] = useState(true)
  const [reiPage, setReiPage] = useState(1)
  const [reiPagination, setReiPagination] = useState({ total: 0, total_pages: 1 })
  const [reiFilters, setReiFilters] = useState({})

  const [detalle, setDetalle] = useState(null)
  const [detalleModal, setDetalleModal] = useState(false)

  const loadLicencias = async (page = 1, filters = {}) => {
    setLicLoading(true)
    try {
      const { data } = await licenciaService.getAll({ page, page_size: PAGE_SIZE, ...filters })
      setLicencias(data.items)
      setLicPagination({ total: data.total, total_pages: data.total_pages })
    } finally {
      setLicLoading(false)
    }
  }

  const loadReincorporaciones = async (page = 1, filters = {}) => {
    setReiLoading(true)
    try {
      const { data } = await reincorporacionService.getAll({ page, page_size: PAGE_SIZE, ...filters })
      setReincorporaciones(data.items)
      setReiPagination({ total: data.total, total_pages: data.total_pages })
    } finally {
      setReiLoading(false)
    }
  }

  useEffect(() => {
    loadLicencias()
    loadReincorporaciones()
  }, [])

  const handleLicFilters = (newFilters) => {
    setLicFilters(newFilters)
    setLicPage(1)
    loadLicencias(1, newFilters)
  }

  const handleReiFilters = (newFilters) => {
    setReiFilters(newFilters)
    setReiPage(1)
    loadReincorporaciones(1, newFilters)
  }

  const verDetalle = async (item, tipo) => {
    try {
      const fn = tipo === 'licencia' ? licenciaService.getById : reincorporacionService.getById
      const { data } = await fn(item.id)
      setDetalle({ ...data, tipo })
      setDetalleModal(true)
    } catch { /* silencioso */ }
  }

  const isLoading = tab === 'licencias' ? licLoading : reiLoading

  return (
    <div>
      <PageHeader title="Todos los trámites" />

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('licencias')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${tab === 'licencias' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <FileText className="w-4 h-4" /> Licencias ({licPagination.total})
        </button>
        <button
          onClick={() => setTab('reincorporaciones')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${tab === 'reincorporaciones' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <RotateCcw className="w-4 h-4" /> Reincorporaciones ({reiPagination.total})
        </button>
      </div>

      {tab === 'licencias' && (
        <>
          <FiltrosTramites onApply={handleLicFilters} showCarrera />
          {licLoading
            ? <LoadingPage />
            : licencias.length === 0
              ? <EmptyState title="Sin licencias" icon={FileText} />
              : licencias.map(lic => (
                <button
                  key={lic.id}
                  onClick={() => verDetalle(lic, 'licencia')}
                  className="card flex items-center justify-between mb-3 w-full text-left hover:border-primary-200 transition-colors"
                >
                  <div>
                    <p className="font-semibold text-gray-900">{lic.codigo}</p>
                    <p className="text-sm text-gray-500">{formatDate(lic.fecha_inicio)} – {formatDate(lic.fecha_fin)}</p>
                  </div>
                  <StatusBadge status={lic.status} />
                </button>
              ))
          }
          <Pagination
            page={licPage}
            totalPages={licPagination.total_pages}
            total={licPagination.total}
            onChange={(p) => { setLicPage(p); loadLicencias(p, licFilters) }}
          />
        </>
      )}

      {tab === 'reincorporaciones' && (
        <>
          <FiltrosTramites onApply={handleReiFilters} showCarrera />
          {reiLoading
            ? <LoadingPage />
            : reincorporaciones.length === 0
              ? <EmptyState title="Sin reincorporaciones" icon={RotateCcw} />
              : reincorporaciones.map(rei => (
                <button
                  key={rei.id}
                  onClick={() => verDetalle(rei, 'reincorporacion')}
                  className="card flex items-center justify-between mb-3 w-full text-left hover:border-primary-200 transition-colors"
                >
                  <div>
                    <p className="font-semibold text-gray-900">{rei.codigo}</p>
                    <p className="text-sm text-gray-500">Ciclo: {rei.ciclo_retorno}</p>
                  </div>
                  <StatusBadge status={rei.status} />
                </button>
              ))
          }
          <Pagination
            page={reiPage}
            totalPages={reiPagination.total_pages}
            total={reiPagination.total}
            onChange={(p) => { setReiPage(p); loadReincorporaciones(p, reiFilters) }}
          />
        </>
      )}

      <Modal open={detalleModal} onClose={() => setDetalleModal(false)} title={`Detalle — ${detalle?.codigo}`}>
        {detalle && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500 text-xs uppercase">Estado</span>
                <div className="mt-1"><StatusBadge status={detalle.status} /></div>
              </div>
              {detalle.tipo === 'licencia' ? (
                <>
                  <div>
                    <span className="text-gray-500 text-xs uppercase">Período</span>
                    <p className="font-medium mt-1">{formatDate(detalle.fecha_inicio)} – {formatDate(detalle.fecha_fin)}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500 text-xs uppercase">Motivo</span>
                    <p className="font-medium mt-1">{detalle.motivo}</p>
                  </div>
                  {detalle.descripcion && (
                    <div className="col-span-2">
                      <span className="text-gray-500 text-xs uppercase">Descripción</span>
                      <p className="font-medium mt-1">{detalle.descripcion}</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <span className="text-gray-500 text-xs uppercase">N° RD</span>
                    <p className="font-medium mt-1">{detalle.numero_rd}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs uppercase">Ciclo retorno</span>
                    <p className="font-medium mt-1">{detalle.ciclo_retorno}</p>
                  </div>
                </>
              )}
              {detalle.numero_resolucion && (
                <div className="col-span-2">
                  <span className="text-gray-500 text-xs uppercase">N° Resolución</span>
                  <p className="font-medium mt-1">{detalle.numero_resolucion}</p>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Documentos adjuntos</p>
              {(!detalle.documentos || detalle.documentos.length === 0)
                ? <p className="text-sm text-gray-400">Sin documentos adjuntos</p>
                : detalle.documentos.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{doc.nombre_original}</p>
                      <p className="text-xs text-gray-400">{doc.tipo_documento} · {(doc.tamano_bytes / 1024).toFixed(0)} KB</p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const { data } = detalle.tipo === 'licencia'
                            ? await licenciaService.descargarDocumento(detalle.id, doc.id)
                            : await reincorporacionService.descargarDocumento(detalle.id, doc.id)
                          downloadBlob(data, doc.nombre_original)
                        } catch { toast.error('Error al descargar') }
                      }}
                      className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Descargar"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
