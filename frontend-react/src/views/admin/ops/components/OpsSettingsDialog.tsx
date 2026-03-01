/**
 * OpsSettingsDialog
 * Unified settings dialog: data collection, alerts, reports, thresholds, advanced.
 * Uses @tanstack/react-form for all form state management.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { opsAPI } from '@/api/admin/ops'
import type {
  OpsAlertRuntimeSettings,
  EmailNotificationConfig,
  OpsAdvancedSettings,
} from '@/api/admin/ops'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/stores/app'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4 dark:bg-dark-700/50">
      <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
      {children}
    </div>
  )
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  )
}

function EmailChipInput({
  emails,
  onChange,
  placeholder,
}: {
  emails: string[]
  onChange: (emails: string[]) => void
  placeholder: string
}) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const addEmail = () => {
    const email = input.trim().toLowerCase()
    if (!email) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Invalid email format')
      return
    }
    if (emails.includes(email)) {
      setInput('')
      return
    }
    onChange([...emails, email])
    setInput('')
    setError('')
  }

  const removeEmail = (email: string) => {
    onChange(emails.filter((e) => e !== email))
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          type="email"
          className="h-7 flex-1 text-xs"
          placeholder={placeholder}
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addEmail()
            }
          }}
        />
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addEmail}>
          Add
        </Button>
      </div>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
      {emails.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {emails.map((email) => (
            <Badge key={email} variant="secondary" className="gap-1 text-[11px]">
              {email}
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => removeEmail(email)}
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

interface SettingsFormValues {
  // Data Collection
  evalInterval: number
  // Alert Config
  alertEnabled: boolean
  alertRecipients: string[]
  minSeverity: string
  // Report Config
  reportEnabled: boolean
  reportRecipients: string[]
  dailySummaryEnabled: boolean
  dailySummaryCron: string
  weeklySummaryEnabled: boolean
  weeklySummaryCron: string
  // Metric Thresholds
  sla_percent_min: number
  ttft_p99_ms_max: number
  request_error_rate_percent_max: number
  upstream_error_rate_percent_max: number
  // Advanced — Data Retention
  cleanupEnabled: boolean
  cleanupSchedule: string
  errorLogRetentionDays: number
  minuteMetricsRetentionDays: number
  hourlyMetricsRetentionDays: number
  // Advanced — Aggregation
  aggregationEnabled: boolean
  // Advanced — Error Filtering
  ignoreCountTokensErrors: boolean
  ignoreContextCanceled: boolean
  ignoreNoAvailableAccounts: boolean
  ignoreInvalidApiKeyErrors: boolean
  // Advanced — Auto Refresh
  autoRefreshEnabled: boolean
  autoRefreshInterval: number
}

const DEFAULT_FORM_VALUES: SettingsFormValues = {
  evalInterval: 60,
  alertEnabled: false,
  alertRecipients: [],
  minSeverity: '',
  reportEnabled: false,
  reportRecipients: [],
  dailySummaryEnabled: false,
  dailySummaryCron: '0 8 * * *',
  weeklySummaryEnabled: false,
  weeklySummaryCron: '0 9 * * 1',
  sla_percent_min: 99.5,
  ttft_p99_ms_max: 500,
  request_error_rate_percent_max: 5,
  upstream_error_rate_percent_max: 5,
  cleanupEnabled: false,
  cleanupSchedule: '0 2 * * *',
  errorLogRetentionDays: 30,
  minuteMetricsRetentionDays: 7,
  hourlyMetricsRetentionDays: 90,
  aggregationEnabled: true,
  ignoreCountTokensErrors: false,
  ignoreContextCanceled: false,
  ignoreNoAvailableAccounts: false,
  ignoreInvalidApiKeyErrors: false,
  autoRefreshEnabled: false,
  autoRefreshInterval: 30,
}

export function OpsSettingsDialog({ open, onOpenChange, onSaved }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const showSuccess = useAppStore((s) => s.showSuccess)
  const showError = useAppStore((s) => s.showError)

  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // ==================== Queries ====================

  const { data: runtimeData, isLoading: loadingRuntime } = useQuery({
    queryKey: ['ops', 'alertRuntimeSettings'],
    queryFn: () => opsAPI.getAlertRuntimeSettings(),
    enabled: open,
  })

  const { data: emailData, isLoading: loadingEmail } = useQuery({
    queryKey: ['ops', 'emailNotificationConfig'],
    queryFn: () => opsAPI.getEmailNotificationConfig(),
    enabled: open,
  })

  const { data: advancedData, isLoading: loadingAdvanced } = useQuery({
    queryKey: ['ops', 'advancedSettings'],
    queryFn: () => opsAPI.getAdvancedSettings(),
    enabled: open,
  })

  const { data: thresholdsData, isLoading: loadingThresholds } = useQuery({
    queryKey: ['ops', 'metricThresholds'],
    queryFn: () => opsAPI.getMetricThresholds(),
    enabled: open,
  })

  const loading = loadingRuntime || loadingEmail || loadingAdvanced || loadingThresholds

  // ==================== Form ====================

  const form = useForm<SettingsFormValues>({
    defaultValues: { ...DEFAULT_FORM_VALUES },
    onSubmit: async ({ value }) => {
      // Validate
      const errors: string[] = []
      if (value.evalInterval < 1 || value.evalInterval > 86400) {
        errors.push('Evaluation interval must be between 1 and 86400 seconds')
      }
      if (value.alertEnabled && value.alertRecipients.length === 0) {
        errors.push('Alert enabled but no recipients specified')
      }
      if (value.reportEnabled && value.reportRecipients.length === 0) {
        errors.push('Report enabled but no recipients specified')
      }
      if (
        value.sla_percent_min != null &&
        (value.sla_percent_min < 0 || value.sla_percent_min > 100)
      ) {
        errors.push(t('admin.ops.settings.validation.slaMinPercentRange'))
      }
      if (value.ttft_p99_ms_max != null && value.ttft_p99_ms_max < 0) {
        errors.push(t('admin.ops.settings.validation.ttftP99MaxRange'))
      }
      if (
        value.request_error_rate_percent_max != null &&
        (value.request_error_rate_percent_max < 0 || value.request_error_rate_percent_max > 100)
      ) {
        errors.push(t('admin.ops.settings.validation.requestErrorRateMaxRange'))
      }
      if (
        value.upstream_error_rate_percent_max != null &&
        (value.upstream_error_rate_percent_max < 0 || value.upstream_error_rate_percent_max > 100)
      ) {
        errors.push(t('admin.ops.settings.validation.upstreamErrorRateMaxRange'))
      }
      if (value.cleanupEnabled) {
        for (const d of [
          value.errorLogRetentionDays,
          value.minuteMetricsRetentionDays,
          value.hourlyMetricsRetentionDays,
        ]) {
          if (d < 1 || d > 365) {
            errors.push(t('admin.ops.settings.validation.retentionDaysRange'))
            break
          }
        }
      }

      if (errors.length > 0) {
        setValidationErrors(errors)
        return
      }
      setValidationErrors([])

      saveMutation.mutate(value)
    },
  })

  // Populate form when data loads
  useEffect(() => {
    if (!runtimeData && !emailData && !advancedData && !thresholdsData) return

    form.reset({
      // Data Collection
      evalInterval: runtimeData?.evaluation_interval_seconds ?? DEFAULT_FORM_VALUES.evalInterval,
      // Alert Config
      alertEnabled: emailData?.alert?.enabled ?? DEFAULT_FORM_VALUES.alertEnabled,
      alertRecipients: emailData?.alert?.recipients ?? DEFAULT_FORM_VALUES.alertRecipients,
      minSeverity: emailData?.alert?.min_severity ?? DEFAULT_FORM_VALUES.minSeverity,
      // Report Config
      reportEnabled: emailData?.report?.enabled ?? DEFAULT_FORM_VALUES.reportEnabled,
      reportRecipients: emailData?.report?.recipients ?? DEFAULT_FORM_VALUES.reportRecipients,
      dailySummaryEnabled:
        emailData?.report?.daily_summary_enabled ?? DEFAULT_FORM_VALUES.dailySummaryEnabled,
      dailySummaryCron:
        emailData?.report?.daily_summary_schedule ?? DEFAULT_FORM_VALUES.dailySummaryCron,
      weeklySummaryEnabled:
        emailData?.report?.weekly_summary_enabled ?? DEFAULT_FORM_VALUES.weeklySummaryEnabled,
      weeklySummaryCron:
        emailData?.report?.weekly_summary_schedule ?? DEFAULT_FORM_VALUES.weeklySummaryCron,
      // Metric Thresholds
      sla_percent_min: thresholdsData?.sla_percent_min ?? DEFAULT_FORM_VALUES.sla_percent_min,
      ttft_p99_ms_max: thresholdsData?.ttft_p99_ms_max ?? DEFAULT_FORM_VALUES.ttft_p99_ms_max,
      request_error_rate_percent_max:
        thresholdsData?.request_error_rate_percent_max ??
        DEFAULT_FORM_VALUES.request_error_rate_percent_max,
      upstream_error_rate_percent_max:
        thresholdsData?.upstream_error_rate_percent_max ??
        DEFAULT_FORM_VALUES.upstream_error_rate_percent_max,
      // Advanced — Data Retention
      cleanupEnabled:
        advancedData?.data_retention?.cleanup_enabled ?? DEFAULT_FORM_VALUES.cleanupEnabled,
      cleanupSchedule:
        advancedData?.data_retention?.cleanup_schedule ?? DEFAULT_FORM_VALUES.cleanupSchedule,
      errorLogRetentionDays:
        advancedData?.data_retention?.error_log_retention_days ??
        DEFAULT_FORM_VALUES.errorLogRetentionDays,
      minuteMetricsRetentionDays:
        advancedData?.data_retention?.minute_metrics_retention_days ??
        DEFAULT_FORM_VALUES.minuteMetricsRetentionDays,
      hourlyMetricsRetentionDays:
        advancedData?.data_retention?.hourly_metrics_retention_days ??
        DEFAULT_FORM_VALUES.hourlyMetricsRetentionDays,
      // Advanced — Aggregation
      aggregationEnabled:
        advancedData?.aggregation?.aggregation_enabled ?? DEFAULT_FORM_VALUES.aggregationEnabled,
      // Advanced — Error Filtering
      ignoreCountTokensErrors:
        advancedData?.ignore_count_tokens_errors ?? DEFAULT_FORM_VALUES.ignoreCountTokensErrors,
      ignoreContextCanceled:
        advancedData?.ignore_context_canceled ?? DEFAULT_FORM_VALUES.ignoreContextCanceled,
      ignoreNoAvailableAccounts:
        advancedData?.ignore_no_available_accounts ?? DEFAULT_FORM_VALUES.ignoreNoAvailableAccounts,
      ignoreInvalidApiKeyErrors:
        advancedData?.ignore_invalid_api_key_errors ??
        DEFAULT_FORM_VALUES.ignoreInvalidApiKeyErrors,
      // Advanced — Auto Refresh
      autoRefreshEnabled:
        advancedData?.auto_refresh_enabled ?? DEFAULT_FORM_VALUES.autoRefreshEnabled,
      autoRefreshInterval:
        advancedData?.auto_refresh_interval_seconds ?? DEFAULT_FORM_VALUES.autoRefreshInterval,
    })
  }, [runtimeData, emailData, advancedData, thresholdsData]) // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== Save ====================

  const saveMutation = useMutation({
    mutationFn: async (value: SettingsFormValues) => {
      const runtimePayload: OpsAlertRuntimeSettings = {
        evaluation_interval_seconds: value.evalInterval,
        distributed_lock: runtimeData?.distributed_lock ?? {
          enabled: true,
          key: 'ops:alert:evaluator:leader',
          ttl_seconds: 30,
        },
        silencing: runtimeData?.silencing ?? {
          enabled: false,
          global_until_rfc3339: '',
          global_reason: '',
          entries: [],
        },
        thresholds: {
          sla_percent_min: value.sla_percent_min,
          ttft_p99_ms_max: value.ttft_p99_ms_max,
          request_error_rate_percent_max: value.request_error_rate_percent_max,
          upstream_error_rate_percent_max: value.upstream_error_rate_percent_max,
        },
      }

      const emailPayload: EmailNotificationConfig = {
        alert: {
          enabled: value.alertEnabled,
          recipients: value.alertRecipients,
          min_severity: value.minSeverity || undefined,
          rate_limit_per_hour: emailData?.alert?.rate_limit_per_hour ?? 10,
          batching_window_seconds: emailData?.alert?.batching_window_seconds ?? 300,
          include_resolved_alerts: emailData?.alert?.include_resolved_alerts ?? false,
        },
        report: {
          enabled: value.reportEnabled,
          recipients: value.reportRecipients,
          daily_summary_enabled: value.dailySummaryEnabled,
          daily_summary_schedule: value.dailySummaryCron,
          weekly_summary_enabled: value.weeklySummaryEnabled,
          weekly_summary_schedule: value.weeklySummaryCron,
          error_digest_enabled: emailData?.report?.error_digest_enabled ?? false,
          error_digest_schedule: emailData?.report?.error_digest_schedule ?? '0 */4 * * *',
          error_digest_min_count: emailData?.report?.error_digest_min_count ?? 10,
          account_health_enabled: emailData?.report?.account_health_enabled ?? false,
          account_health_schedule: emailData?.report?.account_health_schedule ?? '0 */6 * * *',
          account_health_error_rate_threshold:
            emailData?.report?.account_health_error_rate_threshold ?? 10,
        },
      }

      const advancedPayload: OpsAdvancedSettings = {
        data_retention: {
          cleanup_enabled: value.cleanupEnabled,
          cleanup_schedule: value.cleanupSchedule,
          error_log_retention_days: value.errorLogRetentionDays,
          minute_metrics_retention_days: value.minuteMetricsRetentionDays,
          hourly_metrics_retention_days: value.hourlyMetricsRetentionDays,
        },
        aggregation: {
          aggregation_enabled: value.aggregationEnabled,
        },
        ignore_count_tokens_errors: value.ignoreCountTokensErrors,
        ignore_context_canceled: value.ignoreContextCanceled,
        ignore_no_available_accounts: value.ignoreNoAvailableAccounts,
        ignore_invalid_api_key_errors: value.ignoreInvalidApiKeyErrors,
        auto_refresh_enabled: value.autoRefreshEnabled,
        auto_refresh_interval_seconds: value.autoRefreshInterval,
      }

      await Promise.all([
        opsAPI.updateAlertRuntimeSettings(runtimePayload),
        opsAPI.updateEmailNotificationConfig(emailPayload),
        opsAPI.updateAdvancedSettings(advancedPayload),
        opsAPI.updateMetricThresholds({
          sla_percent_min: value.sla_percent_min,
          ttft_p99_ms_max: value.ttft_p99_ms_max,
          request_error_rate_percent_max: value.request_error_rate_percent_max,
          upstream_error_rate_percent_max: value.upstream_error_rate_percent_max,
        }),
      ])
    },
    onSuccess: () => {
      showSuccess(t('admin.ops.settings.saveSuccess'))
      queryClient.invalidateQueries({ queryKey: ['ops'] })
      onSaved?.()
      onOpenChange(false)
    },
    onError: () => {
      showError(t('admin.ops.settings.saveFailed'))
    },
  })

  // Read form values for conditional rendering
  const v = form.state.values

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="text-sm">{t('admin.ops.settings.title')}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-6 overflow-auto pr-1">
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {t('common.loading', 'Loading...')}
              </div>
            ) : (
              <>
                {/* Validation errors */}
                {validationErrors.length > 0 && (
                  <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                    <p className="mb-1 font-bold">{t('admin.ops.settings.validation.title')}</p>
                    <ul className="list-inside list-disc space-y-0.5">
                      {validationErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Data Collection */}
                <SectionCard title={t('admin.ops.settings.dataCollection')}>
                  <form.Field name="evalInterval">
                    {(field) => (
                      <FieldRow
                        label={t('admin.ops.settings.evaluationInterval')}
                        hint={t('admin.ops.settings.evaluationIntervalHint')}
                      >
                        <Input
                          type="number"
                          min={1}
                          max={86400}
                          className="h-8 text-xs"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(Number(e.target.value))}
                          onBlur={field.handleBlur}
                        />
                      </FieldRow>
                    )}
                  </form.Field>
                </SectionCard>

                {/* Alert Config */}
                <SectionCard title={t('admin.ops.settings.alertConfig')}>
                  <div className="space-y-4">
                    <form.Field name="alertEnabled">
                      {(field) => (
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {t('admin.ops.settings.enableAlert')}
                          </span>
                          <Switch
                            checked={field.state.value}
                            onCheckedChange={field.handleChange}
                          />
                        </div>
                      )}
                    </form.Field>
                    {v.alertEnabled && (
                      <>
                        <form.Field name="alertRecipients">
                          {(field) => (
                            <FieldRow
                              label={t('admin.ops.settings.alertRecipients')}
                              hint={t('admin.ops.settings.recipientsHint')}
                            >
                              <EmailChipInput
                                emails={field.state.value}
                                onChange={field.handleChange}
                                placeholder={t('admin.ops.settings.emailPlaceholder')}
                              />
                            </FieldRow>
                          )}
                        </form.Field>
                        <form.Field name="minSeverity">
                          {(field) => (
                            <FieldRow label={t('admin.ops.settings.minSeverity')}>
                              <Select
                                value={field.state.value || 'all'}
                                onValueChange={(val) =>
                                  field.handleChange(val === 'all' ? '' : val)
                                }
                              >
                                <SelectTrigger className="h-8 w-40 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All</SelectItem>
                                  <SelectItem value="critical">Critical</SelectItem>
                                  <SelectItem value="warning">Warning</SelectItem>
                                  <SelectItem value="info">Info</SelectItem>
                                </SelectContent>
                              </Select>
                            </FieldRow>
                          )}
                        </form.Field>
                      </>
                    )}
                  </div>
                </SectionCard>

                {/* Report Config */}
                <SectionCard title={t('admin.ops.settings.reportConfig')}>
                  <div className="space-y-4">
                    <form.Field name="reportEnabled">
                      {(field) => (
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {t('admin.ops.settings.enableReport')}
                          </span>
                          <Switch
                            checked={field.state.value}
                            onCheckedChange={field.handleChange}
                          />
                        </div>
                      )}
                    </form.Field>
                    {v.reportEnabled && (
                      <>
                        <form.Field name="reportRecipients">
                          {(field) => (
                            <FieldRow label={t('admin.ops.settings.reportRecipients')}>
                              <EmailChipInput
                                emails={field.state.value}
                                onChange={field.handleChange}
                                placeholder={t('admin.ops.settings.emailPlaceholder')}
                              />
                            </FieldRow>
                          )}
                        </form.Field>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <form.Field name="dailySummaryEnabled">
                            {(field) => (
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {t('admin.ops.settings.dailySummary')}
                                </span>
                                <Switch
                                  checked={field.state.value}
                                  onCheckedChange={field.handleChange}
                                />
                              </div>
                            )}
                          </form.Field>
                          {v.dailySummaryEnabled && (
                            <form.Field name="dailySummaryCron">
                              {(field) => (
                                <div>
                                  <Input
                                    className="h-8 font-mono text-xs"
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    onBlur={field.handleBlur}
                                    placeholder="0 8 * * *"
                                  />
                                </div>
                              )}
                            </form.Field>
                          )}
                          <form.Field name="weeklySummaryEnabled">
                            {(field) => (
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {t('admin.ops.settings.weeklySummary')}
                                </span>
                                <Switch
                                  checked={field.state.value}
                                  onCheckedChange={field.handleChange}
                                />
                              </div>
                            )}
                          </form.Field>
                          {v.weeklySummaryEnabled && (
                            <form.Field name="weeklySummaryCron">
                              {(field) => (
                                <div>
                                  <Input
                                    className="h-8 font-mono text-xs"
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    onBlur={field.handleBlur}
                                    placeholder="0 9 * * 1"
                                  />
                                </div>
                              )}
                            </form.Field>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </SectionCard>

                {/* Metric Thresholds */}
                <SectionCard title={t('admin.ops.settings.metricThresholds')}>
                  <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                    {t('admin.ops.settings.metricThresholdsHint')}
                  </p>
                  <div className="space-y-4">
                    <form.Field name="sla_percent_min">
                      {(field) => (
                        <FieldRow
                          label={t('admin.ops.settings.slaMinPercent')}
                          hint={t('admin.ops.settings.slaMinPercentHint')}
                        >
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            className="h-8 text-xs"
                            value={field.state.value ?? ''}
                            onChange={(e) => field.handleChange(Number(e.target.value))}
                            onBlur={field.handleBlur}
                          />
                        </FieldRow>
                      )}
                    </form.Field>
                    <form.Field name="ttft_p99_ms_max">
                      {(field) => (
                        <FieldRow
                          label={t('admin.ops.settings.ttftP99MaxMs')}
                          hint={t('admin.ops.settings.ttftP99MaxMsHint')}
                        >
                          <Input
                            type="number"
                            min={0}
                            step={50}
                            className="h-8 text-xs"
                            value={field.state.value ?? ''}
                            onChange={(e) => field.handleChange(Number(e.target.value))}
                            onBlur={field.handleBlur}
                          />
                        </FieldRow>
                      )}
                    </form.Field>
                    <form.Field name="request_error_rate_percent_max">
                      {(field) => (
                        <FieldRow
                          label={t('admin.ops.settings.requestErrorRateMaxPercent')}
                          hint={t('admin.ops.settings.requestErrorRateMaxPercentHint')}
                        >
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            className="h-8 text-xs"
                            value={field.state.value ?? ''}
                            onChange={(e) => field.handleChange(Number(e.target.value))}
                            onBlur={field.handleBlur}
                          />
                        </FieldRow>
                      )}
                    </form.Field>
                    <form.Field name="upstream_error_rate_percent_max">
                      {(field) => (
                        <FieldRow
                          label={t('admin.ops.settings.upstreamErrorRateMaxPercent')}
                          hint={t('admin.ops.settings.upstreamErrorRateMaxPercentHint')}
                        >
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            className="h-8 text-xs"
                            value={field.state.value ?? ''}
                            onChange={(e) => field.handleChange(Number(e.target.value))}
                            onBlur={field.handleBlur}
                          />
                        </FieldRow>
                      )}
                    </form.Field>
                  </div>
                </SectionCard>

                {/* Advanced Settings */}
                <details className="group rounded-2xl bg-gray-50 dark:bg-dark-700/50">
                  <summary className="cursor-pointer p-4 text-sm font-semibold text-gray-900 dark:text-white">
                    {t('admin.ops.settings.advancedSettings')}
                  </summary>
                  <div className="space-y-4 px-4 pb-4">
                    {/* Data Retention */}
                    <div className="space-y-3">
                      <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {t('admin.ops.settings.dataRetention')}
                      </h5>
                      <form.Field name="cleanupEnabled">
                        {(field) => (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {t('admin.ops.settings.enableCleanup')}
                            </span>
                            <Switch
                              checked={field.state.value}
                              onCheckedChange={field.handleChange}
                            />
                          </div>
                        )}
                      </form.Field>
                      {v.cleanupEnabled && (
                        <>
                          <form.Field name="cleanupSchedule">
                            {(field) => (
                              <FieldRow
                                label={t('admin.ops.settings.cleanupSchedule')}
                                hint={t('admin.ops.settings.cleanupScheduleHint')}
                              >
                                <Input
                                  className="h-8 font-mono text-xs"
                                  value={field.state.value}
                                  onChange={(e) => field.handleChange(e.target.value)}
                                  onBlur={field.handleBlur}
                                  placeholder="0 2 * * *"
                                />
                              </FieldRow>
                            )}
                          </form.Field>
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <form.Field name="errorLogRetentionDays">
                              {(field) => (
                                <FieldRow label={t('admin.ops.settings.errorLogRetentionDays')}>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={365}
                                    className="h-8 text-xs"
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(Number(e.target.value))}
                                    onBlur={field.handleBlur}
                                  />
                                </FieldRow>
                              )}
                            </form.Field>
                            <form.Field name="minuteMetricsRetentionDays">
                              {(field) => (
                                <FieldRow
                                  label={t('admin.ops.settings.minuteMetricsRetentionDays')}
                                >
                                  <Input
                                    type="number"
                                    min={1}
                                    max={365}
                                    className="h-8 text-xs"
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(Number(e.target.value))}
                                    onBlur={field.handleBlur}
                                  />
                                </FieldRow>
                              )}
                            </form.Field>
                            <form.Field name="hourlyMetricsRetentionDays">
                              {(field) => (
                                <FieldRow
                                  label={t('admin.ops.settings.hourlyMetricsRetentionDays')}
                                >
                                  <Input
                                    type="number"
                                    min={1}
                                    max={365}
                                    className="h-8 text-xs"
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(Number(e.target.value))}
                                    onBlur={field.handleBlur}
                                  />
                                </FieldRow>
                              )}
                            </form.Field>
                          </div>
                          <p className="text-xs text-gray-500">
                            {t('admin.ops.settings.retentionDaysHint')}
                          </p>
                        </>
                      )}
                    </div>

                    {/* Aggregation */}
                    <div className="space-y-3">
                      <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {t('admin.ops.settings.aggregation')}
                      </h5>
                      <form.Field name="aggregationEnabled">
                        {(field) => (
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t('admin.ops.settings.enableAggregation')}
                              </span>
                              <p className="mt-1 text-xs text-gray-500">
                                {t('admin.ops.settings.aggregationHint')}
                              </p>
                            </div>
                            <Switch
                              checked={field.state.value}
                              onCheckedChange={field.handleChange}
                            />
                          </div>
                        )}
                      </form.Field>
                    </div>

                    {/* Error Filtering */}
                    <div className="space-y-3">
                      <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {t('admin.ops.settings.errorFiltering')}
                      </h5>
                      {(
                        [
                          {
                            name: 'ignoreCountTokensErrors' as const,
                            label: t('admin.ops.settings.ignoreCountTokensErrors'),
                            hint: t('admin.ops.settings.ignoreCountTokensErrorsHint'),
                          },
                          {
                            name: 'ignoreContextCanceled' as const,
                            label: t('admin.ops.settings.ignoreContextCanceled'),
                            hint: t('admin.ops.settings.ignoreContextCanceledHint'),
                          },
                          {
                            name: 'ignoreNoAvailableAccounts' as const,
                            label: t('admin.ops.settings.ignoreNoAvailableAccounts'),
                            hint: t('admin.ops.settings.ignoreNoAvailableAccountsHint'),
                          },
                          {
                            name: 'ignoreInvalidApiKeyErrors' as const,
                            label: t('admin.ops.settings.ignoreInvalidApiKeyErrors'),
                            hint: t('admin.ops.settings.ignoreInvalidApiKeyErrorsHint'),
                          },
                        ] as const
                      ).map((item) => (
                        <form.Field key={item.name} name={item.name}>
                          {(field) => (
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {item.label}
                                </span>
                                <p className="mt-1 text-xs text-gray-500">{item.hint}</p>
                              </div>
                              <Switch
                                checked={field.state.value}
                                onCheckedChange={field.handleChange}
                              />
                            </div>
                          )}
                        </form.Field>
                      ))}
                    </div>

                    {/* Auto Refresh */}
                    <div className="space-y-3">
                      <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {t('admin.ops.settings.autoRefresh')}
                      </h5>
                      <form.Field name="autoRefreshEnabled">
                        {(field) => (
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t('admin.ops.settings.enableAutoRefresh')}
                              </span>
                              <p className="mt-1 text-xs text-gray-500">
                                {t('admin.ops.settings.enableAutoRefreshHint')}
                              </p>
                            </div>
                            <Switch
                              checked={field.state.value}
                              onCheckedChange={field.handleChange}
                            />
                          </div>
                        )}
                      </form.Field>
                      {v.autoRefreshEnabled && (
                        <form.Field name="autoRefreshInterval">
                          {(field) => (
                            <FieldRow label={t('admin.ops.settings.refreshInterval')}>
                              <Select
                                value={String(field.state.value)}
                                onValueChange={(val) => field.handleChange(Number(val))}
                              >
                                <SelectTrigger className="h-8 w-40 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="15">
                                    {t('admin.ops.settings.refreshInterval15s')}
                                  </SelectItem>
                                  <SelectItem value="30">
                                    {t('admin.ops.settings.refreshInterval30s')}
                                  </SelectItem>
                                  <SelectItem value="60">
                                    {t('admin.ops.settings.refreshInterval60s')}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </FieldRow>
                          )}
                        </form.Field>
                      )}
                    </div>
                  </div>
                </details>
              </>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={loading || saveMutation.isPending}>
              {saveMutation.isPending ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
