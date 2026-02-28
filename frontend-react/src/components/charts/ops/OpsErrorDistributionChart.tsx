/**
 * OpsErrorDistributionChart
 * BarChart showing error counts by HTTP status code.
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { OpsErrorDistributionResponse } from '@/api/admin/ops'

const chartConfig = {
  total: { label: 'Total', color: 'hsl(var(--chart-5))' },
} satisfies ChartConfig

function barColor(statusCode: number) {
  if (statusCode >= 500) return 'hsl(var(--chart-5))'
  if (statusCode >= 400) return 'hsl(var(--chart-4))'
  return 'hsl(var(--chart-3))'
}

interface Props {
  data: OpsErrorDistributionResponse | null
  loading?: boolean
  emptyText?: string
}

export function OpsErrorDistributionChart({ data, loading, emptyText = 'No errors' }: Props) {
  if (loading) {
    return (
      <div className="flex h-[220px] items-center justify-center">
        <div className="spinner" />
      </div>
    )
  }
  if (!data?.items?.length) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    )
  }

  const chartData = data.items
    .filter((i) => i.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 12)
    .map((i) => ({ ...i, label: String(i.status_code) }))

  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full">
      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          tickMargin={8}
        />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={36} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(_value, _name, item) => {
                const d = item.payload
                return (
                  <div className="space-y-0.5">
                    <div>Total: {d.total}</div>
                    {d.sla > 0 && <div className="text-muted-foreground">SLA: {d.sla}</div>}
                    {d.business_limited > 0 && (
                      <div className="text-muted-foreground">Biz: {d.business_limited}</div>
                    )}
                  </div>
                )
              }}
            />
          }
        />
        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
          {chartData.map((item, i) => (
            <Cell key={i} fill={barColor(item.status_code)} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
