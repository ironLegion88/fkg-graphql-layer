import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import {
  CURRENT_SESSION_VERSION,
  serializeSession,
  deserializeSession,
} from './sessionSchema'
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  clearLocalStorage,
  getAutoSaveEnabled,
  setAutoSaveEnabled,
  listSavedSessions,
  saveNamedSession,
  deleteSavedSession,
} from './sessionStorage'
import {
  downloadSession,
  uploadSession,
  MAX_SESSION_FILE_SIZE_BYTES,
} from './sessionFile'
import {
  checkCompatibility,
  filterSessionForPartialRestore,
} from './sessionCompatibility'
import {
  parseDeepLink,
  formatDeepLinkHash,
  generateDeepLinkUrl,
  copyDeepLink,
  type DeepLinkState,
} from './deepLinks'
import { SessionManager } from './SessionManager'
import type {
  ActiveProfile,
  GraphEntity,
  GraphRelationship,
} from '../interfaces/models'

// Mock fixture data
const mockEntities: Record<string, GraphEntity> = {
  'wine:ChateauMargaux': {
    __typename: 'Wine',
    id: 'wine:ChateauMargaux',
    label: 'Château Margaux',
    description: 'Premier Grand Cru Classé',
  },
  'wine:BordeauxRegion': {
    __typename: 'Region',
    id: 'wine:BordeauxRegion',
    label: 'Bordeaux Region',
    description: 'Famous French wine region',
  },
}

const mockRelationships: Record<string, GraphRelationship> = {
  'wine:ChateauMargaux|hasRegion|wine:BordeauxRegion': {
    relation: 'hasRegion',
    source: mockEntities['wine:ChateauMargaux'],
    target: mockEntities['wine:BordeauxRegion'],
    predicate_iri: 'http://example.org/wine#hasRegion',
    predicate_label: 'has region',
    is_inferred: false,
    source_graph: 'http://example.org/wine',
    explanation_handle: null,
  },
}

const mockProfile: ActiveProfile = {
  metadata: {
    package_id: 'wine-ontology-v1',
    title: 'Wine Ontology',
    description: 'W3C Wine Sample Ontology',
    version: '1.0.0',
    ontology_iris: ['http://example.org/wine'],
  },
  prefixes: [{ prefix: 'wine', iri: 'http://example.org/wine#' }],
  categories: [],
  predicates: [
    {
      name: 'hasRegion',
      iri: 'http://example.org/wine#hasRegion',
      label: 'has region',
      traversable: true,
      hidden: false,
    },
  ],
  limits: { max_depth: 3, max_nodes: 500, max_edges: 1000 },
  languages: { preferred_languages: ['en', 'fr'] },
  reasoning_profile: 'HermiT OWL 2 DL',
  build_id: 'build-2026-09-29-wine',
}

