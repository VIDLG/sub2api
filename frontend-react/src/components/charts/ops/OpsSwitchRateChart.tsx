/**
 * OpsSwitchRateChart
 * Line chart showing average account-switch rate (switches / request) over time.
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { OpsThroughputTrendPoint } from '@/api/admin/ops'

function fmtBucket(s: string) {
  const d = new Date(s)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const chartConfig = {
  switchRate: { label: 'Switch Rate', color: 'hsl(var(--chart-3))' },
} satisfies ChartConfig

interface Props {
  points: OpsThroughputTrendPoint[]
  loading?: boolean
  emptyText?: string
}

export function OpsSwitchRateChart({ points, loading, emptyText = 'No data' }: Props) {
  if (loading) {
    return (
      <div className="flex h-[220px] items-center justify-center">
        <div className="spinner" />
      </div>
    )
  }

  const chartData = points.map((p) => ({
    label: fmtBucket(p.bucket_start),
    switchRate:
      p.request_count > 0 ? Number(((p.switch_count ?? 0) / p.request_count).toFixed(3)) : 0,
  }))

  const hasData = chartData.some((d) => d.switchRate > 0)

  if (!points.length || !hasData) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full">
      <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          tickMargin={8}
        />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={40} />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          dataKey="switchRate"
          type="monotone"
          stroke="var(--color-switchRate)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  )
}
