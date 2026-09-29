import type { TraversalDirection } from '../interfaces/models'

export interface DeepLinkState {
  entities?: string[]
  selected?: string | null
  layout?: string
  direction?: TraversalDirection
  inferred?: boolean
  profile?: string
  build?: string | null
}

/**
 * Parses deep link parameters from a URL hash string.
 * Satisfies requirements OP-009 and SE-003.
 * Supports: #entities=iri1,iri2&selected=iri&layout=dagre&direction=OUTGOING&inferred=true
 */
export function parseDeepLink(hashString?: string): DeepLinkState | null {
  const hash =
    hashString !== undefined
      ? hashString
      : typeof window !== 'undefined'
        ? window.location.hash
        : ''

  if (!hash || hash === '#' || hash.length <= 1) {
    return null
  }

  const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(cleanHash)

  const entitiesParam = params.get('entities')
  let entities: string[] | undefined
  if (entitiesParam) {
    entities = entitiesParam
      .split(',')
      .map((item) => decodeURIComponent(item.trim()))
      .filter((item) => item.length > 0)
  }

  const selectedParam = params.get('selected')
  const selected = selectedParam ? decodeURIComponent(selectedParam.trim()) : null

  const layout = params.get('layout') || undefined

  const dirParam = params.get('direction')?.toUpperCase()
  let direction: TraversalDirection | undefined
  if (dirParam === 'OUTGOING' || dirParam === 'INCOMING' || dirParam === 'BOTH') {
    direction = dirParam as TraversalDirection
  }

  const inferredParam = params.get('inferred')
  let inferred: boolean | undefined
  if (inferredParam !== null) {
    inferred = inferredParam === 'true' || inferredParam === '1'
  }

  const profile = params.get('profile') || undefined
  const build = params.get('build') || undefined

  if (!entities && !selected && !layout && !direction && inferred === undefined && !profile && !build) {
    return null
  }

  return {
    entities,
    selected,
    layout,
    direction,
    inferred,
    profile,
    build,
  }
}

/**
 * Formats a DeepLinkState into a URL hash string.
 */
export function formatDeepLinkHash(state: DeepLinkState): string {
  const params = new URLSearchParams()

  if (state.entities && state.entities.length > 0) {
    const encoded = state.entities.map((iri) => encodeURIComponent(iri)).join(',')
    params.set('entities', encoded)
  }

  if (state.selected) {
    params.set('selected', encodeURIComponent(state.selected))
  }

  if (state.layout && state.layout !== 'breadthfirst') {
    params.set('layout', state.layout)
  }

  if (state.direction && state.direction !== 'BOTH') {
    params.set('direction', state.direction)
  }

  if (state.inferred === false) {
    params.set('inferred', 'false')
  }

  if (state.profile) {
    params.set('profile', state.profile)
  }

  if (state.build) {
    params.set('build', state.build)
  }

  const queryString = params.toString()
  return queryString ? `#${queryString}` : ''
}

/**
 * Generates the full shareable deep link URL.
 */
export function generateDeepLinkUrl(state: DeepLinkState): string {
  if (typeof window === 'undefined') return ''
  const hash = formatDeepLinkHash(state)
  return `${window.location.origin}${window.location.pathname}${hash}`
}

/**
 * Updates browser address bar hash without triggering page reload or polluting history.
 * Uses window.history.replaceState.
 */
export function updateBrowserUrl(state: DeepLinkState): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return
  const hash = formatDeepLinkHash(state)
  const newUrl = `${window.location.pathname}${window.location.search}${hash}`
  window.history.replaceState(null, '', newUrl)
}

/**
 * Copies the current shareable deep link to clipboard.
 */
export async function copyDeepLink(state: DeepLinkState): Promise<boolean> {
  const url = generateDeepLinkUrl(state)
  if (!url || typeof navigator === 'undefined' || !navigator.clipboard) {
    return false
  }

  try {
    await navigator.clipboard.writeText(url)
    return true
  } catch (error) {
    console.warn('Failed to copy deep link to clipboard:', error)
    return false
  }
}
