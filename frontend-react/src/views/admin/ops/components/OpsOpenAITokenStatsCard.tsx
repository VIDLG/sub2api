/**
 * OpsOpenAITokenStatsCard
 * Model-level token request statistics: request count, throughput, latency.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { opsAPI } from '@/api/admin/ops'
import type { OpsOpenAITokenStatsTimeRange } from '@/api/admin/ops'
import { Pagination } from '@/components/common/Pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function fmtInt(n: number | null | undefined) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function fmtRate(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toFixed(1)
}

interface Props {
  platformFilter: string
  groupIdFilter: number | null
  opsEnabled: boolean
}

type ViewMode = 'topn' | 'pagination'
const TIME_RANGES: OpsOpenAITokenStatsTimeRange[] = ['30m', '1h', '1d', '15d', '30d']
const TOP_N_OPTIONS = [10, 20, 50, 100]
const PAGE_SIZE = 20

export function OpsOpenAITokenStatsCard({ platformFilter, groupIdFilter, opsEnabled }: Props) {
  const { t } = useTranslation()

  const [timeRange, setTimeRange] = useState<OpsOpenAITokenStatsTimeRange>('30d')
  const [viewMode, setViewMode] = useState<ViewMode>('topn')
  const [topN, setTopN] = useState(10)
  const [page, setPage] = useState(1)

  // Reset page on filter change
  useEffect(() => {
    setPage(1)
  }, [platformFilter, groupIdFilter, timeRange, viewMode, topN])

  const params =
    viewMode === 'topn'
      ? {
          time_range: timeRange,
          platform: platformFilter || undefined,
          group_id: groupIdFilter ?? undefined,
          top_n: topN,
        }
      : {
          time_range: timeRange,
          platform: platformFilter || undefined,
          group_id: groupIdFilter ?? undefined,
          page,
          page_size: PAGE_SIZE,
        }

  const { data, isLoading, error } = useQuery({
    queryKey: ['ops', 'openaiTokenStats', params],
    queryFn: () => opsAPI.getOpenAITokenStats(params),
    enabled: opsEnabled,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div className="card p-4">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h3 className="flex-1 text-sm font-semibold text-gray-900 dark:text-white">
          {t('admin.ops.openaiTokenStats.title', 'OpenAI Token Request Stats')}
        </h3>

        {/* Time range */}
        <Select
          value={timeRange}
          onValueChange={(v) => setTimeRange(v as OpsOpenAITokenStatsTimeRange)}
        >
          <SelectTrigger className="h-7 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {TIME_RANGES.map((tr) => (
              <SelectItem key={tr} value={tr}>
                {t(`admin.ops.timeRange.${tr}`, tr)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View mode toggle */}
        <div className="flex overflow-hidden rounded-md border border-gray-200 dark:border-dark-700">
          {(['topn', 'pagination'] as ViewMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setViewMode(m)}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === m
                  ? 'bg-primary-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-dark-800 dark:text-gray-300 dark:hover:bg-dark-700'
              }`}
            >
              {m === 'topn'
                ? t('admin.ops.openaiTokenStats.viewModeTopN', 'TopN')
                : t('admin.ops.openaiTokenStats.viewModePagination', 'Page')}
            </button>
          ))}
        </div>

        {/* TopN selector or pagination controls */}
        {viewMode === 'topn' ? (
          <Select value={String(topN)} onValueChange={(v) => setTopN(Number(v))}>
            <SelectTrigger className="h-7 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {TOP_N_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  Top {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {/* Error */}
      {error && (
        <p className="mb-3 text-xs text-red-500">
          {t('admin.ops.openaiTokenStats.failedToLoad', 'Failed to load token stats')}
        </p>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="spinner" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          {t('admin.ops.openaiTokenStats.empty', 'No data for current filters')}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-dark-700">
                <th className="py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                  {t('admin.ops.openaiTokenStats.table.model', 'Model')}
                </th>
                <th className="py-2 text-right font-medium text-gray-500 dark:text-gray-400">
                  {t('admin.ops.openaiTokenStats.table.requestCount', 'Reqs')}
                </th>
                <th className="py-2 text-right font-medium text-gray-500 dark:text-gray-400">
                  {t('admin.ops.openaiTokenStats.table.avgTokensPerSec', 'Tok/s')}
                </th>
                <th className="py-2 text-right font-medium text-gray-500 dark:text-gray-400">
                  {t('admin.ops.openaiTokenStats.table.avgFirstTokenMs', 'TTFT ms')}
                </th>
                <th className="py-2 text-right font-medium text-gray-500 dark:text-gray-400">
                  {t('admin.ops.openaiTokenStats.table.totalOutputTokens', 'Output Tok')}
                </th>
                <th className="py-2 text-right font-medium text-gray-500 dark:text-gray-400">
                  {t('admin.ops.openaiTokenStats.table.avgDurationMs', 'Dur ms')}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.model}
                  className="border-b border-gray-50 last:border-0 dark:border-dark-800"
                >
                  <td className="py-1.5 pr-4 font-mono text-gray-800 dark:text-gray-200">
                    {item.model}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {fmtInt(item.request_count)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {fmtRate(item.avg_tokens_per_sec)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {fmtInt(item.avg_first_token_ms ?? null)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {fmtInt(item.total_output_tokens)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {fmtInt(item.avg_duration_ms)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'pagination' && (
        <Pagination
          page={page}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          showPageSizeSelector={false}
          compact
        />
      )}
    </div>
  )
}
