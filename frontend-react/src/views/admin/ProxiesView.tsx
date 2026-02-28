/**
 * Admin Proxies Management View
 * Manages proxy servers with CRUD, testing, quality checks, and batch operations.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type ColumnDef } from '@tanstack/react-table'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type {
  Proxy,
  ProxyProtocol,
  CreateProxyRequest,
  UpdateProxyRequest,
  ProxyQualityCheckResult,
} from '@/types'
import {
  PlusIcon,
  TrashIcon,
  SearchIcon,
  RefreshIcon,
  ShieldIcon,
} from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DataTable } from '@/components/data-table'
import { useDataTableQuery, useTableMutation, extractErrorMessage } from '@/hooks/useDataTableQuery'

// ==================== Constants ====================

const PROXIES_QUERY_KEY = ['admin', 'proxies']

const PROTOCOLS: { value: ProxyProtocol; label: string }[] = [
  { value: 'http', label: 'HTTP' },
  { value: 'https', label: 'HTTPS' },
  { value: 'socks5', label: 'SOCKS5' },
  { value: 'socks5h', label: 'SOCKS5H' },
]

// ==================== Types ====================

type ProxyFilters = {
  protocol?: string
  status?: 'active' | 'inactive'
  search?: string
}

// ==================== Helpers ====================

function protocolBadgeClass(protocol: string): string {
  const map: Record<string, string> = {
    http: 'badge-warning',
    https: 'badge-success',
    socks5: 'badge-purple',
    socks5h: 'badge-primary',
  }
  return map[protocol] || 'badge-gray'
}

function statusDot(status: string): string {
  return status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'
}

function qualityGradeColor(grade: string | undefined): string {
  if (!grade) return 'text-gray-500'
  if (grade === 'A' || grade === 'A+') return 'text-emerald-600 dark:text-emerald-400'
  if (grade === 'B') return 'text-blue-600 dark:text-blue-400'
  if (grade === 'C') return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

// ==================== Component ====================

export default function ProxiesView() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)

  // Data table query
  const {
    data: proxies,
    pagination,
    isLoading,
    search,
    filters,
    setPage,
    setFilter,
    setSearch,
    refresh,
  } = useDataTableQuery<Proxy, ProxyFilters>({
    queryKey: PROXIES_QUERY_KEY,
    queryFn: (page, pageSize, filters, options) =>
      adminAPI.proxies.list(page, pageSize, filters as { protocol?: string; status?: 'active' | 'inactive'; search?: string }, options),
  })

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingProxy, setEditingProxy] = useState<Proxy | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Proxy | null>(null)
  const [showBatchDialog, setShowBatchDialog] = useState(false)

  // Create/Edit form (useState, not @tanstack/form)
  const [proxyForm, setProxyForm] = useState<{
    name: string
    protocol: ProxyProtocol
    host: string
    port: number
    username: string
    password: string
  }>({
    name: '',
    protocol: 'http',
    host: '',
    port: 0,
    username: '',
    password: '',
  })

  // Batch create
  const [batchText, setBatchText] = useState('')

  // Testing & quality
  const [testingId, setTestingId] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<{ id: number; message: string; success: boolean } | null>(null)
  const [qualityCheckingId, setQualityCheckingId] = useState<number | null>(null)
  const [qualityResult, setQualityResult] = useState<{ id: number; result: ProxyQualityCheckResult } | null>(null)

  // ==================== Helpers ====================

  const resetForm = () => {
    setProxyForm({ name: '', protocol: 'http', host: '', port: 0, username: '', password: '' })
  }

  // ==================== Mutations ====================

  const createMutation = useTableMutation({
    mutationFn: (req: CreateProxyRequest) => adminAPI.proxies.create(req),
    queryKey: PROXIES_QUERY_KEY,
    onSuccess: () => {
      showSuccess(t('admin.proxies.created', 'Proxy created'))
      setShowCreateDialog(false)
      resetForm()
    },
    onError: (err) => {
      showError(extractErrorMessage(err, t('admin.proxies.createFailed', 'Failed to create proxy')))
    },
  })

  const updateMutation = useTableMutation({
    mutationFn: ({ id, ...updates }: { id: number } & UpdateProxyRequest) =>
      adminAPI.proxies.update(id, updates),
    queryKey: PROXIES_QUERY_KEY,
    onSuccess: () => {
      showSuccess(t('admin.proxies.updated', 'Proxy updated'))
      setEditingProxy(null)
      resetForm()
    },
    onError: (err) => {
      showError(extractErrorMessage(err, t('admin.proxies.updateFailed', 'Failed to update proxy')))
    },
  })

  const deleteMutation = useTableMutation({
    mutationFn: (id: number) => adminAPI.proxies.delete(id),
    queryKey: PROXIES_QUERY_KEY,
    onSuccess: () => {
      showSuccess(t('admin.proxies.deleted', 'Proxy deleted'))
      setDeleteTarget(null)
    },
    onError: (err) => {
      showError(extractErrorMessage(err, t('admin.proxies.deleteFailed', 'Failed to delete proxy')))
    },
  })

  // ==================== Actions ====================

  const handleEdit = (proxy: Proxy) => {
    setEditingProxy(proxy)
    setProxyForm({
      name: proxy.name,
      protocol: proxy.protocol,
      host: proxy.host,
      port: proxy.port,
      username: proxy.username || '',
      password: '',
    })
  }

  const handleCreate = () => {
    const req: CreateProxyRequest = {
      name: proxyForm.name,
      protocol: proxyForm.protocol,
      host: proxyForm.host,
      port: proxyForm.port,
      username: proxyForm.username || null,
      password: proxyForm.password || null,
    }
    createMutation.mutate(req)
  }

  const handleUpdate = () => {
    if (!editingProxy) return
    const updates: UpdateProxyRequest = {
      name: proxyForm.name,
      protocol: proxyForm.protocol,
      host: proxyForm.host,
      port: proxyForm.port,
      username: proxyForm.username || null,
    }
    if (proxyForm.password) {
      updates.password = proxyForm.password
    }
    updateMutation.mutate({ id: editingProxy.id, ...updates })
  }

  const handleTest = async (id: number) => {
    setTestingId(id)
    setTestResult(null)
    try {
      const result = await adminAPI.proxies.testProxy(id)
      const parts = [result.message]
      if (result.latency_ms) parts.push(`${result.latency_ms}ms`)
      if (result.ip_address) parts.push(`IP: ${result.ip_address}`)
      if (result.country) parts.push(result.country)
      setTestResult({ id, message: parts.join(' | '), success: result.success })
    } catch (err) {
      setTestResult({ id, message: extractErrorMessage(err as Error, 'Test failed'), success: false })
    } finally {
      setTestingId(null)
    }
  }

  const handleQualityCheck = async (id: number) => {
    setQualityCheckingId(id)
    setQualityResult(null)
    try {
      const result = await adminAPI.proxies.checkProxyQuality(id)
      setQualityResult({ id, result })
    } catch (err) {
      showError(extractErrorMessage(err as Error, 'Quality check failed'))
    } finally {
      setQualityCheckingId(null)
    }
  }

  const handleBatchCreate = async () => {
    const lines = batchText.split('\n').filter((l) => l.trim())
    if (lines.length === 0) {
      showError('No proxies to create')
      return
    }
    const parsed: Array<{ protocol: string; host: string; port: number; username?: string; password?: string }> = []
    for (const line of lines) {
      try {
        // Format: protocol://user:pass@host:port or protocol://host:port
        const trimmed = line.trim()
        const urlMatch = trimmed.match(/^(https?|socks5h?):\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)$/)
        if (urlMatch) {
          parsed.push({
            protocol: urlMatch[1],
            host: urlMatch[4],
            port: parseInt(urlMatch[5]),
            username: urlMatch[2] || undefined,
            password: urlMatch[3] || undefined,
          })
        } else {
          // Try host:port format (default http)
          const simpleMatch = trimmed.match(/^([^:]+):(\d+)$/)
          if (simpleMatch) {
            parsed.push({ protocol: 'http', host: simpleMatch[1], port: parseInt(simpleMatch[2]) })
          }
        }
      } catch {
        // Skip invalid lines
      }
    }
    if (parsed.length === 0) {
      showError('No valid proxy format found. Use: protocol://[user:pass@]host:port')
      return
    }
    try {
      const result = await adminAPI.proxies.batchCreate(parsed)
      showSuccess(`Created: ${result.created}, Skipped: ${result.skipped}`)
      setShowBatchDialog(false)
      setBatchText('')
      refresh()
    } catch (err) {
      showError(extractErrorMessage(err as Error, 'Batch create failed'))
    }
  }

  // ==================== Columns ====================

  const columns: ColumnDef<Proxy>[] = [
    {
      accessorKey: 'name',
      header: () => t('admin.proxies.name', 'Name'),
      cell: ({ row }) => (
        <div className="font-medium text-gray-900 dark:text-white">{row.original.name}</div>
      ),
    },
    {
      accessorKey: 'protocol',
      header: () => t('admin.proxies.protocol', 'Protocol'),
      cell: ({ row }) => (
        <span className={`badge ${protocolBadgeClass(row.original.protocol)}`}>
          {row.original.protocol.toUpperCase()}
        </span>
      ),
    },
    {
      id: 'hostPort',
      header: () => t('admin.proxies.hostPort', 'Host:Port'),
      cell: ({ row }) => (
        <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
          {row.original.host}:{row.original.port}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: () => t('admin.proxies.status', 'Status'),
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 rounded-full ${statusDot(row.original.status)}`} />
          <span className="text-sm">{row.original.status}</span>
        </div>
      ),
    },
    {
      accessorKey: 'latency_ms',
      header: () => t('admin.proxies.latency', 'Latency'),
      cell: ({ row }) => {
        const latency = row.original.latency_ms
        if (latency == null) return <span className="text-gray-400">-</span>
        return (
          <span className={latency < 500 ? 'text-emerald-600' : latency < 1000 ? 'text-amber-600' : 'text-red-600'}>
            {latency}ms
          </span>
        )
      },
    },
    {
      id: 'quality',
      header: () => t('admin.proxies.quality', 'Quality'),
      cell: ({ row }) => {
        const proxy = row.original
        if (!proxy.quality_grade) return <span className="text-gray-400">-</span>
        return (
          <div>
            <span className={`font-bold ${qualityGradeColor(proxy.quality_grade)}`}>
              {proxy.quality_grade}
            </span>
            {proxy.quality_score != null && (
              <span className="ml-1 text-xs text-gray-500">({proxy.quality_score})</span>
            )}
          </div>
        )
      },
    },
    {
      id: 'accounts',
      header: () => t('admin.proxies.accounts', 'Accounts'),
      cell: ({ row }) => (
        <span className="text-sm text-center block">{row.original.account_count ?? 0}</span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="text-right block">{t('admin.proxies.actions', 'Actions')}</span>,
      cell: ({ row }) => {
        const proxy = row.original
        return (
          <div>
            <div className="flex items-center justify-end gap-1">
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleEdit(proxy)}>
                {t('common.edit', 'Edit')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => handleTest(proxy.id)}
                disabled={testingId === proxy.id}
              >
                {testingId === proxy.id ? <span className="spinner h-3 w-3" /> : t('common.test', 'Test')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => handleQualityCheck(proxy.id)}
                disabled={qualityCheckingId === proxy.id}
                title={t('admin.proxies.qualityCheck', 'Quality Check')}
              >
                {qualityCheckingId === proxy.id ? (
                  <span className="spinner h-3 w-3" />
                ) : (
                  <ShieldIcon className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-red-500 hover:text-red-700"
                onClick={() => setDeleteTarget(proxy)}
              >
                {t('common.delete', 'Delete')}
              </Button>
            </div>
            {testResult && testResult.id === proxy.id && (
              <div className={`text-xs mt-1 text-right ${testResult.success ? 'text-emerald-600' : 'text-red-500'}`}>
                {testResult.message}
              </div>
            )}
            {qualityResult && qualityResult.id === proxy.id && (
              <div className="mt-2 rounded-lg bg-gray-50 dark:bg-dark-800 p-2 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${qualityGradeColor(qualityResult.result.grade)}`}>
                    Grade: {qualityResult.result.grade}
                  </span>
                  <span className="text-gray-500">Score: {qualityResult.result.score}</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400">{qualityResult.result.summary}</p>
                {qualityResult.result.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className={
                      item.status === 'pass' ? 'text-emerald-600' :
                      item.status === 'warn' ? 'text-amber-600' :
                      item.status === 'challenge' ? 'text-orange-600' : 'text-red-600'
                    }>
                      [{item.status}]
                    </span>
                    <span>{item.target}</span>
                    {item.latency_ms != null && <span className="text-gray-500">{item.latency_ms}ms</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      },
    },
  ]

  // ==================== Render ====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">{t('admin.proxies.title', 'Proxies')}</h1>
          <p className="page-description">{t('admin.proxies.description', 'Manage proxy servers')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={refresh} title={t('common.refresh', 'Refresh')}>
            <RefreshIcon className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowBatchDialog(true)}>
            {t('admin.proxies.batchCreate', 'Batch Create')}
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setShowCreateDialog(true) }}>
            <PlusIcon className="h-4 w-4" />
            {t('common.create', 'Create')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filters.protocol ?? 'all'} onValueChange={(v) => setFilter('protocol', v === 'all' ? undefined : v)}>
            <SelectTrigger className="w-auto text-sm">
              <SelectValue placeholder={t('admin.proxies.allProtocols', 'All Protocols')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.proxies.allProtocols', 'All Protocols')}</SelectItem>
              {PROTOCOLS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.status ?? 'all'} onValueChange={(v) => setFilter('status', v === 'all' ? undefined : v)}>
            <SelectTrigger className="w-auto text-sm">
              <SelectValue placeholder={t('admin.proxies.allStatuses', 'All Statuses')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.proxies.allStatuses', 'All Statuses')}</SelectItem>
              <SelectItem value="active">{t('common.active', 'Active')}</SelectItem>
              <SelectItem value="inactive">{t('common.inactive', 'Inactive')}</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[200px]">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.proxies.searchPlaceholder', 'Search by name or host...')}
              className="pl-9 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={proxies}
        loading={isLoading}
        pagination={pagination}
        onPageChange={setPage}
        getRowId={(row) => String(row.id)}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || !!editingProxy} onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); setEditingProxy(null) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProxy
                ? t('admin.proxies.editTitle', 'Edit Proxy')
                : t('admin.proxies.createTitle', 'Create Proxy')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('admin.proxies.name', 'Name')}</Label>
              <Input
                value={proxyForm.name}
                onChange={(e) => setProxyForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="My Proxy"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.proxies.protocol', 'Protocol')}</Label>
              <Select
                value={proxyForm.protocol}
                onValueChange={(v) => setProxyForm((f) => ({ ...f, protocol: v as ProxyProtocol }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROTOCOLS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label>{t('admin.proxies.host', 'Host')}</Label>
                <Input
                  value={proxyForm.host}
                  onChange={(e) => setProxyForm((f) => ({ ...f, host: e.target.value }))}
                  placeholder="127.0.0.1"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.proxies.port', 'Port')}</Label>
                <Input
                  type="number"
                  value={proxyForm.port || ''}
                  onChange={(e) => setProxyForm((f) => ({ ...f, port: parseInt(e.target.value) || 0 }))}
                  placeholder="8080"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('admin.proxies.username', 'Username')}</Label>
              <Input
                value={proxyForm.username}
                onChange={(e) => setProxyForm((f) => ({ ...f, username: e.target.value }))}
                placeholder={t('common.optional', 'Optional')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.proxies.password', 'Password')}</Label>
              <Input
                type="password"
                value={proxyForm.password}
                onChange={(e) => setProxyForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={editingProxy ? t('admin.proxies.leaveBlank', 'Leave blank to keep unchanged') : t('common.optional', 'Optional')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setEditingProxy(null) }} disabled={createMutation.isPending || updateMutation.isPending}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={editingProxy ? handleUpdate : handleCreate}
              disabled={!proxyForm.host || !proxyForm.port || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <div className="spinner h-4 w-4" />
              ) : editingProxy ? (
                t('common.save', 'Save')
              ) : (
                t('common.create', 'Create')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Create Dialog */}
      <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('admin.proxies.batchCreateTitle', 'Batch Create Proxies')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('admin.proxies.batchHint', 'One proxy per line. Format: protocol://[user:pass@]host:port')}
            </p>
            <Textarea
              className="font-mono text-xs"
              rows={10}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder={'http://127.0.0.1:8080\nsocks5://user:pass@proxy.example.com:1080\nhttps://host:443'}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBatchDialog(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleBatchCreate} disabled={!batchText.trim()}>
              <PlusIcon className="h-4 w-4" />
              {t('admin.proxies.batchCreate', 'Batch Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete', 'Confirm Delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.proxies.deleteConfirm', 'Are you sure you want to delete proxy')} <strong>{deleteTarget?.name}</strong>?
              {(deleteTarget?.account_count ?? 0) > 0 && (
                <span className="block mt-2 text-amber-600">
                  {t('admin.proxies.deleteWarning', 'This proxy is used by')} {deleteTarget?.account_count} {t('admin.proxies.accountsCount', 'account(s)')}.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} className="bg-red-600 hover:bg-red-700">
              <TrashIcon className="h-4 w-4" />
              {t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
