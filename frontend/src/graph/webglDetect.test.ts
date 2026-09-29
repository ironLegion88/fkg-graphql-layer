import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  detectWebGL2,
  isWebGL2Supported,
  resetWebGL2Cache,
} from './webglDetect'

describe('WebGL 2 Capability Detection (AC-111, RC-006)', () => {
  beforeEach(() => {
    resetWebGL2Cache()
    vi.restoreAllMocks()
    delete (globalThis as Record<string, unknown>).window
    delete (globalThis as Record<string, unknown>).document
  })

  afterEach(() => {
    resetWebGL2Cache()
    vi.restoreAllMocks()
    delete (globalThis as Record<string, unknown>).window
    delete (globalThis as Record<string, unknown>).document
  })

  it('handles non-browser or SSR environment gracefully', () => {
    const caps = detectWebGL2()
    expect(caps.webgl2).toBe(false)
    expect(caps.vendor).toBe('')
    expect(caps.renderer).toBe('')
    expect(caps.maxTextureSize).toBe(0)
    expect(isWebGL2Supported()).toBe(false)
  })

  it('detects WebGL 2 successfully when context is available', () => {
    const mockLoseContext = {
      loseContext: vi.fn(),
    }
    const mockDebugInfo = {
      UNMASKED_VENDOR_WEBGL: 0x9245,
      UNMASKED_RENDERER_WEBGL: 0x9246,
    }
    const mockGl = {
      getExtension: vi.fn((name: string) => {
        if (name === 'WEBGL_debug_renderer_info') return mockDebugInfo
        if (name === 'WEBGL_lose_context') return mockLoseContext
        return null
      }),
      getParameter: vi.fn((param: number) => {
        if (param === 0x9245) return 'NVIDIA Corporation'
        if (param === 0x9246) return 'NVIDIA GeForce RTX 4080'
        return 16384 // MAX_TEXTURE_SIZE
      }),
    }

    const mockCreateElement = vi.fn().mockReturnValue({
      getContext: vi.fn((type: string) => {
        if (type === 'webgl2') return mockGl
        return null
      }),
    })

    ;(globalThis as Record<string, unknown>).window = {}
    ;(globalThis as Record<string, unknown>).document = {
      createElement: mockCreateElement,
    }

    const caps = detectWebGL2()

    expect(caps.webgl2).toBe(true)
    expect(caps.vendor).toBe('NVIDIA Corporation')
    expect(caps.renderer).toBe('NVIDIA GeForce RTX 4080')
    expect(caps.maxTextureSize).toBe(16384)
    expect(mockLoseContext.loseContext).toHaveBeenCalled()
    expect(isWebGL2Supported()).toBe(true)
  })

  it('caches detection result across subsequent calls', () => {
    const mockCreateElement = vi.fn().mockReturnValue({
      getContext: vi.fn().mockReturnValue(null),
    })

    ;(globalThis as Record<string, unknown>).window = {}
    ;(globalThis as Record<string, unknown>).document = {
      createElement: mockCreateElement,
    }

    const caps1 = detectWebGL2()
    expect(caps1.webgl2).toBe(false)
    expect(mockCreateElement).toHaveBeenCalledTimes(1)

    // Second call should return cached result without calling createElement again
    const caps2 = detectWebGL2()
    expect(caps2).toBe(caps1)
    expect(mockCreateElement).toHaveBeenCalledTimes(1)

    // Force refresh or reset clears the cache
    resetWebGL2Cache()
    detectWebGL2()
    expect(mockCreateElement).toHaveBeenCalledTimes(2)
  })

  it('returns webgl2: false gracefully when getContext returns null (AC-111 fallback)', () => {
    const mockCreateElement = vi.fn().mockReturnValue({
      getContext: vi.fn().mockReturnValue(null),
    })

    ;(globalThis as Record<string, unknown>).window = {}
    ;(globalThis as Record<string, unknown>).document = {
      createElement: mockCreateElement,
    }

    const caps = detectWebGL2()
    expect(caps.webgl2).toBe(false)
    expect(caps.vendor).toBe('')
    expect(caps.renderer).toBe('')
    expect(caps.maxTextureSize).toBe(0)
    expect(isWebGL2Supported()).toBe(false)
  })

  it('handles canvas or getContext exception without crashing', () => {
    const mockCreateElement = vi.fn().mockImplementation(() => {
      throw new Error('Canvas allocation failed')
    })

    ;(globalThis as Record<string, unknown>).window = {}
    ;(globalThis as Record<string, unknown>).document = {
      createElement: mockCreateElement,
    }

    const caps = detectWebGL2()
    expect(caps.webgl2).toBe(false)
    expect(caps.vendor).toBe('')
    expect(isWebGL2Supported()).toBe(false)
  })
})
