import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { useSubscriptionStore } from '@/stores/subscriptions'
import { CreditCardIcon } from '@/components/icons'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { UserSubscription } from '@/types'

function isUnlimited(sub: UserSubscription): boolean {
  return (
    !sub.group?.daily_limit_usd && !sub.group?.weekly_limit_usd && !sub.group?.monthly_limit_usd
  )
}

function getMaxUsagePct(sub: UserSubscription): number {
  const pcts: number[] = []
  if (sub.group?.daily_limit_usd)
    pcts.push(((sub.daily_usage_usd || 0) / sub.group.daily_limit_usd) * 100)
  if (sub.group?.weekly_limit_usd)
    pcts.push(((sub.weekly_usage_usd || 0) / sub.group.weekly_limit_usd) * 100)
  if (sub.group?.monthly_limit_usd)
    pcts.push(((sub.monthly_usage_usd || 0) / sub.group.monthly_limit_usd) * 100)
  return pcts.length > 0 ? Math.max(...pcts) : 0
}

function dotClass(sub: UserSubscription): string {
  if (isUnlimited(sub)) return 'bg-emerald-500'
  const pct = getMaxUsagePct(sub)
  if (pct >= 90) return 'bg-red-500'
  if (pct >= 70) return 'bg-orange-500'
  return 'bg-green-500'
}

function barClass(used: number | undefined, limit: number | null | undefined): string {
  if (!limit) return 'bg-gray-400'
  const pct = ((used || 0) / limit) * 100
  if (pct >= 90) return 'bg-red-500'
  if (pct >= 70) return 'bg-orange-500'
  return 'bg-green-500'
}

function barPct(used: number | undefined, limit: number | null | undefined): number {
  if (!limit) return 0
  return Math.min(((used || 0) / limit) * 100, 100)
}

function formatUsage(used: number | undefined, limit: number | null | undefined): string {
  return `$${(used || 0).toFixed(2)}/$${limit?.toFixed(2) || '∞'}`
}

function daysRemainingText(
  expiresAt: string,
  t: (k: string, d: string, o?: object) => string,
): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff < 0) return t('subscriptionProgress.expired', 'Expired')
  const days = Math.ceil(diff / 86400000)
  if (days === 0) return t('subscriptionProgress.expiresToday', 'Expires today')
  if (days === 1) return t('subscriptionProgress.expiresTomorrow', 'Expires tomorrow')
  return t('subscriptionProgress.daysRemaining', '{{days}}d left', { days })
}

function daysRemainingClass(expiresAt: string): string {
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
  if (days <= 3) return 'text-red-600 dark:text-red-400'
  if (days <= 7) return 'text-orange-600 dark:text-orange-400'
  return 'text-gray-500 dark:text-dark-400'
}

export default function SubscriptionProgressMini() {
  const { t } = useTranslation()
  const { activeSubscriptions, hasActiveSubscriptions, fetchActiveSubscriptions } =
    useSubscriptionStore()

  useEffect(() => {
    fetchActiveSubscriptions().catch(() => {})
  }, [fetchActiveSubscriptions])

  if (!hasActiveSubscriptions) return null

  const sorted = [...activeSubscriptions].sort((a, b) => getMaxUsagePct(b) - getMaxUsagePct(a))
  const display = sorted.slice(0, 3)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex cursor-pointer items-center gap-2 rounded-xl bg-purple-50 px-3 py-1.5 transition-colors hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30">
          <CreditCardIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5">
              {display.map((sub, i) => (
                <div key={i} className={`h-2 w-2 rounded-full ${dotClass(sub)}`} />
              ))}
            </div>
            <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
              {activeSubscriptions.length}
            </span>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0 overflow-hidden">
        <div className="border-b border-gray-100 p-3 dark:border-dark-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('subscriptionProgress.title', 'Subscriptions')}
          </h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-dark-400">
            {t('subscriptionProgress.activeCount', '{{count}} active', {
              count: activeSubscriptions.length,
            })}
          </p>
        </div>

        <ScrollArea className="max-h-64">
          {sorted.map((sub) => (
            <div
              key={sub.id}
              className="border-b border-gray-50 p-3 last:border-b-0 dark:border-dark-700/50"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {sub.group?.name || `Group #${sub.group_id}`}
                </span>
                {sub.expires_at && (
                  <span className={`text-xs ${daysRemainingClass(sub.expires_at)}`}>
                    {daysRemainingText(
                      sub.expires_at,
                      t as (k: string, d: string, o?: object) => string,
                    )}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                {isUnlimited(sub) ? (
                  <div className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 px-2.5 py-1.5 dark:from-emerald-900/20 dark:to-teal-900/20">
                    <span className="text-lg text-emerald-600 dark:text-emerald-400">∞</span>
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      {t('subscriptionProgress.unlimited', 'Unlimited')}
                    </span>
                  </div>
                ) : (
                  <>
                    {sub.group?.daily_limit_usd && (
                      <div className="flex items-center gap-2">
                        <span className="w-8 flex-shrink-0 text-[10px] text-gray-500">
                          {t('subscriptionProgress.daily', 'Day')}
                        </span>
                        <Progress
                          value={barPct(sub.daily_usage_usd, sub.group.daily_limit_usd)}
                          className="h-1.5 min-w-0 flex-1 bg-gray-200 dark:bg-dark-600"
                          indicatorClassName={barClass(
                            sub.daily_usage_usd,
                            sub.group.daily_limit_usd,
                          )}
                        />
                        <span className="w-24 flex-shrink-0 text-right text-[10px] text-gray-500">
                          {formatUsage(sub.daily_usage_usd, sub.group.daily_limit_usd)}
                        </span>
                      </div>
                    )}
                    {sub.group?.weekly_limit_usd && (
                      <div className="flex items-center gap-2">
                        <span className="w-8 flex-shrink-0 text-[10px] text-gray-500">
                          {t('subscriptionProgress.weekly', 'Week')}
                        </span>
                        <Progress
                          value={barPct(sub.weekly_usage_usd, sub.group.weekly_limit_usd)}
                          className="h-1.5 min-w-0 flex-1 bg-gray-200 dark:bg-dark-600"
                          indicatorClassName={barClass(
                            sub.weekly_usage_usd,
                            sub.group.weekly_limit_usd,
                          )}
                        />
                        <span className="w-24 flex-shrink-0 text-right text-[10px] text-gray-500">
                          {formatUsage(sub.weekly_usage_usd, sub.group.weekly_limit_usd)}
                        </span>
                      </div>
                    )}
                    {sub.group?.monthly_limit_usd && (
                      <div className="flex items-center gap-2">
                        <span className="w-8 flex-shrink-0 text-[10px] text-gray-500">
                          {t('subscriptionProgress.monthly', 'Month')}
                        </span>
                        <Progress
                          value={barPct(sub.monthly_usage_usd, sub.group.monthly_limit_usd)}
                          className="h-1.5 min-w-0 flex-1 bg-gray-200 dark:bg-dark-600"
                          indicatorClassName={barClass(
                            sub.monthly_usage_usd,
                            sub.group.monthly_limit_usd,
                          )}
                        />
                        <span className="w-24 flex-shrink-0 text-right text-[10px] text-gray-500">
                          {formatUsage(sub.monthly_usage_usd, sub.group.monthly_limit_usd)}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </ScrollArea>

        <div className="border-t border-gray-100 p-2 dark:border-dark-700">
          <Link
            to="/subscriptions"
            className="block w-full py-1 text-center text-xs text-primary-600 hover:underline dark:text-primary-400"
          >
            {t('subscriptionProgress.viewAll', 'View all')}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
