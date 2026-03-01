import { Pagination } from '@/components/common/Pagination'

interface DataTablePaginationProps {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
  selectedCount?: number
}

export function DataTablePagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
  selectedCount,
}: DataTablePaginationProps) {
  return (
    <Pagination
      page={page}
      total={total}
      pageSize={pageSize}
      onPageChange={(p) => onPageChange?.(p)}
      showPageSizeSelector={!!onPageSizeChange}
      onPageSizeChange={onPageSizeChange}
      pageSizeOptions={pageSizeOptions}
      selectedCount={selectedCount}
    />
  )
}
