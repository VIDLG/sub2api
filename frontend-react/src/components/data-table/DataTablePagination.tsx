import { Pagination } from '@/components/common/Pagination'

interface DataTablePaginationProps {
  page: number
  totalPages: number
  total: number
  onPageChange?: (page: number) => void
  selectedCount?: number
}

export function DataTablePagination({
  page,
  totalPages,
  total,
  onPageChange,
  selectedCount,
}: DataTablePaginationProps) {
  // Derive pageSize from total and totalPages
  const pageSize = totalPages > 0 ? Math.ceil(total / totalPages) : 20

  return (
    <Pagination
      page={page}
      total={total}
      pageSize={pageSize}
      onPageChange={(p) => onPageChange?.(p)}
      showPageSizeSelector={false}
      selectedCount={selectedCount}
    />
  )
}
