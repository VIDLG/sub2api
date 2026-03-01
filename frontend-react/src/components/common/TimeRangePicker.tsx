/**
 * TimeRangePicker — unified time/date range picker.
 *
 * Combines the capabilities of both the old DateRangePicker (presets + calendar)
 * and ops-style relative time pickers (preset-only) into one component.
 *
 * Usage:
 *   - Ops (preset-only, no calendar):
 *       <TimeRangePicker value="1h" onChange={v => set(v)} presets={OPS_DASHBOARD_PRESETS} />
 *
 *   - Dashboard (presets + calendar):
 *       <TimeRangePicker
 *         value={preset} onChange={(v, range) => { setPreset(v); if (range) setDates(range) }}
 *         presets={DASHBOARD_PRESETS}
 *         customRange={{ from: startDate, to: endDate }}
 *       />
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { zhCN, enUS } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import { CalendarIcon, ClockIcon, ChevronDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// ==================== Types ====================

export interface TimeRangePreset {
  /** Unique key, e.g. '1h', '7days', 'today' */
  value: string
  /** i18n key for the display label */
  label: string
  /** For date-based presets: compute a concrete date range. Enables calendar when present. */
  getRange?: () => { from: Date; to: Date }
}

interface TimeRangePickerProps {
  /** Current preset key (e.g. '1h', '7days') or 'custom' for calendar-selected range */
  value: string
  /** Called when selection changes. dateRange is provided for date-based presets / custom calendar. */
  onChange: (value: string, dateRange?: { from: string; to: string }) => void
  /** Preset definitions */
  presets: TimeRangePreset[]
  /** Current custom date range — used for display when value === 'custom' */
  customRange?: { from: string; to: string }
  className?: string
}

// ==================== Helpers ====================

