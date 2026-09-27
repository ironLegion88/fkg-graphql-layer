import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { EyeOff, Eye } from 'lucide-react'
import { usePrefersReducedMotion } from '../graph/usePrefersReducedMotion'
import {
  ReducedMotionContext,
  useReducedMotion,
  type ReducedMotionContextType,
} from './ReducedMotionContext'
import './ReducedMotion.css'

export type { ReducedMotionContextType }

export interface ReducedMotionProviderProps {
  children: React.ReactNode
  initialPreference?: boolean
}

/**
 * Provider managing prefers-reduced-motion OS preferences and user overrides (AX-004, AX-006).
 */
export const ReducedMotionProvider: React.FC<ReducedMotionProviderProps> = ({
  children,
  initialPreference,
}) => {
  const systemPrefersReducedMotion = usePrefersReducedMotion()
  const [userOverride, setUserOverride] = useState<boolean | null>(() => {
    if (initialPreference !== undefined) return initialPreference
    if (typeof localStorage === 'undefined') return null
    const saved = localStorage.getItem('fkg_reduced_motion')
    return saved !== null ? saved === 'true' : null
  })

  const reducedMotion = userOverride !== null ? userOverride : systemPrefersReducedMotion

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (reducedMotion) {
      document.body.classList.add('reduced-motion')
    } else {
      document.body.classList.remove('reduced-motion')
    }
  }, [reducedMotion])

  const setPreference = useCallback((enabled: boolean) => {
    setUserOverride(enabled)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('fkg_reduced_motion', String(enabled))
    }
  }, [])

  const toggleReducedMotion = useCallback(() => {
    setUserOverride((prev) => {
      const current = prev !== null ? prev : systemPrefersReducedMotion
      const next = !current
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('fkg_reduced_motion', String(next))
      }
      return next
    })
  }, [systemPrefersReducedMotion])

  const value = useMemo(
    () => ({
      reducedMotion,
      toggleReducedMotion,
      setReducedMotion: setPreference,
      isSystemPreference: userOverride === null,
    }),
    [reducedMotion, toggleReducedMotion, setPreference, userOverride],
  )

  return (
    <ReducedMotionContext.Provider value={value}>
      {children}
    </ReducedMotionContext.Provider>
  )
}

export interface ReducedMotionToggleProps {
  className?: string
}

/**
 * Button control allowing users to manually toggle reduced motion (AX-004, AX-006).
 */
export const ReducedMotionToggle: React.FC<ReducedMotionToggleProps> = ({
  className = '',
}) => {
  const { reducedMotion, toggleReducedMotion } = useReducedMotion()

  return (
    <button
      type="button"
      className={`reduced-motion-toggle-btn ${reducedMotion ? 'active' : ''} ${className}`}
      onClick={toggleReducedMotion}
      aria-pressed={reducedMotion}
      aria-label={
        reducedMotion
          ? 'Reduced motion is enabled. Click to enable animations.'
          : 'Reduced motion is disabled. Click to reduce animations.'
      }
      title={
        reducedMotion
          ? 'Animations reduced (AX-006). Click to restore.'
          : 'Reduce motion and animations (AX-006).'
      }
    >
      {reducedMotion ? (
        <EyeOff size={14} aria-hidden="true" />
      ) : (
        <Eye size={14} aria-hidden="true" />
      )}
      <span className="toggle-text">
        {reducedMotion ? 'Reduced Motion' : 'Motion'}
      </span>
    </button>
  )
}

export default ReducedMotionToggle
