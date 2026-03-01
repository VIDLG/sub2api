import {
  createRouter,
  createRootRoute,
  createRoute,
  lazyRouteComponent,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth'
import AppLayout from '@/components/layout/AppLayout'
import { RootWithTitle } from './title'

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    title?: string
    titleKey?: string
  }
}

// --- Root ---

const rootRoute = createRootRoute({
  component: RootWithTitle,
  notFoundComponent: lazyRouteComponent(() => import('@/views/NotFoundView')),
})

// --- Public routes ---

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/home' })
  },
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/home',
  staticData: { title: 'Home' },
  component: lazyRouteComponent(() => import('@/views/HomeView')),
})

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/setup',
  staticData: { title: 'Setup' },
  component: lazyRouteComponent(() => import('@/views/setup/SetupWizardView')),
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  staticData: { title: 'Login' },
  beforeLoad: () => {
    const { isAuthenticated, isAdmin } = useAuthStore.getState()
    if (isAuthenticated) {
      return { redirect: isAdmin ? '/admin/dashboard' : '/dashboard' }
    }
  },
  component: lazyRouteComponent(() => import('@/views/auth/LoginView')),
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  staticData: { title: 'Register', titleKey: 'auth.createAccount' },
  beforeLoad: () => {
    const { isAuthenticated, isAdmin } = useAuthStore.getState()
    if (isAuthenticated) {
      return { redirect: isAdmin ? '/admin/dashboard' : '/dashboard' }
    }
  },
  component: lazyRouteComponent(() => import('@/views/auth/RegisterView')),
})

const emailVerifyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/email-verify',
  staticData: { title: 'Verify Email' },
  component: lazyRouteComponent(() => import('@/views/auth/EmailVerifyView')),
})

const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/callback',
  staticData: { title: 'OAuth Callback' },
  component: lazyRouteComponent(() => import('@/views/auth/OAuthCallbackView')),
})

const linuxdoCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/linuxdo/callback',
  staticData: { title: 'LinuxDo OAuth Callback' },
  component: lazyRouteComponent(() => import('@/views/auth/LinuxDoCallbackView')),
})

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  staticData: { title: 'Forgot Password', titleKey: 'auth.forgotPasswordTitle' },
  component: lazyRouteComponent(() => import('@/views/auth/ForgotPasswordView')),
})

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  staticData: { title: 'Reset Password' },
  component: lazyRouteComponent(() => import('@/views/auth/ResetPasswordView')),
})

// --- Auth layout (requires login) ---

const authLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth',
  beforeLoad: () => {
    const { isAuthenticated } = useAuthStore.getState()
    if (!isAuthenticated) {
      return { redirect: '/login' }
    }
  },
  component: () => <AppLayout />,
})

const dashboardRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/dashboard',
  staticData: { title: 'Dashboard', titleKey: 'dashboard.title' },
  component: lazyRouteComponent(() => import('@/views/user/DashboardView')),
})

const keysRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/keys',
  staticData: { title: 'API Keys', titleKey: 'keys.title' },
  component: lazyRouteComponent(() => import('@/views/user/KeysView')),
})

const usageRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/usage',
  staticData: { title: 'Usage Records', titleKey: 'usage.title' },
  component: lazyRouteComponent(() => import('@/views/user/UsageView')),
})

const redeemRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/redeem',
  staticData: { title: 'Redeem Code', titleKey: 'redeem.title' },
  component: lazyRouteComponent(() => import('@/views/user/RedeemView')),
})

const profileRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/profile',
  staticData: { title: 'Profile', titleKey: 'profile.title' },
  component: lazyRouteComponent(() => import('@/views/user/ProfileView')),
})

const subscriptionsRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/subscriptions',
  staticData: { title: 'My Subscriptions', titleKey: 'userSubscriptions.title' },
  component: lazyRouteComponent(() => import('@/views/user/SubscriptionsView')),
})

const purchaseRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/purchase',
  staticData: { title: 'Purchase Subscription', titleKey: 'purchase.title' },
  component: lazyRouteComponent(() => import('@/views/user/PurchaseSubscriptionView')),
})

