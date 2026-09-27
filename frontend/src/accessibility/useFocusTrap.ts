import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'details',
].join(', ')

export interface UseFocusTrapOptions {
  isActive: boolean
  onEscape?: () => void
  initialFocusSelector?: string
  restoreFocus?: boolean
}

/**
 * Traps focus within a container element for modal dialogs and overlays (AX-001, AX-003).
 * Restores focus to the triggering element when the dialog closes.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>({
  isActive,
  onEscape,
  initialFocusSelector,
  restoreFocus = true,
}: UseFocusTrapOptions) {
  const containerRef = useRef<T | null>(null)
  const previousFocusedElementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isActive) return

    // Save previous active element to restore upon close
    previousFocusedElementRef.current = document.activeElement as HTMLElement | null

    const container = containerRef.current
    if (!container) return

    // Find initial focus target
    const focusInitial = () => {
      if (initialFocusSelector) {
        const initialEl = container.querySelector<HTMLElement>(initialFocusSelector)
        if (initialEl) {
          initialEl.focus()
          return
        }
      }

      const focusableElements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (focusableElements.length > 0) {
        focusableElements[0].focus()
      } else {
        container.focus()
      }
    }

    // Small delay to allow render
    const timer = setTimeout(focusInitial, 16)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive) return

      if (e.key === 'Escape' && onEscape) {
        e.preventDefault()
        onEscape()
        return
      }

      if (e.key === 'Tab') {
        const focusable = Array.from(
          container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter((el) => el.offsetParent !== null) // only visible elements

        if (focusable.length === 0) {
          e.preventDefault()
          return
        }

        const firstElement = focusable[0]
        const lastElement = focusable[focusable.length - 1]

        if (e.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstElement || !container.contains(document.activeElement)) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          // Tab
          if (document.activeElement === lastElement || !container.contains(document.activeElement)) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', handleKeyDown)
      if (restoreFocus && previousFocusedElementRef.current) {
        previousFocusedElementRef.current.focus()
      }
    }
  }, [isActive, onEscape, initialFocusSelector, restoreFocus])

  return containerRef
}

/**
 * Utility function to shift keyboard focus to an element by ID.
 */
export function focusElementById(id: string): boolean {
  if (typeof document === 'undefined') return false
  const el = document.getElementById(id)
  if (!el) return false
  if (!el.hasAttribute('tabindex')) {
    el.setAttribute('tabindex', '-1')
  }
  el.focus()
  return true
}
