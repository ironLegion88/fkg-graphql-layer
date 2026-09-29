/**
 * WebGL 2 Capability Detection Utility
 *
 * Implements GPU capability detection and caching as required by RC-006 and AC-111.
 * Supports graceful fallback when WebGL 2 is unavailable or initialization fails.
 */

export interface WebGL2Capabilities {
  webgl2: boolean
  vendor: string
  renderer: string
  maxTextureSize: number
}

let cachedCapabilities: WebGL2Capabilities | null = null

/**
 * Detect WebGL 2 capability by querying a temporary canvas.
 * Result is cached after the first execution. Pass forceRefresh = true to re-evaluate.
 */
export function detectWebGL2(forceRefresh = false): WebGL2Capabilities {
  if (cachedCapabilities !== null && !forceRefresh) {
    return cachedCapabilities
  }

  // Gracefully handle server-side rendering or non-browser environments
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    cachedCapabilities = {
      webgl2: false,
      vendor: '',
      renderer: '',
      maxTextureSize: 0,
    }
    return cachedCapabilities
  }

  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')

    if (!gl) {
      cachedCapabilities = {
        webgl2: false,
        vendor: '',
        renderer: '',
        maxTextureSize: 0,
      }
      return cachedCapabilities
    }

    let vendor = ''
    let renderer = ''
    const dbgRenderInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (dbgRenderInfo) {
      vendor = (gl.getParameter(dbgRenderInfo.UNMASKED_VENDOR_WEBGL) as string) || ''
      renderer = (gl.getParameter(dbgRenderInfo.UNMASKED_RENDERER_WEBGL) as string) || ''
    }

    if (!vendor) {
      vendor = (gl.getParameter(gl.VENDOR) as string) || ''
    }
    if (!renderer) {
      renderer = (gl.getParameter(gl.RENDERER) as string) || ''
    }

    const maxTextureSize = (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) || 0

    // Clean up WebGL context where loseContext is supported
    const loseContext = gl.getExtension('WEBGL_lose_context')
    if (loseContext) {
      loseContext.loseContext()
    }

    cachedCapabilities = {
      webgl2: true,
      vendor,
      renderer,
      maxTextureSize,
    }
    return cachedCapabilities
  } catch {
    cachedCapabilities = {
      webgl2: false,
      vendor: '',
      renderer: '',
      maxTextureSize: 0,
    }
    return cachedCapabilities
  }
}

/**
 * Quick boolean check for WebGL 2 support.
 */
export function isWebGL2Supported(): boolean {
  return detectWebGL2().webgl2
}

/**
 * Clear capability cache (primarily useful for unit tests mocking context creation).
 */
export function resetWebGL2Cache(): void {
  cachedCapabilities = null
}
