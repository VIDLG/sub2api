import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from '@tanstack/react-form'
import { type ColumnDef } from '@tanstack/react-table'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { AdminGroup, GroupPlatform, CreateGroupRequest, UpdateGroupRequest } from '@/types'
import { PlusIcon, SearchIcon, TrashIcon, RefreshIcon } from '@/components/icons'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable } from '@/components/data-table'
import { useDataTableQuery, useTableMutation, extractErrorMessage } from '@/hooks/useDataTableQuery'

// ==================== Types ====================

type GroupFilters = {
  platform?: GroupPlatform
  status?: 'active' | 'inactive'
  is_exclusive?: boolean
  search?: string
}

// ==================== Helpers ====================

const PLATFORMS: GroupPlatform[] = ['anthropic', 'openai', 'gemini', 'antigravity', 'sora']
const PLATFORM_COLORS: Record<GroupPlatform, string> = {
  anthropic: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  openai: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  gemini: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  antigravity: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  sora: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
}

const defaultForm = { name: '', description: '', platform: 'anthropic' as GroupPlatform, subscription_type: 'standard' as 'standard' | 'subscription', rate_multiplier: 1, is_exclusive: false }

// ==================== Query Key ====================

const GROUPS_QUERY_KEY = ['admin', 'groups']

// ==================== Component ====================

