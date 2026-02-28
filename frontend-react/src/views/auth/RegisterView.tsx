import { useState, useCallback } from 'react'
import { useNavigate, Link, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useForm } from '@tanstack/react-form'
import { useDebounceFn, useMount } from 'ahooks'
import AuthLayout from '@/components/layout/AuthLayout'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { getPublicSettings, validatePromoCode, validateInvitationCode } from '@/api/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { EyeIcon, EyeSlashIcon, EnvelopeIcon, LockClosedIcon, GiftIcon, KeyIcon, CheckIcon } from '@/components/icons'

export default function RegisterView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const searchParams = useRouterState({ select: (s) => new URLSearchParams(s.location.search) })

  const register = useAuthStore((s) => s.register)
  const showSuccess = useAppStore((s) => s.showSuccess)
  const showError = useAppStore((s) => s.showError)

  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [registrationEnabled, setRegistrationEnabled] = useState(true)
  const [emailVerifyEnabled, setEmailVerifyEnabled] = useState(false)
  const [promoCodeEnabled, setPromoCodeEnabled] = useState(true)
  const [invitationCodeEnabled, setInvitationCodeEnabled] = useState(false)
  const [turnstileEnabled, setTurnstileEnabled] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [siteName, setSiteName] = useState('Sub2API')
  const [linuxdoOAuthEnabled, setLinuxdoOAuthEnabled] = useState(false)

  const [promoValidating, setPromoValidating] = useState(false)
  const [promoValidation, setPromoValidation] = useState({ valid: false, invalid: false, bonusAmount: null as number | null, message: '' })
  const [invitationValidating, setInvitationValidating] = useState(false)
  const [invitationValidation, setInvitationValidation] = useState({ valid: false, invalid: false, message: '' })

  const validatePromoCodeImpl = useCallback(async (code: string) => {
    if (!code.trim()) return
    setPromoValidating(true)
    try {
      const result = await validatePromoCode(code)
      if (result.valid) {
        setPromoValidation({ valid: true, invalid: false, bonusAmount: result.bonus_amount || 0, message: '' })
      } else {
        const errorMessage = (() => {
          switch (result.error_code) {
            case 'PROMO_CODE_NOT_FOUND': return t('auth.promoCodeNotFound')
            case 'PROMO_CODE_EXPIRED': return t('auth.promoCodeExpired')
            case 'PROMO_CODE_DISABLED': return t('auth.promoCodeDisabled')
            case 'PROMO_CODE_MAX_USED': return t('auth.promoCodeMaxUsed')
            case 'PROMO_CODE_ALREADY_USED': return t('auth.promoCodeAlreadyUsed')
            default: return t('auth.promoCodeInvalid')
          }
        })()
        setPromoValidation({ valid: false, invalid: true, bonusAmount: null, message: errorMessage })
      }
    } catch {
      setPromoValidation({ valid: false, invalid: true, bonusAmount: null, message: t('auth.promoCodeInvalid') })
    } finally {
      setPromoValidating(false)
    }
  }, [t])

  const { run: validatePromoCodeDebounced } = useDebounceFn(validatePromoCodeImpl, { wait: 500 })

  const validateInvitationCodeImpl = useCallback(async (code: string) => {
    setInvitationValidating(true)
    try {
      const result = await validateInvitationCode(code)
      if (result.valid) setInvitationValidation({ valid: true, invalid: false, message: '' })
      else setInvitationValidation({ valid: false, invalid: true, message: t('auth.invitationCodeInvalid') }) }
    catch { setInvitationValidation({ valid: false, invalid: true, message: t('auth.invitationCodeInvalid') }) }
    finally { setInvitationValidating(false) }
  }, [t])

  const { run: validateInvitationCodeDebounced } = useDebounceFn(validateInvitationCodeImpl, { wait: 500 })

  useMount(() => {
    getPublicSettings()
      .then(async (settings) => {
        setRegistrationEnabled(settings.registration_enabled)
        setEmailVerifyEnabled(settings.email_verify_enabled)
        setPromoCodeEnabled(settings.promo_code_enabled)
        setInvitationCodeEnabled(settings.invitation_code_enabled)
        setTurnstileEnabled(settings.turnstile_enabled)
        setSiteName(settings.site_name || 'Sub2API')
        setLinuxdoOAuthEnabled(settings.linuxdo_oauth_enabled)
        if (settings.promo_code_enabled) {
          const promoParam = searchParams.get('promo')
          if (promoParam) {
            form.setFieldValue('promoCode', promoParam)
            await validatePromoCodeImpl(promoParam)
          }
        }
      })
      .catch((error) => console.error('Failed to load public settings:', error))
      .finally(() => setSettingsLoaded(true))
  })

  function handlePromoCodeInput(value: string) {
    form.setFieldValue('promoCode', value)
    setPromoValidation({ valid: false, invalid: false, bonusAmount: null, message: '' })
    if (!value.trim()) {
      setPromoValidating(false)
      return
    }
    validatePromoCodeDebounced(value.trim())
  }

  function handleInvitationCodeInput(value: string) {
    form.setFieldValue('invitationCode', value)
    setInvitationValidation({ valid: false, invalid: false, message: '' })
    if (!value.trim()) return
    validateInvitationCodeDebounced(value.trim())
  }

  const form = useForm({
    defaultValues: { email: '', password: '', promoCode: '', invitationCode: '' },
    onSubmit: async ({ value }) => {
      setErrorMessage('')
      if (!value.email.trim() || !value.password) return
      if (invitationCodeEnabled && !value.invitationCode.trim()) return
      if (value.promoCode?.trim()) {
        if (promoValidating) { setErrorMessage(t('auth.promoCodeValidating')); return }
        if (promoValidation.invalid) { setErrorMessage(t('auth.promoCodeInvalidCannotRegister')); return }
      }
      if (invitationCodeEnabled) {
        if (invitationValidating) { setErrorMessage(t('auth.invitationCodeValidating')); return }
        if (invitationValidation.invalid) { setErrorMessage(t('auth.invitationCodeInvalidCannotRegister')); return }
      }
      setIsLoading(true)
      try {
        if (emailVerifyEnabled) {
          sessionStorage.setItem('register_data', JSON.stringify({ email: value.email, password: value.password, turnstile_token: turnstileToken, promo_code: value.promoCode || undefined, invitation_code: value.invitationCode || undefined }))
          navigate({ to: '/email-verify' })
          return
        }
        await register({ email: value.email, password: value.password, turnstile_token: turnstileEnabled ? turnstileToken : undefined, promo_code: value.promoCode || undefined, invitation_code: value.invitationCode || undefined })
        showSuccess(t('auth.accountCreatedSuccess', { siteName }))
        navigate({ to: '/dashboard' })
      } catch (error: unknown) {
        setTurnstileToken('')
        const err = error as { message?: string; response?: { data?: { detail?: string } } }
        const msg = err.response?.data?.detail || err.message || t('auth.registrationFailed')
        setErrorMessage(msg)
        showError(msg)
      } finally { setIsLoading(false) }
    },
  })

  const footer = (
    <p className="text-gray-500 dark:text-dark-400">
      {t('auth.alreadyHaveAccount')}{' '}
      <Link to="/login" className="font-medium text-primary-600 transition-colors hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300">{t('auth.signIn')}</Link>
    </p>
  )

  return (
    <AuthLayout footer={footer}>
      <div className="space-y-5">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('auth.createAccount')}</h2>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-dark-400">{t('auth.signUpToStart', { siteName })}</p>
        </div>

        {linuxdoOAuthEnabled && (
          <div className="space-y-4">
            <a href={`/api/v1/auth/oauth/linuxdo/start?redirect=${encodeURIComponent('/dashboard')}`} className={`btn btn-secondary flex w-full items-center justify-center ${isLoading ? 'pointer-events-none opacity-50' : ''}`}>
              <svg className="mr-2 h-5 w-5" viewBox="0 0 36 36" fill="currentColor">
                <path d="M18 0C8.059 0 0 8.059 0 18s8.059 18 18 18 18-8.059 18-18S27.941 0 18 0zm0 33.014c-8.284 0-15.014-6.73-15.014-15.014S9.716 2.986 18 2.986 33.014 9.716 33.014 18 26.284 33.014 18 33.014z" />
                <path d="M18 7.2c-5.965 0-10.8 4.835-10.8 10.8S12.035 28.8 18 28.8 28.8 23.965 28.8 18 23.965 7.2 18 7.2zm0 18.514c-4.261 0-7.714-3.453-7.714-7.714S13.739 10.286 18 10.286 25.714 13.739 25.714 18 22.261 25.714 18 25.714z" />
              </svg>
              {t('auth.loginWithLinuxDo', 'Sign up with LinuxDo')}
            </a>
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-sm text-gray-500 dark:text-dark-400">{t('auth.orContinueWith', 'or continue with')}</span>
              <Separator className="flex-1" />
            </div>
          </div>
        )}

        {!registrationEnabled && settingsLoaded ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-900/20">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
              <p className="text-sm text-amber-700 dark:text-amber-400">{t('auth.registrationDisabled')}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }} className="space-y-4">
            <form.Field name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="reg-email">{t('auth.emailLabel')}</Label>
                  <div className="relative">
                    <EnvelopeIcon className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <Input id="reg-email" type="email" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} autoFocus autoComplete="email" disabled={isLoading} className="pl-11" placeholder={t('auth.emailPlaceholder')} />
                  </div>
                </div>
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="reg-password">{t('auth.passwordLabel')}</Label>
                  <div className="relative">
                    <LockClosedIcon className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <Input id="reg-password" type={showPassword ? 'text' : 'password'} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} autoComplete="new-password" disabled={isLoading} className="pl-11 pr-11" placeholder={t('auth.createPasswordPlaceholder')} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-300">
                      {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('auth.passwordHint')}</p>
                </div>
              )}
            </form.Field>

            {invitationCodeEnabled && (
              <div className="space-y-2">
                <Label htmlFor="invitation_code">{t('auth.invitationCodeLabel')}</Label>
                <div className="relative">
                  <KeyIcon className={`absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 ${invitationValidation.valid ? 'text-green-500' : 'text-gray-400'}`} />
                  <Input id="invitation_code" value={form.state.values.invitationCode} onChange={(e) => handleInvitationCodeInput(e.target.value)} disabled={isLoading} className={`pl-11 pr-10 ${invitationValidation.valid ? 'border-green-500' : invitationValidation.invalid ? 'border-red-500' : ''}`} placeholder={t('auth.invitationCodePlaceholder')} />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    {invitationValidating && <div className="spinner h-4 w-4" />}
                    {!invitationValidating && invitationValidation.valid && <CheckIcon className="h-5 w-5 text-green-500" />}
                    {!invitationValidating && invitationValidation.invalid && <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>}
                  </div>
                </div>
                {invitationValidation.valid && <p className="text-sm text-green-600 dark:text-green-400">{t('auth.invitationCodeValid')}</p>}
                {invitationValidation.invalid && <p className="text-sm text-destructive">{invitationValidation.message}</p>}
              </div>
            )}

            {promoCodeEnabled && (
              <div className="space-y-2">
                <Label htmlFor="promo_code">
                  {t('auth.promoCodeLabel')}
                  <span className="text-xs font-normal text-muted-foreground">({t('common.optional')})</span>
                </Label>
                <div className="relative">
                  <GiftIcon className={`absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 ${promoValidation.valid ? 'text-green-500' : 'text-gray-400'}`} />
                  <Input id="promo_code" value={form.state.values.promoCode} onChange={(e) => handlePromoCodeInput(e.target.value)} disabled={isLoading} className={`pl-11 pr-10 ${promoValidation.valid ? 'border-green-500' : promoValidation.invalid ? 'border-red-500' : ''}`} placeholder={t('auth.promoCodePlaceholder')} />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    {promoValidating && <div className="spinner h-4 w-4" />}
                    {!promoValidating && promoValidation.valid && <CheckIcon className="h-5 w-5 text-green-500" />}
                    {!promoValidating && promoValidation.invalid && <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>}
                  </div>
                </div>
                {promoValidation.valid && (
                  <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                    <GiftIcon className="h-4 w-4" />
                    {t('auth.promoCodeValid', { amount: promoValidation.bonusAmount?.toFixed(2) })}
                  </p>
                )}
                {promoValidation.invalid && <p className="text-sm text-destructive">{promoValidation.message}</p>}
              </div>
            )}

            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800/50 dark:bg-red-900/20">
                <div className="flex items-start gap-3">
                  <svg className="h-5 w-5 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                  <p className="text-sm text-red-700 dark:text-red-400">{errorMessage}</p>
                </div>
              </div>
            )}

            <Button type="submit" disabled={isLoading || (turnstileEnabled && !turnstileToken)} className="w-full">
              {isLoading ? <><div className="spinner mr-2 h-4 w-4" />{t('auth.processing')}</> : emailVerifyEnabled ? t('auth.continue') : t('auth.createAccount')}
            </Button>
          </form>
        )}
      </div>
    </AuthLayout>
  )
}
