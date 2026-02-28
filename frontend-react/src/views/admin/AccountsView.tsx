import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from '@tanstack/react-form'
import { type ColumnDef, type RowSelectionState } from '@tanstack/react-table'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type {
  Account,
  AccountPlatform,
  AccountType,
  CreateAccountRequest,
  UpdateAccountRequest,
} from '@/types'
import { PlusIcon, TrashIcon, SearchIcon, RefreshIcon } from '@/components/icons'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTable } from '@/components/data-table'
import { useDataTableQuery, useTableMutation, extractErrorMessage } from '@/hooks/useDataTableQuery'

// ==================== Constants ====================

const ACCOUNTS_QUERY_KEY = ['admin', 'accounts']

const PLATFORMS: { value: AccountPlatform; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'antigravity', label: 'Antigravity' },
  { value: 'sora', label: 'Sora' },
]

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'oauth', label: 'OAuth' },
  { value: 'setup-token', label: 'Setup Token' },
  { value: 'apikey', label: 'API Key' },
  { value: 'upstream', label: 'Upstream' },
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'error', label: 'Error' },
]

// ==================== Types ====================

type AccountFilters = {
  platform?: string
  type?: string
  status?: string
  search?: string
}

// ==================== Helpers ====================

function platformBadgeClass(platform: string): string {
  const map: Record<string, string> = {
    anthropic: 'badge-purple',
    openai: 'badge-success',
    gemini: 'badge-primary',
    antigravity: 'badge-warning',
    sora: 'badge-danger',
  }
  return map[platform] || 'badge-gray'
}

function statusColor(status: string): string {
  if (status === 'active') return 'text-emerald-600 dark:text-emerald-400'
  if (status === 'error') return 'text-red-600 dark:text-red-400'
  return 'text-gray-500 dark:text-gray-400'
}

