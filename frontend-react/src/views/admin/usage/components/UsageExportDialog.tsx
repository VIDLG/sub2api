/**
 * XLSX export dialog with progress bar and cancellation.
 * Fetches all matching records page-by-page and writes to Excel.
 */

import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { saveAs } from 'file-saver'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { adminAPI } from '@/api/admin'
import type { AdminUsageQueryParams } from '@/api/admin/usage'
import type { AdminUsageLog } from '@/types'
import { formatReasoningEffort } from '../utils/usageFormatters'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Committed query params (already has start_date, end_date, etc.) */
  queryParams: AdminUsageQueryParams
  totalRecords: number
}

interface ExportState {
  exporting: boolean
  current: number
  total: number
  progress: number
  estimatedTime: string
}

function resolveRequestTypeLabel(
  log: AdminUsageLog,
  t: (key: string, fallback: string) => string,
): string {
  const rt = log.request_type
  if (rt === 'ws_v2') return t('admin.usage.typeWs', 'WebSocket')
  if (rt === 'stream' || (!rt && log.stream)) return t('admin.usage.typeStream', 'Stream')
  if (rt === 'sync' || (!rt && !log.stream)) return t('admin.usage.typeSync', 'Sync')
  return t('common.unknown', 'Unknown')
}

export default function UsageExportDialog({
  open,
  onOpenChange,
  queryParams,
  totalRecords,
}: Props) {
  const { t } = useTranslation()
  const [state, setState] = useState<ExportState>({
    exporting: false,
    current: 0,
    total: 0,
    progress: 0,
    estimatedTime: '',
  })
  const abortRef = useRef<AbortController | null>(null)

  async function handleExport() {
    setState({ exporting: true, current: 0, total: totalRecords, progress: 0, estimatedTime: '' })
    const controller = new AbortController()
    abortRef.current = controller
    const startTime = Date.now()

    try {
      const XLSX = await import('xlsx')
      let page = 1
      let exported = 0
      let total = totalRecords

      const headers = [
        t('admin.usage.time', 'Time'),
        t('admin.usage.user', 'User'),
        t('admin.usage.apiKey', 'API Key'),
        t('admin.usage.account', 'Account'),
        t('admin.usage.modelCol', 'Model'),
        t('admin.usage.reasoningEffort', 'Reasoning'),
        t('admin.usage.group', 'Group'),
        t('admin.usage.requestType', 'Type'),
        t('admin.usage.inputTokens', 'Input Tokens'),
        t('admin.usage.outputTokens', 'Output Tokens'),
        t('admin.usage.cacheReadTokens', 'Cache Read Tokens'),
        t('admin.usage.cacheCreationTokens', 'Cache Creation Tokens'),
        t('admin.usage.inputCost', 'Input Cost'),
        t('admin.usage.outputCost', 'Output Cost'),
        t('admin.usage.cacheReadCost', 'Cache Read Cost'),
        t('admin.usage.cacheCreationCost', 'Cache Creation Cost'),
        t('admin.usage.rateMultiplier', 'Rate Multiplier'),
        t('admin.usage.accountMultiplier', 'Account Multiplier'),
        t('admin.usage.originalCost', 'Original Cost'),
        t('admin.usage.userBilled', 'User Billed'),
        t('admin.usage.accountBilled', 'Account Billed'),
        t('admin.usage.firstToken', 'First Token'),
        t('admin.usage.duration', 'Duration'),
        t('admin.usage.requestId', 'Request ID'),
        t('admin.usage.userAgent', 'User Agent'),
        t('admin.usage.ipAddress', 'IP Address'),
      ]
      const ws = XLSX.utils.aoa_to_sheet([headers])

      while (true) {
        if (controller.signal.aborted) break

        const res = await adminAPI.usage.list(
          { ...queryParams, page, page_size: 100 },
          { signal: controller.signal },
        )

        if (controller.signal.aborted) break

        if (page === 1) {
          total = res.total
        }

        const rows = (res.items ?? []).map((log: AdminUsageLog) => [
          log.created_at,
          log.user_email || log.user?.email || '',
          log.api_key_name || log.api_key?.name || '',
          log.account?.name || log.account_name || '',
          log.model,
          formatReasoningEffort(log.reasoning_effort),
          log.group?.name || '',
          resolveRequestTypeLabel(log, t),
          log.input_tokens,
          log.output_tokens,
          log.cache_read_tokens,
          log.cache_creation_tokens,
          log.input_cost?.toFixed(6) ?? '0.000000',
          log.output_cost?.toFixed(6) ?? '0.000000',
          log.cache_read_cost?.toFixed(6) ?? '0.000000',
          log.cache_creation_cost?.toFixed(6) ?? '0.000000',
          log.rate_multiplier?.toFixed(2) ?? '1.00',
          (log.account_rate_multiplier ?? 1).toFixed(2),
          log.total_cost?.toFixed(6) ?? '0.000000',
          log.actual_cost?.toFixed(6) ?? '0.000000',
          (log.total_cost * (log.account_rate_multiplier ?? 1)).toFixed(6),
          log.first_token_ms ?? '',
          log.duration_ms,
          log.request_id || '',
          log.user_agent || '',
          log.ip_address || '',
        ])

        if (rows.length) {
          XLSX.utils.sheet_add_aoa(ws, rows, { origin: -1 })
        }

        exported += rows.length
        const elapsed = (Date.now() - startTime) / 1000
        const rate = exported / elapsed
        const remaining = rate > 0 ? (total - exported) / rate : 0
        const est =
          remaining > 60
            ? `${Math.ceil(remaining / 60)} min`
            : remaining > 0
              ? `${Math.ceil(remaining)}s`
              : ''
        setState({
          exporting: true,
          current: exported,
          total,
          progress: total > 0 ? Math.min(100, Math.round((exported / total) * 100)) : 0,
          estimatedTime: est,
        })

        if (exported >= total || (res.items?.length ?? 0) < 100) break
        page++
      }

      if (!controller.signal.aborted) {
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Usage')
        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
        const blob = new Blob([buf], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        const filename = `usage_${queryParams.start_date || 'all'}_to_${queryParams.end_date || 'all'}.xlsx`
        saveAs(blob, filename)
        toast.success(t('admin.usage.exportSuccess', 'Export completed'))
        onOpenChange(false)
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // cancelled, no-op
      } else {
        console.error('Export failed:', err)
        toast.error(t('admin.usage.exportFailed', 'Export failed'))
      }
    } finally {
      abortRef.current = null
      setState({ exporting: false, current: 0, total: 0, progress: 0, estimatedTime: '' })
    }
  }

  function handleCancel() {
    abortRef.current?.abort()
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && state.exporting) {
      handleCancel()
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('admin.usage.exporting', 'Exporting')}</DialogTitle>
          <DialogDescription>
            {t('admin.usage.exportingProgress', 'Exporting usage records...')}
          </DialogDescription>
        </DialogHeader>

        {state.exporting ? (
          <div className="space-y-3 py-2">
            <Progress value={state.progress} className="h-2" />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{state.progress}%</span>
              <span>
                {state.current.toLocaleString()} / {state.total.toLocaleString()}
              </span>
            </div>
            {state.estimatedTime && (
              <div className="text-center text-xs text-muted-foreground">
                {t('admin.usage.estimatedTime', 'Estimated: {time}').replace(
                  '{time}',
                  state.estimatedTime,
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="py-4 text-center text-sm text-muted-foreground">
            {t('admin.usage.exportReady', 'Ready to export {count} records').replace(
              '{count}',
              totalRecords.toLocaleString(),
            )}
          </div>
        )}

        <DialogFooter>
          {state.exporting ? (
            <Button variant="destructive" size="sm" onClick={handleCancel}>
              {t('admin.usage.cancelExport', 'Cancel Export')}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button size="sm" onClick={handleExport}>
                {t('admin.usage.startExport', 'Start Export')}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
