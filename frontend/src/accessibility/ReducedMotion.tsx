import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { EyeOff, Eye } from 'lucide-react'
import { usePrefersReducedMotion } from '../graph/usePrefersReducedMotion'
import './ReducedMotion.css'

export interface ReducedMotionContextType {
  reducedMotion: boolean
  toggleReducedMotion: () => void
  setReducedMotion: (enabled: boolean) => void
  isSystemPreference: boolean
}

const ReducedMotionContext = createContext<ReducedMotionContextType>({
  reducedMotion: false,
  toggleReducedMotion: () => {},
  setReducedMotion: () => {},
  isSystemPreference: false,
})

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

  const setPreference = (enabled: boolean) => {
    setUserOverride(enabled)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('fkg_reduced_motion', String(enabled))
    }
  }

  const toggleReducedMotion = () => {
    setPreference(!reducedMotion)
  }

  const value = useMemo(
    () => ({
      reducedMotion,
      toggleReducedMotion,
      setReducedMotion: setPreference,
      isSystemPreference: userOverride === null,
    }),
    [reducedMotion, userOverride],
  )

  return (
    <ReducedMotionContext.Provider value={value}>
      {children}
    </ReducedMotionContext.Provider>
  )
}

/**
 * Hook to consume the reduced motion preference throughout the application.
 */
export function useReducedMotion(): ReducedMotionContextType {
  return useContext(ReducedMotionContext)
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
