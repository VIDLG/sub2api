/**
 * Admin System Settings View
 * Card-based layout with multiple configuration sections:
 * Admin API Key, Registration, Defaults, Site, SMTP, Turnstile, Purchase, Stream Timeout.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type {
  SystemSettings,
  StreamTimeoutSettings,
  AdminApiKeyStatus,
  UpdateSettingsRequest,
} from '@/api/admin/settings'
import { extractErrorMessage } from '@/hooks/useDataTableQuery'
import { CheckIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

// ==================== Section Card ====================

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="card">
      <div className="border-b border-gray-100 px-6 py-4 dark:border-dark-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>
      <div className="space-y-5 p-6">{children}</div>
    </div>
  )
}

// ==================== Component ====================

export default function SettingsView() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)

  // Settings state
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Admin API Key
  const [apiKeyStatus, setApiKeyStatus] = useState<AdminApiKeyStatus | null>(null)
  const [newApiKey, setNewApiKey] = useState<string | null>(null)
  const [apiKeyLoading, setApiKeyLoading] = useState(false)

  // Stream timeout
  const [streamTimeout, setStreamTimeout] = useState<StreamTimeoutSettings | null>(null)

  // SMTP password (separate from settings since settings returns configured flag)
  const [smtpPassword, setSmtpPassword] = useState('')

  // Turnstile secret
  const [turnstileSecretKey, setTurnstileSecretKey] = useState('')

  // Site logo upload
  const [logoError, setLogoError] = useState('')

  // ==================== Data Loading ====================

  const loadSettings = async () => {
    setLoading(true)
    try {
      const [settingsData, keyData, stData] = await Promise.all([
        adminAPI.settings.getSettings(),
        adminAPI.settings.getAdminApiKey(),
        adminAPI.settings.getStreamTimeoutSettings(),
      ])
      setSettings(settingsData)
      setApiKeyStatus(keyData)
      setStreamTimeout(stData)
    } catch (err: unknown) {
      showError(
        extractErrorMessage(
          err as Error,
          t('admin.settings.failedToLoad', 'Failed to load settings'),
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== Settings Update ====================

  const updateField = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const req: UpdateSettingsRequest = {
        registration_enabled: settings.registration_enabled,
        email_verify_enabled: settings.email_verify_enabled,
        promo_code_enabled: settings.promo_code_enabled,
        password_reset_enabled: settings.password_reset_enabled,
        invitation_code_enabled: settings.invitation_code_enabled,
        default_balance: settings.default_balance,
        default_concurrency: settings.default_concurrency,
        site_name: settings.site_name,
        site_subtitle: settings.site_subtitle,
        api_base_url: settings.api_base_url,
        contact_info: settings.contact_info,
        doc_url: settings.doc_url,
        home_content: settings.home_content,
        purchase_subscription_enabled: settings.purchase_subscription_enabled,
        purchase_subscription_url: settings.purchase_subscription_url,
        smtp_host: settings.smtp_host,
        smtp_port: settings.smtp_port,
        smtp_username: settings.smtp_username,
        smtp_from_email: settings.smtp_from_email,
        smtp_from_name: settings.smtp_from_name,
        smtp_use_tls: settings.smtp_use_tls,
        turnstile_enabled: settings.turnstile_enabled,
        turnstile_site_key: settings.turnstile_site_key,
        onboarding_enabled: settings.onboarding_enabled,
      }
      // Include secrets only if user entered them
      if (smtpPassword) req.smtp_password = smtpPassword
      if (turnstileSecretKey) req.turnstile_secret_key = turnstileSecretKey

      const updated = await adminAPI.settings.updateSettings(req)
      setSettings(updated)
      setSmtpPassword('')
      setTurnstileSecretKey('')
      showSuccess(t('admin.settings.settingsSaved', 'Settings saved successfully'))
    } catch (err: unknown) {
      showError(
        extractErrorMessage(
          err as Error,
          t('admin.settings.failedToSave', 'Failed to save settings'),
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  // ==================== Admin API Key ====================

  const handleRegenerateApiKey = async () => {
    setApiKeyLoading(true)
    try {
      const result = await adminAPI.settings.regenerateAdminApiKey()
      setNewApiKey(result.key)
      const keyData = await adminAPI.settings.getAdminApiKey()
      setApiKeyStatus(keyData)
      showSuccess(t('admin.settings.adminApiKey.keyGenerated', 'New admin API key generated'))
    } catch (err: unknown) {
      showError(extractErrorMessage(err as Error, 'Failed to regenerate API key'))
    } finally {
      setApiKeyLoading(false)
    }
  }

  const handleDeleteApiKey = async () => {
    setApiKeyLoading(true)
    try {
      await adminAPI.settings.deleteAdminApiKey()
      setApiKeyStatus({ exists: false, masked_key: '' })
      setNewApiKey(null)
      showSuccess(t('admin.settings.adminApiKey.keyDeleted', 'Admin API key deleted'))
    } catch (err: unknown) {
      showError(extractErrorMessage(err as Error, 'Failed to delete API key'))
    } finally {
      setApiKeyLoading(false)
    }
  }

  const copyApiKey = async () => {
    if (newApiKey) {
      await navigator.clipboard.writeText(newApiKey)
      showSuccess(t('common.copied', 'Copied to clipboard'))
    }
  }

  // ==================== Logo Upload ====================

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setLogoError('')

    if (!file) return

    // Check file size (300KB = 307200 bytes)
    const maxSize = 300 * 1024
    if (file.size > maxSize) {
      setLogoError(
        t('admin.settings.site.logoSizeError', {
          defaultValue: `File size {{size}}KB exceeds 300KB limit`,
          size: (file.size / 1024).toFixed(1),
        }),
      )
      event.target.value = ''
      return
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      setLogoError(t('admin.settings.site.logoTypeError', 'Please upload an image file'))
      event.target.value = ''
      return
    }

    // Convert to base64
    const reader = new FileReader()
    reader.onload = (e) => {
      if (settings && e.target?.result) {
        updateField('site_logo', e.target.result as string)
      }
    }
    reader.onerror = () => {
      setLogoError(t('admin.settings.site.logoReadError', 'Failed to read image file'))
    }
    reader.readAsDataURL(file)

    // Reset input
    event.target.value = ''
  }

  const handleRemoveLogo = () => {
    if (settings) {
      updateField('site_logo', '')
      setLogoError('')
    }
  }

  // ==================== Stream Timeout ====================

  const handleSaveStreamTimeout = async () => {
    if (!streamTimeout) return
    try {
      const updated = await adminAPI.settings.updateStreamTimeoutSettings(streamTimeout)
      setStreamTimeout(updated)
      showSuccess(t('admin.settings.streamTimeout.saved', 'Stream timeout settings saved'))
    } catch (err: unknown) {
      showError(
        extractErrorMessage(
          err as Error,
          t('admin.settings.streamTimeout.saveFailed', 'Failed to save stream timeout settings'),
        ),
      )
    }
  }

  // ==================== Render ====================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner" />
      </div>
    )
  }

  if (!settings) return null

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Admin API Key */}
      <SectionCard
        title={t('admin.settings.adminApiKey.title', 'Admin API Key')}
        description={t(
          'admin.settings.adminApiKey.description',
          'Global API key for external system integration with full admin access',
        )}
      >
        {/* Security Warning */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex items-start">
            <svg
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="ml-3 text-sm text-amber-700 dark:text-amber-300">
              {t(
                'admin.settings.adminApiKey.securityWarning',
                'This API key grants full admin access. Store it securely and rotate regularly.',
              )}
            </p>
          </div>
        </div>

        {/* Loading State */}
        {apiKeyLoading ? (
          <div className="flex items-center gap-2 text-gray-500">
            <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary-600" />
            {t('common.loading', 'Loading...')}
          </div>
        ) : apiKeyStatus?.exists ? (
          /* Key Exists */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('admin.settings.adminApiKey.currentKey', 'Current Key')}
                </label>
                <code className="rounded bg-gray-100 px-2 py-1 font-mono text-sm text-gray-900 dark:bg-dark-700 dark:text-gray-100">
                  {apiKeyStatus.masked_key}
                </code>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRegenerateApiKey}
                  disabled={apiKeyLoading}
                >
                  {apiKeyLoading
                    ? t('admin.settings.adminApiKey.regenerating', 'Regenerating...')
                    : t('admin.settings.adminApiKey.regenerate', 'Regenerate')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDeleteApiKey}
                  disabled={apiKeyLoading}
                  className="text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  {t('admin.settings.adminApiKey.delete', 'Delete')}
                </Button>
              </div>
            </div>

            {/* Newly Generated Key Display */}
            {newApiKey && (
              <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <p className="text-sm font-medium text-green-700 dark:text-green-300">
                  {t(
                    'admin.settings.adminApiKey.keyWarning',
                    'This key will only be shown once. Please copy it now.',
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 select-all break-all rounded border border-green-300 bg-white px-3 py-2 font-mono text-sm dark:border-green-700 dark:bg-dark-800">
                    {newApiKey}
                  </code>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={copyApiKey}
                    className="flex-shrink-0"
                  >
                    {t('admin.settings.adminApiKey.copyKey', 'Copy Key')}
                  </Button>
                </div>
                <p className="text-xs text-green-600 dark:text-green-400">
                  {t(
                    'admin.settings.adminApiKey.usage',
                    'Use this key in the Authorization header: Bearer YOUR_KEY',
                  )}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* No Key Configured */
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">
              {t('admin.settings.adminApiKey.notConfigured', 'Admin API key not configured')}
            </span>
            <Button size="sm" onClick={handleRegenerateApiKey} disabled={apiKeyLoading}>
              {apiKeyLoading ? (
                <>
                  <svg className="mr-1 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  {t('admin.settings.adminApiKey.creating', 'Creating...')}
                </>
              ) : (
                t('admin.settings.adminApiKey.create', 'Create Key')
              )}
            </Button>
          </div>
        )}
      </SectionCard>

      {/* Registration */}
      <SectionCard
        title={t('admin.settings.registration.title', 'Registration Settings')}
        description={t(
          'admin.settings.registration.description',
          'Control user registration and verification',
        )}
      >
        {/* Enable Registration */}
        <div className="flex items-center justify-between">
          <div>
            <label className="font-medium text-gray-900 dark:text-white">
              {t('admin.settings.registration.enableRegistration', 'Registration Enabled')}
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t(
                'admin.settings.registration.enableRegistrationHint',
                'Allow new users to register accounts',
              )}
            </p>
          </div>
          <Switch
            checked={settings.registration_enabled}
            onCheckedChange={(v) => updateField('registration_enabled', v)}
          />
        </div>

        {/* Email Verification */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-dark-700">
          <div>
            <label className="font-medium text-gray-900 dark:text-white">
              {t('admin.settings.registration.emailVerification', 'Email Verification')}
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t(
                'admin.settings.registration.emailVerificationHint',
                'Require email verification during registration',
              )}
            </p>
          </div>
          <Switch
            checked={settings.email_verify_enabled}
            onCheckedChange={(v) => updateField('email_verify_enabled', v)}
          />
        </div>

        {/* Promo Code */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-dark-700">
          <div>
            <label className="font-medium text-gray-900 dark:text-white">
              {t('admin.settings.registration.promoCode', 'Promo Code')}
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t(
                'admin.settings.registration.promoCodeHint',
                'Allow users to use promo codes during registration',
              )}
            </p>
          </div>
          <Switch
            checked={settings.promo_code_enabled}
            onCheckedChange={(v) => updateField('promo_code_enabled', v)}
          />
        </div>

        {/* Invitation Code */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-dark-700">
          <div>
            <label className="font-medium text-gray-900 dark:text-white">
              {t('admin.settings.registration.invitationCode', 'Invitation Code Registration')}
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t(
                'admin.settings.registration.invitationCodeHint',
                'Require invitation code for registration',
              )}
            </p>
          </div>
          <Switch
            checked={settings.invitation_code_enabled}
            onCheckedChange={(v) => updateField('invitation_code_enabled', v)}
          />
        </div>

        {/* Password Reset - Only show when email verification is enabled */}
        {settings.email_verify_enabled && (
          <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-dark-700">
            <div>
              <label className="font-medium text-gray-900 dark:text-white">
                {t('admin.settings.registration.passwordReset', 'Password Reset')}
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t(
                  'admin.settings.registration.passwordResetHint',
                  'Allow users to reset password via email',
                )}
              </p>
            </div>
            <Switch
              checked={settings.password_reset_enabled}
              onCheckedChange={(v) => updateField('password_reset_enabled', v)}
            />
          </div>
        )}

        {/* Onboarding Tour */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-dark-700">
          <div>
            <label className="font-medium text-gray-900 dark:text-white">
              {t('admin.settings.registration.onboardingTour', 'Onboarding Tour')}
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t(
                'admin.settings.registration.onboardingTourHint',
                'Show onboarding tour for new users',
              )}
            </p>
          </div>
          <Switch
            checked={settings.onboarding_enabled}
            onCheckedChange={(v) => updateField('onboarding_enabled', v)}
          />
        </div>
      </SectionCard>

      {/* Default Settings */}
      <SectionCard
        title={t('admin.settings.defaults.title', 'Default User Settings')}
        description={t('admin.settings.defaults.description', 'Default values for new users')}
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('admin.settings.defaults.defaultBalance', 'Default Balance')}
            </label>
            <input
              type="number"
              className="input"
              value={settings.default_balance}
              onChange={(e) => updateField('default_balance', parseFloat(e.target.value) || 10)}
              step="0.01"
              min="0"
              placeholder="10.00"
            />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {t('admin.settings.defaults.defaultBalanceHint', 'Initial balance for new users')}
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('admin.settings.defaults.defaultConcurrency', 'Default Concurrency')}
            </label>
            <input
              type="number"
              className="input"
              value={settings.default_concurrency}
              onChange={(e) => updateField('default_concurrency', parseInt(e.target.value) || 1)}
              min={1}
              placeholder="1"
            />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {t(
                'admin.settings.defaults.defaultConcurrencyHint',
                'Maximum concurrent requests for new users',
              )}
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Site Settings */}
      <SectionCard
        title={t('admin.settings.site.title', 'Site Settings')}
        description={t('admin.settings.site.description', 'Customize site branding')}
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('admin.settings.site.siteName', 'Site Name')}
            </label>
            <input
              type="text"
              className="input"
              value={settings.site_name}
              onChange={(e) => updateField('site_name', e.target.value)}
              placeholder={t('admin.settings.site.siteNamePlaceholder', 'My Site')}
            />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {t('admin.settings.site.siteNameHint', 'Site name shown in title and branding')}
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('admin.settings.site.siteSubtitle', 'Site Subtitle')}
            </label>
            <input
              type="text"
              className="input"
              value={settings.site_subtitle}
              onChange={(e) => updateField('site_subtitle', e.target.value)}
              placeholder={t('admin.settings.site.siteSubtitlePlaceholder', 'A great service')}
            />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {t('admin.settings.site.siteSubtitleHint', 'Subtitle shown under site name')}
            </p>
          </div>
        </div>

        {/* API Base URL */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('admin.settings.site.apiBaseUrl', 'API Base URL')}
          </label>
          <input
            type="text"
            className="input font-mono text-sm"
            value={settings.api_base_url}
            onChange={(e) => updateField('api_base_url', e.target.value)}
            placeholder={t('admin.settings.site.apiBaseUrlPlaceholder', 'https://api.example.com')}
          />
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            {t('admin.settings.site.apiBaseUrlHint', 'Base URL for API endpoints')}
          </p>
        </div>

        {/* Contact Info */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('admin.settings.site.contactInfo', 'Contact Info')}
          </label>
          <input
            type="text"
            className="input"
            value={settings.contact_info}
            onChange={(e) => updateField('contact_info', e.target.value)}
            placeholder={t('admin.settings.site.contactInfoPlaceholder', 'support@example.com')}
          />
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            {t('admin.settings.site.contactInfoHint', 'Contact information shown to users')}
          </p>
        </div>

        {/* Doc URL */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('admin.settings.site.docUrl', 'Documentation URL')}
          </label>
          <input
            type="url"
            className="input font-mono text-sm"
            value={settings.doc_url}
            onChange={(e) => updateField('doc_url', e.target.value)}
            placeholder={t('admin.settings.site.docUrlPlaceholder', 'https://docs.example.com')}
          />
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            {t('admin.settings.site.docUrlHint', 'Link to documentation')}
          </p>
        </div>

        {/* Site Logo Upload */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('admin.settings.site.siteLogo', 'Site Logo')}
          </label>
          <div className="flex items-start gap-6">
            {/* Logo Preview */}
            <div className="flex-shrink-0">
              <div
                className={`flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border-2 bg-gray-50 dark:bg-dark-800 ${
                  settings.site_logo
                    ? 'border-solid border-gray-300 dark:border-dark-600'
                    : 'border-dashed border-gray-300 dark:border-dark-600'
                }`}
              >
                {settings.site_logo ? (
                  <img
                    src={settings.site_logo}
                    alt="Site Logo"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <svg
                    className="h-8 w-8 text-gray-400 dark:text-dark-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                )}
              </div>
            </div>
            {/* Upload Controls */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <label className="btn btn-secondary btn-sm cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <svg
                    className="mr-1.5 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  {t('admin.settings.site.uploadImage', 'Upload Image')}
                </label>
                {settings.site_logo && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleRemoveLogo}
                    className="text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    <svg
                      className="mr-1.5 h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    {t('admin.settings.site.remove', 'Remove')}
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t(
                  'admin.settings.site.logoHint',
                  'PNG, JPG or SVG. Max 300KB. Recommended size: 200x200px.',
                )}
              </p>
              {logoError && <p className="text-xs text-red-500">{logoError}</p>}
            </div>
          </div>
        </div>

        {/* Home Content */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('admin.settings.site.homeContent', 'Home Page Content')}
          </label>
          <textarea
            className="input font-mono text-sm"
            rows={4}
            value={settings.home_content}
            onChange={(e) => updateField('home_content', e.target.value)}
            placeholder={t(
              'admin.settings.site.homeContentPlaceholder',
              'Markdown content for home page',
            )}
          />
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            {t('admin.settings.site.homeContentHint', 'Markdown content shown on home page')}
          </p>
        </div>
      </SectionCard>

      {/* SMTP Settings (shown when email_verify is enabled) */}
      {settings.email_verify_enabled && (
        <SectionCard
          title={t('admin.settings.smtp.title', 'SMTP Settings')}
          description={t(
            'admin.settings.smtp.description',
            'Configure email sending for verification codes',
          )}
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('admin.settings.smtp.host', 'SMTP Host')}
              </label>
              <input
                type="text"
                className="input"
                value={settings.smtp_host}
                onChange={(e) => updateField('smtp_host', e.target.value)}
                placeholder={t('admin.settings.smtp.hostPlaceholder', 'smtp.example.com')}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('admin.settings.smtp.port', 'SMTP Port')}
              </label>
              <input
                type="number"
                className="input"
                value={settings.smtp_port}
                onChange={(e) => updateField('smtp_port', parseInt(e.target.value) || 587)}
                placeholder={t('admin.settings.smtp.portPlaceholder', '587')}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('admin.settings.smtp.username', 'SMTP Username')}
              </label>
              <input
                type="text"
                className="input"
                value={settings.smtp_username}
                onChange={(e) => updateField('smtp_username', e.target.value)}
                placeholder={t('admin.settings.smtp.usernamePlaceholder', 'user@example.com')}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('admin.settings.smtp.password', 'SMTP Password')}
              </label>
              <input
                type="password"
                className="input"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder={
                  settings.smtp_password_configured
                    ? t(
                        'admin.settings.smtp.passwordConfiguredPlaceholder',
                        'Leave empty to keep existing',
                      )
                    : t('admin.settings.smtp.passwordPlaceholder', 'Enter password')
                }
              />
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                {settings.smtp_password_configured
                  ? t(
                      'admin.settings.smtp.passwordConfiguredHint',
                      'Password configured, leave empty to keep',
                    )
                  : t('admin.settings.smtp.passwordHint', 'Enter SMTP password')}
              </p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('admin.settings.smtp.fromEmail', 'From Email')}
              </label>
              <input
                type="email"
                className="input"
                value={settings.smtp_from_email}
                onChange={(e) => updateField('smtp_from_email', e.target.value)}
                placeholder={t('admin.settings.smtp.fromEmailPlaceholder', 'noreply@example.com')}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('admin.settings.smtp.fromName', 'From Name')}
              </label>
              <input
                type="text"
                className="input"
                value={settings.smtp_from_name}
                onChange={(e) => updateField('smtp_from_name', e.target.value)}
                placeholder={t('admin.settings.smtp.fromNamePlaceholder', 'My Site')}
              />
            </div>
          </div>

          {/* Use TLS Toggle */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-dark-700">
            <div>
              <label className="font-medium text-gray-900 dark:text-white">
                {t('admin.settings.smtp.useTls', 'Use TLS')}
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('admin.settings.smtp.useTlsHint', 'Enable TLS encryption for SMTP connection')}
              </p>
            </div>
            <Switch
              checked={settings.smtp_use_tls}
              onCheckedChange={(v) => updateField('smtp_use_tls', v)}
            />
          </div>
        </SectionCard>
      )}

      {/* Cloudflare Turnstile */}
      <SectionCard
        title={t('admin.settings.turnstile.title', 'Cloudflare Turnstile')}
        description={t(
          'admin.settings.turnstile.description',
          'Bot protection for login and registration',
        )}
      >
        {/* Enable Turnstile */}
        <div className="flex items-center justify-between">
          <div>
            <label className="font-medium text-gray-900 dark:text-white">
              {t('admin.settings.turnstile.enableTurnstile', 'Enable Turnstile')}
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t(
                'admin.settings.turnstile.enableTurnstileHint',
                'Enable Cloudflare Turnstile for bot protection',
              )}
            </p>
          </div>
          <Switch
            checked={settings.turnstile_enabled}
            onCheckedChange={(v) => updateField('turnstile_enabled', v)}
          />
        </div>

        {/* Turnstile Keys - Only show when enabled */}
        {settings.turnstile_enabled && (
          <div className="border-t border-gray-100 pt-4 dark:border-dark-700">
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('admin.settings.turnstile.siteKey', 'Site Key')}
                </label>
                <input
                  type="text"
                  className="input font-mono text-sm"
                  value={settings.turnstile_site_key}
                  onChange={(e) => updateField('turnstile_site_key', e.target.value)}
                  placeholder="0x4AAAAAAA..."
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {t('admin.settings.turnstile.siteKeyHint', 'Get from Cloudflare Dashboard')}
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('admin.settings.turnstile.secretKey', 'Secret Key')}
                </label>
                <input
                  type="password"
                  className="input font-mono text-sm"
                  value={turnstileSecretKey}
                  onChange={(e) => setTurnstileSecretKey(e.target.value)}
                  placeholder="0x4AAAAAAA..."
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {settings.turnstile_secret_key_configured
                    ? t(
                        'admin.settings.turnstile.secretKeyConfiguredHint',
                        'Secret key configured, leave empty to keep',
                      )
                    : t(
                        'admin.settings.turnstile.secretKeyHint',
                        'Enter secret key from Cloudflare',
                      )}
                </p>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Purchase */}
      <SectionCard
        title={t('admin.settings.purchase.title', 'Purchase Page')}
        description={t(
          'admin.settings.purchase.description',
          'Show a "Purchase Subscription" entry in the sidebar and open the configured URL in an iframe',
        )}
      >
        {/* Enable Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <label className="font-medium text-gray-900 dark:text-white">
              {t('admin.settings.purchase.enabled', 'Show Purchase Entry')}
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('admin.settings.purchase.enabledHint', 'Display purchase option in sidebar')}
            </p>
          </div>
          <Switch
            checked={settings.purchase_subscription_enabled}
            onCheckedChange={(v) => updateField('purchase_subscription_enabled', v)}
          />
        </div>

        {/* URL - Only show when enabled */}
        {settings.purchase_subscription_enabled && (
          <div className="border-t border-gray-100 pt-4 dark:border-dark-700">
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('admin.settings.purchase.url', 'Purchase URL')}
                </label>
                <input
                  type="url"
                  className="input font-mono text-sm"
                  value={settings.purchase_subscription_url}
                  onChange={(e) => updateField('purchase_subscription_url', e.target.value)}
                  placeholder={t(
                    'admin.settings.purchase.urlPlaceholder',
                    'https://shop.example.com',
                  )}
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {t('admin.settings.purchase.urlHint', 'URL to purchase subscription page')}
                </p>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Stream Timeout */}
      <SectionCard
        title={t('admin.settings.streamTimeout.title', 'Stream Timeout Handling')}
        description={t(
          'admin.settings.streamTimeout.description',
          'Configure account handling strategy when upstream response times out',
        )}
      >
        {streamTimeout && (
          <>
            {/* Enable Stream Timeout */}
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900 dark:text-white">
                  {t('admin.settings.streamTimeout.enabled', 'Enable Stream Timeout Handling')}
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t(
                    'admin.settings.streamTimeout.enabledHint',
                    'Automatically handle accounts when stream timeout occurs',
                  )}
                </p>
              </div>
              <Switch
                checked={streamTimeout.enabled}
                onCheckedChange={(v) =>
                  setStreamTimeout((prev) => (prev ? { ...prev, enabled: v } : prev))
                }
              />
            </div>

            {/* Settings - Only show when enabled */}
            {streamTimeout.enabled && (
              <div className="border-t border-gray-100 pt-4 dark:border-dark-700">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('admin.settings.streamTimeout.action', 'Action')}
                    </label>
                    <Select
                      value={streamTimeout.action}
                      onValueChange={(v) =>
                        setStreamTimeout((prev) =>
                          prev ? { ...prev, action: v as StreamTimeoutSettings['action'] } : prev,
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value="temp_unsched">
                          {t(
                            'admin.settings.streamTimeout.actionTempUnsched',
                            'Temporarily Unschedulable',
                          )}
                        </SelectItem>
                        <SelectItem value="error">
                          {t('admin.settings.streamTimeout.actionError', 'Mark as Error')}
                        </SelectItem>
                        <SelectItem value="none">
                          {t('admin.settings.streamTimeout.actionNone', 'No Action')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {t(
                        'admin.settings.streamTimeout.actionHint',
                        'Action to take when timeout threshold is reached',
                      )}
                    </p>
                  </div>

                  {streamTimeout.action === 'temp_unsched' && (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t(
                          'admin.settings.streamTimeout.tempUnschedMinutes',
                          'Pause Duration (minutes)',
                        )}
                      </label>
                      <input
                        type="number"
                        className="input"
                        value={streamTimeout.temp_unsched_minutes}
                        onChange={(e) =>
                          setStreamTimeout((prev) =>
                            prev
                              ? { ...prev, temp_unsched_minutes: parseInt(e.target.value) || 30 }
                              : prev,
                          )
                        }
                        min={1}
                        max={60}
                      />
                      <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {t(
                          'admin.settings.streamTimeout.tempUnschedMinutesHint',
                          'Duration to pause the account',
                        )}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t(
                        'admin.settings.streamTimeout.thresholdCount',
                        'Trigger Threshold (count)',
                      )}
                    </label>
                    <input
                      type="number"
                      className="input"
                      value={streamTimeout.threshold_count}
                      onChange={(e) =>
                        setStreamTimeout((prev) =>
                          prev ? { ...prev, threshold_count: parseInt(e.target.value) || 1 } : prev,
                        )
                      }
                      min={1}
                      max={10}
                    />
                    <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {t(
                        'admin.settings.streamTimeout.thresholdCountHint',
                        'Number of timeouts before action is taken',
                      )}
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t(
                        'admin.settings.streamTimeout.thresholdWindowMinutes',
                        'Threshold Window (minutes)',
                      )}
                    </label>
                    <input
                      type="number"
                      className="input"
                      value={streamTimeout.threshold_window_minutes}
                      onChange={(e) =>
                        setStreamTimeout((prev) =>
                          prev
                            ? { ...prev, threshold_window_minutes: parseInt(e.target.value) || 5 }
                            : prev,
                        )
                      }
                      min={1}
                      max={60}
                    />
                    <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {t(
                        'admin.settings.streamTimeout.thresholdWindowMinutesHint',
                        'Time window for counting timeouts',
                      )}
                    </p>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end border-t border-gray-100 pt-4 dark:border-dark-700">
                  <Button variant="secondary" size="sm" onClick={handleSaveStreamTimeout}>
                    <CheckIcon className="h-4 w-4" />
                    {t('admin.settings.saveSettings', 'Save Settings')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </SectionCard>

      {/* Master Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <span className="spinner h-4 w-4" /> : <CheckIcon className="h-5 w-5" />}
          {t('admin.settings.saveSettings', 'Save Settings')}
        </Button>
      </div>
    </div>
  )
}
