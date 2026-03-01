/**
 * Application Sidebar Component
 * Renders navigation menu with admin/user sections, theme toggle, and collapse control.
 * Mirrors the Vue AppSidebar.vue implementation.
 */

import { useEffect, type ComponentType, type SVGProps } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useAdminSettingsStore } from '@/stores/adminSettings'
import { useOnboardingStore } from '@/stores/onboarding'
import { useTheme } from '@/hooks/useTheme'
import { Separator } from '@/components/ui/separator'
import VersionBadge from '@/components/common/VersionBadge'
import {
  DashboardIcon,
  KeyIcon,
  ChartIcon,
  GiftIcon,
  UserIcon,
  UsersIcon,
  FolderIcon,
  CreditCardIcon,
  GlobeIcon,
  ServerIcon,
  BellIcon,
  TicketIcon,
  CogIcon,
  SunIcon,
  MoonIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from '@/components/icons'

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

interface NavItem {
  path: string
  label: string
  icon: IconComponent
  hideInSimpleMode?: boolean
  id?: string
  dataTour?: string
}

export default function AppSidebar() {
  const { t } = useTranslation()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { isDark, toggleTheme } = useTheme()

  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)
  const mobileOpen = useAppStore((s) => s.mobileOpen)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const setMobileOpen = useAppStore((s) => s.setMobileOpen)
  const siteName = useAppStore((s) => s.siteName)
  const siteLogo = useAppStore((s) => s.siteLogo)
  const siteVersion = useAppStore((s) => s.siteVersion)
  const publicSettingsLoaded = useAppStore((s) => s.publicSettingsLoaded)
  const cachedPublicSettings = useAppStore((s) => s.cachedPublicSettings)

  const isAdmin = useAuthStore((s) => s.isAdmin)
  const isSimpleMode = useAuthStore((s) => s.isSimpleMode)

  const opsMonitoringEnabled = useAdminSettingsStore((s) => s.opsMonitoringEnabled)
  const fetchAdminSettings = useAdminSettingsStore((s) => s.fetch)

  // Fetch admin settings when user is admin
  useEffect(() => {
    if (isAdmin) {
      fetchAdminSettings()
    }
  }, [isAdmin, fetchAdminSettings])

  // User navigation items
  const userNavItems = ((): NavItem[] => {
    const items: NavItem[] = [
      { path: '/dashboard', label: t('nav.dashboard'), icon: DashboardIcon },
      { path: '/keys', label: t('nav.apiKeys'), icon: KeyIcon, dataTour: 'sidebar-my-keys' },
      { path: '/usage', label: t('nav.usage'), icon: ChartIcon, hideInSimpleMode: true },
      {
        path: '/subscriptions',
        label: t('nav.mySubscriptions'),
        icon: CreditCardIcon,
        hideInSimpleMode: true,
      },
      ...(cachedPublicSettings?.purchase_subscription_enabled
        ? [
            {
              path: '/purchase',
              label: t('nav.buySubscription'),
              icon: CreditCardIcon,
              hideInSimpleMode: true,
            },
          ]
        : []),
      { path: '/redeem', label: t('nav.redeem'), icon: GiftIcon, hideInSimpleMode: true },
      { path: '/profile', label: t('nav.profile'), icon: UserIcon },
    ]
    return isSimpleMode ? items.filter((item) => !item.hideInSimpleMode) : items
  })()

  // Personal nav items (admin's "My Account" section)
  const personalNavItems = ((): NavItem[] => {
    const items: NavItem[] = [
      { path: '/keys', label: t('nav.apiKeys'), icon: KeyIcon, dataTour: 'sidebar-my-keys' },
      { path: '/usage', label: t('nav.usage'), icon: ChartIcon, hideInSimpleMode: true },
      {
        path: '/subscriptions',
        label: t('nav.mySubscriptions'),
        icon: CreditCardIcon,
        hideInSimpleMode: true,
      },
      ...(cachedPublicSettings?.purchase_subscription_enabled
        ? [
            {
              path: '/purchase',
              label: t('nav.buySubscription'),
              icon: CreditCardIcon,
              hideInSimpleMode: true,
            },
          ]
        : []),
      { path: '/redeem', label: t('nav.redeem'), icon: GiftIcon, hideInSimpleMode: true },
      { path: '/profile', label: t('nav.profile'), icon: UserIcon },
    ]
    return isSimpleMode ? items.filter((item) => !item.hideInSimpleMode) : items
  })()

  // Admin navigation items
  const adminNavItems = ((): NavItem[] => {
    const baseItems: NavItem[] = [
      { path: '/admin/dashboard', label: t('nav.dashboard'), icon: DashboardIcon },
      ...(opsMonitoringEnabled
        ? [{ path: '/admin/ops', label: t('nav.ops'), icon: ChartIcon }]
        : []),
      { path: '/admin/users', label: t('nav.users'), icon: UsersIcon, hideInSimpleMode: true },
      {
        path: '/admin/groups',
        label: t('nav.groups'),
        icon: FolderIcon,
        hideInSimpleMode: true,
        id: 'sidebar-group-manage',
      },
      {
        path: '/admin/subscriptions',
        label: t('nav.subscriptions'),
        icon: CreditCardIcon,
        hideInSimpleMode: true,
      },
      {
        path: '/admin/accounts',
        label: t('nav.accounts'),
        icon: GlobeIcon,
        id: 'sidebar-channel-manage',
      },
      { path: '/admin/announcements', label: t('nav.announcements'), icon: BellIcon },
      { path: '/admin/proxies', label: t('nav.proxies'), icon: ServerIcon },
      {
        path: '/admin/redeem',
        label: t('nav.redeemCodes'),
        icon: TicketIcon,
        hideInSimpleMode: true,
        id: 'sidebar-wallet',
      },
      {
        path: '/admin/promo-codes',
        label: t('nav.promoCodes'),
        icon: GiftIcon,
        hideInSimpleMode: true,
      },
      { path: '/admin/usage', label: t('nav.usage'), icon: ChartIcon },
    ]

    if (isSimpleMode) {
      const filtered = baseItems.filter((item) => !item.hideInSimpleMode)
      filtered.push({ path: '/keys', label: t('nav.apiKeys'), icon: KeyIcon })
      filtered.push({ path: '/admin/settings', label: t('nav.settings'), icon: CogIcon })
      return filtered
    }

    baseItems.push({ path: '/admin/settings', label: t('nav.settings'), icon: CogIcon })
    return baseItems
  })()

  function isActive(path: string): boolean {
    return pathname === path || pathname.startsWith(path + '/')
  }

  function handleMenuItemClick(itemPath: string) {
    if (mobileOpen) {
      setTimeout(() => setMobileOpen(false), 150)
    }

    const pathToSelector: Record<string, string> = {
      '/admin/groups': '#sidebar-group-manage',
      '/admin/accounts': '#sidebar-channel-manage',
      '/keys': '[data-tour="sidebar-my-keys"]',
    }

    const selector = pathToSelector[itemPath]
    if (selector && useOnboardingStore.getState().isCurrentStep(selector)) {
      useOnboardingStore.getState().nextStep(500)
    }
  }

  function renderNavItem(item: NavItem) {
    const Icon = item.icon
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`sidebar-link mb-1 ${isActive(item.path) ? 'sidebar-link-active' : ''}`}
        title={sidebarCollapsed ? item.label : undefined}
        id={item.id}
        data-tour={item.dataTour}
        onClick={() => handleMenuItemClick(item.path)}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        {!sidebarCollapsed && <span>{item.label}</span>}
      </Link>
    )
  }

  return (
    <>
      <aside
        className={`sidebar ${sidebarCollapsed ? 'w-[72px]' : 'w-64'} ${
          !mobileOpen ? '-translate-x-full lg:translate-x-0' : ''
        }`}
      >
        {/* Logo/Brand */}
        <div className="sidebar-header">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl shadow-glow">
            {publicSettingsLoaded && (
              <img
                src={siteLogo || '/logo.png'}
                alt="Logo"
                className="h-full w-full object-contain"
              />
            )}
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col">
              <span className="text-lg font-bold text-gray-900 dark:text-white">{siteName}</span>
              <VersionBadge version={siteVersion} />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav scrollbar-hide">
          {isAdmin ? (
            <>
              {/* Admin Section */}
              <div className="sidebar-section">{adminNavItems.map(renderNavItem)}</div>

              {/* Personal Section for Admin (hidden in simple mode) */}
              {!isSimpleMode && (
                <div className="sidebar-section">
                  {!sidebarCollapsed ? (
                    <div className="sidebar-section-title">{t('nav.myAccount')}</div>
                  ) : (
                    <Separator className="mx-3 my-3" />
                  )}
                  {personalNavItems.map(renderNavItem)}
                </div>
              )}
            </>
          ) : (
            /* Regular User View */
            <div className="sidebar-section">{userNavItems.map(renderNavItem)}</div>
          )}
        </nav>

        {/* Bottom Section */}
        <div className="mt-auto border-t border-gray-100 p-3 dark:border-dark-800">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="sidebar-link mb-2 w-full"
            title={sidebarCollapsed ? (isDark ? t('nav.lightMode') : t('nav.darkMode')) : undefined}
          >
            {isDark ? (
              <SunIcon className="h-5 w-5 flex-shrink-0 text-amber-500" />
            ) : (
              <MoonIcon className="h-5 w-5 flex-shrink-0" />
            )}
            {!sidebarCollapsed && <span>{isDark ? t('nav.lightMode') : t('nav.darkMode')}</span>}
          </button>

          {/* Collapse Button */}
          <button
            onClick={toggleSidebar}
            className="sidebar-link w-full"
            title={sidebarCollapsed ? t('nav.expand') : t('nav.collapse')}
          >
            {!sidebarCollapsed ? (
              <ChevronDoubleLeftIcon className="h-5 w-5 flex-shrink-0" />
            ) : (
              <ChevronDoubleRightIcon className="h-5 w-5 flex-shrink-0" />
            )}
            {!sidebarCollapsed && <span>{t('nav.collapse')}</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  )
}
