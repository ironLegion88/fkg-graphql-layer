import {
  Boxes,
  Circle,
  Route,
  GitCompare,
  Tag,
  Zap,
  Check,
  FileText,
} from 'lucide-react'
import type { TreeNode } from './HierarchyTreeView'
import type { ClassInfo, ComparisonResult, GraphEntity, GraphRelationship } from '../interfaces/models'

/**
 * Builds a hierarchical class tree from ClassInfo objects (AX-002).
 */
export function buildClassHierarchyTree(
  classes: ClassInfo[],
): TreeNode<ClassInfo>[] {
  const map = new Map<string, ClassInfo>()
  for (const c of classes) {
    map.set(c.iri, c)
  }

  // Find root classes: classes with no direct parents or only owl:Thing
  const rootIris: string[] = []
  for (const c of classes) {
    const validParents = c.direct_parents.filter(
      (p) => p !== c.iri && map.has(p),
    )
    if (validParents.length === 0) {
      rootIris.push(c.iri)
    }
  }

  // Recursive tree constructor with cycle prevention
  function buildNode(iri: string, visited: Set<string>): TreeNode<ClassInfo> | null {
    const classInfo = map.get(iri)
    if (!classInfo || visited.has(iri)) return null

    visited.add(iri)
    const childrenNodes: TreeNode<ClassInfo>[] = []

    for (const childIri of classInfo.direct_children) {
      if (map.has(childIri) && !visited.has(childIri)) {
        const childNode = buildNode(childIri, new Set(visited))
        if (childNode) {
          childrenNodes.push(childNode)
        }
      }
    }

    return {
      id: classInfo.iri,
      label: classInfo.label || classInfo.compact_iri?.local_name || classInfo.iri,
      subtitle: classInfo.compact_iri?.prefix ? `${classInfo.compact_iri.prefix}:${classInfo.compact_iri.local_name}` : undefined,
      icon: <Boxes size={14} className="tree-class-icon" />,
      badge: classInfo.instance_count > 0 ? `${classInfo.instance_count} instances` : undefined,
      badgeVariant: 'info',
      children: childrenNodes.length > 0 ? childrenNodes : undefined,
      data: classInfo,
    }
  }

  const roots: TreeNode<ClassInfo>[] = []
  for (const rootIri of rootIris) {
    const rootNode = buildNode(rootIri, new Set())
    if (rootNode) {
      roots.push(rootNode)
    }
  }

  // Fallback: If no roots detected, list all classes flatly
  if (roots.length === 0 && classes.length > 0) {
    return classes.map((c) => ({
      id: c.iri,
      label: c.label || c.iri,
      icon: <Boxes size={14} className="tree-class-icon" />,
      badge: c.instance_count > 0 ? `${c.instance_count} instances` : undefined,
      badgeVariant: 'info',
      data: c,
    }))
  }

  return roots
}

/**
 * Builds a path sequence tree from entities and connecting relations (AX-002).
 */
export function buildPathTree(
  entities: GraphEntity[],
  relations: string[] = [],
): TreeNode<GraphEntity>[] {
  if (entities.length === 0) return []

  return entities.map((entity, index) => {
    const isSource = index === 0
    const isTarget = index === entities.length - 1
    const incomingRelation = index > 0 ? relations[index - 1] : undefined

    return {
      id: `${entity.id}_step_${index}`,
      label: entity.label || entity.id,
      subtitle: incomingRelation
        ? `← [${incomingRelation}] from step ${index}`
        : isSource
          ? 'Start Node (Source)'
          : undefined,
      icon: isSource ? (
        <Circle size={14} style={{ color: '#059669' }} />
      ) : isTarget ? (
        <Circle size={14} style={{ color: '#dc2626' }} />
      ) : (
        <Route size={14} style={{ color: '#0284c7' }} />
      ),
      badge: isSource ? 'Start' : isTarget ? 'Goal' : `Step ${index}`,
      badgeVariant: isSource ? 'success' : isTarget ? 'warning' : 'default',
      data: entity,
    }
  })
}

/**
 * Builds comparison hierarchy tree showing shared and unique relationships (AX-002).
 * Supports either ComparisonResult directly or individual relationship arrays.
 */
