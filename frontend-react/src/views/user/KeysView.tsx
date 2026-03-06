import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { type ColumnDef, type RowSelectionState } from '@tanstack/react-table'
import { useAppStore } from '@/stores/app'
import { keysAPI } from '@/api/keys'
import { usageAPI, type BatchApiKeysUsageResponse } from '@/api/usage'
import { userGroupsAPI } from '@/api/groups'
import type { ApiKey, Group } from '@/types'
import { ClipboardIcon, CheckIcon, PlusIcon, TrashIcon, RefreshIcon } from '@/components/icons'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable, ColumnSettings } from '@/components/data-table'
import { useDataTableQuery, useTableMutation, extractErrorMessage, type ColumnMeta } from '@/hooks/useDataTableQuery'

// ==================== Helpers ====================

function maskKey(key: string): string {
  if (key.length <= 12) return key
  return key.slice(0, 8) + '...' + key.slice(-4)
}

function formatCost(c: number): string {
  if (c >= 1000) return (c / 1000).toFixed(2) + 'K'
  if (c >= 1) return c.toFixed(2)
  if (c >= 0.01) return c.toFixed(3)
  return c.toFixed(4)
}

function formatDate(d: string | null): string {
  if (!d) return '-'
  return new Date(d).toLocaleString()
}

function statusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'inactive':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
    case 'quota_exhausted':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'expired':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
}

// ==================== Query Keys ====================

const KEYS_QUERY_KEY = ['user', 'keys']

const KEYS_COLUMN_META: ColumnMeta[] = [
  { id: 'name', label: 'Name' },
  { id: 'key', label: 'Key' },
  { id: 'group_id', label: 'Group' },
  { id: 'usage', label: 'Usage' },
  { id: 'expires_at', label: 'Expires' },
  { id: 'status', label: 'Status' },
  { id: 'last_used_at', label: 'Last Used' },
  { id: 'created_at', label: 'Created' },
]

// ==================== Component ====================

