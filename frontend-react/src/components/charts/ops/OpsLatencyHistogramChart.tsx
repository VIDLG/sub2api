/**
 * OpsLatencyHistogramChart
 * BarChart showing latency bucket distribution.
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { OpsLatencyHistogramResponse } from '@/api/admin/ops'

const chartConfig = {
  count: { label: 'Requests', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig

interface Props {
  data: OpsLatencyHistogramResponse | null
  loading?: boolean
  emptyText?: string
}

export function OpsLatencyHistogramChart({ data, loading, emptyText = 'No data' }: Props) {
  if (loading) {
    return (
      <div className="flex h-[220px] items-center justify-center">
        <div className="spinner" />
      </div>
    )
  }
  if (!data?.buckets?.length) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full">
      <BarChart data={data.buckets} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="range"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10 }}
          tickMargin={8}
        />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={36} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
