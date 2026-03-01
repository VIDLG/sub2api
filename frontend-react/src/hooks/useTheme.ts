/**
 * Theme management hook.
 * Handles dark/light mode toggle with localStorage persistence.
 */

import { useState } from 'react'

function getInitialTheme(): boolean {
  if (typeof window === 'undefined') return false
  const saved = localStorage.getItem('theme')
  if (saved === 'dark') return true
  if (saved === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

// Initialize theme immediately (before React renders)
const initialIsDark = getInitialTheme()
if (initialIsDark) {
  document.documentElement.classList.add('dark')
} else {
  document.documentElement.classList.remove('dark')
}

export function useTheme() {
  const [isDark, setIsDark] = useState(initialIsDark)

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev
      document.documentElement.classList.toggle('dark', next)
      localStorage.setItem('theme', next ? 'dark' : 'light')
      return next
    })
  }

  return { isDark, toggleTheme }
}
