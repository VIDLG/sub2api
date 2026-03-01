/**
 * OpsHeaderSection
 * Full-parity header: Health Score + Realtime Traffic + 6 Stat Cards + 6 System Health Cards.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { OpsDashboardOverview, OpsMetricThresholds } from '@/api/admin/ops'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { QuestionIcon } from '@/components/icons'
import { OpsHealthScoreCircle } from './OpsHealthScoreCircle'
import { OpsRealtimeTrafficBox } from './OpsRealtimeTrafficBox'
import {
  fmtNum,
  fmtMs,
  formatNumber,
  formatDateTime,
  buildDiagnosisReport,
  getSLAThresholdLevel,
  getRequestErrorRateThresholdLevel,
  getUpstreamErrorRateThresholdLevel,
  getTTFTThresholdLevel,
  getThresholdColorClass,
  getCPUClass,
  getMemClass,
  getDBRedisClass,
  getDBRedisLabel,
  getDBUsagePercent,
  getRedisUsagePercent,
  getGoroutineClass,
  getGoroutineLabel,
} from '../utils/opsFormatters'

export interface OpsRequestDetailsPreset {
  title: string
  kind?: 'all' | 'error' | 'success'
  sort?: 'created_at_desc' | 'duration_desc'
  min_duration_ms?: number
  max_duration_ms?: number
}

interface Props {
  overview: OpsDashboardOverview | null | undefined
  platform: string
  groupId: number | null
  timeRange: string
  opsEnabled: boolean
  thresholds: OpsMetricThresholds | null | undefined
  onOpenRequestDetails: (preset?: OpsRequestDetailsPreset) => void
  onOpenErrorDetails: (kind: 'request' | 'upstream') => void
  /** Toolbar JSX rendered inside the card header (filters, refresh, auto-refresh) */
  toolbar?: React.ReactNode
}

// ==================== Sub-components ====================

function HelpTooltip({ content }: { content: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <QuestionIcon className="size-3 text-gray-400 dark:text-gray-500" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        {content}
      </TooltipContent>
    </Tooltip>
  )
}

function StatCardHeader({
  title,
  helpKey,
  helpDefault,
  detailsLabel,
  onDetails,
  statusDot,
}: {
  title: string
  helpKey: string
  helpDefault: string
  detailsLabel: string
  onDetails?: () => void
  statusDot?: string // Tailwind bg class
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-bold uppercase text-gray-400">{title}</span>
        <HelpTooltip content={t(helpKey, helpDefault)} />
        {statusDot && <span className={`size-1.5 rounded-full ${statusDot}`} />}
      </div>
      {onDetails && (
        <button
          type="button"
          className="text-[10px] font-bold text-blue-500 hover:underline"
          onClick={onDetails}
        >
          {detailsLabel}
        </button>
      )}
    </div>
  )
}

function MetricRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}:</span>
      <span className="font-bold text-gray-900 dark:text-white">{value}</span>
    </div>
  )
}

function PercentileRow({
  label,
  value,
  colorClass,
}: {
  label: string
  value: number | null | undefined
  colorClass?: string
}) {
  return (
    <div className="flex items-baseline gap-1 whitespace-nowrap">
      <span className="text-gray-500">{label}:</span>
      <span className={`font-bold ${colorClass ?? 'text-gray-900 dark:text-white'}`}>
        {value ?? '—'}
      </span>
      <span className="text-gray-400">ms</span>
    </div>
  )
}

// ==================== Main Component ====================