function statusDot(status: string): string {
  if (status === 'active') return 'bg-emerald-500'
  if (status === 'error') return 'bg-red-500'
  return 'bg-gray-400'
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

// ==================== Component ====================

export default function AccountsView() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)

  // Data table query
  const {
    data: accounts,
    pagination,
    isLoading,
    search,
    filters,
    setPage,
    setFilter,
    setSearch,
    refresh,
  } = useDataTableQuery<Account, AccountFilters>({
    queryKey: ACCOUNTS_QUERY_KEY,
    queryFn: (page, pageSize, filters, options) =>
      adminAPI.accounts.list(page, pageSize, filters, options),
  })

  // Row selection
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const selectedCount = Object.keys(rowSelection).length

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null)
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)

  // Testing
  const [testingId, setTestingId] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<{ id: number; message: string; success: boolean } | null>(null)

  // ==================== Mutations ====================

  const createMutation = useTableMutation({
    mutationFn: (req: CreateAccountRequest) => adminAPI.accounts.create(req),
    queryKey: ACCOUNTS_QUERY_KEY,
    onSuccess: () => {
      showSuccess(t('admin.accounts.created', 'Account created'))
      setShowCreateDialog(false)
      createForm.reset()
    },
    onError: (err) => {
      showError(extractErrorMessage(err, t('admin.accounts.createFailed', 'Failed to create')))
    },
  })

  const updateMutation = useTableMutation({
    mutationFn: ({ id, ...updates }: { id: number } & UpdateAccountRequest) =>
      adminAPI.accounts.update(id, updates),
    queryKey: ACCOUNTS_QUERY_KEY,
    onSuccess: () => {
      showSuccess(t('admin.accounts.updated', 'Account updated'))
      setShowEditDialog(false)
      setSelectedAccount(null)
    },
    onError: (err) => {
      showError(extractErrorMessage(err, t('admin.accounts.updateFailed', 'Failed to update')))
    },
  })

  const deleteMutation = useTableMutation({
    mutationFn: (id: number) => adminAPI.accounts.delete(id),
    queryKey: ACCOUNTS_QUERY_KEY,
    onSuccess: () => {
      showSuccess(t('admin.accounts.deleted', 'Account deleted'))
      setShowDeleteDialog(false)
      setDeleteTarget(null)
    },
    onError: (err) => {
      showError(extractErrorMessage(err, t('admin.accounts.deleteFailed', 'Failed to delete')))
    },
  })

  const bulkDeleteMutation = useTableMutation({
    mutationFn: async (ids: number[]) => {
      let failed = 0
      for (const id of ids) {
        try { await adminAPI.accounts.delete(id) } catch { failed++ }
      }
      return { total: ids.length, failed }
    },
    queryKey: ACCOUNTS_QUERY_KEY,
    onSuccess: (result) => {
      if (result.failed > 0) {
        showError(`${result.failed} account(s) failed to delete`)
      } else {
        showSuccess(t('admin.accounts.bulkDeleted', `${result.total} account(s) deleted`))
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

  const toggleSchedulableMutation = useTableMutation({
    mutationFn: ({ id, schedulable }: { id: number; schedulable: boolean }) =>
      adminAPI.accounts.setSchedulable(id, schedulable),
    queryKey: ACCOUNTS_QUERY_KEY,
    onError: (err) => {
      showError(extractErrorMessage(err, t('admin.accounts.toggleFailed', 'Failed to toggle schedulable')))
    },
  })

  // ==================== Actions ====================

  const handleTest = async (id: number) => {
    setTestingId(id)
    setTestResult(null)
    try {
      const result = await adminAPI.accounts.testAccount(id)
      setTestResult({ id, message: result.message + (result.latency_ms ? ` (${result.latency_ms}ms)` : ''), success: result.success })
    } catch (err) {
      setTestResult({ id, message: extractErrorMessage(err as Error, 'Test failed'), success: false })
    } finally {
      setTestingId(null)
    }
  }

  // ==================== Forms ====================

  const createForm = useForm({
    defaultValues: {
      platform: 'anthropic' as AccountPlatform,
      type: 'oauth' as AccountType,
      name: '',
      credentials: '{}',
    },
    onSubmit: async ({ value }) => {
      if (!value.name.trim()) { showError(t('admin.accounts.nameRequired', 'Name is required')); return }
      let creds: Record<string, unknown> = {}
      try { creds = JSON.parse(value.credentials) } catch {
        showError(t('admin.accounts.invalidJson', 'Invalid JSON in credentials')); return
      }
      createMutation.mutate({ name: value.name.trim(), platform: value.platform, type: value.type, credentials: creds })
    },
  })

  const editForm = useForm({
    defaultValues: {
      name: '',
      status: 'active',
      schedulable: true,
      priority: 0,
      notes: '',
    },
    onSubmit: async ({ value }) => {
      if (!selectedAccount) return
      updateMutation.mutate({
        id: selectedAccount.id,
        name: value.name.trim(),
        status: value.status as 'active' | 'inactive',
        schedulable: value.schedulable,
        priority: value.priority,
        notes: value.notes,
      })
    },
  })

  const openEdit = (account: Account) => {
    setSelectedAccount(account)
    editForm.reset({
      name: account.name,
      status: account.status,
      schedulable: account.schedulable,
      priority: account.priority,
      notes: account.notes || '',
    })
    setShowEditDialog(true)
  }

  // ==================== Columns ====================

  const columns: ColumnDef<Account>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      size: 40,
    },
    {
      accessorKey: 'name',
      header: () => t('admin.accounts.columns.name', 'Name'),
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">{row.original.name}</div>
          {row.original.notes && <div className="text-xs text-gray-500 truncate max-w-[200px]">{row.original.notes}</div>}
        </div>
      ),
    },
    {
      id: 'platformType',
      header: () => t('admin.accounts.columns.platformType', 'Platform / Type'),
      cell: ({ row }) => (
        <div>
          <span className={`badge ${platformBadgeClass(row.original.platform)}`}>{row.original.platform}</span>
          <span className="badge badge-gray ml-1">{row.original.type}</span>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: () => t('admin.accounts.columns.status', 'Status'),
      cell: ({ row }) => (
        <div>
          <div className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${statusDot(row.original.status)}`} />
            <span className={statusColor(row.original.status)}>{t(`admin.accounts.status.${row.original.status}`, row.original.status)}</span>
          </div>
          {row.original.error_message && (
            <div className="text-xs text-red-500 truncate max-w-[150px]" title={row.original.error_message}>{row.original.error_message}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'schedulable',
      header: () => t('admin.accounts.columns.schedulable', 'Schedulable'),
      cell: ({ row }) => (
        <button
          onClick={() => toggleSchedulableMutation.mutate({ id: row.original.id, schedulable: !row.original.schedulable })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${row.original.schedulable ? 'bg-primary-500' : 'bg-gray-300 dark:bg-dark-600'}`}
        >
          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${row.original.schedulable ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      ),
    },
    {
      id: 'groups',
      header: () => t('admin.accounts.columns.groups', 'Groups'),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.groups && row.original.groups.length > 0
            ? row.original.groups.slice(0, 3).map((g) => <span key={g.id} className="badge badge-gray text-xs">{g.name}</span>)
            : row.original.group_ids && row.original.group_ids.length > 0
              ? <span className="text-xs text-gray-500">{row.original.group_ids.length} group(s)</span>
              : <span className="text-xs text-gray-400">-</span>}
        </div>
      ),
    },
    {
      id: 'proxy',
      header: () => t('admin.accounts.proxy', 'Proxy'),
      cell: ({ row }) => (
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {row.original.proxy ? (row.original.proxy.name || `${row.original.proxy.host}:${row.original.proxy.port}`) : '-'}
        </span>
      ),
    },
    {
      accessorKey: 'priority',
      header: () => t('admin.accounts.priority', 'Priority'),
      size: 80,
      cell: ({ row }) => <span className="text-center block">{row.original.priority}</span>,
    },
    {
      accessorKey: 'last_used_at',
      header: () => t('admin.accounts.lastUsed', 'Last Used'),
      cell: ({ row }) => (
        <span className="text-xs text-gray-500">{formatDate(row.original.last_used_at)}</span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="text-right block">{t('admin.accounts.actions', 'Actions')}</span>,
      cell: ({ row }) => {
        const account = row.original
        return (
          <div>
            <div className="flex items-center justify-end gap-1">
              <Button variant="ghost" size="sm" onClick={() => openEdit(account)}>{t('common.edit', 'Edit')}</Button>
              <Button
                variant="ghost" size="sm"
                onClick={() => handleTest(account.id)}
                disabled={testingId === account.id}
              >
                {testingId === account.id ? <span className="spinner h-3 w-3" /> : t('common.test', 'Test')}
              </Button>
              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => { setDeleteTarget(account); setShowDeleteDialog(true) }}>
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
            {testResult && testResult.id === account.id && (
              <div className={`text-xs mt-1 text-right ${testResult.success ? 'text-emerald-600' : 'text-red-500'}`}>{testResult.message}</div>
            )}
          </div>
        )
      },
    },
  ]

  // ==================== Render ====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">{t('admin.accounts.title', 'Accounts')}</h1>
          <p className="page-description">{t('admin.accounts.description', 'Manage cloud service accounts')}</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setShowBulkDeleteDialog(true)}>
              <TrashIcon className="h-4 w-4 mr-1" />
              {t('common.delete', 'Delete')} ({selectedCount})
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={refresh} title={t('common.refresh', 'Refresh')}>
            <RefreshIcon className="h-4 w-4" />
          </Button>
          <Button onClick={() => { createForm.reset(); setShowCreateDialog(true) }}>
            <PlusIcon className="h-4 w-4 mr-1" />
            {t('common.create', 'Create')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filters.platform ?? 'all'} onValueChange={(v) => setFilter('platform', v === 'all' ? undefined : v)}>
            <SelectTrigger className="w-auto text-sm"><SelectValue placeholder={t('admin.accounts.allPlatforms', 'All Platforms')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.accounts.allPlatforms', 'All Platforms')}</SelectItem>
              {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.type ?? 'all'} onValueChange={(v) => setFilter('type', v === 'all' ? undefined : v)}>
            <SelectTrigger className="w-auto text-sm"><SelectValue placeholder={t('admin.accounts.allTypes', 'All Types')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.accounts.allTypes', 'All Types')}</SelectItem>
              {ACCOUNT_TYPES.map((at) => <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.status ?? 'all'} onValueChange={(v) => setFilter('status', v === 'all' ? undefined : v)}>
            <SelectTrigger className="w-auto text-sm"><SelectValue placeholder={t('admin.accounts.allStatuses', 'All Statuses')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.accounts.allStatuses', 'All Statuses')}</SelectItem>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[200px]">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.accounts.searchPlaceholder', 'Search by name...')}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={accounts}
        loading={isLoading}
        pagination={pagination}
        onPageChange={setPage}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        getRowId={(row) => String(row.id)}
      />

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t('admin.accounts.createTitle', 'Create Account')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <createForm.Field name="platform">{(field) => (
              <div className="space-y-2">
                <Label>{t('admin.accounts.platform', 'Platform')}</Label>
                <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as AccountPlatform)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}</createForm.Field>
            <createForm.Field name="type">{(field) => (
              <div className="space-y-2">
                <Label>{t('admin.accounts.type', 'Type')}</Label>
                <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as AccountType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACCOUNT_TYPES.map((at) => <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}</createForm.Field>
            <createForm.Field name="name">{(field) => (
              <div className="space-y-2">
                <Label>{t('admin.accounts.columns.name', 'Name')} *</Label>
                <Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder="Account name" />
              </div>
            )}</createForm.Field>
            <createForm.Field name="credentials">{(field) => (
              <div className="space-y-2">
                <Label>{t('admin.accounts.credentials', 'Credentials (JSON)')}</Label>
                <Textarea className="font-mono text-xs" rows={6} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder='{"access_token": "..."}' />
              </div>
            )}</createForm.Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); createForm.reset() }} disabled={createMutation.isPending}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={() => createForm.handleSubmit()} disabled={createMutation.isPending}>
              {createMutation.isPending ? <div className="spinner h-4 w-4" /> : t('common.create', 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { setShowEditDialog(open); if (!open) setSelectedAccount(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t('admin.accounts.editTitle', 'Edit Account')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <editForm.Field name="name">{(field) => (
              <div className="space-y-2">
                <Label>{t('admin.accounts.columns.name', 'Name')} *</Label>
                <Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
              </div>
            )}</editForm.Field>
            <editForm.Field name="status">{(field) => (
              <div className="space-y-2">
                <Label>{t('admin.accounts.columns.status', 'Status')}</Label>
                <Select value={field.state.value} onValueChange={(v) => field.handleChange(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}</editForm.Field>
            <editForm.Field name="schedulable">{(field) => (
              <div className="flex items-center gap-3">
                <Label className="mb-0">{t('admin.accounts.columns.schedulable', 'Schedulable')}</Label>
                <button
                  type="button"
                  onClick={() => field.handleChange(!field.state.value)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${field.state.value ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${field.state.value ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            )}</editForm.Field>
            <editForm.Field name="priority">{(field) => (
              <div className="space-y-2">
                <Label>{t('admin.accounts.priority', 'Priority')}</Label>
                <Input type="number" value={field.state.value} onChange={(e) => field.handleChange(parseInt(e.target.value) || 0)} />
              </div>
            )}</editForm.Field>
            <editForm.Field name="notes">{(field) => (
              <div className="space-y-2">
                <Label>{t('admin.accounts.notes', 'Notes')}</Label>
                <Textarea rows={3} value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
              </div>
            )}</editForm.Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={updateMutation.isPending}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={() => editForm.handleSubmit()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <div className="spinner h-4 w-4" /> : t('common.save', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={(open) => { setShowDeleteDialog(open); if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete', 'Confirm Delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.accounts.deleteConfirm', 'Are you sure you want to delete account')} <strong>{deleteTarget?.name}</strong>?{' '}
              {t('common.cannotUndo', 'This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} className="bg-red-600 hover:bg-red-700">
              {t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete', 'Confirm Delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.accounts.bulkDeleteConfirm', 'Are you sure you want to delete')} <strong>{selectedCount}</strong> {t('admin.accounts.accountsCount', 'account(s)')}?{' '}
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
