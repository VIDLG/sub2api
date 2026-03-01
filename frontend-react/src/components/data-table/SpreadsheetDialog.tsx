/**
 * Full-screen spreadsheet viewer powered by AG Grid Community.
 * Opens as a dialog overlay — the user's table filters/pagination state is preserved.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { ColumnDef } from '@tanstack/react-table'
import type { ColDef, GridReadyEvent, GridApi } from 'ag-grid-community'
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  colorSchemeDark,
  colorSchemeLight,
} from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DownloadIcon, RefreshIcon } from '@/components/icons'
import { Columns3 as AutoFitIcon } from 'lucide-react'

// Register AG Grid modules once
ModuleRegistry.registerModules([AllCommunityModule])

// ==================== Themes ====================

const lightTheme = themeQuartz.withPart(colorSchemeLight).withParams({
  spacing: 6,
  fontSize: 13,
  headerFontSize: 13,
  rowHeight: 36,
  headerHeight: 40,
  accentColor: '#14b8a6',
  backgroundColor: '#ffffff',
  foregroundColor: '#1f2937',
  headerBackgroundColor: '#f8fafc',
  headerForegroundColor: '#374151',
  borderColor: '#e2e8f0',
  rowBorder: '#f1f5f9',
  columnBorder: '#f1f5f9',
  selectedRowBackgroundColor: '#f0fdfa',
  rangeSelectionBorderColor: '#14b8a6',
})

const darkTheme = themeQuartz.withPart(colorSchemeDark).withParams({
  spacing: 6,
  fontSize: 13,
  headerFontSize: 13,
  rowHeight: 36,
  headerHeight: 40,
  accentColor: '#2dd4bf',
  backgroundColor: '#0f172a',
  foregroundColor: '#e2e8f0',
  headerBackgroundColor: '#1e293b',
  headerForegroundColor: '#cbd5e1',
  borderColor: 'rgba(255, 255, 255, 0.1)',
  rowBorder: 'rgba(255, 255, 255, 0.05)',
  columnBorder: 'rgba(255, 255, 255, 0.05)',
  selectedRowBackgroundColor: '#042f2e',
  rangeSelectionBorderColor: '#2dd4bf',
})

// ==================== Column Conversion ====================

/**
 * Convert TanStack ColumnDef[] to AG Grid ColDef[].
 * Uses accessorKey as field, header string as headerName.
 * Skips select/actions columns (auto-injected by DataTable).
 */
function convertColumns<TData>(tanstackCols: ColumnDef<TData>[]): ColDef[] {
  return tanstackCols
    .filter((col) => {
      const id = (col as { id?: string }).id
      return id !== 'select' && id !== 'actions'
    })
    .map((col) => {
      const accessorKey = (col as { accessorKey?: string }).accessorKey
      const id = (col as { id?: string }).id
      const header = col.header
      const size = (col as { size?: number }).size

      const agCol: ColDef = {
        field: accessorKey || id || undefined,
        colId: id || accessorKey || undefined,
        headerName: typeof header === 'string' ? header : (id || accessorKey || ''),
        filter: true,
        sortable: true,
        resizable: true,
        width: size,
      }

      return agCol
    })
}

// ==================== Component ====================

interface SpreadsheetDialogProps<TData> {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: TData[]
  columns: ColumnDef<TData>[]
  title?: string
}

export function SpreadsheetDialog<TData>({
  open,
  onOpenChange,
  data,
  columns,
  title,
}: SpreadsheetDialogProps<TData>) {
  const { t } = useTranslation()
  const [gridApi, setGridApi] = useState<GridApi | null>(null)
  const [isDark, setIsDark] = useState(false)

  // Observe dark mode from document.documentElement
  useEffect(() => {
    if (!open) return

    const html = document.documentElement
    setIsDark(html.classList.contains('dark'))

    const observer = new MutationObserver(() => {
      setIsDark(html.classList.contains('dark'))
    })
    observer.observe(html, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [open])

  const agColumns = convertColumns(columns)

  const onGridReady = (params: GridReadyEvent) => {
    setGridApi(params.api)
    // Auto-size columns to fit content
    params.api.autoSizeAllColumns()
  }

  const handleExportCsv = () => {
    gridApi?.exportDataAsCsv({
      fileName: `${title || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`,
    })
  }

  const handleAutoSize = () => {
    gridApi?.autoSizeAllColumns()
  }

  const handleResetColumns = () => {
    gridApi?.resetColumnState()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[90vh] max-w-[95vw] flex-col gap-3 p-4 sm:max-w-[95vw]"
        showCloseButton
      >
        <DialogHeader className="shrink-0 flex-row items-center justify-between gap-4 pr-8">
          <div>
            <DialogTitle>
              {title || t('common.spreadsheetView', 'Spreadsheet View')}
            </DialogTitle>
            <DialogDescription>
              {t('common.spreadsheetDescription', '{{count}} rows — sort, filter, resize columns', {
                count: data.length,
              })}
            </DialogDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAutoSize}
              title={t('common.autoFitColumns', 'Auto-fit columns')}
              className="gap-1.5"
            >
              <AutoFitIcon className="h-4 w-4" />
              {t('common.autoFit', 'Auto-fit')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetColumns}
              title={t('common.resetColumns', 'Reset columns')}
              className="gap-1.5"
            >
              <RefreshIcon className="h-4 w-4" />
              {t('common.reset', 'Reset')}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleExportCsv} className="gap-1.5">
              <DownloadIcon className="h-4 w-4" />
              CSV
            </Button>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1">
          <AgGridReact
            theme={isDark ? darkTheme : lightTheme}
            rowData={data as Record<string, unknown>[]}
            columnDefs={agColumns}
            onGridReady={onGridReady}
            defaultColDef={{
              filter: true,
              sortable: true,
              resizable: true,
              minWidth: 60,
            }}
            animateRows={false}
            enableCellTextSelection
            ensureDomOrder
            suppressCellFocus
            pagination
            paginationPageSize={100}
            paginationPageSizeSelector={[50, 100, 200, 500, 1000]}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
