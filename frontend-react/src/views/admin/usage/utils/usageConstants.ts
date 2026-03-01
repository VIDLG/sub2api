/**
 * Constants for the Usage view: column definitions, defaults, localStorage keys.
 */

export interface ColumnDef {
  key: string
  labelKey: string
  labelFallback: string
  defaultVisible: boolean
  alwaysVisible?: boolean
}

export const USAGE_COLUMNS: ColumnDef[] = [
  {
    key: 'user',
    labelKey: 'admin.usage.user',
    labelFallback: 'User',
    defaultVisible: true,
    alwaysVisible: true,
  },
  {
    key: 'api_key',
    labelKey: 'admin.usage.apiKey',
    labelFallback: 'API Key',
    defaultVisible: true,
  },
  {
    key: 'account',
    labelKey: 'admin.usage.account',
    labelFallback: 'Account',
    defaultVisible: true,
  },
  { key: 'model', labelKey: 'admin.usage.modelCol', labelFallback: 'Model', defaultVisible: true },
  {
    key: 'reasoning_effort',
    labelKey: 'admin.usage.reasoningEffort',
    labelFallback: 'Reasoning',
    defaultVisible: false,
  },
  { key: 'group', labelKey: 'admin.usage.group', labelFallback: 'Group', defaultVisible: true },
  {
    key: 'request_type',
    labelKey: 'admin.usage.requestType',
    labelFallback: 'Type',
    defaultVisible: true,
  },
  { key: 'tokens', labelKey: 'admin.usage.tokens', labelFallback: 'Tokens', defaultVisible: true },
  { key: 'cost', labelKey: 'admin.usage.cost', labelFallback: 'Cost', defaultVisible: true },
  {
    key: 'first_token',
    labelKey: 'admin.usage.firstToken',
    labelFallback: 'First Token',
    defaultVisible: true,
  },
  {
    key: 'duration',
    labelKey: 'admin.usage.duration',
    labelFallback: 'Duration',
    defaultVisible: true,
  },
  {
    key: 'created_at',
    labelKey: 'admin.usage.time',
    labelFallback: 'Time',
    defaultVisible: true,
    alwaysVisible: true,
  },
  {
    key: 'user_agent',
    labelKey: 'admin.usage.userAgent',
    labelFallback: 'User Agent',
    defaultVisible: false,
  },
  {
    key: 'ip_address',
    labelKey: 'admin.usage.ipAddress',
    labelFallback: 'IP Address',
    defaultVisible: true,
  },
]

export const HIDDEN_COLUMNS_KEY = 'usage-hidden-columns'

export function loadHiddenColumns(): Set<string> {
  try {
    const saved = localStorage.getItem(HIDDEN_COLUMNS_KEY)
    if (saved) return new Set(JSON.parse(saved) as string[])
  } catch {
    /* ignore */
  }
  return new Set(USAGE_COLUMNS.filter((c) => !c.defaultVisible).map((c) => c.key))
}

export function saveHiddenColumns(hidden: Set<string>): void {
  localStorage.setItem(HIDDEN_COLUMNS_KEY, JSON.stringify([...hidden]))
}

export const REQUEST_TYPE_OPTIONS = [
  { value: '', label: 'All Types', labelKey: 'admin.usage.allTypes' },
  { value: 'ws_v2', label: 'WebSocket', labelKey: 'admin.usage.typeWs' },
  { value: 'stream', label: 'Stream', labelKey: 'admin.usage.typeStream' },
  { value: 'sync', label: 'Sync', labelKey: 'admin.usage.typeSync' },
] as const

export const BILLING_TYPE_OPTIONS = [
  { value: '', label: 'All Billing', labelKey: 'admin.usage.allBilling' },
  { value: '0', label: 'Balance', labelKey: 'admin.usage.billingBalance' },
  { value: '1', label: 'Subscription', labelKey: 'admin.usage.billingSubscription' },
] as const
