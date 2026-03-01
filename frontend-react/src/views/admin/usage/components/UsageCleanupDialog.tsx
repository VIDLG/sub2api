/**
 * Cleanup task management dialog.
 * Allows submitting cleanup tasks with filters and viewing/canceling recent tasks.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useInterval } from 'ahooks'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Badge } from '@/components/ui/badge'
import { RefreshIcon, XMarkIcon } from '@/components/icons'
import { adminAPI } from '@/api/admin'
import type { UsageCleanupTask } from '@/api/admin/usage'
import type { UsageFilterState } from './UsageFilters'
import UsageFilters from './UsageFilters'
import { formatDateTime } from '../utils/usageFormatters'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Current parent filters (copied on open) */
  parentFilters: UsageFilterState
  dateFrom: string
  dateTo: string
}

const STATUS_STYLES: Record<
  string,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }
> = {
  pending: {
    variant: 'outline',
    className: 'border-amber-300 text-amber-700 dark:border-amber-600 dark:text-amber-400',
  },
  running: {
    variant: 'outline',
    className: 'border-blue-300 text-blue-700 dark:border-blue-600 dark:text-blue-400',
  },
  succeeded: {
    variant: 'outline',
    className: 'border-emerald-300 text-emerald-700 dark:border-emerald-600 dark:text-emerald-400',
  },
  failed: {
    variant: 'outline',
    className: 'border-rose-300 text-rose-700 dark:border-rose-600 dark:text-rose-400',
  },
  canceled: {
    variant: 'outline',
    className: 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400',
  },
}

