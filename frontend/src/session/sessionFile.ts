import type { ExplorerSession } from '../interfaces/models'
import { deserializeSession } from './sessionSchema'

export const MAX_SESSION_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

/**
 * Triggers a client-side download of the ExplorerSession as a .fkg-session.json file.
 * Satisfies requirements SE-001, SE-002, and UW-008.
 */
export function downloadSession(session: ExplorerSession, customFilename?: string): void {
  if (typeof window === 'undefined') return

  const dateStr = new Date().toISOString().slice(0, 10)
  const baseName = customFilename?.trim()
    ? customFilename.trim().replace(/[^a-zA-Z0-9_\-.]/g, '_')
    : session.name
      ? session.name.replace(/[^a-zA-Z0-9_\-.]/g, '_')
      : `fkg-session-${session.profile_id}-${dateStr}`

  const filename = baseName.endsWith('.fkg-session.json')
    ? baseName
    : baseName.endsWith('.json')
      ? `${baseName.slice(0, -5)}.fkg-session.json`
      : `${baseName}.fkg-session.json`

  const jsonString = JSON.stringify(session, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)

  const downloadAnchor = document.createElement('a')
  downloadAnchor.href = objectUrl
  downloadAnchor.download = filename
  downloadAnchor.style.display = 'none'
  document.body.appendChild(downloadAnchor)

  downloadAnchor.click()

  window.setTimeout(() => {
    document.body.removeChild(downloadAnchor)
    URL.revokeObjectURL(objectUrl)
  }, 100)
}

/**
 * Reads and parses an uploaded .fkg-session.json or .json file into a validated ExplorerSession.
 * Enforces a 10MB maximum file size limit and comprehensive JSON validation.
 */
export async function uploadSession(file: File): Promise<ExplorerSession> {
  if (!file) {
    throw new Error('No file provided for upload')
  }

  if (file.size > MAX_SESSION_FILE_SIZE_BYTES) {
    throw new Error(`File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed 10 MB limit`)
  }

  const fileText = await file.text()
  const result = deserializeSession(fileText)

  if (!result.success) {
    throw new Error(result.error)
  }

  return result.session
}
