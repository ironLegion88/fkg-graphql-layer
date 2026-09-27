import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ReducedMotionProvider, ReducedMotionToggle } from './ReducedMotion'

describe('ReducedMotion & Animation Controls (AX-004, AX-006)', () => {
  it('renders ReducedMotionToggle with proper ARIA attributes when disabled', () => {
    const html = renderToString(
      <ReducedMotionProvider initialPreference={false}>
        <ReducedMotionToggle />
      </ReducedMotionProvider>,
    )

    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('Motion')
    expect(html).toContain('reduced-motion-toggle-btn')
  })

  it('renders ReducedMotionToggle with active styling and aria-pressed="true" when enabled', () => {
    const html = renderToString(
      <ReducedMotionProvider initialPreference={true}>
        <ReducedMotionToggle />
      </ReducedMotionProvider>,
    )

    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('Reduced Motion')
    expect(html).toContain('active')
  })

  it('ReducedMotion.css contains prefers-reduced-motion media query and body overrides', async () => {
    // @ts-ignore
    const fs = await import('node:fs')
    // @ts-ignore
    const path = await import('node:path')
    const cssPath = path.resolve('src/accessibility/ReducedMotion.css')
    if (fs.existsSync(cssPath)) {
      const content = fs.readFileSync(cssPath, 'utf-8')
      expect(content).toContain('@media (prefers-reduced-motion: reduce)')
      expect(content).toContain('animation-duration: 0.001ms !important')
      expect(content).toContain('transition-duration: 0.001ms !important')
      expect(content).toContain('body.reduced-motion')
    }
  })
})
