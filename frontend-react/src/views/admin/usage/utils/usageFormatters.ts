/**
 * Shared formatters for the Usage view.
 */

import type { UsageLog } from '@/types'

export function formatTokens(n: number | null | undefined): string {
  if (n == null) return '-'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

export function formatCacheTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function formatCost(n: number | null | undefined): string {
  if (n == null) return '-'
  return `$${n.toFixed(4)}`
}

export function formatCostPrecise(n: number | null | undefined): string {
  if (n == null) return '-'
  return `$${n.toFixed(6)}`
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '-'
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${ms}ms`
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

export function formatReasoningEffort(effort: string | null | undefined): string {
  if (!effort) return '-'
  const map: Record<string, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    xhigh: 'Xhigh',
  }
  return map[effort.toLowerCase()] ?? '-'
}

export type RequestTypeInfo = {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  className: string
}

export function resolveRequestType(log: UsageLog): RequestTypeInfo {
  const rt = log.request_type
  if (rt === 'ws_v2') {
    return {
      label: 'WebSocket',
      variant: 'outline',
      className: 'border-violet-300 text-violet-700 dark:border-violet-600 dark:text-violet-400',
    }
  }
  if (rt === 'stream' || (!rt && log.stream)) {
    return {
      label: 'Stream',
      variant: 'outline',
      className: 'border-blue-300 text-blue-700 dark:border-blue-600 dark:text-blue-400',
    }
  }
  if (rt === 'sync' || (!rt && !log.stream)) {
    return {
      label: 'Sync',
      variant: 'outline',
      className: 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400',
    }
  }
  return {
    label: 'Unknown',
    variant: 'outline',
    className: 'border-amber-300 text-amber-700 dark:border-amber-600 dark:text-amber-400',
  }
}
