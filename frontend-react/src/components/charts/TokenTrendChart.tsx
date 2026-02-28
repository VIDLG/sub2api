/**
 * TokenTrendChart
 * AreaChart showing input/output token usage over time.
 * Used in admin and user dashboards.
 */

import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { TrendDataPoint } from '@/types'

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const chartConfig = {
  input_tokens: { label: 'Input', color: 'hsl(var(--chart-1))' },
  output_tokens: { label: 'Output', color: 'hsl(var(--chart-2))' },
  cache_tokens: { label: 'Cache', color: 'hsl(var(--chart-3))' },
} satisfies ChartConfig

interface Props {
  data: TrendDataPoint[]
  loading?: boolean
  emptyText?: string
}

export function TokenTrendChart({ data, loading, emptyText = 'No data' }: Props) {
  if (loading) {
    return (
      <div className="flex h-[220px] items-center justify-center">
        <div className="spinner" />
      </div>
    )
  }
  if (!data.length) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    )
  }
  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full">
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          tickFormatter={fmtTokens}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          width={44}
        />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value) => fmtTokens(Number(value))} />}
        />
        <Area
          dataKey="input_tokens"
          type="monotone"
          fill="var(--color-input_tokens)"
          stroke="var(--color-input_tokens)"
          fillOpacity={0.4}
          stackId="a"
        />
        <Area
          dataKey="output_tokens"
          type="monotone"
          fill="var(--color-output_tokens)"
          stroke="var(--color-output_tokens)"
          fillOpacity={0.4}
          stackId="a"
        />
        <Area
          dataKey="cache_tokens"
          type="monotone"
          fill="var(--color-cache_tokens)"
          stroke="var(--color-cache_tokens)"
          fillOpacity={0.4}
          stackId="a"
        />
      </AreaChart>
    </ChartContainer>
  )
}