export default function KeysView() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)

  // Data table query (no filters — API doesn't support them)
  const {
    data: keys,
    pagination,
    isLoading,
    setPage,
    refresh,
    columnOrder,
    columnVisibility,
    columnSizing,
    columnSettingItems,
    setColumnOrder,
    setColumnVisibility,
    setColumnSizing,
    resetColumnSettings,
  } = useDataTableQuery<ApiKey, Record<string, never>>({
    queryKey: KEYS_QUERY_KEY,
    queryFn: (page, pageSize, _filters, options) => keysAPI.list(page, pageSize, options),
    pageSize: 10,
    tableKey: 'user-keys',
    columnMeta: KEYS_COLUMN_META,
  })

  // Batch usage stats — depends on keys data
  const { data: usageData } = useQuery<BatchApiKeysUsageResponse>({
    queryKey: ['user', 'keys-usage', keys.map((k) => k.id)],
    queryFn: () => usageAPI.getDashboardApiKeysUsage(keys.map((k) => k.id)),
    enabled: keys.length > 0,
  })
  const usageStats = usageData?.stats ?? {}

  // Available groups
  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ['user', 'groups', 'available'],
    queryFn: () => userGroupsAPI.getAvailable(),
  })

  // Row selection
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const selectedCount = Object.keys(rowSelection).length

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  // Manual loading states for create/edit (form-based)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)

  // Create dialog toggle states
  const [createUseCustomKey, setCreateUseCustomKey] = useState(false)
  const [createUseIpRestriction, setCreateUseIpRestriction] = useState(false)
  const [createUseExpiration, setCreateUseExpiration] = useState(false)
  const [createExpirationDate, setCreateExpirationDate] = useState('')

  // Edit dialog toggle states
  const [editUseIpRestriction, setEditUseIpRestriction] = useState(false)
  const [editUseExpiration, setEditUseExpiration] = useState(false)
  const [editExpirationDate, setEditExpirationDate] = useState('')

  // Mutations
  const deleteMutation = useTableMutation<number>({
    mutationFn: (id) => keysAPI.delete(id),
    queryKey: KEYS_QUERY_KEY,
    onSuccess: () => {
      showSuccess(t('keys.deleted', 'API key deleted'))
      setShowDeleteDialog(false)
      setSelectedKey(null)
    },
    onError: (err) =>
      showError(extractErrorMessage(err, t('keys.deleteFailed', 'Failed to delete API key'))),
  })

  const toggleStatusMutation = useTableMutation<{ id: number; status: 'active' | 'inactive' }>({
    mutationFn: ({ id, status }) => keysAPI.toggleStatus(id, status),
    queryKey: KEYS_QUERY_KEY,
    onSuccess: () => showSuccess(t('keys.statusUpdated', 'Status updated')),
    onError: (err) =>
      showError(extractErrorMessage(err, t('keys.statusUpdateFailed', 'Failed to update status'))),
  })

  const bulkDeleteMutation = useTableMutation({
    mutationFn: async (ids: number[]) => {
      let failed = 0
      for (const id of ids) {
        try {
          await keysAPI.delete(id)
        } catch {
          failed++
        }
      }
      return { total: ids.length, failed }
    },
    queryKey: KEYS_QUERY_KEY,
    onSuccess: (result) => {
      if (result.failed > 0) {
        showError(`${result.failed} key(s) failed to delete`)
      } else {
        showSuccess(`${result.total} key(s) deleted`)
      }
      setRowSelection({})
      setShowBulkDeleteDialog(false)
    },
    onError: (err) => {
      showError(extractErrorMessage(err))
      setRowSelection({})
      setShowBulkDeleteDialog(false)
    },
  })

  // Forms
  const createForm = useForm({
    defaultValues: {
      name: '',
      groupId: null as number | null,
      quota: 0,
      customKey: '',
      ipWhitelist: '',
      ipBlacklist: '',
    },
  })

  const editForm = useForm({
    defaultValues: {
      name: '',
      groupId: null as number | null,
      status: 'active' as 'active' | 'inactive',
      quota: 0,
      ipWhitelist: '',
      ipBlacklist: '',
    },
  })

  const { Field: CreateForm_Field } = createForm
  const { Field: EditForm_Field } = editForm

  // Helpers
  const getGroupName = (groupId: number | null): string => {
    if (!groupId) return t('keys.default', 'Default')
    const group = groups.find((g) => g.id === groupId)
    return group?.name || `#${groupId}`
  }

  const copyToClipboard = async (key: ApiKey) => {
    try {
      await navigator.clipboard.writeText(key.key)
      setCopiedId(key.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      showError(t('keys.copyFailed', 'Failed to copy key'))
    }
  }

  // Helpers for expiration date <-> days conversion
  const setExpirationPreset = (days: number, setter: (v: string) => void) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    // datetime-local format: YYYY-MM-DDTHH:MM
    setter(d.toISOString().slice(0, 16))
  }

  const expirationDateToApiDays = (dateStr: string): number | undefined => {
    if (!dateStr) return undefined
    const ms = new Date(dateStr).getTime() - Date.now()
    const days = Math.ceil(ms / 86400000)
    return days > 0 ? days : undefined
  }

  const expirationDateToIso = (dateStr: string): string | null => {
    if (!dateStr) return null
    return new Date(dateStr).toISOString()
  }

  // Create handler (manual async — form-based)
  const handleCreate = async () => {
    const values = createForm.store.state.values
    if (!values.name.trim()) {
      showError(t('keys.nameRequired', 'Key name is required'))
      return
    }
    setCreating(true)
    try {
      await keysAPI.create(
        values.name.trim(),
        values.groupId,
        createUseCustomKey && values.customKey.trim() ? values.customKey.trim() : undefined,
        createUseIpRestriction && values.ipWhitelist.trim()
          ? values.ipWhitelist.trim().split('\n').map((s) => s.trim()).filter(Boolean)
          : undefined,
        createUseIpRestriction && values.ipBlacklist.trim()
          ? values.ipBlacklist.trim().split('\n').map((s) => s.trim()).filter(Boolean)
          : undefined,
        values.quota > 0 ? values.quota : undefined,
        createUseExpiration ? expirationDateToApiDays(createExpirationDate) : undefined,
      )
      showSuccess(t('keys.keyCreatedSuccess', 'API key created successfully'))
      setShowCreateDialog(false)
      createForm.reset()
      setCreateUseCustomKey(false)
      setCreateUseIpRestriction(false)
      setCreateUseExpiration(false)
      setCreateExpirationDate('')
      refresh()
    } catch (err: unknown) {
      showError(
        extractErrorMessage(err as Error, t('keys.createFailed', 'Failed to create API key')),
      )
    } finally {
      setCreating(false)
    }
  }

  // Edit handler (manual async — form-based)
  const openEdit = (key: ApiKey) => {
    setSelectedKey(key)
    const hasIp = (key.ip_whitelist?.length ?? 0) > 0 || (key.ip_blacklist?.length ?? 0) > 0
    const hasExpiry = !!key.expires_at
    setEditUseIpRestriction(hasIp)
    setEditUseExpiration(hasExpiry)
    setEditExpirationDate(hasExpiry ? new Date(key.expires_at!).toISOString().slice(0, 16) : '')
    editForm.reset({
      name: key.name,
      groupId: key.group_id,
      status: key.status === 'active' ? 'active' : 'inactive',
      quota: key.quota,
      ipWhitelist: (key.ip_whitelist || []).join('\n'),
      ipBlacklist: (key.ip_blacklist || []).join('\n'),
    })
    setShowEditDialog(true)
  }

  const handleEdit = async () => {
    if (!selectedKey) return
    const values = editForm.store.state.values
    setSaving(true)
    try {
      await keysAPI.update(selectedKey.id, {
        name: values.name.trim(),
        group_id: values.groupId,
        status: values.status,
        quota: values.quota,
        ip_whitelist: editUseIpRestriction && values.ipWhitelist.trim()
          ? values.ipWhitelist.trim().split('\n').map((s: string) => s.trim()).filter(Boolean)
          : [],
        ip_blacklist: editUseIpRestriction && values.ipBlacklist.trim()
          ? values.ipBlacklist.trim().split('\n').map((s: string) => s.trim()).filter(Boolean)
          : [],
        expires_at: editUseExpiration ? expirationDateToIso(editExpirationDate) : null,
      })
      showSuccess(t('keys.updated', 'API key updated'))
      setShowEditDialog(false)
      refresh()
    } catch (err: unknown) {
      showError(
        extractErrorMessage(err as Error, t('keys.updateFailed', 'Failed to update API key')),
      )
    } finally {
      setSaving(false)
    }
  }

  // ==================== Column Definitions ====================

  const columns: ColumnDef<ApiKey>[] = [
    {
      accessorKey: 'name',
      header: () => t('keys.name', 'Name'),
      cell: ({ row }) => {
        const key = row.original
        return (
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{key.name}</div>
            {key.expires_at && (
              <div className="text-xs text-gray-400 dark:text-gray-500">
                {t('keys.expires', 'Expires')}: {formatDate(key.expires_at)}
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'key',
      header: () => t('keys.key', 'Key'),
      cell: ({ row }) => {
        const key = row.original
        return (
          <div className="flex items-center gap-2">
            <code className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-dark-700 dark:text-gray-300">
              {maskKey(key.key)}
            </code>
            <button
              onClick={() => copyToClipboard(key)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title={t('keys.copy', 'Copy')}
            >
              {copiedId === key.id ? (
                <CheckIcon className="h-4 w-4 text-green-500" />
              ) : (
                <ClipboardIcon className="h-4 w-4" />
              )}
            </button>
          </div>
        )
      },
    },
    {
      accessorKey: 'group_id',
      header: () => t('keys.group', 'Group'),
      cell: ({ row }) => (
        <span className="text-gray-600 dark:text-gray-400">
          {getGroupName(row.original.group_id)}
        </span>
      ),
    },
    {
      id: 'usage',
      header: () => t('keys.usage', 'Usage'),
      cell: ({ row }) => {
        const key = row.original
        const usage = usageStats[String(key.id)]
        return (
          <div className="text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 dark:text-gray-400">{t('keys.today', 'Today')}:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                ${formatCost(usage?.today_actual_cost || 0)}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="text-gray-500 dark:text-gray-400">{t('keys.total', 'Total')}:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                ${formatCost(usage?.total_actual_cost || 0)}
              </span>
            </div>
            {key.quota > 0 && (
              <div className="mt-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400">{t('keys.quota', 'Quota')}:</span>
                  <span className={key.quota_used >= key.quota ? 'font-medium text-red-500' : key.quota_used >= key.quota * 0.8 ? 'font-medium text-amber-500' : 'font-medium text-gray-900 dark:text-white'}>
                    ${formatCost(key.quota_used)} / ${formatCost(key.quota)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-dark-600">
                  <div
                    className={`h-full rounded-full transition-all ${key.quota_used >= key.quota ? 'bg-red-500' : key.quota_used >= key.quota * 0.8 ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min((key.quota_used / key.quota) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'expires_at',
      header: () => t('keys.expiresAt', 'Expires'),
      cell: ({ row }) => {
        const val = row.original.expires_at
        if (!val) {
          return <span className="text-sm text-gray-400 dark:text-gray-500">{t('keys.noExpiration', 'Never')}</span>
        }
        const isExpired = new Date(val) < new Date()
        return (
          <span className={`text-sm ${isExpired ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
            {formatDate(val)}
          </span>
        )
      },
    },
    {
      accessorKey: 'status',
      header: () => t('common.status', 'Status'),
      cell: ({ row }) => {
        const key = row.original
        return (
          <button
            onClick={() =>
              toggleStatusMutation.mutate({
                id: key.id,
                status: key.status === 'active' ? 'inactive' : 'active',
              })
            }
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(key.status)}`}
          >
            {t(`keys.status.${key.status}`, key.status)}
          </button>
        )
      },
    },
    {
      accessorKey: 'last_used_at',
      header: () => t('keys.lastUsedAt', 'Last Used'),
      cell: ({ row }) => {
        const val = row.original.last_used_at
        return val
          ? <span className="text-sm text-gray-500 dark:text-gray-400">{formatDate(val)}</span>
          : <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
      },
    },
    {
      accessorKey: 'created_at',
      header: () => t('keys.created', 'Created'),
      cell: ({ row }) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {formatDate(row.original.created_at)}
        </span>
      ),
    },
  ]

  function renderRowActions(key: ApiKey) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="sm" onClick={() => openEdit(key)}>
          {t('common.edit', 'Edit')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-red-500 hover:text-red-700"
          onClick={() => {
            setSelectedKey(key)
            setShowDeleteDialog(true)
          }}
        >
          <TrashIcon className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  // ==================== Render ====================

  return (
    <div className="space-y-6">
      {/* Filters & Actions */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {selectedCount > 0 && (
          <Button variant="destructive" size="sm" onClick={() => setShowBulkDeleteDialog(true)}>
            <TrashIcon className="h-4 w-4 mr-1" />
            {t('common.delete', 'Delete')} ({selectedCount})
          </Button>
        )}
        <Button
          onClick={() => {
            createForm.reset()
            setShowCreateDialog(true)
          }}
        >
          <PlusIcon className="mr-2 h-4 w-4" />
          {t('keys.create', 'Create Key')}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={keys}
        loading={isLoading}
        pagination={pagination}
        onPageChange={setPage}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        getRowId={(row) => String(row.id)}
        columnOrder={columnOrder}
        columnVisibility={columnVisibility}
        columnSizing={columnSizing}
        onColumnSizingChange={setColumnSizing}
        renderRowActions={renderRowActions}
        actionsColumnSize={120}
        spreadsheetTitle="API Keys"
        toolbar={
          <>
            <Button variant="ghost" size="icon-xs" onClick={refresh} title={t('common.refresh', 'Refresh')}>
              <RefreshIcon className="h-4 w-4" />
            </Button>
            <ColumnSettings
              columns={columnSettingItems}
              columnOrder={columnOrder}
              onColumnOrderChange={setColumnOrder}
              onVisibilityChange={setColumnVisibility}
              onReset={resetColumnSettings}
            />
          </>
        }
      />

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open)
        if (!open) {
          createForm.reset()
          setCreateUseCustomKey(false)
          setCreateUseIpRestriction(false)
          setCreateUseExpiration(false)
          setCreateExpirationDate('')
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('keys.createTitle', 'Create API Key')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Name */}
            <CreateForm_Field name="name">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('keys.name', 'Name')} *</Label>
                  <Input
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t('keys.namePlaceholder', 'My API Key')}
                  />
                </div>
              )}
            </CreateForm_Field>

            {/* Group */}
            <CreateForm_Field name="groupId">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('keys.group', 'Group')}</Label>
                  <Select
                    value={String(field.state.value ?? '__none__')}
                    onValueChange={(v) => field.handleChange(v === '__none__' ? null : Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('keys.default', 'Default')} />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="__none__">{t('keys.default', 'Default')}</SelectItem>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CreateForm_Field>

            {/* Quota */}
            <CreateForm_Field name="quota">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('keys.quotaLimit', 'Quota Limit')} (USD)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <Input
                      type="number"
                      className="pl-7"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(parseFloat(e.target.value) || 0)}
                      min={0}
                      step={0.01}
                      placeholder={t('keys.quotaAmountPlaceholder', 'Enter quota limit in USD')}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('keys.quotaAmountHint', 'Set the maximum amount this key can spend. 0 = unlimited.')}</p>
                </div>
              )}
            </CreateForm_Field>

            {/* Custom Key — toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="mb-0">{t('keys.customKeyLabel', 'Custom Key')}</Label>
                <Switch
                  checked={createUseCustomKey}
                  onCheckedChange={setCreateUseCustomKey}
                />
              </div>
              {createUseCustomKey && (
                <CreateForm_Field name="customKey">
                  {(field) => (
                    <div className="space-y-1">
                      <Input
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder={t('keys.customKeyPlaceholder', 'Leave empty for auto-generated')}
                        className="font-mono"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('keys.customKeyHint', 'Only letters, numbers, underscores and hyphens allowed. Minimum 16 characters.')}</p>
                    </div>
                  )}
                </CreateForm_Field>
              )}
            </div>

            {/* IP Restriction — toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="mb-0">{t('keys.ipRestriction', 'IP Restriction')}</Label>
                <Switch
                  checked={createUseIpRestriction}
                  onCheckedChange={setCreateUseIpRestriction}
                />
              </div>
              {createUseIpRestriction && (
                <div className="space-y-4 pt-1">
                  <CreateForm_Field name="ipWhitelist">
                    {(field) => (
                      <div className="space-y-1">
                        <Label>{t('keys.ipWhitelist', 'IP Whitelist')}</Label>
                        <Textarea
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          rows={3}
                          placeholder={t('keys.ipWhitelistPlaceholder', '192.168.1.100\n10.0.0.0/8')}
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('keys.ipWhitelistHint', 'One IP or CIDR per line. Only these IPs can use this key when set.')}</p>
                      </div>
                    )}
                  </CreateForm_Field>
                  <CreateForm_Field name="ipBlacklist">
                    {(field) => (
                      <div className="space-y-1">
                        <Label>{t('keys.ipBlacklist', 'IP Blacklist')}</Label>
                        <Textarea
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          rows={3}
                          placeholder={t('keys.ipBlacklistPlaceholder', '1.2.3.4\n5.6.0.0/16')}
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('keys.ipBlacklistHint', 'One IP or CIDR per line. These IPs will be blocked from using this key.')}</p>
                      </div>
                    )}
                  </CreateForm_Field>
                </div>
              )}
            </div>

            {/* Expiration — toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="mb-0">{t('keys.expiration', 'Expiration')}</Label>
                <Switch
                  checked={createUseExpiration}
                  onCheckedChange={setCreateUseExpiration}
                />
              </div>
              {createUseExpiration && (
                <div className="space-y-3 pt-1">
                  <div className="flex flex-wrap gap-2">
                    {(['7', '30', '90'] as const).map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setExpirationPreset(Number(days), setCreateExpirationDate)}
                        className="rounded-lg px-3 py-1.5 text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-dark-700 dark:text-gray-400 dark:hover:bg-dark-600 transition-colors"
                      >
                        {t('keys.expiresInDays', { days })}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <Label>{t('keys.expirationDate', 'Expiration Date')}</Label>
                    <Input
                      type="datetime-local"
                      value={createExpirationDate}
                      onChange={(e) => setCreateExpirationDate(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('keys.expirationDateHint', 'Select when this API key should expire.')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !createForm.store.state.values.name.trim()}
            >
              {creating ? (
                <span className="flex items-center gap-2">
                  <div className="spinner h-4 w-4" />
                  {t('common.creating', 'Creating...')}
                </span>
              ) : (
                t('common.create', 'Create')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('keys.editTitle', 'Edit API Key')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Name */}
            <EditForm_Field name="name">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('keys.name', 'Name')}</Label>
                  <Input
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </EditForm_Field>

            {/* Group + Status */}
            <div className="grid grid-cols-2 gap-5">
              <EditForm_Field name="groupId">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('keys.group', 'Group')}</Label>
                    <Select
                      value={String(field.state.value ?? '__none__')}
                      onValueChange={(v) => field.handleChange(v === '__none__' ? null : Number(v))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('keys.default', 'Default')} />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value="__none__">{t('keys.default', 'Default')}</SelectItem>
                        {groups.map((g) => (
                          <SelectItem key={g.id} value={String(g.id)}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </EditForm_Field>
              <EditForm_Field name="status">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('common.status', 'Status')}</Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(v) => field.handleChange(v as 'active' | 'inactive')}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value="active">{t('keys.status.active', 'Active')}</SelectItem>
                        <SelectItem value="inactive">
                          {t('keys.status.inactive', 'Inactive')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </EditForm_Field>
            </div>

            {/* Quota */}
            <EditForm_Field name="quota">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('keys.quotaLimit', 'Quota Limit')} (USD)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <Input
                      type="number"
                      className="pl-7"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(parseFloat(e.target.value) || 0)}
                      min={0}
                      step={0.01}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('keys.quotaAmountHint', 'Set the maximum amount this key can spend. 0 = unlimited.')}</p>
                </div>
              )}
            </EditForm_Field>

            {/* IP Restriction — toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="mb-0">{t('keys.ipRestriction', 'IP Restriction')}</Label>
                <Switch
                  checked={editUseIpRestriction}
                  onCheckedChange={setEditUseIpRestriction}
                />
              </div>
              {editUseIpRestriction && (
                <div className="space-y-4 pt-1">
                  <EditForm_Field name="ipWhitelist">
                    {(field) => (
                      <div className="space-y-1">
                        <Label>{t('keys.ipWhitelist', 'IP Whitelist')}</Label>
                        <Textarea
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          rows={3}
                          placeholder={t('keys.ipWhitelistPlaceholder', '192.168.1.100\n10.0.0.0/8')}
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('keys.ipWhitelistHint', 'One IP or CIDR per line. Only these IPs can use this key when set.')}</p>
                      </div>
                    )}
                  </EditForm_Field>
                  <EditForm_Field name="ipBlacklist">
                    {(field) => (
                      <div className="space-y-1">
                        <Label>{t('keys.ipBlacklist', 'IP Blacklist')}</Label>
                        <Textarea
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          rows={3}
                          placeholder={t('keys.ipBlacklistPlaceholder', '1.2.3.4\n5.6.0.0/16')}
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('keys.ipBlacklistHint', 'One IP or CIDR per line. These IPs will be blocked from using this key.')}</p>
                      </div>
                    )}
                  </EditForm_Field>
                </div>
              )}
            </div>

            {/* Expiration — toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="mb-0">{t('keys.expiration', 'Expiration')}</Label>
                <Switch
                  checked={editUseExpiration}
                  onCheckedChange={setEditUseExpiration}
                />
              </div>
              {editUseExpiration && (
                <div className="space-y-3 pt-1">
                  <div className="flex flex-wrap gap-2">
                    {(['7', '30', '90'] as const).map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setExpirationPreset(Number(days), setEditExpirationDate)}
                        className="rounded-lg px-3 py-1.5 text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-dark-700 dark:text-gray-400 dark:hover:bg-dark-600 transition-colors"
                      >
                        {t('keys.extendDays', { days })}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <Label>{t('keys.expirationDate', 'Expiration Date')}</Label>
                    <Input
                      type="datetime-local"
                      value={editExpirationDate}
                      onChange={(e) => setEditExpirationDate(e.target.value)}
                    />
                    {selectedKey?.expires_at && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t('keys.currentExpiration', 'Current expiration')}: {formatDate(selectedKey.expires_at)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? (
                <span className="flex items-center gap-2">
                  <div className="spinner h-4 w-4" />
                  {t('common.saving', 'Saving...')}
                </span>
              ) : (
                t('common.save', 'Save')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open)
          if (!open) setSelectedKey(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('keys.deleteTitle', 'Delete API Key')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('keys.deleteConfirm', 'Are you sure you want to delete this API key?')}
              <span className="mt-2 block font-medium text-foreground">{selectedKey?.name}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedKey && deleteMutation.mutate(selectedKey.id)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <div className="spinner h-4 w-4" />
                  {t('common.deleting', 'Deleting...')}
                </span>
              ) : (
                t('common.delete', 'Delete')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('keys.deleteTitle', 'Delete API Key')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('keys.bulkDeleteConfirm', 'Are you sure you want to delete')}{' '}
              <strong>{selectedCount}</strong> {t('keys.keysCount', 'key(s)')}?{' '}
              {t('common.cannotUndo', 'This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(Object.keys(rowSelection).map(Number))}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