describe('Session Schema & Serialization (SE-001, GQ-114)', () => {
  it('serializes complete graph state into renderer-neutral schema', () => {
    const session = serializeSession({
      profile_id: 'wine-ontology-v1',
      build_id: 'build-2026-09-29-wine',
      entities: mockEntities,
      relationships: mockRelationships,
      selected_id: 'wine:ChateauMargaux',
      camera: { zoom: 1.5, pan: { x: 100, y: -50 } },
      pinned_nodes: ['wine:ChateauMargaux'],
      layout_name: 'dagre',
      direction: 'OUTGOING',
      include_inferred: false,
      node_positions: { 'wine:ChateauMargaux': { x: 10, y: 20 } },
      name: 'My Test Session',
    })

    expect(session.version).toBe(CURRENT_SESSION_VERSION)
    expect(session.profile_id).toBe('wine-ontology-v1')
    expect(session.build_id).toBe('build-2026-09-29-wine')
    expect(session.selected_id).toBe('wine:ChateauMargaux')
    expect(session.camera).toEqual({ zoom: 1.5, pan: { x: 100, y: -50 } })
    expect(session.pinned_nodes).toEqual(['wine:ChateauMargaux'])
    expect(session.layout_name).toBe('dagre')
    expect(session.direction).toBe('OUTGOING')
    expect(session.include_inferred).toBe(false)
    expect(session.node_positions).toEqual({ 'wine:ChateauMargaux': { x: 10, y: 20 } })
    expect(session.name).toBe('My Test Session')
    expect(Object.keys(session.entities)).toHaveLength(2)
    expect(Object.keys(session.relationships)).toHaveLength(1)
  })

  it('performs lossless round-trip serialization and deserialization', () => {
    const original = serializeSession({
      profile_id: 'wine-ontology-v1',
      build_id: 'build-2026-09-29-wine',
      entities: mockEntities,
      relationships: mockRelationships,
      selected_id: 'wine:ChateauMargaux',
    })

    const json = JSON.stringify(original)
    const result = deserializeSession(json)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.session.version).toBe(original.version)
      expect(result.session.profile_id).toBe(original.profile_id)
      expect(result.session.entities).toEqual(original.entities)
      expect(result.session.relationships).toEqual(original.relationships)
      expect(result.session.selected_id).toBe(original.selected_id)
    }
  })

  it('rejects invalid JSON string or corrupted schema format', () => {
    const invalidJson = deserializeSession('{ corrupted json string')
    expect(invalidJson.success).toBe(false)

    const notAnObject = deserializeSession(12345)
    expect(notAnObject.success).toBe(false)

    const missingVersion = deserializeSession({ profile_id: 'p1', entities: {}, relationships: {} })
    expect(missingVersion.success).toBe(false)
    if (!missingVersion.success) {
      expect(missingVersion.error).toContain('schema version')
    }

    const missingProfile = deserializeSession({ version: '1.0.0', entities: {}, relationships: {} })
    expect(missingProfile.success).toBe(false)
    if (!missingProfile.success) {
      expect(missingProfile.error).toContain('profile_id')
    }

    const invalidEntity = deserializeSession({
      version: '1.0.0',
      profile_id: 'p1',
      entities: { 'e1': { invalid: true } },
      relationships: {},
    })
    expect(invalidEntity.success).toBe(false)
  })
})

describe('Session Compatibility Checks (OP-009, SE-001, SE-002)', () => {
  it('reports fully compatible when profile and build match', () => {
    const session = serializeSession({
      profile_id: 'wine-ontology-v1',
      build_id: 'build-2026-09-29-wine',
      entities: mockEntities,
      relationships: mockRelationships,
      selected_id: 'wine:ChateauMargaux',
    })

    const compat = checkCompatibility(session, mockProfile, 'build-2026-09-29-wine')
    expect(compat.compatible).toBe(true)
    expect(compat.errors).toHaveLength(0)
    expect(compat.warnings).toHaveLength(0)
    expect(compat.profile_mismatch).toBe(false)
    expect(compat.build_mismatch).toBe(false)
    expect(compat.missing_iris).toHaveLength(0)
  })

  it('detects profile mismatch warning', () => {
    const session = serializeSession({
      profile_id: 'pizza-ontology-v2',
      build_id: 'build-2026-09-29-wine',
      entities: mockEntities,
      relationships: mockRelationships,
      selected_id: 'wine:ChateauMargaux',
    })

    const compat = checkCompatibility(session, mockProfile)
    expect(compat.compatible).toBe(true) // non-blocking warning
    expect(compat.profile_mismatch).toBe(true)
    expect(compat.warnings.some((w) => w.includes('Profile mismatch'))).toBe(true)
  })

  it('detects build mismatch warning', () => {
    const session = serializeSession({
      profile_id: 'wine-ontology-v1',
      build_id: 'build-older-hash',
      entities: mockEntities,
      relationships: mockRelationships,
      selected_id: 'wine:ChateauMargaux',
    })

    const compat = checkCompatibility(session, mockProfile, 'build-2026-09-29-wine')
    expect(compat.compatible).toBe(true)
    expect(compat.build_mismatch).toBe(true)
    expect(compat.warnings.some((w) => w.includes('Build mismatch'))).toBe(true)
  })

  it('detects schema major version error as incompatible', () => {
    const session = serializeSession({
      profile_id: 'wine-ontology-v1',
      build_id: 'build-2026-09-29-wine',
      entities: mockEntities,
      relationships: mockRelationships,
      selected_id: 'wine:ChateauMargaux',
    })
    session.version = '2.0.0' // higher major version

    const compat = checkCompatibility(session, mockProfile)
    expect(compat.compatible).toBe(false) // blocking error
    expect(compat.errors.some((e) => e.includes('Incompatible schema major version'))).toBe(true)
  })

  it('detects missing IRIs against known IRIs set', () => {
    const session = serializeSession({
      profile_id: 'wine-ontology-v1',
      build_id: 'build-2026-09-29-wine',
      entities: mockEntities,
      relationships: mockRelationships,
      selected_id: 'wine:ChateauMargaux',
    })

    // Suppose store only has ChateauMargaux, BordeauxRegion is missing
    const knownIris = new Set(['wine:ChateauMargaux'])
    const compat = checkCompatibility(session, {
      currentProfile: mockProfile,
      knownIris,
    })

    expect(compat.missing_iris).toContain('wine:BordeauxRegion')
    expect(compat.warnings.some((w) => w.includes('entity IRI(s) from this session are not present'))).toBe(true)
  })

  it('filters session cleanly for partial restore', () => {
    const session = serializeSession({
      profile_id: 'wine-ontology-v1',
      build_id: 'build-2026-09-29-wine',
      entities: mockEntities,
      relationships: mockRelationships,
      selected_id: 'wine:BordeauxRegion',
      pinned_nodes: ['wine:ChateauMargaux', 'wine:BordeauxRegion'],
    })

    // Filter out BordeauxRegion
    const filtered = filterSessionForPartialRestore(session, ['wine:BordeauxRegion'])

    expect(filtered.entities['wine:BordeauxRegion']).toBeUndefined()
    expect(filtered.entities['wine:ChateauMargaux']).toBeDefined()
    // Relationship incident to missing node should be pruned
    expect(Object.keys(filtered.relationships)).toHaveLength(0)
    // Selected entity was missing, should reassign or clear
    expect(filtered.selected_id).toBe('wine:ChateauMargaux')
    // Pinned nodes should exclude missing
    expect(filtered.pinned_nodes).toEqual(['wine:ChateauMargaux'])
  })
})

