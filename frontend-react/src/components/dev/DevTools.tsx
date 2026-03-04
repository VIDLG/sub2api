/**
 * DevTools - Developer Testing Utilities
 * Only visible in development mode
 */

import { useState } from 'react'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { RedeemCodeType } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

// Check if we're in development mode
const isDev = import.meta.env.MODE === 'development'

// Seed data configuration for Redeem Codes
const SEED_REDEEM_CODES = [
  { type: 'balance' as RedeemCodeType, value: 100, count: 2 },
  { type: 'balance' as RedeemCodeType, value: 50, count: 3 },
  { type: 'balance' as RedeemCodeType, value: 10, count: 5 },
  { type: 'concurrency' as RedeemCodeType, value: 1, count: 2 },
] as const

// Available page types
export type DevToolsPage = 'redeem' | 'promo' | 'announcements' | 'users' | 'accounts' | 'groups' | 'subscriptions' | 'proxies'

interface DevToolsProps {
  /** Current page for showing relevant seed options */
  page?: DevToolsPage
  /** Callback after seed data is created */
  onSeedComplete?: () => void
}

export function DevTools({ page = 'redeem', onSeedComplete }: DevToolsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const showSuccess = useAppStore((s) => s.showSuccess)
  const showError = useAppStore((s) => s.showError)

  // Don't render in production
  if (!isDev) {
    return null
  }

  const seedRedeemCodes = async () => {
    setIsLoading(true)
    try {
      let totalCreated = 0
      for (const config of SEED_REDEEM_CODES) {
        const created = await adminAPI.redeem.generate(
          config.count,
          config.type,
          config.value,
          null,
          365,
        )
        totalCreated += created.length
      }
      showSuccess(`Created ${totalCreated} test redeem codes`)
      onSeedComplete?.()
      setIsOpen(false)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to seed data')
    } finally {
      setIsLoading(false)
    }
  }

  const renderContent = () => {
    switch (page) {
      case 'redeem':
        return (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
            <h4 className="mb-2 font-medium text-amber-800 dark:text-amber-200">
              Seed Redeem Codes
            </h4>
            <p className="mb-3 text-sm text-amber-700 dark:text-amber-300">
              Generate test redeem codes for development:
            </p>
            <ul className="mb-3 space-y-1 text-sm text-amber-600 dark:text-amber-400">
              <li>• 2x Balance 100</li>
              <li>• 3x Balance 50</li>
              <li>• 5x Balance 10</li>
              <li>• 2x Concurrency 1</li>
            </ul>
            <Button
              onClick={seedRedeemCodes}
              disabled={isLoading}
              className="w-full bg-amber-600 hover:bg-amber-700"
            >
              {isLoading ? 'Creating...' : 'Generate Test Codes'}
            </Button>
          </div>
        )

      default:
        return (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Test data generation for this page is not yet implemented.
            </p>
          </div>
        )
    }
  }

  return (
    <>
      {/* Floating button */}
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50 border-amber-500 text-amber-600 hover:bg-amber-50 dark:border-amber-400 dark:text-amber-400 dark:hover:bg-amber-950"
        onClick={() => setIsOpen(true)}
      >
        Dev Tools
      </Button>

      {/* Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Developer Tools
              <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                DEV
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Generate test data for development and testing purposes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {renderContent()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default DevTools