// --- Admin layout (requires admin role) ---

const adminLayoutRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  id: 'admin',
  beforeLoad: () => {
    const { isAdmin } = useAuthStore.getState()
    if (!isAdmin) {
      return { redirect: '/dashboard' }
    }
  },
  component: () => <Outlet />,
})

const adminIndexRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin',
})

const adminDashboardRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/dashboard',
  staticData: { title: 'Admin Dashboard', titleKey: 'admin.dashboard.title' },
  component: lazyRouteComponent(() => import('@/views/admin/DashboardView')),
})

const adminOpsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/ops',
  staticData: { title: 'Ops Monitoring', titleKey: 'admin.ops.title' },
  component: lazyRouteComponent(() => import('@/views/admin/ops/OpsDashboard')),
})

const adminUsersRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/users',
  staticData: { title: 'User Management', titleKey: 'admin.users.title' },
  component: lazyRouteComponent(() => import('@/views/admin/UsersView')),
})

const adminGroupsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/groups',
  staticData: { title: 'Group Management', titleKey: 'admin.groups.title' },
  component: lazyRouteComponent(() => import('@/views/admin/GroupsView')),
})

const adminSubscriptionsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/subscriptions',
  staticData: { title: 'Subscription Management', titleKey: 'admin.subscriptions.title' },
  component: lazyRouteComponent(() => import('@/views/admin/SubscriptionsView')),
})

const adminAccountsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/accounts',
  staticData: { title: 'Account Management', titleKey: 'admin.accounts.title' },
  component: lazyRouteComponent(() => import('@/views/admin/AccountsView')),
})

const adminAnnouncementsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/announcements',
  staticData: { title: 'Announcements', titleKey: 'admin.announcements.title' },
  component: lazyRouteComponent(() => import('@/views/admin/AnnouncementsView')),
})

const adminProxiesRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/proxies',
  staticData: { title: 'Proxy Management', titleKey: 'admin.proxies.title' },
  component: lazyRouteComponent(() => import('@/views/admin/ProxiesView')),
})

const adminRedeemRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/redeem',
  staticData: { title: 'Redeem Code Management', titleKey: 'admin.redeem.title' },
  component: lazyRouteComponent(() => import('@/views/admin/RedeemView')),
})

const adminPromoCodesRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/promo-codes',
  staticData: { title: 'Promo Code Management', titleKey: 'admin.promo.title' },
  component: lazyRouteComponent(() => import('@/views/admin/PromoCodesView')),
})

const adminSettingsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/settings',
  staticData: { title: 'System Settings', titleKey: 'admin.settings.title' },
  component: lazyRouteComponent(() => import('@/views/admin/SettingsView')),
})

const adminUsageRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/usage',
  staticData: { title: 'Usage Records', titleKey: 'admin.usage.title' },
  component: lazyRouteComponent(() => import('@/views/admin/usage/UsageView')),
})

const adminAiAnalyzerRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: '/admin/ai',
  staticData: { title: 'AI Analyzer', titleKey: 'admin.aiAnalyzer.title' },
  component: lazyRouteComponent(() => import('@/views/admin/AiAnalyzerView')),
})

// --- Route tree ---

const routeTree = rootRoute.addChildren([
  indexRoute,
  homeRoute,
  setupRoute,
  loginRoute,
  registerRoute,
  emailVerifyRoute,
  authCallbackRoute,
  linuxdoCallbackRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  authLayoutRoute.addChildren([
    dashboardRoute,
    keysRoute,
    usageRoute,
    redeemRoute,
    profileRoute,
    subscriptionsRoute,
    purchaseRoute,
    adminLayoutRoute.addChildren([
      adminIndexRoute,
      adminDashboardRoute,
      adminOpsRoute,
      adminUsersRoute,
      adminGroupsRoute,
      adminSubscriptionsRoute,
      adminAccountsRoute,
      adminAnnouncementsRoute,
      adminProxiesRoute,
      adminRedeemRoute,
      adminPromoCodesRoute,
      adminSettingsRoute,
      adminUsageRoute,
      adminAiAnalyzerRoute,
    ]),
  ]),
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default router
