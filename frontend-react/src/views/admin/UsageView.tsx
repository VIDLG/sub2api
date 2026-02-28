/**
 * Admin Usage View
 * Displays usage statistics, filterable logs table, and CSV export.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { AdminUsageLog, PaginatedResponse, UsageStats } from '@/types'
import { SearchIcon, RefreshIcon, DownloadIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DateRangePicker } from '@/components/ui/date-range-picker'

// ==================== Constants ====================

const PAGE_SIZE = 20

// ==================== Helpers ====================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

function formatTokens(n: number | null | undefined): string {
  if (n == null) return '-'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatCost(n: number | null | undefined): string {
  if (n == null) return '-'
  return `$${n.toFixed(4)}`
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '-'
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

// ==================== Component ====================

export default function UsageView() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)

  const [userSearch, setUserSearch] = useState('')
  const [apiKeySearch, setApiKeySearch] = useState('')
  const [model, setModel] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [streamFilter, setStreamFilter] = useState<'' | 'true' | 'false'>('')

  // Committed filter state — only applied when user clicks Search
  const [committed, setCommitted] = useState({
    userSearch: '',
    apiKeySearch: '',
    model: '',
    dateFrom: '',
    dateTo: '',
    streamFilter: '' as '' | 'true' | 'false',
    page: 1,
  })

  const [exporting, setExporting] = useState(false)

  // ==================== Queries ====================

  const logsParams = {
    page: committed.page,
    page_size: PAGE_SIZE,
    ...(committed.userSearch && { user_search: committed.userSearch }),
    ...(committed.apiKeySearch && { api_key: committed.apiKeySearch }),
    ...(committed.model && { model: committed.model }),
    ...(committed.dateFrom && { start_date: committed.dateFrom }),
    ...(committed.dateTo && { end_date: committed.dateTo }),
    ...(committed.streamFilter && { stream: committed.streamFilter === 'true' }),
  }

  const logsQuery = useQuery<PaginatedResponse<AdminUsageLog>>({
    queryKey: ['admin', 'usage', 'logs', logsParams],
    queryFn: ({ signal }) => adminAPI.usage.list(logsParams, { signal }),
    placeholderData: (prev) => prev,
    meta: { onError: () => showError(t('admin.usage.loadFailed', 'Failed to load usage logs')) },
  })

  const statsQuery = useQuery<UsageStats>({
    queryKey: ['admin', 'usage', 'stats', committed.model, committed.dateFrom, committed.dateTo],
    queryFn: () =>
      adminAPI.usage.getStats({
        model: committed.model || undefined,
        start_date: committed.dateFrom || undefined,
        end_date: committed.dateTo || undefined,
      }),
  })

  const logs = logsQuery.data?.items || []
  const total = logsQuery.data?.total ?? 0
  const pages = logsQuery.data?.pages ?? 0
  const stats = statsQuery.data
  const loading = logsQuery.isFetching
  const statsLoading = statsQuery.isLoading

  // ==================== Actions ====================

  const handleSearch = () => {
    setCommitted({ userSearch, apiKeySearch, model, dateFrom, dateTo, streamFilter, page: 1 })
  }

  const handleClear = () => {
    setUserSearch('')
    setApiKeySearch('')
    setModel('')
    setDateFrom('')
    setDateTo('')
    setStreamFilter('')
    setCommitted({
      userSearch: '',
      apiKeySearch: '',
      model: '',
      dateFrom: '',
      dateTo: '',
      streamFilter: '',
      page: 1,
    })
  }

  const handlePageChange = (p: number) => {
    setCommitted((prev) => ({ ...prev, page: p }))
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const filters: Record<string, string> = {}
      if (committed.userSearch) filters.user_search = committed.userSearch
      if (committed.apiKeySearch) filters.api_key = committed.apiKeySearch
      if (committed.model) filters.model = committed.model
      if (committed.dateFrom) filters.date_from = committed.dateFrom
      if (committed.dateTo) filters.date_to = committed.dateTo
      if (committed.streamFilter) filters.stream = committed.streamFilter

      const data = await adminAPI.usage.list({ page: 1, page_size: 10000, ...filters })
      const items = data.items || []

      const headers = [
        'ID',
        'User',
        'API Key',
        'Account',
        'Model',
        'Prompt Tokens',
        'Completion Tokens',
        'Total Tokens',
        'Cost',
        'Duration (ms)',
        'Stream',
        'Time',
      ]
      const rows = items.map((log) => [
        log.id,
        log.user_email || log.user_id || '',
        log.api_key_name || log.api_key_id || '',
        log.account_name || log.account_id || '',
        log.model || '',
        log.prompt_tokens ?? '',
        log.completion_tokens ?? '',
        log.total_tokens ?? '',
        log.cost ?? '',
        log.duration_ms ?? '',
        log.stream ? 'Yes' : 'No',
        log.created_at || '',
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `usage_export_${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
      showSuccess(t('admin.usage.exported', 'Usage data exported'))
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }; message?: string }
      showError(error?.response?.data?.detail || error?.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  // ==================== Render ====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">{t('admin.usage.title', 'Usage')}</h1>
          <p className="page-description">
            {t('admin.usage.description', 'API usage logs and statistics')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              logsQuery.refetch()
              statsQuery.refetch()
            }}
            title={t('common.refresh', 'Refresh')}
          >
            <RefreshIcon className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <span className="spinner h-4 w-4" />
            ) : (
              <DownloadIcon className="h-4 w-4" />
            )}
            {t('admin.usage.export', 'Export CSV')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card">
          <div className="stat-icon stat-icon-primary">
            <span className="text-lg font-bold">#</span>
          </div>
          <div className="min-w-0">
            <div className="stat-value">
              {statsLoading ? (
                <span className="skeleton h-7 w-20 inline-block" />
              ) : (
                formatTokens(stats?.total_requests)
              )}
            </div>
            <div className="stat-label">{t('admin.usage.totalRequests', 'Total Requests')}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-success">
            <span className="text-lg font-bold">T</span>
          </div>
          <div className="min-w-0">
            <div className="stat-value">
              {statsLoading ? (
                <span className="skeleton h-7 w-20 inline-block" />
              ) : (
                formatTokens(stats?.total_tokens)
              )}
            </div>
            <div className="stat-label">{t('admin.usage.totalTokens', 'Total Tokens')}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-warning">
            <span className="text-lg font-bold">$</span>
          </div>
          <div className="min-w-0">
            <div className="stat-value">
              {statsLoading ? (
                <span className="skeleton h-7 w-20 inline-block" />
              ) : (
                formatCost(stats?.total_cost)
              )}
            </div>
            <div className="stat-label">{t('admin.usage.totalCost', 'Total Cost')}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-danger">
            <span className="text-lg font-bold">ms</span>
          </div>
          <div className="min-w-0">
            <div className="stat-value">
              {statsLoading ? (
                <span className="skeleton h-7 w-20 inline-block" />
              ) : (
                formatDuration(stats?.average_duration_ms)
              )}
            </div>
            <div className="stat-label">{t('admin.usage.avgDuration', 'Avg Duration')}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('admin.usage.userSearch', 'Search user...')}
              className="pl-9 text-sm"
            />
          </div>
          <Input
            type="text"
            value={apiKeySearch}
            onChange={(e) => setApiKeySearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t('admin.usage.apiKeySearch', 'API key name...')}
            className="text-sm"
          />
          <Input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t('admin.usage.model', 'Model...')}
            className="text-sm"
          />
          <Select
            value={streamFilter || 'all'}
            onValueChange={(v) => setStreamFilter(v === 'all' ? '' : (v as 'true' | 'false'))}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder={t('admin.usage.allStream', 'All (Stream)')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.usage.allStream', 'All (Stream)')}</SelectItem>
              <SelectItem value="true">{t('admin.usage.streamYes', 'Stream: Yes')}</SelectItem>
              <SelectItem value="false">{t('admin.usage.streamNo', 'Stream: No')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <DateRangePicker
            startDate={dateFrom}
            endDate={dateTo}
            onChange={({ startDate: s, endDate: e }) => {
              setDateFrom(s)
              setDateTo(e)
            }}
          />
          <Button variant="secondary" size="sm" onClick={handleSearch}>
            <SearchIcon className="h-4 w-4" />
            {t('common.search', 'Search')}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClear}>
            {t('common.clear', 'Clear')}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="table-wrapper overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>{t('admin.usage.user', 'User')}</th>
                <th>{t('admin.usage.apiKey', 'API Key')}</th>
                <th>{t('admin.usage.account', 'Account')}</th>
                <th>{t('admin.usage.modelCol', 'Model')}</th>
                <th>{t('admin.usage.tokens', 'Tokens')}</th>
                <th>{t('admin.usage.cost', 'Cost')}</th>
                <th>{t('admin.usage.duration', 'Duration')}</th>
                <th>{t('admin.usage.stream', 'Stream')}</th>
                <th>{t('admin.usage.time', 'Time')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12">
                    <div className="spinner mx-auto" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-500">
                    {t('common.noData', 'No data')}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div className="max-w-[120px] truncate text-sm" title={log.user_email || ''}>
                        {log.user_email || log.user_id || '-'}
                      </div>
                    </td>
                    <td>
                      <div
                        className="max-w-[120px] truncate text-sm"
                        title={log.api_key_name || ''}
                      >
                        {log.api_key_name || log.api_key_id || '-'}
                      </div>
                    </td>
                    <td>
                      <div
                        className="max-w-[120px] truncate text-sm"
                        title={log.account_name || ''}
                      >
                        {log.account_name || log.account_id || '-'}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-primary text-xs">{log.model || '-'}</span>
                    </td>
                    <td>
                      <div className="text-xs">
                        <div>
                          {formatTokens(log.prompt_tokens)} / {formatTokens(log.completion_tokens)}
                        </div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {formatTokens(log.total_tokens)}
                        </div>
                      </div>
                    </td>
                    <td className="text-sm">{formatCost(log.cost)}</td>
                    <td className="text-sm">{formatDuration(log.duration_ms)}</td>
                    <td>
                      {log.stream ? (
                        <span className="badge badge-success text-xs">SSE</span>
                      ) : (
                        <span className="badge badge-gray text-xs">JSON</span>
                      )}
                    </td>
                    <td className="text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 dark:border-dark-700 px-4 py-3">
            <span className="text-sm text-gray-500">
              {t('common.total', 'Total')}: {total}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={committed.page <= 1}
                onClick={() => handlePageChange(committed.page - 1)}
              >
                {t('common.prev', 'Prev')}
              </Button>
              <span className="px-3 text-sm text-gray-700 dark:text-gray-300">
                {committed.page} / {pages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={committed.page >= pages}
                onClick={() => handlePageChange(committed.page + 1)}
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
