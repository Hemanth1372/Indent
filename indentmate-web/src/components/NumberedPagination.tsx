type PageToken = number | 'ellipsis'

type NumberedPaginationProps = {
  currentPage: number
  totalPages: number
  loading?: boolean
  onPageChange: (page: number) => void
}

function pageTokens(currentPage: number, totalPages: number): PageToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1])

  if (currentPage <= 4) {
    pages.add(2)
    pages.add(3)
    pages.add(4)
    pages.add(5)
  }

  if (currentPage >= totalPages - 3) {
    pages.add(totalPages - 1)
    pages.add(totalPages - 2)
    pages.add(totalPages - 3)
    pages.add(totalPages - 4)
  }

  const sortedPages = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right)
  const tokens: PageToken[] = []

  for (const page of sortedPages) {
    const previous = tokens[tokens.length - 1]

    if (typeof previous === 'number' && page - previous > 1) {
      tokens.push('ellipsis')
    }

    tokens.push(page)
  }

  return tokens
}

export function NumberedPagination({ currentPage, totalPages, loading = false, onPageChange }: NumberedPaginationProps) {
  const safeTotalPages = Math.max(1, totalPages)
  const tokens = pageTokens(currentPage, safeTotalPages)

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <button
        className="h-9 rounded border border-slate-900 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-300"
        disabled={currentPage === 1 || loading}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        type="button"
      >
        Prev
      </button>

      {tokens.map((token, index) => (
        token === 'ellipsis' ? (
          <span
            className="grid h-9 min-w-9 place-items-center rounded border border-slate-900 bg-white px-2 text-sm font-semibold text-slate-500"
            key={`ellipsis-${index}`}
          >
            ...
          </span>
        ) : (
          <button
            className={`h-9 min-w-9 rounded border px-2 text-sm font-semibold transition ${
              token === currentPage
                ? 'border-slate-900 bg-blue-600 text-white'
                : 'border-slate-900 bg-white text-slate-700 hover:bg-slate-50'
            } disabled:cursor-not-allowed disabled:opacity-60`}
            disabled={loading}
            key={token}
            onClick={() => onPageChange(token)}
            type="button"
          >
            {token}
          </button>
        )
      ))}

      <button
        className="h-9 rounded border border-slate-900 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-300"
        disabled={currentPage === safeTotalPages || loading}
        onClick={() => onPageChange(Math.min(safeTotalPages, currentPage + 1))}
        type="button"
      >
        Next
      </button>
    </div>
  )
}
