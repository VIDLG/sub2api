import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface DataTablePaginationProps {
  page: number
  totalPages: number
  total: number
  onPageChange?: (page: number) => void
  selectedCount?: number
}

export function DataTablePagination({
  page,
  totalPages,
  total,
  onPageChange,
  selectedCount,
}: DataTablePaginationProps) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700">
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {selectedCount !== undefined && selectedCount > 0 ? (
          <span>
            {t('common.selectedCount', '{{count}} selected', { count: selectedCount })}
            {' · '}
          </span>
        ) : null}
        {t('common.pagination', 'Page {{page}} / {{totalPages}} ({{total}} total)', {
          page,
          totalPages,
          total,
        })}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange?.(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          {t('common.prev', 'Previous')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange?.(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          {t('common.next', 'Next')}
        </Button>
      </div>
    </div>
  )
}
