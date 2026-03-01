/**
 * Usage table column definitions for @tanstack/react-table.
 * Provides cell renderers with token/cost tooltips.
 */

import { type ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import type { AdminUsageLog } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  formatTokens,
  formatCacheTokens,
  formatCostPrecise,
  formatDuration,
  formatDateTime,
  formatReasoningEffort,
  resolveRequestType,
} from '../utils/usageFormatters'

/**
 * Hook that returns the column definitions for the usage table.
 * Must be called inside a component (uses useTranslation).
 */
export function useUsageColumns(): ColumnDef<AdminUsageLog>[] {
  const { t } = useTranslation()

  const columns: ColumnDef<AdminUsageLog>[] = [
    {
      id: 'user',
      header: () => t('admin.usage.user', 'User'),
      cell: ({ row }) => {
        const log = row.original
        const email = log.user_email || log.user?.email
        return (
          <div>
            <div className="max-w-[140px] truncate text-sm" title={email || ''}>
              {email || '-'}
            </div>
            <div className="text-xs text-muted-foreground">#{log.user_id}</div>
          </div>
        )
      },
    },
    {
      id: 'api_key',
      header: () => t('admin.usage.apiKey', 'API Key'),
      cell: ({ row }) => {
        const name = row.original.api_key_name || row.original.api_key?.name
        return (
          <div className="max-w-[120px] truncate text-sm" title={name || ''}>
            {name || '-'}
          </div>
        )
      },
    },
    {
      id: 'account',
      header: () => t('admin.usage.account', 'Account'),
      cell: ({ row }) => {
        const name = row.original.account?.name || row.original.account_name
        return (
          <div className="max-w-[120px] truncate text-sm" title={name || ''}>
            {name || '-'}
          </div>
        )
      },
    },
    {
      id: 'model',
      accessorKey: 'model',
      header: () => t('admin.usage.modelCol', 'Model'),
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.original.model || '-'}</span>
      ),
    },
    {
      id: 'reasoning_effort',
      header: () => t('admin.usage.reasoningEffort', 'Reasoning'),
      cell: ({ row }) => (
        <span className="text-sm">{formatReasoningEffort(row.original.reasoning_effort)}</span>
      ),
    },
    {
      id: 'group',
      header: () => t('admin.usage.group', 'Group'),
      cell: ({ row }) => {
        const group = row.original.group
        return group ? (
          <Badge
            variant="outline"
            className="border-indigo-300 text-indigo-700 dark:border-indigo-600 dark:text-indigo-400 text-xs"
          >
            {group.name}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )
      },
    },
    {
      id: 'request_type',
      header: () => t('admin.usage.requestType', 'Type'),
      cell: ({ row }) => {
        const info = resolveRequestType(row.original)
        return (
          <Badge variant={info.variant} className={`text-xs ${info.className}`}>
            {info.label}
          </Badge>
        )
      },
    },
    {
      id: 'tokens',
      header: () => t('admin.usage.tokens', 'Tokens'),
      cell: ({ row }) => <TokensCell log={row.original} />,
    },
    {
      id: 'cost',
      header: () => t('admin.usage.cost', 'Cost'),
      cell: ({ row }) => <CostCell log={row.original} />,
    },
    {
      id: 'first_token',
      header: () => t('admin.usage.firstToken', 'First Token'),
      cell: ({ row }) => (
        <span className="text-xs">{formatDuration(row.original.first_token_ms)}</span>
      ),
    },
    {
      id: 'duration',
      header: () => t('admin.usage.duration', 'Duration'),
      cell: ({ row }) => (
        <span className="text-xs">{formatDuration(row.original.duration_ms)}</span>
      ),
    },
    {
      id: 'created_at',
      accessorKey: 'created_at',
      header: () => t('admin.usage.time', 'Time'),
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    },
    {
      id: 'user_agent',
      header: () => t('admin.usage.userAgent', 'User Agent'),
      cell: ({ row }) => (
        <div
          className="max-w-[200px] truncate text-xs text-muted-foreground"
          title={row.original.user_agent || ''}
        >
          {row.original.user_agent || '-'}
        </div>
      ),
    },
    {
      id: 'ip_address',
      header: () => t('admin.usage.ipAddress', 'IP Address'),
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.ip_address || '-'}</span>
      ),
    },
  ]

  return columns
}

// ==================== Complex Cell Components ====================

