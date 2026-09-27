import { createContext, useContext } from 'react'

export interface ReducedMotionContextType {
  reducedMotion: boolean
  toggleReducedMotion: () => void
  setReducedMotion: (enabled: boolean) => void
  isSystemPreference: boolean
}

export const ReducedMotionContext = createContext<ReducedMotionContextType>({
  reducedMotion: false,
  toggleReducedMotion: () => {},
  setReducedMotion: () => {},
  isSystemPreference: false,
})

/**
 * Hook to consume the reduced motion preference throughout the application.
 */
export function useReducedMotion(): ReducedMotionContextType {
  return useContext(ReducedMotionContext)
}
