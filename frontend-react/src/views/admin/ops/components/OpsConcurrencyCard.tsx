/**
 * OpsConcurrencyCard
 * Shows real-time account concurrency and availability across platforms/groups.
 */

import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { opsAPI } from '@/api/admin/ops'
import { RefreshIcon, QuestionIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface Props {
  platformFilter: string
  groupIdFilter: number | null
  opsEnabled: boolean
}

function LoadBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-dark-700">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span
        className={cn(
          'w-10 text-right text-xs font-medium',
          pct >= 90
            ? 'text-red-600 dark:text-red-400'
            : pct >= 70
              ? 'text-yellow-600 dark:text-yellow-400'
              : 'text-green-600 dark:text-green-400',
        )}
      >
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}

export function OpsConcurrencyCard({ platformFilter, groupIdFilter, opsEnabled }: Props) {
  const { t } = useTranslation()

  const {
    data: concurrency,
    isLoading: loadingConc,
    isFetching: fetchingConc,
    refetch: refetchConc,
  } = useQuery({
    queryKey: ['ops', 'concurrency', platformFilter, groupIdFilter],
    queryFn: () => opsAPI.getConcurrencyStats(platformFilter || undefined, groupIdFilter),
    enabled: opsEnabled,
    refetchInterval: 15_000,
  })

  const {
    data: availability,
    isLoading: loadingAvail,
    isFetching: fetchingAvail,
    refetch: refetchAvail,
  } = useQuery({
    queryKey: ['ops', 'availability', platformFilter, groupIdFilter],
    queryFn: () => opsAPI.getAccountAvailabilityStats(platformFilter || undefined, groupIdFilter),
    enabled: opsEnabled,
    refetchInterval: 15_000,
  })

  const isFetching = fetchingConc || fetchingAvail
  const handleRefresh = () => {
    void refetchConc()
    void refetchAvail()
  }

  const platformRows = Object.values(concurrency?.platform ?? {})
  const accountRows = Object.values(availability?.account ?? {})

  const availableCount = accountRows.filter((a) => a.is_available).length
  const rateLimitedCount = accountRows.filter((a) => a.is_rate_limited).length
  const overloadedCount = accountRows.filter((a) => a.is_overloaded).length
  const errorCount = accountRows.filter((a) => a.has_error).length

  const isLoading = loadingConc || loadingAvail

  return (
    <div className="card flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('admin.ops.concurrencyCard.title', 'Concurrency')}
          </h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <QuestionIcon className="size-3.5 text-gray-400 dark:text-gray-500" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {t(
                'admin.ops.tooltips.concurrency',
                'Real-time account concurrency and availability across platforms.',
              )}
            </TooltipContent>
          </Tooltip>
        </div>
        <Button variant="ghost" size="icon-xs" disabled={isFetching} onClick={handleRefresh}>
          <RefreshIcon className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="spinner" />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
          {/* Platform concurrency rows */}
          {platformRows.length > 0 && (
            <div className="space-y-2">
              {platformRows.map((p) => (
                <div key={p.platform}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium capitalize text-gray-700 dark:text-gray-300">
                      {p.platform}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {p.current_in_use}/{p.max_capacity}
                      {p.waiting_in_queue > 0 && (
                        <span className="ml-1 rounded bg-yellow-100 px-1 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                          +{p.waiting_in_queue}
                        </span>
                      )}
                    </span>
                  </div>
                  <LoadBar pct={p.load_percentage} />
                </div>
              ))}
            </div>
          )}

          {/* Account availability summary */}
          {accountRows.length > 0 && (
            <div className="border-t border-gray-100 pt-3 dark:border-dark-700">
              <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('admin.ops.concurrencyCard.accountAvailability', 'Account Status')}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {t('admin.ops.concurrencyCard.available', 'Available')} {availableCount}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-yellow-500" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {t('admin.ops.concurrencyCard.rateLimited', 'Rate Lmt')} {rateLimitedCount}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {t('admin.ops.concurrencyCard.overloaded', 'Overloaded')} {overloadedCount}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {t('admin.ops.concurrencyCard.error', 'Error')} {errorCount}
                  </span>
                </div>
              </div>
            </div>
          )}

          {platformRows.length === 0 && accountRows.length === 0 && (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              {t('common.noData', 'No data')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