export default function UsageCleanupDialog({
  open,
  onOpenChange,
  parentFilters,
  dateFrom,
  dateTo,
}: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // Local filter state (copied from parent on open)
  const [filters, setFilters] = useState<UsageFilterState>({})
  const [localDatePreset, setLocalDatePreset] = useState('7d')
  const [localDateFrom, setLocalDateFrom] = useState(dateFrom)
  const [localDateTo, setLocalDateTo] = useState(dateTo)

  // Task list pagination
  const [taskPage, setTaskPage] = useState(1)
  const taskPageSize = 5

  // Confirmation dialogs
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [cancelTaskId, setCancelTaskId] = useState<number | null>(null)

  // Copy parent filters when dialog opens
  useEffect(() => {
    if (open) {
      setFilters({ ...parentFilters })
      setLocalDateFrom(dateFrom)
      setLocalDateTo(dateTo)
    }
  }, [open, parentFilters, dateFrom, dateTo])

  // Fetch recent tasks
  const tasksQuery = useQuery({
    queryKey: ['admin', 'usage', 'cleanup-tasks', taskPage],
    queryFn: () => adminAPI.usage.listCleanupTasks({ page: taskPage, page_size: taskPageSize }),
    enabled: open,
    refetchInterval: false,
  })

  // Auto-poll every 10s while open
  useInterval(
    () => {
      if (open) {
        tasksQuery.refetch()
      }
    },
    open ? 10_000 : undefined,
  )

  const tasks = tasksQuery.data?.items ?? []

  // Create cleanup task mutation
  const createMutation = useMutation({
    mutationFn: () =>
      adminAPI.usage.createCleanupTask({
        start_date: localDateFrom,
        end_date: localDateTo,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        user_id: filters.user_id,
        api_key_id: filters.api_key_id,
        account_id: filters.account_id,
        group_id: filters.group_id,
        model: filters.model ?? null,
        stream: filters.stream ?? null,
        billing_type: filters.billing_type != null ? Number(filters.billing_type) : null,
      }),
    onSuccess: () => {
      toast.success(t('admin.usage.cleanupSubmitSuccess', 'Cleanup task submitted'))
      queryClient.invalidateQueries({ queryKey: ['admin', 'usage', 'cleanup-tasks'] })
    },
    onError: () => {
      toast.error(t('admin.usage.cleanupSubmitFailed', 'Failed to submit cleanup task'))
    },
  })

  // Cancel cleanup task mutation
  const cancelMutation = useMutation({
    mutationFn: (taskId: number) => adminAPI.usage.cancelCleanupTask(taskId),
    onSuccess: () => {
      toast.success(t('admin.usage.cleanupCancelSuccess', 'Cleanup task canceled'))
      queryClient.invalidateQueries({ queryKey: ['admin', 'usage', 'cleanup-tasks'] })
    },
    onError: () => {
      toast.error(t('admin.usage.cleanupCancelFailed', 'Failed to cancel task'))
    },
  })

  function handleSubmit() {
    if (!localDateFrom || !localDateTo) {
      toast.error(t('admin.usage.cleanupMissingRange', 'Please select a date range'))
      return
    }
    setConfirmSubmit(true)
  }

  function handleConfirmSubmit() {
    setConfirmSubmit(false)
    createMutation.mutate()
  }

  function handleCancelTask() {
    if (cancelTaskId != null) {
      cancelMutation.mutate(cancelTaskId)
      setCancelTaskId(null)
    }
  }

  function handleDateChange(preset: string, range?: { from: string; to: string }) {
    setLocalDatePreset(preset)
    if (range) {
      setLocalDateFrom(range.from)
      setLocalDateTo(range.to)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('admin.usage.cleanupTitle', 'Cleanup Usage Records')}</DialogTitle>
            <DialogDescription>
              {t(
                'admin.usage.cleanupDescription',
                'Submit a cleanup task to delete matching usage records.',
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Warning banner */}
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
            {t(
              'admin.usage.cleanupWarning',
              'Cleanup is irreversible and will affect historical statistics. Please proceed with caution.',
            )}
          </div>

          {/* Filters section */}
          <UsageFilters
            filters={filters}
            onFiltersChange={setFilters}
            datePreset={localDatePreset}
            dateFrom={localDateFrom}
            dateTo={localDateTo}
            onDateChange={handleDateChange}
            onReset={() => setFilters({})}
            onRefresh={() => {}}
            onExport={() => {}}
            onCleanup={() => {}}
            exporting={false}
            showActions={false}
          />

          {/* Recent tasks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">
                {t('admin.usage.cleanupRecentTasks', 'Recent Tasks')}
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => tasksQuery.refetch()}
                className="h-7 gap-1 text-xs"
              >
                <RefreshIcon className="h-3.5 w-3.5" />
              </Button>
            </div>

            {tasksQuery.isLoading ? (
              <div className="py-6 text-center">
                <div className="spinner mx-auto" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {t('admin.usage.cleanupNoTasks', 'No cleanup tasks yet')}
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <TaskCard key={task.id} task={task} onCancel={(id) => setCancelTaskId(id)} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {(tasksQuery.data?.total ?? 0) > taskPageSize && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={taskPage <= 1}
                  onClick={() => setTaskPage((p) => p - 1)}
                  className="h-7 px-2 text-xs"
                >
                  ←
                </Button>
                <span className="text-xs text-muted-foreground">
                  {taskPage} / {Math.ceil((tasksQuery.data?.total ?? 0) / taskPageSize)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={taskPage >= Math.ceil((tasksQuery.data?.total ?? 0) / taskPageSize)}
                  onClick={() => setTaskPage((p) => p + 1)}
                  className="h-7 px-2 text-xs"
                >
                  →
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleSubmit}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending
                ? t('admin.usage.cleanupSubmitting', 'Submitting...')
                : t('admin.usage.cleanupSubmit', 'Submit Cleanup')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm submit dialog */}
      <AlertDialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('admin.usage.cleanupConfirmTitle', 'Confirm Cleanup')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'admin.usage.cleanupConfirmMessage',
                'Are you sure you want to submit this cleanup task? This action cannot be undone.',
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSubmit}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('admin.usage.cleanupConfirmSubmit', 'Confirm Cleanup')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm cancel task dialog */}
      <AlertDialog open={cancelTaskId != null} onOpenChange={(v) => !v && setCancelTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('admin.usage.cleanupCancelConfirmTitle', 'Cancel Task')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'admin.usage.cleanupCancelConfirmMessage',
                'Are you sure you want to cancel this cleanup task?',
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelTask}>
              {t('admin.usage.cleanupCancelConfirm', 'Confirm Cancel')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ==================== Task Card ====================

function TaskCard({ task, onCancel }: { task: UsageCleanupTask; onCancel: (id: number) => void }) {
  const { t } = useTranslation()
  const style = STATUS_STYLES[task.status] ?? STATUS_STYLES.pending
  const canCancel = task.status === 'pending' || task.status === 'running'

  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={style.variant} className={`text-xs ${style.className}`}>
            {t(`admin.usage.cleanupStatus.${task.status}`, task.status)}
          </Badge>
          <span className="text-xs text-muted-foreground">#{task.id}</span>
        </div>
        {canCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCancel(task.id)}
            className="h-6 px-1.5 text-xs text-destructive hover:text-destructive"
          >
            <XMarkIcon className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
        <div>
          {t('admin.usage.cleanupRange', 'Range')}: {task.filters.start_time?.slice(0, 10)} →{' '}
          {task.filters.end_time?.slice(0, 10)}
        </div>
        {task.deleted_rows > 0 && (
          <div>
            {t('admin.usage.cleanupDeletedRows', 'Deleted')}: {task.deleted_rows.toLocaleString()}
          </div>
        )}
        {task.error_message && (
          <div className="text-rose-600 dark:text-rose-400">{task.error_message}</div>
        )}
        <div>{formatDateTime(task.created_at)}</div>
      </div>
    </div>
  )
}
