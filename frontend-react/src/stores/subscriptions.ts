/**
 * Subscription Store (Zustand)
 * Global state management for user subscriptions with caching and deduplication
 */

import { create } from 'zustand'
import subscriptionsAPI from '@/api/subscriptions'
import type { UserSubscription } from '@/types'

const CACHE_TTL_MS = 60_000

let requestGeneration = 0
let activePromise: Promise<UserSubscription[]> | null = null
let pollerInterval: ReturnType<typeof setInterval> | null = null

interface SubscriptionState {
  activeSubscriptions: UserSubscription[]
  loading: boolean
  loaded: boolean
  lastFetchedAt: number | null
  hasActiveSubscriptions: boolean
}

interface SubscriptionActions {
  fetchActiveSubscriptions: (force?: boolean) => Promise<UserSubscription[]>
  startPolling: () => void
  stopPolling: () => void
  clear: () => void
  invalidateCache: () => void
}

export const useSubscriptionStore = create<SubscriptionState & SubscriptionActions>()(
  (set, get) => ({
    activeSubscriptions: [],
    loading: false,
    loaded: false,
    lastFetchedAt: null,
    hasActiveSubscriptions: false,

    async fetchActiveSubscriptions(force = false): Promise<UserSubscription[]> {
      const now = Date.now()
      const state = get()

      if (
        !force &&
        state.loaded &&
        state.lastFetchedAt &&
        now - state.lastFetchedAt < CACHE_TTL_MS
      ) {
        return state.activeSubscriptions
      }

      if (activePromise && !force) {
        return activePromise
      }

      const currentGeneration = ++requestGeneration

      set({ loading: true })
      const requestPromise = subscriptionsAPI
        .getActiveSubscriptions()
        .then((data) => {
          if (currentGeneration === requestGeneration) {
            set({
              activeSubscriptions: data,
              loaded: true,
              lastFetchedAt: Date.now(),
              hasActiveSubscriptions: data.length > 0,
            })
          }
          return data
        })
        .catch((error) => {
          console.error('Failed to fetch active subscriptions:', error)
          throw error
        })
        .finally(() => {
          if (activePromise === requestPromise) {
            set({ loading: false })
            activePromise = null
          }
        })

      activePromise = requestPromise
      return activePromise
    },

    startPolling() {
      if (pollerInterval) return
      pollerInterval = setInterval(
        () => {
          get()
            .fetchActiveSubscriptions(true)
            .catch((error) => {
              console.error('Subscription polling failed:', error)
            })
        },
        5 * 60 * 1000,
      )
    },

    stopPolling() {
      if (pollerInterval) {
        clearInterval(pollerInterval)
        pollerInterval = null
      }
    },

    clear() {
      requestGeneration++
      activePromise = null
      get().stopPolling()
      set({
        activeSubscriptions: [],
        loaded: false,
        lastFetchedAt: null,
        hasActiveSubscriptions: false,
      })
    },

    invalidateCache() {
      set({ lastFetchedAt: null })
    },
  }),
)
