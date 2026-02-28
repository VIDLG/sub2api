/**
 * OpsErrorTrendChart
 * AreaChart showing error types over time.
 */

import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { OpsErrorTrendPoint } from '@/api/admin/ops'

function fmtBucket(s: string, timeRange: string) {
  const d = new Date(s)
  if (['5m', '30m', '1h', '6h', '24h'].includes(timeRange)) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const chartConfig = {
  error_count_sla: { label: 'SLA Errors', color: 'hsl(var(--chart-5))' },
  upstream_error_count_excl_429_529: { label: 'Upstream', color: 'hsl(var(--chart-4))' },
  upstream_429_count: { label: '429', color: 'hsl(var(--chart-3))' },
  upstream_529_count: { label: '529', color: 'hsl(var(--chart-2))' },
} satisfies ChartConfig

interface Props {
  points: OpsErrorTrendPoint[]
  loading?: boolean
  timeRange: string
  emptyText?: string
}

export function OpsErrorTrendChart({ points, loading, timeRange, emptyText = 'No data' }: Props) {
  if (loading) {
    return (
      <div className="flex h-[220px] items-center justify-center">
        <div className="spinner" />
      </div>
    )
  }

  const hasErrors = points.some((p) => p.error_count_total > 0)
  if (!points.length || !hasErrors) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    )
  }

  const chartData = points.map((p) => ({
    label: fmtBucket(p.bucket_start, timeRange),
    error_count_sla: p.error_count_sla,
    upstream_error_count_excl_429_529: p.upstream_error_count_excl_429_529,
    upstream_429_count: p.upstream_429_count,
    upstream_529_count: p.upstream_529_count,
  }))

  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full">
      <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          tickMargin={8}
        />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={36} />
        <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          dataKey="error_count_sla"
          type="monotone"
          fill="var(--color-error_count_sla)"
          stroke="var(--color-error_count_sla)"
          fillOpacity={0.3}
          stackId="a"
          dot={false}
        />
        <Area
          dataKey="upstream_error_count_excl_429_529"
          type="monotone"
          fill="var(--color-upstream_error_count_excl_429_529)"
          stroke="var(--color-upstream_error_count_excl_429_529)"
          fillOpacity={0.3}
          stackId="a"
          dot={false}
        />
        <Area
          dataKey="upstream_429_count"
          type="monotone"
          fill="var(--color-upstream_429_count)"
          stroke="var(--color-upstream_429_count)"
          fillOpacity={0.3}
          stackId="a"
          dot={false}
        />
        <Area
          dataKey="upstream_529_count"
          type="monotone"
          fill="var(--color-upstream_529_count)"
          stroke="var(--color-upstream_529_count)"
          fillOpacity={0.3}
          stackId="a"
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}
