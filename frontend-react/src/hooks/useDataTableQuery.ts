import { useState, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { PaginatedResponse } from '@/types'
import type { ServerPagination } from '@/components/data-table'

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
}

export function useDataTableQuery<TData, TFilters extends Record<string, unknown>>({
  queryKey,
  queryFn,
  pageSize = 20,
  initialFilters = {} as TFilters,
}: UseDataTableQueryOptions<TData, TFilters>) {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<TFilters>(initialFilters)
  const [search, setSearchState] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queryClient = useQueryClient()

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

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
  }, [])

  const handleFilterChange = useCallback(
    (key: keyof TFilters, value: TFilters[keyof TFilters]) => {
      setFilters((prev) => ({ ...prev, [key]: value }))
      setPage(1)
    },
    [],
  )

  const handleSearch = useCallback(
    (value: string) => {
      setSearchState(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        setPage(1)
        // Invalidate to trigger refetch with new search term
        queryClient.invalidateQueries({ queryKey })
      }, 300)
    },
    [queryClient, queryKey],
  )

  const setSearchImmediate = useCallback(
    (value: string) => {
      setSearchState(value)
      setPage(1)
    },
    [],
  )

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey })
  }, [queryClient, queryKey])

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
