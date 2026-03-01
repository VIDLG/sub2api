/**
 * OpsAlertRulesDialog
 * CRUD dialog for managing alert rules: list, create, edit, delete.
 * Uses @tanstack/react-form for the editor form.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { opsAPI } from '@/api/admin/ops'
import { adminAPI } from '@/api/admin'
import type { AlertRule, MetricType, Operator } from '@/api/admin/ops'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RefreshIcon } from '@/components/icons'
import { useAppStore } from '@/stores/app'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface MetricDef {
  type: MetricType
  group: 'system' | 'group' | 'account'
  recommendedOperator: Operator
  recommendedThreshold: number
  unit?: string
}

const METRIC_DEFS: MetricDef[] = [
  {
    type: 'success_rate',
    group: 'system',
    recommendedOperator: '<',
    recommendedThreshold: 99,
    unit: '%',
  },
  {
    type: 'error_rate',
    group: 'system',
    recommendedOperator: '>',
    recommendedThreshold: 5,
    unit: '%',
  },
  {
    type: 'upstream_error_rate',
    group: 'system',
    recommendedOperator: '>',
    recommendedThreshold: 5,
    unit: '%',
  },
  {
    type: 'cpu_usage_percent',
    group: 'system',
    recommendedOperator: '>',
    recommendedThreshold: 90,
    unit: '%',
  },
  {
    type: 'memory_usage_percent',
    group: 'system',
    recommendedOperator: '>',
    recommendedThreshold: 90,
    unit: '%',
  },
  {
    type: 'concurrency_queue_depth',
    group: 'system',
    recommendedOperator: '>',
    recommendedThreshold: 100,
  },
  {
    type: 'group_available_accounts',
    group: 'group',
    recommendedOperator: '<',
    recommendedThreshold: 1,
  },
  {
    type: 'group_available_ratio',
    group: 'group',
    recommendedOperator: '<',
    recommendedThreshold: 50,
    unit: '%',
  },
  {
    type: 'group_rate_limit_ratio',
    group: 'group',
    recommendedOperator: '>',
    recommendedThreshold: 80,
    unit: '%',
  },
  {
    type: 'account_rate_limited_count',
    group: 'account',
    recommendedOperator: '>',
    recommendedThreshold: 5,
  },
  {
    type: 'account_error_count',
    group: 'account',
    recommendedOperator: '>',
    recommendedThreshold: 3,
  },
  {
    type: 'account_error_ratio',
    group: 'account',
    recommendedOperator: '>',
    recommendedThreshold: 30,
    unit: '%',
  },
  {
    type: 'overload_account_count',
    group: 'account',
    recommendedOperator: '>',
    recommendedThreshold: 3,
  },
]

const OPERATORS: Operator[] = ['>', '>=', '<', '<=', '==', '!=']

const METRIC_KEY_MAP: Record<string, string> = {
  success_rate: 'successRate',
  error_rate: 'errorRate',
  upstream_error_rate: 'upstreamErrorRate',
  cpu_usage_percent: 'cpu',
  memory_usage_percent: 'memory',
  concurrency_queue_depth: 'queueDepth',
  group_available_accounts: 'groupAvailableAccounts',
  group_available_ratio: 'groupAvailableRatio',
  group_rate_limit_ratio: 'groupRateLimitRatio',
  account_rate_limited_count: 'accountRateLimitedCount',
  account_error_count: 'accountErrorCount',
  account_error_ratio: 'accountErrorRatio',
  overload_account_count: 'overloadAccountCount',
}

function getMetricI18nKey(type: string) {
  return METRIC_KEY_MAP[type] ?? type
}

interface RuleFormValues {
  name: string
  description: string
  metric_type: MetricType
  operator: Operator
  threshold: number
  window_minutes: number
  sustained_minutes: number
  severity: string
  cooldown_minutes: number
  enabled: boolean
  notify_email: boolean
  group_id: number | null
}

const DEFAULT_FORM_VALUES: RuleFormValues = {
  name: '',
  description: '',
  metric_type: 'error_rate',
  operator: '>',
  threshold: 5,
  window_minutes: 5,
  sustained_minutes: 1,
  severity: 'warning',
  cooldown_minutes: 5,
  enabled: true,
  notify_email: true,
  group_id: null,
}

export function OpsAlertRulesDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const showSuccess = useAppStore((s) => s.showSuccess)
  const showError = useAppStore((s) => s.showError)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const {
    data: rules,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['ops', 'alertRules'],
    queryFn: () => opsAPI.listAlertRules(),
    enabled: open,
  })

  const { data: groups } = useQuery({
    queryKey: ['admin', 'groups'],
    queryFn: () => adminAPI.groups.getAll(),
    enabled: open,
  })

  const sortedRules = [...(rules ?? [])].sort((a, b) => (b.id ?? 0) - (a.id ?? 0))

  // ==================== Form ====================

  const form = useForm({
    defaultValues: { ...DEFAULT_FORM_VALUES },
    onSubmit: async ({ value }) => {
      const metricDef = METRIC_DEFS.find((m) => m.type === value.metric_type)
      const isGroup = metricDef?.group === 'group'

      // Validate
      const errors: string[] = []
      if (!value.name.trim()) errors.push(t('admin.ops.alertRules.validation.nameRequired'))
      if (!value.metric_type) errors.push(t('admin.ops.alertRules.validation.metricRequired'))
      if (isGroup && !value.group_id) {
        errors.push(t('admin.ops.alertRules.validation.groupIdRequired'))
      }
      if (!value.operator) errors.push(t('admin.ops.alertRules.validation.operatorRequired'))
      if (!Number.isFinite(value.threshold)) {
        errors.push(t('admin.ops.alertRules.validation.thresholdRequired'))
      }
      if (![1, 5, 60].includes(value.window_minutes)) {
        errors.push(t('admin.ops.alertRules.validation.windowRange'))
      }
      if (value.sustained_minutes < 1 || value.sustained_minutes > 1440) {
        errors.push(t('admin.ops.alertRules.validation.sustainedRange'))
      }
      if (value.cooldown_minutes < 0 || value.cooldown_minutes > 1440) {
        errors.push(t('admin.ops.alertRules.validation.cooldownRange'))
      }

      if (errors.length > 0) {
        setValidationErrors(errors)
        return
      }
      setValidationErrors([])

      // Build payload
      const payload: AlertRule = {
        name: value.name,
        description: value.description,
        enabled: value.enabled,
        metric_type: value.metric_type,
        operator: value.operator,
        threshold: value.threshold,
        window_minutes: value.window_minutes,
        sustained_minutes: value.sustained_minutes,
        severity: value.severity,
        cooldown_minutes: value.cooldown_minutes,
        notify_email: value.notify_email,
        filters: value.group_id ? { group_id: value.group_id } : {},
      }

      saveMutation.mutate(payload)
    },
  })

  const { Field } = form

  const currentMetricType = form.state.values.metric_type
  const selectedMetricDef = METRIC_DEFS.find((m) => m.type === currentMetricType)
  const isGroupMetric = selectedMetricDef?.group === 'group'

  // ==================== CRUD ====================

  const saveMutation = useMutation({
    mutationFn: async (payload: AlertRule) => {
      if (editingId != null) {
        await opsAPI.updateAlertRule(editingId, payload)
      } else {
        await opsAPI.createAlertRule(payload)
      }
    },
    onSuccess: () => {
      showSuccess(t('admin.ops.alertRules.saveSuccess'))
      queryClient.invalidateQueries({ queryKey: ['ops', 'alertRules'] })
      setEditorOpen(false)
    },
    onError: () => {
      showError(t('admin.ops.alertRules.saveFailed'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => opsAPI.deleteAlertRule(id),
    onSuccess: () => {
      showSuccess(t('admin.ops.alertRules.deleteSuccess'))
      queryClient.invalidateQueries({ queryKey: ['ops', 'alertRules'] })
      setDeleteConfirmId(null)
    },
    onError: () => {
      showError(t('admin.ops.alertRules.deleteFailed'))
    },
  })

  const openCreate = () => {
    setEditingId(null)
    form.reset({ ...DEFAULT_FORM_VALUES })
    setValidationErrors([])
    setEditorOpen(true)
  }

  const openEdit = (rule: AlertRule) => {
    setEditingId(rule.id ?? null)
    form.reset({
      name: rule.name ?? '',
      description: rule.description ?? '',
      metric_type: rule.metric_type ?? 'error_rate',
      operator: (rule.operator ?? '>') as Operator,
      threshold: rule.threshold ?? 0,
      window_minutes: rule.window_minutes ?? 5,
      sustained_minutes: rule.sustained_minutes ?? 1,
      severity: rule.severity ?? 'warning',
      cooldown_minutes: rule.cooldown_minutes ?? 5,
      enabled: rule.enabled ?? true,
      notify_email: rule.notify_email ?? true,
      group_id: (rule.filters?.group_id as number) ?? null,
    })
    setValidationErrors([])
    setEditorOpen(true)
  }

  // When metric type changes in create mode, apply recommended values
  useEffect(() => {
    if (selectedMetricDef && !editingId) {
      form.setFieldValue('operator', selectedMetricDef.recommendedOperator)
      form.setFieldValue('threshold', selectedMetricDef.recommendedThreshold)
    }
  }, [currentMetricType, selectedMetricDef, editingId, form])

  return (
    <>
      {/* Main rules list dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] w-full flex-col sm:max-w-3xl md:max-w-4xl lg:max-w-5xl">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <div>
                <DialogTitle className="text-sm">{t('admin.ops.alertRules.title')}</DialogTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('admin.ops.alertRules.description')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => void refetch()}
                >
                  <RefreshIcon className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={openCreate}>
                  {t('admin.ops.alertRules.create')}
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto">
            {isLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {t('admin.ops.alertRules.loading')}
              </div>
            ) : sortedRules.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {t('admin.ops.alertRules.empty')}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.ops.alertRules.table.name')}</TableHead>
                    <TableHead>{t('admin.ops.alertRules.table.metric')}</TableHead>
                    <TableHead>{t('admin.ops.alertRules.table.severity')}</TableHead>
                    <TableHead>{t('admin.ops.alertRules.table.enabled')}</TableHead>
                    <TableHead>{t('admin.ops.alertRules.table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div className="text-xs font-bold">{rule.name}</div>
                        {rule.description && (
                          <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                            {rule.description}
                          </div>
                        )}
                        {rule.updated_at && (
                          <div className="mt-1 text-[10px] text-gray-400">
                            {new Date(rule.updated_at).toLocaleString()}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {t(
                          `admin.ops.alertRules.metrics.${getMetricI18nKey(rule.metric_type)}`,
                          rule.metric_type,
                        )}{' '}
                        {rule.operator} {rule.threshold}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            rule.severity === 'critical'
                              ? 'destructive'
                              : rule.severity === 'warning'
                                ? 'outline'
                                : 'secondary'
                          }
                          className="text-[10px]"
                        >
                          {rule.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={rule.enabled ? 'secondary' : 'outline'}
                          className="text-[10px]"
                        >
                          {rule.enabled
                            ? t('common.enabled', 'Enabled')
                            : t('common.disabled', 'Disabled')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="xs"
                            className="h-auto px-2 py-0.5 text-[10px]"
                            onClick={() => openEdit(rule)}
                          >
                            {t('common.edit', 'Edit')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="h-auto px-2 py-0.5 text-[10px] text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirmId(rule.id ?? null)}
                          >
                            {t('common.delete', 'Delete')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="flex max-h-[90vh] w-full flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editingId != null
                ? t('admin.ops.alertRules.editTitle')
                : t('admin.ops.alertRules.createTitle')}
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              form.handleSubmit()
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-auto pr-1">
              {validationErrors.length > 0 && (
                <div className="rounded-lg bg-red-50 p-3 text-xs text-red-800 dark:bg-red-900/20 dark:text-red-300">
                  <p className="mb-1 font-bold">{t('admin.ops.alertRules.validation.title')}</p>
                  <ul className="list-inside list-disc space-y-0.5">
                    {validationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Name */}
                <Field name="name">
                  {(field) => (
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs">{t('admin.ops.alertRules.form.name')}</Label>
                      <Input
                        className="h-8 text-xs"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                    </div>
                  )}
                </Field>

                {/* Description */}
                <Field name="description">
                  {(field) => (
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs">
                        {t('admin.ops.alertRules.form.description')}
                      </Label>
                      <Input
                        className="h-8 text-xs"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                    </div>
                  )}
                </Field>

                {/* Metric */}
                <Field name="metric_type">
                  {(field) => (
                    <div className="space-y-1">
                      <Label className="text-xs">{t('admin.ops.alertRules.form.metric')}</Label>
                      <Select
                        value={field.state.value}
                        onValueChange={(v) => field.handleChange(v as MetricType)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(['system', 'group', 'account'] as const).map((group) => (
                            <div key={group}>
                              <div className="px-2 py-1 text-[10px] font-bold uppercase text-gray-400">
                                {t(`admin.ops.alertRules.metricGroups.${group}`)}
                              </div>
                              {METRIC_DEFS.filter((m) => m.group === group).map((m) => (
                                <SelectItem key={m.type} value={m.type} className="text-xs">
                                  {t(
                                    `admin.ops.alertRules.metrics.${getMetricI18nKey(m.type)}`,
                                    m.type,
                                  )}
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedMetricDef && (
                        <div className="mt-1 space-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                          <p>
                            {t('admin.ops.alertRules.hints.recommended', {
                              operator: selectedMetricDef.recommendedOperator,
                              threshold: selectedMetricDef.recommendedThreshold,
                              unit: selectedMetricDef.unit ?? '',
                            })}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </Field>

                {/* Operator */}
                <Field name="operator">
                  {(field) => (
                    <div className="space-y-1">
                      <Label className="text-xs">{t('admin.ops.alertRules.form.operator')}</Label>
                      <Select
                        value={field.state.value}
                        onValueChange={(v) => field.handleChange(v as Operator)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OPERATORS.map((op) => (
                            <SelectItem key={op} value={op}>
                              {op}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </Field>

                {/* Group ID (for group-level metrics) */}
                <Field name="group_id">
                  {(field) => (
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs">
                        {t('admin.ops.alertRules.form.groupId')}
                        {isGroupMetric && <span className="text-red-500"> *</span>}
                      </Label>
                      <Select
                        value={field.state.value != null ? String(field.state.value) : 'all'}
                        onValueChange={(v) => field.handleChange(v === 'all' ? null : Number(v))}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue
                            placeholder={t('admin.ops.alertRules.form.groupPlaceholder')}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            {t('admin.ops.alertRules.form.allGroups')}
                          </SelectItem>
                          {(groups ?? []).map((g) => (
                            <SelectItem key={g.id} value={String(g.id)}>
                              {g.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {isGroupMetric
                          ? t('admin.ops.alertRules.hints.groupRequired')
                          : t(
                              'admin.ops.alertRules.hints.groupOptional',
                              'Optional: filter by group',
                            )}
                      </p>
                    </div>
                  )}
                </Field>

                {/* Threshold */}
                <Field name="threshold">
                  {(field) => (
                    <div className="space-y-1">
                      <Label className="text-xs">{t('admin.ops.alertRules.form.threshold')}</Label>
                      <Input
                        type="number"
                        className="h-8 text-xs"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(Number(e.target.value))}
                        onBlur={field.handleBlur}
                      />
                    </div>
                  )}
                </Field>

                {/* Severity */}
                <Field name="severity">
                  {(field) => (
                    <div className="space-y-1">
                      <Label className="text-xs">{t('admin.ops.alertRules.form.severity')}</Label>
                      <Select
                        value={field.state.value}
                        onValueChange={(v) => field.handleChange(v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="critical">P0 - Critical</SelectItem>
                          <SelectItem value="warning">P1 - Warning</SelectItem>
                          <SelectItem value="info">P2 - Info</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </Field>

                {/* Window */}
                <Field name="window_minutes">
                  {(field) => (
                    <div className="space-y-1">
                      <Label className="text-xs">{t('admin.ops.alertRules.form.window')}</Label>
                      <Select
                        value={String(field.state.value)}
                        onValueChange={(v) => field.handleChange(Number(v))}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 min</SelectItem>
                          <SelectItem value="5">5 min</SelectItem>
                          <SelectItem value="60">60 min</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </Field>

                {/* Sustained */}
                <Field name="sustained_minutes">
                  {(field) => (
                    <div className="space-y-1">
                      <Label className="text-xs">{t('admin.ops.alertRules.form.sustained')}</Label>
                      <Input
                        type="number"
                        min={1}
                        max={1440}
                        className="h-8 text-xs"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(Number(e.target.value))}
                        onBlur={field.handleBlur}
                      />
                    </div>
                  )}
                </Field>

                {/* Cooldown */}
                <Field name="cooldown_minutes">
                  {(field) => (
                    <div className="space-y-1">
                      <Label className="text-xs">{t('admin.ops.alertRules.form.cooldown')}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={1440}
                        className="h-8 text-xs"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(Number(e.target.value))}
                        onBlur={field.handleBlur}
                      />
                    </div>
                  )}
                </Field>

                {/* Enabled */}
                <Field name="enabled">
                  {(field) => (
                    <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 dark:bg-dark-800/50 md:col-span-2">
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                        {t('admin.ops.alertRules.form.enabled')}
                      </span>
                      <Switch
                        checked={field.state.value}
                        onCheckedChange={(v) => field.handleChange(v)}
                      />
                    </div>
                  )}
                </Field>

                {/* Notify Email */}
                <Field name="notify_email">
                  {(field) => (
                    <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 dark:bg-dark-800/50 md:col-span-2">
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                        {t('admin.ops.alertRules.form.notifyEmail')}
                      </span>
                      <Switch
                        checked={field.state.value}
                        onCheckedChange={(v) => field.handleChange(v)}
                      />
                    </div>
                  )}
                </Field>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditorOpen(false)}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="submit" size="sm" disabled={saveMutation.isPending}>
                {saveMutation.isPending
                  ? t('common.saving', 'Saving...')
                  : t('common.save', 'Save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmId != null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {t('admin.ops.alertRules.deleteConfirmTitle')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {t('admin.ops.alertRules.deleteConfirmMessage')}
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => deleteConfirmId != null && deleteMutation.mutate(deleteConfirmId)}
            >
              {t('common.delete', 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
