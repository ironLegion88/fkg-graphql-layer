import { useEffect, useState } from 'react'

/**
 * Hook to detect and reactively subscribe to the user's OS prefers-reduced-motion preference.
 * Requirements: RC-008, AX-004
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    } else if ('addListener' in mediaQuery && typeof (mediaQuery as unknown as { addListener: (cb: (e: MediaQueryListEvent) => void) => void }).addListener === 'function') {
      ;(mediaQuery as unknown as {
        addListener: (cb: (e: MediaQueryListEvent) => void) => void
        removeListener: (cb: (e: MediaQueryListEvent) => void) => void
      }).addListener(handleChange)
      return () => {
        ;(mediaQuery as unknown as {
          removeListener: (cb: (e: MediaQueryListEvent) => void) => void
        }).removeListener(handleChange)
      }
    }
  }, [])

  return prefersReducedMotion
}
