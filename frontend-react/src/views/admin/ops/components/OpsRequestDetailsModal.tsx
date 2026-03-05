/**
 * OpsRequestDetailsModal
 * Full-width modal showing paginated request logs with kind/sort presets.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { opsAPI } from '@/api/admin/ops'
import type { OpsRequestDetailsParams } from '@/api/admin/ops'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { RefreshIcon } from '@/components/icons'
import { Pagination } from '@/components/common/Pagination'
import { useAppStore } from '@/stores/app'
import { formatDateTime, parseTimeRangeMinutes } from '../utils/opsFormatters'
import type { OpsRequestDetailsPreset } from './OpsHeaderSection'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  timeRange: string
  preset: OpsRequestDetailsPreset
  platform?: string
  groupId?: number | null
  onOpenErrorDetail: (errorId: number) => void
}

export function OpsRequestDetailsModal({
  open,
  onOpenChange,
  timeRange,
  preset,
  platform,
  groupId,
  onOpenErrorDetail,
}: Props) {
  const { t } = useTranslation()
  const showSuccess = useAppStore((s) => s.showSuccess)

  const [page, setPage] = useState(1)
  const pageSize = 10

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [timeRange, platform, groupId, preset.kind, preset.sort])

  // Build API params
  const buildParams = (): OpsRequestDetailsParams => {
    const minutes = parseTimeRangeMinutes(timeRange)
    const now = new Date()
    const start = new Date(now.getTime() - minutes * 60 * 1000)

    return {
      start_time: start.toISOString(),
      end_time: now.toISOString(),
      page,
      page_size: pageSize,
      kind: preset.kind ?? 'all',
      sort: preset.sort ?? 'created_at_desc',
      platform: platform || undefined,
      group_id: groupId ?? undefined,
      min_duration_ms: preset.min_duration_ms,
      max_duration_ms: preset.max_duration_ms,
    }
  }

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['ops', 'requestDetails', timeRange, platform, groupId, preset, page],
    queryFn: () => opsAPI.listRequestDetails(buildParams()),
    enabled: open,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0

  const copyRequestId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id)
      showSuccess(t('admin.ops.requestDetails.requestIdCopied', 'Request ID copied'))
    } catch {
      // ignore
    }
  }

  const rangeMinutes = parseTimeRangeMinutes(timeRange)
  const rangeInner =
    rangeMinutes >= 60
      ? t('admin.ops.requestDetails.rangeHours', '{n} hours', { n: rangeMinutes / 60 })
      : t('admin.ops.requestDetails.rangeMinutes', '{n} minutes', { n: rangeMinutes })
  const rangeLabel = t('admin.ops.requestDetails.rangeLabel', 'Window: {range}', {
    range: rangeInner,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col sm:max-w-4xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div>
              <DialogTitle className="text-sm">{preset.title}</DialogTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">{rangeLabel}</p>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              <RefreshIcon className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </DialogHeader>

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.ops.requestDetails.table.time', 'Time')}</TableHead>
                <TableHead>{t('admin.ops.requestDetails.table.kind', 'Kind')}</TableHead>
                <TableHead>{t('admin.ops.requestDetails.table.platform', 'Platform')}</TableHead>
                <TableHead>{t('admin.ops.requestDetails.table.model', 'Model')}</TableHead>
                <TableHead>{t('admin.ops.requestDetails.table.duration', 'Duration')}</TableHead>
                <TableHead>{t('admin.ops.requestDetails.table.status', 'Status')}</TableHead>
                <TableHead>{t('admin.ops.requestDetails.table.requestId', 'Request ID')}</TableHead>
                <TableHead>{t('admin.ops.requestDetails.table.actions', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={`${row.request_id}-${row.created_at}`}>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatDateTime(row.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={row.kind === 'error' ? 'destructive' : 'outline'}
                      className="text-[10px]"
                    >
                      {row.kind === 'error' ? 'error' : 'success'}
                    </Badge>
                  </TableCell>
                  <TableCell className="uppercase">{row.platform ?? '—'}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={row.model}>
                    {row.model ?? '—'}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {row.duration_ms != null ? `${row.duration_ms} ms` : '—'}
                  </TableCell>
                  <TableCell>
                    {row.status_code != null ? (
                      <Badge
                        variant={
                          row.status_code >= 500
                            ? 'destructive'
                            : row.status_code >= 400
                              ? 'outline'
                              : 'secondary'
                        }
                        className="text-[10px]"
                      >
                        {row.status_code}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="h-auto max-w-[120px] truncate px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                          onClick={() => copyRequestId(row.request_id)}
                        >
                          {row.request_id}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('admin.ops.requestDetails.copy', 'Copy')}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    {row.kind === 'error' && row.error_id != null && (
                      <Button
                        variant="destructive"
                        size="xs"
                        className="h-auto px-2 py-1 text-[10px]"
                        onClick={() => {
                          onOpenChange(false)
                          onOpenErrorDetail(row.error_id!)
                        }}
                      >
                        {t('admin.ops.requestDetails.viewError', 'View Error')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!isFetching && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    {t('admin.ops.requestDetails.empty', 'No requests found')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {total > pageSize && (
          <Pagination
            page={page}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            showPageSizeSelector={false}
            showJump={false}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
