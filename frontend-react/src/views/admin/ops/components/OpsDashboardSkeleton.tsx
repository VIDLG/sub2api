/**
 * OpsDashboardSkeleton
 * Loading skeleton for the Ops dashboard before data is ready.
 */

import { Skeleton } from '@/components/ui/skeleton'

export function OpsDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header + filter row */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-32 rounded-md" />
        <Skeleton className="h-8 w-36 rounded-md" />
        <Skeleton className="h-8 w-28 rounded-md" />
        <Skeleton className="ml-auto h-8 w-24 rounded-md" />
      </div>

      {/* Header Section: Health + Realtime | Stat Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Skeleton className="h-[220px] rounded-2xl lg:col-span-5" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-7 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[160px] rounded-2xl" />
          ))}
        </div>
      </div>

      {/* System Health Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[80px] rounded-xl" />
        ))}
      </div>

      {/* Main chart row: concurrency + switch rate + throughput */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <Skeleton className="h-[280px] rounded-xl" />
        <Skeleton className="h-[280px] rounded-xl" />
        <Skeleton className="h-[280px] rounded-xl lg:col-span-2" />
      </div>

      {/* Analysis row */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Skeleton className="h-[260px] rounded-xl" />
        <Skeleton className="h-[260px] rounded-xl" />
        <Skeleton className="h-[260px] rounded-xl" />
      </div>
    </div>
  )
}
