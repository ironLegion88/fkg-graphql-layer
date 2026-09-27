import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { SkipLinks, FocusTrap, focusElementById } from './FocusManager'
import { AppShell } from '../shell/AppShell'

describe('FocusManager & Accessibility Navigation (AX-001, AX-003)', () => {
  it('renders skip links to all primary application regions', () => {
    const html = renderToString(<SkipLinks />)

    expect(html).toContain('aria-label="Skip Links"')
    expect(html).toContain('href="#main-canvas"')
    expect(html).toContain('Skip to Graph Canvas')
    expect(html).toContain('href="#visible-graph-table"')
    expect(html).toContain('Skip to Visible Graph Table')
    expect(html).toContain('href="#navigation-panel"')
    expect(html).toContain('Skip to Ontology Navigation')
    expect(html).toContain('href="#inspector-panel"')
    expect(html).toContain('Skip to Semantic Inspector')
  })

  it('renders FocusTrap wrapper with dialog accessibility attributes', () => {
    const html = renderToString(
      <FocusTrap
        isActive={true}
        ariaLabel="Test Modal Dialog"
        onEscape={vi.fn()}
      >
        <button type="button">Inside Button</button>
      </FocusTrap>,
    )

    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-label="Test Modal Dialog"')
    expect(html).toContain('Inside Button')
  })

  it('AppShell integrates SkipLinks and panel landmarks with corresponding IDs', () => {
    const html = renderToString(
      <AppShell
        nodeCount={10}
        edgeCount={15}
        navigationContent={<div>Nav</div>}
        canvasContent={<div>Canvas</div>}
        inspectorContent={<div>Inspector</div>}
      />,
    )

    // Skip links rendered
    expect(html).toContain('Skip to Graph Canvas')
    expect(html).toContain('Skip to Ontology Navigation')
    expect(html).toContain('Skip to Semantic Inspector')

    // Matching panel landmarks
    expect(html).toContain('id="navigation-panel"')
    expect(html).toContain('id="main-canvas"')
    expect(html).toContain('id="inspector-panel"')
  })

  describe('focusElementById in DOM environment', () => {
    const originalDocument = globalThis.document

    afterEach(() => {
      globalThis.document = originalDocument
    })

    it('focusElementById sets tabindex and calls focus on existing DOM element', () => {
      const mockFocus = vi.fn()
      const mockSetAttribute = vi.fn()
      const mockHasAttribute = vi.fn().mockReturnValue(false)

      const fakeElement = {
        focus: mockFocus,
        setAttribute: mockSetAttribute,
        hasAttribute: mockHasAttribute,
      } as unknown as HTMLElement

      globalThis.document = {
        getElementById: vi.fn().mockReturnValue(fakeElement),
      } as unknown as Document

      const result = focusElementById('target-element')
      expect(result).toBe(true)
      expect(mockSetAttribute).toHaveBeenCalledWith('tabindex', '-1')
      expect(mockFocus).toHaveBeenCalled()
    })

    it('focusElementById returns false when element does not exist', () => {
      globalThis.document = {
        getElementById: vi.fn().mockReturnValue(null),
      } as unknown as Document

      const result = focusElementById('non-existent-id')
      expect(result).toBe(false)
    })
  })
})
