/**
 * Operations Dashboard
 * Real-time ops monitoring: filters, auto-refresh, charts, and concurrency.
 */

import { useState, useEffect, useEffectEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useInterval } from 'ahooks'
import { adminAPI } from '@/api/admin'
import { opsAPI } from '@/api/admin/ops'
import type {
  OpsDashboardOverview,
  OpsThroughputTrendResponse,
  OpsLatencyHistogramResponse,
  OpsErrorTrendResponse,
  OpsErrorDistributionResponse,
  OpsQueryMode,
  OpsMetricThresholds,
} from '@/api/admin/ops'
import type { GroupPlatform } from '@/types'
import { RefreshIcon, ShieldIcon, QuestionIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { OpsThroughputChart } from '@/components/charts/ops/OpsThroughputChart'
import { OpsLatencyHistogramChart } from '@/components/charts/ops/OpsLatencyHistogramChart'
import { OpsErrorTrendChart } from '@/components/charts/ops/OpsErrorTrendChart'
import { OpsErrorDistributionChart } from '@/components/charts/ops/OpsErrorDistributionChart'
import { OpsSwitchRateChart } from '@/components/charts/ops/OpsSwitchRateChart'
import { TimeRangePicker, OPS_DASHBOARD_PRESETS } from '@/components/common/TimeRangePicker'
import { OpsConcurrencyCard } from './components/OpsConcurrencyCard'
import { OpsDashboardSkeleton } from './components/OpsDashboardSkeleton'
import { OpsAlertEventsCard } from './components/OpsAlertEventsCard'
import { OpsSystemLogTable } from './components/OpsSystemLogTable'
import { OpsHeaderSection } from './components/OpsHeaderSection'
import type { OpsRequestDetailsPreset } from './components/OpsHeaderSection'
import { OpsRequestDetailsModal } from './components/OpsRequestDetailsModal'
import { OpsErrorDetailsModal } from './components/OpsErrorDetailsModal'
import { OpsErrorDetailModal } from './components/OpsErrorDetailModal'
import { OpsAlertRulesDialog } from './components/OpsAlertRulesDialog'
import { OpsSettingsDialog } from './components/OpsSettingsDialog'

// ==================== Chart Card ====================

function ChartCard({
  title,
  help,
  actions,
  children,
}: {
  title: string
  help?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
          {help && (
            <Tooltip>
              <TooltipTrigger asChild>
                <QuestionIcon className="size-3.5 text-gray-400 dark:text-gray-500" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {help}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

// ==================== Component ====================

export default function OpsDashboard() {
  const { t } = useTranslation()

  const [opsEnabled, setOpsEnabled] = useState(false)
  const [firstLoad, setFirstLoad] = useState(true)

  const [timeRange, setTimeRange] = useState<'5m' | '30m' | '1h' | '6h' | '24h' | 'custom'>('1h')
  const [customRange, setCustomRange] = useState<{ from: string; to: string } | undefined>()
  const [platform, setPlatform] = useState<GroupPlatform | ''>('')
  const [groupId, setGroupId] = useState<number | null>(null)
  const [queryMode, setQueryMode] = useState<OpsQueryMode>('auto')

  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(30)
  const [countdown, setCountdown] = useState(30)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

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

  // ==================== Groups for filter dropdowns ====================

  const { data: groups } = useQuery({
    queryKey: ['admin', 'groups'],
    queryFn: () => adminAPI.groups.getAll(),
    enabled: opsEnabled,
  })

  const platforms = [...new Set((groups ?? []).map((g) => g.platform))]
  const filteredGroups = groups?.filter((g) => !platform || g.platform === platform) ?? []

  // Reset group when platform changes
  useEffect(() => {
    setGroupId(null)
  }, [platform])

  // ==================== Metric thresholds ====================

  const { data: thresholds } = useQuery<OpsMetricThresholds>({
    queryKey: ['ops', 'metricThresholds'],
    queryFn: () => opsAPI.getMetricThresholds(),
    enabled: opsEnabled,
  })

  // ==================== Auto-refresh settings from backend ====================

  const { data: advancedSettings, refetch: refetchAdvancedSettings } = useQuery({
    queryKey: ['ops', 'advancedSettings'],
    queryFn: () => opsAPI.getAdvancedSettings(),
    enabled: opsEnabled,
  })

  useEffect(() => {
    if (advancedSettings) {
      setAutoRefreshEnabled(advancedSettings.auto_refresh_enabled ?? false)
      const interval = advancedSettings.auto_refresh_interval_seconds || 30
      setAutoRefreshInterval(interval)
      setCountdown(interval)
    }
  }, [advancedSettings])

  // ==================== Modal state ====================

  const [alertRulesOpen, setAlertRulesOpen] = useState(false)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)

  const [requestDetailsOpen, setRequestDetailsOpen] = useState(false)
  const [requestDetailsPreset, setRequestDetailsPreset] = useState<OpsRequestDetailsPreset>({
    title: '',
  })
  const [errorDetailsOpen, setErrorDetailsOpen] = useState(false)
  const [errorDetailsType, setErrorDetailsType] = useState<'request' | 'upstream'>('request')
  const [errorDetailOpen, setErrorDetailOpen] = useState(false)
  const [errorDetailId, setErrorDetailId] = useState<number | null>(null)
  const [errorDetailType, setErrorDetailType] = useState<'request' | 'upstream'>('request')

  const handleOpenRequestDetails = (preset?: OpsRequestDetailsPreset) => {
    setRequestDetailsPreset(
      preset ?? { title: t('admin.ops.requestDetails.title', 'Request Details') },
    )
    setRequestDetailsOpen(true)
  }

  const handleOpenErrorDetails = (kind: 'request' | 'upstream') => {
    setErrorDetailsType(kind)
    setErrorDetailsOpen(true)
  }

  const handleOpenErrorDetail = (errorId: number) => {
    setErrorDetailId(errorId)
    // Infer type from which modal was open; default to the current errorDetailsType
    setErrorDetailType(errorDetailsType)
    setErrorDetailOpen(true)
  }

  const handleSettingsSaved = () => {
    refetchAdvancedSettings()
    // Thresholds may have changed too — refetch for header stat cards
    void refetchOverview()
  }

  // ==================== Ops queries ====================

  const apiParams =
    timeRange === 'custom' && customRange
      ? {
          start_time: customRange.from + 'T00:00:00Z',
          end_time: customRange.to + 'T23:59:59Z',
          mode: queryMode,
          platform: platform || undefined,
          group_id: groupId ?? undefined,
        }
      : {
          time_range: timeRange as '5m' | '30m' | '1h' | '6h' | '24h',
          mode: queryMode,
          platform: platform || undefined,
          group_id: groupId ?? undefined,
        }

  const { data: overview, refetch: refetchOverview } = useQuery<OpsDashboardOverview>({
    queryKey: ['ops', 'overview', apiParams],
    queryFn: () => opsAPI.getDashboardOverview(apiParams),
    enabled: opsEnabled,
    refetchInterval: false,
  })

  const {
    data: throughput,
    isFetching: loadingThroughput,
    refetch: refetchThroughput,
  } = useQuery<OpsThroughputTrendResponse>({
    queryKey: ['ops', 'throughput', apiParams],
    queryFn: () => opsAPI.getThroughputTrend(apiParams),
    enabled: opsEnabled,
    refetchInterval: false,
  })

  const {
    data: switchTrend,
    isFetching: loadingSwitchTrend,
    refetch: refetchSwitchTrend,
  } = useQuery<OpsThroughputTrendResponse>({
    queryKey: ['ops', 'switchTrend', platform, groupId, queryMode],
    queryFn: () => {
      const now = new Date()
      return opsAPI.getThroughputTrend({
        start_time: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
        end_time: now.toISOString(),
        mode: queryMode,
        platform: platform || undefined,
        group_id: groupId ?? undefined,
      })
    },
    enabled: opsEnabled,
    refetchInterval: false,
  })

  const {
    data: latency,
    isFetching: loadingLatency,
    refetch: refetchLatency,
  } = useQuery<OpsLatencyHistogramResponse>({
    queryKey: ['ops', 'latency', apiParams],
    queryFn: () => opsAPI.getLatencyHistogram(apiParams),
    enabled: opsEnabled,
    refetchInterval: false,
  })

  const {
    data: errorTrend,
    isFetching: loadingErrorTrend,
    refetch: refetchErrorTrend,
  } = useQuery<OpsErrorTrendResponse>({
    queryKey: ['ops', 'errorTrend', apiParams],
    queryFn: () => opsAPI.getErrorTrend(apiParams),
    enabled: opsEnabled,
    refetchInterval: false,
  })

  const {
    data: errorDist,
    isFetching: loadingErrorDist,
    refetch: refetchErrorDist,
  } = useQuery<OpsErrorDistributionResponse>({
    queryKey: ['ops', 'errorDist', apiParams],
    queryFn: () => opsAPI.getErrorDistribution(apiParams),
    enabled: opsEnabled,
    refetchInterval: false,
  })

  const handleRefresh = useEffectEvent(() => {
    refetchOverview()
    refetchThroughput()
    refetchSwitchTrend()
    refetchLatency()
    refetchErrorTrend()
    refetchErrorDist()
    setLastUpdated(new Date())
    setCountdown(autoRefreshInterval)
    setFirstLoad(false)
  })

  // Initial load when ops becomes enabled
  useEffect(() => {
    if (opsEnabled && firstLoad) {
      handleRefresh()
    }
  }, [opsEnabled, firstLoad])

  // Auto-refresh countdown
  useInterval(
    () => {
      if (countdown > 1) {
        setCountdown((c) => c - 1)
      } else {
        handleRefresh()
      }
    },
    autoRefreshEnabled && opsEnabled ? 1000 : undefined,
  )

  // ==================== Render ====================

  if (settingsLoading) {
    return <OpsDashboardSkeleton />
  }

  const queryModes: OpsQueryMode[] = ['auto', 'raw', 'preagg']
  const noData = t('common.noData', 'No data')

  return (
    <div className="space-y-6">
      {/* Dashboard (only when enabled) */}
      {opsEnabled && (
        <div className="space-y-6">
          {/* Header Section: Health Score + Realtime Traffic + Stat Cards + System Health */}
          <OpsHeaderSection
            toolbar={
              <>
                {/* Left: Title + status */}
                <div>
                  <h1 className="flex items-center gap-2 text-xl font-black text-gray-900 dark:text-white">
                    <svg
                      className="h-6 w-6 text-blue-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v10"
                      />
                    </svg>
                    {t('admin.ops.title', 'Ops Monitoring')}
                  </h1>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span
                          className={`relative inline-flex h-2 w-2 rounded-full ${
                            loadingThroughput ||
                            loadingLatency ||
                            loadingErrorTrend ||
                            loadingErrorDist ||
                            loadingSwitchTrend
                              ? 'bg-gray-400'
                              : 'bg-green-500'
                          }`}
                        />
                      </span>
                      {loadingThroughput ||
                      loadingLatency ||
                      loadingErrorTrend ||
                      loadingErrorDist ||
                      loadingSwitchTrend
                        ? t('admin.ops.loadingText', 'Loading...')
                        : t('admin.ops.ready', 'Ready')}
                    </span>
                    {lastUpdated && (
                      <>
                        <span>·</span>
                        <span>
                          {t('common.refresh', 'Refresh')}:{' '}
                          {lastUpdated
                            .toLocaleString('zh-CN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })
                            .replace(/\//g, '-')}
                        </span>
                      </>
                    )}
                    {autoRefreshEnabled && (
                      <>
                        <span>·</span>
                        <span>{countdown}s</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right: Filters + actions */}
                <div className="flex flex-wrap items-center gap-3">
                  <Select
                    value={platform || 'all'}
                    onValueChange={(v) => setPlatform(v === 'all' ? '' : (v as GroupPlatform))}
                  >
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue placeholder={t('admin.ops.allPlatforms', 'All Platforms')} />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="all">
                        {t('admin.ops.allPlatforms', 'All Platforms')}
                      </SelectItem>
                      {platforms.map((p) => (
                        <SelectItem key={p} value={p} className="capitalize">
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={groupId != null ? String(groupId) : 'all'}
                    onValueChange={(v) => setGroupId(v === 'all' ? null : Number(v))}
                  >
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue placeholder={t('admin.ops.allGroups', 'All Groups')} />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="all">{t('admin.ops.allGroups', 'All Groups')}</SelectItem>
                      {filteredGroups.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="mx-1 hidden h-4 w-[1px] bg-gray-200 dark:bg-dark-700 sm:block" />

                  <TimeRangePicker
                    value={timeRange}
                    onChange={(v, range) => {
                      setTimeRange(v as '5m' | '30m' | '1h' | '6h' | '24h' | 'custom')
                      setCustomRange(range)
                    }}
                    presets={OPS_DASHBOARD_PRESETS}
                    customRange={customRange}
                  />

                  <Select value={queryMode} onValueChange={(v) => setQueryMode(v as OpsQueryMode)}>
                    <SelectTrigger className="h-8 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {queryModes.map((m) => (
                        <SelectItem key={m} value={m}>
                          {t(`admin.ops.queryMode.${m}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleRefresh}
                      >
                        <RefreshIcon
                          className={`h-4 w-4 ${
                            loadingThroughput ||
                            loadingLatency ||
                            loadingErrorTrend ||
                            loadingErrorDist ||
                            loadingSwitchTrend
                              ? 'animate-spin'
                              : ''
                          }`}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('common.refresh', 'Refresh')}</TooltipContent>
                  </Tooltip>

                  <div className="mx-1 hidden h-4 w-[1px] bg-gray-200 dark:bg-dark-700 sm:block" />

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
                        onClick={() => setAlertRulesOpen(true)}
                      >
                        <svg
                          className="size-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                          />
                        </svg>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('admin.ops.alertRules.manage', 'Alert Rules')}</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-dark-700 dark:text-gray-300 dark:hover:bg-dark-600"
                        onClick={() => setSettingsDialogOpen(true)}
                      >
                        <svg
                          className="size-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('common.settings', 'Settings')}</TooltipContent>
                  </Tooltip>
                </div>
              </>
            }
            overview={overview}
            platform={platform}
            groupId={groupId}
            timeRange={timeRange}
            opsEnabled={opsEnabled}
            thresholds={thresholds}
            onOpenRequestDetails={handleOpenRequestDetails}
            onOpenErrorDetails={handleOpenErrorDetails}
          />

          {/* Main chart row: Concurrency + Switch Rate + Throughput (2-wide) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            <div className="lg:col-span-1">
              <OpsConcurrencyCard
                platformFilter={platform}
                groupIdFilter={groupId}
                opsEnabled={opsEnabled}
              />
            </div>

            <div className="lg:col-span-1">
              <ChartCard
                title={t('admin.ops.switchRateTrend', 'Avg Account Switches')}
                help={t(
                  'admin.ops.tooltips.switchRateTrend',
                  'Trend of account switches / total requests over the last 5 hours (avg switches).',
                )}
                actions={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={loadingSwitchTrend}
                    onClick={() => void refetchSwitchTrend()}
                  >
                    <RefreshIcon
                      className={`size-3.5 ${loadingSwitchTrend ? 'animate-spin' : ''}`}
                    />
                  </Button>
                }
              >
                <OpsSwitchRateChart
                  points={switchTrend?.points ?? []}
                  loading={loadingSwitchTrend}
                  emptyText={noData}
                />
              </ChartCard>
            </div>

            <div className="lg:col-span-2">
              <ChartCard
                title={t('admin.ops.throughputTrend', 'Throughput Trend')}
                help={t(
                  'admin.ops.tooltips.throughputTrend',
                  'Requests/QPS + Tokens/TPS in the selected window.',
                )}
                actions={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={loadingThroughput}
                    onClick={() => void refetchThroughput()}
                  >
                    <RefreshIcon
                      className={`size-3.5 ${loadingThroughput ? 'animate-spin' : ''}`}
                    />
                  </Button>
                }
              >
                <OpsThroughputChart
                  points={throughput?.points ?? []}
                  loading={loadingThroughput}
                  timeRange={timeRange}
                  emptyText={noData}
                />
              </ChartCard>
            </div>
          </div>

          {/* Analysis row: Latency + Error Distribution + Error Trend */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <ChartCard
              title={t('admin.ops.latencyHistogram', 'Request Duration Histogram')}
              help={t(
                'admin.ops.tooltips.latencyHistogram',
                'Request duration distribution (ms) for successful requests.',
              )}
              actions={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  disabled={loadingLatency}
                  onClick={() => void refetchLatency()}
                >
                  <RefreshIcon className={`size-3.5 ${loadingLatency ? 'animate-spin' : ''}`} />
                </Button>
              }
            >
              <OpsLatencyHistogramChart
                data={latency ?? null}
                loading={loadingLatency}
                emptyText={noData}
              />
            </ChartCard>

            <ChartCard
              title={t('admin.ops.errorDistribution', 'Error Distribution')}
              help={t('admin.ops.tooltips.errorDistribution', 'Error distribution by status code.')}
              actions={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  disabled={loadingErrorDist}
                  onClick={() => void refetchErrorDist()}
                >
                  <RefreshIcon className={`size-3.5 ${loadingErrorDist ? 'animate-spin' : ''}`} />
                </Button>
              }
            >
              <OpsErrorDistributionChart
                data={errorDist ?? null}
                loading={loadingErrorDist}
                emptyText={noData}
              />
            </ChartCard>

            <ChartCard
              title={t('admin.ops.errorTrend', 'Error Trend')}
              help={t(
                'admin.ops.tooltips.errorTrend',
                'Error counts over time (SLA scope excludes business limits; upstream excludes 429/529).',
              )}
              actions={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  disabled={loadingErrorTrend}
                  onClick={() => void refetchErrorTrend()}
                >
                  <RefreshIcon className={`size-3.5 ${loadingErrorTrend ? 'animate-spin' : ''}`} />
                </Button>
              }
            >
              <OpsErrorTrendChart
                points={errorTrend?.points ?? []}
                loading={loadingErrorTrend}
                timeRange={timeRange}
                emptyText={noData}
              />
            </ChartCard>
          </div>

          {/* Alert Events */}
          <OpsAlertEventsCard />

          {/* Phase 2: System Log Table */}
          <OpsSystemLogTable platformFilter={platform} opsEnabled={opsEnabled} />
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

      {/* Detail Modals */}
      <OpsRequestDetailsModal
        open={requestDetailsOpen}
        onOpenChange={setRequestDetailsOpen}
        timeRange={timeRange}
        preset={requestDetailsPreset}
        platform={platform || undefined}
        groupId={groupId}
        onOpenErrorDetail={(errorId) => {
          setErrorDetailId(errorId)
          setErrorDetailType('request')
          setErrorDetailOpen(true)
        }}
      />
      <OpsErrorDetailsModal
        open={errorDetailsOpen}
        onOpenChange={setErrorDetailsOpen}
        timeRange={timeRange}
        platform={platform || undefined}
        groupId={groupId}
        errorType={errorDetailsType}
        onOpenErrorDetail={handleOpenErrorDetail}
      />
      <OpsErrorDetailModal
        open={errorDetailOpen}
        onOpenChange={setErrorDetailOpen}
        errorId={errorDetailId}
        errorType={errorDetailType}
      />
      <OpsAlertRulesDialog open={alertRulesOpen} onOpenChange={setAlertRulesOpen} />
      <OpsSettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        onSaved={handleSettingsSaved}
      />
    </div>
  )
}
