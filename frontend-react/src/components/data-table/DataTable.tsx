import { useTranslation } from 'react-i18next'
import {
  type ColumnDef,
  type RowSelectionState,
  type OnChangeFn,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination } from './DataTablePagination'

export interface ServerPagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[]
  data: TData[]
  loading?: boolean
  pagination?: ServerPagination
  onPageChange?: (page: number) => void
  rowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  getRowId?: (row: TData) => string
}

export function DataTable<TData>({
  columns,
  data,
  loading = false,
  pagination,
  onPageChange,
  rowSelection,
  onRowSelectionChange,
  getRowId,
}: DataTableProps<TData>) {
  const { t } = useTranslation()

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: pagination?.total ?? data.length,
    enableRowSelection: !!onRowSelectionChange,
    onRowSelectionChange,
    state: {
      rowSelection: rowSelection ?? {},
    },
    getRowId,
  })

  return (
    <div className="card overflow-hidden">
      {loading && data.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
        </div>
      ) : data.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
          {t('common.noData', 'No data')}
        </div>
      ) : (
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="bg-gray-50 dark:bg-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={
                      header.column.getSize() !== 150
                        ? { width: header.column.getSize() }
                        : undefined
                    }
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? 'selected' : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext(),
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {pagination && pagination.totalPages > 1 && (
        <DataTablePagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={onPageChange}
          selectedCount={
            onRowSelectionChange
              ? Object.keys(rowSelection ?? {}).length
              : undefined
          }
        />
      )}
    </div>
  )
}
