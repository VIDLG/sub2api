import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { useDebounceFn } from 'ahooks'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { UserSubscription, AdminGroup } from '@/types'
import { PlusIcon, SearchIcon, RefreshIcon } from '@/components/icons'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable } from '@/components/data-table'
import { useDataTableQuery, useTableMutation, extractErrorMessage } from '@/hooks/useDataTableQuery'

// ==================== Types ====================

type SubscriptionFilters = {
  status?: 'active' | 'expired' | 'revoked'
  group_id?: number
  search?: string
}

interface SimpleUser {
  id: number
  email: string
}

// ==================== Helpers ====================

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

function formatCost(value: number) {
  if (value >= 1) return '$' + value.toFixed(2)
  if (value >= 0.01) return '$' + value.toFixed(3)
  return '$' + value.toFixed(4)
}

function daysRemaining(expiresAt: string | null | undefined): string {
  if (!expiresAt) return 'N/A'
  const now = Date.now()
  const exp = new Date(expiresAt).getTime()
  const diff = exp - now
  if (diff <= 0) return 'Expired'
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  return `${days}d`
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  expired: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  revoked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

// ==================== Query Key ====================

const SUBSCRIPTIONS_QUERY_KEY = ['admin', 'subscriptions']

// ==================== Component ====================

export default function SubscriptionsView() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)

  // ==================== Data Table Query ====================

  const {
    data: subscriptions,
    pagination,
    isLoading,
    filters,
    setPage,
    setFilter,
    refresh,
  } = useDataTableQuery<UserSubscription, SubscriptionFilters>({
    queryKey: SUBSCRIPTIONS_QUERY_KEY,
    queryFn: (page, pageSize, filters, options) =>
      adminAPI.subscriptions.list(page, pageSize, filters, options),
  })

  // ==================== Groups ====================

  const { data: allGroups = [] } = useQuery<AdminGroup[]>({
    queryKey: ['admin', 'groups', 'all'],
    queryFn: () => adminAPI.groups.getAll(),
  })

  // ==================== Dialog State ====================

  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [showExtendDialog, setShowExtendDialog] = useState(false)
  const [showRevokeDialog, setShowRevokeDialog] = useState(false)
  const [selectedSub, setSelectedSub] = useState<UserSubscription | null>(null)

  // Assign form
  const [assignForm, setAssignForm] = useState({
    user_id: 0,
    group_id: 0,
    validity_days: 30,
  })
  const [userSearch, setUserSearch] = useState('')
  const [userResults, setUserResults] = useState<SimpleUser[]>([])
  const [searchingUsers, setSearchingUsers] = useState(false)

  // Extend form
  const [extendDays, setExtendDays] = useState(30)

  // Debounced user search
  const { run: searchUsersDebounced } = useDebounceFn(async (value: string) => {
    setSearchingUsers(true)
    try {
      const results = await adminAPI.usage.searchUsers(value.trim())
      setUserResults(results)
    } catch {
      // silent
    } finally {
      setSearchingUsers(false)
    }
  }, { wait: 300 })

  // ==================== Mutations ====================

  const assignMutation = useTableMutation({
    mutationFn: (value: { user_id: number; group_id: number; validity_days?: number }) =>
      adminAPI.subscriptions.assign({
        user_id: value.user_id,
        group_id: value.group_id,
        validity_days: value.validity_days,
      }),
    queryKey: SUBSCRIPTIONS_QUERY_KEY,
    onSuccess: () => {
      showSuccess(t('Subscription assigned successfully'))
      setShowAssignDialog(false)
      setAssignForm({ user_id: 0, group_id: 0, validity_days: 30 })
      setUserSearch('')
      setUserResults([])
    },
    onError: (err) => {
      showError(extractErrorMessage(err, t('Failed to assign subscription')))
    },
  })

  const extendMutation = useTableMutation({
    mutationFn: ({ id, days }: { id: number; days: number }) =>
      adminAPI.subscriptions.extend(id, { days }),
    queryKey: SUBSCRIPTIONS_QUERY_KEY,
    onSuccess: () => {
      showSuccess(t('Subscription extended successfully'))
      setShowExtendDialog(false)
      setSelectedSub(null)
    },
    onError: (err) => {
      showError(extractErrorMessage(err, t('Failed to extend subscription')))
    },
  })

  const revokeMutation = useTableMutation({
    mutationFn: (id: number) => adminAPI.subscriptions.revoke(id),
    queryKey: SUBSCRIPTIONS_QUERY_KEY,
    onSuccess: () => {
      showSuccess(t('Subscription revoked successfully'))
      setShowRevokeDialog(false)
      setSelectedSub(null)
    },
    onError: (err) => {
      showError(extractErrorMessage(err, t('Failed to revoke subscription')))
    },
  })

  // ==================== User Search ====================

  const handleUserSearch = (value: string) => {
    setUserSearch(value)
    if (!value.trim()) {
      setUserResults([])
      return
    }
    searchUsersDebounced(value.trim())
  }

  // ==================== Actions ====================

  const handleAssign = () => {
    if (!assignForm.user_id || !assignForm.group_id) {
      showError(t('Please select a user and group'))
      return
    }
    assignMutation.mutate({
      user_id: assignForm.user_id,
      group_id: assignForm.group_id,
      validity_days: assignForm.validity_days > 0 ? assignForm.validity_days : undefined,
    })
  }

  const openExtend = (sub: UserSubscription) => {
    setSelectedSub(sub)
    setExtendDays(30)
    setShowExtendDialog(true)
  }

  const handleExtend = () => {
    if (!selectedSub || extendDays <= 0) return
    extendMutation.mutate({ id: selectedSub.id, days: extendDays })
  }

  const confirmRevoke = (sub: UserSubscription) => {
    setSelectedSub(sub)
    setShowRevokeDialog(true)
  }

  const handleRevoke = () => {
    if (!selectedSub) return
    revokeMutation.mutate(selectedSub.id)
  }

  // ==================== Columns ====================

  const columns: ColumnDef<UserSubscription>[] = [
    {
      accessorKey: 'user',
      header: () => t('User'),
      cell: ({ row }) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {row.original.user?.email || `User #${row.original.user_id}`}
        </span>
      ),
    },
    {
      accessorKey: 'group',
      header: () => t('Group'),
      cell: ({ row }) => (
        <span className="text-gray-700 dark:text-gray-300">
          {row.original.group?.name || `Group #${row.original.group_id}`}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: () => t('Status'),
      size: 100,
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[row.original.status] || ''}`}
        >
          {row.original.status}
        </span>
      ),
    },
    {
      accessorKey: 'daily_usage_usd',
      header: () => t('Daily'),
      size: 80,
      cell: ({ row }) => (
        <span className="text-gray-700 dark:text-gray-300 text-xs">
          {formatCost(row.original.daily_usage_usd)}
        </span>
      ),
    },
    {
      accessorKey: 'weekly_usage_usd',
      header: () => t('Weekly'),
      size: 80,
      cell: ({ row }) => (
        <span className="text-gray-700 dark:text-gray-300 text-xs">
          {formatCost(row.original.weekly_usage_usd)}
        </span>
      ),
    },
    {
      accessorKey: 'monthly_usage_usd',
      header: () => t('Monthly'),
      size: 80,
      cell: ({ row }) => (
        <span className="text-gray-700 dark:text-gray-300 text-xs">
          {formatCost(row.original.monthly_usage_usd)}
        </span>
      ),
    },
    {
      accessorKey: 'expires_at',
      header: () => t('Expires'),
      size: 160,
      cell: ({ row }) => (
        <span className="text-gray-500 dark:text-gray-400 text-xs">
          {formatDate(row.original.expires_at)}
        </span>
      ),
    },
    {
      id: 'remaining',
      header: () => t('Remaining'),
      size: 100,
      cell: ({ row }) => (
        <span
          className={`text-xs font-medium ${
            row.original.expires_at && new Date(row.original.expires_at).getTime() < Date.now()
              ? 'text-red-500'
              : 'text-green-600 dark:text-green-400'
          }`}
        >
          {daysRemaining(row.original.expires_at)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="text-right block">{t('Actions')}</span>,
      size: 160,
      cell: ({ row }) => {
        const sub = row.original
        return (
          <div className="flex items-center justify-end gap-1">
            {sub.status === 'active' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openExtend(sub)}
                  title={t('Extend')}
                >
                  {t('Extend')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => confirmRevoke(sub)}
                  className="text-red-500 hover:text-red-700"
                  title={t('Revoke')}
                >
                  {t('Revoke')}
                </Button>
              </>
            )}
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
          {t('Subscription Management')}
          <span className="ml-2 text-sm font-normal text-gray-500">({pagination?.total ?? 0})</span>
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={refresh} title={t('Refresh')}>
            <RefreshIcon className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => {
              setAssignForm({ user_id: 0, group_id: 0, validity_days: 30 })
              setUserSearch('')
              setUserResults([])
              setShowAssignDialog(true)
            }}
            className="flex items-center gap-1"
          >
            <PlusIcon className="h-4 w-4" />
            {t('Assign Subscription')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={filters.status ?? 'all'}
            onValueChange={(v) => setFilter('status', v === 'all' ? undefined : v)}
          >
            <SelectTrigger className="w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('All Status')}</SelectItem>
              <SelectItem value="active">{t('Active')}</SelectItem>
              <SelectItem value="expired">{t('Expired')}</SelectItem>
              <SelectItem value="revoked">{t('Revoked')}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.group_id != null ? String(filters.group_id) : 'all'}
            onValueChange={(v) => setFilter('group_id', v === 'all' ? undefined : Number(v))}
          >
            <SelectTrigger className="w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('All Groups')}</SelectItem>
              {allGroups.map((g) => (
                <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={subscriptions}
        loading={isLoading}
        pagination={pagination}
        onPageChange={setPage}
      />

      {/* Assign Subscription Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Assign Subscription')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* User Search */}
            <div>
              <Label>{t('User')} *</Label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  value={userSearch}
                  onChange={(e) => handleUserSearch(e.target.value)}
                  placeholder={t('Search user by email...')}
                  className="pl-9"
                />
                {searchingUsers && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="spinner h-4 w-4" />
                  </div>
                )}
              </div>
              {userResults.length > 0 && (
                <div className="mt-1 max-h-32 overflow-y-auto rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-dark-800">
                  {userResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setAssignForm((f) => ({ ...f, user_id: u.id }))
                        setUserSearch(u.email)
                        setUserResults([])
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-dark-700 ${
                        assignForm.user_id === u.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      {u.email}
                    </button>
                  ))}
                </div>
              )}
              {assignForm.user_id > 0 && (
                <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                  {t('Selected')}: User #{assignForm.user_id}
                </p>
              )}
            </div>

            {/* Group Select */}
            <div className="space-y-2">
              <Label>{t('Group')} *</Label>
              <Select
                value={assignForm.group_id ? String(assignForm.group_id) : '0'}
                onValueChange={(v) => setAssignForm((f) => ({ ...f, group_id: Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('Select a group...')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t('Select a group...')}</SelectItem>
                  {allGroups.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.name} ({g.platform})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Validity Days */}
            <div>
              <Label>{t('Validity Days')}</Label>
              <Input
                type="number"
                min={0}
                value={assignForm.validity_days}
                onChange={(e) =>
                  setAssignForm((f) => ({
                    ...f,
                    validity_days: parseInt(e.target.value) || 0,
                  }))
                }
                placeholder={t('0 = no expiry')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)} disabled={assignMutation.isPending}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleAssign} disabled={assignMutation.isPending}>
              {assignMutation.isPending ? <div className="spinner h-4 w-4" /> : t('Assign')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Dialog */}
      <Dialog open={showExtendDialog} onOpenChange={setShowExtendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Extend Subscription')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('User')}: {selectedSub?.user?.email || `#${selectedSub?.user_id}`}
            <br />
            {t('Group')}: {selectedSub?.group?.name || `#${selectedSub?.group_id}`}
          </p>
          <div>
            <Label>{t('Days to extend')}</Label>
            <Input
              type="number"
              min={1}
              value={extendDays}
              onChange={(e) => setExtendDays(parseInt(e.target.value) || 1)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExtendDialog(false)} disabled={extendMutation.isPending}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleExtend} disabled={extendMutation.isPending}>
              {extendMutation.isPending ? <div className="spinner h-4 w-4" /> : t('Extend')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation */}
      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Revoke Subscription')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('Are you sure you want to revoke the subscription for')}{' '}
              <strong>{selectedSub?.user?.email || `User #${selectedSub?.user_id}`}</strong>{' '}
              {t('in group')}{' '}
              <strong>{selectedSub?.group?.name || `Group #${selectedSub?.group_id}`}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeMutation.isPending}>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={revokeMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {revokeMutation.isPending ? <div className="spinner h-4 w-4" /> : t('Revoke')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
