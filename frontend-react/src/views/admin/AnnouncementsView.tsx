import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from '@tanstack/react-form'
import { type ColumnDef, type RowSelectionState } from '@tanstack/react-table'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type {
  Announcement,
  AnnouncementStatus,
  CreateAnnouncementRequest,
  UpdateAnnouncementRequest,
} from '@/types'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable, ColumnSettings } from '@/components/data-table'
import { DevTools } from '@/components/dev/DevTools'
import { useDataTableQuery, useTableMutation, extractErrorMessage, type ColumnMeta } from '@/hooks/useDataTableQuery'

// ==================== Types ====================

type AnnouncementFilters = {
  status?: string
  search?: string
}

// ==================== Helpers ====================

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

function toUnixSeconds(dateStr: string): number | undefined {
  if (!dateStr) return undefined
  const ts = new Date(dateStr).getTime()
  return isNaN(ts) ? undefined : Math.floor(ts / 1000)
}

function toDatetimeLocal(dateStr: string | undefined | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ==================== Constants ====================

const STATUS_COLORS: Record<AnnouncementStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  archived: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

// ==================== Query Key ====================

const ANNOUNCEMENTS_QUERY_KEY = ['admin', 'announcements']

const ANNOUNCEMENTS_COLUMN_META: ColumnMeta[] = [
  { id: 'title', label: 'Title' },
  { id: 'status', label: 'Status' },
  { id: 'starts_at', label: 'Start Date' },
  { id: 'ends_at', label: 'End Date' },
  { id: 'created_at', label: 'Created' },
]

// ==================== Component ====================

export default function AnnouncementsView() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)

  // Data table query
  const {
    data: announcements,
    pagination,
    isLoading,
    search,
    filters,
    setPage,
    setFilter,
    setSearch,
    refresh,
    columnOrder,
    columnVisibility,
    columnSizing,
    columnSettingItems,
    setColumnOrder,
    setColumnVisibility,
    setColumnSizing,
    resetColumnSettings,
  } = useDataTableQuery<Announcement, AnnouncementFilters>({
    queryKey: ANNOUNCEMENTS_QUERY_KEY,
    queryFn: (page, pageSize, filters) => adminAPI.announcements.list(page, pageSize, filters),
    tableKey: 'admin-announcements',
    columnMeta: ANNOUNCEMENTS_COLUMN_META,
  })

  // Row selection state
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const selectedCount = Object.keys(rowSelection).length

  // Dialog state
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)

  // ==================== Mutations ====================

  const saveMutation = useTableMutation({
    mutationFn: ({
      isEdit,
      id,
      payload,
    }: {
      isEdit: boolean
      id?: number
      payload: CreateAnnouncementRequest | UpdateAnnouncementRequest
    }) => {
      if (isEdit && id !== undefined) {
        return adminAPI.announcements.update(id, payload as UpdateAnnouncementRequest)
      }
      return adminAPI.announcements.create(payload as CreateAnnouncementRequest)
    },
    queryKey: ANNOUNCEMENTS_QUERY_KEY,
    onSuccess: (_data, variables) => {
      showSuccess(
        variables.isEdit
          ? t('Announcement updated successfully')
          : t('Announcement created successfully'),
      )
      setShowFormDialog(false)
    },
    onError: (err) => {
      showError(extractErrorMessage(err, t('Failed to save announcement')))
    },
  })

  const deleteMutation = useTableMutation({
    mutationFn: (id: number) => adminAPI.announcements.delete(id),
    queryKey: ANNOUNCEMENTS_QUERY_KEY,
    onSuccess: () => {
      showSuccess(t('Announcement deleted successfully'))
      setShowDeleteDialog(false)
      setSelectedAnnouncement(null)
    },
    onError: (err) => {
      showError(extractErrorMessage(err, t('Failed to delete announcement')))
    },
  })

  const bulkDeleteMutation = useTableMutation({
    mutationFn: async (ids: number[]) => {
      let failed = 0
      for (const id of ids) {
        try {
          await adminAPI.announcements.delete(id)
        } catch {
          failed++
        }
      }
      return { total: ids.length, failed }
    },
    queryKey: ANNOUNCEMENTS_QUERY_KEY,
    onSuccess: (result) => {
      if (result.failed > 0) {
        showError(`${result.failed} item(s) failed to delete`)
      } else {
        showSuccess(`${result.total} item(s) deleted`)
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

  // ==================== Form ====================

  const form = useForm({
    defaultValues: {
      title: '',
      content: '',
      status: 'draft' as AnnouncementStatus,
      starts_at: '',
      ends_at: '',
    },
    onSubmit: async ({ value }) => {
      if (!value.title.trim()) {
        showError(t('Title is required'))
        return
      }
      const payload: CreateAnnouncementRequest = {
        title: value.title.trim(),
        content: value.content,
        status: value.status,
        targeting: {},
      }
      if (value.starts_at) payload.starts_at = toUnixSeconds(value.starts_at)
      if (value.ends_at) payload.ends_at = toUnixSeconds(value.ends_at)

      saveMutation.mutate({
        isEdit,
        id: selectedAnnouncement?.id,
        payload,
      })
    },
  })

  const openCreate = () => {
    setIsEdit(false)
    setSelectedAnnouncement(null)
    form.reset()
    setShowFormDialog(true)
  }

  const openEdit = (ann: Announcement) => {
    setIsEdit(true)
    setSelectedAnnouncement(ann)
    form.reset({
      title: ann.title,
      content: ann.content,
      status: ann.status,
      starts_at: toDatetimeLocal(ann.starts_at),
      ends_at: toDatetimeLocal(ann.ends_at),
    })
    setShowFormDialog(true)
  }

  // ==================== Columns ====================

  const columns: ColumnDef<Announcement>[] = [
    {
      accessorKey: 'title',
      header: () => t('Title'),
      cell: ({ row }) => (
        <span className="max-w-[240px] truncate font-medium text-gray-900 dark:text-white">
          {row.original.title}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: () => t('Status'),
      size: 100,
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[row.original.status]}`}
        >
          {row.original.status}
        </span>
      ),
    },
    {
      accessorKey: 'starts_at',
      header: () => t('Starts'),
      size: 160,
      cell: ({ row }) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {formatDate(row.original.starts_at)}
        </span>
      ),
    },
    {
      accessorKey: 'ends_at',
      header: () => t('Ends'),
      size: 160,
      cell: ({ row }) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {formatDate(row.original.ends_at)}
        </span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: () => t('Created'),
      size: 160,
      cell: ({ row }) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {formatDate(row.original.created_at)}
        </span>
      ),
    },
  ]

  // ==================== Row Actions ====================

  function renderRowActions(ann: Announcement) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="sm" onClick={() => openEdit(ann)}>
          {t('Edit')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-red-500 hover:text-red-700"
          onClick={() => {
            setSelectedAnnouncement(ann)
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
    <div className="space-y-4">
      {/* Filters & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 min-w-[200px]">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Search announcements...')}
              className="pl-9"
            />
          </div>
          <Select
            value={filters.status ?? 'all'}
            onValueChange={(v) => setFilter('status', v === 'all' ? undefined : v)}
          >
            <SelectTrigger className="w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="all">{t('All Status')}</SelectItem>
              <SelectItem value="draft">{t('Draft')}</SelectItem>
              <SelectItem value="active">{t('Active')}</SelectItem>
              <SelectItem value="archived">{t('Archived')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setShowBulkDeleteDialog(true)}>
              <TrashIcon className="h-4 w-4 mr-1" />
              {t('common.delete', 'Delete')} ({selectedCount})
            </Button>
          )}
          <Button onClick={openCreate}>
            <PlusIcon className="mr-2 h-4 w-4" />
            {t('Create Announcement')}
          </Button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={announcements}
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
        spreadsheetTitle="Announcements"
        toolbar={
          <>
            <Button variant="ghost" size="icon-xs" onClick={refresh} title={t('Refresh')}>
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

      {/* Form Dialog (Create / Edit) */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEdit ? t('Edit Announcement') : t('Create Announcement')}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              form.handleSubmit()
            }}
            className="space-y-5 py-2"
          >
            <form.Field name="title">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('Title')} *</Label>
                  <Input
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={t('Announcement title')}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="content">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('Content')}</Label>
                  <Textarea
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    rows={5}
                    placeholder={t('Announcement content (supports Markdown)')}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="status">
              {(field) => (
                <div className="space-y-2">
                  <Label>{t('Status')}</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v as AnnouncementStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="draft">{t('Draft')}</SelectItem>
                      <SelectItem value="active">{t('Active')}</SelectItem>
                      <SelectItem value="archived">{t('Archived')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>
            <div className="grid grid-cols-2 gap-5">
              <form.Field name="starts_at">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('Starts At')}</Label>
                    <input
                      type="datetime-local"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="input-field w-full"
                    />
                  </div>
                )}
              </form.Field>
              <form.Field name="ends_at">
                {(field) => (
                  <div className="space-y-2">
                    <Label>{t('Ends At')}</Label>
                    <input
                      type="datetime-local"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="input-field w-full"
                    />
                  </div>
                )}
              </form.Field>
            </div>
          </form>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFormDialog(false)}
              disabled={saveMutation.isPending}
            >
              {t('Cancel')}
            </Button>
            <Button onClick={() => form.handleSubmit()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <div className="spinner h-4 w-4" />
              ) : isEdit ? (
                t('Save')
              ) : (
                t('Create')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open)
          if (!open) setSelectedAnnouncement(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete Announcement')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('Are you sure you want to delete announcement')}{' '}
              <strong>{selectedAnnouncement?.title}</strong>? {t('This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedAnnouncement && deleteMutation.mutate(selectedAnnouncement.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              {t('Delete')}
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
              Are you sure you want to delete <strong>{selectedCount}</strong> item(s)?
              This action cannot be undone.
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

      <DevTools page="announcements" />
    </div>
  )
}
