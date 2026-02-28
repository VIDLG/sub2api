import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useForm } from '@tanstack/react-form'
import AuthLayout from '@/components/layout/AuthLayout'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { getPublicSettings, isTotp2FARequired } from '@/api/auth'
import type { TotpLoginResponse } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { EyeIcon, EyeSlashIcon, EnvelopeIcon, LockClosedIcon } from '@/components/icons'

export default function LoginView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const searchParams = useRouterState({ select: (s) => new URLSearchParams(s.location.search) })

  const login = useAuthStore((s) => s.login)
  const login2FA = useAuthStore((s) => s.login2FA)
  const showSuccess = useAppStore((s) => s.showSuccess)
  const showError = useAppStore((s) => s.showError)
  const showWarning = useAppStore((s) => s.showWarning)

  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [linuxdoOAuthEnabled, setLinuxdoOAuthEnabled] = useState(false)
  const [passwordResetEnabled, setPasswordResetEnabled] = useState(false)
  const [turnstileEnabled, setTurnstileEnabled] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')

  const [show2FAModal, setShow2FAModal] = useState(false)
  const [totpTempToken, setTotpTempToken] = useState('')
  const [totpUserEmailMasked, setTotpUserEmailMasked] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [totpError, setTotpError] = useState('')
  const [totpVerifying, setTotpVerifying] = useState(false)
  const totpInputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const expiredFlag = sessionStorage.getItem('auth_expired')
    if (expiredFlag) {
      sessionStorage.removeItem('auth_expired')
      const message = t('auth.reloginRequired')
      setErrorMessage(message)
      showWarning(message)
    }
    getPublicSettings()
      .then((settings) => {
        setTurnstileEnabled(settings.turnstile_enabled)
        setLinuxdoOAuthEnabled(settings.linuxdo_oauth_enabled)
        setPasswordResetEnabled(settings.password_reset_enabled)
      })
      .catch((error) => console.error('Failed to load public settings:', error))
  }, [t, showWarning])

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      setErrorMessage('')
      if (!value.email.trim() || !value.password) return
      setIsLoading(true)
      try {
        const response = await login({
          email: value.email,
          password: value.password,
          turnstile_token: turnstileEnabled ? turnstileToken : undefined,
        })
        if (isTotp2FARequired(response)) {
          const totpResponse = response as TotpLoginResponse
          setTotpTempToken(totpResponse.temp_token || '')
          setTotpUserEmailMasked(totpResponse.user_email_masked || '')
          setShow2FAModal(true)
          setIsLoading(false)
          return
        }
        showSuccess(t('auth.loginSuccess'))
        const redirectTo = searchParams.get('redirect') || '/dashboard'
        navigate({ to: redirectTo })
      } catch (error: unknown) {
        setTurnstileToken('')
        const err = error as { message?: string; response?: { data?: { detail?: string } } }
        const msg = err.response?.data?.detail || err.message || t('auth.loginFailed')
        setErrorMessage(msg)
        showError(msg)
      } finally {
        setIsLoading(false)
      }
    },
  })

  function handleTotpInput(index: number, value: string) {
    if (!/^\d*$/.test(value)) return
    const digits = totpCode.split('')
    digits[index] = value.slice(-1)
    const newCode = digits.join('').padEnd(6, '').slice(0, 6)
    setTotpCode(newCode)
    setTotpError('')
    if (value && index < 5) totpInputRefs.current[index + 1]?.focus()
    const trimmed = newCode.replace(/\s/g, '')
    if (trimmed.length === 6) handle2FAVerify(trimmed)
  }

  function handleTotpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !totpCode[index] && index > 0)
      totpInputRefs.current[index - 1]?.focus()
  }

  function handleTotpPaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length > 0) {
      setTotpCode(pasted.padEnd(6, ''))
      if (pasted.length === 6) handle2FAVerify(pasted)
      else totpInputRefs.current[pasted.length]?.focus()
    }
  }

  async function handle2FAVerify(code: string) {
    setTotpVerifying(true)
    try {
      await login2FA(totpTempToken, code)
      setShow2FAModal(false)
      showSuccess(t('auth.loginSuccess'))
      const redirectTo = searchParams.get('redirect') || '/dashboard'
      navigate({ to: redirectTo })
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { data?: { message?: string } } }
      const msg = err.response?.data?.message || err.message || t('profile.totp.loginFailed')
      setTotpError(msg)
      setTotpCode('')
      totpInputRefs.current[0]?.focus()
    } finally {
      setTotpVerifying(false)
    }
  }

  function handle2FACancel() {
    setShow2FAModal(false)
    setTotpTempToken('')
    setTotpUserEmailMasked('')
    setTotpCode('')
    setTotpError('')
  }

  const redirectTo = searchParams.get('redirect') || '/dashboard'
  const footer = (
    <p className="text-gray-500 dark:text-dark-400">
      {t('auth.dontHaveAccount')}{' '}
      <Link
        to="/register"
        className="font-medium text-primary-600 transition-colors hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
      >
        {t('auth.signUp')}
      </Link>
    </p>
  )

  return (
    <>
      <AuthLayout footer={footer}>
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('auth.welcomeBack')}
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-dark-400">
              {t('auth.signInToAccount')}
            </p>
          </div>

          {linuxdoOAuthEnabled && (
            <div className="space-y-4">
              <a
                href={`/api/v1/auth/oauth/linuxdo/start?redirect=${encodeURIComponent(redirectTo)}`}
                className={`btn btn-secondary flex w-full items-center justify-center ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 36 36" fill="currentColor">
                  <path d="M18 0C8.059 0 0 8.059 0 18s8.059 18 18 18 18-8.059 18-18S27.941 0 18 0zm0 33.014c-8.284 0-15.014-6.73-15.014-15.014S9.716 2.986 18 2.986 33.014 9.716 33.014 18 26.284 33.014 18 33.014z" />
                  <path d="M18 7.2c-5.965 0-10.8 4.835-10.8 10.8S12.035 28.8 18 28.8 28.8 23.965 28.8 18 23.965 7.2 18 7.2zm0 18.514c-4.261 0-7.714-3.453-7.714-7.714S13.739 10.286 18 10.286 25.714 13.739 25.714 18 22.261 25.714 18 25.714z" />
                </svg>
                {t('auth.loginWithLinuxDo', 'Login with LinuxDo')}
              </a>
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-sm text-gray-500 dark:text-dark-400">
                  {t('auth.orContinueWith', 'or continue with')}
                </span>
                <Separator className="flex-1" />
              </div>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              form.handleSubmit()
            }}
            className="space-y-5"
          >
            <form.Field name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="email">{t('auth.emailLabel')}</Label>
                  <div className="relative">
                    <EnvelopeIcon className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      autoFocus
                      autoComplete="email"
                      disabled={isLoading}
                      className="pl-11"
                      placeholder={t('auth.emailPlaceholder')}
                    />
                  </div>
                </div>
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="password">{t('auth.passwordLabel')}</Label>
                  <div className="relative">
                    <LockClosedIcon className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      autoComplete="current-password"
                      disabled={isLoading}
                      className="pl-11 pr-11"
                      placeholder={t('auth.passwordPlaceholder')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-300"
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span />
                    {passwordResetEnabled && (
                      <Link
                        to="/forgot-password"
                        className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400"
                      >
                        {t('auth.forgotPassword')}
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </form.Field>

            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800/50 dark:bg-red-900/20">
                <div className="flex items-start gap-3">
                  <svg
                    className="h-5 w-5 flex-shrink-0 text-red-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                    />
                  </svg>
                  <p className="text-sm text-red-700 dark:text-red-400">{errorMessage}</p>
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading || (turnstileEnabled && !turnstileToken)}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <div className="spinner mr-2 h-4 w-4" />
                  {t('auth.signingIn')}
                </>
              ) : (
                t('auth.signIn')
              )}
            </Button>
          </form>
        </div>
      </AuthLayout>

      <Dialog
        open={show2FAModal}
        onOpenChange={(open) => {
          if (!open) handle2FACancel()
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader className="items-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30">
              <LockClosedIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            </div>
            <DialogTitle>{t('profile.totp.verifyTitle', 'Two-Factor Authentication')}</DialogTitle>
            <DialogDescription className="text-center">
              {t('profile.totp.enterCode', 'Enter the 6-digit code from your authenticator app')}
              {totpUserEmailMasked && (
                <span className="mt-1 block text-xs">{totpUserEmailMasked}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center gap-2" onPaste={handleTotpPaste}>
            {Array.from({ length: 6 }).map((_, i) => (
              <input
                key={i}
                ref={(el) => {
                  totpInputRefs.current[i] = el
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={totpCode[i] || ''}
                onChange={(e) => handleTotpInput(i, e.target.value)}
                onKeyDown={(e) => handleTotpKeyDown(i, e)}
                disabled={totpVerifying}
                className="h-12 w-10 rounded-lg border border-gray-300 text-center text-lg font-semibold focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-dark-600 dark:bg-dark-700 dark:text-white"
                autoFocus={i === 0}
              />
            ))}
          </div>
          {totpVerifying && (
            <div className="flex justify-center">
              <div className="spinner" />
            </div>
          )}
          {totpError && <p className="text-center text-sm text-red-500">{totpError}</p>}
          <Button
            variant="outline"
            onClick={handle2FACancel}
            disabled={totpVerifying}
            className="w-full"
          >
            {t('common.cancel', 'Cancel')}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
