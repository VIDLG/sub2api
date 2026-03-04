/**
 * Usage View
 * Shows usage statistics with filtering, detailed logs table,
 * CSV export, and pagination.
 * Mirrors Vue views/user/UsageView.vue
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { ColumnDef } from '@tanstack/react-table'
import { useAppStore } from '@/stores/app'
import { usageAPI } from '@/api/usage'
import { keysAPI } from '@/api/keys'
import type { UsageLog, UsageStatsResponse, ApiKey, UsageQueryParams } from '@/types'
import { RefreshIcon, DownloadIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TimeRangePicker, DASHBOARD_PRESETS } from '@/components/common/TimeRangePicker'
import { DataTable } from '@/components/data-table/DataTable'

// ==================== Helpers ====================

function formatCost(c: number): string {
  if (c >= 1000) return (c / 1000).toFixed(2) + 'K'
  if (c >= 1) return c.toFixed(2)
  if (c >= 0.01) return c.toFixed(3)
  return c.toFixed(4)
}

function formatTokens(t: number): string {
  if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(1)}M`
  if (t >= 1000) return `${(t / 1000).toFixed(1)}K`
  return t.toString()
}

function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(0)}ms`
}

function formatDateTime(dt: string): string {
  return new Date(dt).toLocaleString()
}

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const PAGE_SIZE = 20

// ==================== Columns ====================

const columns: ColumnDef<UsageLog>[] = [
  {
    accessorKey: 'model',
    header: 'Model',
    size: 200,
    cell: ({ row }) => (
      <span className="font-medium text-gray-900 dark:text-white">{row.original.model}</span>
    ),
  },
  {
    accessorKey: 'input_tokens',
    header: 'Input',
    size: 100,
    cell: ({ row }) => (
      <span className="text-gray-600 dark:text-gray-400">
        {formatTokens(row.original.input_tokens)}
      </span>
    ),
  },
  {
    accessorKey: 'output_tokens',
    header: 'Output',
    size: 100,
    cell: ({ row }) => (
      <span className="text-gray-600 dark:text-gray-400">
        {formatTokens(row.original.output_tokens)}
      </span>
    ),
  },
  {
    id: 'cost',
    header: 'Cost',
    size: 150,
    cell: ({ row }) => (
      <>
        <span className="text-green-600 dark:text-green-400">
          ${formatCost(row.original.actual_cost)}
        </span>
        <span className="text-gray-400"> / ${formatCost(row.original.total_cost)}</span>
      </>
    ),
  },
  {
    accessorKey: 'duration_ms',
    header: 'Duration',
    size: 100,
    cell: ({ row }) => (
      <span className="text-gray-600 dark:text-gray-400">
        {formatDuration(row.original.duration_ms)}
      </span>
    ),
  },
  {
    accessorKey: 'stream',
    header: 'Stream',
    size: 80,
    cell: ({ row }) =>
      row.original.stream ? (
        <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          SSE
        </span>
      ) : (
        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          REST
        </span>
      ),
  },
  {
    accessorKey: 'created_at',
    header: 'Time',
    size: 180,
    cell: ({ row }) => (
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {formatDateTime(row.original.created_at)}
      </span>
    ),
  },
]

// ==================== Component ====================

export default function UsageView() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)

  const [page, setPage] = useState(1)
  const [selectedKeyId, setSelectedKeyId] = useState<number | undefined>(undefined)
  const [datePreset, setDatePreset] = useState('7days')
  const [startDate, setStartDate] = useState(() =>
    formatLocalDate(new Date(Date.now() - 6 * 86400000)),
  )
  const [endDate, setEndDate] = useState(() => formatLocalDate(new Date()))

  // ==================== Queries ====================

  const { data: apiKeys = [] } = useQuery<ApiKey[]>({
    queryKey: ['user', 'apiKeys'],
    queryFn: async () => {
      const res = await keysAPI.list(1, 100)
      return res.items || []
    },
  })

  const statsQuery = useQuery<UsageStatsResponse>({
    queryKey: ['user', 'usage', 'stats', startDate, endDate, selectedKeyId],
    queryFn: () => usageAPI.getStatsByDateRange(startDate, endDate, selectedKeyId),
    meta: { onError: () => showError(t('usage.statsLoadFailed', 'Failed to load statistics')) },
  })

  const logsParams: UsageQueryParams = {
    page,
    page_size: PAGE_SIZE,
    start_date: startDate,
    end_date: endDate,
    ...(selectedKeyId ? { api_key_id: selectedKeyId } : {}),
  }

  const logsQuery = useQuery({
    queryKey: ['user', 'usage', 'logs', logsParams],
    queryFn: () => usageAPI.query(logsParams),
    placeholderData: (prev) => prev,
    meta: { onError: () => showError(t('usage.logsLoadFailed', 'Failed to load usage logs')) },
  })

  const stats = statsQuery.data
  const logs: UsageLog[] = logsQuery.data?.items || []
  const totalPages = logsQuery.data?.pages ?? 1
  const total = logsQuery.data?.total ?? 0
  const loadingStats = statsQuery.isLoading
  const loadingLogs = logsQuery.isFetching

  // ==================== CSV Export ====================

  const exportCSV = () => {
    if (logs.length === 0) return
    const headers = [
      'ID',
      'Model',
      'Input Tokens',
      'Output Tokens',
      'Total Tokens',
      'Cost',
      'Actual Cost',
      'Duration (ms)',
      'Stream',
      'Created At',
    ]
    const rows = logs.map((log) => [
      log.id,
      log.model,
      log.input_tokens,
      log.output_tokens,
      log.input_tokens + log.output_tokens,
      log.total_cost,
      log.actual_cost,
      log.duration_ms,
      log.stream ? 'Yes' : 'No',
      log.created_at,
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `usage_${startDate}_${endDate}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleRefresh = () => {
    statsQuery.refetch()
    logsQuery.refetch()
  }

  // ==================== Render ====================

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="card p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t('usage.totalRequests', 'Total Requests')}
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              {stats.total_requests.toLocaleString()}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t('usage.totalTokens', 'Total Tokens')}
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              {formatTokens(stats.total_tokens)}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t('usage.totalCost', 'Total Cost')}
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              <span className="text-green-600 dark:text-green-400">
                ${formatCost(stats.total_actual_cost)}
              </span>
              <span className="text-sm font-normal text-gray-400">
                {' '}
                / ${formatCost(stats.total_cost)}
              </span>
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t('usage.avgDuration', 'Avg Duration')}
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
              {formatDuration(stats.average_duration_ms)}
            </p>
          </div>
        </div>
      )}

      {loadingStats && !stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card flex items-center justify-center p-8">
              <div className="spinner h-5 w-5" />
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
          <Select
            value={selectedKeyId != null ? String(selectedKeyId) : 'all'}
            onValueChange={(v) => {
              setSelectedKeyId(v === 'all' ? undefined : Number(v))
              setPage(1)
            }}
          >
            <SelectTrigger className="w-48 text-sm">
              <SelectValue placeholder={t('usage.allKeys', 'All Keys')} />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="all">{t('usage.allKeys', 'All Keys')}</SelectItem>
              {apiKeys.map((k) => (
                <SelectItem key={k.id} value={String(k.id)}>
                  {k.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TimeRangePicker
            value={datePreset}
            onChange={(v, range) => {
              setDatePreset(v)
              if (range) {
                setStartDate(range.from)
                setEndDate(range.to)
                setPage(1)
              }
            }}
            presets={DASHBOARD_PRESETS}
            customRange={{ from: startDate, to: endDate }}
          />
      </div>

      {/* Logs Table */}
      <DataTable
        columns={columns}
        data={logs}
        loading={loadingLogs}
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total,
          totalPages,
        }}
        onPageChange={setPage}
        getRowId={(row) => String(row.id)}
        spreadsheetTitle="Usage Logs"
        toolbar={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={exportCSV}
              disabled={logs.length === 0}
              className="flex items-center gap-1 text-sm h-7 px-2"
              title={t('usage.export', 'Export CSV')}
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              {t('usage.export', 'Export CSV')}
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={handleRefresh} title={t('common.refresh', 'Refresh')}>
              <RefreshIcon className="h-4 w-4" />
            </Button>
          </>
        }
      />
    </div>
  )
}
