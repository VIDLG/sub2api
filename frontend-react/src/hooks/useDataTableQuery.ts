import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDebounceFn } from 'ahooks'
import type { ColumnSizingState, VisibilityState } from '@tanstack/react-table'
import type { PaginatedResponse } from '@/types'
import type { ServerPagination, ColumnSettingItem } from '@/components/data-table'
import {
  loadColumnOrder,
  saveColumnOrder,
  loadColumnVisibility,
  saveColumnVisibility,
  loadColumnSizing,
  saveColumnSizing,
} from '@/components/data-table'

export interface ColumnMeta {
  id: string
  label: string
  defaultVisible?: boolean
  alwaysVisible?: boolean
}

interface UseDataTableQueryOptions<TData, TFilters extends Record<string, unknown>> {
  queryKey: string[]
  queryFn: (
    page: number,
    pageSize: number,
    filters: TFilters,
    options?: { signal?: AbortSignal },
  ) => Promise<PaginatedResponse<TData>>
  pageSize?: number
  initialFilters?: TFilters
  /** Unique key for localStorage persistence of column settings. */
  tableKey?: string
  /** Column metadata for column settings UI. */
  columnMeta?: ColumnMeta[]
}

export function useDataTableQuery<TData, TFilters extends Record<string, unknown>>({
  queryKey,
  queryFn,
  pageSize = 20,
  initialFilters = {} as TFilters,
  tableKey,
  columnMeta,
}: UseDataTableQueryOptions<TData, TFilters>) {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<TFilters>(initialFilters)
  const [search, setSearchState] = useState('')
  const queryClient = useQueryClient()

  // --- Column order & visibility (only when tableKey is provided) ---
  const defaultOrder = columnMeta?.map((c) => c.id) ?? []
  const defaultHidden = columnMeta?.filter((c) => c.defaultVisible === false).map((c) => c.id) ?? []

  const [columnOrder, setColumnOrderState] = useState<string[]>(
    () => (tableKey ? loadColumnOrder(tableKey, defaultOrder) : defaultOrder),
  )
  const [columnVisibility, setColumnVisibilityState] = useState<VisibilityState>(
    () => (tableKey ? loadColumnVisibility(tableKey, defaultHidden) : {}),
  )
  const [columnSizing, setColumnSizingState] = useState<ColumnSizingState>(
    () => (tableKey ? loadColumnSizing(tableKey) : {}),
  )

  function setColumnOrder(order: string[]) {
    setColumnOrderState(order)
    if (tableKey) saveColumnOrder(tableKey, order)
  }

  function setColumnVisibility(id: string, visible: boolean) {
    setColumnVisibilityState((prev) => {
      const next = { ...prev, [id]: visible }
      if (tableKey) saveColumnVisibility(tableKey, next)
      return next
    })
  }

  const { run: debouncedSaveColumnSizing } = useDebounceFn(
    (sizing: ColumnSizingState) => {
      if (tableKey) saveColumnSizing(tableKey, sizing)
    },
    { wait: 300 },
  )

  function setColumnSizing(sizing: ColumnSizingState) {
    setColumnSizingState(sizing)
    debouncedSaveColumnSizing(sizing)
  }

  function resetColumnSettings() {
    setColumnOrderState(defaultOrder)
    setColumnVisibilityState(() => {
      const state: VisibilityState = {}
      for (const key of defaultHidden) {
        state[key] = false
      }
      return state
    })
    setColumnSizingState({})
    if (tableKey) {
      saveColumnOrder(tableKey, defaultOrder)
      saveColumnVisibility(tableKey, (() => {
        const state: VisibilityState = {}
        for (const key of defaultHidden) {
          state[key] = false
        }
        return state
      })())
      saveColumnSizing(tableKey, {})
    }
  }

  // Build ColumnSettingItem[] for ColumnSettings component
  const columnSettingItems: ColumnSettingItem[] = (() => {
    if (!columnMeta) return []
    const meta = new Map(columnMeta.map((c) => [c.id, c]))
    const ordered: ColumnSettingItem[] = []
    const order = columnOrder.length > 0 ? columnOrder : defaultOrder
    for (const id of order) {
      const m = meta.get(id)
      if (m) {
        ordered.push({
          id: m.id,
          label: m.label,
          visible: columnVisibility[m.id] !== false,
          alwaysVisible: m.alwaysVisible,
        })
      }
    }
    // Append any not in order
    for (const m of columnMeta) {
      if (!order.includes(m.id)) {
        ordered.push({
          id: m.id,
          label: m.label,
          visible: columnVisibility[m.id] !== false,
          alwaysVisible: m.alwaysVisible,
        })
      }
    }
    return ordered
  })()

  // Build the full query key including pagination and filters
  const fullQueryKey = [...queryKey, { page, pageSize, filters, search }]

  const { data, isLoading, isFetching } = useQuery({
    queryKey: fullQueryKey,
    queryFn: ({ signal }) => {
      const mergedFilters = { ...filters } as TFilters & { search?: string }
      if (search.trim()) {
        mergedFilters.search = search.trim()
      }
      return queryFn(page, pageSize, mergedFilters as TFilters, { signal })
    },
  })

  const pagination: ServerPagination | undefined = data
    ? {
        page: data.page,
        pageSize: data.page_size,
        total: data.total,
        totalPages: data.pages,
      }
    : undefined

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handleFilterChange = (key: keyof TFilters, value: TFilters[keyof TFilters]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const { run: debouncedSearchRefresh } = useDebounceFn(
    () => {
      setPage(1)
      queryClient.invalidateQueries({ queryKey })
    },
    { wait: 300 },
  )

  const handleSearch = (value: string) => {
    setSearchState(value)
    debouncedSearchRefresh()
  }

  const setSearchImmediate = (value: string) => {
    setSearchState(value)
    setPage(1)
  }

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey })
  }

  return {
    data: data?.items ?? [],
    pagination,
    isLoading,
    isFetching,
    page,
    search,
    filters,
    setPage: handlePageChange,
    setFilter: handleFilterChange,
    setSearch: handleSearch,
    setSearchImmediate,
    refresh,
    // Column settings
    columnOrder,
    setColumnOrder,
    columnVisibility,
    setColumnVisibility,
    columnSizing,
    setColumnSizing,
    resetColumnSettings,
    columnSettingItems,
  }
}

/**
 * Extract a human-readable message from an API error.
 */
export function extractErrorMessage(error: Error, fallback?: string): string {
  const err = error as Error & { response?: { data?: { detail?: string } } }
  return err?.response?.data?.detail || err?.message || fallback || 'Unknown error'
}

/**
 * Helper to create a mutation that auto-refreshes the table data on success.
 */
export function useTableMutation<TVariables, TResult = unknown>({
  mutationFn,
  queryKey,
  onSuccess,
  onError,
}: {
  mutationFn: (variables: TVariables) => Promise<TResult>
  queryKey: string[]
  onSuccess?: (data: TResult, variables: TVariables) => void
  onError?: (error: Error) => void
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey })
      onSuccess?.(data, variables)
    },
    onError,
  })
}
