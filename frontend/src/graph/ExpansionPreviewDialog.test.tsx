import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ExpansionPreviewDialog } from './ExpansionPreviewDialog'
import type { ExpansionPreview, PreviewGroup } from '../interfaces/models'

describe('ExpansionPreviewDialog (GQ-108, GE-003)', () => {
  const mockGroups: PreviewGroup[] = [
    {
      relation: 'hasMaker',
      direction: 'OUTGOING',
      count: 5,
    },
    {
      relation: 'locatedIn',
      direction: 'INCOMING',
      count: 3,
    },
    {
      relation: 'sharesGrapeWith',
      direction: 'BOTH',
      count: 8,
    },
  ]

  const mockPreview: ExpansionPreview = {
    entity_id: 'wine:CabernetSauvignon',
    groups: mockGroups,
    total_count: 16,
  }

  it('renders nothing when isOpen is false', () => {
    const html = renderToString(
      <ExpansionPreviewDialog
        isOpen={false}
        entityId="wine:CabernetSauvignon"
        entityLabel="Cabernet Sauvignon"
        preview={mockPreview}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(html).toBe('')
  })

  it('renders dialog header, entity label, and total connections when open', () => {
    const html = renderToString(
      <ExpansionPreviewDialog
        isOpen={true}
        entityId="wine:CabernetSauvignon"
        entityLabel="Cabernet Sauvignon"
        preview={mockPreview}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(html).toContain('Expansion Preview')
    expect(html).toContain('Cabernet Sauvignon')
    expect(html).toContain('16')
  })

  it('renders preview groups with predicate relations, direction tags, and edge counts', () => {
    const html = renderToString(
      <ExpansionPreviewDialog
        isOpen={true}
        entityId="wine:CabernetSauvignon"
        entityLabel="Cabernet Sauvignon"
        preview={mockPreview}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(html).toContain('hasMaker')
    expect(html).toContain('locatedIn')
    expect(html).toContain('sharesGrapeWith')
    expect(html).toContain('Outgoing')
    expect(html).toContain('Incoming')
    expect(html).toContain('5')
    expect(html).toContain('3')
    expect(html).toContain('8')
    expect(html).toContain('edges')
  })

  it('renders loading state when isLoading is true', () => {
    const html = renderToString(
      <ExpansionPreviewDialog
        isOpen={true}
        entityId="wine:CabernetSauvignon"
        entityLabel="Cabernet Sauvignon"
        preview={null}
        isLoading={true}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(html).toContain('Analyzing entity relationships...')
  })

  it('renders error message when error is provided', () => {
    const html = renderToString(
      <ExpansionPreviewDialog
        isOpen={true}
        entityId="wine:CabernetSauvignon"
        entityLabel="Cabernet Sauvignon"
        preview={null}
        error="Failed to fetch connection preview from server"
        onExpand={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(html).toContain('Failed to fetch connection preview from server')
  })

  it('renders empty message when there are no connected relations', () => {
    const html = renderToString(
      <ExpansionPreviewDialog
        isOpen={true}
        entityId="wine:IsolatedNode"
        entityLabel="Isolated Node"
        preview={{ entity_id: 'wine:IsolatedNode', groups: [], total_count: 0 }}
        onExpand={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(html).toContain('No connections available for this entity.')
  })
})
