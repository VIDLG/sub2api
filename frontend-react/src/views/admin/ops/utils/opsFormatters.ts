/**
 * Ops Dashboard — shared formatting helpers and threshold logic.
 */

import type { TFunction } from 'i18next'
import type {
  OpsDashboardOverview,
  OpsMetricThresholds,
  OpsSystemMetricsSnapshot,
} from '@/api/admin/ops'

// ==================== Number / Date Formatting ====================

export function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

export function fmtMs(ms: number | null | undefined) {
  if (ms == null) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`
}

export function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`
}

export function formatNumber(n: number) {
  return n.toLocaleString()
}

export function formatDateTime(s: string) {
  const d = new Date(s)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}:${ss}`
}

const RANGE_MAP: Record<string, number> = {
  '5m': 5,
  '30m': 30,
  '1h': 60,
  '6h': 360,
  '24h': 1440,
  '1d': 1440,
  '7d': 10080,
  '15d': 21600,
  '30d': 43200,
}

export function parseTimeRangeMinutes(range: string): number {
  return RANGE_MAP[range] ?? 60
}

// ==================== Threshold Logic ====================

export type ThresholdLevel = 'normal' | 'warning' | 'critical'

export function getSLAThresholdLevel(
  slaPercent: number | null | undefined,
  thresholds: OpsMetricThresholds | null | undefined,
): ThresholdLevel {
  if (slaPercent == null) return 'normal'
  const min = thresholds?.sla_percent_min ?? 99.0
  if (slaPercent < min) return 'critical'
  if (slaPercent < min + 0.1) return 'warning'
  return 'normal'
}

export function getRequestErrorRateThresholdLevel(
  ratePercent: number | null | undefined,
  thresholds: OpsMetricThresholds | null | undefined,
): ThresholdLevel {
  if (ratePercent == null) return 'normal'
  const max = thresholds?.request_error_rate_percent_max ?? 5.0
  if (ratePercent >= max) return 'critical'
  if (ratePercent >= max * 0.8) return 'warning'
  return 'normal'
}

export function getUpstreamErrorRateThresholdLevel(
  ratePercent: number | null | undefined,
  thresholds: OpsMetricThresholds | null | undefined,
): ThresholdLevel {
  if (ratePercent == null) return 'normal'
  const max = thresholds?.upstream_error_rate_percent_max ?? 5.0
  if (ratePercent >= max) return 'critical'
  if (ratePercent >= max * 0.8) return 'warning'
  return 'normal'
}

export function getTTFTThresholdLevel(
  ttftMs: number | null | undefined,
  thresholds: OpsMetricThresholds | null | undefined,
): ThresholdLevel {
  if (ttftMs == null) return 'normal'
  const max = thresholds?.ttft_p99_ms_max ?? 3000
  if (ttftMs >= max) return 'critical'
  if (ttftMs >= max * 0.8) return 'warning'
  return 'normal'
}

export function getThresholdColorClass(level: ThresholdLevel): string {
  switch (level) {
    case 'critical':
      return 'text-red-600 dark:text-red-400'
    case 'warning':
      return 'text-yellow-600 dark:text-yellow-400'
    default:
      return 'text-green-600 dark:text-green-400'
  }
}

// ==================== Health Score Helpers ====================

export function getHealthScoreColor(score: number | null | undefined, isIdle: boolean): string {
  if (isIdle || score == null) return '#9ca3af' // gray-400
  if (score >= 90) return '#22c55e' // green-500
  if (score >= 60) return '#eab308' // yellow-500
  return '#ef4444' // red-500
}

export function getHealthScoreClass(score: number | null | undefined, isIdle: boolean): string {
  if (isIdle || score == null) return 'text-gray-400'
  if (score >= 90) return 'text-green-600 dark:text-green-400'
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

// ==================== System Health Helpers ====================

export function getCPUClass(pct: number | null | undefined): string {
  if (pct == null) return 'text-gray-400'
  if (pct >= 95) return 'text-red-600 dark:text-red-400'
  if (pct >= 80) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-green-600 dark:text-green-400'
}

export function getMemClass(pct: number | null | undefined): string {
  if (pct == null) return 'text-gray-400'
  if (pct >= 95) return 'text-red-600 dark:text-red-400'
  if (pct >= 85) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-green-600 dark:text-green-400'
}

export function getDBRedisClass(
  ok: boolean | null | undefined,
  usagePct: number | null | undefined,
): string {
  if (ok === false) return 'text-red-600 dark:text-red-400'
  if (usagePct != null) {
    if (usagePct >= 90) return 'text-red-600 dark:text-red-400'
    if (usagePct >= 70) return 'text-yellow-600 dark:text-yellow-400'
  }
  if (ok === true) return 'text-green-600 dark:text-green-400'
  return 'text-gray-400'
}

export function getDBRedisLabel(
  ok: boolean | null | undefined,
  usagePct: number | null | undefined,
  t: TFunction,
): string {
  if (ok === false) return t('common.critical', 'Critical')
  if (usagePct != null) return `${usagePct.toFixed(1)}%`
  if (ok === true) return t('admin.ops.ok', 'OK')
  return t('admin.ops.noData', 'No Data')
}

export function getGoroutineClass(count: number | null | undefined): string {
  if (count == null) return 'text-gray-400'
  if (count >= 15000) return 'text-red-600 dark:text-red-400'
  if (count >= 8000) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-green-600 dark:text-green-400'
}

export function getGoroutineLabel(count: number | null | undefined, t: TFunction): string {
  if (count == null) return t('admin.ops.noData', 'No Data')
  if (count >= 15000) return t('common.critical', 'Critical')
  if (count >= 8000) return t('common.warning', 'Warning')
  return t('admin.ops.ok', 'OK')
}

// ==================== Diagnosis Report ====================

export interface DiagnosisItem {
  type: 'critical' | 'warning' | 'info'
  message: string
  impact: string
  action?: string
}

export function buildDiagnosisReport(
  overview: OpsDashboardOverview | null | undefined,
  thresholds: OpsMetricThresholds | null | undefined,
  t: TFunction,
): DiagnosisItem[] {
  if (!overview) return []

  const items: DiagnosisItem[] = []
  const sys: OpsSystemMetricsSnapshot | null | undefined = overview.system_metrics

  // System idle check
  const isIdle =
    overview.request_count_total === 0 &&
    (overview.health_score == null || overview.health_score === 0)
  if (isIdle) {
    items.push({
      type: 'info',
      message: t('admin.ops.diagnosis.idle', 'System is idle'),
      impact: t('admin.ops.diagnosis.idleImpact', 'No traffic detected in this period'),
    })
    return items
  }

  // DB down
  if (sys?.db_ok === false) {
    items.push({
      type: 'critical',
      message: t('admin.ops.diagnosis.dbDown', 'Database connection failed'),
      impact: t('admin.ops.diagnosis.dbDownImpact', 'All requests may fail'),
      action: t(
        'admin.ops.diagnosis.dbDownAction',
        'Check database server and connection settings',
      ),
    })
  }

  // Redis down
  if (sys?.redis_ok === false) {
    items.push({
      type: 'critical',
      message: t('admin.ops.diagnosis.redisDown', 'Redis connection failed'),
      impact: t('admin.ops.diagnosis.redisDownImpact', 'Caching and rate-limiting may fail'),
      action: t(
        'admin.ops.diagnosis.redisDownAction',
        'Check Redis server and connection settings',
      ),
    })
  }

  // CPU
  const cpu = sys?.cpu_usage_percent
  if (cpu != null && cpu >= 95) {
    items.push({
      type: 'critical',
      message: t('admin.ops.diagnosis.cpuCritical', 'CPU usage critical: {{usage}}%', {
        usage: cpu.toFixed(1),
      }),
      impact: t('admin.ops.diagnosis.cpuCriticalImpact', 'Severe performance degradation expected'),
      action: t('admin.ops.diagnosis.cpuCriticalAction', 'Scale up or reduce load immediately'),
    })
  } else if (cpu != null && cpu >= 80) {
    items.push({
      type: 'warning',
      message: t('admin.ops.diagnosis.cpuHigh', 'CPU usage high: {{usage}}%', {
        usage: cpu.toFixed(1),
      }),
      impact: t('admin.ops.diagnosis.cpuHighImpact', 'May cause increased latency'),
      action: t('admin.ops.diagnosis.cpuHighAction', 'Monitor closely and plan scaling'),
    })
  }

  // Memory
  const mem = sys?.memory_usage_percent
  if (mem != null && mem >= 95) {
    items.push({
      type: 'critical',
      message: t('admin.ops.diagnosis.memoryCritical', 'Memory usage critical: {{usage}}%', {
        usage: mem.toFixed(1),
      }),
      impact: t('admin.ops.diagnosis.memoryCriticalImpact', 'OOM risk, requests may be dropped'),
      action: t('admin.ops.diagnosis.memoryCriticalAction', 'Increase memory or investigate leaks'),
    })
  } else if (mem != null && mem >= 85) {
    items.push({
      type: 'warning',
      message: t('admin.ops.diagnosis.memoryHigh', 'Memory usage high: {{usage}}%', {
        usage: mem.toFixed(1),
      }),
      impact: t('admin.ops.diagnosis.memoryHighImpact', 'May lead to OOM if load increases'),
      action: t('admin.ops.diagnosis.memoryHighAction', 'Monitor memory usage trends'),
    })
  }

  // TTFT
  const ttft = overview.ttft?.p99_ms
  const ttftMax = thresholds?.ttft_p99_ms_max ?? 3000
  if (ttft != null && ttft >= ttftMax) {
    items.push({
      type: 'warning',
      message: t('admin.ops.diagnosis.ttftHigh', 'TTFT P99 is high: {{ttft}}ms', {
        ttft: Math.round(ttft),
      }),
      impact: t('admin.ops.diagnosis.ttftHighImpact', 'Users experience slow first token response'),
      action: t('admin.ops.diagnosis.ttftHighAction', 'Check upstream provider latency'),
    })
  }

  // Upstream error rate
  const upRate = overview.upstream_error_rate * 100
  const upMax = thresholds?.upstream_error_rate_percent_max ?? 5.0
  if (upRate >= upMax) {
    items.push({
      type: 'critical',
      message: t(
        'admin.ops.diagnosis.upstreamCritical',
        'Upstream error rate critical: {{rate}}%',
        { rate: upRate.toFixed(2) },
      ),
      impact: t('admin.ops.diagnosis.upstreamCriticalImpact', 'Significant upstream failures'),
      action: t(
        'admin.ops.diagnosis.upstreamCriticalAction',
        'Check upstream API status and account health',
      ),
    })
  } else if (upRate >= upMax * 0.8) {
    items.push({
      type: 'warning',
      message: t('admin.ops.diagnosis.upstreamHigh', 'Upstream error rate elevated: {{rate}}%', {
        rate: upRate.toFixed(2),
      }),
      impact: t('admin.ops.diagnosis.upstreamHighImpact', 'Some upstream requests are failing'),
      action: t('admin.ops.diagnosis.upstreamHighAction', 'Monitor upstream error logs'),
    })
  }

  // Request error rate
  const errRate = overview.error_rate * 100
  const errMax = thresholds?.request_error_rate_percent_max ?? 5.0
  if (errRate >= errMax) {
    items.push({
      type: 'critical',
      message: t('admin.ops.diagnosis.errorHigh', 'Error rate critical: {{rate}}%', {
        rate: errRate.toFixed(2),
      }),
      impact: t('admin.ops.diagnosis.errorHighImpact', 'High number of failed requests'),
      action: t(
        'admin.ops.diagnosis.errorHighAction',
        'Investigate error logs and fix root causes',
      ),
    })
  } else if (errRate >= errMax * 0.8) {
    items.push({
      type: 'warning',
      message: t('admin.ops.diagnosis.errorElevated', 'Error rate elevated: {{rate}}%', {
        rate: errRate.toFixed(2),
      }),
      impact: t('admin.ops.diagnosis.errorElevatedImpact', 'Error rate is approaching threshold'),
      action: t('admin.ops.diagnosis.errorElevatedAction', 'Review recent error patterns'),
    })
  }

  // SLA
  const sla = overview.sla * 100
  const slaMin = thresholds?.sla_percent_min ?? 99.0
  if (sla < slaMin) {
    items.push({
      type: 'critical',
      message: t('admin.ops.diagnosis.slaCritical', 'SLA below target: {{sla}}%', {
        sla: sla.toFixed(3),
      }),
      impact: t('admin.ops.diagnosis.slaCriticalImpact', 'Service level agreement is breached'),
      action: t(
        'admin.ops.diagnosis.slaCriticalAction',
        'Address errors and latency issues urgently',
      ),
    })
  } else if (sla < slaMin + 0.1) {
    items.push({
      type: 'warning',
      message: t('admin.ops.diagnosis.slaLow', 'SLA approaching threshold: {{sla}}%', {
        sla: sla.toFixed(3),
      }),
      impact: t('admin.ops.diagnosis.slaLowImpact', 'SLA may be breached if issues persist'),
      action: t('admin.ops.diagnosis.slaLowAction', 'Investigate degradation sources'),
    })
  }

  // Health score
  const hs = overview.health_score
  if (hs != null && hs < 60) {
    items.push({
      type: 'critical',
      message: t('admin.ops.diagnosis.healthCritical', 'Health score critical: {{score}}', {
        score: hs,
      }),
      impact: t('admin.ops.diagnosis.healthCriticalImpact', 'System is in poor health'),
      action: t('admin.ops.diagnosis.healthCriticalAction', 'Address all critical issues above'),
    })
  } else if (hs != null && hs < 90) {
    items.push({
      type: 'warning',
      message: t('admin.ops.diagnosis.healthLow', 'Health score below optimal: {{score}}', {
        score: hs,
      }),
      impact: t('admin.ops.diagnosis.healthLowImpact', 'Some metrics need attention'),
      action: t('admin.ops.diagnosis.healthLowAction', 'Review warning items above'),
    })
  }

  // All healthy
  if (items.length === 0) {
    items.push({
      type: 'info',
      message: t('admin.ops.diagnosis.healthy', 'System is healthy'),
      impact: t('admin.ops.diagnosis.healthyImpact', 'All metrics within normal range'),
    })
  }

  return items
}

// ==================== DB Connection Usage % ====================

export function getDBUsagePercent(sys: OpsSystemMetricsSnapshot | null | undefined): number | null {
  if (!sys) return null
  const active = sys.db_conn_active
  const max = sys.db_max_open_conns
  if (active != null && max != null && max > 0) return (active / max) * 100
  return null
}

export function getRedisUsagePercent(
  sys: OpsSystemMetricsSnapshot | null | undefined,
): number | null {
  if (!sys) return null
  const total = sys.redis_conn_total
  const max = sys.redis_pool_size
  if (total != null && max != null && max > 0) return (total / max) * 100
  return null
}
