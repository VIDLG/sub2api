import { useEffect, useRef } from 'react'
import { driver, type Driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import '@/onboarding.css'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { useOnboardingStore } from '@/stores/onboarding'
import { useTranslation } from 'react-i18next'
import { getAdminSteps, getUserSteps } from '@/components/Guide/steps'

export interface OnboardingOptions {
  storageKey?: string
  autoStart?: boolean
}

export function useOnboardingTour(options: OnboardingOptions) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const isSimpleMode = useAuthStore((s) => s.isSimpleMode)
  const onboardingStore = useOnboardingStore

  const storageVersion = 'v4_interactive'

  const TIMING = {
    INTERACTIVE_WAIT_MS: 800,
    ELEMENT_TIMEOUT_MS: 8000,
    AUTO_START_DELAY_MS: 1000,
  } as const

  const driverRef = useRef<Driver | null>(null)
  const currentClickListenerRef = useRef<{
    element: HTMLElement
    handler: () => void
    keyHandler?: (e: KeyboardEvent) => void
    originalTabIndex?: string | null
    eventTypes?: string[]
  } | null>(null)
  const globalKeyboardHandlerRef = useRef<((e: KeyboardEvent) => void) | null>(null)
  const autoStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const getStorageKey = () => {
    const baseKey = options.storageKey ?? 'onboarding_tour'
    const userId = user?.id ?? 'guest'
    const role = user?.role ?? 'user'
    return `${baseKey}_${userId}_${role}_${storageVersion}`
  }

  const hasSeen = () => localStorage.getItem(getStorageKey()) === 'true'
  const markAsSeen = () => localStorage.setItem(getStorageKey(), 'true')
  const clearSeen = () => localStorage.removeItem(getStorageKey())

  const ensureElement = async (selector: string, timeout = 5000): Promise<boolean> => {
    const startTime = Date.now()
    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector)
      if (element && element.getBoundingClientRect().height > 0) return true
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
    return false
  }

  const isInteractiveStep = (step: DriveStep): boolean =>
    step.popover?.showButtons?.length === 1 && step.popover.showButtons[0] === 'close'

  const cleanupClickListener = () => {
    const listener = currentClickListenerRef.current
    if (!listener) return
    const { element: el, handler, keyHandler, originalTabIndex, eventTypes } = listener
    if (eventTypes) eventTypes.forEach((type) => el.removeEventListener(type, handler))
    if (keyHandler) el.removeEventListener('keydown', keyHandler)
    if (originalTabIndex !== undefined) {
      if (originalTabIndex === null) el.removeAttribute('tabindex')
      else el.setAttribute('tabindex', originalTabIndex)
    }
    currentClickListenerRef.current = null
  }

  const startTour = async (startIndex = 0) => {
    const isAdmin = user?.role === 'admin'
    const steps = isAdmin ? getAdminSteps(t, isSimpleMode) : getUserSteps(t)

    await new Promise((resolve) => setTimeout(resolve, 0)) // nextTick equivalent

    const currentStep = steps[startIndex]
    if (currentStep?.element && typeof currentStep.element === 'string') {
      await ensureElement(currentStep.element, TIMING.ELEMENT_TIMEOUT_MS)
    }

    if (driverRef.current) {
      driverRef.current.destroy()
    }

    const driverInstance = driver({
      showProgress: true,
      steps,
      animate: true,
      allowClose: false,
      stagePadding: 4,
      popoverClass: 'theme-tour-popover',
      nextBtnText: t('common.next'),
      prevBtnText: t('common.back'),
      doneBtnText: t('common.confirm'),

      onNextClick: async (_el, _step, { config, state }) => {
        if (state.activeIndex === (config.steps?.length ?? 0) - 1) {
          markAsSeen()
          driverRef.current?.destroy()
          onboardingStore.getState().setDriverInstance(null)
        } else {
          const currentIndex = state.activeIndex ?? 0
          const step = steps[currentIndex]
          if (step && isInteractiveStep(step) && step.element) {
            const targetElement =
              typeof step.element === 'string'
                ? (document.querySelector(step.element) as HTMLElement)
                : (step.element as HTMLElement)
            if (targetElement && !['INPUT', 'TEXTAREA', 'SELECT'].includes(targetElement.tagName)) {
              targetElement.click()
              return
            }
          }
          driverRef.current?.moveNext()
        }
      },

      onPrevClick: () => {
        driverRef.current?.movePrevious()
      },

      onCloseClick: () => {
        markAsSeen()
        driverRef.current?.destroy()
        onboardingStore.getState().setDriverInstance(null)
      },

      onPopoverRender: (popover, { config, state }) => {
        const CLASS_REORGANIZED = 'reorganized'
        const CLASS_FOOTER_LEFT = 'footer-left'
        const CLASS_FOOTER_RIGHT = 'footer-right'
        const CLASS_DONE_BTN = 'driver-popover-done-btn'
        const CLASS_NEXT_BTN = 'driver-popover-next-btn'
        const CLASS_PREV_BTN = 'driver-popover-prev-btn'
        const CLASS_PROGRESS_TEXT = 'driver-popover-progress-text'

        try {
          const { title: titleEl, footer: footerEl, nextButton, previousButton } = popover
          if (!titleEl || !footerEl) return

          const currentStep = steps[state.activeIndex ?? 0]
          if (currentStep && isInteractiveStep(currentStep) && popover.description) {
            const hintClass = 'driver-popover-description-hint'
            if (!popover.description.querySelector(`.${hintClass}`)) {
              const hint = document.createElement('div')
              hint.className = `${hintClass} mt-2 text-xs text-gray-500 flex items-center gap-1`
              hint.appendChild(
                document.createTextNode(
                  t('onboarding.interactiveHint', 'Press Enter or Click to continue'),
                ),
              )
              popover.description.appendChild(hint)
            }
          }

          if (!footerEl.classList.contains(CLASS_REORGANIZED)) {
            footerEl.classList.add(CLASS_REORGANIZED)
            const progressEl = footerEl.querySelector(`.${CLASS_PROGRESS_TEXT}`)
            const nextBtnEl = nextButton || footerEl.querySelector(`.${CLASS_NEXT_BTN}`)
            const prevBtnEl = previousButton || footerEl.querySelector(`.${CLASS_PREV_BTN}`)

            const leftContainer = document.createElement('div')
            leftContainer.className = CLASS_FOOTER_LEFT
            const rightContainer = document.createElement('div')
            rightContainer.className = CLASS_FOOTER_RIGHT

            if (progressEl) leftContainer.appendChild(progressEl)

            const shortcutsEl = document.createElement('div')
            shortcutsEl.className = 'footer-shortcuts'

            const shortcut1 = document.createElement('span')
            shortcut1.className = 'shortcut-item'
            const kbd1 = document.createElement('kbd')
            kbd1.textContent = '←'
            const kbd2 = document.createElement('kbd')
            kbd2.textContent = '→'
            shortcut1.appendChild(kbd1)
            shortcut1.appendChild(kbd2)
            shortcut1.appendChild(
              document.createTextNode(` ${t('onboarding.navigation.flipPage')}`),
            )

            const shortcut2 = document.createElement('span')
            shortcut2.className = 'shortcut-item'
            const kbd3 = document.createElement('kbd')
            kbd3.textContent = 'ESC'
            shortcut2.appendChild(kbd3)
            shortcut2.appendChild(document.createTextNode(` ${t('onboarding.navigation.exit')}`))

            shortcutsEl.appendChild(shortcut1)
            shortcutsEl.appendChild(shortcut2)
            leftContainer.appendChild(shortcutsEl)

            if (prevBtnEl) rightContainer.appendChild(prevBtnEl)
            if (nextBtnEl) rightContainer.appendChild(nextBtnEl)

            footerEl.innerHTML = ''
            footerEl.appendChild(leftContainer)
            footerEl.appendChild(rightContainer)
          }

          const isLastStep = state.activeIndex === (config.steps?.length ?? 0) - 1
          const activeNextBtn = nextButton || footerEl.querySelector(`.${CLASS_NEXT_BTN}`)
          if (activeNextBtn) {
            if (isLastStep) activeNextBtn.classList.add(CLASS_DONE_BTN)
            else activeNextBtn.classList.remove(CLASS_DONE_BTN)
          }
        } catch (e) {
          console.error('Onboarding Tour Render Error:', e)
        }
      },

      onHighlightStarted: async (element, step) => {
        cleanupClickListener()

        if (!element && step.element && typeof step.element === 'string') {
          const exists = await ensureElement(step.element, 8000)
          if (!exists) {
            console.warn(`Tour element not found after 8s: ${step.element}`)
            return
          }
          element = document.querySelector(step.element) as HTMLElement
        }

        if (isInteractiveStep(step) && element) {
          const htmlElement = element as HTMLElement
          const isSubmitButton =
            htmlElement.getAttribute('type') === 'submit' ||
            (htmlElement.tagName === 'BUTTON' && !!htmlElement.closest('form'))
          if (isSubmitButton) return

          const originalTabIndex = htmlElement.getAttribute('tabindex')
          if (!htmlElement.isContentEditable && htmlElement.tabIndex === -1) {
            htmlElement.setAttribute('tabindex', '0')
          }

          const isSelectComponent =
            htmlElement.querySelector('.select-trigger') !== null ||
            htmlElement.classList.contains('select-trigger')
          if (isSelectComponent) return

          let hasExecuted = false
          const boundStepIndex = driverRef.current?.getActiveIndex() ?? 0

          const clickHandler = async () => {
            if (hasExecuted) return
            hasExecuted = true
            await new Promise((resolve) => setTimeout(resolve, TIMING.INTERACTIVE_WAIT_MS))
            if (!driverRef.current || !driverRef.current.isActive()) return
            const currentIndex = driverRef.current.getActiveIndex() ?? 0
            if (currentIndex !== boundStepIndex) return
            const nextStep = steps[currentIndex + 1]
            if (nextStep?.element && typeof nextStep.element === 'string') {
              const exists = await ensureElement(nextStep.element, TIMING.ELEMENT_TIMEOUT_MS)
              if (!exists) {
                console.warn(`Onboarding: Next step element not found: ${nextStep.element}`)
                return
              }
            }
            if (driverRef.current && driverRef.current.isActive()) driverRef.current.moveNext()
          }

          const isInputField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(htmlElement.tagName)
          if (isInputField) {
            const inputHandler = () => {
              htmlElement.removeEventListener('input', inputHandler)
              htmlElement.removeEventListener('change', inputHandler)
              void clickHandler()
            }
            htmlElement.addEventListener('input', inputHandler)
            htmlElement.addEventListener('change', inputHandler)
            currentClickListenerRef.current = {
              element: htmlElement,
              handler: inputHandler,
              originalTabIndex,
              eventTypes: ['input', 'change'],
            }
          } else {
            const keyHandler = (e: KeyboardEvent) => {
              if (['Enter', ' '].includes(e.key)) {
                e.preventDefault()
                void clickHandler()
              }
            }
            htmlElement.addEventListener('click', clickHandler as EventListener, { once: true })
            htmlElement.addEventListener('keydown', keyHandler)
            currentClickListenerRef.current = {
              element: htmlElement,
              handler: clickHandler as () => void,
              keyHandler,
              originalTabIndex,
              eventTypes: ['click'],
            }
          }
        }
      },

      onDestroyed: () => {
        cleanupClickListener()
        if (globalKeyboardHandlerRef.current) {
          document.removeEventListener('keydown', globalKeyboardHandlerRef.current, {
            capture: true,
          })
          globalKeyboardHandlerRef.current = null
        }
        onboardingStore.getState().setDriverInstance(null)
      },
    })

    driverRef.current = driverInstance
    onboardingStore
      .getState()
      .setDriverInstance(
        driverInstance as unknown as { isActive?: () => boolean; [key: string]: unknown },
      )

    globalKeyboardHandlerRef.current = (e: KeyboardEvent) => {
      if (!driverRef.current?.isActive()) return
      const target = e.target as HTMLElement
      const isInput = ['INPUT', 'TEXTAREA'].includes(target?.tagName)

      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        markAsSeen()
        driverRef.current.destroy()
        onboardingStore.getState().setDriverInstance(null)
        return
      }
      if (e.key === 'ArrowRight') {
        if (isInput) return
        e.preventDefault()
        e.stopPropagation()
        const currentIndex = driverRef.current!.getActiveIndex() ?? 0
        const step = steps[currentIndex]
        if (step && isInteractiveStep(step) && step.element) {
          const el =
            typeof step.element === 'string'
              ? (document.querySelector(step.element) as HTMLElement)
              : (step.element as HTMLElement)
          if (el && !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
        }
        driverRef.current!.moveNext()
      } else if (e.key === 'Enter') {
        if (isInput) return
        e.preventDefault()
        e.stopPropagation()
        const currentIndex = driverRef.current!.getActiveIndex() ?? 0
        const step = steps[currentIndex]
        if (step && isInteractiveStep(step) && step.element) {
          const el =
            typeof step.element === 'string'
              ? (document.querySelector(step.element) as HTMLElement)
              : (step.element as HTMLElement)
          if (el && !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
            el.click()
            return
          }
        }
        driverRef.current!.moveNext()
      } else if (e.key === 'ArrowLeft') {
        if (isInput || (target as HTMLElement)?.isContentEditable) return
        e.preventDefault()
        e.stopPropagation()
        driverRef.current!.movePrevious()
      }
    }

    document.addEventListener('keydown', globalKeyboardHandlerRef.current, { capture: true })
    driverInstance.drive(startIndex)
  }

  const nextStep = async (delay = 300) => {
    if (!driverRef.current?.isActive()) return
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
    driverRef.current.moveNext()
  }

  const isCurrentStep = (elementSelector: string): boolean => {
    if (!driverRef.current?.isActive()) return false
    return driverRef.current.getActiveElement()?.matches(elementSelector) ?? false
  }

  const replayTour = () => {
    clearSeen()
    void startTour()
  }

  useEffect(() => {
    onboardingStore.getState().setReplayCallback(replayTour)
    onboardingStore.getState().setControlMethods({ nextStep, isCurrentStep })

    if (onboardingStore.getState().isDriverActive()) {
      driverRef.current = onboardingStore.getState().getDriverInstance() as unknown as Driver
      return
    }

    if (isSimpleMode) return
    if (user?.role !== 'admin') return
    if (!options.autoStart || hasSeen()) return
    const onboardingEnabled =
      useAppStore.getState().cachedPublicSettings?.onboarding_enabled ?? false
    if (!onboardingEnabled) return

    autoStartTimerRef.current = setTimeout(() => {
      void startTour()
    }, TIMING.AUTO_START_DELAY_MS)

    return () => {
      if (autoStartTimerRef.current) clearTimeout(autoStartTimerRef.current)
      onboardingStore.getState().clearControlMethods()
      onboardingStore.getState().setReplayCallback(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { startTour, replayTour, nextStep, isCurrentStep, hasSeen, markAsSeen, clearSeen }
}