export function OpsHeaderSection({
  overview,
  platform,
  groupId,
  timeRange,
  opsEnabled,
  thresholds,
  onOpenRequestDetails,
  onOpenErrorDetails,
  toolbar,
}: Props) {
  const { t } = useTranslation()
  const detailsLabel = t('admin.ops.requestDetails.details', 'Details')

  const sys = overview?.system_metrics
  const jobs = overview?.job_heartbeats ?? []

  const isIdle =
    !overview ||
    (overview.request_count_total === 0 &&
      (overview.health_score == null || overview.health_score === 0))

  const diagnosisReport = buildDiagnosisReport(overview, thresholds, t)

  // Derived metrics
  const slaPercent = overview ? overview.sla * 100 : null
  const errorRatePercent = overview ? overview.error_rate * 100 : null
  const upstreamErrorRatePercent = overview ? overview.upstream_error_rate * 100 : null

  // Jobs modal
  const [jobsDialogOpen, setJobsDialogOpen] = useState(false)
  const jobsWarnCount = jobs.filter((j) => {
    if (!j.last_error_at) return false
    return !j.last_success_at || new Date(j.last_error_at) > new Date(j.last_success_at)
  }).length
  const jobsStatusClass =
    jobsWarnCount > 0
      ? 'text-yellow-600 dark:text-yellow-400'
      : jobs.length > 0
        ? 'text-green-600 dark:text-green-400'
        : 'text-gray-400'
  const jobsStatusLabel =
    jobs.length === 0
      ? t('admin.ops.noData', 'No Data')
      : jobsWarnCount > 0
        ? 'Warning'
        : t('admin.ops.ok', 'OK')

  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5 dark:bg-dark-800 dark:ring-dark-700">
      {/* Top Toolbar */}
      {toolbar && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4 dark:border-dark-700">
          {toolbar}
        </div>
      )}

      {/* Health + Realtime | Stat Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT: Health Score + Realtime Traffic */}
        <div className="rounded-2xl bg-gray-50 p-4 dark:bg-dark-900 lg:col-span-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[160px_1fr]">
            {/* Health Circle */}
            <div className="flex items-center justify-center self-center md:border-r md:border-gray-200 md:pr-4 dark:md:border-dark-700">
              <OpsHealthScoreCircle
                healthScore={overview?.health_score}
                isSystemIdle={isIdle}
                diagnosisReport={diagnosisReport}
              />
            </div>
            {/* Realtime Traffic */}
            <OpsRealtimeTrafficBox
              platform={platform}
              groupId={groupId}
              timeRange={timeRange}
              opsEnabled={opsEnabled}
            />
          </div>
        </div>

        {/* RIGHT: 6 Stat Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-7 lg:grid-cols-3">
          {/* 1. Requests */}
          <div className="rounded-2xl bg-gray-50 p-4 dark:bg-dark-900">
            <StatCardHeader
              title={t('admin.ops.requestsTitle', 'Requests')}
              helpKey="admin.ops.tooltips.totalRequests"
              helpDefault="Total requests processed in the selected window"
              detailsLabel={detailsLabel}
              onDetails={() =>
                onOpenRequestDetails({
                  title: t('admin.ops.requestDetails.title', 'Request Details'),
                })
              }
            />
            <div className="mt-2 space-y-2 text-xs">
              <MetricRow
                label={t('admin.ops.requests', 'Requests')}
                value={overview ? fmtNum(overview.request_count_total) : '—'}
              />
              <MetricRow
                label={t('admin.ops.tokens', 'Tokens')}
                value={overview ? fmtNum(overview.token_consumed) : '—'}
              />
              <MetricRow
                label={t('admin.ops.avgQps', 'Avg QPS')}
                value={overview ? overview.qps.avg.toFixed(1) : '—'}
              />
              <MetricRow
                label={t('admin.ops.avgTps', 'Avg TPS')}
                value={overview ? overview.tps.avg.toFixed(1) : '—'}
              />
            </div>
          </div>

          {/* 2. SLA */}
          <div className="rounded-2xl bg-gray-50 p-4 dark:bg-dark-900">
            <StatCardHeader
              title={t('admin.ops.sla', 'SLA')}
              helpKey="admin.ops.tooltips.sla"
              helpDefault="Service Level Agreement compliance percentage"
              detailsLabel={detailsLabel}
              onDetails={() =>
                onOpenRequestDetails({
                  title: t('admin.ops.requestDetails.title', 'Request Details'),
                  kind: 'error',
                })
              }
              statusDot={
                slaPercent == null
                  ? undefined
                  : getSLAThresholdLevel(slaPercent, thresholds) === 'critical'
                    ? 'bg-red-500'
                    : getSLAThresholdLevel(slaPercent, thresholds) === 'warning'
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
              }
            />
            <div
              className={`mt-2 text-3xl font-black ${getThresholdColorClass(getSLAThresholdLevel(slaPercent, thresholds))}`}
            >
              {slaPercent == null ? '—' : `${slaPercent.toFixed(3)}%`}
            </div>
            {/* Progress bar 90-100 range */}
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-dark-700">
              <div
                className={`h-full transition-all ${
                  getSLAThresholdLevel(slaPercent, thresholds) === 'critical'
                    ? 'bg-red-500'
                    : getSLAThresholdLevel(slaPercent, thresholds) === 'warning'
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                }`}
                style={{ width: `${Math.max((slaPercent ?? 0) - 90, 0) * 10}%` }}
              />
            </div>
            <div className="mt-3 text-xs">
              <MetricRow
                label={t('admin.ops.exceptions', 'Exceptions')}
                value={
                  <span className="text-red-600 dark:text-red-400">
                    {overview
                      ? formatNumber(
                          (overview.request_count_sla ?? 0) - (overview.success_count ?? 0),
                        )
                      : '—'}
                  </span>
                }
              />
            </div>
          </div>

          {/* 3. Request Errors */}
          <div className="rounded-2xl bg-gray-50 p-4 dark:bg-dark-900">
            <StatCardHeader
              title={t('admin.ops.requestErrors', 'Request Errors')}
              helpKey="admin.ops.tooltips.errors"
              helpDefault="Request error rate and count (SLA scope)"
              detailsLabel={detailsLabel}
              onDetails={() => onOpenErrorDetails('request')}
            />
            <div
              className={`mt-2 text-3xl font-black ${getThresholdColorClass(getRequestErrorRateThresholdLevel(errorRatePercent, thresholds))}`}
            >
              {errorRatePercent == null ? '—' : `${errorRatePercent.toFixed(2)}%`}
            </div>
            <div className="mt-3 space-y-1 text-xs">
              <MetricRow
                label={t('admin.ops.errorCount', 'Error Count')}
                value={overview ? formatNumber(overview.error_count_sla ?? 0) : '—'}
              />
              <MetricRow
                label={t('admin.ops.businessLimited', 'Business Limited')}
                value={overview ? formatNumber(overview.business_limited_count ?? 0) : '—'}
              />
            </div>
          </div>

          {/* 4. Request Duration */}
          <div className="rounded-2xl bg-gray-50 p-4 dark:bg-dark-900">
            <StatCardHeader
              title={t('admin.ops.latencyDuration', 'Request Duration')}
              helpKey="admin.ops.tooltips.latency"
              helpDefault="Request duration distribution percentiles"
              detailsLabel={detailsLabel}
              onDetails={() =>
                onOpenRequestDetails({
                  title: t('admin.ops.latencyDuration', 'Request Duration'),
                  sort: 'duration_desc',
                })
              }
            />
            <div className="mt-2 flex items-baseline gap-2">
              <div className="text-3xl font-black text-gray-900 dark:text-white">
                {overview?.duration?.p99_ms != null ? Math.round(overview.duration.p99_ms) : '—'}
              </div>
              <span className="text-xs font-bold text-gray-400">ms (P99)</span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-x-3 gap-y-1 text-xs 2xl:grid-cols-2">
              <PercentileRow
                label="P95"
                value={
                  overview?.duration?.p95_ms != null ? Math.round(overview.duration.p95_ms) : null
                }
              />
              <PercentileRow
                label="P90"
                value={
                  overview?.duration?.p90_ms != null ? Math.round(overview.duration.p90_ms) : null
                }
              />
              <PercentileRow
                label="P50"
                value={
                  overview?.duration?.p50_ms != null ? Math.round(overview.duration.p50_ms) : null
                }
              />
              <PercentileRow
                label="Avg"
                value={
                  overview?.duration?.avg_ms != null ? Math.round(overview.duration.avg_ms) : null
                }
              />
              <PercentileRow
                label="Max"
                value={
                  overview?.duration?.max_ms != null ? Math.round(overview.duration.max_ms) : null
                }
              />
            </div>
          </div>

          {/* 5. TTFT */}
          <div className="rounded-2xl bg-gray-50 p-4 dark:bg-dark-900">
            <StatCardHeader
              title="TTFT"
              helpKey="admin.ops.tooltips.ttft"
              helpDefault="Time To First Token — latency for the first token response"
              detailsLabel={detailsLabel}
              onDetails={() =>
                onOpenRequestDetails({
                  title: t('admin.ops.ttftLabel', 'Time to First Token'),
                  sort: 'duration_desc',
                })
              }
            />
            <div className="mt-2 flex items-baseline gap-2">
              <div
                className={`text-3xl font-black ${getThresholdColorClass(getTTFTThresholdLevel(overview?.ttft?.p99_ms, thresholds))}`}
              >
                {overview?.ttft?.p99_ms != null ? Math.round(overview.ttft.p99_ms) : '—'}
              </div>
              <span className="text-xs font-bold text-gray-400">ms (P99)</span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-x-3 gap-y-1 text-xs 2xl:grid-cols-2">
              <PercentileRow
                label="P95"
                value={overview?.ttft?.p95_ms != null ? Math.round(overview.ttft.p95_ms) : null}
                colorClass={getThresholdColorClass(
                  getTTFTThresholdLevel(overview?.ttft?.p95_ms, thresholds),
                )}
              />
              <PercentileRow
                label="P90"
                value={overview?.ttft?.p90_ms != null ? Math.round(overview.ttft.p90_ms) : null}
                colorClass={getThresholdColorClass(
                  getTTFTThresholdLevel(overview?.ttft?.p90_ms, thresholds),
                )}
              />
              <PercentileRow
                label="P50"
                value={overview?.ttft?.p50_ms != null ? Math.round(overview.ttft.p50_ms) : null}
                colorClass={getThresholdColorClass(
                  getTTFTThresholdLevel(overview?.ttft?.p50_ms, thresholds),
                )}
              />
              <PercentileRow
                label="Avg"
                value={overview?.ttft?.avg_ms != null ? Math.round(overview.ttft.avg_ms) : null}
                colorClass={getThresholdColorClass(
                  getTTFTThresholdLevel(overview?.ttft?.avg_ms, thresholds),
                )}
              />
              <PercentileRow
                label="Max"
                value={overview?.ttft?.max_ms != null ? Math.round(overview.ttft.max_ms) : null}
                colorClass={getThresholdColorClass(
                  getTTFTThresholdLevel(overview?.ttft?.max_ms, thresholds),
                )}
              />
            </div>
          </div>

          {/* 6. Upstream Errors */}
          <div className="rounded-2xl bg-gray-50 p-4 dark:bg-dark-900">
            <StatCardHeader
              title={t('admin.ops.upstreamErrors', 'Upstream Errors')}
              helpKey="admin.ops.tooltips.upstreamErrors"
              helpDefault="Upstream API error rate (excluding 429/529)"
              detailsLabel={detailsLabel}
              onDetails={() => onOpenErrorDetails('upstream')}
            />
            <div
              className={`mt-2 text-3xl font-black ${getThresholdColorClass(getUpstreamErrorRateThresholdLevel(upstreamErrorRatePercent, thresholds))}`}
            >
              {upstreamErrorRatePercent == null ? '—' : `${upstreamErrorRatePercent.toFixed(2)}%`}
            </div>
            <div className="mt-3 space-y-1 text-xs">
              <MetricRow
                label={t('admin.ops.errorCountExcl429529', 'Errors (excl 429/529)')}
                value={
                  overview ? formatNumber(overview.upstream_error_count_excl_429_529 ?? 0) : '—'
                }
              />
              <MetricRow
                label="429/529"
                value={
                  overview
                    ? formatNumber(
                        (overview.upstream_429_count ?? 0) + (overview.upstream_529_count ?? 0),
                      )
                    : '—'
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* System Health Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* CPU */}
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-dark-900">
          <div className="flex items-center gap-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">CPU</div>
            <HelpTooltip content={t('admin.ops.tooltips.cpu', 'Server CPU utilization')} />
          </div>
          <div className={`mt-1 text-lg font-black ${getCPUClass(sys?.cpu_usage_percent)}`}>
            {sys?.cpu_usage_percent != null ? `${sys.cpu_usage_percent.toFixed(1)}%` : '—'}
          </div>
          <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
            {t('common.warning', 'Warning')} 80% · {t('common.critical', 'Critical')} 95%
          </div>
        </div>

        {/* Memory */}
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-dark-900">
          <div className="flex items-center gap-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {t('admin.ops.memory', 'Memory')}
            </div>
            <HelpTooltip content={t('admin.ops.tooltips.memory', 'Server memory utilization')} />
          </div>
          <div className={`mt-1 text-lg font-black ${getMemClass(sys?.memory_usage_percent)}`}>
            {sys?.memory_usage_percent != null ? `${sys.memory_usage_percent.toFixed(1)}%` : '—'}
          </div>
          <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
            {sys?.memory_used_mb != null && sys?.memory_total_mb != null
              ? `${formatNumber(sys.memory_used_mb)} / ${formatNumber(sys.memory_total_mb)} MB`
              : '—'}
          </div>
        </div>

        {/* DB */}
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-dark-900">
          <div className="flex items-center gap-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {t('admin.ops.db', 'DB')}
            </div>
            <HelpTooltip content={t('admin.ops.tooltips.db', 'Database connection pool status')} />
          </div>
          <div
            className={`mt-1 text-lg font-black ${getDBRedisClass(sys?.db_ok, getDBUsagePercent(sys))}`}
          >
            {getDBRedisLabel(sys?.db_ok, getDBUsagePercent(sys), t)}
          </div>
          <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
            {t('admin.ops.conns', 'Conns')} {(sys?.db_conn_active ?? 0) + (sys?.db_conn_idle ?? 0)}{' '}
            / {sys?.db_max_open_conns ?? '—'}
            {' · '}
            {t('admin.ops.active', 'Active')} {sys?.db_conn_active ?? '—'}
            {' · '}
            {t('admin.ops.idle', 'Idle')} {sys?.db_conn_idle ?? '—'}
            {sys?.db_conn_waiting != null && (
              <>
                {' · '}
                {t('admin.ops.waiting', 'Waiting')} {sys.db_conn_waiting}
              </>
            )}
          </div>
        </div>

        {/* Redis */}
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-dark-900">
          <div className="flex items-center gap-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Redis
            </div>
            <HelpTooltip content={t('admin.ops.tooltips.redis', 'Redis connection pool status')} />
          </div>
          <div
            className={`mt-1 text-lg font-black ${getDBRedisClass(sys?.redis_ok, getRedisUsagePercent(sys))}`}
          >
            {getDBRedisLabel(sys?.redis_ok, getRedisUsagePercent(sys), t)}
          </div>
          <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
            {t('admin.ops.conns', 'Conns')} {sys?.redis_conn_total ?? '—'} /{' '}
            {sys?.redis_pool_size ?? '—'}
            {sys?.redis_conn_idle != null && (
              <>
                {' · '}
                {t('admin.ops.idle', 'Idle')} {sys.redis_conn_idle}
              </>
            )}
          </div>
        </div>

        {/* Goroutines */}
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-dark-900">
          <div className="flex items-center gap-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {t('admin.ops.goroutines', 'Goroutines')}
            </div>
            <HelpTooltip
              content={t('admin.ops.tooltips.goroutines', 'Active Go goroutines and queue depth')}
            />
          </div>
          <div className={`mt-1 text-lg font-black ${getGoroutineClass(sys?.goroutine_count)}`}>
            {getGoroutineLabel(sys?.goroutine_count, t)}
          </div>
          <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
            {t('admin.ops.current', 'Current')}{' '}
            <span className="font-mono">{sys?.goroutine_count ?? '—'}</span>
            {' · '}
            {t('common.warning', 'Warning')} <span className="font-mono">8,000</span>
            {' · '}
            {t('common.critical', 'Critical')} <span className="font-mono">15,000</span>
            {sys?.concurrency_queue_depth != null && (
              <>
                {' · '}
                {t('admin.ops.queue', 'Queue')}{' '}
                <span className="font-mono">{sys.concurrency_queue_depth}</span>
              </>
            )}
          </div>
        </div>

        {/* Jobs */}
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-dark-900">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {t('admin.ops.jobs', 'Jobs')}
              </div>
              <HelpTooltip
                content={t('admin.ops.tooltips.jobs', 'Background job scheduler health')}
              />
            </div>
            {jobs.length > 0 && (
              <button
                type="button"
                className="text-[10px] font-bold text-blue-500 hover:underline"
                onClick={() => setJobsDialogOpen(true)}
              >
                {t('admin.ops.requestDetails.details', 'Details')}
              </button>
            )}
          </div>
          <div className={`mt-1 text-lg font-black ${jobsStatusClass}`}>{jobsStatusLabel}</div>
          <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
            {t('common.total', 'Total')} <span className="font-mono">{jobs.length}</span>
            {' · '}
            {t('common.warning', 'Warning')} <span className="font-mono">{jobsWarnCount}</span>
          </div>
        </div>
      </div>

      {/* Jobs Dialog */}
      <Dialog open={jobsDialogOpen} onOpenChange={setJobsDialogOpen}>
        <DialogContent className="w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {t('admin.ops.jobs', 'Jobs')} — {t('admin.ops.requestDetails.details', 'Details')}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto">
            {jobs.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {t('admin.ops.noData', 'No Data')}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.ops.jobName', 'Job Name')}</TableHead>
                    <TableHead>{t('admin.ops.status', 'Status')}</TableHead>
                    <TableHead>{t('admin.ops.lastRun', 'Last Run')}</TableHead>
                    <TableHead>{t('admin.ops.lastSuccess', 'Last Success')}</TableHead>
                    <TableHead>{t('admin.ops.lastError', 'Last Error')}</TableHead>
                    <TableHead>{t('admin.ops.result', 'Result')}</TableHead>
                    <TableHead className="text-right">
                      {t('admin.ops.requestDetails.table.time', 'Updated')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => {
                    const hasError =
                      job.last_error_at &&
                      (!job.last_success_at ||
                        new Date(job.last_error_at) > new Date(job.last_success_at))
                    return (
                      <TableRow
                        key={job.job_name}
                        className={hasError ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''}
                      >
                        <TableCell className="font-medium">{job.job_name}</TableCell>
                        <TableCell>
                          <Badge
                            variant={hasError ? 'destructive' : 'outline'}
                            className="text-[10px]"
                          >
                            {hasError
                              ? t('common.warning', 'Warning')
                              : t('admin.ops.healthy', 'OK')}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {job.last_duration_ms != null ? fmtMs(job.last_duration_ms) : '—'}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums">
                          {job.last_success_at ? formatDateTime(job.last_success_at) : '—'}
                        </TableCell>
                        <TableCell>
                          {job.last_error_at ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs tabular-nums text-red-600 dark:text-red-400">
                                  {formatDateTime(job.last_error_at)}
                                </span>
                              </TooltipTrigger>
                              {job.last_error && (
                                <TooltipContent className="max-w-sm text-xs">
                                  {job.last_error}
                                </TooltipContent>
                              )}
                            </Tooltip>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {job.last_result || '—'}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                          {formatDateTime(job.updated_at)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