export default function GroupsView() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)

  // Data table query
  const {
    data: groups,
    pagination,
    isLoading,
    search,
    filters,
    setPage,
    setFilter,
    setSearch,
    refresh,
  } = useDataTableQuery<AdminGroup, GroupFilters>({
    queryKey: GROUPS_QUERY_KEY,
    queryFn: (page, pageSize, filters, options) =>
      adminAPI.groups.list(page, pageSize, filters, options),
  })

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<AdminGroup | null>(null)

  // ==================== Mutations ====================

  const createMutation = useTableMutation({
    mutationFn: (payload: CreateGroupRequest) => adminAPI.groups.create(payload),
    queryKey: GROUPS_QUERY_KEY,
    onSuccess: () => {
      showSuccess(t('Group created successfully'))
      setShowCreateDialog(false)
      createForm.reset()
    },
    onError: (err) => {
      showError(extractErrorMessage(err, t('Failed to create group')))
    },
  })

  const updateMutation = useTableMutation({
    mutationFn: ({ id, ...updates }: { id: number } & UpdateGroupRequest) =>
      adminAPI.groups.update(id, updates),
    queryKey: GROUPS_QUERY_KEY,
    onSuccess: () => {
      showSuccess(t('Group updated successfully'))
      setShowEditDialog(false)
      setSelectedGroup(null)
    },
    onError: (err) => {
      showError(extractErrorMessage(err, t('Failed to update group')))
    },
  })

  const deleteMutation = useTableMutation({
    mutationFn: (id: number) => adminAPI.groups.delete(id),
    queryKey: GROUPS_QUERY_KEY,
    onSuccess: () => {
      showSuccess(t('Group deleted successfully'))
      setShowDeleteDialog(false)
      setSelectedGroup(null)
    },
    onError: (err) => {
      showError(extractErrorMessage(err, t('Failed to delete group')))
    },
  })

  // ==================== Forms ====================

  const createForm = useForm({
    defaultValues: { ...defaultForm },
    onSubmit: async ({ value }) => {
      if (!value.name.trim()) {
        showError(t('Group name is required'))
        return
      }
      const payload: CreateGroupRequest = {
        name: value.name.trim(),
        description: value.description.trim() || null,
        platform: value.platform,
        subscription_type: value.subscription_type,
        rate_multiplier: value.rate_multiplier,
        is_exclusive: value.is_exclusive,
      }
      createMutation.mutate(payload)
    },
  })

  const editForm = useForm({
    defaultValues: { ...defaultForm },
    onSubmit: async ({ value }) => {
      if (!selectedGroup || !value.name.trim()) {
        showError(t('Group name is required'))
        return
      }
      const payload: UpdateGroupRequest = {
        name: value.name.trim(),
        description: value.description.trim() || null,
        platform: value.platform,
        subscription_type: value.subscription_type,
        rate_multiplier: value.rate_multiplier,
        is_exclusive: value.is_exclusive,
      }
      updateMutation.mutate({ id: selectedGroup.id, ...payload })
    },
  })

  const openEdit = (group: AdminGroup) => {
    setSelectedGroup(group)
    editForm.reset({
      name: group.name,
      description: group.description || '',
      platform: group.platform,
      subscription_type: group.subscription_type,
      rate_multiplier: group.rate_multiplier,
      is_exclusive: group.is_exclusive,
    })
    setShowEditDialog(true)
  }

  // ==================== Shared Form Renderer ====================

  const renderFormFields = (form: typeof createForm) => (
    <div className="space-y-5 py-2">
      <form.Field name="name">{(field) => <div className="space-y-2"><Label>{t('Name')} *</Label><Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder={t('Group name')} /></div>}</form.Field>
      <form.Field name="description">{(field) => <div className="space-y-2"><Label>{t('Description')}</Label><Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder={t('Optional description')} /></div>}</form.Field>
      <div className="grid grid-cols-2 gap-5">
        <form.Field name="platform">{(field) => <div className="space-y-2"><Label>{t('Platform')}</Label><Select value={field.state.value} onValueChange={(v) => field.handleChange(v as GroupPlatform)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>}</form.Field>
        <form.Field name="subscription_type">{(field) => <div className="space-y-2"><Label>{t('Subscription Type')}</Label><Select value={field.state.value} onValueChange={(v) => field.handleChange(v as 'standard' | 'subscription')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="standard">{t('Standard')}</SelectItem><SelectItem value="subscription">{t('Subscription')}</SelectItem></SelectContent></Select></div>}</form.Field>
      </div>
      <div className="grid grid-cols-2 gap-5">
        <form.Field name="rate_multiplier">{(field) => <div className="space-y-2"><Label>{t('Rate Multiplier')}</Label><Input type="number" step="0.01" min={0} value={field.state.value} onChange={(e) => field.handleChange(parseFloat(e.target.value) || 0)} /></div>}</form.Field>
        <form.Field name="is_exclusive">{(field) => <div className="flex items-end pb-2"><label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"><input type="checkbox" checked={field.state.value} onChange={(e) => field.handleChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />{t('Exclusive')}</label></div>}</form.Field>
      </div>
    </div>
  )

  // ==================== Columns ====================

  const columns: ColumnDef<AdminGroup>[] = [
    {
      accessorKey: 'name',
      header: () => t('Name'),
      cell: ({ row }) => (
        <span className="font-medium text-gray-900 dark:text-white">{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'platform',
      header: () => t('Platform'),
      size: 120,
      cell: ({ row }) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PLATFORM_COLORS[row.original.platform] || 'bg-gray-100 text-gray-700'}`}>
          {row.original.platform}
        </span>
      ),
    },
    {
      accessorKey: 'subscription_type',
      header: () => t('Type'),
      size: 120,
      cell: ({ row }) => (
        <span className="text-gray-700 dark:text-gray-300">{row.original.subscription_type}</span>
      ),
    },
    {
      accessorKey: 'rate_multiplier',
      header: () => t('Rate'),
      size: 80,
      cell: ({ row }) => (
        <span className="text-gray-700 dark:text-gray-300">{row.original.rate_multiplier}x</span>
      ),
    },
    {
      accessorKey: 'is_exclusive',
      header: () => t('Exclusive'),
      size: 100,
      cell: ({ row }) => (
        row.original.is_exclusive
          ? <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{t('Yes')}</span>
          : <span className="text-xs text-gray-400">{t('No')}</span>
      ),
    },
    {
      accessorKey: 'account_count',
      header: () => t('Accounts'),
      size: 100,
      cell: ({ row }) => (
        <span className="text-gray-700 dark:text-gray-300">{row.original.account_count ?? '-'}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: () => t('Status'),
      size: 100,
      cell: ({ row }) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          row.original.status === 'active'
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        }`}>
          {row.original.status}
        </span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="text-right block">{t('Actions')}</span>,
      size: 120,
      cell: ({ row }) => {
        const group = row.original
        return (
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEdit(group)}>{t('Edit')}</Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-700"
              onClick={() => { setSelectedGroup(group); setShowDeleteDialog(true) }}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </div>
        )
      },
    },
  ]

  // ==================== Render ====================

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {t('Group Management')} <span className="ml-2 text-sm font-normal text-gray-500">({pagination?.total ?? 0})</span>
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={refresh} title={t('Refresh')}><RefreshIcon className="h-4 w-4" /></Button>
          <Button onClick={() => { createForm.reset(); setShowCreateDialog(true) }}>
            <PlusIcon className="mr-2 h-4 w-4" />{t('Create Group')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search groups...')} className="pl-9" />
          </div>
          <Select value={filters.platform ?? 'all'} onValueChange={(v) => setFilter('platform', v === 'all' ? undefined : v)}>
            <SelectTrigger className="w-auto"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('All Platforms')}</SelectItem>
              {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.status ?? 'all'} onValueChange={(v) => setFilter('status', v === 'all' ? undefined : v)}>
            <SelectTrigger className="w-auto"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('All Status')}</SelectItem>
              <SelectItem value="active">{t('Active')}</SelectItem>
              <SelectItem value="inactive">{t('Inactive')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={groups}
        loading={isLoading}
        pagination={pagination}
        onPageChange={setPage}
      />

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('Create Group')}</DialogTitle></DialogHeader>
          {renderFormFields(createForm)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={createMutation.isPending}>{t('Cancel')}</Button>
            <Button onClick={() => createForm.handleSubmit()} disabled={createMutation.isPending}>
              {createMutation.isPending ? <div className="spinner h-4 w-4" /> : t('Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('Edit Group')}</DialogTitle></DialogHeader>
          {renderFormFields(editForm)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={updateMutation.isPending}>{t('Cancel')}</Button>
            <Button onClick={() => editForm.handleSubmit()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <div className="spinner h-4 w-4" /> : t('Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={(open) => { setShowDeleteDialog(open); if (!open) setSelectedGroup(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete Group')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('Are you sure you want to delete group')} <strong>{selectedGroup?.name}</strong>? {t('This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedGroup && deleteMutation.mutate(selectedGroup.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
