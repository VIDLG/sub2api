/**
 * OpsErrorDetailsModal
 * Full-width modal showing paginated error logs with filter panel.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useDebounceFn } from 'ahooks'
import { opsAPI } from '@/api/admin/ops'
import type { OpsErrorListQueryParams, OpsErrorListView } from '@/api/admin/ops'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { RefreshIcon, SearchIcon } from '@/components/icons'
import { Pagination } from '@/components/common/Pagination'
import { formatDateTime, parseTimeRangeMinutes } from '../utils/opsFormatters'

type ErrorType = 'request' | 'upstream'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  timeRange: string
  platform?: string
  groupId?: number | null
  errorType: ErrorType
  onOpenErrorDetail: (errorId: number) => void
}

const STATUS_CODE_OPTIONS = ['all', '400', '401', '403', '429', '500', '502', '503', '529'] as const
const PHASE_OPTIONS = ['all', 'auth', 'routing', 'upstream', 'billing', 'response'] as const
const OWNER_OPTIONS = ['all', 'client', 'provider', 'platform'] as const
const VIEW_OPTIONS: { value: OpsErrorListView; label: string }[] = [
  { value: 'errors', label: 'Errors Only' },
  { value: 'excluded', label: 'Excluded Only' },
  { value: 'all', label: 'All' },
]

export function OpsErrorDetailsModal({
  open,
  onOpenChange,
  timeRange,
  platform,
  groupId,
  errorType,
  onOpenErrorDetail,
}: Props) {
  const { t } = useTranslation()

  const [page, setPage] = useState(1)
  const pageSize = 10

  // Filter state
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusCode, setStatusCode] = useState('all')
  const [phase, setPhase] = useState('all')
  const [errorOwner, setErrorOwner] = useState('all')
  const [viewMode, setViewMode] = useState<OpsErrorListView>('errors')

  const { run: debouncedSetSearch } = useDebounceFn(
    (val: string) => {
      setDebouncedSearch(val)
      setPage(1)
    },
    { wait: 350 },
  )

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [timeRange, platform, groupId, errorType, statusCode, phase, errorOwner, viewMode])

  // Reset all filters when modal opens or errorType changes
  useEffect(() => {
    if (open) {
      setSearch('')
      setDebouncedSearch('')
      setStatusCode('all')
      setPhase('all')
      setErrorOwner('all')
      setViewMode('errors')
      setPage(1)
    }
  }, [open, errorType])

  const buildParams = (): OpsErrorListQueryParams => {
    const minutes = parseTimeRangeMinutes(timeRange)
    const now = new Date()
    const start = new Date(now.getTime() - minutes * 60 * 1000)

    const params: OpsErrorListQueryParams = {
      start_time: start.toISOString(),
      end_time: now.toISOString(),
      page,
      page_size: pageSize,
      platform: platform || undefined,
      group_id: groupId ?? undefined,
      view: viewMode,
    }

    if (debouncedSearch) params.q = debouncedSearch
    if (statusCode !== 'all') params.status_codes = statusCode
    if (phase !== 'all') params.phase = phase
    if (errorOwner !== 'all') params.error_owner = errorOwner

    return params
  }

  const listFn = errorType === 'request' ? opsAPI.listRequestErrors : opsAPI.listUpstreamErrors

  const { data, isFetching, refetch } = useQuery({
    queryKey: [
      'ops',
      'errorDetails',
      errorType,
      timeRange,
      platform,
      groupId,
      debouncedSearch,
      statusCode,
      phase,
      errorOwner,
      viewMode,
      page,
    ],
    queryFn: () => listFn(buildParams()),
    enabled: open,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0

  const resetFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setStatusCode('all')
    setPhase('all')
    setErrorOwner('all')
    setViewMode('errors')
    setPage(1)
  }

  const rangeMinutes = parseTimeRangeMinutes(timeRange)
  const rangeLabel =
    rangeMinutes >= 60
      ? t('admin.ops.requestDetails.rangeHours', '{{hours}} hours', { hours: rangeMinutes / 60 })
      : t('admin.ops.requestDetails.rangeMinutes', '{{minutes}} minutes', {
          minutes: rangeMinutes,
        })

  const modalTitle =
    errorType === 'request'
      ? t('admin.ops.errorDetails.requestErrors', 'Request Errors')
      : t('admin.ops.errorDetails.upstreamErrors', 'Upstream Errors')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col sm:max-w-4xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div>
              <DialogTitle className="text-sm">{modalTitle}</DialogTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('admin.ops.requestDetails.rangeLabel', 'Window')}: {rangeLabel}
              </p>
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

        {/* Filter Panel */}
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-2 border-b border-gray-100 pb-4 dark:border-dark-700">
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder={t('admin.ops.errorDetails.search', 'Search message...')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                debouncedSetSearch(e.target.value)
              }}
              className="h-8 pl-9 text-xs"
            />
          </div>

          <Select value={statusCode} onValueChange={setStatusCode}>
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent position="popper">
              {STATUS_CODE_OPTIONS.map((sc) => (
                <SelectItem key={sc} value={sc}>
                  {sc === 'all' ? t('common.all', 'All') : sc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={phase} onValueChange={setPhase}>
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue placeholder="Phase" />
            </SelectTrigger>
            <SelectContent position="popper">
              {PHASE_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p === 'all' ? t('common.all', 'All') : p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={errorOwner} onValueChange={setErrorOwner}>
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue placeholder="Owner" />
            </SelectTrigger>
            <SelectContent position="popper">
              {OWNER_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>
                  {o === 'all' ? t('common.all', 'All') : o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={viewMode} onValueChange={(v) => setViewMode(v as OpsErrorListView)}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue placeholder="View" />
            </SelectTrigger>
            <SelectContent position="popper">
              {VIEW_OPTIONS.map((v) => (
                <SelectItem key={v.value} value={v.value}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="ghost" size="xs" onClick={resetFilters}>
            {t('common.reset', 'Reset')}
          </Button>
        </div>

        {/* Total count */}
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {t('common.total', 'Total')}: {total}
        </div>

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.ops.requestDetails.table.time', 'Time')}</TableHead>
                <TableHead>{t('admin.ops.errorDetails.type', 'Type')}</TableHead>
                <TableHead>{t('admin.ops.requestDetails.table.platform', 'Platform')}</TableHead>
                <TableHead>{t('admin.ops.requestDetails.table.model', 'Model')}</TableHead>
                <TableHead>{t('admin.ops.errorDetails.group', 'Group')}</TableHead>
                <TableHead>{t('admin.ops.errorDetails.account', 'Account')}</TableHead>
                <TableHead>{t('admin.ops.requestDetails.table.status', 'Status')}</TableHead>
                <TableHead>{t('admin.ops.errorDetails.message', 'Message')}</TableHead>
                <TableHead>{t('admin.ops.requestDetails.table.actions', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatDateTime(row.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={row.severity === 'critical' ? 'destructive' : 'outline'}
                      className="text-[10px]"
                    >
                      {row.severity ?? row.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="uppercase">{row.platform ?? '—'}</TableCell>
                  <TableCell className="max-w-[140px] truncate" title={row.model}>
                    {row.model ?? '—'}
                  </TableCell>
                  <TableCell>{row.group_name || '—'}</TableCell>
                  <TableCell>{row.account_name || row.user_email || '—'}</TableCell>
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
                        <span className="block max-w-[200px] truncate text-muted-foreground">
                          {row.message || '—'}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm text-xs">{row.message}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="link"
                      size="xs"
                      className="h-auto p-0 text-[10px]"
                      onClick={() => {
                        onOpenChange(false)
                        onOpenErrorDetail(row.id)
                      }}
                    >
                      {t('admin.ops.requestDetails.details', 'Details')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!isFetching && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
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
