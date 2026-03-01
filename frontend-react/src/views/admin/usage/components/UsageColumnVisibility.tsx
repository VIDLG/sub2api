/**
 * Column visibility dropdown for the Usage table.
 */

import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { CogIcon } from '@/components/icons'
import { USAGE_COLUMNS } from '../utils/usageConstants'

interface Props {
  hiddenColumns: Set<string>
  onToggle: (key: string) => void
}

export default function UsageColumnVisibility({ hiddenColumns, onToggle }: Props) {
  const { t } = useTranslation()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
          <CogIcon className="h-3.5 w-3.5" />
          {t('admin.usage.columns', 'Columns')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {USAGE_COLUMNS.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.key}
            checked={!hiddenColumns.has(col.key)}
            disabled={col.alwaysVisible}
            onCheckedChange={() => onToggle(col.key)}
          >
            {t(col.labelKey, col.labelFallback)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
