/**
 * Home View - Public Landing Page
 * Mirrors the Vue HomeView.vue implementation.
 */

import { useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useTheme } from '@/hooks/useTheme'
import { SunIcon, MoonIcon, BookIcon } from '@/components/icons'
import './HomeView.css'

export default function HomeView() {
  const { t } = useTranslation()
  const { isDark, toggleTheme } = useTheme()

  const siteName = useAppStore((s) => s.cachedPublicSettings?.site_name || s.siteName || 'Sub2API')
  const siteLogo = useAppStore((s) => s.cachedPublicSettings?.site_logo || s.siteLogo || '')
  const siteSubtitle = useAppStore(
    (s) => s.cachedPublicSettings?.site_subtitle || 'AI API Gateway Platform',
  )
  const docUrl = useAppStore((s) => s.cachedPublicSettings?.doc_url || s.docUrl || '')
  const homeContent = useAppStore((s) => s.cachedPublicSettings?.home_content || '')
  const publicSettingsLoaded = useAppStore((s) => s.publicSettingsLoaded)
  const fetchPublicSettings = useAppStore((s) => s.fetchPublicSettings)

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const user = useAuthStore((s) => s.user)
  const checkAuth = useAuthStore((s) => s.checkAuth)

  const dashboardPath = isAdmin ? '/admin/dashboard' : '/dashboard'
  const userInitial = user?.email?.charAt(0).toUpperCase() || ''
  const currentYear = new Date().getFullYear()
  const githubUrl = 'https://github.com/Wei-Shaw/sub2api'

  const isHomeContentUrl =
    homeContent.trim().startsWith('http://') || homeContent.trim().startsWith('https://')

  useEffect(() => {
    checkAuth()
    if (!publicSettingsLoaded) {
      fetchPublicSettings()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Custom home content mode
  if (homeContent) {
    if (isHomeContentUrl) {
      return (
        <div className="min-h-screen">
          <iframe src={homeContent.trim()} className="h-screen w-full border-0" allowFullScreen />
        </div>
      )
    }
    return <div className="min-h-screen" dangerouslySetInnerHTML={{ __html: homeContent }} />
  }

  // Default home page
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-gray-50 via-primary-50/30 to-gray-100 dark:from-dark-950 dark:via-dark-900 dark:to-dark-950">
      {/* Background Decorations */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-primary-400/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-primary-500/15 blur-3xl" />
        <div className="absolute left-1/3 top-1/4 h-72 w-72 rounded-full bg-primary-300/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-primary-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(20,184,166,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(20,184,166,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      {/* Header */}
      <header className="relative z-20 px-6 py-4">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center">
            <div className="h-10 w-10 overflow-hidden rounded-xl shadow-md">
              <img
                src={siteLogo || '/logo.png'}
                alt="Logo"
                className="h-full w-full object-contain"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {docUrl && (
              <a
                href={docUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-dark-400 dark:hover:bg-dark-800 dark:hover:text-white"
                title={t('home.viewDocs')}
              >
                <BookIcon className="h-5 w-5" />
              </a>
            )}

            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-dark-400 dark:hover:bg-dark-800 dark:hover:text-white"
              title={isDark ? t('home.switchToLight') : t('home.switchToDark')}
            >
              {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
            </button>

            {isAuthenticated ? (
              <Link
                to={dashboardPath}
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 py-1 pl-1 pr-2.5 transition-colors hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-[10px] font-semibold text-white">
                  {userInitial}
                </span>
                <span className="text-xs font-medium text-white">{t('home.dashboard')}</span>
                <svg
                  className="h-3 w-3 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"
                  />
                </svg>
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                {t('home.login')}
              </Link>
            )}
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 px-6 py-16">
        <div className="mx-auto max-w-6xl">
          {/* Hero Section */}
          <div className="mb-12 flex flex-col items-center justify-between gap-12 lg:flex-row lg:gap-16">
            <div className="flex-1 text-center lg:text-left">
              <h1 className="mb-4 text-4xl font-bold text-gray-900 dark:text-white md:text-5xl lg:text-6xl">
                {siteName}
              </h1>
              <p className="mb-8 text-lg text-gray-600 dark:text-dark-300 md:text-xl">
                {siteSubtitle}
              </p>
              <div>
                <Link
                  to={isAuthenticated ? dashboardPath : '/login'}
                  className="btn btn-primary px-8 py-3 text-base shadow-lg shadow-primary-500/30"
                >
                  {isAuthenticated ? t('home.goToDashboard') : t('home.getStarted')}
                  <svg
                    className="ml-2 h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                    />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Terminal Animation */}
            <div className="flex flex-1 justify-center lg:justify-end">
              <div className="terminal-container">
                <div className="terminal-window">
                  <div className="terminal-header">
                    <div className="terminal-buttons">
                      <span className="btn-close" />
                      <span className="btn-minimize" />
                      <span className="btn-maximize" />
                    </div>
                    <span className="terminal-title">terminal</span>
                  </div>
                  <div className="terminal-body">
                    <div className="code-line line-1">
                      <span className="code-prompt">$</span>
                      <span className="code-cmd">curl</span>
                      <span className="code-flag">-X POST</span>
                      <span className="code-url">/v1/messages</span>
                    </div>
                    <div className="code-line line-2">
                      <span className="code-comment"># Routing to upstream...</span>
                    </div>
                    <div className="code-line line-3">
                      <span className="code-success">200 OK</span>
                      <span className="code-response">{'{ "content": "Hello!" }'}</span>
                    </div>
                    <div className="code-line line-4">
                      <span className="code-prompt">$</span>
                      <span className="cursor" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Tags */}
          <div className="mb-12 flex flex-wrap items-center justify-center gap-4 md:gap-6">
            {['subscriptionToApi', 'stickySession', 'realtimeBilling'].map((tag) => (
              <div
                key={tag}
                className="inline-flex items-center gap-2.5 rounded-full border border-gray-200/50 bg-white/80 px-5 py-2.5 shadow-sm backdrop-blur-sm dark:border-dark-700/50 dark:bg-dark-800/80"
              >
                <svg
                  className="h-4 w-4 text-primary-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm font-medium text-gray-700 dark:text-dark-200">
                  {t(`home.tags.${tag}`)}
                </span>
              </div>
            ))}
          </div>

          {/* Features Grid */}
          <div className="mb-12 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: 'blue',
                title: 'unifiedGateway',
                desc: 'unifiedGatewayDesc',
                iconPath:
                  'M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z',
              },
              {
                icon: 'primary',
                title: 'multiAccount',
                desc: 'multiAccountDesc',
                iconPath:
                  'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z',
              },
              {
                icon: 'purple',
                title: 'balanceQuota',
                desc: 'balanceQuotaDesc',
                iconPath:
                  'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z',
              },
            ].map((feature) => {
              const gradients: Record<string, string> = {
                blue: 'from-blue-500 to-blue-600 shadow-blue-500/30',
                primary: 'from-primary-500 to-primary-600 shadow-primary-500/30',
                purple: 'from-purple-500 to-purple-600 shadow-purple-500/30',
              }
              return (
                <div
                  key={feature.title}
                  className="group rounded-2xl border border-gray-200/50 bg-white/60 p-6 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/10 dark:border-dark-700/50 dark:bg-dark-800/60"
                >
                  <div
                    className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gradients[feature.icon]} shadow-lg transition-transform group-hover:scale-110`}
                  >
                    <svg
                      className="h-6 w-6 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={feature.iconPath} />
                    </svg>
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                    {t(`home.features.${feature.title}`)}
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-600 dark:text-dark-400">
                    {t(`home.features.${feature.desc}`)}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Supported Providers */}
          <div className="mb-8 text-center">
            <h2 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white">
              {t('home.providers.title')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-dark-400">
              {t('home.providers.description')}
            </p>
          </div>

          <div className="mb-16 flex flex-wrap items-center justify-center gap-4">
            {[
              {
                name: t('home.providers.claude'),
                letter: 'C',
                gradient: 'from-orange-400 to-orange-500',
                supported: true,
              },
              {
                name: 'GPT',
                letter: 'G',
                gradient: 'from-green-500 to-green-600',
                supported: true,
              },
              {
                name: t('home.providers.gemini'),
                letter: 'G',
                gradient: 'from-blue-500 to-blue-600',
                supported: true,
              },
              {
                name: t('home.providers.antigravity'),
                letter: 'A',
                gradient: 'from-rose-500 to-pink-600',
                supported: true,
              },
              {
                name: t('home.providers.more'),
                letter: '+',
                gradient: 'from-gray-500 to-gray-600',
                supported: false,
              },
            ].map((provider) => (
              <div
                key={provider.name}
                className={`flex items-center gap-2 rounded-xl px-5 py-3 backdrop-blur-sm ${provider.supported ? 'border border-primary-200 bg-white/60 ring-1 ring-primary-500/20 dark:border-primary-800 dark:bg-dark-800/60' : 'border border-gray-200/50 bg-white/40 opacity-60 dark:border-dark-700/50 dark:bg-dark-800/40'}`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${provider.gradient}`}
                >
                  <span className="text-xs font-bold text-white">{provider.letter}</span>
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-dark-200">
                  {provider.name}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${provider.supported ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-gray-100 text-gray-500 dark:bg-dark-700 dark:text-dark-400'}`}
                >
                  {provider.supported ? t('home.providers.supported') : t('home.providers.soon')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-200/50 px-6 py-8 dark:border-dark-800/50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 text-center sm:flex-row sm:text-left">
          <p className="text-sm text-gray-500 dark:text-dark-400">
            &copy; {currentYear} {siteName}. {t('home.footer.allRightsReserved')}
          </p>
          <div className="flex items-center gap-4">
            {docUrl && (
              <a
                href={docUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-dark-400 dark:hover:text-white"
              >
                {t('home.docs')}
              </a>
            )}
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-dark-400 dark:hover:text-white"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
