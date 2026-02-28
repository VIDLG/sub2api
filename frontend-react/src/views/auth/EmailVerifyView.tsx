/**
 * Email Verify View
 * 6-digit code verification for email during registration.
 * Mirrors Vue auth/EmailVerifyView.vue
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { authAPI } from '@/api/auth'
import AuthLayout from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function EmailVerifyView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const register = useAuthStore((s) => s.register)
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)

  const [code, setCode] = useState<string[]>(Array(6).fill(''))
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const regData = (() => {
    try {
      const raw = sessionStorage.getItem('register_data')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })()

  useEffect(() => {
    if (!regData?.email) {
      setSessionExpired(true)
      return
    }
    sendCode()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const sendCode = useCallback(async () => {
    if (!regData?.email) return
    setResendLoading(true)
    try {
      const res = await authAPI.sendVerifyCode({ email: regData.email })
      setCountdown(res.countdown || 60)
      showSuccess(t('emailVerify.codeSent', 'Verification code sent'))
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
        t('emailVerify.sendError', 'Failed to send verification code')
      showError(msg)
    } finally {
      setResendLoading(false)
    }
  }, [regData?.email, showSuccess, showError, t])

  function handleInput(index: number, value: string) {
    if (!/^\d*$/.test(value)) return
    const digit = value.slice(-1)
    const newCode = [...code]
    newCode[index] = digit
    setCode(newCode)
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
    if (newCode.every((d) => d !== '') && newCode.join('').length === 6) {
      handleVerify(newCode.join(''))
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const newCode = Array(6).fill('')
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i]
    }
    setCode(newCode)
    const focusIdx = Math.min(pasted.length, 5)
    inputRefs.current[focusIdx]?.focus()
    if (pasted.length === 6) {
      handleVerify(pasted)
    }
  }

  async function handleVerify(verifyCode?: string) {
    const codeStr = verifyCode || code.join('')
    if (codeStr.length !== 6 || !regData) return

    setLoading(true)
    setError('')
    try {
      await register({
        ...regData,
        verify_code: codeStr,
      })
      sessionStorage.removeItem('register_data')
      showSuccess(t('emailVerify.success', 'Account created successfully'))
      navigate({ to: '/dashboard' })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
        t('emailVerify.verifyError', 'Verification failed')
      setError(msg)
      setCode(Array(6).fill(''))
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  if (sessionExpired) {
    return (
      <AuthLayout subtitle={t('emailVerify.title', 'Verify Email')}>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <svg
              className="h-8 w-8 text-amber-600 dark:text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
            {t('emailVerify.sessionExpired', 'Session expired')}
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">
            {t(
              'emailVerify.sessionExpiredDescription',
              'Please go back and start the registration again.',
            )}
          </p>
          <Button asChild>
            <Link to="/register">{t('emailVerify.backToRegister', 'Back to Register')}</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      subtitle={t('emailVerify.title', 'Verify Email')}
      footer={
        <Link
          to="/register"
          className="text-sm text-primary-600 hover:text-primary-500 dark:text-primary-400"
        >
          {t('emailVerify.backToRegister', 'Back to Register')}
        </Link>
      }
    >
      <div className="space-y-6">
        <p className="text-center text-sm text-muted-foreground">
          {t('emailVerify.description', 'Enter the 6-digit code sent to')}{' '}
          <strong className="text-gray-900 dark:text-white">{regData?.email}</strong>
        </p>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-center gap-2" onPaste={handlePaste}>
          {code.map((digit, i) => (
            <Input
              key={i}
              ref={(el) => {
                inputRefs.current[i] = el
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleInput(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="h-12 w-12 text-center text-xl font-bold"
              autoFocus={i === 0}
              disabled={loading}
            />
          ))}
        </div>

        <Button
          onClick={() => handleVerify()}
          disabled={loading || code.some((d) => !d)}
          className="w-full"
        >
          {loading ? (
            <>
              <div className="spinner mr-2 h-4 w-4" />
              {t('emailVerify.verifying', 'Verifying...')}
            </>
          ) : (
            t('emailVerify.verify', 'Verify & Create Account')
          )}
        </Button>

        <div className="text-center">
          {countdown > 0 ? (
            <span className="text-sm text-muted-foreground">
              {t('emailVerify.resendIn', 'Resend in')} {countdown}s
            </span>
          ) : (
            <Button variant="link" onClick={sendCode} disabled={resendLoading} className="text-sm">
              {resendLoading
                ? t('common.loading', 'Loading...')
                : t('emailVerify.resend', 'Resend Code')}
            </Button>
          )}
        </div>
      </div>
    </AuthLayout>
  )
}