describe('Browser Storage Persistence (SE-002, UW-008)', () => {
  const store = new Map<string, string>()
  const mockStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() {
      return store.size
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  }

  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', mockStorage)
    vi.stubGlobal('window', { localStorage: mockStorage })
  })

  it('saves and loads active session to and from localStorage', () => {
    const session = serializeSession({
      profile_id: 'wine-ontology-v1',
      build_id: 'build-test',
      entities: mockEntities,
      relationships: mockRelationships,
      selected_id: 'wine:ChateauMargaux',
    })

    const saveResult = saveToLocalStorage(session)
    expect(saveResult.success).toBe(true)

    const loaded = loadFromLocalStorage()
    expect(loaded).not.toBeNull()
    expect(loaded?.profile_id).toBe('wine-ontology-v1')
    expect(loaded?.selected_id).toBe('wine:ChateauMargaux')
  })

  it('clears active session from localStorage', () => {
    const session = serializeSession({
      profile_id: 'wine-ontology-v1',
      build_id: 'build-test',
      entities: mockEntities,
      relationships: {},
      selected_id: null,
    })
    saveToLocalStorage(session)
    expect(loadFromLocalStorage()).not.toBeNull()

    clearLocalStorage()
    expect(loadFromLocalStorage()).toBeNull()
  })

  it('manages auto-save toggle state in storage', () => {
    expect(getAutoSaveEnabled()).toBe(true)
    setAutoSaveEnabled(false)
    expect(getAutoSaveEnabled()).toBe(false)
    setAutoSaveEnabled(true)
    expect(getAutoSaveEnabled()).toBe(true)
  })

  it('manages named saved sessions bookmarks list', () => {
    const session1 = serializeSession({
      profile_id: 'wine-ontology-v1',
      build_id: 'build-test',
      entities: mockEntities,
      relationships: {},
      selected_id: null,
      name: 'Session 1',
    })
    const session2 = serializeSession({
      profile_id: 'wine-ontology-v1',
      build_id: 'build-test',
      entities: {},
      relationships: {},
      selected_id: null,
      name: 'Session 2',
    })

    saveNamedSession(session1, 'Session 1')
    saveNamedSession(session2, 'Session 2')

    const list = listSavedSessions()
    expect(list.length).toBeGreaterThanOrEqual(2)
    expect(list.some((s) => s.name === 'Session 1')).toBe(true)
    expect(list.some((s) => s.name === 'Session 2')).toBe(true)

    deleteSavedSession(session1.created_at)
    const updated = listSavedSessions()
    expect(updated.some((s) => s.name === 'Session 1')).toBe(false)
  })
})

