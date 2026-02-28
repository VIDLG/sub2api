/**
 * DateRangePicker
 * A popover-based date range picker with quick presets and calendar selection.
 * Mirrors Vue DateRangePicker.vue feature set.
 */

import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { zhCN, enUS } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import { CalendarIcon, ChevronDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// ==================== Types ====================

interface DateRangePickerProps {
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  onChange: (range: { startDate: string; endDate: string; preset: string | null }) => void
  className?: string
}

interface Preset {
  labelKey: string
  value: string
  getRange: () => { start: Date; end: Date }
}

// ==================== Helpers ====================

function toDateStr(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

function today(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// ==================== Presets ====================

const PRESETS: Preset[] = [
  {
    labelKey: 'dates.today',
    value: 'today',
    getRange: () => {
      const t = today()
      return { start: t, end: t }
    },
  },
  {
    labelKey: 'dates.yesterday',
    value: 'yesterday',
    getRange: () => {
      const t = subDays(today(), 1)
      return { start: t, end: t }
    },
  },
  {
    labelKey: 'dates.last7Days',
    value: '7days',
    getRange: () => ({ start: subDays(today(), 6), end: today() }),
  },
  {
    labelKey: 'dates.last14Days',
    value: '14days',
    getRange: () => ({ start: subDays(today(), 13), end: today() }),
  },
  {
    labelKey: 'dates.last30Days',
    value: '30days',
    getRange: () => ({ start: subDays(today(), 29), end: today() }),
  },
  {
    labelKey: 'dates.thisMonth',
    value: 'thisMonth',
    getRange: () => ({ start: startOfMonth(today()), end: today() }),
  },
  {
    labelKey: 'dates.lastMonth',
    value: 'lastMonth',
    getRange: () => {
      const last = subMonths(today(), 1)
      return { start: startOfMonth(last), end: endOfMonth(last) }
    },
  },
]

function detectPreset(startStr: string, endStr: string): string | null {
  for (const preset of PRESETS) {
    const range = preset.getRange()
    if (toDateStr(range.start) === startStr && toDateStr(range.end) === endStr) {
      return preset.value
    }
  }
  return null
}

// ==================== Component ====================

export function DateRangePicker({ startDate, endDate, onChange, className }: DateRangePickerProps) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)

  // Local calendar selection state (uncommitted until Apply)
  const [pending, setPending] = useState<DateRange>({
    from: startDate ? new Date(startDate + 'T00:00:00') : undefined,
    to: endDate ? new Date(endDate + 'T00:00:00') : undefined,
  })

  const activePreset = detectPreset(startDate, endDate)

  const calendarLocale = i18n.language === 'zh' ? zhCN : enUS

  // Display label
  const displayLabel = (() => {
    if (activePreset) {
      const preset = PRESETS.find((p) => p.value === activePreset)
      if (preset) return t(preset.labelKey)
    }
    if (startDate && endDate) {
      if (startDate === endDate)
        return format(new Date(startDate + 'T00:00:00'), 'MMM d', { locale: calendarLocale })
      return `${format(new Date(startDate + 'T00:00:00'), 'MMM d', { locale: calendarLocale })} – ${format(new Date(endDate + 'T00:00:00'), 'MMM d', { locale: calendarLocale })}`
    }
    return t('dates.selectDateRange')
  })()

  const handleSelectPreset = useCallback(
    (preset: Preset) => {
      const range = preset.getRange()
      setPending({ from: range.start, to: range.end })
      // Immediately emit for presets (like Vue: selectPreset doesn't auto-apply, but we do here for UX)
      const s = toDateStr(range.start)
      const e = toDateStr(range.end)
      onChange({ startDate: s, endDate: e, preset: preset.value })
      setOpen(false)
    },
    [onChange],
  )

  const handleApply = useCallback(() => {
    if (!pending.from) return
    const s = toDateStr(pending.from)
    const e = toDateStr(pending.to ?? pending.from)
    onChange({ startDate: s, endDate: e, preset: detectPreset(s, e) })
    setOpen(false)
  }, [pending, onChange])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'flex items-center gap-2 text-sm font-medium',
            open && 'border-primary-500 ring-2 ring-primary-500/30',
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 text-gray-400" />
          <span>{displayLabel}</span>
          <ChevronDownIcon
            className={cn(
              'h-4 w-4 text-gray-400 transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {/* Quick presets */}
        <div className="grid grid-cols-2 gap-1 p-2">
          {PRESETS.map((preset) => {
            const isActive = activePreset === preset.value
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150',
                  'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-dark-700',
                  isActive &&
                    'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
                )}
              >
                {t(preset.labelKey)}
              </button>
            )
          })}
        </div>

        <div className="border-t border-gray-100 dark:border-dark-700" />

        {/* Calendar */}
        <Calendar
          mode="range"
          selected={pending}
          onSelect={(range) => setPending(range ?? { from: undefined, to: undefined })}
          numberOfMonths={2}
          locale={calendarLocale}
          disabled={{ after: new Date() }}
          className="p-3"
        />

        {/* Apply */}
        <div className="flex justify-end border-t border-gray-100 p-2 dark:border-dark-700">
          <Button size="sm" onClick={handleApply} disabled={!pending.from}>
            {t('dates.apply')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
