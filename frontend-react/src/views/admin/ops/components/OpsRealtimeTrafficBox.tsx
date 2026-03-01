/**
 * OpsRealtimeTrafficBox
 * Realtime QPS/TPS display with time-window selector and heartbeat animation.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { opsAPI } from '@/api/admin/ops'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { QuestionIcon } from '@/components/icons'
import { parseTimeRangeMinutes } from '../utils/opsFormatters'

type RealtimeWindow = '1min' | '5min' | '30min' | '1h'

const WINDOW_MINUTES: Record<RealtimeWindow, number> = {
  '1min': 1,
  '5min': 5,
  '30min': 30,
  '1h': 60,
}

const ALL_WINDOWS: RealtimeWindow[] = ['1min', '5min', '30min', '1h']

interface Props {
  platform: string
  groupId: number | null
  timeRange: string
  opsEnabled: boolean
}

export function OpsRealtimeTrafficBox({ platform, groupId, timeRange, opsEnabled }: Props) {
  const { t } = useTranslation()
  const [realtimeWindow, setRealtimeWindow] = useState<RealtimeWindow>('1min')

  // Filter available windows by toolbar time range
  const toolbarMinutes = parseTimeRangeMinutes(timeRange)
  const availableWindows = ALL_WINDOWS.filter((w) => WINDOW_MINUTES[w] <= toolbarMinutes)

  // Reset window when time range changes and current window is no longer valid
  useEffect(() => {
    if (!availableWindows.includes(realtimeWindow)) {
      setRealtimeWindow(availableWindows[0] ?? '1min')
    }
  }, [timeRange]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: realtimeData } = useQuery({
    queryKey: ['ops', 'realtimeTraffic', realtimeWindow, platform, groupId],
    queryFn: () =>
      opsAPI.getRealtimeTrafficSummary(realtimeWindow, platform || undefined, groupId ?? undefined),
    enabled: opsEnabled,
    refetchInterval: 5000,
  })

  const summary = realtimeData?.summary
  const qpsCurrent = summary?.qps.current ?? 0
  const tpsCurrent = summary?.tps.current ?? 0
  const qpsPeak = summary?.qps.peak ?? 0
  const tpsPeak = summary?.tps.peak ?? 0
  const qpsAvg = summary?.qps.avg ?? 0
  const tpsAvg = summary?.tps.avg ?? 0

  return (
    <div className="flex h-full flex-col justify-center py-2">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Animated pulse dot */}
          <div className="relative flex size-3 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-blue-500" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            {t('admin.ops.realtime.title', 'Realtime')}
          </h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <QuestionIcon className="size-3 text-gray-400" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {t(
                'admin.ops.tooltips.qps',
                'Real-time queries and tokens per second within the selected window',
              )}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Time window buttons */}
        <div className="flex flex-wrap gap-1">
          {availableWindows.map((w) => (
            <button
              key={w}
              type="button"
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold transition-colors sm:px-2 sm:text-[10px] ${
                realtimeWindow === w
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-dark-700 dark:text-gray-400 dark:hover:bg-dark-600'
              }`}
              onClick={() => setRealtimeWindow(w)}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-3">
        {/* Current */}
        <div>
          <div className="text-[10px] font-bold uppercase text-gray-400">
            {t('admin.ops.current', 'Current')}
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-gray-900 sm:text-2xl dark:text-white">
                {qpsCurrent.toFixed(1)}
              </span>
              <span className="text-xs font-bold text-gray-500">QPS</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-gray-900 sm:text-2xl dark:text-white">
                {tpsCurrent.toFixed(1)}
              </span>
              <span className="text-xs font-bold text-gray-500">{t('admin.ops.tps', 'TPS')}</span>
            </div>
          </div>
        </div>

        {/* Peak / Average */}
        <div className="grid grid-cols-2 gap-3">
          {/* Peak */}
          <div>
            <div className="text-[10px] font-bold uppercase text-gray-400">
              {t('admin.ops.peak', 'Peak')}
            </div>
            <div className="mt-1 space-y-0.5 text-sm font-medium text-gray-600 dark:text-gray-400">
              <div className="flex items-baseline gap-1.5">
                <span className="font-black text-gray-900 dark:text-white">
                  {qpsPeak.toFixed(1)}
                </span>
                <span className="text-xs">QPS</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-black text-gray-900 dark:text-white">
                  {tpsPeak.toFixed(1)}
                </span>
                <span className="text-xs">{t('admin.ops.tps', 'TPS')}</span>
              </div>
            </div>
          </div>

          {/* Average */}
          <div>
            <div className="text-[10px] font-bold uppercase text-gray-400">
              {t('admin.ops.average', 'Average')}
            </div>
            <div className="mt-1 space-y-0.5 text-sm font-medium text-gray-600 dark:text-gray-400">
              <div className="flex items-baseline gap-1.5">
                <span className="font-black text-gray-900 dark:text-white">
                  {qpsAvg.toFixed(1)}
                </span>
                <span className="text-xs">QPS</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-black text-gray-900 dark:text-white">
                  {tpsAvg.toFixed(1)}
                </span>
                <span className="text-xs">{t('admin.ops.tps', 'TPS')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Heartbeat pulse animation */}
        <div className="h-8 w-full overflow-hidden opacity-50">
          <svg className="h-full w-full" viewBox="0 0 280 32" preserveAspectRatio="none">
            <path
              d="M0 16 Q 20 16, 40 16 T 80 16 T 120 10 T 160 22 T 200 16 T 240 16 T 280 16"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            >
              <animate
                attributeName="d"
                dur="2s"
                repeatCount="indefinite"
                values="
                  M0 16 Q 20 16, 40 16 T 80 16 T 120 10 T 160 22 T 200 16 T 240 16 T 280 16;
                  M0 16 Q 20 14, 40 18 T 80 12 T 120 20 T 160 10 T 200 18 T 240 14 T 280 16;
                  M0 16 Q 20 16, 40 16 T 80 16 T 120 10 T 160 22 T 200 16 T 240 16 T 280 16
                "
              />
            </path>
          </svg>
        </div>
      </div>
    </div>
  )
}
