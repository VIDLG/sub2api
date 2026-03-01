/**
 * Rich pagination component matching Vue's Pagination.vue feature set.
 *
 * Features:
 * - Page number buttons with ellipsis
 * - "Showing X to Y of Z results" info
 * - Per-page size selector
 * - Jump-to-page input
 * - Mobile-responsive (simplified on small screens)
 * - Accessible (ARIA labels, keyboard nav)
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Pagination as PaginationRoot,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from '@/components/ui/pagination'
import { cn } from '@/lib/utils'

interface PaginationProps {
  /** Current page (1-indexed) */
  page: number
  /** Total number of items */
  total: number
  /** Items per page */
  pageSize: number
  /** Called when page changes */
  onPageChange: (page: number) => void
  /** Called when page size changes */
  onPageSizeChange?: (pageSize: number) => void
  /** Available page size options */
  pageSizeOptions?: number[]
  /** Show page size selector */
  showPageSizeSelector?: boolean
  /** Show jump-to-page input */
  showJump?: boolean
  /** Number of selected rows (optional, shown in info) */
  selectedCount?: number
  /** Additional CSS class */
  className?: string
  /** Compact mode — hides page buttons, only shows prev/next */
  compact?: boolean
}

function getVisiblePages(page: number, totalPages: number): (number | '...')[] {
  const maxVisible = 7
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages: (number | '...')[] = [1]
  const start = Math.max(2, page - 2)
  const end = Math.min(totalPages - 1, page + 2)

  if (start > 2) pages.push('...')
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < totalPages - 1) pages.push('...')
  pages.push(totalPages)

  return pages
}

export function Pagination({
  page,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showPageSizeSelector = true,
  showJump = false,
  selectedCount,
  className,
  compact = false,
}: PaginationProps) {
  const { t } = useTranslation()
  const [jumpValue, setJumpValue] = useState('')

  const totalPages = Math.max(Math.ceil(total / pageSize), 1)
  const fromItem = total === 0 ? 0 : (page - 1) * pageSize + 1
  const toItem = Math.min(page * pageSize, total)
  const visiblePages = getVisiblePages(page, totalPages)

  const goToPage = (p: number) => {
    const clamped = Math.max(1, Math.min(p, totalPages))
    if (clamped !== page) onPageChange(clamped)
  }

  const handleJump = () => {
    const v = jumpValue.trim()
    if (!v) return
    const n = parseInt(v, 10)
    if (!Number.isNaN(n)) {
      goToPage(n)
      setJumpValue('')
    }
  }

  if (total === 0) return null

  return (
    <div
      className={cn(
        'flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-dark-700',
        className,
      )}
    >
      {/* Mobile view */}
      <div className="flex flex-1 items-center justify-between sm:hidden">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
          {t('pagination.previous')}
        </Button>
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {t('pagination.pageOf', { page, total: totalPages })}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => goToPage(page + 1)}
        >
          {t('pagination.next')}
        </Button>
      </div>

      {/* Desktop view */}
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        {/* Left: info + page size + jump */}
        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {selectedCount != null && selectedCount > 0 && (
              <span className="mr-1 font-medium">
                {t('common.selectedCount', '{{count}} selected', { count: selectedCount })} ·{' '}
              </span>
            )}
            {t('pagination.showing')} <span className="font-medium">{fromItem}</span>{' '}
            {t('pagination.to')} <span className="font-medium">{toItem}</span> {t('pagination.of')}{' '}
            <span className="font-medium">{total}</span> {t('pagination.results')}
          </p>

          {showPageSizeSelector && onPageSizeChange && (
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {t('pagination.perPage')}:
              </span>
              <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
                <SelectTrigger className="h-7 w-[70px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {pageSizeOptions.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showJump && (
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {t('pagination.jumpTo')}
              </span>
              <Input
                type="number"
                min={1}
                max={totalPages}
                value={jumpValue}
                onChange={(e) => setJumpValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJump()}
                placeholder={t('pagination.jumpPlaceholder')}
                className="h-7 w-16 text-xs"
              />
              <Button variant="ghost" size="xs" onClick={handleJump}>
                {t('pagination.jumpAction')}
              </Button>
            </div>
          )}
        </div>

        {/* Right: page buttons */}
        {compact ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-xs"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              aria-label={t('pagination.previous')}
            >
              <ChevronLeftIcon />
            </Button>
            <span className="tabular-nums text-sm text-gray-700 dark:text-gray-300">
              {page}/{totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-xs"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
              aria-label={t('pagination.next')}
            >
              <ChevronRightIcon />
            </Button>
          </div>
        ) : (
          <PaginationRoot className="mx-0 w-auto">
            <PaginationContent>
              {/* Previous */}
              <PaginationItem>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                  aria-label={t('pagination.previous')}
                >
                  <ChevronLeftIcon />
                </Button>
              </PaginationItem>

              {/* Page numbers */}
              {visiblePages.map((p, i) =>
                p === '...' ? (
                  <PaginationItem key={`ellipsis-${i}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={p}>
                    <Button
                      variant={p === page ? 'default' : 'ghost'}
                      size="icon-sm"
                      onClick={() => goToPage(p)}
                      aria-current={p === page ? 'page' : undefined}
                      aria-label={t('pagination.goToPage', { page: p })}
                    >
                      {p}
                    </Button>
                  </PaginationItem>
                ),
              )}

              {/* Next */}
              <PaginationItem>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                  aria-label={t('pagination.next')}
                >
                  <ChevronRightIcon />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </PaginationRoot>
        )}
      </div>
    </div>
  )
}
