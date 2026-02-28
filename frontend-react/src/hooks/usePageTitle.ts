import { createContext, useContext, useEffect } from 'react'

// Shared context: child pages push a dynamic title here (null = use route title)
export const PageTitleCtx = createContext<((title: string | null) => void) | null>(null)

/**
 * Override the document title for pages with dynamic content.
 * The route-based title is automatically restored on unmount.
 *
 * @example
 *   usePageTitle(`${record.name} - ${siteName}`)
 */
export function usePageTitle(title: string) {
  const setPageTitle = useContext(PageTitleCtx)
  useEffect(() => {
    setPageTitle?.(title)
    return () => setPageTitle?.(null)
  }, [title, setPageTitle])
}
