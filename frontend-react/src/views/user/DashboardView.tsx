/**
 * User Dashboard View
 * Shows user stats (balance, API keys, requests, cost, tokens, performance)
 * with date range filtering for charts/trend data.
 * Mirrors Vue DashboardView.vue
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth'
import { usageAPI, type UserDashboardStats } from '@/api/usage'
import type { UsageLog, TrendDataPoint, ModelStat } from '@/types'
import {
  KeyIcon,
  ChartIcon,
  GiftIcon,
  CubeIcon,
  DatabaseIcon,
  BoltIcon,
  ClockIcon,
  DollarIcon,
  WalletIcon,
  ChevronRightIcon,
  BeakerIcon,
  ArrowRightIcon,
} from '@/components/icons'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TimeRangePicker, DASHBOARD_PRESETS } from '@/components/common/TimeRangePicker'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { TokenTrendChart } from '@/components/charts/TokenTrendChart'
import { ModelDistributionChart } from '@/components/charts/ModelDistributionChart'

// ==================== Format Helpers ====================

function formatBalance(b: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(b)
}

function formatNumber(n: number) {
  return n.toLocaleString()
}

function formatTokens(t: number) {
  if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(1)}M`
  if (t >= 1000) return `${(t / 1000).toFixed(1)}K`
  return t.toString()
}

function formatCost(c: number) {
  return c.toFixed(4)
}

function formatDuration(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(0)}ms`
}

function formatDateTime(dt: string) {
  return new Date(dt).toLocaleString()
}

function formatLocalDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DashboardView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const isSimpleMode = useAuthStore((s) => s.isSimpleMode)
  const refreshUser = useAuthStore((s) => s.refreshUser)

  const [datePreset, setDatePreset] = useState('7days')
  const [startDate, setStartDate] = useState(() =>
    formatLocalDate(new Date(Date.now() - 6 * 86400000)),
  )
  const [endDate, setEndDate] = useState(() => formatLocalDate(new Date()))
  const [granularity, setGranularity] = useState('day')

  // ==================== Queries ====================

  const { data: stats, isLoading } = useQuery<UserDashboardStats>({
    queryKey: ['user', 'dashboard', 'stats'],
    queryFn: async () => {
      await refreshUser()
      return usageAPI.getDashboardStats()
    },
  })

  const chartParams = {
    start_date: startDate,
    end_date: endDate,
    granularity: granularity as 'day' | 'hour',
  }

  const { data: chartData, isFetching: loadingCharts } = useQuery({
    queryKey: ['user', 'dashboard', 'charts', chartParams],
    queryFn: async () => {
      const [trendRes, modelRes] = await Promise.all([
        usageAPI.getDashboardTrend(chartParams),
        usageAPI.getDashboardModels({ start_date: startDate, end_date: endDate }),
      ])
      return {
        trendData: (trendRes.trend || []) as TrendDataPoint[],
        modelStats: (modelRes.models || []) as ModelStat[],
      }
    },
  })

  const { data: recentData, isFetching: loadingUsage } = useQuery({
    queryKey: ['user', 'dashboard', 'recent', startDate, endDate],
    queryFn: async () => {
      const res = await usageAPI.getByDateRange(startDate, endDate)
      return (res.items as UsageLog[]).slice(0, 5)
    },
  })

  const trendData = chartData?.trendData ?? []
  const modelStats = chartData?.modelStats ?? []
  const recentUsage = recentData ?? []

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
        {/* Balance */}
        {!isSimpleMode && (
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
                <WalletIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t('dashboard.balance')}
                </p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  ${formatBalance(user?.balance || 0)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('common.available')}</p>
              </div>
            </div>
          </div>
        )}

        {/* API Keys */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
              <KeyIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('dashboard.apiKeys')}
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

        {/* Today Requests */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
              <ChartIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('dashboard.todayRequests')}
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

        {/* Today Cost */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30">
              <DollarIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('dashboard.todayCost')}
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-purple-600 dark:text-purple-400">
                      ${formatCost(stats.today_actual_cost)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t('dashboard.actual')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm font-normal text-gray-400 dark:text-gray-500">
                      {' '}
                      / ${formatCost(stats.today_cost)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t('dashboard.standard')}</TooltipContent>
                </Tooltip>
              </p>
              <p className="text-xs">
                <span className="text-gray-500 dark:text-gray-400">{t('common.total')}: </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-purple-600 dark:text-purple-400">
                      ${formatCost(stats.total_actual_cost)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t('dashboard.actual')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-gray-400 dark:text-gray-500">
                      {' '}
                      / ${formatCost(stats.total_cost)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t('dashboard.standard')}</TooltipContent>
                </Tooltip>
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
                {t('dashboard.todayTokens')}
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatTokens(stats.today_tokens)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('dashboard.input')}: {formatTokens(stats.today_input_tokens)} /{' '}
                {t('dashboard.output')}: {formatTokens(stats.today_output_tokens)}
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
                {t('dashboard.totalTokens')}
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatTokens(stats.total_tokens)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('dashboard.input')}: {formatTokens(stats.total_input_tokens)} /{' '}
                {t('dashboard.output')}: {formatTokens(stats.total_output_tokens)}
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
                {t('dashboard.performance')}
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
                {t('dashboard.avgResponse')}
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {formatDuration(stats.average_duration_ms)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('dashboard.averageTime')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section: Date Range + Model Table + Trend Table */}
      <div className="space-y-6">
        {/* Date Range Filter */}
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('dashboard.timeRange')}:
            </span>
            <TimeRangePicker
              value={datePreset}
              onChange={(v, range) => {
                setDatePreset(v)
                if (range) {
                  setStartDate(range.from)
                  setEndDate(range.to)
                  const diffMs = new Date(range.to).getTime() - new Date(range.from).getTime()
                  setGranularity(diffMs <= 86400000 ? 'hour' : 'day')
                }
              }}
              presets={DASHBOARD_PRESETS}
              customRange={{ from: startDate, to: endDate }}
            />
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('dashboard.granularity')}:
              </span>
              <Select value={granularity} onValueChange={setGranularity}>
                <SelectTrigger className="w-28 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="day">{t('dashboard.day')}</SelectItem>
                  <SelectItem value="hour">{t('dashboard.hour')}</SelectItem>
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
              {t('dashboard.modelDistribution')}
            </h3>
            <ModelDistributionChart
              data={modelStats}
              loading={loadingCharts}
              emptyText={t('dashboard.noDataAvailable')}
            />
          </div>

          {/* Token Usage Trend */}
          <div className="card p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
              {t('dashboard.tokenUsageTrend')}
            </h3>
            <TokenTrendChart
              data={trendData}
              loading={loadingCharts}
              emptyText={t('dashboard.noDataAvailable')}
            />
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Usage + Quick Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Usage */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-dark-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('dashboard.recentUsage')}
            </h2>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-dark-800 dark:text-dark-400">
              {t('dashboard.last7Days')}
            </span>
          </div>
          <div className="p-6">
            {loadingUsage ? (
              <div className="flex items-center justify-center py-12">
                <div className="spinner" />
              </div>
            ) : recentUsage.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {t('dashboard.noUsageRecords')}
                </p>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {t('dashboard.startUsingApi')}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentUsage.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between rounded-xl bg-gray-50 p-4 transition-colors hover:bg-gray-100 dark:bg-dark-800/50 dark:hover:bg-dark-800"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/30">
                        <BeakerIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {log.model}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-dark-400">
                          {formatDateTime(log.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-green-600 dark:text-green-400">
                              ${formatCost(log.actual_cost)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{t('dashboard.actual')}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-normal text-gray-400 dark:text-gray-500">
                              {' '}
                              / ${formatCost(log.total_cost)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{t('dashboard.standard')}</TooltipContent>
                        </Tooltip>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-dark-400">
                        {(log.input_tokens + log.output_tokens).toLocaleString()} tokens
                      </p>
                    </div>
                  </div>
                ))}
                <Link
                  to="/usage"
                  className="flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary-600 transition-colors hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                >
                  {t('dashboard.viewAllUsage')}
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card lg:col-span-1">
          <div className="border-b border-gray-100 px-6 py-4 dark:border-dark-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('dashboard.quickActions')}
            </h2>
          </div>
          <div className="space-y-3 p-4">
            <button
              onClick={() => navigate({ to: '/keys' })}
              className="group flex w-full items-center gap-4 rounded-xl bg-gray-50 p-4 text-left transition-all duration-200 hover:bg-gray-100 dark:bg-dark-800/50 dark:hover:bg-dark-800"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-100 transition-transform group-hover:scale-105 dark:bg-primary-900/30">
                <KeyIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {t('dashboard.createApiKey')}
                </p>
                <p className="text-xs text-gray-500 dark:text-dark-400">
                  {t('dashboard.generateNewKey')}
                </p>
              </div>
              <ChevronRightIcon className="h-5 w-5 text-gray-400 transition-colors group-hover:text-primary-500 dark:text-dark-500" />
            </button>

            <button
              onClick={() => navigate({ to: '/usage' })}
              className="group flex w-full items-center gap-4 rounded-xl bg-gray-50 p-4 text-left transition-all duration-200 hover:bg-gray-100 dark:bg-dark-800/50 dark:hover:bg-dark-800"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 transition-transform group-hover:scale-105 dark:bg-emerald-900/30">
                <ChartIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {t('dashboard.viewUsage')}
                </p>
                <p className="text-xs text-gray-500 dark:text-dark-400">
                  {t('dashboard.checkDetailedLogs')}
                </p>
              </div>
              <ChevronRightIcon className="h-5 w-5 text-gray-400 transition-colors group-hover:text-emerald-500 dark:text-dark-500" />
            </button>

            <button
              onClick={() => navigate({ to: '/redeem' })}
              className="group flex w-full items-center gap-4 rounded-xl bg-gray-50 p-4 text-left transition-all duration-200 hover:bg-gray-100 dark:bg-dark-800/50 dark:hover:bg-dark-800"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 transition-transform group-hover:scale-105 dark:bg-amber-900/30">
                <GiftIcon className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {t('dashboard.redeemCode')}
                </p>
                <p className="text-xs text-gray-500 dark:text-dark-400">
                  {t('dashboard.addBalanceWithCode')}
                </p>
              </div>
              <ChevronRightIcon className="h-5 w-5 text-gray-400 transition-colors group-hover:text-amber-500 dark:text-dark-500" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
