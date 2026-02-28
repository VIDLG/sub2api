/**
 * Subscriptions View
 * Displays user's subscriptions as a card grid with status badges,
 * expiration info, and usage limit progress bars.
 * Mirrors Vue views/user/SubscriptionsView.vue
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app'
import subscriptionsAPI from '@/api/subscriptions'
import type { UserSubscription } from '@/types'

// ==================== Helpers ====================

function formatCost(c: number): string {
  if (c >= 1) return c.toFixed(2)
  if (c >= 0.01) return c.toFixed(3)
  return c.toFixed(4)
}

function statusBadge(status: string): { className: string; label: string } {
  switch (status) {
    case 'active':
      return {
        className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        label: 'Active',
      }
    case 'expired':
      return {
        className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        label: 'Expired',
      }
    case 'revoked':
      return {
        className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
        label: 'Revoked',
      }
    default:
      return {
        className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
        label: status,
      }
  }
}

function daysRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  const diff = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86400000))
}

function progressColor(percentage: number): string {
  if (percentage >= 90) return 'bg-red-500'
  if (percentage >= 70) return 'bg-amber-500'
  return 'bg-green-500'
}

function formatDate(d: string | null): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString()
}

// ==================== Component ====================

export default function SubscriptionsView() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)

  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([])
  const [loading, setLoading] = useState(false)

  const loadSubscriptions = useCallback(async () => {
    setLoading(true)
    try {
      const data = await subscriptionsAPI.getMySubscriptions()
      setSubscriptions(data || [])
    } catch {
      showError(t('subscriptions.loadFailed', 'Failed to load subscriptions'))
    } finally {
      setLoading(false)
    }
  }, [showError, t])

  useEffect(() => {
    loadSubscriptions()
  }, [loadSubscriptions])

  // ==================== Render ====================

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('subscriptions.title', 'Subscriptions')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('subscriptions.description', 'View your active subscriptions and usage limits.')}
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {t('subscriptions.title', 'Subscriptions')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('subscriptions.description', 'View your active subscriptions and usage limits.')}
        </p>
      </div>

      {/* Empty State */}
      {subscriptions.length === 0 ? (
        <div className="card py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-dark-800">
            <svg
              className="h-8 w-8 text-gray-400 dark:text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {t('subscriptions.empty', 'You have no subscriptions.')}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {t(
              'subscriptions.emptyHint',
              'Subscriptions can be added via redeem codes or admin assignment.',
            )}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {subscriptions.map((sub) => {
            const badge = statusBadge(sub.status)
            const days = daysRemaining(sub.expires_at)
            const group = sub.group

            // Calculate usage percentages
            const dailyLimit = group?.daily_limit_usd
            const weeklyLimit = group?.weekly_limit_usd
            const monthlyLimit = group?.monthly_limit_usd
            const dailyPercent = dailyLimit
              ? Math.min(100, (sub.daily_usage_usd / dailyLimit) * 100)
              : 0
            const weeklyPercent = weeklyLimit
              ? Math.min(100, (sub.weekly_usage_usd / weeklyLimit) * 100)
              : 0
            const monthlyPercent = monthlyLimit
              ? Math.min(100, (sub.monthly_usage_usd / monthlyLimit) * 100)
              : 0

            return (
              <div key={sub.id} className="card overflow-hidden">
                {/* Card Header */}
                <div className="border-b border-gray-100 px-5 py-4 dark:border-dark-700">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      {group?.name || `#${sub.group_id}`}
                    </h3>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                    >
                      {t(`subscriptions.status_${sub.status}`, badge.label)}
                    </span>
                  </div>
                  {group?.description && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {group.description}
                    </p>
                  )}
                </div>

                {/* Card Body */}
                <div className="space-y-4 p-5">
                  {/* Expiration */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      {t('subscriptions.expires', 'Expires')}
                    </span>
                    <div className="text-right">
                      {sub.expires_at ? (
                        <>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {formatDate(sub.expires_at)}
                          </span>
                          {days !== null && (
                            <span
                              className={`ml-2 text-xs ${days <= 3 ? 'text-red-600 dark:text-red-400' : days <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}
                            >
                              ({days} {t('subscriptions.daysLeft', 'days left')})
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {t('subscriptions.neverExpires', 'Never')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Usage Progress Bars */}
                  {dailyLimit != null && dailyLimit > 0 && (
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">
                          {t('subscriptions.daily', 'Daily')}
                        </span>
                        <span className="text-gray-600 dark:text-gray-300">
                          ${formatCost(sub.daily_usage_usd)} / ${formatCost(dailyLimit)}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-dark-700">
                        <div
                          className={`h-full rounded-full transition-all ${progressColor(dailyPercent)}`}
                          style={{ width: `${dailyPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {weeklyLimit != null && weeklyLimit > 0 && (
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">
                          {t('subscriptions.weekly', 'Weekly')}
                        </span>
                        <span className="text-gray-600 dark:text-gray-300">
                          ${formatCost(sub.weekly_usage_usd)} / ${formatCost(weeklyLimit)}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-dark-700">
                        <div
                          className={`h-full rounded-full transition-all ${progressColor(weeklyPercent)}`}
                          style={{ width: `${weeklyPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {monthlyLimit != null && monthlyLimit > 0 && (
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">
                          {t('subscriptions.monthly', 'Monthly')}
                        </span>
                        <span className="text-gray-600 dark:text-gray-300">
                          ${formatCost(sub.monthly_usage_usd)} / ${formatCost(monthlyLimit)}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-dark-700">
                        <div
                          className={`h-full rounded-full transition-all ${progressColor(monthlyPercent)}`}
                          style={{ width: `${monthlyPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* No limits info */}
                  {!dailyLimit && !weeklyLimit && !monthlyLimit && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {t('subscriptions.noLimits', 'No usage limits configured for this group.')}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