describe('File Export and Import (UW-008, SE-001)', () => {
  it('uploads and parses valid session file', async () => {
    const session = serializeSession({
      profile_id: 'wine-ontology-v1',
      build_id: 'build-file-test',
      entities: mockEntities,
      relationships: mockRelationships,
      selected_id: 'wine:ChateauMargaux',
    })

    const json = JSON.stringify(session)
    const file = new File([json], 'wine-session.fkg-session.json', { type: 'application/json' })

    const parsed = await uploadSession(file)
    expect(parsed.profile_id).toBe('wine-ontology-v1')
    expect(parsed.build_id).toBe('build-file-test')
    expect(Object.keys(parsed.entities)).toHaveLength(2)
  })

  it('enforces maximum 10MB file size limit', async () => {
    const oversizedFile = {
      size: MAX_SESSION_FILE_SIZE_BYTES + 1024,
      text: async () => '{}',
    } as unknown as File

    await expect(uploadSession(oversizedFile)).rejects.toThrow('exceeds the maximum allowed 10 MB limit')
  })

  it('rejects upload of malformed JSON', async () => {
    const corruptFile = new File(['{ invalid json'], 'bad.json', { type: 'application/json' })
    await expect(uploadSession(corruptFile)).rejects.toThrow('Invalid JSON format')
  })

  it('downloadSession executes without error', () => {
    const session = serializeSession({
      profile_id: 'wine-ontology-v1',
      build_id: 'build-test',
      entities: mockEntities,
      relationships: {},
      selected_id: null,
    })

    // Mock URL and document
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    const revokeObjectURL = vi.fn()
    const click = vi.fn()
    const appendChild = vi.fn()
    const removeChild = vi.fn()

    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    vi.stubGlobal('window', { setTimeout: (fn: () => void) => fn() })
    vi.stubGlobal('document', {
      createElement: () => ({ href: '', download: '', style: {}, click }),
      body: { appendChild, removeChild },
    })

    expect(() => downloadSession(session, 'test-download')).not.toThrow()
    expect(createObjectURL).toHaveBeenCalled()
  })
})

describe('Deep Link URL Parameters (OP-009, SE-003)', () => {
  it('formats deep link hash and full URL correctly', () => {
    const state: DeepLinkState = {
      entities: ['wine:ChateauMargaux', 'wine:BordeauxRegion'],
      selected: 'wine:ChateauMargaux',
      layout: 'cose',
      direction: 'OUTGOING',
      inferred: false,
      profile: 'wine-profile',
      build: 'build-123',
    }

    const hash = formatDeepLinkHash(state)
    expect(hash).toContain('entities=wine%3AChateauMargaux%2Cwine%3ABordeauxRegion')
    expect(hash).toContain('selected=wine%3AChateauMargaux')
    expect(hash).toContain('layout=cose')
    expect(hash).toContain('direction=OUTGOING')
    expect(hash).toContain('inferred=false')
    expect(hash).toContain('profile=wine-profile')
    expect(hash).toContain('build=build-123')

    const fullUrl = generateDeepLinkUrl(state)
    expect(fullUrl).toContain(hash)
  })

  it('parses deep link URL hash into structured state', () => {
    const hash = '#entities=wine%3AChateauMargaux%2Cwine%3ABordeauxRegion&selected=wine%3AChateauMargaux&layout=dagre&direction=INCOMING&inferred=false'
    const parsed = parseDeepLink(hash)

    expect(parsed).not.toBeNull()
    expect(parsed?.entities).toEqual(['wine:ChateauMargaux', 'wine:BordeauxRegion'])
    expect(parsed?.selected).toBe('wine:ChateauMargaux')
    expect(parsed?.layout).toBe('dagre')
    expect(parsed?.direction).toBe('INCOMING')
    expect(parsed?.inferred).toBe(false)
  })

  it('returns null for empty or invalid hash', () => {
    expect(parseDeepLink('')).toBeNull()
    expect(parseDeepLink('#')).toBeNull()
    expect(parseDeepLink('#somethingUnknownWithoutParams')).toBeNull()
  })

  it('copyDeepLink writes to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const success = await copyDeepLink({
      entities: ['wine:ChateauMargaux'],
      selected: 'wine:ChateauMargaux',
    })

    expect(success).toBe(true)
    expect(writeText).toHaveBeenCalled()
  })
})

