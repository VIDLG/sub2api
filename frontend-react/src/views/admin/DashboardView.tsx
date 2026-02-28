/**
 * Admin Dashboard View
 * Shows system-wide stats (users, keys, accounts, requests, tokens, cost, performance)
 * with date range filtering and model/trend/user usage tables.
 * Mirrors Vue admin/DashboardView.vue
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { DashboardStats, TrendDataPoint, ModelStat, UserUsageTrendPoint } from '@/types'
import {
  KeyIcon,
  ChartIcon,
  ServerIcon,
  CubeIcon,
  DatabaseIcon,
  BoltIcon,
  ClockIcon,
  UserPlusIcon,
} from '@/components/icons'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { TokenTrendChart } from '@/components/charts/TokenTrendChart'
import { ModelDistributionChart } from '@/components/charts/ModelDistributionChart'

// ==================== Format Helpers ====================

function formatTokens(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`
  return value.toLocaleString()
}

function formatNumber(value: number) {
  return value.toLocaleString()
}

function formatCost(value: number) {
  if (value >= 1000) return (value / 1000).toFixed(2) + 'K'
  if (value >= 1) return value.toFixed(2)
  if (value >= 0.01) return value.toFixed(3)
  return value.toFixed(4)
}

function formatDuration(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`
}

function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function DashboardView() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)

  const [startDate, setStartDate] = useState(() =>
    formatLocalDate(new Date(Date.now() - 6 * 86400000)),
  )
  const [endDate, setEndDate] = useState(() => formatLocalDate(new Date()))
  const [granularity, setGranularity] = useState<'day' | 'hour'>('day')

  // ==================== Queries ====================

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['admin', 'dashboard', 'stats'],
    queryFn: () => adminAPI.dashboard.getStats(),
    meta: { onError: () => showError(t('admin.dashboard.failedToLoad')) },
  })

  const chartParams = { start_date: startDate, end_date: endDate, granularity }

  const { data: trendData = [], isFetching: chartsLoading } = useQuery<TrendDataPoint[]>({
    queryKey: ['admin', 'dashboard', 'trend', chartParams],
    queryFn: async () => {
      const res = await adminAPI.dashboard.getUsageTrend(chartParams)
      return res.trend || []
    },
  })

  const { data: modelStats = [] } = useQuery<ModelStat[]>({
    queryKey: ['admin', 'dashboard', 'models', startDate, endDate],
    queryFn: async () => {
      const res = await adminAPI.dashboard.getModelStats({
        start_date: startDate,
        end_date: endDate,
      })
      return res.models || []
    },
  })

  const { data: userTrend = [] } = useQuery<UserUsageTrendPoint[]>({
    queryKey: ['admin', 'dashboard', 'userTrend', chartParams],
    queryFn: async () => {
      const res = await adminAPI.dashboard.getUserUsageTrend({ ...chartParams, limit: 12 })
      return res.trend || []
    },
  })

  // ==================== Render ====================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner" />
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-6">
      {/* Row 1: Core Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Total API Keys */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
              <KeyIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('admin.dashboard.apiKeys')}
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {stats.total_api_keys}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                {stats.active_api_keys} {t('common.active')}
              </p>
            </div>
          </div>
        </div>

        {/* Service Accounts */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30">
              <ServerIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('admin.dashboard.accounts')}
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {stats.total_accounts}
              </p>
              <p className="text-xs">
                <span className="text-green-600 dark:text-green-400">
                  {stats.normal_accounts} {t('common.active')}
                </span>
                {stats.error_accounts > 0 && (
                  <span className="ml-1 text-red-500">
                    {stats.error_accounts} {t('common.error')}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Today Requests */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
              <ChartIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('admin.dashboard.todayRequests')}
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {stats.today_requests}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('common.total')}: {formatNumber(stats.total_requests)}
              </p>
            </div>
          </div>
        </div>

        {/* New Users Today */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
              <UserPlusIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('admin.dashboard.users')}
              </p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                +{stats.today_new_users}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('common.total')}: {formatNumber(stats.total_users)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Token Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Today Tokens */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30">
              <CubeIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('admin.dashboard.todayTokens')}
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatTokens(stats.today_tokens)}
              </p>
              <p className="text-xs">
                <span
                  className="text-amber-600 dark:text-amber-400"
                  title={t('admin.dashboard.actual')}
                >
                  ${formatCost(stats.today_actual_cost)}
                </span>
                <span
                  className="text-gray-400 dark:text-gray-500"
                  title={t('admin.dashboard.standard')}
                >
                  {' '}
                  / ${formatCost(stats.today_cost)}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Total Tokens */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-900/30">
              <DatabaseIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('admin.dashboard.totalTokens')}
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatTokens(stats.total_tokens)}
              </p>
              <p className="text-xs">
                <span
                  className="text-indigo-600 dark:text-indigo-400"
                  title={t('admin.dashboard.actual')}
                >
                  ${formatCost(stats.total_actual_cost)}
                </span>
                <span
                  className="text-gray-400 dark:text-gray-500"
                  title={t('admin.dashboard.standard')}
                >
                  {' '}
                  / ${formatCost(stats.total_cost)}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Performance (RPM/TPM) */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-violet-100 p-2 dark:bg-violet-900/30">
              <BoltIcon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('admin.dashboard.performance')}
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatTokens(stats.rpm)}
                </p>
                <span className="text-xs text-gray-500 dark:text-gray-400">RPM</span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">
                  {formatTokens(stats.tpm)}
                </p>
                <span className="text-xs text-gray-500 dark:text-gray-400">TPM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Avg Response Time */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-rose-100 p-2 dark:bg-rose-900/30">
              <ClockIcon className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('admin.dashboard.avgResponse')}
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatDuration(stats.average_duration_ms)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {stats.active_users} {t('admin.dashboard.activeUsers')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="space-y-6">
        {/* Date Range Filter */}
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('admin.dashboard.timeRange')}:
            </span>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={({ startDate: s, endDate: e }) => {
                setStartDate(s)
                setEndDate(e)
                const diffMs = new Date(e).getTime() - new Date(s).getTime()
                setGranularity(diffMs <= 86400000 ? 'hour' : 'day')
              }}
            />
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('admin.dashboard.granularity')}:
              </span>
              <Select
                value={granularity}
                onValueChange={(v) => setGranularity(v as 'day' | 'hour')}
              >
                <SelectTrigger className="w-28 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">{t('admin.dashboard.day')}</SelectItem>
                  <SelectItem value="hour">{t('admin.dashboard.hour')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Model Distribution */}
          <div className="card p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
              {t('admin.dashboard.modelDistribution')}
            </h3>
            <ModelDistributionChart
              data={modelStats}
              loading={chartsLoading}
              emptyText={t('admin.dashboard.noDataAvailable')}
            />
          </div>

          {/* Token Usage Trend */}
          <div className="card p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
              {t('admin.dashboard.tokenUsageTrend')}
            </h3>
            <TokenTrendChart
              data={trendData}
              loading={chartsLoading}
              emptyText={t('admin.dashboard.noDataAvailable')}
            />
          </div>
        </div>

        {/* User Usage Trend (Full Width) - keep as table since it's per-user-per-day data */}
        <div className="card p-4">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
            {t('admin.dashboard.recentUsage')} (Top 12)
          </h3>
          {userTrend.length > 0 ? (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 dark:text-gray-400">
                    <th className="pb-2 text-left">{t('admin.dashboard.date')}</th>
                    <th className="pb-2 text-left">{t('admin.dashboard.user')}</th>
                    <th className="pb-2 text-right">{t('admin.dashboard.requests')}</th>
                    <th className="pb-2 text-right">{t('admin.dashboard.tokens')}</th>
                    <th className="pb-2 text-right">{t('admin.dashboard.actual')}</th>
                  </tr>
                </thead>
                <tbody>
                  {userTrend.map((point, idx) => (
                    <tr
                      key={`${point.date}-${point.user_id}-${idx}`}
                      className="border-t border-gray-100 dark:border-gray-700"
                    >
                      <td className="py-1.5 text-gray-900 dark:text-white">{point.date}</td>
                      <td className="py-1.5 text-gray-700 dark:text-gray-300">
                        {point.email?.split('@')[0] || `User #${point.user_id}`}
                      </td>
                      <td className="py-1.5 text-right text-gray-600 dark:text-gray-400">
                        {formatNumber(point.requests)}
                      </td>
                      <td className="py-1.5 text-right text-gray-600 dark:text-gray-400">
                        {formatTokens(point.tokens)}
                      </td>
                      <td className="py-1.5 text-right text-green-600 dark:text-green-400">
                        ${formatCost(point.actual_cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
              {t('admin.dashboard.noDataAvailable')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