function toDateStr(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

function fmtDate(s: string, locale: Intl.Locale | object): string {
  return format(new Date(s + 'T00:00:00'), 'MMM d', { locale: locale as Locale })
}

type Locale = typeof zhCN

function today(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// ==================== Pre-defined preset sets ====================

// Ops monitoring — relative time, no calendar
export const OPS_DASHBOARD_PRESETS: TimeRangePreset[] = [
  { value: '5m', label: 'admin.ops.timeRange.5m' },
  { value: '30m', label: 'admin.ops.timeRange.30m' },
  { value: '1h', label: 'admin.ops.timeRange.1h' },
  { value: '6h', label: 'admin.ops.timeRange.6h' },
  { value: '24h', label: 'admin.ops.timeRange.24h' },
]

export const ALERT_EVENTS_PRESETS: TimeRangePreset[] = [
  { value: '1h', label: 'admin.ops.timeRange.1h' },
  { value: '6h', label: 'admin.ops.timeRange.6h' },
  { value: '24h', label: 'admin.ops.timeRange.24h' },
  { value: '7d', label: 'admin.ops.timeRange.7d' },
]

export const SYSTEM_LOG_PRESETS: TimeRangePreset[] = [
  { value: '5m', label: 'admin.ops.timeRange.5m' },
  { value: '30m', label: 'admin.ops.timeRange.30m' },
  { value: '1h', label: 'admin.ops.timeRange.1h' },
  { value: '6h', label: 'admin.ops.timeRange.6h' },
  { value: '24h', label: 'admin.ops.timeRange.24h' },
  { value: '7d', label: 'admin.ops.timeRange.7d' },
  { value: '30d', label: 'admin.ops.timeRange.30d' },
]

// Dashboard — date-based presets with calendar
function subDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() - n)
  return r
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

export const DASHBOARD_PRESETS: TimeRangePreset[] = [
  {
    value: 'today',
    label: 'dates.today',
    getRange: () => ({ from: today(), to: today() }),
  },
  {
    value: 'yesterday',
    label: 'dates.yesterday',
    getRange: () => {
      const d = subDays(today(), 1)
      return { from: d, to: d }
    },
  },
  {
    value: '7days',
    label: 'dates.last7Days',
    getRange: () => ({ from: subDays(today(), 6), to: today() }),
  },
  {
    value: '14days',
    label: 'dates.last14Days',
    getRange: () => ({ from: subDays(today(), 13), to: today() }),
  },
  {
    value: '30days',
    label: 'dates.last30Days',
    getRange: () => ({ from: subDays(today(), 29), to: today() }),
  },
  {
    value: 'thisMonth',
    label: 'dates.thisMonth',
    getRange: () => ({ from: startOfMonth(today()), to: today() }),
  },
  {
    value: 'lastMonth',
    label: 'dates.lastMonth',
    getRange: () => {
      const last = new Date(today().getFullYear(), today().getMonth() - 1, 1)
      return { from: startOfMonth(last), to: endOfMonth(last) }
    },
  },
]

// ==================== Component ====================

export function TimeRangePicker({
  value,
  onChange,
  presets,
  customRange,
  className,
}: TimeRangePickerProps) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<DateRange>({
    from: customRange?.from ? new Date(customRange.from + 'T00:00:00') : undefined,
    to: customRange?.to ? new Date(customRange.to + 'T00:00:00') : undefined,
  })
  const [showCalendar, setShowCalendar] = useState(false)

  const calendarLocale = i18n.language === 'zh' ? zhCN : enUS

  // Display label
  const displayLabel = (() => {
    const preset = presets.find((p) => p.value === value)
    if (preset) return t(preset.label, value)
    if (value === 'custom' && customRange) {
      if (customRange.from === customRange.to) {
        return fmtDate(customRange.from, calendarLocale)
      }
      return `${fmtDate(customRange.from, calendarLocale)} – ${fmtDate(customRange.to, calendarLocale)}`
    }
    return value
  })()

  const handlePreset = (preset: TimeRangePreset) => {
    if (preset.getRange) {
      const range = preset.getRange()
      const from = toDateStr(range.from)
      const to = toDateStr(range.to)
      onChange(preset.value, { from, to })
    } else {
      onChange(preset.value)
    }
    setShowCalendar(false)
    setOpen(false)
  }

  const handleApplyCustom = () => {
    if (!pending.from) return
    const from = toDateStr(pending.from)
    const to = toDateStr(pending.to ?? pending.from)
    onChange('custom', { from, to })
    setOpen(false)
    setShowCalendar(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setShowCalendar(false)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium',
            open && 'border-primary-500 ring-2 ring-primary-500/30',
            className,
          )}
        >
          {value === 'custom' ? (
            <CalendarIcon className="h-3.5 w-3.5 text-gray-400" />
          ) : (
            <ClockIcon className="h-3.5 w-3.5 text-gray-400" />
          )}
          <span>{displayLabel}</span>
          <ChevronDownIcon
            className={cn(
              'h-3.5 w-3.5 text-gray-400 transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {/* Preset buttons — 2 columns when 6+ items */}
        <div
          className={cn(
            'gap-0.5 p-1.5',
            presets.length >= 6 ? 'grid grid-cols-2' : 'flex flex-col',
          )}
        >
          {presets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => handlePreset(preset)}
              className={cn(
                'rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors',
                value === preset.value
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-dark-700',
              )}
            >
              {t(preset.label, preset.value)}
            </button>
          ))}

          {/* Custom range trigger — always available */}
          <button
            type="button"
            onClick={() => setShowCalendar((v) => !v)}
            className={cn(
              'rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors',
              value === 'custom' || showCalendar
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-dark-700',
            )}
          >
            {t('dates.custom', 'Custom range…')}
          </button>
        </div>

        {/* Calendar section */}
        {showCalendar && (
          <>
            <div className="border-t border-gray-100 dark:border-dark-700" />
            <Calendar
              mode="range"
              selected={pending}
              onSelect={(range) => setPending(range ?? { from: undefined, to: undefined })}
              numberOfMonths={2}
              locale={calendarLocale}
              disabled={{ after: new Date() }}
              className="p-3"
            />
            <div className="flex justify-end border-t border-gray-100 p-2 dark:border-dark-700">
              <Button size="sm" onClick={handleApplyCustom} disabled={!pending.from}>
                {t('dates.apply', 'Apply')}
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