describe('SessionManager Component (UW-008, SE-001, SE-002)', () => {
  it('renders Save & Export tab with current graph stats and inputs', () => {
    const html = renderToString(
      <SessionManager
        isOpen={true}
        onClose={vi.fn()}
        currentProfile={mockProfile}
        currentBuildId="build-test"
        currentGraph={{ entities: mockEntities, relationships: mockRelationships }}
        selectedId="wine:ChateauMargaux"
        layoutName="breadthfirst"
        direction="BOTH"
        includeInferred={true}
        pinnedNodeIds={[]}
        autoSaveEnabled={true}
        onToggleAutoSave={vi.fn()}
        onRestoreSession={vi.fn()}
        onClearSession={vi.fn()}
        initialTab="save"
      />
    )

    expect(html).toContain('Session Manager')
    expect(html).toContain('Save &amp; Export')
    expect(html).toContain('Save to Browser')
    expect(html).toContain('Export to File (.fkg-session.json)')
    expect(html).toContain('Auto-Save to Local Storage')
    expect(html).toContain('Schema Ver')
    expect(html).toContain(CURRENT_SESSION_VERSION)
  })

  it('renders Restore & Import tab with browser load and file upload buttons', () => {
    const html = renderToString(
      <SessionManager
        isOpen={true}
        onClose={vi.fn()}
        currentProfile={mockProfile}
        currentBuildId="build-test"
        currentGraph={{ entities: mockEntities, relationships: mockRelationships }}
        selectedId="wine:ChateauMargaux"
        layoutName="breadthfirst"
        direction="BOTH"
        includeInferred={true}
        pinnedNodeIds={[]}
        autoSaveEnabled={true}
        onToggleAutoSave={vi.fn()}
        onRestoreSession={vi.fn()}
        onClearSession={vi.fn()}
        initialTab="restore"
      />
    )

    expect(html).toContain('Load from Browser')
    expect(html).toContain('Import from File')
    expect(html).toContain('Saved Sessions in Browser')
    expect(html).toContain('Clear Session')
  })

  it('renders Share & Deep Link tab with shareable URL', () => {
    const html = renderToString(
      <SessionManager
        isOpen={true}
        onClose={vi.fn()}
        currentProfile={mockProfile}
        currentBuildId="build-test"
        currentGraph={{ entities: mockEntities, relationships: mockRelationships }}
        selectedId="wine:ChateauMargaux"
        layoutName="breadthfirst"
        direction="BOTH"
        includeInferred={true}
        pinnedNodeIds={[]}
        autoSaveEnabled={true}
        onToggleAutoSave={vi.fn()}
        onRestoreSession={vi.fn()}
        onClearSession={vi.fn()}
        initialTab="share"
      />
    )

    expect(html).toContain('Share &amp; Deep Link')
    expect(html).toContain('Shareable Deep Link URL')
    expect(html).toContain('Copy Link')
    expect(html).toContain('Active Layout')
  })

  it('does not render when isOpen is false', () => {
    const html = renderToString(
      <SessionManager
        isOpen={false}
        onClose={vi.fn()}
        currentGraph={{ entities: {}, relationships: {} }}
        selectedId={null}
        layoutName="breadthfirst"
        direction="BOTH"
        includeInferred={true}
        pinnedNodeIds={[]}
        autoSaveEnabled={true}
        onToggleAutoSave={vi.fn()}
        onRestoreSession={vi.fn()}
        onClearSession={vi.fn()}
      />
    )

    expect(html).toBe('')
  })
})
