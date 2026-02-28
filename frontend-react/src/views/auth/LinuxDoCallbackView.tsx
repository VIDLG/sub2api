/**
 * LinuxDo OAuth Callback View
 * Processes fragment-based OAuth tokens from Linux.do.
 * Mirrors Vue auth/LinuxDoCallbackView.vue
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth'
import { sanitizeUrl } from '@/utils/url'
import { Button } from '@/components/ui/button'

function parseHashParams(): Record<string, string> {
  const hash = window.location.hash.substring(1)
  const params: Record<string, string> = {}
  hash.split('&').forEach((pair) => {
    const [key, value] = pair.split('=')
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(value || '')
  })
  return params
}

export default function LinuxDoCallbackView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setToken = useAuthStore((s) => s.setToken)
  const [error, setError] = useState('')
  const [status, setStatus] = useState(
    t('linuxdoCallback.processing', 'Processing authorization...'),
  )
  const processedRef = useRef(false)

  useEffect(() => {
    if (processedRef.current) return
    processedRef.current = true

    async function processCallback() {
      const params = parseHashParams()
      const accessToken = params.access_token
      const refreshToken = params.refresh_token
      const expiresIn = params.expires_in

      if (!accessToken) {
        setError(t('linuxdoCallback.noToken', 'No access token received'))
        return
      }

      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken)
      }
      if (expiresIn) {
        const expiresAt = Date.now() + parseInt(expiresIn, 10) * 1000
        localStorage.setItem('token_expires_at', String(expiresAt))
      }

      setStatus(t('linuxdoCallback.settingUp', 'Setting up your session...'))

      try {
        await setToken(accessToken)
        const redirect = sessionStorage.getItem('auth_redirect')
        sessionStorage.removeItem('auth_redirect')
        const target = redirect ? sanitizeUrl(redirect) : '/dashboard'
        navigate({ to: target, replace: true })
      } catch (err) {
        console.error('LinuxDo callback error:', err)
        setError(t('linuxdoCallback.error', 'Failed to complete authentication'))
      }
    }

    processCallback()
  }, [navigate, setToken, t])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-dark-950">
      <div className="text-center">
        {error ? (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <svg
                className="h-8 w-8 text-red-600 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <p className="mb-4 text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={() => navigate({ to: '/login' })}>
              {t('linuxdoCallback.backToLogin', 'Back to Login')}
            </Button>
          </>
        ) : (
          <>
            <div className="spinner mx-auto mb-4 h-8 w-8" />
            <p className="text-muted-foreground">{status}</p>
          </>
        )}
      </div>
    </div>
  )
}
