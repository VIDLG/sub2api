import { create } from 'zustand'
import { toast } from 'sonner'
import type { PublicSettings } from '@/types'
import {
  checkUpdates as checkUpdatesAPI,
  type VersionInfo,
  type ReleaseInfo,
} from '@/api/admin/system'
import { getPublicSettings as fetchPublicSettingsAPI } from '@/api/auth'

let loadingCount = 0

interface AppState {
  sidebarCollapsed: boolean
  mobileOpen: boolean
  loading: boolean
  publicSettingsLoaded: boolean
  publicSettingsLoading: boolean
  siteName: string
  siteLogo: string
  siteVersion: string
  contactInfo: string
  apiBaseUrl: string
  docUrl: string
  cachedPublicSettings: PublicSettings | null
  versionLoaded: boolean
  versionLoading: boolean
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
  buildType: string
  releaseInfo: ReleaseInfo | null
}

interface AppActions {
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleMobileSidebar: () => void
  setMobileOpen: (open: boolean) => void
  setLoading: (isLoading: boolean) => void
  showToast: (
    type: 'success' | 'error' | 'info' | 'warning',
    message: string,
    duration?: number,
  ) => string
  showSuccess: (message: string, duration?: number) => string
  showError: (message: string, duration?: number) => string
  showInfo: (message: string, duration?: number) => string
  showWarning: (message: string, duration?: number) => string
  withLoading: <T>(operation: () => Promise<T>) => Promise<T>
  withLoadingAndError: <T>(operation: () => Promise<T>, errorMessage?: string) => Promise<T | null>
  fetchVersion: (force?: boolean) => Promise<VersionInfo | null>
  clearVersionCache: () => void
  fetchPublicSettings: (force?: boolean) => Promise<PublicSettings | null>
  clearPublicSettingsCache: () => void
  initFromInjectedConfig: () => boolean
}

export const useAppStore = create<AppState & AppActions>()((set, get) => {
  function applySettings(config: PublicSettings): void {
    set({
      cachedPublicSettings: config,
      siteName: config.site_name || 'Sub2API',
      siteLogo: config.site_logo || '',
      siteVersion: config.version || '',
      contactInfo: config.contact_info || '',
      apiBaseUrl: config.api_base_url || '',
      docUrl: config.doc_url || '',
      publicSettingsLoaded: true,
    })
  }

  return {
    sidebarCollapsed: false,
    mobileOpen: false,
    loading: false,
    publicSettingsLoaded: false,
    publicSettingsLoading: false,
    siteName: 'Sub2API',
    siteLogo: '',
    siteVersion: '',
    contactInfo: '',
    apiBaseUrl: '',
    docUrl: '',
    cachedPublicSettings: null,
    versionLoaded: false,
    versionLoading: false,
    currentVersion: '',
    latestVersion: '',
    hasUpdate: false,
    buildType: 'source',
    releaseInfo: null,

    toggleSidebar() {
      set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed }))
    },
    setSidebarCollapsed(collapsed: boolean) {
      set({ sidebarCollapsed: collapsed })
    },
    toggleMobileSidebar() {
      set((s) => ({ mobileOpen: !s.mobileOpen }))
    },
    setMobileOpen(open: boolean) {
      set({ mobileOpen: open })
    },

    setLoading(isLoading: boolean) {
      if (isLoading) {
        loadingCount++
      } else {
        loadingCount = Math.max(0, loadingCount - 1)
      }
      set({ loading: loadingCount > 0 })
    },

    showToast(
      type: 'success' | 'error' | 'info' | 'warning',
      message: string,
      duration?: number,
    ): string {
      const options = duration ? { duration } : undefined
      switch (type) {
        case 'success':
          toast.success(message, options)
          break
        case 'error':
          toast.error(message, options)
          break
        case 'info':
          toast.info(message, options)
          break
        case 'warning':
          toast.warning(message, options)
          break
      }
      return Date.now().toString()
    },
    showSuccess(message: string, duration = 3000) {
      return get().showToast('success', message, duration)
    },
    showError(message: string, duration = 5000) {
      return get().showToast('error', message, duration)
    },
    showInfo(message: string, duration = 3000) {
      return get().showToast('info', message, duration)
    },
    showWarning(message: string, duration = 4000) {
      return get().showToast('warning', message, duration)
    },

    async withLoading<T>(operation: () => Promise<T>): Promise<T> {
      get().setLoading(true)
      try {
        return await operation()
      } finally {
        get().setLoading(false)
      }
    },

    async withLoadingAndError<T>(
      operation: () => Promise<T>,
      errorMessage?: string,
    ): Promise<T | null> {
      get().setLoading(true)
      try {
        return await operation()
      } catch (error) {
        const message =
          errorMessage || (error as { message?: string }).message || 'An error occurred'
        get().showError(message)
        return null
      } finally {
        get().setLoading(false)
      }
    },

    async fetchVersion(force = false): Promise<VersionInfo | null> {
      const state = get()
      if (state.versionLoaded && !force) {
        return {
          current_version: state.currentVersion,
          latest_version: state.latestVersion,
          has_update: state.hasUpdate,
          build_type: state.buildType,
          release_info: state.releaseInfo || undefined,
          cached: true,
        }
      }
      if (state.versionLoading) return null

      set({ versionLoading: true })
      try {
        const data = await checkUpdatesAPI(force)
        set({
          currentVersion: data.current_version,
          latestVersion: data.latest_version,
          hasUpdate: data.has_update,
          buildType: data.build_type || 'source',
          releaseInfo: data.release_info || null,
          versionLoaded: true,
        })
        return data
      } catch (error) {
        console.error('Failed to fetch version:', error)
        return null
      } finally {
        set({ versionLoading: false })
      }
    },

    clearVersionCache() {
      set({ versionLoaded: false, hasUpdate: false })
    },

    async fetchPublicSettings(force = false): Promise<PublicSettings | null> {
      const state = get()

      if (!state.publicSettingsLoaded && !force && window.__APP_CONFIG__) {
        applySettings(window.__APP_CONFIG__)
        return window.__APP_CONFIG__
      }

      if (state.publicSettingsLoaded && !force) {
        if (state.cachedPublicSettings) {
          return { ...state.cachedPublicSettings }
        }
        return {
          registration_enabled: false,
          email_verify_enabled: false,
          promo_code_enabled: true,
          password_reset_enabled: false,
          invitation_code_enabled: false,
          turnstile_enabled: false,
          turnstile_site_key: '',
          site_name: state.siteName,
          site_logo: state.siteLogo,
          site_subtitle: '',
          api_base_url: state.apiBaseUrl,
          contact_info: state.contactInfo,
          doc_url: state.docUrl,
          home_content: '',
          hide_ccs_import_button: false,
          purchase_subscription_enabled: false,
          purchase_subscription_url: '',
          linuxdo_oauth_enabled: false,
          version: state.siteVersion,
          onboarding_enabled: false,
        }
      }

      if (state.publicSettingsLoading) return null

      set({ publicSettingsLoading: true })
      try {
        const data = await fetchPublicSettingsAPI()
        applySettings(data)
        return data
      } catch (error) {
        console.error('Failed to fetch public settings:', error)
        return null
      } finally {
        set({ publicSettingsLoading: false })
      }
    },

    clearPublicSettingsCache() {
      set({ publicSettingsLoaded: false, cachedPublicSettings: null })
    },

    initFromInjectedConfig(): boolean {
      if (window.__APP_CONFIG__) {
        applySettings(window.__APP_CONFIG__)
        return true
      }
      return false
    },
  }
})
