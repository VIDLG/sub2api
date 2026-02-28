import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useOnboardingStore } from '@/stores/onboarding'
import {
  MenuIcon,
  UserIcon,
  KeyIcon,
  ChevronDownIcon,
  BookIcon,
  LogoutIcon,
  GitHubIcon,
  ChatIcon,
  QuestionIcon,
  WalletIcon,
} from '@/components/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import AnnouncementBell from '@/components/common/AnnouncementBell'
import LocaleSwitcher from '@/components/common/LocaleSwitcher'
import SubscriptionProgressMini from '@/components/common/SubscriptionProgressMini'

export default function AppHeader() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const toggleMobileSidebar = useAppStore((s) => s.toggleMobileSidebar)
  const contactInfo = useAppStore((s) => s.contactInfo)
  const docUrl = useAppStore((s) => s.docUrl)

  const user = useAuthStore((s) => s.user)
  const isSimpleMode = useAuthStore((s) => s.isSimpleMode)
  const logout = useAuthStore((s) => s.logout)

  const showOnboardingButton = !isSimpleMode && user?.role === 'admin'

  const userInitials = (() => {
    if (!user) return ''
    if (user.username) return user.username.substring(0, 2).toUpperCase()
    if (user.email) return user.email.split('@')[0].substring(0, 2).toUpperCase()
    return ''
  })()

  const displayName = user?.username || user?.email?.split('@')[0] || ''

  const pageTitle = (() => {
    const path = pathname
    const routeTitles: Record<string, { titleKey?: string; title?: string }> = {
      '/dashboard': { titleKey: 'dashboard.title' },
      '/keys': { titleKey: 'keys.title' },
      '/usage': { titleKey: 'usage.title' },
      '/redeem': { titleKey: 'redeem.title' },
      '/profile': { titleKey: 'profile.title' },
      '/subscriptions': { titleKey: 'userSubscriptions.title' },
      '/purchase': { titleKey: 'purchase.title' },
      '/admin/dashboard': { titleKey: 'admin.dashboard.title' },
      '/admin/ops': { titleKey: 'admin.ops.title' },
      '/admin/users': { titleKey: 'admin.users.title' },
      '/admin/groups': { titleKey: 'admin.groups.title' },
      '/admin/subscriptions': { titleKey: 'admin.subscriptions.title' },
      '/admin/accounts': { titleKey: 'admin.accounts.title' },
      '/admin/announcements': { titleKey: 'admin.announcements.title' },
      '/admin/proxies': { titleKey: 'admin.proxies.title' },
      '/admin/redeem': { titleKey: 'admin.redeem.title' },
      '/admin/promo-codes': { titleKey: 'admin.promo.title' },
      '/admin/settings': { titleKey: 'admin.settings.title' },
      '/admin/usage': { titleKey: 'admin.usage.title' },
    }
    const match = routeTitles[path]
    if (match?.titleKey) return t(match.titleKey)
    return match?.title || ''
  })()

  const pageDescription = (() => {
    const path = pathname
    const routeDescriptions: Record<string, string> = {
      '/dashboard': 'dashboard.welcomeMessage',
      '/keys': 'keys.description',
      '/usage': 'usage.description',
      '/redeem': 'redeem.description',
      '/profile': 'profile.description',
      '/subscriptions': 'userSubscriptions.description',
      '/purchase': 'purchase.description',
      '/admin/dashboard': 'admin.dashboard.description',
      '/admin/ops': 'admin.ops.description',
      '/admin/users': 'admin.users.description',
      '/admin/groups': 'admin.groups.description',
      '/admin/subscriptions': 'admin.subscriptions.description',
      '/admin/accounts': 'admin.accounts.description',
      '/admin/announcements': 'admin.announcements.description',
      '/admin/proxies': 'admin.proxies.description',
      '/admin/redeem': 'admin.redeem.description',
      '/admin/promo-codes': 'admin.promo.description',
      '/admin/settings': 'admin.settings.description',
      '/admin/usage': 'admin.usage.description',
    }
    const key = routeDescriptions[path]
    return key ? t(key) : ''
  })()

  async function handleLogout() {
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
    navigate({ to: '/login' })
  }

  function handleReplayGuide() {
    useOnboardingStore.getState().replay()
  }

  return (
    <header className="glass sticky top-0 z-30 border-b border-gray-200/50 dark:border-dark-700/50">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMobileSidebar}
            className="lg:hidden"
            aria-label="Toggle Menu"
          >
            <MenuIcon className="h-5 w-5" />
          </Button>
          <div className="hidden lg:block">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{pageTitle}</h1>
            {pageDescription && (
              <p className="text-xs text-gray-500 dark:text-dark-400">{pageDescription}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user && <AnnouncementBell />}

          {docUrl && (
            <a
              href={docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-dark-400 dark:hover:bg-dark-800 dark:hover:text-white"
            >
              <BookIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t('nav.docs')}</span>
            </a>
          )}

          <LocaleSwitcher />

          {user && <SubscriptionProgressMini />}

          {user && (
            <div className="hidden items-center gap-2 rounded-xl bg-primary-50 px-3 py-1.5 dark:bg-primary-900/20 sm:flex">
              <WalletIcon className="h-4 w-4 text-primary-600 dark:text-primary-400" />
              <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">
                ${user.balance?.toFixed(2) || '0.00'}
              </span>
            </div>
          )}

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 rounded-xl p-1.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-sm font-medium text-white shadow-sm">
                    {userInitials}
                  </div>
                  <div className="hidden text-left md:block">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {displayName}
                    </div>
                    <div className="text-xs capitalize text-gray-500 dark:text-dark-400">
                      {user.role}
                    </div>
                  </div>
                  <ChevronDownIcon className="hidden h-4 w-4 text-gray-400 md:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium">{displayName}</div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                </DropdownMenuLabel>
                <div className="border-b border-gray-100 px-4 py-2 dark:border-dark-700 sm:hidden">
                  <div className="text-xs text-gray-500 dark:text-dark-400">
                    {t('common.balance')}
                  </div>
                  <div className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                    ${user.balance?.toFixed(2) || '0.00'}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4" />
                    {t('nav.profile')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/keys" className="flex items-center gap-2">
                    <KeyIcon className="h-4 w-4" />
                    {t('nav.apiKeys')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a
                    href="https://github.com/Wei-Shaw/sub2api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <GitHubIcon className="h-4 w-4" />
                    {t('nav.github')}
                  </a>
                </DropdownMenuItem>
                {contactInfo && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-500">
                      <ChatIcon className="h-3.5 w-3.5" />
                      <span>
                        {t('common.contactSupport')}:{' '}
                        <span className="font-medium text-gray-700">{contactInfo}</span>
                      </span>
                    </div>
                  </>
                )}
                {showOnboardingButton && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleReplayGuide}
                      className="flex items-center gap-2"
                    >
                      <QuestionIcon className="h-4 w-4" />
                      {t('onboarding.restartTour')}
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-red-600 focus:text-red-600"
                >
                  <LogoutIcon className="h-4 w-4" />
                  {t('nav.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  )
}
