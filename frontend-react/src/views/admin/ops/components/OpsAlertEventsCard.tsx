/**
 * OpsAlertEventsCard
 * Displays fired/resolved alert events with severity badges and detail modal.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { opsAPI } from '@/api/admin/ops'
import type { AlertEvent } from '@/api/admin/ops'
import { RefreshIcon } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TimeRangePicker, ALERT_EVENTS_PRESETS } from '@/components/common/TimeRangePicker'
import { useAppStore } from '@/stores/app'
import { cn } from '@/lib/utils'

// ==================== Helpers ====================

function severityClass(s: string | undefined) {
  switch (s) {
    case 'P0':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'P1':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    case 'P2':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    default:
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  }
}

function statusClass(s: string | undefined) {
  switch (s) {
    case 'firing':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'resolved':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-gray-400'
  }
}

function fmtTime(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleString()
}

function fmtDimensions(dims: Record<string, unknown> | null | undefined) {
  if (!dims) return '—'
  return Object.entries(dims)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')
}

// ==================== Component ====================

export function OpsAlertEventsCard() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)
  const queryClient = useQueryClient()

  const [timeRange, setTimeRange] = useState('24h')
  const [customRange, setCustomRange] = useState<{ from: string; to: string } | undefined>()
  const [severity, setSeverity] = useState('')
  const [status, setStatus] = useState('')

  const [selected, setSelected] = useState<AlertEvent | null>(null)
  const [silenceDuration, setSilenceDuration] = useState('60')

  const queryParams = {
    limit: 50,
    ...(timeRange === 'custom' && customRange
      ? { start_time: customRange.from + 'T00:00:00Z', end_time: customRange.to + 'T23:59:59Z' }
      : { time_range: timeRange }),
    severity: severity || undefined,
    status: status || undefined,
  }

  const {
    data: events = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['ops', 'alertEvents', queryParams],
    queryFn: () => opsAPI.listAlertEvents(queryParams),
  })

  const resolveMutation = useMutation({
    mutationFn: (id: number) => opsAPI.updateAlertEventStatus(id, 'manual_resolved'),
    onSuccess: () => {
      showSuccess(t('admin.ops.alertEvents.detail.manualResolvedSuccess', 'Resolved'))
      queryClient.invalidateQueries({ queryKey: ['ops', 'alertEvents'] })
      setSelected(null)
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      showError(
        e?.message || t('admin.ops.alertEvents.detail.manualResolvedFailed', 'Failed to resolve'),
      )
    },
  })

  const silenceMutation = useMutation({
    mutationFn: (event: AlertEvent) => {
      const until = new Date(Date.now() + Number(silenceDuration) * 60 * 1000).toISOString()
      return opsAPI.createAlertSilence({
        rule_id: event.rule_id,
        platform: (event.dimensions?.platform as string) ?? '',
        group_id: event.dimensions?.group_id as number | undefined,
        until,
        reason: 'manual silence',
      })
    },
    onSuccess: () => {
      showSuccess(t('admin.ops.alertEvents.detail.silenceSuccess', 'Silenced'))
      setSelected(null)
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      showError(e?.message || t('admin.ops.alertEvents.detail.silenceFailed', 'Failed to silence'))
    },
  })

  const SEVERITIES = ['', 'P0', 'P1', 'P2', 'P3']
  const STATUSES = ['', 'firing', 'resolved', 'manual_resolved']
  const SILENCE_OPTIONS = [
    { label: '15 min', value: '15' },
    { label: '30 min', value: '30' },
    { label: '1 h', value: '60' },
    { label: '6 h', value: '360' },
    { label: '24 h', value: '1440' },
  ]

  return (
    <div className="card p-4">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('admin.ops.alertEvents.title', 'Alert Events')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('admin.ops.alertEvents.description', 'Recent alert firing/resolution records')}
          </p>
        </div>

        {/* Filters */}
        <TimeRangePicker
          value={timeRange}
          onChange={(v, range) => {
            setTimeRange(v)
            setCustomRange(range)
          }}
          presets={ALERT_EVENTS_PRESETS}
          customRange={customRange}
        />

        <Select value={severity || 'all'} onValueChange={(v) => setSeverity(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-7 w-24 text-xs">
            <SelectValue placeholder={t('admin.ops.alertEvents.table.severity', 'Severity')} />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">{t('common.all', 'All')}</SelectItem>
            {SEVERITIES.filter(Boolean).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-7 w-28 text-xs">
            <SelectValue placeholder={t('admin.ops.alertEvents.table.status', 'Status')} />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">{t('common.all', 'All')}</SelectItem>
            {STATUSES.filter(Boolean).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="icon-xs"
          disabled={isFetching}
          onClick={() => refetch()}
          title={t('common.refresh', 'Refresh')}
        >
          <RefreshIcon className={`size-3 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="spinner" />
        </div>
      ) : events.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          {t('admin.ops.alertEvents.empty', 'No alert events')}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-dark-700">
                <th className="py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                  {t('admin.ops.alertEvents.table.time', 'Time')}
                </th>
                <th className="py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                  {t('admin.ops.alertEvents.table.severity', 'Sev')}
                </th>
                <th className="py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                  {t('admin.ops.alertEvents.table.status', 'Status')}
                </th>
                <th className="py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                  {t('admin.ops.alertEvents.table.title', 'Title')}
                </th>
                <th className="py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                  {t('admin.ops.alertEvents.table.dimensions', 'Dimensions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr
                  key={ev.id}
                  className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-gray-50 dark:border-dark-800 dark:hover:bg-dark-800/50"
                  onClick={() => setSelected(ev)}
                >
                  <td className="py-1.5 pr-3 tabular-nums text-gray-500">{fmtTime(ev.fired_at)}</td>
                  <td className="py-1.5 pr-2">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-xs font-medium',
                        severityClass(ev.severity),
                      )}
                    >
                      {ev.severity ?? '—'}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-xs font-medium',
                        statusClass(ev.status),
                      )}
                    >
                      {ev.status ?? '—'}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-gray-800 dark:text-gray-200">
                    {ev.title ?? `Rule ${ev.rule_id}`}
                  </td>
                  <td className="py-1.5 text-gray-500 dark:text-gray-400">
                    {fmtDimensions(ev.dimensions)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {selected?.title ?? `Rule ${selected?.rule_id}`}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              {/* Badges */}
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'rounded px-2 py-0.5 text-xs font-medium',
                    severityClass(selected.severity),
                  )}
                >
                  {selected.severity ?? '—'}
                </span>
                <span
                  className={cn(
                    'rounded px-2 py-0.5 text-xs font-medium',
                    statusClass(selected.status),
                  )}
                >
                  {selected.status ?? '—'}
                </span>
                {selected.email_sent && (
                  <Badge variant="outline" className="text-xs">
                    {t('admin.ops.alertEvents.table.emailSent', 'Email sent')}
                  </Badge>
                )}
              </div>

              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-3 text-xs dark:bg-dark-800">
                <div>
                  <span className="text-gray-400">
                    {t('admin.ops.alertEvents.detail.firedAt', 'Fired At')}
                  </span>
                  <p className="mt-0.5 text-gray-800 dark:text-gray-200">
                    {fmtTime(selected.fired_at)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">
                    {t('admin.ops.alertEvents.detail.resolvedAt', 'Resolved At')}
                  </span>
                  <p className="mt-0.5 text-gray-800 dark:text-gray-200">
                    {fmtTime(selected.resolved_at)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">
                    {t('admin.ops.alertEvents.detail.ruleId', 'Rule ID')}
                  </span>
                  <p className="mt-0.5 font-mono text-gray-800 dark:text-gray-200">
                    {selected.rule_id}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">
                    {t('admin.ops.alertEvents.detail.dimensions', 'Dimensions')}
                  </span>
                  <p className="mt-0.5 break-all text-gray-800 dark:text-gray-200">
                    {fmtDimensions(selected.dimensions)}
                  </p>
                </div>
                {selected.metric_value != null && (
                  <div>
                    <span className="text-gray-400">
                      {t('admin.ops.alertEvents.table.metric', 'Metric / Threshold')}
                    </span>
                    <p className="mt-0.5 text-gray-800 dark:text-gray-200">
                      {selected.metric_value} / {selected.threshold_value}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              {selected.status === 'firing' && (
                <div className="flex flex-wrap items-center gap-2">
                  {/* Silence */}
                  <div className="flex items-center gap-1.5">
                    <Select value={silenceDuration} onValueChange={setSilenceDuration}>
                      <SelectTrigger className="h-7 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {SILENCE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={silenceMutation.isPending}
                      onClick={() => silenceMutation.mutate(selected)}
                    >
                      {t('admin.ops.alertEvents.detail.silence', 'Silence')}
                    </Button>
                  </div>

                  {/* Resolve */}
                  <Button
                    size="xs"
                    disabled={resolveMutation.isPending}
                    onClick={() => resolveMutation.mutate(selected.id)}
                  >
                    {t('admin.ops.alertEvents.detail.manualResolve', 'Resolve')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
