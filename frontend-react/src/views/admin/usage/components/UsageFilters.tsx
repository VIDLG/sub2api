/**
 * Usage filters with autocomplete search for user/apikey/account,
 * plus dropdowns for model, request type, billing type, and group.
 * Filters apply instantly — no explicit search button.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useDebounceFn } from 'ahooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SearchIcon, TrashIcon, XMarkIcon } from '@/components/icons'
import { TimeRangePicker, DASHBOARD_PRESETS } from '@/components/common/TimeRangePicker'
import { adminAPI } from '@/api/admin'
import { REQUEST_TYPE_OPTIONS, BILLING_TYPE_OPTIONS } from '../utils/usageConstants'

export interface UsageFilterState {
  user_id?: number
  user_label?: string
  api_key_id?: number
  api_key_label?: string
  account_id?: number
  account_label?: string
  group_id?: number
  model?: string
  request_type?: string
  billing_type?: string
  stream?: boolean
}

interface Props {
  filters: UsageFilterState
  onFiltersChange: (filters: UsageFilterState) => void
  datePreset: string
  dateFrom: string
  dateTo: string
  onDateChange: (preset: string, range?: { from: string; to: string }) => void
  onReset: () => void
  onCleanup: () => void
  showActions?: boolean
}

export default function UsageFilters({
  filters,
  onFiltersChange,
  datePreset,
  dateFrom,
  dateTo,
  onDateChange,
  onReset,
  onCleanup,
  showActions = true,
}: Props) {
  const { t } = useTranslation()

  // Fetch groups and models on mount for dropdowns
  const { data: groupsData } = useQuery({
    queryKey: ['admin', 'groups', 'filter-list'],
    queryFn: () => adminAPI.groups.list(1, 1000),
    staleTime: 120_000,
  })

  const { data: modelStatsData } = useQuery({
    queryKey: ['admin', 'dashboard', 'model-stats-filter'],
    queryFn: () => adminAPI.dashboard.getModelStats({}),
    staleTime: 120_000,
  })

  const groups = groupsData?.items ?? []
  const modelNames: string[] = (() => {
    const stats = modelStatsData?.models ?? []
    return stats.map((m) => m.model).sort()
  })()

  function update(partial: Partial<UsageFilterState>) {
    onFiltersChange({ ...filters, ...partial })
  }

  return (
    <div className="card space-y-3 p-4">
      {/* Filter row 1: autocomplete fields */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <UserAutocomplete
          value={filters.user_label || ''}
          userId={filters.user_id}
          onSelect={(id, label) =>
            update({
              user_id: id,
              user_label: label,
              api_key_id: undefined,
              api_key_label: undefined,
            })
          }
          onClear={() =>
            update({
              user_id: undefined,
              user_label: undefined,
              api_key_id: undefined,
              api_key_label: undefined,
            })
          }
        />
        <ApiKeyAutocomplete
          value={filters.api_key_label || ''}
          userId={filters.user_id}
          onSelect={(id, label) => update({ api_key_id: id, api_key_label: label })}
          onClear={() => update({ api_key_id: undefined, api_key_label: undefined })}
        />
        <AccountAutocomplete
          value={filters.account_label || ''}
          onSelect={(id, label) => update({ account_id: id, account_label: label })}
          onClear={() => update({ account_id: undefined, account_label: undefined })}
        />
        <Select
          value={filters.model || '__all__'}
          onValueChange={(v) => update({ model: v === '__all__' ? undefined : v })}
        >
          <SelectTrigger className="text-sm">
            <SelectValue placeholder={t('admin.usage.allModels', 'All Models')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('admin.usage.allModels', 'All Models')}</SelectItem>
            {modelNames.map((m) => (
              <SelectItem key={m} value={m} className="text-sm">
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filter row 2: select fields + date + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={filters.request_type || '__all__'}
          onValueChange={(v) => update({ request_type: v === '__all__' ? undefined : v })}
        >
          <SelectTrigger className="w-36 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REQUEST_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value || '__all__'} value={o.value || '__all__'}>
                {t(o.labelKey, o.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.billing_type ?? '__all__'}
          onValueChange={(v) => update({ billing_type: v === '__all__' ? undefined : v })}
        >
          <SelectTrigger className="w-36 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BILLING_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value || '__all__'} value={o.value || '__all__'}>
                {t(o.labelKey, o.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.group_id != null ? String(filters.group_id) : '__all__'}
          onValueChange={(v) => update({ group_id: v === '__all__' ? undefined : Number(v) })}
        >
          <SelectTrigger className="w-40 text-sm">
            <SelectValue placeholder={t('admin.usage.allGroups', 'All Groups')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('admin.usage.allGroups', 'All Groups')}</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id} value={String(g.id)} className="text-sm">
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <TimeRangePicker
          value={datePreset}
          onChange={(v, range) => onDateChange(v, range)}
          presets={DASHBOARD_PRESETS}
          customRange={{ from: dateFrom, to: dateTo }}
        />

        <Button variant="ghost" size="sm" onClick={onReset}>
          {t('common.clear', 'Clear')}
        </Button>

        {showActions && (
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCleanup}
              className="h-8 gap-1 text-xs text-destructive hover:text-destructive"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              {t('admin.usage.cleanup', 'Cleanup')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== Autocomplete Components ====================

function useAutocompleteSearch<T>(
  searchFn: (keyword: string) => Promise<T[]>,
  enabled: boolean = true,
) {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<T[]>([])
  const [open, setOpen] = useState(false)

  const { run: debouncedSearch } = useDebounceFn(
    async (kw: string) => {
      if (!kw.trim() || !enabled) {
        setResults([])
        return
      }
      try {
        const data = await searchFn(kw.trim())
        setResults(data)
        setOpen(data.length > 0)
      } catch {
        setResults([])
      }
    },
    { wait: 300 },
  )

  function handleChange(value: string) {
    setKeyword(value)
    debouncedSearch(value)
  }

  return { keyword, setKeyword, results, open, setOpen, handleChange }
}

interface AutocompleteProps {
  value: string
  onSelect: (id: number, label: string) => void
  onClear: () => void
}

function UserAutocomplete({
  value,
  onSelect,
  onClear,
  userId,
}: AutocompleteProps & { userId?: number }) {
  const { t } = useTranslation()
  const { keyword, setKeyword, results, open, setOpen, handleChange } = useAutocompleteSearch(
    (kw) => adminAPI.usage.searchUsers(kw),
  )

  const displayValue = value || keyword

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={displayValue}
            onChange={(e) => {
              if (userId) onClear()
              handleChange(e.target.value)
            }}
            placeholder={t('admin.usage.userSearch', 'Search user...')}
            className="pl-9 pr-8 text-sm"
          />
          {(userId || keyword) && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => {
                onClear()
                setKeyword('')
                setOpen(false)
              }}
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="max-h-48 overflow-auto">
          {results.map((u) => (
            <button
              key={u.id}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              onClick={() => {
                onSelect(u.id, u.email)
                setKeyword('')
                setOpen(false)
              }}
            >
              <span className="truncate">{u.email}</span>
              <span className="text-xs text-muted-foreground">#{u.id}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ApiKeyAutocomplete({
  value,
  userId,
  onSelect,
  onClear,
}: AutocompleteProps & { userId?: number }) {
  const { t } = useTranslation()
  const { keyword, setKeyword, results, open, setOpen, handleChange } = useAutocompleteSearch(
    (kw) => adminAPI.usage.searchApiKeys(userId, kw),
  )

  const displayValue = value || keyword

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            value={displayValue}
            onChange={(e) => {
              if (value) onClear()
              handleChange(e.target.value)
            }}
            placeholder={t('admin.usage.apiKeySearch', 'API key name...')}
            className="pr-8 text-sm"
          />
          {(value || keyword) && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => {
                onClear()
                setKeyword('')
                setOpen(false)
              }}
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="max-h-48 overflow-auto">
          {results.map((k) => (
            <button
              key={k.id}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              onClick={() => {
                onSelect(k.id, k.name)
                setKeyword('')
                setOpen(false)
              }}
            >
              <span className="truncate">{k.name}</span>
              <span className="text-xs text-muted-foreground">#{k.id}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function AccountAutocomplete({ value, onSelect, onClear }: AutocompleteProps) {
  const { t } = useTranslation()
  const { keyword, setKeyword, results, open, setOpen, handleChange } = useAutocompleteSearch(
    async (kw) => {
      const data = await adminAPI.accounts.list(1, 20, { search: kw })
      return (data.items ?? []).map((a) => ({ id: a.id, name: a.name }))
    },
  )

  const displayValue = value || keyword

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            value={displayValue}
            onChange={(e) => {
              if (value) onClear()
              handleChange(e.target.value)
            }}
            placeholder={t('admin.usage.accountSearch', 'Account name...')}
            className="pr-8 text-sm"
          />
          {(value || keyword) && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => {
                onClear()
                setKeyword('')
                setOpen(false)
              }}
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="max-h-48 overflow-auto">
          {results.map((a) => (
            <button
              key={a.id}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              onClick={() => {
                onSelect(a.id, a.name)
                setKeyword('')
                setOpen(false)
              }}
            >
              <span className="truncate">{a.name}</span>
              <span className="text-xs text-muted-foreground">#{a.id}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
