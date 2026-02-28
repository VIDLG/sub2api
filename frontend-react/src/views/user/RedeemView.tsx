/**
 * Redeem View
 * Allows users to redeem codes for balance/concurrency/subscriptions,
 * shows current balance/concurrency, and redemption history.
 * Mirrors Vue views/user/RedeemView.vue
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { redeemAPI, type RedeemHistoryItem } from '@/api/redeem'
import { DollarIcon, BoltIcon } from '@/components/icons'

// ==================== Helpers ====================

function formatBalance(b: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(b)
}

function formatDate(d: string): string {
  return new Date(d).toLocaleString()
}

function typeIcon(type: string): string {
  switch (type) {
    case 'balance':
      return '$'
    case 'concurrency':
      return '#'
    case 'subscription':
      return 'S'
    case 'invitation':
      return 'I'
    default:
      return '?'
  }
}

function typeColor(type: string): string {
  switch (type) {
    case 'balance':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    case 'concurrency':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'subscription':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    case 'invitation':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
}

function formatValue(type: string, value: number): string {
  switch (type) {
    case 'balance':
      return `+$${formatBalance(value)}`
    case 'concurrency':
      return `+${value}`
    case 'subscription':
      return `${value} days`
    default:
      return String(value)
  }
}

// ==================== Component ====================

export default function RedeemView() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)
  const user = useAuthStore((s) => s.user)
  const refreshUser = useAuthStore((s) => s.refreshUser)

  const [code, setCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [result, setResult] = useState<{ type: string; value: number; message: string } | null>(
    null,
  )
  const [history, setHistory] = useState<RedeemHistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // ==================== Data Loading ====================

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const data = await redeemAPI.getHistory()
      setHistory(data || [])
    } catch {
      // silently fail
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // ==================== Actions ====================

  const handleRedeem = useCallback(async () => {
    if (!code.trim()) {
      showError(t('redeem.codeRequired', 'Please enter a redeem code'))
      return
    }
    setRedeeming(true)
    setResult(null)
    try {
      const res = await redeemAPI.redeem(code.trim())
      setResult({ type: res.type, value: res.value, message: res.message })
      showSuccess(res.message || t('redeem.success', 'Code redeemed successfully'))
      setCode('')
      await refreshUser()
      loadHistory()
    } catch (err) {
      showError(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
          t('redeem.failed', 'Failed to redeem code'),
      )
    } finally {
      setRedeeming(false)
    }
  }, [code, refreshUser, loadHistory, showError, showSuccess, t])

  // ==================== Render ====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {t('redeem.title', 'Redeem Code')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('redeem.description', 'Redeem a code to add balance, concurrency, or subscriptions.')}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
              <DollarIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('redeem.balance', 'Balance')}
              </p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                ${formatBalance(user?.balance || 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
              <BoltIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('redeem.concurrency', 'Concurrency')}
              </p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {user?.concurrency || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Redeem Form */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          {t('redeem.enterCode', 'Enter Redeem Code')}
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRedeem()
            }}
            className="input-field flex-1"
            placeholder={t('redeem.placeholder', 'Paste your redeem code here')}
            disabled={redeeming}
          />
          <button
            onClick={handleRedeem}
            disabled={redeeming || !code.trim()}
            className="btn-primary px-6 py-2.5"
          >
            {redeeming ? (
              <span className="flex items-center gap-2">
                <div className="spinner h-4 w-4" />
                {t('redeem.redeeming', 'Redeeming...')}
              </span>
            ) : (
              t('redeem.submit', 'Redeem')
            )}
          </button>
        </div>

        {/* Result Display */}
        {result && (
          <div className="mt-4 rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${typeColor(result.type)}`}
              >
                {typeIcon(result.type)}
              </div>
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  {result.message}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  {formatValue(result.type, result.value)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <div className="card">
        <div className="border-b border-gray-100 px-6 py-4 dark:border-dark-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('redeem.history', 'Redemption History')}
          </h2>
        </div>
        <div className="p-6">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <div className="spinner" />
            </div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('redeem.noHistory', 'No redemption history yet.')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 p-4 dark:bg-dark-800/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${typeColor(item.type)}`}
                    >
                      {typeIcon(item.type)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {t(
                          `redeem.type_${item.type}`,
                          item.type.charAt(0).toUpperCase() + item.type.slice(1),
                        )}
                        {item.group?.name && (
                          <span className="ml-2 text-xs text-gray-500">({item.group.name})</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(item.used_at || item.created_at)}
                      </p>
                      {item.notes && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">{item.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatValue(item.type, item.value)}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      <code className="rounded bg-gray-100 px-1 dark:bg-dark-700">
                        {item.code.slice(0, 8)}...
                      </code>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
