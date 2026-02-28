/**
 * Purchase Subscription View
 * Embeds an external subscription purchase page via iframe
 * when the feature is enabled in public settings.
 * Mirrors Vue views/user/PurchaseSubscriptionView.vue
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app'
import { LinkIcon } from '@/components/icons'

export default function PurchaseSubscriptionView() {
  const { t } = useTranslation()
  const fetchPublicSettings = useAppStore((s) => s.fetchPublicSettings)
  const cachedPublicSettings = useAppStore((s) => s.cachedPublicSettings)

  const [loading, setLoading] = useState(true)
  const [iframeLoading, setIframeLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [url, setUrl] = useState('')

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const settings = cachedPublicSettings || (await fetchPublicSettings())
      if (settings) {
        setEnabled(settings.purchase_subscription_enabled)
        setUrl(settings.purchase_subscription_url || '')
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [cachedPublicSettings, fetchPublicSettings])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const isValidUrl = url.startsWith('http://') || url.startsWith('https://')

  // ==================== Render ====================

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('purchase.title', 'Purchase Subscription')}
          </h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
        </div>
      </div>
    )
  }

  if (!enabled) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('purchase.title', 'Purchase Subscription')}
          </h1>
        </div>
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
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {t('purchase.notEnabled', 'Subscription purchasing is not enabled.')}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {t('purchase.contactAdmin', 'Please contact the administrator for more information.')}
          </p>
        </div>
      </div>
    )
  }

  if (!isValidUrl) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('purchase.title', 'Purchase Subscription')}
          </h1>
        </div>
        <div className="card py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <svg
              className="h-8 w-8 text-amber-500 dark:text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {t('purchase.noUrl', 'Purchase URL has not been configured.')}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {t('purchase.contactAdmin', 'Please contact the administrator for more information.')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('purchase.title', 'Purchase Subscription')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('purchase.description', 'Browse and purchase available subscription plans.')}
          </p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost flex items-center gap-2 px-3 py-2 text-sm"
        >
          <LinkIcon className="h-4 w-4" />
          {t('purchase.openInNewTab', 'Open in new tab')}
        </a>
      </div>

      {/* Iframe Container */}
      <div className="card relative overflow-hidden" style={{ minHeight: '600px' }}>
        {iframeLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 dark:bg-dark-900/80">
            <div className="flex flex-col items-center gap-3">
              <div className="spinner h-8 w-8" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('purchase.loading', 'Loading purchase page...')}
              </p>
            </div>
          </div>
        )}
        <iframe
          src={url}
          className="h-full w-full border-0"
          style={{ minHeight: '600px' }}
          title={t('purchase.title', 'Purchase Subscription')}
          onLoad={() => setIframeLoading(false)}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  )
}
