import { useState } from 'react'
import { Outlet, useRouterState } from '@tanstack/react-router'
import { useTitle } from 'ahooks'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app'
import { PageTitleCtx } from '@/hooks/usePageTitle'

export function RootWithTitle() {
  const [pageTitle, setPageTitle] = useState<string | null>(null)

  const matches = useRouterState({ select: (s) => s.matches })
  const siteName = useAppStore((s) => s.siteName)
  const { t } = useTranslation() // re-renders on language change

  const lastMatch = matches[matches.length - 1]
  const { title: routeTitle, titleKey } = lastMatch?.staticData ?? {}
  const siteNameNorm = siteName?.trim() || 'Sub2API'

  let resolvedTitle = siteNameNorm
  if (titleKey) {
    const translated = t(titleKey)
    if (translated && translated !== titleKey) {
      resolvedTitle = `${translated} - ${siteNameNorm}`
    } else if (routeTitle) {
      resolvedTitle = `${routeTitle} - ${siteNameNorm}`
    }
  } else if (routeTitle) {
    resolvedTitle = `${routeTitle} - ${siteNameNorm}`
  }

  // Single useTitle call — child pages update pageTitle via context
  useTitle(pageTitle ?? resolvedTitle)

  return (
    <PageTitleCtx.Provider value={setPageTitle}>
      <Outlet />
    </PageTitleCtx.Provider>
  )
}