function TokensCell({ log }: { log: AdminUsageLog }) {
  if (log.image_count > 0) {
    return (
      <div className="text-xs">
        <span>🖼 {log.image_count} images</span>
        {log.image_size && <span className="text-muted-foreground"> ({log.image_size})</span>}
      </div>
    )
  }

  const hasCache = log.cache_read_tokens > 0 || log.cache_creation_tokens > 0

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help space-y-0.5 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-emerald-600 dark:text-emerald-400">↓</span>
              <span>{formatTokens(log.input_tokens)}</span>
              <span className="text-violet-600 dark:text-violet-400">↑</span>
              <span>{formatTokens(log.output_tokens)}</span>
            </div>
            {hasCache && (
              <div className="flex items-center gap-1 text-muted-foreground">
                {log.cache_read_tokens > 0 && (
                  <span className="text-sky-600 dark:text-sky-400">
                    💾{formatCacheTokens(log.cache_read_tokens)}
                  </span>
                )}
                {log.cache_creation_tokens > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    🎨{formatCacheTokens(log.cache_creation_tokens)}
                  </span>
                )}
                {log.cache_ttl_overridden && (
                  <Badge
                    variant="outline"
                    className="h-4 px-1 text-[10px] border-rose-300 text-rose-600"
                  >
                    R
                  </Badge>
                )}
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <TokenTooltipContent log={log} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function TokenTooltipContent({ log }: { log: AdminUsageLog }) {
  return (
    <div className="space-y-1 text-xs">
      <div className="flex justify-between gap-4">
        <span>Input</span>
        <span className="font-mono">{log.input_tokens.toLocaleString()}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span>Output</span>
        <span className="font-mono">{log.output_tokens.toLocaleString()}</span>
      </div>
      {log.cache_read_tokens > 0 && (
        <div className="flex justify-between gap-4">
          <span>Cache Read</span>
          <span className="font-mono">{log.cache_read_tokens.toLocaleString()}</span>
        </div>
      )}
      {log.cache_creation_tokens > 0 && (
        <div className="flex justify-between gap-4">
          <span>Cache Creation</span>
          <span className="font-mono">{log.cache_creation_tokens.toLocaleString()}</span>
        </div>
      )}
      {log.cache_creation_5m_tokens > 0 && (
        <div className="flex justify-between gap-4 pl-3 text-muted-foreground">
          <span>5m</span>
          <span className="font-mono">{log.cache_creation_5m_tokens.toLocaleString()}</span>
        </div>
      )}
      {log.cache_creation_1h_tokens > 0 && (
        <div className="flex justify-between gap-4 pl-3 text-muted-foreground">
          <span>1h</span>
          <span className="font-mono">{log.cache_creation_1h_tokens.toLocaleString()}</span>
        </div>
      )}
      {log.cache_ttl_overridden && <div className="text-rose-500">Cache TTL overridden</div>}
      <div className="flex justify-between gap-4 border-t pt-1 font-medium">
        <span>Total</span>
        <span className="font-mono">
          {(
            log.input_tokens +
            log.output_tokens +
            log.cache_read_tokens +
            log.cache_creation_tokens
          ).toLocaleString()}
        </span>
      </div>
    </div>
  )
}

function CostCell({ log }: { log: AdminUsageLog }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help text-xs">
            <div className="font-medium text-emerald-700 dark:text-emerald-400">
              {formatCostPrecise(log.actual_cost)}
            </div>
            {log.account_rate_multiplier != null && log.account_rate_multiplier !== 0 && (
              <div className="text-muted-foreground">
                A {formatCostPrecise(log.total_cost * log.account_rate_multiplier)}
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <CostTooltipContent log={log} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function CostTooltipContent({ log }: { log: AdminUsageLog }) {
  return (
    <div className="space-y-1 text-xs">
      <div className="flex justify-between gap-4">
        <span>Input</span>
        <span className="font-mono">{formatCostPrecise(log.input_cost)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span>Output</span>
        <span className="font-mono">{formatCostPrecise(log.output_cost)}</span>
      </div>
      {log.cache_creation_cost > 0 && (
        <div className="flex justify-between gap-4">
          <span>Cache Creation</span>
          <span className="font-mono">{formatCostPrecise(log.cache_creation_cost)}</span>
        </div>
      )}
      {log.cache_read_cost > 0 && (
        <div className="flex justify-between gap-4">
          <span>Cache Read</span>
          <span className="font-mono">{formatCostPrecise(log.cache_read_cost)}</span>
        </div>
      )}
      <div className="flex justify-between gap-4 border-t pt-1">
        <span>Rate Multiplier</span>
        <span className="font-mono">{log.rate_multiplier}x</span>
      </div>
      {log.account_rate_multiplier != null && (
        <div className="flex justify-between gap-4">
          <span>Account Multiplier</span>
          <span className="font-mono">{log.account_rate_multiplier}x</span>
        </div>
      )}
      <div className="flex justify-between gap-4 border-t pt-1">
        <span>Original</span>
        <span className="font-mono">{formatCostPrecise(log.total_cost)}</span>
      </div>
      <div className="flex justify-between gap-4 font-medium text-emerald-600">
        <span>User Billed</span>
        <span className="font-mono">{formatCostPrecise(log.actual_cost)}</span>
      </div>
      {log.account_rate_multiplier != null && log.account_rate_multiplier !== 0 && (
        <div className="flex justify-between gap-4 text-muted-foreground">
          <span>Account Billed</span>
          <span className="font-mono">
            {formatCostPrecise(log.total_cost * log.account_rate_multiplier)}
          </span>
        </div>
      )}
    </div>
  )
}
