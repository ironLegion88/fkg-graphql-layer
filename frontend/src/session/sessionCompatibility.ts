import type {
  ActiveProfile,
  ExplorerSession,
  GraphEntity,
  GraphRelationship,
  SessionCompatibility,
} from '../interfaces/models'
import { CURRENT_SESSION_VERSION } from './sessionSchema'

export interface CompatibilityCheckOptions {
  currentProfile?: ActiveProfile | null
  currentBuildId?: string | null
  knownIris?: Set<string> | string[]
}

/**
 * Checks an ExplorerSession for compatibility against the current profile, build, and known IRIs.
 * Satisfies requirements OP-009, SE-001, and SE-002.
 */
export function checkCompatibility(
  session: ExplorerSession,
  optionsOrProfile?: CompatibilityCheckOptions | ActiveProfile | null,
  currentBuildId?: string | null,
  knownIris?: Set<string> | string[],
): SessionCompatibility {
  // Support both options object signature and multi-argument signature
  let profile: ActiveProfile | null | undefined
  let buildId: string | null | undefined
  let irisSet: Set<string> | undefined

  if (
    optionsOrProfile &&
    typeof optionsOrProfile === 'object' &&
    ('metadata' in optionsOrProfile || 'prefixes' in optionsOrProfile)
  ) {
    profile = optionsOrProfile as ActiveProfile
    buildId = currentBuildId
    irisSet = knownIris instanceof Set ? knownIris : Array.isArray(knownIris) ? new Set(knownIris) : undefined
  } else if (optionsOrProfile && typeof optionsOrProfile === 'object') {
    const opts = optionsOrProfile as CompatibilityCheckOptions
    profile = opts.currentProfile
    buildId = opts.currentBuildId
    irisSet =
      opts.knownIris instanceof Set
        ? opts.knownIris
        : Array.isArray(opts.knownIris)
          ? new Set(opts.knownIris)
          : undefined
  }

  const effectiveBuildId = buildId ?? profile?.build_id ?? null
  const warnings: string[] = []
  const errors: string[] = []
  const missingIrisSet = new Set<string>()

  // 1. Schema version compatibility check
  const [sessionMajor, sessionMinor] = (session.version || '0.0.0').split('.').map(Number)
  const [currentMajor, currentMinor] = CURRENT_SESSION_VERSION.split('.').map(Number)

  if (isNaN(sessionMajor) || sessionMajor !== currentMajor) {
    errors.push(
      `Incompatible schema major version (${session.version}). Current supported version is ${CURRENT_SESSION_VERSION}.`
    )
  } else if (!isNaN(sessionMinor) && sessionMinor > currentMinor) {
    warnings.push(
      `Session schema version (${session.version}) is newer than current software (${CURRENT_SESSION_VERSION}). Some newer features may not be recognized.`
    )
  }

  // 2. Profile mismatch check
  let profileMismatch = false
  const activePackageId = profile?.metadata?.package_id
  if (activePackageId && session.profile_id && session.profile_id !== activePackageId) {
    profileMismatch = true
    warnings.push(
      `Profile mismatch: session is for profile "${session.profile_id}", but active profile is "${activePackageId}".`
    )
  }

  // 3. Build mismatch check
  let buildMismatch = false
  if (effectiveBuildId && session.build_id && session.build_id !== effectiveBuildId) {
    buildMismatch = true
    warnings.push(
      `Build mismatch: session was saved on build "${session.build_id}", but active build is "${effectiveBuildId}". Entity definitions or inferences may have changed.`
    )
  }

  // 4. Missing IRIs check (when known IRIs are provided)
  if (irisSet && irisSet.size > 0) {
    // Check entities
    for (const entityId of Object.keys(session.entities)) {
      if (!irisSet.has(entityId)) {
        missingIrisSet.add(entityId)
      }
    }

    // Check relationship endpoints
    for (const rel of Object.values(session.relationships)) {
      if (!irisSet.has(rel.source.id)) {
        missingIrisSet.add(rel.source.id)
      }
      if (!irisSet.has(rel.target.id)) {
        missingIrisSet.add(rel.target.id)
      }
    }

    if (missingIrisSet.size > 0) {
      warnings.push(
        `${missingIrisSet.size} entity IRI(s) from this session are not present in the current ontology store.`
      )
    }
  }

  // 5. Predicates check against active profile predicates (if profile supplied)
  if (profile?.predicates && profile.predicates.length > 0) {
    const knownPredicates = new Set(
      profile.predicates.map((p) => p.name.toLowerCase())
    )
    const unknownPredicates = new Set<string>()

    for (const rel of Object.values(session.relationships)) {
      if (rel.relation && !knownPredicates.has(rel.relation.toLowerCase())) {
        unknownPredicates.add(rel.relation)
      }
    }

    if (unknownPredicates.size > 0) {
      warnings.push(
        `Session contains ${unknownPredicates.size} predicate(s) not declared in active profile: ${Array.from(unknownPredicates).slice(0, 5).join(', ')}${unknownPredicates.size > 5 ? '...' : ''}.`
      )
    }
  }

  const missing_iris = Array.from(missingIrisSet)
  const compatible = errors.length === 0

  return {
    compatible,
    warnings,
    errors,
    missing_iris,
    profile_mismatch: profileMismatch,
    build_mismatch: buildMismatch,
  }
}

/**
 * Creates a clean partial session by filtering out missing IRIs and any attached relationships.
 * Allows safe "Partial restore" when some resources are no longer in the store.
 */
export function filterSessionForPartialRestore(
  session: ExplorerSession,
  missingIris: string[],
): ExplorerSession {
  if (!missingIris || missingIris.length === 0) {
    return session
  }

  const missingSet = new Set(missingIris)
  const remainingEntities: Record<string, GraphEntity> = {}

  for (const [id, entity] of Object.entries(session.entities)) {
    if (!missingSet.has(id)) {
      remainingEntities[id] = entity
    }
  }

  const remainingRelationships: Record<string, GraphRelationship> = {}
  for (const [key, rel] of Object.entries(session.relationships)) {
    if (!missingSet.has(rel.source.id) && !missingSet.has(rel.target.id)) {
      remainingRelationships[key] = rel
    }
  }

  const newSelectedId =
    session.selected_id && !missingSet.has(session.selected_id)
      ? session.selected_id
      : Object.keys(remainingEntities)[0] || null

  const newPinnedNodes = session.pinned_nodes.filter((id) => !missingSet.has(id))

  let newPositions: Record<string, { x: number; y: number }> | undefined
  if (session.node_positions) {
    newPositions = {}
    for (const [id, pos] of Object.entries(session.node_positions)) {
      if (!missingSet.has(id)) {
        newPositions[id] = pos
      }
    }
  }

  return {
    ...session,
    entities: remainingEntities,
    relationships: remainingRelationships,
    selected_id: newSelectedId,
    pinned_nodes: newPinnedNodes,
    node_positions: newPositions,
  }
}
