import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Pagination({ page, totalPages, total, onChange }) {
  if (!total && total !== 0) return null

  const maxVisible = 5
  let start = Math.max(1, page - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages, start + maxVisible - 1)
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1)

  const pages = []
  for (let i = start; i <= end; i++) pages.push(i)

  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 flex-wrap gap-3">
      <p className="text-sm text-gray-500">
        Total: <span className="font-medium text-gray-700">{total}</span> registros
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Anterior"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>

        {start > 1 && (
          <>
            <button
              onClick={() => onChange(1)}
              className="px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            >
              1
            </button>
            {start > 2 && <span className="px-1 text-gray-400 text-sm">…</span>}
          </>
        )}

        {pages.map(p => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              p === page
                ? 'bg-primary-600 text-white'
                : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            {p}
          </button>
        ))}

        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="px-1 text-gray-400 text-sm">…</span>}
            <button
              onClick={() => onChange(totalPages)}
              className="px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Siguiente"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      <p className="text-sm text-gray-500">
        Página <span className="font-medium text-gray-700">{page}</span> de{' '}
        <span className="font-medium text-gray-700">{totalPages}</span>
      </p>
    </div>
  )
}
