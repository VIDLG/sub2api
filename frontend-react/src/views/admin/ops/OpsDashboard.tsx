/**
 * Operations Dashboard
 * Real-time ops monitoring with charts for throughput, latency, and errors.
 */

import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import { opsAPI } from '@/api/admin/ops'
import type {
  OpsDashboardOverview,
  OpsThroughputTrendResponse,
  OpsLatencyHistogramResponse,
  OpsErrorTrendResponse,
  OpsErrorDistributionResponse,
  OpsQueryMode,
} from '@/api/admin/ops'
import { RefreshIcon, ShieldIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { OpsThroughputChart } from '@/components/charts/ops/OpsThroughputChart'
import { OpsLatencyHistogramChart } from '@/components/charts/ops/OpsLatencyHistogramChart'
import { OpsErrorTrendChart } from '@/components/charts/ops/OpsErrorTrendChart'
import { OpsErrorDistributionChart } from '@/components/charts/ops/OpsErrorDistributionChart'

// ==================== Types ====================

type TimeRange = '5m' | '30m' | '1h' | '6h' | '24h'

// ==================== Helpers ====================

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function fmtMs(ms: number | null | undefined) {
  if (ms == null) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`
}

// ==================== Toggle ====================

function Toggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        value ? 'bg-primary-500' : 'bg-gray-300 dark:bg-dark-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          value ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

// ==================== Stat Card ====================

function StatCard({
  label,
  value,
  sub,
  color = 'primary',
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  color?: 'primary' | 'success' | 'danger' | 'warning'
}) {
  const iconCls = {
    primary: 'stat-icon-primary',
    success: 'stat-icon-success',
    danger: 'stat-icon-danger',
    warning: 'stat-icon-warning',
  }[color]

  return (
    <div className="stat-card">
      <div className={`stat-icon ${iconCls}`} />
      <div className="min-w-0">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {sub && <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{sub}</div>}
      </div>
    </div>
  )
}

// ==================== Chart Card ====================

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
      {children}
    </div>
  )
}

// ==================== Component ====================

export default function OpsDashboard() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)

  const [opsEnabled, setOpsEnabled] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [timeRange, setTimeRange] = useState<TimeRange>('1h')
  const queryMode: OpsQueryMode = 'auto'

  // ==================== Load settings ====================

  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => adminAPI.settings.getSettings(),
  })

  useEffect(() => {
    if (settingsData) {
      setOpsEnabled(settingsData.ops_monitoring_enabled ?? false)
    }
  }, [settingsData])

  // ==================== Toggle handler ====================

  const handleToggle = async (enabled: boolean) => {
    setToggling(true)
    try {
      await adminAPI.settings.updateSettings({ ops_monitoring_enabled: enabled })
      setOpsEnabled(enabled)
      showSuccess(
        enabled
          ? t('admin.ops.enabled', 'Ops monitoring enabled')
          : t('admin.ops.disabled', 'Ops monitoring disabled'),
      )
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string }
      showError(e?.response?.data?.detail || e?.message || 'Failed to update settings')
    } finally {
      setToggling(false)
    }
  }

  // ==================== Ops queries (only when enabled) ====================

  const apiParams = { time_range: timeRange, mode: queryMode }

  const { data: overview, refetch: refetchOverview } = useQuery<OpsDashboardOverview>({
    queryKey: ['ops', 'overview', apiParams],
    queryFn: () => opsAPI.getDashboardOverview(apiParams),
    enabled: opsEnabled,
    refetchInterval: 30_000,
  })

  const {
    data: throughput,
    isFetching: loadingThroughput,
    refetch: refetchThroughput,
  } = useQuery<OpsThroughputTrendResponse>({
    queryKey: ['ops', 'throughput', apiParams],
    queryFn: () => opsAPI.getThroughputTrend(apiParams),
    enabled: opsEnabled,
    refetchInterval: 30_000,
  })

  const {
    data: latency,
    isFetching: loadingLatency,
    refetch: refetchLatency,
  } = useQuery<OpsLatencyHistogramResponse>({
    queryKey: ['ops', 'latency', apiParams],
    queryFn: () => opsAPI.getLatencyHistogram(apiParams),
    enabled: opsEnabled,
    refetchInterval: 30_000,
  })

  const {
    data: errorTrend,
    isFetching: loadingErrorTrend,
    refetch: refetchErrorTrend,
  } = useQuery<OpsErrorTrendResponse>({
    queryKey: ['ops', 'errorTrend', apiParams],
    queryFn: () => opsAPI.getErrorTrend(apiParams),
    enabled: opsEnabled,
    refetchInterval: 30_000,
  })

  const {
    data: errorDist,
    isFetching: loadingErrorDist,
    refetch: refetchErrorDist,
  } = useQuery<OpsErrorDistributionResponse>({
    queryKey: ['ops', 'errorDist', apiParams],
    queryFn: () => opsAPI.getErrorDistribution(apiParams),
    enabled: opsEnabled,
    refetchInterval: 30_000,
  })

  const handleRefresh = useCallback(() => {
    refetchOverview()
    refetchThroughput()
    refetchLatency()
    refetchErrorTrend()
    refetchErrorDist()
  }, [refetchOverview, refetchThroughput, refetchLatency, refetchErrorTrend, refetchErrorDist])

  // ==================== Render ====================

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner" />
      </div>
    )
  }

  const timeRanges: TimeRange[] = ['5m', '30m', '1h', '6h', '24h']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{t('admin.ops.title', 'Operations Dashboard')}</h1>
          <p className="page-description">
            {t('admin.ops.description', 'System monitoring and health checks')}
          </p>
        </div>
        {opsEnabled && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            title={t('common.refresh', 'Refresh')}
          >
            <RefreshIcon className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Toggle Card */}
      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="stat-icon stat-icon-primary flex-shrink-0">
            <ShieldIcon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              {t('admin.ops.monitoringTitle', 'Operations Monitoring')}
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {t(
                'admin.ops.monitoringDesc',
                'Collect real-time metrics, track account health, monitor API latencies, and generate alerts for anomalies.',
              )}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('admin.ops.enableMonitoring', 'Enable Ops Monitoring')}
              </span>
              <Toggle value={opsEnabled} onChange={handleToggle} disabled={toggling} />
              {toggling && <span className="spinner h-4 w-4" />}
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard (only when enabled) */}
      {opsEnabled && (
        <div className="space-y-6">
          {/* Time Range Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t('admin.ops.timeRange', 'Time range')}:
            </span>
            <div className="flex rounded-lg border border-gray-200 dark:border-dark-700 overflow-hidden">
              {timeRanges.map((tr) => (
                <button
                  key={tr}
                  type="button"
                  onClick={() => setTimeRange(tr)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    timeRange === tr
                      ? 'bg-primary-500 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-dark-800 dark:text-gray-300 dark:hover:bg-dark-700'
                  }`}
                >
                  {tr}
                </button>
              ))}
            </div>
          </div>

          {/* Overview Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label={t('admin.ops.healthyAccounts', 'SLA')}
              value={overview ? fmtPct(overview.sla) : '—'}
              color={overview && overview.sla < 0.95 ? 'danger' : 'success'}
            />
            <StatCard
              label="QPS"
              value={overview ? overview.qps.current.toFixed(2) : '—'}
              sub={overview ? `peak ${overview.qps.peak.toFixed(2)}` : undefined}
              color="primary"
            />
            <StatCard
              label={t('admin.ops.activeAlerts', 'Error Rate')}
              value={overview ? fmtPct(overview.error_rate) : '—'}
              color={overview && overview.error_rate > 0.05 ? 'danger' : 'success'}
            />
            <StatCard
              label={t('admin.ops.avgLatency', 'P90 Latency')}
              value={fmtMs(overview?.duration?.p90_ms)}
              sub={overview ? `p50 ${fmtMs(overview.duration.p50_ms)}` : undefined}
              color="warning"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label={t('admin.ops.successRate', 'Requests')}
              value={overview ? fmtNum(overview.request_count_total) : '—'}
              sub={overview ? `${fmtNum(overview.success_count)} ok` : undefined}
              color="primary"
            />
            <StatCard
              label="TPS"
              value={overview ? fmtNum(overview.tps.current) : '—'}
              sub={overview ? `peak ${fmtNum(overview.tps.peak)}` : undefined}
              color="primary"
            />
            <StatCard
              label="429 Rate Limits"
              value={overview ? fmtNum(overview.upstream_429_count) : '—'}
              color={overview && overview.upstream_429_count > 0 ? 'warning' : 'success'}
            />
            <StatCard
              label="TTFT P90"
              value={fmtMs(overview?.ttft?.p90_ms)}
              sub={overview ? `p50 ${fmtMs(overview.ttft?.p50_ms)}` : undefined}
              color="warning"
            />
          </div>

          {/* Charts Row 1: Throughput + Latency */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title={t('admin.ops.realTimeMetrics', 'Throughput Trend (QPS / TPS·K)')}>
              <OpsThroughputChart
                points={throughput?.points ?? []}
                loading={loadingThroughput}
                timeRange={timeRange}
                emptyText={t('common.noData', 'No data')}
              />
            </ChartCard>

            <ChartCard title={t('admin.ops.accountHealth', 'Latency Distribution')}>
              <OpsLatencyHistogramChart
                data={latency ?? null}
                loading={loadingLatency}
                emptyText={t('common.noData', 'No data')}
              />
            </ChartCard>
          </div>

          {/* Charts Row 2: Error Trend + Error Distribution */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title={t('admin.ops.alertsConfig', 'Error Trend')}>
              <OpsErrorTrendChart
                points={errorTrend?.points ?? []}
                loading={loadingErrorTrend}
                timeRange={timeRange}
                emptyText={t('common.noData', 'No data')}
              />
            </ChartCard>

            <ChartCard title={t('admin.ops.auditLog', 'Error Distribution by Status Code')}>
              <OpsErrorDistributionChart
                data={errorDist ?? null}
                loading={loadingErrorDist}
                emptyText={t('common.noData', 'No data')}
              />
            </ChartCard>
          </div>
        </div>
      )}

      {/* Disabled State */}
      {!opsEnabled && (
        <div className="card p-8">
          <div className="empty-state">
            <div className="empty-state-icon">
              <ShieldIcon className="h-12 w-12" />
            </div>
            <h3 className="empty-state-title">
              {t('admin.ops.disabledTitle', 'Monitoring Disabled')}
            </h3>
            <p className="empty-state-description">
              {t(
                'admin.ops.disabledDesc',
                'Enable operations monitoring above to view real-time metrics, alerts, and health status.',
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
