/**
 * Authentication Store (Zustand)
 * Manages user authentication state, login/logout, token refresh, and token persistence
 */

import { create } from 'zustand'
import { authAPI, isTotp2FARequired, type LoginResponse } from '@/api'
import type { User, LoginRequest, RegisterRequest, AuthResponse } from '@/types'

const AUTH_TOKEN_KEY = 'auth_token'
const AUTH_USER_KEY = 'auth_user'
const REFRESH_TOKEN_KEY = 'refresh_token'
const TOKEN_EXPIRES_AT_KEY = 'token_expires_at'
const AUTO_REFRESH_INTERVAL = 60 * 1000
const TOKEN_REFRESH_BUFFER = 120 * 1000

interface AuthState {
  user: User | null
  token: string | null
  refreshTokenValue: string | null
  tokenExpiresAt: number | null
  runMode: 'standard' | 'simple'

  // Computed-like getters
  isAuthenticated: boolean
  isAdmin: boolean
  isSimpleMode: boolean
}

interface AuthActions {
  checkAuth: () => void
  login: (credentials: LoginRequest) => Promise<LoginResponse>
  login2FA: (tempToken: string, totpCode: string) => Promise<User>
  register: (userData: RegisterRequest) => Promise<User>
  setToken: (newToken: string) => Promise<User>
  logout: () => Promise<void>
  refreshUser: () => Promise<User>
}

// Timer refs (module-level, outside store)
let refreshIntervalId: ReturnType<typeof setInterval> | null = null
let tokenRefreshTimeoutId: ReturnType<typeof setTimeout> | null = null

function stopAutoRefresh(): void {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId)
    refreshIntervalId = null
  }
}

function stopTokenRefresh(): void {
  if (tokenRefreshTimeoutId) {
    clearTimeout(tokenRefreshTimeoutId)
    tokenRefreshTimeoutId = null
  }
}

