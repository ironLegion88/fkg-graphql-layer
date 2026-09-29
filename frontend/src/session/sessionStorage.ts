import type { ExplorerSession } from '../interfaces/models'
import { deserializeSession } from './sessionSchema'

export const STORAGE_KEY_ACTIVE = 'fkg_explorer_session'
export const STORAGE_KEY_SAVED_SESSIONS = 'fkg_explorer_saved_sessions'
export const STORAGE_KEY_AUTOSAVE_ENABLED = 'fkg_explorer_autosave_enabled'

export interface StorageOperationResult {
  success: boolean
  error?: string
}

/**
 * Saves current session state to browser localStorage under 'fkg_explorer_session'.
 * Handles storage quota limitations gracefully.
 */
export function saveToLocalStorage(session: ExplorerSession): StorageOperationResult {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { success: false, error: 'Browser localStorage is not available in this environment' }
  }

  try {
    const json = JSON.stringify(session)
    window.localStorage.setItem(STORAGE_KEY_ACTIVE, json)
    return { success: true }
  } catch (error) {
    let msg = 'Failed to save session to localStorage'
    if (error instanceof Error) {
      if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        msg = 'Browser storage quota exceeded. Consider clearing older sessions or exporting to file.'
      } else {
        msg = `Failed to save session: ${error.message}`
      }
    }
    return { success: false, error: msg }
  }
}

/**
 * Loads the active session from browser localStorage.
 */
export function loadFromLocalStorage(): ExplorerSession | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_ACTIVE)
    if (!raw) return null
    const result = deserializeSession(raw)
    if (result.success) {
      return result.session
    } else {
      console.warn('Invalid session found in localStorage:', result.error)
      return null
    }
  } catch (error) {
    console.warn('Error reading from localStorage:', error)
    return null
  }
}

/**
 * Clears the active session from localStorage.
 */
export function clearLocalStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.removeItem(STORAGE_KEY_ACTIVE)
  } catch (error) {
    console.warn('Error clearing localStorage active session:', error)
  }
}

/**
 * Checks whether automatic background session saving is enabled.
 */
export function getAutoSaveEnabled(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return true
  try {
    const val = window.localStorage.getItem(STORAGE_KEY_AUTOSAVE_ENABLED)
    if (val === null) return true
    return val === 'true'
  } catch {
    return true
  }
}

/**
 * Toggles or sets automatic background session saving.
 */
export function setAutoSaveEnabled(enabled: boolean): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(STORAGE_KEY_AUTOSAVE_ENABLED, enabled ? 'true' : 'false')
  } catch (error) {
    console.warn('Error setting auto-save preference:', error)
  }
}

/**
 * Lists all named saved sessions stored in browser localStorage.
 */
export function listSavedSessions(): ExplorerSession[] {
  if (typeof window === 'undefined' || !window.localStorage) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_SAVED_SESSIONS)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const sessions: ExplorerSession[] = []
    for (const item of parsed) {
      const res = deserializeSession(item)
      if (res.success) {
        sessions.push(res.session)
      }
    }
    return sessions.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  } catch (error) {
    console.warn('Error listing saved sessions:', error)
    return []
  }
}

/**
 * Saves a named session to the saved sessions list in localStorage.
 */
export function saveNamedSession(session: ExplorerSession, name: string): StorageOperationResult {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { success: false, error: 'Browser localStorage is not available' }
  }

  try {
    const currentList = listSavedSessions()
    const namedSession: ExplorerSession = {
      ...session,
      name: name.trim() || 'Untitled Session',
      updated_at: new Date().toISOString(),
    }

    // Replace if existing by matching name or unique session id/timestamp and name, else append
    const existingIndex = currentList.findIndex(
      (s) => s.name && s.name.trim().toLowerCase() === namedSession.name?.trim().toLowerCase()
    )
    if (existingIndex >= 0) {
      currentList[existingIndex] = namedSession
    } else {
      currentList.unshift(namedSession)
    }

    // Keep at most 20 saved sessions to prevent storage blowout
    const trimmed = currentList.slice(0, 20)
    window.localStorage.setItem(STORAGE_KEY_SAVED_SESSIONS, JSON.stringify(trimmed))
    return { success: true }
  } catch (error) {
    let msg = 'Failed to save session to list'
    if (error instanceof Error && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      msg = 'Browser storage quota exceeded. Please remove some older sessions.'
    }
    return { success: false, error: msg }
  }
}

/**
 * Deletes a saved session from the saved sessions list in localStorage.
 */
export function deleteSavedSession(createdAtOrName: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    const currentList = listSavedSessions()
    const updated = currentList.filter(
      (s) => s.created_at !== createdAtOrName && s.name !== createdAtOrName
    )
    window.localStorage.setItem(STORAGE_KEY_SAVED_SESSIONS, JSON.stringify(updated))
  } catch (error) {
    console.warn('Error deleting saved session:', error)
  }
}
