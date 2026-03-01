/**
 * Usage stats cards — 4 cards showing summary metrics.
 */

import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import type { AdminUsageStatsResponse } from '@/api/admin/usage'
import { formatTokens, formatCost, formatDuration } from '../utils/usageFormatters'

interface Props {
  stats: AdminUsageStatsResponse | null
  loading: boolean
}

export default function UsageStatsCards({ stats, loading }: Props) {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Requests */}
      <div className="stat-card">
        <div className="stat-icon stat-icon-primary">
          <span className="text-lg font-bold">#</span>
        </div>
        <div className="min-w-0">
          <div className="stat-value">
            {loading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              (stats?.total_requests ?? 0).toLocaleString()
            )}
          </div>
          <div className="stat-label">{t('admin.usage.totalRequests', 'Total Requests')}</div>
        </div>
      </div>

      {/* Total Tokens */}
      <div className="stat-card">
        <div className="stat-icon stat-icon-success">
          <span className="text-lg font-bold">T</span>
        </div>
        <div className="min-w-0">
          <div className="stat-value">
            {loading ? <Skeleton className="h-7 w-20" /> : formatTokens(stats?.total_tokens)}
          </div>
          {!loading && stats && (
            <div className="text-xs text-muted-foreground">
              In: {formatTokens(stats.total_input_tokens)} / Out:{' '}
              {formatTokens(stats.total_output_tokens)}
            </div>
          )}
          <div className="stat-label">{t('admin.usage.totalTokens', 'Total Tokens')}</div>
        </div>
      </div>

      {/* Total Cost */}
      <div className="stat-card">
        <div className="stat-icon stat-icon-warning">
          <span className="text-lg font-bold">$</span>
        </div>
        <div className="min-w-0">
          <div className="stat-value">
            {loading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              formatCost(stats?.total_account_cost ?? stats?.total_actual_cost)
            )}
          </div>
          {!loading && stats && stats.total_account_cost != null && (
            <div className="text-xs text-muted-foreground">
              {t('admin.usage.userBilled', 'User Billed')}: {formatCost(stats.total_actual_cost)}
            </div>
          )}
          <div className="stat-label">{t('admin.usage.totalCost', 'Total Cost')}</div>
        </div>
      </div>

      {/* Average Duration */}
      <div className="stat-card">
        <div className="stat-icon stat-icon-danger">
          <span className="text-lg font-bold">ms</span>
        </div>
        <div className="min-w-0">
          <div className="stat-value">
            {loading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              formatDuration(stats?.average_duration_ms)
            )}
          </div>
          <div className="stat-label">{t('admin.usage.avgDuration', 'Avg Duration')}</div>
        </div>
      </div>
    </div>
  )
}
