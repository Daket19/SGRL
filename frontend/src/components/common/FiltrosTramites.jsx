import { useState } from 'react'
import { Filter, X } from 'lucide-react'
import { STATUS_LABELS } from '../../utils'

export function FiltrosTramites({
  onApply,
  showStatus = true,
  showCarrera = false,
  showFechas = true,
}) {
  const [status, setStatus] = useState('')
  const [carrera, setCarrera] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const buildFilters = () => {
    const f = {}
    if (status) f.status = status
    if (carrera) f.carrera = carrera
    if (fechaDesde) f.fecha_inicio = fechaDesde
    if (fechaHasta) f.fecha_fin = fechaHasta
    return f
  }

  const handleApply = () => onApply(buildFilters())

  const handleClear = () => {
    setStatus('')
    setCarrera('')
    setFechaDesde('')
    setFechaHasta('')
    onApply({})
  }

  const hasFilters = status || carrera || fechaDesde || fechaHasta

  // Conteo de columnas: status + carrera + 2 fechas (cada una cuenta como 1)
  const colCount = [showStatus, showCarrera, showFechas, showFechas].filter(Boolean).length
  const gridClass =
    colCount <= 2
      ? 'grid grid-cols-1 sm:grid-cols-2 gap-3'
      : colCount <= 3
        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'
        : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'

  return (
    <div className="card mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-700">Filtros</span>
        {hasFilters && (
          <button
            onClick={handleClear}
            className="ml-auto flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
          >
            <X className="w-3 h-3" /> Limpiar
          </button>
        )}
      </div>

      <div className={gridClass}>
        {showStatus && (
          <select value={status} onChange={e => setStatus(e.target.value)} className="input text-sm">
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        )}

        {showCarrera && (
          <input
            value={carrera}
            onChange={e => setCarrera(e.target.value)}
            placeholder="Filtrar por carrera..."
            className="input text-sm"
          />
        )}

        {showFechas && (
          <>
            <input
              type="date"
              value={fechaDesde}
              onChange={e => setFechaDesde(e.target.value)}
              className="input text-sm"
              title="Fecha desde"
            />
            <input
              type="date"
              value={fechaHasta}
              onChange={e => setFechaHasta(e.target.value)}
              className="input text-sm"
              title="Fecha hasta"
            />
          </>
        )}
      </div>

      <div className="flex justify-end mt-3">
        <button onClick={handleApply} className="btn-primary text-sm">
          Aplicar filtros
        </button>
      </div>
    </div>
  )
}
