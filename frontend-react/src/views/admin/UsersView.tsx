import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from '@tanstack/react-form'
import { type ColumnDef } from '@tanstack/react-table'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { AdminUser } from '@/types'
import { PlusIcon, SearchIcon, TrashIcon, RefreshIcon } from '@/components/icons'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable } from '@/components/data-table'
import { useDataTableQuery, useTableMutation, extractErrorMessage } from '@/hooks/useDataTableQuery'

// ==================== Types ====================

type UserFilters = {
  status?: 'active' | 'disabled'
  role?: 'admin' | 'user'
  search?: string
}

// ==================== Helpers ====================

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString()
}

// ==================== Query Key ====================

const USERS_QUERY_KEY = ['admin', 'users']

// ==================== Component ====================

export default function UsersView() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)

  // Data table query
  const {
    data: users,
    pagination,
    isLoading,
    search,
    filters,
    setPage,
    setFilter,
    setSearch,
    refresh,
  } = useDataTableQuery<AdminUser, UserFilters>({
    queryKey: USERS_QUERY_KEY,
    queryFn: (page, pageSize, filters, options) =>
      adminAPI.users.list(page, pageSize, filters, options),
  })

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)

  // ==================== Mutations ====================

  const createMutation = useTableMutation({
    mutationFn: (value: { email: string; password: string; balance: number; concurrency: number }) =>
      adminAPI.users.create(value),
    queryKey: USERS_QUERY_KEY,
    onSuccess: () => {
      showSuccess(t('User created successfully'))
      setShowCreateDialog(false)
      createForm.reset()
    },
    onError: (err) => {
      showError(extractErrorMessage(err, t('Failed to create user')))
    },
  })

  const updateMutation = useTableMutation({
    mutationFn: ({ id, ...updates }: { id: number; balance: number; concurrency: number; role: 'admin' | 'user'; status: 'active' | 'disabled'; notes: string }) =>
      adminAPI.users.update(id, updates),
    queryKey: USERS_QUERY_KEY,
    onSuccess: () => {
      showSuccess(t('User updated successfully'))
      setShowEditDialog(false)
      setSelectedUser(null)
    },
    onError: (err) => {
      showError(extractErrorMessage(err, t('Failed to update user')))
    },
  })

  const deleteMutation = useTableMutation({
    mutationFn: (id: number) => adminAPI.users.delete(id),
    queryKey: USERS_QUERY_KEY,
    onSuccess: () => {
      showSuccess(t('User deleted successfully'))
      setShowDeleteDialog(false)
      setSelectedUser(null)
    },
    onError: (err) => {
      showError(extractErrorMessage(err, t('Failed to delete user')))
    },
  })

  const toggleStatusMutation = useTableMutation({
    mutationFn: ({ id, status }: { id: number; status: 'active' | 'disabled' }) =>
      adminAPI.users.toggleStatus(id, status),
    queryKey: USERS_QUERY_KEY,
    onSuccess: () => showSuccess(t('User status updated')),
    onError: (err) => {
      showError(extractErrorMessage(err, t('Failed to toggle status')))
    },
  })

  // ==================== Forms ====================

  const createForm = useForm({
    defaultValues: { email: '', password: '', balance: 0, concurrency: 1 },
    onSubmit: async ({ value }) => {
      if (!value.email || !value.password) {
        showError(t('Email and password are required'))
        return
      }
      createMutation.mutate(value)
    },
  })

  const editForm = useForm({
    defaultValues: { balance: 0, concurrency: 1, role: 'user' as 'admin' | 'user', status: 'active' as 'active' | 'disabled', notes: '' },
    onSubmit: async ({ value }) => {
      if (!selectedUser) return
      updateMutation.mutate({ id: selectedUser.id, ...value })
    },
  })

  const { Field: CreateField } = createForm
  const { Field: EditField } = editForm

  const openEdit = (user: AdminUser) => {
    setSelectedUser(user)
    editForm.reset({
      balance: user.balance,
      concurrency: user.concurrency,
      role: user.role,
      status: user.status,
      notes: user.notes || '',
    })
    setShowEditDialog(true)
  }

  // ==================== Columns ====================

  const columns: ColumnDef<AdminUser>[] = [
    {
      accessorKey: 'email',
      header: () => t('Email'),
      cell: ({ row }) => (
        <span className="font-medium text-gray-900 dark:text-white">{row.original.email}</span>
      ),
    },
    {
      accessorKey: 'role',
      header: () => t('Role'),
      size: 100,
      cell: ({ row }) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          row.original.role === 'admin'
            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
        }`}>
          {row.original.role}
        </span>
      ),
    },
    {
      accessorKey: 'balance',
      header: () => t('Balance'),
      size: 100,
      cell: ({ row }) => (
        <span className="text-gray-700 dark:text-gray-300">${row.original.balance.toFixed(2)}</span>
      ),
    },
    {
      accessorKey: 'concurrency',
      header: () => t('Concurrency'),
      size: 120,
      cell: ({ row }) => (
        <span className="text-gray-700 dark:text-gray-300">
          {row.original.current_concurrency !== undefined
            ? `${row.original.current_concurrency}/${row.original.concurrency}`
            : row.original.concurrency}
        </span>
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
      accessorKey: 'created_at',
      header: () => t('Created'),
      size: 160,
      cell: ({ row }) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(row.original.created_at)}</span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="text-right block">{t('Actions')}</span>,
      size: 200,
      cell: ({ row }) => {
        const user = row.original
        return (
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>{t('Edit')}</Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleStatusMutation.mutate({ id: user.id, status: user.status === 'active' ? 'disabled' : 'active' })}
            >
              {user.status === 'active' ? t('Disable') : t('Enable')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-700"
              onClick={() => { setSelectedUser(user); setShowDeleteDialog(true) }}
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
          {t('User Management')} <span className="ml-2 text-sm font-normal text-gray-500">({pagination?.total ?? 0})</span>
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={refresh} title={t('Refresh')}><RefreshIcon className="h-4 w-4" /></Button>
          <Button onClick={() => { createForm.reset(); setShowCreateDialog(true) }}>
            <PlusIcon className="mr-2 h-4 w-4" />{t('Create User')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search by email...')} className="pl-9" />
          </div>
          <Select value={filters.role ?? 'all'} onValueChange={(v) => setFilter('role', v === 'all' ? undefined : v as 'admin' | 'user')}>
            <SelectTrigger className="w-auto"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('All Roles')}</SelectItem>
              <SelectItem value="admin">{t('Admin')}</SelectItem>
              <SelectItem value="user">{t('User')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.status ?? 'all'} onValueChange={(v) => setFilter('status', v === 'all' ? undefined : v as 'active' | 'disabled')}>
            <SelectTrigger className="w-auto"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('All Status')}</SelectItem>
              <SelectItem value="active">{t('Active')}</SelectItem>
              <SelectItem value="disabled">{t('Disabled')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={users}
        loading={isLoading}
        pagination={pagination}
        onPageChange={setPage}
      />

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t('Create User')}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createForm.handleSubmit() }} className="space-y-5 py-2">
            <CreateField name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('Email')} *</Label>
                  <Input type="email" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} placeholder="user@example.com" />
                </div>
              )}
            </CreateField>
            <CreateField name="password">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('Password')} *</Label>
                  <Input type="password" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
                </div>
              )}
            </CreateField>
            <div className="grid grid-cols-2 gap-5">
              <CreateField name="balance">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('Balance')} ($)</Label>
                    <Input type="number" step="0.01" value={field.state.value} onChange={(e) => field.handleChange(parseFloat(e.target.value) || 0)} />
                  </div>
                )}
              </CreateField>
              <CreateField name="concurrency">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('Concurrency')}</Label>
                    <Input type="number" min={1} value={field.state.value} onChange={(e) => field.handleChange(parseInt(e.target.value) || 1)} />
                  </div>
                )}
              </CreateField>
            </div>
          </form>
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
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t('Edit User')} - {selectedUser?.email}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); editForm.handleSubmit() }} className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-5">
              <EditField name="balance">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('Balance')} ($)</Label>
                    <Input type="number" step="0.01" value={field.state.value} onChange={(e) => field.handleChange(parseFloat(e.target.value) || 0)} />
                  </div>
                )}
              </EditField>
              <EditField name="concurrency">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('Concurrency')}</Label>
                    <Input type="number" min={1} value={field.state.value} onChange={(e) => field.handleChange(parseInt(e.target.value) || 1)} />
                  </div>
                )}
              </EditField>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <EditField name="role">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('Role')}</Label>
                    <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as 'admin' | 'user')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">{t('User')}</SelectItem>
                        <SelectItem value="admin">{t('Admin')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </EditField>
              <EditField name="status">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('Status')}</Label>
                    <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as 'active' | 'disabled')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">{t('Active')}</SelectItem>
                        <SelectItem value="disabled">{t('Disabled')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </EditField>
            </div>
            <EditField name="notes">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('Notes')}</Label>
                  <Textarea value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} rows={3} />
                </div>
              )}
            </EditField>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={updateMutation.isPending}>{t('Cancel')}</Button>
            <Button onClick={() => editForm.handleSubmit()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <div className="spinner h-4 w-4" /> : t('Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={(open) => { setShowDeleteDialog(open); if (!open) setSelectedUser(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete User')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('Are you sure you want to delete user')} <strong>{selectedUser?.email}</strong>? {t('This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedUser && deleteMutation.mutate(selectedUser.id)}
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
