/**
 * Version badge component for the sidebar.
 * Shows version number. Admin users get a clickable dropdown with update info.
 */

import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'

interface Props {
  version?: string
}

export default function VersionBadge({ version }: Props) {
  const { t } = useTranslation()
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const {
    versionLoading: loading,
    currentVersion,
    latestVersion,
    hasUpdate,
    fetchVersion,
  } = useAppStore()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const displayVersion = currentVersion || version || ''

  useEffect(() => {
    if (isAdmin) {
      fetchVersion(false)
    }
  }, [isAdmin, fetchVersion])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  if (isAdmin) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors ${
            hasUpdate
              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-dark-800 dark:text-dark-400 dark:hover:bg-dark-700'
          }`}
          title={hasUpdate ? t('version.updateAvailable') : t('version.upToDate')}
        >
          {displayVersion ? (
            <span className="font-medium">v{displayVersion}</span>
          ) : (
            <span className="h-3 w-12 animate-pulse rounded bg-gray-200 font-medium dark:bg-dark-600" />
          )}
          {hasUpdate && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
          )}
        </button>

        {dropdownOpen && (
          <div className="absolute left-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-dark-700 dark:bg-dark-800">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-dark-700">
              <span className="text-sm font-medium text-gray-700 dark:text-dark-300">
                {t('version.currentVersion')}
              </span>
              <button
                onClick={() => fetchVersion(true)}
                disabled={loading}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-dark-700 dark:hover:text-dark-200"
                title={t('version.refresh')}
              >
                <svg
                  className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
                  />
                </svg>
              </button>
            </div>
            <div className="p-4">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="spinner" />
                </div>
              ) : (
                <div className="text-center">
                  <div className="inline-flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {displayVersion ? `v${displayVersion}` : '--'}
                    </span>
                    {!hasUpdate && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                        <svg
                          className="h-3 w-3 text-green-600 dark:text-green-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-dark-400">
                    {hasUpdate
                      ? `${t('version.latestVersion')}: v${latestVersion}`
                      : t('version.upToDate')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Non-admin: simple static text
  if (version) {
    return <span className="text-xs text-gray-500 dark:text-dark-400">v{version}</span>
  }
  return null
}
