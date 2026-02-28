/**
 * OpsThroughputChart
 * AreaChart showing QPS and TPS/K over time.
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
import type { OpsThroughputTrendPoint } from '@/api/admin/ops'

function fmtBucket(s: string, timeRange: string) {
  const d = new Date(s)
  if (timeRange === '5m' || timeRange === '30m' || timeRange === '1h') {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  if (timeRange === '6h' || timeRange === '24h') {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const chartConfig = {
  qps: { label: 'QPS', color: 'hsl(var(--chart-1))' },
  tpsK: { label: 'TPS/K', color: 'hsl(var(--chart-2))' },
} satisfies ChartConfig

interface Props {
  points: OpsThroughputTrendPoint[]
  loading?: boolean
  timeRange: string
  emptyText?: string
}

export function OpsThroughputChart({ points, loading, timeRange, emptyText = 'No data' }: Props) {
  if (loading) {
    return (
      <div className="flex h-[220px] items-center justify-center">
        <div className="spinner" />
      </div>
    )
  }

  const totalReqs = points.reduce((s, p) => s + p.request_count, 0)
  if (!points.length || totalReqs === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    )
  }

  const chartData = points.map((p) => ({
    label: fmtBucket(p.bucket_start, timeRange),
    qps: p.qps ?? 0,
    tpsK: (p.tps ?? 0) / 1000,
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
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={40} />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          dataKey="qps"
          type="monotone"
          fill="var(--color-qps)"
          stroke="var(--color-qps)"
          fillOpacity={0.3}
          dot={false}
        />
        <Area
          dataKey="tpsK"
          type="monotone"
          fill="var(--color-tpsK)"
          stroke="var(--color-tpsK)"
          fillOpacity={0.3}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}
