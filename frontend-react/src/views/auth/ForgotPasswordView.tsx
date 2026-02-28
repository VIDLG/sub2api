import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useForm } from '@tanstack/react-form'
import { authAPI } from '@/api/auth'
import AuthLayout from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EnvelopeIcon } from '@/components/icons'

export default function ForgotPasswordView() {
  const { t } = useTranslation()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const form = useForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value }) => {
      if (!value.email.trim()) return
      setError('')
      try {
        await authAPI.forgotPassword({ email: value.email.trim() })
        setSuccess(true)
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
          t('forgotPassword.error', 'Failed to send reset link')
        setError(msg)
      }
    },
  })

  return (
    <AuthLayout
      subtitle={t('forgotPassword.subtitle', 'Reset your password')}
      footer={
        <Link
          to="/login"
          className="text-sm text-primary-600 hover:text-primary-500 dark:text-primary-400"
        >
          {t('forgotPassword.backToLogin', 'Back to Login')}
        </Link>
      }
    >
      {success ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <svg
              className="h-8 w-8 text-green-600 dark:text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
            {t('forgotPassword.emailSent', 'Check your email')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t(
              'forgotPassword.emailSentDescription',
              'We sent a password reset link to your email address.',
            )}
          </p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="space-y-5"
        >
          <p className="text-sm text-muted-foreground">
            {t(
              'forgotPassword.description',
              'Enter your email address and we will send you a link to reset your password.',
            )}
          </p>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <form.Field name="email">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="forgot-email">{t('common.email', 'Email')}</Label>
                <div className="relative">
                  <EnvelopeIcon className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="forgot-email"
                    type="email"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    autoFocus
                    className="pl-11"
                    placeholder={t('forgotPassword.emailPlaceholder', 'Enter your email')}
                  />
                </div>
              </div>
            )}
          </form.Field>

          <Button
            type="submit"
            disabled={form.state.isSubmitting || !form.state.values.email.trim()}
            className="w-full"
          >
            {form.state.isSubmitting ? (
              <>
                <div className="spinner mr-2 h-4 w-4" />
                {t('common.loading', 'Loading...')}
              </>
            ) : (
              t('forgotPassword.submit', 'Send Reset Link')
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
