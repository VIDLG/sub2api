/**
 * Column settings dropdown: drag-to-reorder + visibility toggles.
 * Uses @dnd-kit/sortable for drag-and-drop reordering.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { GripVertical, Settings, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'

export interface ColumnSettingItem {
  id: string
  label: string
  visible: boolean
  alwaysVisible?: boolean
}

interface ColumnSettingsProps {
  columns: ColumnSettingItem[]
  columnOrder: string[]
  onColumnOrderChange: (order: string[]) => void
  onVisibilityChange: (id: string, visible: boolean) => void
  onReset?: () => void
}

function SortableItem({
  column,
  onVisibilityChange,
}: {
  column: ColumnSettingItem
  onVisibilityChange: (id: string, visible: boolean) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id })

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <Checkbox
        checked={column.visible}
        disabled={column.alwaysVisible}
        onCheckedChange={(checked) =>
          onVisibilityChange(column.id, checked === true)
        }
      />
      <span className="text-sm">{column.label}</span>
    </div>
  )
}

export function ColumnSettings({
  columns,
  columnOrder,
  onColumnOrderChange,
  onVisibilityChange,
  onReset,
}: ColumnSettingsProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Order columns by columnOrder
  const orderedColumns = (() => {
    if (columnOrder.length === 0) return columns
    const map = new Map(columns.map((c) => [c.id, c]))
    const ordered: ColumnSettingItem[] = []
    for (const id of columnOrder) {
      const col = map.get(id)
      if (col) ordered.push(col)
    }
    // Append any columns not in the order (e.g., newly added)
    for (const col of columns) {
      if (!columnOrder.includes(col.id)) ordered.push(col)
    }
    return ordered
  })()

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const ids = orderedColumns.map((c) => c.id)
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return

    onColumnOrderChange(arrayMove(ids, oldIndex, newIndex))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
          <Settings className="h-3.5 w-3.5" />
          {t('common.columns', 'Columns')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={orderedColumns.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {orderedColumns.map((col) => (
              <SortableItem
                key={col.id}
                column={col}
                onVisibilityChange={onVisibilityChange}
              />
            ))}
          </SortableContext>
        </DndContext>
        {onReset && (
          <>
            <Separator className="my-1" />
            <button
              type="button"
              onClick={onReset}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t('common.reset', 'Reset')}
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
