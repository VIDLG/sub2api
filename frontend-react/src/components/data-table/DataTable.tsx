import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  type Column,
  type ColumnDef,
  type ColumnOrderState,
  type ColumnSizingState,
  type RowSelectionState,
  type VisibilityState,
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
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { SpreadsheetIcon } from '@/components/icons'
import { Columns3 as AutoFitIcon } from 'lucide-react'
import { DataTablePagination } from './DataTablePagination'
import { SpreadsheetDialog } from './SpreadsheetDialog'

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
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
  rowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  columnVisibility?: VisibilityState
  columnOrder?: ColumnOrderState
  columnSizing?: ColumnSizingState
  onColumnSizingChange?: (sizing: ColumnSizingState) => void
  getRowId?: (row: TData) => string
  /** Render action buttons for each row. When provided, a pinned actions column is auto-injected. */
  renderRowActions?: (row: TData) => ReactNode
  /** Width of the actions column in px. Default: 100 */
  actionsColumnSize?: number
  /** When provided, shows a spreadsheet icon button that opens an AG Grid full-screen dialog. The value is used as the dialog title. */
  spreadsheetTitle?: string
  /** Extra content rendered on the right side of the table toolbar (above the column headers). */
  toolbar?: ReactNode
}

// ---------- Sticky helpers ----------

function getPinnedStyle<TData>(column: Column<TData>): React.CSSProperties | undefined {
  const pinned = column.getIsPinned()
  if (!pinned) return undefined
  return {
    position: 'sticky',
    left: pinned === 'left' ? `${column.getStart('left')}px` : undefined,
    right: pinned === 'right' ? `${column.getAfter('right')}px` : undefined,
    zIndex: 1,
  }
}

function pinnedCellClass<TData>(column: Column<TData>): string {
  if (!column.getIsPinned()) return ''
  return 'bg-background'
}

function pinnedHeaderClass<TData>(column: Column<TData>): string {
  if (!column.getIsPinned()) return ''
  // Header row already has bg set via className; pinned headers need same bg + higher z-index
  return 'bg-gray-50 dark:bg-dark-700 z-2'
}

// ---------- Component ----------

export function DataTable<TData>({
  columns,
  data,
  loading = false,
  pagination,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
  rowSelection,
  onRowSelectionChange,
  columnVisibility,
  columnOrder,
  columnSizing,
  onColumnSizingChange,
  getRowId,
  renderRowActions,
  actionsColumnSize,
  spreadsheetTitle,
  toolbar,
}: DataTableProps<TData>) {
  const { t } = useTranslation()
  const [spreadsheetOpen, setSpreadsheetOpen] = useState(false)

  // Build final columns: [select?] + user columns + [actions?]
  const finalColumns: ColumnDef<TData>[] = (() => {
    const cols: ColumnDef<TData>[] = []

    if (onRowSelectionChange) {
      cols.push({
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        size: 40,
        enableResizing: false,
        enableHiding: false,
      })
    }

    cols.push(...columns)

    if (renderRowActions) {
      cols.push({
        id: 'actions',
        header: () => t('common.actions', 'Actions'),
        cell: ({ row }) => renderRowActions(row.original),
        size: actionsColumnSize ?? 100,
        enableResizing: false,
        enableHiding: false,
      })
    }

    return cols
  })()

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns: finalColumns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: pagination?.total ?? data.length,
    enableRowSelection: !!onRowSelectionChange,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    enableColumnPinning: true,
    onRowSelectionChange,
    onColumnSizingChange: onColumnSizingChange
      ? (updater) => {
          const next = typeof updater === 'function'
            ? updater(columnSizing ?? {})
            : updater
          onColumnSizingChange(next)
        }
      : undefined,
    state: {
      rowSelection: rowSelection ?? {},
      columnVisibility: columnVisibility ?? {},
      columnOrder: columnOrder ?? [],
      columnSizing: columnSizing ?? {},
      columnPinning: {
        left: onRowSelectionChange ? ['select'] : [],
        right: renderRowActions ? ['actions'] : [],
      },
    },
    getRowId,
  })

  // Determine which is the last non-pinned column (it flexes to fill remaining space)
  const allVisibleColumns = table.getVisibleFlatColumns()
  const lastUnpinnedId = (() => {
    for (let i = allVisibleColumns.length - 1; i >= 0; i--) {
      if (!allVisibleColumns[i].getIsPinned()) return allVisibleColumns[i].id
    }
    return null
  })()

  const tableRef = useRef(table)
  tableRef.current = table

  const handleAutoFit = () => {
    // Reset all column sizing back to column definition defaults
    tableRef.current.resetColumnSizing()
    // Also notify parent if it persists column sizing
    onColumnSizingChange?.({})
  }

  return (
    <div className="card overflow-clip">
      {(spreadsheetTitle || onColumnSizingChange || toolbar) && (
        <div className="flex items-center justify-end gap-0.5 px-2 pt-1.5 pb-0">
          {toolbar && <div className="flex items-center gap-1 mr-1">{toolbar}</div>}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleAutoFit}
            title={t('common.resetColumnWidths', 'Reset column widths')}
          >
            <AutoFitIcon className="h-4 w-4" />
          </Button>
          {spreadsheetTitle && (
            <>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setSpreadsheetOpen(true)}
                title={t('common.spreadsheetView', 'Spreadsheet View')}
              >
                <SpreadsheetIcon className="h-4 w-4" />
              </Button>
              <SpreadsheetDialog
                open={spreadsheetOpen}
                onOpenChange={setSpreadsheetOpen}
                data={data}
                columns={columns}
                title={spreadsheetTitle}
              />
            </>
          )}
        </div>
      )}
      <Table
        style={{
          tableLayout: 'fixed',
          minWidth: table.getCenterTotalSize(),
        }}
      >
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className="bg-gray-50 dark:bg-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700"
            >
              {headerGroup.headers.map((header) => {
                const pinStyle = getPinnedStyle(header.column)
                const isLastUnpinned = header.column.id === lastUnpinnedId
                return (
                  <TableHead
                    key={header.id}
                    style={{
                      ...(isLastUnpinned ? undefined : { width: header.getSize() }),
                      ...pinStyle,
                    }}
                    className={`relative group/resize ${pinnedHeaderClass(header.column)}`}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onDoubleClick={() => header.column.resetSize()}
                        className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none bg-border hover:bg-primary! transition-colors ${
                          header.column.getIsResizing() ? 'bg-primary!' : ''
                        }`}
                      />
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading && data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={finalColumns.length} className="h-24 text-center">
                <div className="flex items-center justify-center">
                  <div className="spinner" />
                </div>
              </TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={finalColumns.length} className="h-24 text-center text-sm text-gray-500 dark:text-gray-400">
                {t('common.noData', 'No data')}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined}>
                {row.getVisibleCells().map((cell) => {
                  const pinStyle = getPinnedStyle(cell.column)
                  const isLastUnpinned = cell.column.id === lastUnpinnedId
                  return (
                    <TableCell
                      key={cell.id}
                      style={{
                        ...(isLastUnpinned ? undefined : { width: cell.column.getSize() }),
                        ...pinStyle,
                      }}
                      className={pinnedCellClass(cell.column)}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {pagination && pagination.totalPages > 1 && (
        <DataTablePagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          pageSize={pagination.pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          pageSizeOptions={pageSizeOptions}
          selectedCount={onRowSelectionChange ? Object.keys(rowSelection ?? {}).length : undefined}
        />
      )}
    </div>
  )
}
