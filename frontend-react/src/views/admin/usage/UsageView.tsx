/**
 * Admin Usage View — orchestrator.
 * Stats cards, charts, filters, DataTable, pagination, export & cleanup dialogs.
 * Filters apply instantly (like Vue). Uses shared DataTable + @tanstack/react-table.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useDebounceFn } from 'ahooks'
import type { ColumnSizingState, VisibilityState } from '@tanstack/react-table'
import { adminAPI } from '@/api/admin'
import type { AdminUsageQueryParams } from '@/api/admin/usage'
import type { AdminUsageLog } from '@/types'
import { RefreshIcon, DownloadIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DataTable,
  ColumnSettings,
  type ColumnSettingItem,
  loadColumnOrder,
  saveColumnOrder,
  loadColumnVisibility,
  saveColumnVisibility,
  loadColumnSizing,
  saveColumnSizing,
} from '@/components/data-table'
import { Pagination } from '@/components/common/Pagination'
import { TokenTrendChart } from '@/components/charts/TokenTrendChart'
import { ModelDistributionChart } from '@/components/charts/ModelDistributionChart'
import { USAGE_COLUMNS } from './utils/usageConstants'
import UsageStatsCards from './components/UsageStatsCards'
import UsageFilters, { type UsageFilterState } from './components/UsageFilters'
import { useUsageColumns } from './components/UsageTable'
import UsageExportDialog from './components/UsageExportDialog'
import UsageCleanupDialog from './components/UsageCleanupDialog'

// ==================== Date helpers ====================

function formatLocalDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function defaultDateRange() {
  const now = new Date()
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 6)
  return { from: formatLocalDate(weekAgo), to: formatLocalDate(now) }
}

const USAGE_TABLE_KEY = 'admin-usage'
const USAGE_DEFAULT_ORDER = USAGE_COLUMNS.map((c) => c.key)
const USAGE_DEFAULT_HIDDEN = USAGE_COLUMNS.filter((c) => !c.defaultVisible).map((c) => c.key)

// ==================== Main Component ====================

export default function UsageView() {
  const { t } = useTranslation()
  const defaultRange = defaultDateRange()
  const columns = useUsageColumns()

  // ---------- Filter state (instant-apply) ----------
  const [filters, setFilters] = useState<UsageFilterState>({})
  const [datePreset, setDatePreset] = useState('7d')
  const [dateFrom, setDateFrom] = useState(defaultRange.from)
  const [dateTo, setDateTo] = useState(defaultRange.to)

  // ---------- Pagination ----------
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // ---------- Charts ----------
  const [granularity, setGranularity] = useState<'day' | 'hour'>('day')

  // ---------- Column order & visibility ----------
  const [columnOrder, setColumnOrder] = useState<string[]>(
    () => loadColumnOrder(USAGE_TABLE_KEY, USAGE_DEFAULT_ORDER),
  )
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => loadColumnVisibility(USAGE_TABLE_KEY, USAGE_DEFAULT_HIDDEN),
  )
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(
    () => loadColumnSizing(USAGE_TABLE_KEY),
  )

  // ---------- Dialogs ----------
  const [exportOpen, setExportOpen] = useState(false)
  const [cleanupOpen, setCleanupOpen] = useState(false)

  // ---------- Build query params ----------
  const queryParams: AdminUsageQueryParams = (() => {
    const p: AdminUsageQueryParams = {
      page,
      page_size: pageSize,
      start_date: dateFrom,
      end_date: dateTo,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
    if (filters.user_id) p.user_id = filters.user_id
    if (filters.api_key_id) p.api_key_id = filters.api_key_id
    if (filters.account_id) p.account_id = filters.account_id
    if (filters.group_id) p.group_id = filters.group_id
    if (filters.model) p.model = filters.model
    if (filters.request_type) p.request_type = filters.request_type
    if (filters.billing_type != null) p.billing_type = Number(filters.billing_type)
    if (filters.stream != null) p.stream = filters.stream
    return p
  })()

  // Params without pagination (for stats / charts / export)
  const baseParams: Omit<AdminUsageQueryParams, 'page' | 'page_size'> = (() => {
    const { page: _p, page_size: _ps, ...rest } = queryParams
    return rest
  })()

  // ---------- Queries ----------
  const logsQuery = useQuery({
    queryKey: ['admin', 'usage', 'logs', queryParams],
    queryFn: () => adminAPI.usage.list(queryParams),
    staleTime: 30_000,
  })

  const statsQuery = useQuery({
    queryKey: ['admin', 'usage', 'stats', baseParams],
    queryFn: () => adminAPI.usage.getStats(baseParams),
    staleTime: 30_000,
  })

  const trendQuery = useQuery({
    queryKey: ['admin', 'usage', 'trend', baseParams, granularity],
    queryFn: () =>
      adminAPI.dashboard.getUsageTrend({
        start_date: dateFrom,
        end_date: dateTo,
        granularity,
        user_id: filters.user_id,
        api_key_id: filters.api_key_id,
        model: filters.model,
        account_id: filters.account_id,
        group_id: filters.group_id,
      }),
    staleTime: 30_000,
  })

  const modelStatsQuery = useQuery({
    queryKey: ['admin', 'usage', 'model-stats', baseParams],
    queryFn: () =>
      adminAPI.dashboard.getModelStats({
        start_date: dateFrom,
        end_date: dateTo,
        user_id: filters.user_id,
        api_key_id: filters.api_key_id,
        model: filters.model,
        account_id: filters.account_id,
        group_id: filters.group_id,
      }),
    staleTime: 30_000,
  })

  const logs = logsQuery.data?.items ?? []
  const totalRecords = logsQuery.data?.total ?? 0

  // ---------- Handlers ----------
  function handleFiltersChange(next: UsageFilterState) {
    setFilters(next)
    setPage(1)
  }

  function handleReset() {
    const range = defaultDateRange()
    setFilters({})
    setDatePreset('7d')
    setDateFrom(range.from)
    setDateTo(range.to)
    setGranularity('day')
    setPage(1)
  }

  function handleRefresh() {
    logsQuery.refetch()
    statsQuery.refetch()
    trendQuery.refetch()
    modelStatsQuery.refetch()
  }

  function handleDateChange(preset: string, range?: { from: string; to: string }) {
    setDatePreset(preset)
    if (range) {
      setDateFrom(range.from)
      setDateTo(range.to)
    }
    setPage(1)
  }

  function handleColumnOrderChange(order: string[]) {
    setColumnOrder(order)
    saveColumnOrder(USAGE_TABLE_KEY, order)
  }

  function handleColumnVisibilityChange(id: string, visible: boolean) {
    setColumnVisibility((prev) => {
      const next = { ...prev, [id]: visible }
      saveColumnVisibility(USAGE_TABLE_KEY, next)
      return next
    })
  }

  const { run: debouncedSaveColumnSizing } = useDebounceFn(
    (sizing: ColumnSizingState) => saveColumnSizing(USAGE_TABLE_KEY, sizing),
    { wait: 300 },
  )
  function handleColumnSizingChange(sizing: ColumnSizingState) {
    setColumnSizing(sizing)
    debouncedSaveColumnSizing(sizing)
  }

  function handleColumnReset() {
    setColumnOrder(USAGE_DEFAULT_ORDER)
    setColumnVisibility(() => {
      const state: VisibilityState = {}
      for (const key of USAGE_DEFAULT_HIDDEN) {
        state[key] = false
      }
      return state
    })
    setColumnSizing({})
    saveColumnOrder(USAGE_TABLE_KEY, USAGE_DEFAULT_ORDER)
    saveColumnVisibility(USAGE_TABLE_KEY, (() => {
      const state: VisibilityState = {}
      for (const key of USAGE_DEFAULT_HIDDEN) {
        state[key] = false
      }
      return state
    })())
    saveColumnSizing(USAGE_TABLE_KEY, {})
  }

  // Build column setting items for ColumnSettings component
  const columnSettingItems: ColumnSettingItem[] = (() => {
    const meta = new Map(USAGE_COLUMNS.map((c) => [c.key, c]))
    const order = columnOrder.length > 0 ? columnOrder : USAGE_DEFAULT_ORDER
    const items: ColumnSettingItem[] = []
    for (const id of order) {
      const m = meta.get(id)
      if (m) {
        items.push({
          id: m.key,
          label: t(m.labelKey, m.labelFallback),
          visible: columnVisibility[m.key] !== false,
          alwaysVisible: m.alwaysVisible,
        })
      }
    }
    return items
  })()

  function handlePageChange(p: number) {
    setPage(p)
  }

  function handlePageSizeChange(size: number) {
    setPageSize(size)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <UsageStatsCards stats={statsQuery.data ?? null} loading={statsQuery.isLoading} />

      {/* Charts section */}
      <div className="space-y-3">
        <div className="card flex items-center gap-3 p-3">
          <span className="text-sm font-medium text-muted-foreground">
            {t('admin.dashboard.granularity', 'Granularity')}:
          </span>
          <Select value={granularity} onValueChange={(v) => setGranularity(v as 'day' | 'hour')}>
            <SelectTrigger className="w-24 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">{t('admin.dashboard.day', 'Day')}</SelectItem>
              <SelectItem value="hour">{t('admin.dashboard.hour', 'Hour')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="card p-4">
            <h3 className="mb-2 text-sm font-medium">
              {t('admin.dashboard.tokenTrend', 'Token Usage Trend')}
            </h3>
            <TokenTrendChart data={trendQuery.data?.trend ?? []} loading={trendQuery.isLoading} />
          </div>
          <div className="card p-4">
            <h3 className="mb-2 text-sm font-medium">
              {t('admin.dashboard.modelDistribution', 'Model Distribution')}
            </h3>
            <ModelDistributionChart
              data={modelStatsQuery.data?.models ?? []}
              loading={modelStatsQuery.isLoading}
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <UsageFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        datePreset={datePreset}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateChange={handleDateChange}
        onReset={handleReset}
        onCleanup={() => setCleanupOpen(true)}
      />

      {/* Table — uses shared DataTable with column visibility */}
      <DataTable<AdminUsageLog>
        columns={columns}
        data={logs}
        loading={logsQuery.isLoading}
        columnVisibility={columnVisibility}
        columnOrder={columnOrder}
        columnSizing={columnSizing}
        onColumnSizingChange={handleColumnSizingChange}
        getRowId={(row) => String(row.id)}
        spreadsheetTitle="Usage Logs"
        toolbar={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExportOpen(true)}
              className="flex items-center gap-1 text-sm h-7 px-2"
              title={t('admin.usage.exportExcel', 'Export Excel')}
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              {t('admin.usage.exportExcel', 'Export Excel')}
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={handleRefresh} title={t('common.refresh', 'Refresh')}>
              <RefreshIcon className="h-4 w-4" />
            </Button>
            <ColumnSettings
              columns={columnSettingItems}
              columnOrder={columnOrder}
              onColumnOrderChange={handleColumnOrderChange}
              onVisibilityChange={handleColumnVisibilityChange}
              onReset={handleColumnReset}
            />
          </>
        }
      />

      {/* Pagination — separate from DataTable for page size control */}
      {totalRecords > 0 && (
        <Pagination
          page={page}
          total={totalRecords}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      {/* Export dialog */}
      <UsageExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        queryParams={queryParams}
        totalRecords={totalRecords}
      />

      {/* Cleanup dialog */}
      <UsageCleanupDialog
        open={cleanupOpen}
        onOpenChange={setCleanupOpen}
        parentFilters={filters}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />
    </div>
  )
}