export function buildComparisonTree(
  sharedOrResult: GraphRelationship[] | ComparisonResult,
  uniqueAOrLabelA?: GraphRelationship[] | string,
  uniqueBOrLabelB?: GraphRelationship[] | string,
  labelA: string = 'Entity A',
  labelB: string = 'Entity B',
): TreeNode[] {
  // If passed a ComparisonResult:
  if (sharedOrResult && 'common_types' in sharedOrResult) {
    const res = sharedOrResult as ComparisonResult
    const nameA = typeof uniqueAOrLabelA === 'string' ? uniqueAOrLabelA : labelA
    const nameB = typeof uniqueBOrLabelB === 'string' ? uniqueBOrLabelB : labelB
    const result: TreeNode[] = []

    // 1. Shared Types
    if (res.common_types.length > 0) {
      result.push({
        id: 'group_shared_types',
        label: `Shared Types (${res.common_types.length})`,
        subtitle: `Types assigned to both ${nameA} and ${nameB}`,
        icon: <GitCompare size={15} style={{ color: '#059669' }} />,
        badge: `${res.common_types.length} shared`,
        badgeVariant: 'success',
        children: res.common_types.map((t, idx) => ({
          id: `common_type_${idx}`,
          label: t,
          icon: <Check size={13} style={{ color: '#059669' }} />,
          badge: 'Shared Type',
          badgeVariant: 'success',
        })),
      })
    }

    // 2. Unique Types A
    if (res.unique_types_a.length > 0) {
      result.push({
        id: 'group_unique_types_a',
        label: `Unique Types to ${nameA} (${res.unique_types_a.length})`,
        subtitle: `Types present only in ${nameA}`,
        icon: <Tag size={15} style={{ color: '#2563eb' }} />,
        badge: `${res.unique_types_a.length} unique`,
        badgeVariant: 'info',
        children: res.unique_types_a.map((t, idx) => ({
          id: `unique_type_a_${idx}`,
          label: t,
          icon: <Tag size={13} style={{ color: '#2563eb' }} />,
          badge: `Unique to ${nameA}`,
          badgeVariant: 'info',
        })),
      })
    }

    // 3. Unique Types B
    if (res.unique_types_b.length > 0) {
      result.push({
        id: 'group_unique_types_b',
        label: `Unique Types to ${nameB} (${res.unique_types_b.length})`,
        subtitle: `Types present only in ${nameB}`,
        icon: <Tag size={15} style={{ color: '#d97706' }} />,
        badge: `${res.unique_types_b.length} unique`,
        badgeVariant: 'warning',
        children: res.unique_types_b.map((t, idx) => ({
          id: `unique_type_b_${idx}`,
          label: t,
          icon: <Tag size={13} style={{ color: '#d97706' }} />,
          badge: `Unique to ${nameB}`,
          badgeVariant: 'warning',
        })),
      })
    }

    // 4. Shared Properties
    if (res.common_properties.length > 0) {
      result.push({
        id: 'group_shared_properties',
        label: `Shared Properties (${res.common_properties.length})`,
        subtitle: `Predicates connected to both ${nameA} and ${nameB}`,
        icon: <GitCompare size={15} style={{ color: '#059669' }} />,
        badge: `${res.common_properties.length} shared`,
        badgeVariant: 'success',
        children: res.common_properties.map((p, idx) => ({
          id: `common_prop_${idx}`,
          label: p,
          icon: <Check size={13} style={{ color: '#059669' }} />,
          badge: 'Shared Property',
          badgeVariant: 'success',
        })),
      })
    }

    // 5. Unique Properties A
    if (res.unique_properties_a.length > 0) {
      result.push({
        id: 'group_unique_properties_a',
        label: `Unique Properties to ${nameA} (${res.unique_properties_a.length})`,
        subtitle: `Predicates connected only to ${nameA}`,
        icon: <Tag size={15} style={{ color: '#2563eb' }} />,
        badge: `${res.unique_properties_a.length} unique`,
        badgeVariant: 'info',
        children: res.unique_properties_a.map((p, idx) => ({
          id: `unique_prop_a_${idx}`,
          label: p,
          icon: <Tag size={13} style={{ color: '#2563eb' }} />,
          badge: `Unique to ${nameA}`,
          badgeVariant: 'info',
        })),
      })
    }

    // 6. Unique Properties B
    if (res.unique_properties_b.length > 0) {
      result.push({
        id: 'group_unique_properties_b',
        label: `Unique Properties to ${nameB} (${res.unique_properties_b.length})`,
        subtitle: `Predicates connected only to ${nameB}`,
        icon: <Tag size={15} style={{ color: '#d97706' }} />,
        badge: `${res.unique_properties_b.length} unique`,
        badgeVariant: 'warning',
        children: res.unique_properties_b.map((p, idx) => ({
          id: `unique_prop_b_${idx}`,
          label: p,
          icon: <Tag size={13} style={{ color: '#d97706' }} />,
          badge: `Unique to ${nameB}`,
          badgeVariant: 'warning',
        })),
      })
    }

    // 7. Shared Neighbors
    if (res.shared_neighbors.length > 0) {
      result.push({
        id: 'group_shared_neighbors',
        label: `Shared Neighbors (${res.shared_neighbors.length})`,
        subtitle: `Neighboring entities connected to both ${nameA} and ${nameB}`,
        icon: <GitCompare size={15} style={{ color: '#059669' }} />,
        badge: `${res.shared_neighbors.length} neighbors`,
        badgeVariant: 'success',
        children: res.shared_neighbors.map((n, idx) => ({
          id: `shared_neighbor_${idx}_${n.id}`,
          label: n.label || n.id,
          subtitle: n.id,
          icon: <Check size={13} style={{ color: '#059669' }} />,
          badge: 'Shared Neighbor',
          badgeVariant: 'success',
          data: n,
        })),
      })
    }

    return result
  }

  // Otherwise, use relationship-based comparison (backwards compatible)
  const shared = (sharedOrResult as GraphRelationship[]) || []
  const uniqueA = (uniqueAOrLabelA as GraphRelationship[]) || []
  const uniqueB = (uniqueBOrLabelB as GraphRelationship[]) || []
  const effectiveLabelA = typeof labelA === 'string' ? labelA : 'Entity A'
  const effectiveLabelB = typeof labelB === 'string' ? labelB : 'Entity B'
  const result: TreeNode[] = []

  // Shared Group
  result.push({
    id: 'group_shared',
    label: `Shared Facts (${shared.length})`,
    subtitle: `Relationships present in both ${effectiveLabelA} and ${effectiveLabelB}`,
    icon: <GitCompare size={15} style={{ color: '#059669' }} />,
    badge: `${shared.length} shared`,
    badgeVariant: 'success',
    children: shared.map((rel, idx) => ({
      id: `shared_${idx}_${rel.relation}`,
      label: `${rel.source.label} —[${rel.relation}]→ ${rel.target.label}`,
      subtitle: rel.is_inferred ? '⚡ Inferred fact' : '✓ Directly asserted',
      icon: rel.is_inferred ? <Zap size={13} /> : <Check size={13} />,
      badge: rel.is_inferred ? 'Inferred' : 'Asserted',
      badgeVariant: rel.is_inferred ? 'inferred' : 'asserted',
    })),
  })

  // Unique A Group
  result.push({
    id: 'group_unique_a',
    label: `Unique to ${effectiveLabelA} (${uniqueA.length})`,
    subtitle: `Relationships present only for ${effectiveLabelA}`,
    icon: <Tag size={15} style={{ color: '#2563eb' }} />,
    badge: `${uniqueA.length} unique`,
    badgeVariant: 'info',
    children: uniqueA.map((rel, idx) => ({
      id: `unique_a_${idx}_${rel.relation}`,
      label: `${rel.source.label} —[${rel.relation}]→ ${rel.target.label}`,
      subtitle: rel.is_inferred ? '⚡ Inferred' : '✓ Asserted',
      icon: rel.is_inferred ? <Zap size={13} /> : <Check size={13} />,
      badge: rel.is_inferred ? 'Inferred' : 'Asserted',
      badgeVariant: rel.is_inferred ? 'inferred' : 'asserted',
    })),
  })

  // Unique B Group
  result.push({
    id: 'group_unique_b',
    label: `Unique to ${effectiveLabelB} (${uniqueB.length})`,
    subtitle: `Relationships present only for ${effectiveLabelB}`,
    icon: <Tag size={15} style={{ color: '#d97706' }} />,
    badge: `${uniqueB.length} unique`,
    badgeVariant: 'warning',
    children: uniqueB.map((rel, idx) => ({
      id: `unique_b_${idx}_${rel.relation}`,
      label: `${rel.source.label} —[${rel.relation}]→ ${rel.target.label}`,
      subtitle: rel.is_inferred ? '⚡ Inferred' : '✓ Asserted',
      icon: rel.is_inferred ? <Zap size={13} /> : <Check size={13} />,
      badge: rel.is_inferred ? 'Inferred' : 'Asserted',
      badgeVariant: rel.is_inferred ? 'inferred' : 'asserted',
    })),
  })

  return result
}

