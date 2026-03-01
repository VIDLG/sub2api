/**
 * Usage View
 * Shows usage statistics with filtering, detailed logs table,
 * CSV export, and pagination.
 * Mirrors Vue views/user/UsageView.vue
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('usage.title', 'Usage')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('usage.description', 'View your API usage statistics and logs.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={exportCSV}
            disabled={logs.length === 0}
            className="flex items-center gap-2 text-sm"
            title={t('usage.export', 'Export CSV')}
          >
            <DownloadIcon className="h-4 w-4" />
            {t('usage.export', 'Export CSV')}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            title={t('common.refresh', 'Refresh')}
          >
            <RefreshIcon className="h-5 w-5" />
          </Button>
        </div>
      </div>

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
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('usage.apiKey', 'API Key')}:
            </label>
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
          </div>
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
      </div>

      {/* Logs Table */}
      <div className="card overflow-hidden">
        {loadingLogs && logs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner" />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('usage.noLogs', 'No usage logs found for this period.')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500 dark:border-dark-700 dark:bg-dark-800 dark:text-gray-400">
                  <th className="px-4 py-3">{t('usage.model', 'Model')}</th>
                  <th className="px-4 py-3">{t('usage.inputTokens', 'Input')}</th>
                  <th className="px-4 py-3">{t('usage.outputTokens', 'Output')}</th>
                  <th className="px-4 py-3">{t('usage.cost', 'Cost')}</th>
                  <th className="px-4 py-3">{t('usage.duration', 'Duration')}</th>
                  <th className="px-4 py-3">{t('usage.stream', 'Stream')}</th>
                  <th className="px-4 py-3">{t('usage.time', 'Time')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-gray-50 transition-colors hover:bg-gray-50 dark:border-dark-800 dark:hover:bg-dark-800/50"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900 dark:text-white">{log.model}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {formatTokens(log.input_tokens)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {formatTokens(log.output_tokens)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-green-600 dark:text-green-400">
                        ${formatCost(log.actual_cost)}
                      </span>
                      <span className="text-gray-400"> / ${formatCost(log.total_cost)}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {formatDuration(log.duration_ms)}
                    </td>
                    <td className="px-4 py-3">
                      {log.stream ? (
                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          SSE
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          REST
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {formatDateTime(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-dark-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t('common.showing', 'Showing')} {(page - 1) * PAGE_SIZE + 1}-
              {Math.min(page * PAGE_SIZE, total)} {t('common.of', 'of')} {total}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                {t('common.prev', 'Prev')}
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .map((p, idx, arr) => (
                  <span key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                      <span className="px-1 text-gray-400">...</span>
                    )}
                    <Button
                      variant={p === page ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  </span>
                ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                {t('common.next', 'Next')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
