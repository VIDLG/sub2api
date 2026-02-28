import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from '@tanstack/react-form'
import { type ColumnDef } from '@tanstack/react-table'
import { useUpdateEffect } from 'ahooks'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { PromoCode, PromoCodeUsage, BasePaginationResponse, CreatePromoCodeRequest, UpdatePromoCodeRequest } from '@/types'
import { PlusIcon, SearchIcon, TrashIcon, RefreshIcon, ClipboardIcon, CheckIcon } from '@/components/icons'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable } from '@/components/data-table'
import { useDataTableQuery, useTableMutation, extractErrorMessage } from '@/hooks/useDataTableQuery'

// ==================== Types ====================

type PromoFilters = {
  status?: string
  search?: string
}

// ==================== Helpers ====================

const USAGES_PAGE_SIZE = 20

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

function toUnixSeconds(dateStr: string): number | undefined {
  if (!dateStr) return undefined
  const ts = new Date(dateStr).getTime()
  return isNaN(ts) ? undefined : Math.floor(ts / 1000)
}

function toDatetimeLocal(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function computeStatus(promo: PromoCode): { label: string; color: string } {
  if (promo.status === 'disabled') return { label: 'disabled', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
  if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) return { label: 'expired', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' }
  if (promo.max_uses > 0 && promo.used_count >= promo.max_uses) return { label: 'exhausted', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' }
  return { label: 'active', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' }
}

const defaultForm = { code: '', bonus_amount: 1, max_uses: 0, expires_at: '', notes: '', status: 'active' as 'active' | 'disabled' }

// ==================== Query Key ====================

const PROMO_QUERY_KEY = ['admin', 'promo']

// ==================== Component ====================

export default function PromoCodesView() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)

  // Data table query
  const {
    data: promoCodes,
    pagination,
    isLoading,
    search,
    filters,
    setPage,
    setFilter,
    setSearch,
    refresh,
  } = useDataTableQuery<PromoCode, PromoFilters>({
    queryKey: PROMO_QUERY_KEY,
    queryFn: (page, pageSize, filters) =>
      adminAPI.promo.list(page, pageSize, filters),
  })

  // Dialog state
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showUsagesDialog, setShowUsagesDialog] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [selectedPromo, setSelectedPromo] = useState<PromoCode | null>(null)

  // Usages state (manual pagination for sub-table in dialog)
  const [usages, setUsages] = useState<PromoCodeUsage[]>([])
  const [usagesLoading, setUsagesLoading] = useState(false)
  const [usagesPage, setUsagesPage] = useState(1)
  const [usagesTotalPages, setUsagesTotalPages] = useState(1)
  const [usagesTotal, setUsagesTotal] = useState(0)

  // Copy state
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // ==================== Mutations ====================

  const saveMutation = useTableMutation<
    { form: typeof defaultForm; isEdit: boolean; editId: number | undefined },
    PromoCode
  >({
    mutationFn: async ({ form: value, isEdit: editing, editId }) => {
      if (editing && editId) {
        const payload: UpdatePromoCodeRequest = {
          code: value.code.trim() || undefined,
          bonus_amount: value.bonus_amount,
          max_uses: value.max_uses,
          expires_at: value.expires_at ? toUnixSeconds(value.expires_at) ?? null : null,
          notes: value.notes,
          status: value.status,
        }
        return adminAPI.promo.update(editId, payload)
      } else {
        const payload: CreatePromoCodeRequest = {
          code: value.code.trim() || undefined,
          bonus_amount: value.bonus_amount,
          max_uses: value.max_uses > 0 ? value.max_uses : undefined,
          expires_at: value.expires_at ? toUnixSeconds(value.expires_at) ?? null : null,
          notes: value.notes || undefined,
        }
        return adminAPI.promo.create(payload)
      }
    },
    queryKey: PROMO_QUERY_KEY,
    onSuccess: (_data, variables) => {
      showSuccess(variables.isEdit ? t('Promo code updated successfully') : t('Promo code created successfully'))
      setShowFormDialog(false)
      setSelectedPromo(null)
      form.reset()
    },
    onError: (err) => {
      showError(extractErrorMessage(err, t('Failed to save promo code')))
    },
  })

  const deleteMutation = useTableMutation<number, { message: string }>({
    mutationFn: (id: number) => adminAPI.promo.delete(id),
    queryKey: PROMO_QUERY_KEY,
    onSuccess: () => {
      showSuccess(t('Promo code deleted'))
      setShowDeleteDialog(false)
      setSelectedPromo(null)
    },
    onError: (err) => {
      showError(extractErrorMessage(err, t('Failed to delete promo code')))
    },
  })

  // ==================== Usages (manual pagination) ====================

  const loadUsages = useCallback(async (promoId: number, currentPage: number) => {
    setUsagesLoading(true)
    try {
      const res: BasePaginationResponse<PromoCodeUsage> = await adminAPI.promo.getUsages(promoId, currentPage, USAGES_PAGE_SIZE)
      setUsages(res.items)
      setUsagesTotalPages(res.pages)
      setUsagesTotal(res.total)
    } catch {
      showError(t('Failed to load usage records'))
    } finally {
      setUsagesLoading(false)
    }
  }, [showError, t])

  const openUsages = (promo: PromoCode) => {
    setSelectedPromo(promo)
    setUsagesPage(1)
    setUsages([])
    setShowUsagesDialog(true)
    loadUsages(promo.id, 1)
  }

  useUpdateEffect(() => {
    if (showUsagesDialog && selectedPromo) loadUsages(selectedPromo.id, usagesPage)
  }, [usagesPage])

  // ==================== Form ====================

  const form = useForm({
    defaultValues: { ...defaultForm },
    onSubmit: async ({ value }) => {
      if (!isEdit && !value.code.trim() && value.bonus_amount <= 0) {
        showError(t('Bonus amount must be greater than 0'))
        return
      }
      saveMutation.mutate({
        form: value,
        isEdit,
        editId: selectedPromo?.id,
      })
    },
  })

  const openCreate = () => {
    setIsEdit(false)
    setSelectedPromo(null)
    form.reset()
    setShowFormDialog(true)
  }

  const openEdit = (promo: PromoCode) => {
    setIsEdit(true)
    setSelectedPromo(promo)
    form.reset({
      code: promo.code,
      bonus_amount: promo.bonus_amount,
      max_uses: promo.max_uses,
      expires_at: toDatetimeLocal(promo.expires_at),
      notes: promo.notes || '',
      status: promo.status,
    })
    setShowFormDialog(true)
  }

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch {
      showError(t('Failed to copy'))
    }
  }

  // ==================== Columns ====================

  const columns: ColumnDef<PromoCode>[] = [
    {
      accessorKey: 'code',
      header: () => t('Code'),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <span className="font-mono text-xs font-medium text-gray-900 dark:text-white">{row.original.code}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopyCode(row.original.code)} title={t('Copy')}>
            {copiedCode === row.original.code ? <CheckIcon className="h-3.5 w-3.5 text-green-500" /> : <ClipboardIcon className="h-3.5 w-3.5" />}
          </Button>
        </div>
      ),
    },
    {
      accessorKey: 'bonus_amount',
      header: () => t('Bonus'),
      size: 100,
      cell: ({ row }) => (
        <span className="text-gray-700 dark:text-gray-300">${row.original.bonus_amount.toFixed(2)}</span>
      ),
    },
    {
      accessorKey: 'max_uses',
      header: () => t('Max Uses'),
      size: 100,
      cell: ({ row }) => (
        <span className="text-gray-700 dark:text-gray-300">{row.original.max_uses > 0 ? row.original.max_uses : t('Unlimited')}</span>
      ),
    },
    {
      accessorKey: 'used_count',
      header: () => t('Used'),
      size: 80,
      cell: ({ row }) => (
        <button onClick={() => openUsages(row.original)} className="text-xs text-blue-600 hover:underline dark:text-blue-400">
          {row.original.used_count}
        </button>
      ),
    },
    {
      id: 'computed_status',
      header: () => t('Status'),
      size: 100,
      cell: ({ row }) => {
        const status = computeStatus(row.original)
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
            {status.label}
          </span>
        )
      },
    },
    {
      accessorKey: 'expires_at',
      header: () => t('Expires'),
      size: 160,
      cell: ({ row }) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(row.original.expires_at)}</span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="text-right block">{t('Actions')}</span>,
      size: 140,
      cell: ({ row }) => {
        const promo = row.original
        return (
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEdit(promo)}>{t('Edit')}</Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-700"
              onClick={() => { setSelectedPromo(promo); setShowDeleteDialog(true) }}
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
          {t('Promo Code Management')} <span className="ml-2 text-sm font-normal text-gray-500">({pagination?.total ?? 0})</span>
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={refresh} title={t('Refresh')}><RefreshIcon className="h-4 w-4" /></Button>
          <Button onClick={openCreate}><PlusIcon className="mr-2 h-4 w-4" />{t('Create Promo Code')}</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search promo codes...')} className="pl-9" />
          </div>
          <Select value={filters.status ?? 'all'} onValueChange={(v) => setFilter('status', v === 'all' ? undefined : v)}>
            <SelectTrigger className="w-auto">
              <SelectValue />
            </SelectTrigger>
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
        data={promoCodes}
        loading={isLoading}
        pagination={pagination}
        onPageChange={setPage}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{isEdit ? t('Edit Promo Code') : t('Create Promo Code')}</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">
            <form.Field name="code">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('Code')}</Label>
                  <Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} className="font-mono" placeholder={t('Leave empty for auto-generate')} />
                </div>
              )}
            </form.Field>
            <div className="grid grid-cols-2 gap-5">
              <form.Field name="bonus_amount">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('Bonus Amount')} ($) *</Label>
                    <Input type="number" step="0.01" min={0} value={field.state.value} onChange={(e) => field.handleChange(parseFloat(e.target.value) || 0)} />
                  </div>
                )}
              </form.Field>
              <form.Field name="max_uses">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('Max Uses')}</Label>
                    <Input type="number" min={0} value={field.state.value} onChange={(e) => field.handleChange(parseInt(e.target.value) || 0)} placeholder={t('0 = unlimited')} />
                  </div>
                )}
              </form.Field>
            </div>
            <form.Field name="expires_at">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('Expires At')}</Label>
                  <input type="datetime-local" value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} className="input-field w-full" />
                </div>
              )}
            </form.Field>
            <form.Field name="notes">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('Notes')}</Label>
                  <Textarea value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} rows={2} />
                </div>
              )}
            </form.Field>
            {isEdit && (
              <form.Field name="status">
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
              </form.Field>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormDialog(false)} disabled={saveMutation.isPending}>{t('Cancel')}</Button>
            <Button onClick={() => form.handleSubmit()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <div className="spinner h-4 w-4" /> : isEdit ? t('Save') : t('Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Usages Dialog */}
      <Dialog open={showUsagesDialog} onOpenChange={setShowUsagesDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('Usage Records')} - <span className="font-mono">{selectedPromo?.code}</span> <span className="ml-2 text-sm font-normal text-gray-500">({usagesTotal})</span>
            </DialogTitle>
          </DialogHeader>
          {usagesLoading ? (
            <div className="flex items-center justify-center py-8"><div className="spinner" /></div>
          ) : usages.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">{t('No usage records found')}</div>
          ) : (
            <>
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      <th className="px-3 py-2">{t('User')}</th>
                      <th className="px-3 py-2">{t('Amount')}</th>
                      <th className="px-3 py-2">{t('Used At')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {usages.map((u) => (
                      <tr key={u.id}>
                        <td className="px-3 py-2 text-xs text-gray-900 dark:text-white">{u.user?.email || `User #${u.user_id}`}</td>
                        <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300">${u.bonus_amount.toFixed(2)}</td>
                        <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{formatDate(u.used_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {usagesTotalPages > 1 && (
                <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3 dark:border-gray-700">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{t('Page')} {usagesPage} / {usagesTotalPages}</span>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setUsagesPage((p) => Math.max(1, p - 1))} disabled={usagesPage <= 1}>{t('Previous')}</Button>
                    <Button variant="ghost" size="sm" onClick={() => setUsagesPage((p) => Math.min(usagesTotalPages, p + 1))} disabled={usagesPage >= usagesTotalPages}>{t('Next')}</Button>
                  </div>
                </div>
              )}
            </>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setShowUsagesDialog(false)}>{t('Close')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={(open) => { setShowDeleteDialog(open); if (!open) setSelectedPromo(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete Promo Code')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('Are you sure you want to delete promo code')} <strong className="font-mono">{selectedPromo?.code}</strong>? {t('This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedPromo && deleteMutation.mutate(selectedPromo.id)}
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
