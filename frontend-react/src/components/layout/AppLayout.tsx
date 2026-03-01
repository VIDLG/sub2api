/**
 * Main Application Layout
 * Wraps authenticated pages with sidebar + header.
 * Mirrors the Vue AppLayout.vue implementation.
 */

import { Outlet } from '@tanstack/react-router'
import { useAppStore } from '@/stores/app'
import { useOnboardingTour } from '@/hooks/useOnboardingTour'
import AppSidebar from './AppSidebar'
import AppHeader from './AppHeader'

export default function AppLayout() {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)
  useOnboardingTour({ autoStart: true })

  return (
    <div className="relative min-h-screen bg-gray-50 dark:bg-dark-950">
      {/* Background Decoration */}
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient" />

      {/* Additional decorative gradients for depth */}
      <div className="pointer-events-none fixed inset-0 opacity-40 dark:opacity-30">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary-400/10 blur-3xl dark:bg-primary-500/10" />
        <div className="absolute top-1/3 -left-40 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl dark:bg-cyan-500/10" />
        <div className="absolute bottom-20 right-1/4 h-80 w-80 rounded-full bg-indigo-400/10 blur-3xl dark:bg-indigo-500/10" />
      </div>

      {/* Sidebar */}
      <AppSidebar />

      {/* Main Content Area */}
      <div
        className={`relative min-h-screen transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64'
        }`}
      >
        {/* Header */}
        <AppHeader />

        {/* Main Content */}
        <main className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
