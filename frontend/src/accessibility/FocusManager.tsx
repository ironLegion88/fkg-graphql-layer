import React from 'react'
import { useFocusTrap } from './useFocusTrap'
import './FocusManager.css'

export interface SkipLinkItem {
  id: string
  label: string
}

export interface SkipLinksProps {
  links?: SkipLinkItem[]
}

const DEFAULT_SKIP_LINKS: SkipLinkItem[] = [
  { id: 'main-canvas', label: 'Skip to Graph Canvas' },
  { id: 'visible-graph-table', label: 'Skip to Visible Graph Table' },
  { id: 'navigation-panel', label: 'Skip to Ontology Navigation' },
  { id: 'inspector-panel', label: 'Skip to Semantic Inspector' },
]

/**
 * SkipLinks component renders accessible, keyboard-visible skip links at the top of the app (AX-001, AX-003).
 */
export const SkipLinks: React.FC<SkipLinksProps> = ({ links = DEFAULT_SKIP_LINKS }) => {
  return (
    <nav className="skip-links-container" aria-label="Skip Links">
      {links.map((link) => (
        <a
          key={link.id}
          href={`#${link.id}`}
          className="skip-link-item"
          onClick={(e) => {
            e.preventDefault()
            const target = document.getElementById(link.id)
            if (target) {
              target.setAttribute('tabindex', '-1')
              target.focus()
              target.scrollIntoView({ behavior: 'smooth' })
            }
          }}
        >
          {link.label}
        </a>
      ))}
    </nav>
  )
}

export interface FocusTrapProps {
  isActive: boolean
  onEscape?: () => void
  initialFocusSelector?: string
  restoreFocus?: boolean
  children: React.ReactNode
  className?: string
  role?: string
  ariaLabel?: string
  ariaModal?: boolean
}

/**
 * FocusTrap component wraps modal dialogs to trap focus and restore focus on exit (AX-001, AX-003).
 */
export const FocusTrap: React.FC<FocusTrapProps> = ({
  isActive,
  onEscape,
  initialFocusSelector,
  restoreFocus = true,
  children,
  className = '',
  role = 'dialog',
  ariaLabel,
  ariaModal = true,
}) => {
  const containerRef = useFocusTrap<HTMLDivElement>({
    isActive,
    onEscape,
    initialFocusSelector,
    restoreFocus,
  })

  return (
    <div
      ref={containerRef}
      role={role}
      aria-label={ariaLabel}
      aria-modal={ariaModal}
      className={`focus-trap-container ${className}`}
      tabIndex={-1}
    >
      {children}
    </div>
  )
}

export default FocusTrap
