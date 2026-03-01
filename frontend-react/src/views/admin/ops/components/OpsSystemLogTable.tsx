/**
 * OpsSystemLogTable
 * Paginated system log viewer with runtime log config and sink health.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDebounce } from 'ahooks'
import type { ColumnDef } from '@tanstack/react-table'
import { opsAPI } from '@/api/admin/ops'
import type { OpsRuntimeLogConfig, OpsSystemLogQuery } from '@/api/admin/ops'
import { LoaderCircleIcon } from 'lucide-react'
import { RefreshIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TimeRangePicker, SYSTEM_LOG_PRESETS } from '@/components/common/TimeRangePicker'
import { DataTable } from '@/components/data-table/DataTable'
import { useAppStore } from '@/stores/app'
import { cn } from '@/lib/utils'

// ==================== Types ====================

interface SystemLogRow {
  id: number
  level: string
  message?: string
  component?: string
  request_id?: string
  client_request_id?: string
  user_id?: number | null
  account_id?: number | null
  platform?: string
  model?: string
  extra?: Record<string, unknown>
  created_at: string
}

// ==================== Helpers ====================

function levelClass(level: string) {
  const l = level.toLowerCase()
  if (l === 'error' || l === 'fatal')
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  if (l === 'warn' || l === 'warning')
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  if (l === 'debug') return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
  return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
}

function fmtTime(s: string) {
  if (!s) return '—'
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString()
}

function formatLogDetail(row: SystemLogRow): string {
  const parts: string[] = []
  const msg = String(row.message || '').trim()
  if (msg) parts.push(msg)

  const extra = row.extra ?? {}
  const get = (k: string) => {
    const v = extra[k]
    if (v == null) return ''
    if (typeof v === 'string') return v.trim()
    if (typeof v === 'number' || typeof v === 'boolean') return String(v)
    return ''
  }

  const accessParts: string[] = []
  const sc = get('status_code')
  const lat = get('latency_ms')
  const meth = get('method')
  const path = get('path')
  const ip = get('client_ip')
  const proto = get('protocol')
  if (sc) accessParts.push(`status=${sc}`)
  if (lat) accessParts.push(`latency_ms=${lat}`)
  if (meth) accessParts.push(`method=${meth}`)
  if (path) accessParts.push(`path=${path}`)
  if (ip) accessParts.push(`ip=${ip}`)
  if (proto) accessParts.push(`proto=${proto}`)
  if (accessParts.length) parts.push(accessParts.join(' '))

  const corrParts: string[] = []
  if (row.request_id) corrParts.push(`req=${row.request_id}`)
  if (row.client_request_id) corrParts.push(`client_req=${row.client_request_id}`)
  if (row.user_id != null) corrParts.push(`user=${row.user_id}`)
  if (row.account_id != null) corrParts.push(`acc=${row.account_id}`)
  if (row.platform) corrParts.push(`platform=${row.platform}`)
  if (row.model) corrParts.push(`model=${row.model}`)
  if (corrParts.length) parts.push(corrParts.join(' '))

  const errors = get('errors')
  if (errors) parts.push(`errors=${errors}`)
  const err = get('err') || get('error')
  if (err) parts.push(`error=${err}`)

  return parts.join('  ')
}

// ==================== Columns ====================

const logColumns: ColumnDef<SystemLogRow>[] = [
  {
    accessorKey: 'created_at',
    header: 'Time',
    size: 170,
    cell: ({ row }) => (
      <span className="text-xs text-gray-600 dark:text-gray-400">
        {fmtTime(row.original.created_at)}
      </span>
    ),
  },
  {
    accessorKey: 'level',
    header: 'Level',
    size: 70,
    cell: ({ row }) => (
      <span
        className={cn(
          'inline-block rounded-full px-1.5 py-0.5 text-xs font-semibold',
          levelClass(row.original.level),
        )}
      >
        {row.original.level}
      </span>
    ),
  },
  {
    id: 'detail',
    header: 'Detail',
    cell: ({ row }) => (
      <span className="break-all text-xs text-gray-700 dark:text-gray-300">
        {formatLogDetail(row.original)}
      </span>
    ),
  },
]

// ==================== Defaults ====================

const defaultFilters: OpsSystemLogQuery = {
  time_range: '1h',
  level: '',
  component: '',
  request_id: '',
  client_request_id: '',
  user_id: undefined,
  account_id: undefined,
  platform: '',
  model: '',
  q: '',
}

const defaultRuntimeConfig: OpsRuntimeLogConfig = {
  level: 'info',
  enable_sampling: false,
  sampling_initial: 100,
  sampling_thereafter: 100,
  caller: true,
  stacktrace_level: 'error',
  retention_days: 30,
}

const LOG_LEVELS = ['debug', 'info', 'warn', 'error']
const STACKTRACE_LEVELS = ['none', 'error', 'fatal']
const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200]

// ==================== Component ====================

interface Props {
  platformFilter: string
  opsEnabled: boolean
}

export function OpsSystemLogTable({ platformFilter, opsEnabled }: Props) {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)
  const queryClient = useQueryClient()

  const [filters, setFilters] = useState<OpsSystemLogQuery>({
    ...defaultFilters,
    platform: platformFilter || '',
  })
  const [customRange, setCustomRange] = useState<{ from: string; to: string } | undefined>()
  const debouncedFilters = useDebounce(filters, { wait: 400 })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [runtimeConfig, setRuntimeConfig] = useState<OpsRuntimeLogConfig>(defaultRuntimeConfig)

  // Sync platform filter from parent
  useEffect(() => {
    if (platformFilter) {
      setFilters((f) => ({ ...f, platform: platformFilter }))
    }
  }, [platformFilter])

  // Helper to update a filter field and reset page
  const updateFilter = (patch: Partial<OpsSystemLogQuery>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setPage(1)
  }

  // ---- Queries ----

  const logsQuery = useQuery({
    queryKey: ['ops', 'systemLogs', debouncedFilters, customRange, page, pageSize],
    queryFn: () => {
      const { time_range, ...rest } = debouncedFilters
      const timeParams =
        time_range === 'custom' && customRange
          ? { start_time: customRange.from + 'T00:00:00Z', end_time: customRange.to + 'T23:59:59Z' }
          : { time_range }
      return opsAPI.listSystemLogs({ ...rest, ...timeParams, page, page_size: pageSize })
    },
    enabled: opsEnabled,
  })

  const healthQuery = useQuery({
    queryKey: ['ops', 'systemLogHealth'],
    queryFn: () => opsAPI.getSystemLogSinkHealth(),
    enabled: opsEnabled,
    refetchInterval: 30_000,
  })

  const runtimeQuery = useQuery({
    queryKey: ['ops', 'runtimeLogConfig'],
    queryFn: () => opsAPI.getRuntimeLogConfig(),
    enabled: opsEnabled,
  })

  useEffect(() => {
    if (runtimeQuery.data) {
      setRuntimeConfig(runtimeQuery.data)
    }
  }, [runtimeQuery.data])

  // ---- Mutations ----

  const saveMutation = useMutation({
    mutationFn: () => opsAPI.updateRuntimeLogConfig(runtimeConfig),
    onSuccess: (saved) => {
      setRuntimeConfig(saved)
      showSuccess(t('admin.ops.systemLog.runtimeSaved', 'Log config applied'))
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      showError(
        e?.message || t('admin.ops.systemLog.runtimeSaveFailed', 'Failed to save log config'),
      )
    },
  })

  const resetMutation = useMutation({
    mutationFn: () => opsAPI.resetRuntimeLogConfig(),
    onSuccess: (saved) => {
      setRuntimeConfig(saved)
      showSuccess(t('admin.ops.systemLog.runtimeReset', 'Reset to startup config'))
      void healthQuery.refetch()
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      showError(
        e?.message || t('admin.ops.systemLog.runtimeResetFailed', 'Failed to reset log config'),
      )
    },
  })

  const cleanupMutation = useMutation({
    mutationFn: () => {
      const payload = {
        level: debouncedFilters.level || undefined,
        component: debouncedFilters.component || undefined,
        request_id: debouncedFilters.request_id || undefined,
        client_request_id: debouncedFilters.client_request_id || undefined,
        user_id: debouncedFilters.user_id,
        account_id: debouncedFilters.account_id,
        platform: debouncedFilters.platform || undefined,
        model: debouncedFilters.model || undefined,
        q: debouncedFilters.q || undefined,
      }
      return opsAPI.cleanupSystemLogs(payload)
    },
    onSuccess: (res) => {
      showSuccess(
        t('admin.ops.systemLog.cleanupSuccess', 'Deleted {n} logs').replace(
          '{n}',
          String(res.deleted ?? 0),
        ),
      )
      setPage(1)
      void queryClient.invalidateQueries({ queryKey: ['ops', 'systemLogs'] })
      void healthQuery.refetch()
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      showError(e?.message || t('admin.ops.systemLog.cleanupFailed', 'Failed to cleanup logs'))
    },
  })

  // ---- Handlers ----

  const resetFilters = () => {
    setFilters({ ...defaultFilters, platform: platformFilter || '' })
    setCustomRange(undefined)
    setPage(1)
  }

  const handleCleanup = () => {
    if (
      !window.confirm(
        t(
          'admin.ops.systemLog.cleanupConfirm',
          'Delete logs matching current filters? This cannot be undone.',
        ),
      )
    )
      return
    cleanupMutation.mutate()
  }

  const handleReset = () => {
    if (
      !window.confirm(
        t('admin.ops.systemLog.runtimeResetConfirm', 'Reset to startup log config immediately?'),
      )
    )
      return
    resetMutation.mutate()
  }

  // ---- Derived data ----

  const logs: SystemLogRow[] = logsQuery.data?.items ?? []
  const total = logsQuery.data?.total ?? 0
  const totalPages = (() => {
    if (total === 0) return 1
    return Math.ceil(total / pageSize)
  })()
  const health = healthQuery.data
  const isPending = saveMutation.isPending || resetMutation.isPending

  return (
    <div className="card p-4">
      {/* Header + Health */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('admin.ops.systemLog.title', 'System Logs')}
          </h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {t('admin.ops.systemLog.description', 'Real-time log stream, sorted by newest first')}
          </p>
        </div>
        {health && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700 dark:bg-dark-700 dark:text-gray-300">
              {t('admin.ops.systemLog.queue', 'Queue')} {health.queue_depth}/{health.queue_capacity}
            </span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700 dark:bg-dark-700 dark:text-gray-300">
              {t('admin.ops.systemLog.written', 'Written')} {health.written_count}
            </span>
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              {t('admin.ops.systemLog.dropped', 'Dropped')} {health.dropped_count}
            </span>
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {t('admin.ops.systemLog.failed', 'Failed')} {health.write_failed_count}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={healthQuery.isFetching}
              onClick={() => void healthQuery.refetch()}
              title={t('admin.ops.systemLog.refreshHealth', 'Refresh Health')}
            >
              <RefreshIcon className={`size-3 ${healthQuery.isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        )}
      </div>

      {/* Runtime Config */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-dark-700 dark:bg-dark-800/70">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
            {t('admin.ops.systemLog.runtimeConfig', 'Runtime Log Config (live)')}
          </span>
          {runtimeQuery.isLoading && (
            <span className="text-xs text-gray-400">{t('common.loading', 'Loading...')}</span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {/* Level */}
          <div>
            <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
              {t('admin.ops.systemLog.level', 'Level')}
            </label>
            <Select
              value={runtimeConfig.level}
              onValueChange={(v) =>
                setRuntimeConfig((c) => ({ ...c, level: v as OpsRuntimeLogConfig['level'] }))
              }
            >
              <SelectTrigger className="h-7 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {LOG_LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stacktrace level */}
          <div>
            <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
              {t('admin.ops.systemLog.stacktraceLevel', 'Stacktrace')}
            </label>
            <Select
              value={runtimeConfig.stacktrace_level}
              onValueChange={(v) =>
                setRuntimeConfig((c) => ({
                  ...c,
                  stacktrace_level: v as OpsRuntimeLogConfig['stacktrace_level'],
                }))
              }
            >
              <SelectTrigger className="h-7 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {STACKTRACE_LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sampling initial */}
          <div>
            <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
              {t('admin.ops.systemLog.samplingInitial', 'Samp. initial')}
            </label>
            <Input
              type="number"
              min={1}
              value={runtimeConfig.sampling_initial}
              onChange={(e) =>
                setRuntimeConfig((c) => ({ ...c, sampling_initial: Number(e.target.value) }))
              }
              className="h-7 text-xs"
            />
          </div>

          {/* Sampling thereafter */}
          <div>
            <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
              {t('admin.ops.systemLog.samplingThereafter', 'Samp. after')}
            </label>
            <Input
              type="number"
              min={1}
              value={runtimeConfig.sampling_thereafter}
              onChange={(e) =>
                setRuntimeConfig((c) => ({ ...c, sampling_thereafter: Number(e.target.value) }))
              }
              className="h-7 text-xs"
            />
          </div>

          {/* Retention days */}
          <div>
            <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
              {t('admin.ops.systemLog.retentionDays', 'Retention (d)')}
            </label>
            <Input
              type="number"
              min={1}
              max={3650}
              value={runtimeConfig.retention_days}
              onChange={(e) =>
                setRuntimeConfig((c) => ({ ...c, retention_days: Number(e.target.value) }))
              }
              className="h-7 text-xs"
            />
          </div>

          {/* Caller + Sampling toggles + Buttons */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={runtimeConfig.caller}
                  onChange={(e) => setRuntimeConfig((c) => ({ ...c, caller: e.target.checked }))}
                  className="h-3 w-3"
                />
                caller
              </label>
              <label className="flex cursor-pointer items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={runtimeConfig.enable_sampling}
                  onChange={(e) =>
                    setRuntimeConfig((c) => ({ ...c, enable_sampling: e.target.checked }))
                  }
                  className="h-3 w-3"
                />
                sampling
              </label>
            </div>
            <div className="flex gap-1.5">
              <Button size="xs" disabled={isPending} onClick={() => saveMutation.mutate()}>
                {saveMutation.isPending && <LoaderCircleIcon className="size-3 animate-spin" />}
                {t('admin.ops.systemLog.save', 'Save')}
              </Button>
              <Button variant="outline" size="xs" disabled={isPending} onClick={handleReset}>
                {resetMutation.isPending && <LoaderCircleIcon className="size-3 animate-spin" />}
                {t('admin.ops.systemLog.reset', 'Reset')}
              </Button>
            </div>
          </div>
        </div>

        {health?.last_error && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            {t('admin.ops.systemLog.lastError', 'Last error:')} {health.last_error}
          </p>
        )}
      </div>

      {/* Filter Panel */}
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {/* Time range */}
        <div>
          <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
            {t('admin.ops.systemLog.timeRange', 'Time Range')}
          </label>
          <TimeRangePicker
            value={filters.time_range ?? '1h'}
            onChange={(v, range) => {
              updateFilter({ time_range: v as OpsSystemLogQuery['time_range'] })
              setCustomRange(range)
            }}
            presets={SYSTEM_LOG_PRESETS}
            customRange={customRange}
          />
        </div>

        {/* Level filter */}
        <div>
          <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
            {t('admin.ops.systemLog.level', 'Level')}
          </label>
          <Select
            value={filters.level || 'all'}
            onValueChange={(v) => updateFilter({ level: v === 'all' ? '' : v })}
          >
            <SelectTrigger className="h-7 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="all">{t('common.all', 'All')}</SelectItem>
              {LOG_LEVELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Component */}
        <div>
          <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
            {t('admin.ops.systemLog.component', 'Component')}
          </label>
          <Input
            value={filters.component ?? ''}
            onChange={(e) => updateFilter({ component: e.target.value })}
            placeholder="e.g. http.access"
            className="h-7 text-xs"
          />
        </div>

        {/* Platform */}
        <div>
          <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
            {t('admin.ops.systemLog.platform', 'Platform')}
          </label>
          <Input
            value={filters.platform ?? ''}
            onChange={(e) => updateFilter({ platform: e.target.value })}
            className="h-7 text-xs"
          />
        </div>

        {/* Keyword search */}
        <div>
          <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
            {t('admin.ops.systemLog.keyword', 'Keyword')}
          </label>
          <Input
            value={filters.q ?? ''}
            onChange={(e) => updateFilter({ q: e.target.value })}
            placeholder={t('admin.ops.systemLog.keywordPlaceholder', 'message / request_id')}
            className="h-7 text-xs"
          />
        </div>

        {/* Request ID */}
        <div>
          <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">request_id</label>
          <Input
            value={filters.request_id ?? ''}
            onChange={(e) => updateFilter({ request_id: e.target.value })}
            className="h-7 text-xs"
          />
        </div>

        {/* Client request ID */}
        <div>
          <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
            client_request_id
          </label>
          <Input
            value={filters.client_request_id ?? ''}
            onChange={(e) => updateFilter({ client_request_id: e.target.value })}
            className="h-7 text-xs"
          />
        </div>

        {/* User ID */}
        <div>
          <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">user_id</label>
          <Input
            type="number"
            value={filters.user_id ?? ''}
            onChange={(e) =>
              updateFilter({ user_id: e.target.value ? Number(e.target.value) : undefined })
            }
            className="h-7 text-xs"
          />
        </div>

        {/* Account ID */}
        <div>
          <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">account_id</label>
          <Input
            type="number"
            value={filters.account_id ?? ''}
            onChange={(e) =>
              updateFilter({ account_id: e.target.value ? Number(e.target.value) : undefined })
            }
            className="h-7 text-xs"
          />
        </div>

        {/* Model */}
        <div>
          <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
            {t('admin.ops.systemLog.model', 'Model')}
          </label>
          <Input
            value={filters.model ?? ''}
            onChange={(e) => updateFilter({ model: e.target.value })}
            className="h-7 text-xs"
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="mb-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={logsQuery.isFetching} onClick={() => void logsQuery.refetch()}>
          {logsQuery.isFetching && <LoaderCircleIcon className="size-3 animate-spin" />}
          {t('common.search', 'Search')}
        </Button>
        <Button variant="outline" size="sm" onClick={resetFilters}>
          {t('common.reset', 'Reset')}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={cleanupMutation.isPending}
          onClick={handleCleanup}
        >
          {cleanupMutation.isPending && <LoaderCircleIcon className="size-3 animate-spin" />}
          {t('admin.ops.systemLog.cleanup', 'Cleanup by Filter')}
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={logColumns}
        data={logs}
        loading={logsQuery.isLoading}
        pagination={{
          page,
          pageSize,
          total,
          totalPages,
        }}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        getRowId={(row) => String(row.id)}
        spreadsheetTitle="System Logs"
      />
    </div>
  )
}
