/**
 * ModelDistributionChart
 * Horizontal BarChart showing top models by request count.
 * Used in admin and user dashboards.
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { ModelStat } from '@/types'

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function fmtCost(n: number) {
  return `$${n.toFixed(4)}`
}

const BAR_COLOR = 'hsl(var(--chart-1))'

const chartConfig = {
  requests: { label: 'Requests', color: BAR_COLOR },
} satisfies ChartConfig

interface Props {
  data: ModelStat[]
  loading?: boolean
  emptyText?: string
}

export function ModelDistributionChart({ data, loading, emptyText = 'No data' }: Props) {
  if (loading) {
    return (
      <div className="flex h-[220px] items-center justify-center">
        <div className="spinner" />
      </div>
    )
  }

  const top = data.slice(0, 8)

  if (!top.length) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    )
  }

  // Shorten model names for display
  const chartData = top.map((m) => ({
    ...m,
    shortName: m.model.length > 20 ? m.model.slice(0, 18) + '…' : m.model,
  }))

  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full">
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 12, bottom: 0, left: 4 }}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <YAxis
          dataKey="shortName"
          type="category"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10 }}
          width={90}
        />
        <XAxis
          type="number"
          tickFormatter={fmtTokens}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              nameKey="shortName"
              formatter={(value, _name, item) => {
                const stat = item.payload as ModelStat
                return (
                  <div className="space-y-0.5">
                    <div>{fmtTokens(Number(value))} reqs</div>
                    <div className="text-muted-foreground">
                      {fmtTokens(stat.total_tokens)} tokens
                    </div>
                    <div className="text-muted-foreground">{fmtCost(stat.actual_cost)}</div>
                  </div>
                )
              }}
            />
          }
        />
        <Bar dataKey="requests" radius={[0, 4, 4, 0]}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={`hsl(var(--chart-${(i % 5) + 1}))`} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
