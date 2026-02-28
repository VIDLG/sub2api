/**
 * Authentication Layout
 * Centered card layout for login, register, forgot-password, etc.
 * Mirrors the Vue AuthLayout.vue implementation.
 */

import { useEffect, type ReactNode } from 'react'
import { useAppStore } from '@/stores/app'
import { sanitizeUrl } from '@/utils/url'

interface Props {
  children: ReactNode
  footer?: ReactNode
  subtitle?: string
}

export default function AuthLayout({ children, footer, subtitle }: Props) {
  const siteName = useAppStore((s) => s.siteName) || 'Sub2API'
  const siteLogo = useAppStore((s) => s.siteLogo)
  const cachedPublicSettings = useAppStore((s) => s.cachedPublicSettings)
  const publicSettingsLoaded = useAppStore((s) => s.publicSettingsLoaded)
  const fetchPublicSettings = useAppStore((s) => s.fetchPublicSettings)

  const siteSubtitle =
    cachedPublicSettings?.site_subtitle || 'Subscription to API Conversion Platform'
  const logoSrc = sanitizeUrl(siteLogo || '', { allowRelative: true, allowDataUrl: true })
  const currentYear = new Date().getFullYear()

  useEffect(() => {
    fetchPublicSettings()
  }, [fetchPublicSettings])

  return (
    <div className="relative flex min-h-screen items-start justify-center overflow-x-hidden p-4 py-8 sm:items-center">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-primary-50/30 to-gray-100 dark:from-dark-950 dark:via-dark-900 dark:to-dark-950" />

      {/* Decorative Elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Gradient Orbs */}
        <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-primary-400/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary-500/15 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-300/10 blur-3xl" />

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(20,184,166,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(20,184,166,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      {/* Content Container */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo/Brand */}
        <div className="mb-8 text-center">
          {publicSettingsLoaded && (
            <>
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl shadow-lg shadow-primary-500/30">
                <img
                  src={logoSrc || '/logo.png'}
                  alt="Logo"
                  className="h-full w-full object-contain"
                />
              </div>
              <h1 className="mb-2 bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-3xl font-bold text-transparent">
                {siteName}
              </h1>
              <p className="text-sm text-gray-500 dark:text-dark-400">{siteSubtitle}</p>
            </>
          )}
        </div>

        {/* Card Container */}
        <div className="card-glass rounded-2xl p-8 shadow-glass">
          {subtitle && (
            <p className="mb-4 text-center text-sm text-gray-500 dark:text-dark-400">{subtitle}</p>
          )}
          {children}
        </div>

        {/* Footer Links */}
        {footer && <div className="mt-6 text-center text-sm">{footer}</div>}

        {/* Copyright */}
        <div className="mt-8 text-center text-xs text-gray-400 dark:text-dark-500">
          &copy; {currentYear} {siteName}. All rights reserved.
        </div>
      </div>
    </div>
  )
}
