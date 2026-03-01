/**
 * OpsErrorDetailModal
 * Shows a single error's full details: summary grid, response body, upstream errors.
 */

import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { opsAPI } from '@/api/admin/ops'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { RefreshIcon } from '@/components/icons'
import { useAppStore } from '@/stores/app'
import { formatDateTime, fmtMs } from '../utils/opsFormatters'

type ErrorType = 'request' | 'upstream'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  errorId: number | null
  errorType: ErrorType
}

function SummaryField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-gray-50 p-4 dark:bg-dark-900">
      <div className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</div>
      <div className="mt-1 text-sm text-gray-900 dark:text-white">{value ?? '—'}</div>
    </div>
  )
}

export function OpsErrorDetailModal({ open, onOpenChange, errorId, errorType }: Props) {
  const { t } = useTranslation()
  const showSuccess = useAppStore((s) => s.showSuccess)

  const detailFn =
    errorType === 'request' ? opsAPI.getRequestErrorDetail : opsAPI.getUpstreamErrorDetail

  const {
    data: detail,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['ops', 'errorDetail', errorType, errorId],
    queryFn: () => detailFn(errorId!),
    enabled: open && errorId != null,
  })

  // For request errors, fetch associated upstream errors
  const { data: upstreamErrors } = useQuery({
    queryKey: ['ops', 'errorDetailUpstream', errorId],
    queryFn: () => opsAPI.listRequestErrorUpstreamErrors(errorId!, { page_size: 50 }),
    enabled: open && errorId != null && errorType === 'request',
  })

  const upstreamItems = upstreamErrors?.items ?? []

  const copyRequestId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id)
      showSuccess(t('admin.ops.requestDetails.requestIdCopied', 'Request ID copied'))
    } catch {
      // ignore
    }
  }

  const formatJSON = (raw: string | null | undefined): string => {
    if (!raw) return ''
    try {
      return JSON.stringify(JSON.parse(raw), null, 2)
    } catch {
      return raw
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col sm:max-w-4xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div>
              <DialogTitle className="text-sm">
                {errorType === 'request'
                  ? t('admin.ops.errorDetail.requestError', 'Request Error Detail')
                  : t('admin.ops.errorDetail.upstreamError', 'Upstream Error Detail')}
                {errorId != null && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">#{errorId}</span>
                )}
              </DialogTitle>
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

        {detail ? (
          <div className="min-h-0 flex-1 space-y-6 overflow-auto p-1">
            {/* Summary Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryField
                label={t('admin.ops.errorDetail.requestId', 'Request ID')}
                value={
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="h-auto max-w-full truncate px-0 font-mono text-[10px] text-muted-foreground hover:text-blue-500"
                        onClick={() => copyRequestId(detail.request_id)}
                      >
                        {detail.request_id}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('admin.ops.requestDetails.copy', 'Copy')}</TooltipContent>
                  </Tooltip>
                }
              />
              <SummaryField
                label={t('admin.ops.requestDetails.table.time', 'Time')}
                value={formatDateTime(detail.created_at)}
              />
              <SummaryField
                label={t('admin.ops.errorDetails.account', 'Account')}
                value={detail.account_name || detail.user_email || '—'}
              />
              <SummaryField
                label={t('admin.ops.requestDetails.table.platform', 'Platform')}
                value={<span className="uppercase">{detail.platform ?? '—'}</span>}
              />
              <SummaryField
                label={t('admin.ops.errorDetails.group', 'Group')}
                value={detail.group_name || '—'}
              />
              <SummaryField
                label={t('admin.ops.requestDetails.table.model', 'Model')}
                value={detail.model ?? '—'}
              />
              <SummaryField
                label={t('admin.ops.requestDetails.table.status', 'Status')}
                value={
                  detail.status_code != null ? (
                    <Badge
                      variant={
                        detail.status_code >= 500
                          ? 'destructive'
                          : detail.status_code >= 400
                            ? 'outline'
                            : 'secondary'
                      }
                      className="text-[10px]"
                    >
                      {detail.status_code}
                    </Badge>
                  ) : (
                    '—'
                  )
                }
              />
              <SummaryField
                label={t('admin.ops.errorDetails.severity', 'Severity')}
                value={
                  <Badge
                    variant={detail.severity === 'critical' ? 'destructive' : 'outline'}
                    className="text-[10px]"
                  >
                    {detail.severity}
                  </Badge>
                }
              />
            </div>

            {/* Message */}
            <div className="rounded-xl bg-gray-50 p-6 dark:bg-dark-900">
              <h3 className="text-sm font-black uppercase text-gray-400">
                {t('admin.ops.errorDetails.message', 'Message')}
              </h3>
              <div className="mt-2 text-xs text-gray-800 dark:text-gray-200">
                {detail.message || '—'}
              </div>
            </div>

            {/* Latency Breakdown */}
            {(detail.auth_latency_ms != null ||
              detail.routing_latency_ms != null ||
              detail.upstream_latency_ms != null ||
              detail.response_latency_ms != null ||
              detail.time_to_first_token_ms != null) && (
              <div className="rounded-xl bg-gray-50 p-6 dark:bg-dark-900">
                <h3 className="text-sm font-black uppercase text-gray-400">
                  {t('admin.ops.errorDetail.latencyBreakdown', 'Latency Breakdown')}
                </h3>
                <div className="mt-2 flex flex-wrap gap-4 text-xs">
                  {detail.auth_latency_ms != null && (
                    <div>
                      <span className="text-gray-500">Auth:</span>{' '}
                      <span className="font-bold">{fmtMs(detail.auth_latency_ms)}</span>
                    </div>
                  )}
                  {detail.routing_latency_ms != null && (
                    <div>
                      <span className="text-gray-500">Routing:</span>{' '}
                      <span className="font-bold">{fmtMs(detail.routing_latency_ms)}</span>
                    </div>
                  )}
                  {detail.upstream_latency_ms != null && (
                    <div>
                      <span className="text-gray-500">Upstream:</span>{' '}
                      <span className="font-bold">{fmtMs(detail.upstream_latency_ms)}</span>
                    </div>
                  )}
                  {detail.response_latency_ms != null && (
                    <div>
                      <span className="text-gray-500">Response:</span>{' '}
                      <span className="font-bold">{fmtMs(detail.response_latency_ms)}</span>
                    </div>
                  )}
                  {detail.time_to_first_token_ms != null && (
                    <div>
                      <span className="text-gray-500">TTFT:</span>{' '}
                      <span className="font-bold">{fmtMs(detail.time_to_first_token_ms)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Response Body */}
            {detail.error_body && (
              <div className="rounded-xl bg-gray-50 p-6 dark:bg-dark-900">
                <h3 className="text-sm font-black uppercase text-gray-400">
                  {t('admin.ops.errorDetail.responseBody', 'Response Body')}
                </h3>
                <pre className="mt-4 max-h-[520px] overflow-auto rounded-xl bg-white p-4 font-mono text-xs text-gray-800 dark:bg-dark-800 dark:text-gray-200">
                  <code>{formatJSON(detail.error_body)}</code>
                </pre>
              </div>
            )}

            {/* Request Body (if available) */}
            {detail.request_body && (
              <div className="rounded-xl bg-gray-50 p-6 dark:bg-dark-900">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black uppercase text-gray-400">
                    {t('admin.ops.errorDetail.requestBody', 'Request Body')}
                  </h3>
                  {detail.request_body_truncated && (
                    <Badge variant="outline" className="text-[9px]">
                      {t('admin.ops.errorDetail.truncated', 'Truncated')}
                    </Badge>
                  )}
                </div>
                <pre className="mt-4 max-h-[320px] overflow-auto rounded-xl bg-white p-4 font-mono text-xs text-gray-800 dark:bg-dark-800 dark:text-gray-200">
                  <code>{formatJSON(detail.request_body)}</code>
                </pre>
              </div>
            )}

            {/* Upstream Errors (for request errors) */}
            {errorType === 'request' && upstreamItems.length > 0 && (
              <div className="rounded-xl bg-gray-50 p-6 dark:bg-dark-900">
                <h3 className="text-sm font-black uppercase text-gray-400">
                  {t('admin.ops.errorDetail.upstreamErrors', 'Associated Upstream Errors')} (
                  {upstreamItems.length})
                </h3>
                <div className="mt-4 space-y-3">
                  {upstreamItems.map((ue, idx) => (
                    <div
                      key={ue.id}
                      className="rounded-xl border border-gray-200 bg-white p-4 text-xs dark:border-dark-700 dark:bg-dark-800"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-700 dark:text-gray-300">
                            #{idx + 1}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {ue.severity ?? ue.type}
                          </Badge>
                          <span className="tabular-nums text-gray-500">
                            {formatDateTime(ue.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {ue.status_code != null && (
                            <Badge
                              variant={ue.status_code >= 500 ? 'destructive' : 'outline'}
                              className="text-[10px]"
                            >
                              {ue.status_code}
                            </Badge>
                          )}
                          <span className="uppercase text-gray-500">{ue.platform ?? '—'}</span>
                        </div>
                      </div>
                      <div className="mt-2 text-gray-600 dark:text-gray-400">
                        {ue.message || '—'}
                      </div>
                      {ue.account_name && (
                        <div className="mt-1 text-[10px] text-gray-500">
                          {t('admin.ops.errorDetails.account', 'Account')}: {ue.account_name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : isFetching ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {t('common.loading', 'Loading...')}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {t('admin.ops.requestDetails.empty', 'No requests found')}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
