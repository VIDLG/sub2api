/**
 * OpsErrorLogTable
 * Presentational table for error logs with type badges, smart messages, and pagination.
 */

import { useTranslation } from 'react-i18next'
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
import { Pagination } from '@/components/common/Pagination'
import type { OpsErrorLog } from '@/api/admin/ops'
import { formatDateTime } from '../utils/opsFormatters'

interface Props {
  rows: OpsErrorLog[]
  total: number
  loading: boolean
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onOpenErrorDetail: (id: number) => void
}

function getTypeBadge(
  log: OpsErrorLog,
  t: (key: string, fallback?: string) => string,
): { label: string; className: string } {
  const phase = log.phase
  const owner = log.error_owner

  if (phase === 'upstream' && owner === 'provider') {
    return {
      label: t('admin.ops.errorLog.typeUpstream', 'Upstream'),
      className:
        'bg-red-100 text-red-700 ring-red-600/10 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-400/20',
    }
  }
  if (phase === 'request' && owner === 'client') {
    return {
      label: t('admin.ops.errorLog.typeRequest', 'Request'),
      className:
        'bg-amber-100 text-amber-700 ring-amber-600/10 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-400/20',
    }
  }
  if (phase === 'auth' && owner === 'client') {
    return {
      label: t('admin.ops.errorLog.typeAuth', 'Auth'),
      className:
        'bg-blue-100 text-blue-700 ring-blue-600/10 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-400/20',
    }
  }
  if (phase === 'routing' && owner === 'platform') {
    return {
      label: t('admin.ops.errorLog.typeRouting', 'Routing'),
      className:
        'bg-purple-100 text-purple-700 ring-purple-600/10 dark:bg-purple-900/30 dark:text-purple-300 dark:ring-purple-400/20',
    }
  }
  if (phase === 'internal' && owner === 'platform') {
    return {
      label: t('admin.ops.errorLog.typeInternal', 'Internal'),
      className:
        'bg-gray-100 text-gray-700 ring-gray-600/10 dark:bg-gray-700 dark:text-gray-300 dark:ring-gray-400/20',
    }
  }
  return {
    label: phase || owner || t('common.unknown', 'Unknown'),
    className:
      'bg-gray-100 text-gray-600 ring-gray-500/10 dark:bg-gray-700 dark:text-gray-400 dark:ring-gray-500/20',
  }
}

function formatSmartMessage(msg: string | null | undefined): string {
  if (!msg) return ''
  // Try to extract structured error message
  try {
    const parsed = JSON.parse(msg)
    if (typeof parsed === 'object') {
      return parsed.error?.message ?? parsed.message ?? parsed.detail ?? msg
    }
  } catch {
    // not JSON
  }
  // Known patterns
  if (msg.includes('context deadline exceeded') || msg.includes('context canceled')) {
    return 'Context deadline exceeded / canceled'
  }
  if (msg.includes('connection refused')) {
    return 'Connection refused'
  }
  if (msg.includes('rate limit') || msg.includes('Rate limit')) {
    return 'Rate limit exceeded'
  }
  return msg.length > 120 ? msg.slice(0, 120) + '…' : msg
}

function isUpstreamRow(log: OpsErrorLog): boolean {
  return log.phase === 'upstream' && log.error_owner === 'provider'
}

export function OpsErrorLogTable({
  rows,
  total,
  loading,
  page,
  pageSize,
  onPageChange,
  onOpenErrorDetail,
}: Props) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="size-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
      </div>
    )
  }

  return (
    <div>
      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.ops.errorLog.time', 'Time')}</TableHead>
              <TableHead>{t('admin.ops.errorLog.type', 'Type')}</TableHead>
              <TableHead>{t('admin.ops.errorLog.platform', 'Platform')}</TableHead>
              <TableHead>{t('admin.ops.errorLog.model', 'Model')}</TableHead>
              <TableHead>{t('admin.ops.errorLog.group', 'Group')}</TableHead>
              <TableHead>
                {isUpstreamRow(rows[0] ?? {})
                  ? t('admin.ops.errorLog.accountId', 'Account')
                  : t('admin.ops.errorLog.user', 'User')}
              </TableHead>
              <TableHead>{t('admin.ops.errorLog.status', 'Status')}</TableHead>
              <TableHead>{t('admin.ops.errorLog.message', 'Message')}</TableHead>
              <TableHead>{t('admin.ops.errorLog.action', 'Action')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const badge = getTypeBadge(row, t)
              const upstream = isUpstreamRow(row)
              return (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => onOpenErrorDetail(row.id)}
                >
                  <TableCell className="tabular-nums text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>{formatDateTime(row.created_at).split(' ')[1]}</span>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">
                        {row.request_id ||
                          row.client_request_id ||
                          t('admin.ops.errorLog.id', 'ID')}
                        : {row.id}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${badge.className}`}>
                      {badge.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {row.platform ?? '—'}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate font-mono">
                    {row.model ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>{row.group_name ?? '—'}</span>
                      </TooltipTrigger>
                      {row.group_id != null && (
                        <TooltipContent className="text-xs">ID: {row.group_id}</TooltipContent>
                      )}
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    {upstream ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{row.account_name ?? '—'}</span>
                        </TooltipTrigger>
                        {row.account_id != null && (
                          <TooltipContent className="text-xs">ID: {row.account_id}</TooltipContent>
                        )}
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{row.user_email ?? '—'}</span>
                        </TooltipTrigger>
                        {row.user_id != null && (
                          <TooltipContent className="text-xs">ID: {row.user_id}</TooltipContent>
                        )}
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {row.status_code != null && (
                        <Badge
                          variant={
                            row.status_code >= 500
                              ? 'destructive'
                              : row.status_code === 429
                                ? 'outline'
                                : 'secondary'
                          }
                          className="text-[10px]"
                        >
                          {row.status_code}
                        </Badge>
                      )}
                      {row.severity && (
                        <Badge
                          variant={
                            row.severity === 'critical'
                              ? 'destructive'
                              : row.severity === 'warning'
                                ? 'outline'
                                : 'secondary'
                          }
                          className="text-[10px]"
                        >
                          {row.severity}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell
                    className="max-w-[200px] truncate text-muted-foreground"
                    title={row.message ?? ''}
                  >
                    {formatSmartMessage(row.message)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="link"
                      size="xs"
                      className="h-auto p-0 text-[10px]"
                      onClick={() => onOpenErrorDetail(row.id)}
                    >
                      {t('admin.ops.errorLog.details', 'Details')}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                  {t('admin.ops.errorLog.noErrors', 'No errors')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 && (
        <Pagination
          page={page}
          total={total}
          pageSize={pageSize}
          onPageChange={onPageChange}
          showPageSizeSelector={false}
          showJump={false}
        />
      )}
    </div>
  )
}