export interface ProofStepItem {
  step: number
  conclusion: string
  premises: string[]
  rule?: string
}

/**
 * Builds proof steps explanation tree (AX-002, UW-006).
 * Accepts either detailed ProofStepItem objects or flat string proof lines.
 */
export function buildProofTree(
  proofSteps: (ProofStepItem | string)[],
): TreeNode[] {
  return proofSteps.map((stepItem, index) => {
    if (typeof stepItem === 'string') {
      return {
        id: `proof_step_${index + 1}`,
        label: stepItem.startsWith('Step') ? stepItem : `Step ${index + 1}: ${stepItem}`,
        icon: <FileText size={14} style={{ color: '#7c3aed' }} />,
        badge: `Step ${index + 1}`,
        badgeVariant: 'info',
      }
    }

    return {
      id: `proof_step_${stepItem.step}`,
      label: `Step ${stepItem.step}: ${stepItem.conclusion}`,
      subtitle: stepItem.rule ? `Rule: ${stepItem.rule}` : undefined,
      icon: <FileText size={14} style={{ color: '#7c3aed' }} />,
      badge: stepItem.rule || `Step ${stepItem.step}`,
      badgeVariant: 'info',
      children: stepItem.premises.map((premise, pIdx) => ({
        id: `proof_step_${stepItem.step}_premise_${pIdx}`,
        label: premise,
        icon: <Check size={13} style={{ color: '#059669' }} />,
        badge: 'Premise',
        badgeVariant: 'default',
      })),
    }
  })
}
