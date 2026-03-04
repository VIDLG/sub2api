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
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {/* Total Requests */}
      <div className="card p-4 flex items-center gap-3">
        <div className="rounded-lg bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/30">
          <span className="text-lg font-bold">#</span>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('admin.usage.totalRequests', 'Total Requests')}
          </p>
          <p className="text-xl font-bold">
            {loading ? <Skeleton className="h-7 w-20" /> : (stats?.total_requests ?? 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400">{t('usage.inSelectedRange', 'in selected range')}</p>
        </div>
      </div>

      {/* Total Tokens */}
      <div className="card p-4 flex items-center gap-3">
        <div className="rounded-lg bg-amber-100 p-2 text-amber-600 dark:bg-amber-900/30">
          <span className="text-lg font-bold">T</span>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('admin.usage.totalTokens', 'Total Tokens')}
          </p>
          <p className="text-xl font-bold">
            {loading ? <Skeleton className="h-7 w-20" /> : formatTokens(stats?.total_tokens)}
          </p>
          {!loading && stats && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('usage.in', 'In')}: {formatTokens(stats.total_input_tokens)} / {t('usage.out', 'Out')}:{' '}
              {formatTokens(stats.total_output_tokens)}
            </p>
          )}
        </div>
      </div>

      {/* Total Cost */}
      <div className="card p-4 flex items-center gap-3">
        <div className="rounded-lg bg-green-100 p-2 text-green-600 dark:bg-green-900/30">
          <span className="text-lg font-bold">$</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('admin.usage.totalCost', 'Total Cost')}
          </p>
          <p className="text-xl font-bold text-green-600">
            {loading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              formatCost(stats?.total_account_cost ?? stats?.total_actual_cost)
            )}
          </p>
          {!loading && stats && stats.total_account_cost != null ? (
            <p className="text-xs text-gray-400">
              {t('admin.usage.userBilled', 'User Billed')}: {formatCost(stats.total_actual_cost)} ·{' '}
              {t('usage.standardCost', 'Standard Cost')}: {formatCost(stats.total_cost)}
            </p>
          ) : (
            !loading && (
              <p className="text-xs text-gray-400">
                {t('usage.standardCost', 'Standard Cost')}: {formatCost(stats?.total_cost)}
              </p>
            )
          )}
        </div>
      </div>

      {/* Average Duration */}
      <div className="card p-4 flex items-center gap-3">
        <div className="rounded-lg bg-purple-100 p-2 text-purple-600 dark:bg-purple-900/30">
          <span className="text-lg font-bold">ms</span>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('admin.usage.avgDuration', 'Avg Duration')}
          </p>
          <p className="text-xl font-bold">
            {loading ? <Skeleton className="h-7 w-20" /> : formatDuration(stats?.average_duration_ms)}
          </p>
        </div>
      </div>
    </div>
  )
}