export const useAuthStore = create<AuthState & AuthActions>()((set, get) => {
  // ==================== Internal Helpers ====================

  function deriveComputed(user: User | null, token: string | null, runMode: 'standard' | 'simple') {
    return {
      isAuthenticated: !!token && !!user,
      isAdmin: user?.role === 'admin',
      isSimpleMode: runMode === 'simple',
    }
  }

  function clearAuth(): void {
    stopAutoRefresh()
    stopTokenRefresh()
    set({
      user: null,
      token: null,
      refreshTokenValue: null,
      tokenExpiresAt: null,
      isAuthenticated: false,
      isAdmin: false,
    })
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(TOKEN_EXPIRES_AT_KEY)
  }

  function startAutoRefresh(): void {
    stopAutoRefresh()
    refreshIntervalId = setInterval(() => {
      if (get().token) {
        get()
          .refreshUser()
          .catch((error) => {
            console.error('Auto-refresh user failed:', error)
          })
      }
    }, AUTO_REFRESH_INTERVAL)
  }

  async function performTokenRefresh(): Promise<void> {
    const { refreshTokenValue } = get()
    if (!refreshTokenValue) return

    try {
      const response = await authAPI.refreshToken()
      set({ token: response.access_token, refreshTokenValue: response.refresh_token })
      scheduleTokenRefresh(response.expires_in)
    } catch (error) {
      console.error('Token refresh failed:', error)
    }
  }

  function scheduleTokenRefreshAt(expiresAtMs: number): void {
    stopTokenRefresh()
    const refreshInMs = Math.max(0, expiresAtMs - Date.now() - TOKEN_REFRESH_BUFFER)
    if (refreshInMs <= 0) {
      performTokenRefresh()
      return
    }
    tokenRefreshTimeoutId = setTimeout(() => {
      performTokenRefresh()
    }, refreshInMs)
  }

  function scheduleTokenRefresh(expiresInSeconds: number): void {
    const expiresAtMs = Date.now() + expiresInSeconds * 1000
    set({ tokenExpiresAt: expiresAtMs })
    localStorage.setItem(TOKEN_EXPIRES_AT_KEY, String(expiresAtMs))
    scheduleTokenRefreshAt(expiresAtMs)
  }

  function setAuthFromResponse(response: AuthResponse): void {
    const { run_mode, ...userData } = response.user
    const runMode = run_mode || 'standard'

    set({
      token: response.access_token,
      user: userData,
      runMode,
      ...deriveComputed(userData, response.access_token, runMode),
    })

    localStorage.setItem(AUTH_TOKEN_KEY, response.access_token)
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData))

    if (response.refresh_token) {
      set({ refreshTokenValue: response.refresh_token })
      localStorage.setItem(REFRESH_TOKEN_KEY, response.refresh_token)
    }

    startAutoRefresh()

    if (response.refresh_token && response.expires_in) {
      scheduleTokenRefresh(response.expires_in)
    }
  }

  // ==================== Store ====================

  return {
    // State
    user: null,
    token: null,
    refreshTokenValue: null,
    tokenExpiresAt: null,
    runMode: 'standard' as const,
    isAuthenticated: false,
    isAdmin: false,
    isSimpleMode: false,

    // Actions
    checkAuth() {
      const savedToken = localStorage.getItem(AUTH_TOKEN_KEY)
      const savedUser = localStorage.getItem(AUTH_USER_KEY)
      const savedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
      const savedExpiresAt = localStorage.getItem(TOKEN_EXPIRES_AT_KEY)

      if (savedToken && savedUser) {
        try {
          const user = JSON.parse(savedUser) as User
          const tokenExpiresAt = savedExpiresAt ? parseInt(savedExpiresAt, 10) : null

          set({
            token: savedToken,
            user,
            refreshTokenValue: savedRefreshToken,
            tokenExpiresAt,
            ...deriveComputed(user, savedToken, get().runMode),
          })

          get()
            .refreshUser()
            .catch((error) => {
              console.error('Failed to refresh user on init:', error)
            })

          startAutoRefresh()

          if (savedRefreshToken && tokenExpiresAt !== null) {
            scheduleTokenRefreshAt(tokenExpiresAt)
          }
        } catch (error) {
          console.error('Failed to parse saved user data:', error)
          clearAuth()
        }
      }
    },

    async login(credentials: LoginRequest): Promise<LoginResponse> {
      try {
        const response = await authAPI.login(credentials)
        if (isTotp2FARequired(response)) {
          return response
        }
        setAuthFromResponse(response)
        return response
      } catch (error) {
        clearAuth()
        throw error
      }
    },

    async login2FA(tempToken: string, totpCode: string): Promise<User> {
      try {
        const response = await authAPI.login2FA({ temp_token: tempToken, totp_code: totpCode })
        setAuthFromResponse(response)
        return get().user!
      } catch (error) {
        clearAuth()
        throw error
      }
    },

    async register(userData: RegisterRequest): Promise<User> {
      try {
        const response = await authAPI.register(userData)
        setAuthFromResponse(response)
        return get().user!
      } catch (error) {
        clearAuth()
        throw error
      }
    },

    async setToken(newToken: string): Promise<User> {
      stopAutoRefresh()
      stopTokenRefresh()
      set({ token: null, user: null })

      set({ token: newToken })
      localStorage.setItem(AUTH_TOKEN_KEY, newToken)

      const savedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
      const savedExpiresAt = localStorage.getItem(TOKEN_EXPIRES_AT_KEY)

      if (savedRefreshToken) {
        set({ refreshTokenValue: savedRefreshToken })
      }
      if (savedExpiresAt) {
        set({ tokenExpiresAt: parseInt(savedExpiresAt, 10) })
      }

      try {
        const userData = await get().refreshUser()
        startAutoRefresh()

        if (savedRefreshToken && get().tokenExpiresAt !== null) {
          scheduleTokenRefreshAt(get().tokenExpiresAt!)
        }

        return userData
      } catch (error) {
        clearAuth()
        throw error
      }
    },

    async logout(): Promise<void> {
      await authAPI.logout()
      clearAuth()
    },

    async refreshUser(): Promise<User> {
      const { token, runMode } = get()
      if (!token) throw new Error('Not authenticated')

      try {
        const response = await authAPI.getCurrentUser()
        const { run_mode, ...userData } = response.data
        const newRunMode = run_mode || runMode

        set({
          user: userData,
          runMode: newRunMode,
          ...deriveComputed(userData, token, newRunMode),
        })

        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData))
        return userData
      } catch (error) {
        if ((error as { status?: number }).status === 401) {
          clearAuth()
        }
        throw error
      }
    },
  }
})
