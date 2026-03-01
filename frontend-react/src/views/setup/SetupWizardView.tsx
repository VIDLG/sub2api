import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from '@tanstack/react-form'
import * as setupAPI from '@/api/setup'
import type { DatabaseConfig } from '@/api/setup'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function StepIndicator({ currentStep }: { currentStep: number }) {
  const { t } = useTranslation()
  const labels = [
    t('setup.database', 'Database'),
    t('setup.redis', 'Redis'),
    t('setup.admin', 'Admin Account'),
    t('setup.complete', 'Complete'),
  ]

  return (
    <div className="mb-8 flex items-center justify-center">
      {labels.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                i < currentStep
                  ? 'bg-green-500 text-white'
                  : i === currentStep
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-500 dark:bg-dark-700 dark:text-gray-400'
              }`}
            >
              {i < currentStep ? (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">{label}</span>
          </div>
          {i < labels.length - 1 && (
            <div
              className={`mx-2 h-0.5 w-12 ${i < currentStep ? 'bg-green-500' : 'bg-gray-200 dark:bg-dark-700'}`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export default function SetupWizardView() {
  const { t } = useTranslation()
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [testing, setTesting] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [installComplete, setInstallComplete] = useState(false)
  const [waitingRestart, setWaitingRestart] = useState(false)

  const serverPort = parseInt(window.location.port || '3000', 10)

  const dbForm = useForm({
    defaultValues: {
      host: 'localhost',
      port: 5432,
      user: '',
      password: '',
      dbname: '',
      sslmode: 'disable',
    } as DatabaseConfig,
    onSubmit: async ({ value }) => {
      setTesting(true)
      setError('')
      try {
        await setupAPI.testDatabase(value)
        setStep(1)
      } catch (err: unknown) {
        setError(
          (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
            t('setup.dbTestFailed', 'Database connection test failed'),
        )
      } finally {
        setTesting(false)
      }
    },
  })

  const redisForm = useForm({
    defaultValues: { host: 'localhost', port: 6379, password: '', db: 0, enable_tls: false },
    onSubmit: async ({ value }) => {
      setTesting(true)
      setError('')
      try {
        await setupAPI.testRedis(value)
        setStep(2)
      } catch (err: unknown) {
        setError(
          (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
            t('setup.redisTestFailed', 'Redis connection test failed'),
        )
      } finally {
        setTesting(false)
      }
    },
  })

  const adminForm = useForm({
    defaultValues: { email: '', password: '', confirmPassword: '' },
    onSubmit: async ({ value }) => {
      if (value.password.length < 6) {
        setError(t('setup.passwordTooShort', 'Password must be at least 6 characters'))
        return
      }
      if (value.password !== value.confirmPassword) {
        setError(t('setup.passwordMismatch', 'Passwords do not match'))
        return
      }
      setInstalling(true)
      setError('')
      try {
        const res = await setupAPI.install({
          database: dbForm.state.values,
          redis: redisForm.state.values,
          admin: { email: value.email, password: value.password },
          server: { host: '0.0.0.0', port: serverPort, mode: 'release' },
        })
        if (res.restart) {
          setWaitingRestart(true)
          setStep(3)
          let attempts = 0
          const poll = setInterval(async () => {
            attempts++
            try {
              const status = await setupAPI.getSetupStatus()
              if (!status.needs_setup) {
                clearInterval(poll)
                setWaitingRestart(false)
                setInstallComplete(true)
              }
            } catch {
              /* still restarting */
            }
            if (attempts >= 30) {
              clearInterval(poll)
              setWaitingRestart(false)
              setInstallComplete(true)
            }
          }, 2000)
        } else {
          setStep(3)
          setInstallComplete(true)
        }
      } catch (err: unknown) {
        setError(
          (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
            t('setup.installFailed', 'Installation failed'),
        )
      } finally {
        setInstalling(false)
      }
    },
  })

  const { Field: DbForm_Field } = dbForm
  const { Field: RedisForm_Field } = redisForm
  const { Field: AdminForm_Field } = adminForm

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-dark-950">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('setup.title', 'System Setup')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('setup.subtitle', 'Configure your Sub2API instance')}
          </p>
        </div>
        <StepIndicator currentStep={step} />
        <div className="card p-6">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {step === 0 && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                dbForm.handleSubmit()
              }}
              className="space-y-4"
            >
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('setup.databaseConfig', 'Database Configuration')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('setup.databaseDescription', 'Configure your PostgreSQL database connection.')}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <DbForm_Field name="host">
                  {(field) => (
                    <div>
                      <Label>{t('setup.host', 'Host')}</Label>
                      <Input
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="localhost"
                      />
                    </div>
                  )}
                </DbForm_Field>
                <DbForm_Field name="port">
                  {(field) => (
                    <div>
                      <Label>{t('setup.port', 'Port')}</Label>
                      <Input
                        type="number"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(parseInt(e.target.value) || 5432)}
                      />
                    </div>
                  )}
                </DbForm_Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <DbForm_Field name="user">
                  {(field) => (
                    <div>
                      <Label>{t('setup.username', 'Username')}</Label>
                      <Input
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="postgres"
                      />
                    </div>
                  )}
                </DbForm_Field>
                <DbForm_Field name="password">
                  {(field) => (
                    <div>
                      <Label>{t('setup.password', 'Password')}</Label>
                      <Input
                        type="password"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </div>
                  )}
                </DbForm_Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <DbForm_Field name="dbname">
                  {(field) => (
                    <div>
                      <Label>{t('setup.dbName', 'Database Name')}</Label>
                      <Input
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="sub2api"
                      />
                    </div>
                  )}
                </DbForm_Field>
                <DbForm_Field name="sslmode">
                  {(field) => (
                    <div>
                      <Label>{t('setup.sslMode', 'SSL Mode')}</Label>
                      <Select value={field.state.value} onValueChange={field.handleChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectItem value="disable">disable</SelectItem>
                          <SelectItem value="require">require</SelectItem>
                          <SelectItem value="verify-ca">verify-ca</SelectItem>
                          <SelectItem value="verify-full">verify-full</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </DbForm_Field>
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={
                    testing ||
                    !dbForm.state.values.host ||
                    !dbForm.state.values.user ||
                    !dbForm.state.values.dbname
                  }
                >
                  {testing ? (
                    <>
                      <div className="spinner mr-2 h-4 w-4" />
                      {t('setup.testing', 'Testing...')}
                    </>
                  ) : (
                    t('setup.testAndContinue', 'Test & Continue')
                  )}
                </Button>
              </div>
            </form>
          )}

          {step === 1 && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                redisForm.handleSubmit()
              }}
              className="space-y-4"
            >
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('setup.redisConfig', 'Redis Configuration')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t(
                  'setup.redisDescription',
                  'Configure your Redis connection for caching and sessions.',
                )}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <RedisForm_Field name="host">
                  {(field) => (
                    <div>
                      <Label>{t('setup.host', 'Host')}</Label>
                      <Input
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="localhost"
                      />
                    </div>
                  )}
                </RedisForm_Field>
                <RedisForm_Field name="port">
                  {(field) => (
                    <div>
                      <Label>{t('setup.port', 'Port')}</Label>
                      <Input
                        type="number"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(parseInt(e.target.value) || 6379)}
                      />
                    </div>
                  )}
                </RedisForm_Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <RedisForm_Field name="password">
                  {(field) => (
                    <div>
                      <Label>{t('setup.password', 'Password')}</Label>
                      <Input
                        type="password"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder={t('setup.optional', 'Optional')}
                      />
                    </div>
                  )}
                </RedisForm_Field>
                <RedisForm_Field name="db">
                  {(field) => (
                    <div>
                      <Label>{t('setup.redisDb', 'Database')}</Label>
                      <Input
                        type="number"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(parseInt(e.target.value) || 0)}
                        min={0}
                        max={15}
                      />
                    </div>
                  )}
                </RedisForm_Field>
              </div>
              <RedisForm_Field name="enable_tls">
                {(field) => (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={field.state.value}
                      onChange={(e) => field.handleChange(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t('setup.enableTls', 'Enable TLS')}
                    </span>
                  </label>
                )}
              </RedisForm_Field>
              <div className="flex justify-between pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setStep(0)
                    setError('')
                  }}
                >
                  {t('common.back', 'Back')}
                </Button>
                <Button type="submit" disabled={testing || !redisForm.state.values.host}>
                  {testing ? (
                    <>
                      <div className="spinner mr-2 h-4 w-4" />
                      {t('setup.testing', 'Testing...')}
                    </>
                  ) : (
                    t('setup.testAndContinue', 'Test & Continue')
                  )}
                </Button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                adminForm.handleSubmit()
              }}
              className="space-y-4"
            >
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('setup.adminConfig', 'Admin Account')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('setup.adminDescription', 'Create the administrator account.')}
              </p>
              <AdminForm_Field name="email">
                {(field) => (
                  <div>
                    <Label>{t('common.email', 'Email')}</Label>
                    <Input
                      type="email"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="admin@example.com"
                    />
                  </div>
                )}
              </AdminForm_Field>
              <AdminForm_Field name="password">
                {(field) => (
                  <div>
                    <Label>{t('setup.password', 'Password')}</Label>
                    <Input
                      type="password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={t('setup.minPassword', 'At least 6 characters')}
                    />
                  </div>
                )}
              </AdminForm_Field>
              <AdminForm_Field name="confirmPassword">
                {(field) => (
                  <div>
                    <Label>{t('setup.confirmPassword', 'Confirm Password')}</Label>
                    <Input
                      type="password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </div>
                )}
              </AdminForm_Field>
              <div className="flex justify-between pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setStep(1)
                    setError('')
                  }}
                >
                  {t('common.back', 'Back')}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    installing ||
                    !adminForm.state.values.email ||
                    !adminForm.state.values.password ||
                    !adminForm.state.values.confirmPassword
                  }
                >
                  {installing ? (
                    <>
                      <div className="spinner mr-2 h-4 w-4" />
                      {t('setup.installing', 'Installing...')}
                    </>
                  ) : (
                    t('setup.install', 'Install')
                  )}
                </Button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="space-y-4 text-center">
              {waitingRestart ? (
                <>
                  <div className="spinner mx-auto h-12 w-12" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t('setup.restarting', 'Service restarting...')}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t(
                      'setup.restartingDescription',
                      'Please wait while the service restarts with your new configuration.',
                    )}
                  </p>
                </>
              ) : installComplete ? (
                <>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
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
                        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t('setup.setupComplete', 'Setup Complete!')}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t(
                      'setup.setupCompleteDescription',
                      'Your Sub2API instance is ready. You can now log in with your admin account.',
                    )}
                  </p>
                  <Button
                    onClick={() => {
                      window.location.href = '/login'
                    }}
                  >
                    {t('setup.goToLogin', 'Go to Login')}
                  </Button>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
