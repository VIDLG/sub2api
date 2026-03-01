/**
 * Generic localStorage helpers for column order, visibility, and sizing.
 * Each table is identified by a unique `tableKey`.
 */

import type { ColumnSizingState, VisibilityState } from '@tanstack/react-table'

function orderKey(tableKey: string): string {
  return `table-${tableKey}-column-order`
}

function visibilityKey(tableKey: string): string {
  return `table-${tableKey}-column-visibility`
}

function sizingKey(tableKey: string): string {
  return `table-${tableKey}-column-sizing`
}

export function loadColumnOrder(tableKey: string, defaultOrder: string[]): string[] {
  try {
    const saved = localStorage.getItem(orderKey(tableKey))
    if (saved) {
      const parsed = JSON.parse(saved) as string[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    /* ignore */
  }
  return defaultOrder
}

export function saveColumnOrder(tableKey: string, order: string[]): void {
  localStorage.setItem(orderKey(tableKey), JSON.stringify(order))
}

/**
 * Load column visibility state from localStorage.
 * Returns a VisibilityState where hidden columns have `false`.
 */
export function loadColumnVisibility(
  tableKey: string,
  defaultHidden: string[] = [],
): VisibilityState {
  try {
    const saved = localStorage.getItem(visibilityKey(tableKey))
    if (saved) return JSON.parse(saved) as VisibilityState
  } catch {
    /* ignore */
  }
  const state: VisibilityState = {}
  for (const key of defaultHidden) {
    state[key] = false
  }
  return state
}

export function saveColumnVisibility(tableKey: string, visibility: VisibilityState): void {
  localStorage.setItem(visibilityKey(tableKey), JSON.stringify(visibility))
}

export function loadColumnSizing(tableKey: string): ColumnSizingState {
  try {
    const saved = localStorage.getItem(sizingKey(tableKey))
    if (saved) {
      const parsed = JSON.parse(saved) as ColumnSizingState
      if (parsed && typeof parsed === 'object') return parsed
    }
  } catch {
    /* ignore */
  }
  return {}
}

export function saveColumnSizing(tableKey: string, sizing: ColumnSizingState): void {
  localStorage.setItem(sizingKey(tableKey), JSON.stringify(sizing))
}
