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
import type { ClassInfo, GraphEntity, GraphRelationship } from '../interfaces/models'

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
 */
export function buildComparisonTree(
  shared: GraphRelationship[],
  uniqueA: GraphRelationship[],
  uniqueB: GraphRelationship[],
  labelA: string = 'Entity A',
  labelB: string = 'Entity B',
): TreeNode[] {
  const result: TreeNode[] = []

  // Shared Group
  result.push({
    id: 'group_shared',
    label: `Shared Facts (${shared.length})`,
    subtitle: `Relationships present in both ${labelA} and ${labelB}`,
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
    label: `Unique to ${labelA} (${uniqueA.length})`,
    subtitle: `Relationships present only for ${labelA}`,
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
    label: `Unique to ${labelB} (${uniqueB.length})`,
    subtitle: `Relationships present only for ${labelB}`,
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

/**
 * Builds proof steps explanation tree (AX-002).
 */
export function buildProofTree(
  proofSteps: {
    step: number
    conclusion: string
    premises: string[]
    rule?: string
  }[],
): TreeNode[] {
  return proofSteps.map((step) => ({
    id: `proof_step_${step.step}`,
    label: `Step ${step.step}: ${step.conclusion}`,
    subtitle: step.rule ? `Rule: ${step.rule}` : undefined,
    icon: <FileText size={14} style={{ color: '#7c3aed' }} />,
    badge: step.rule || `Step ${step.step}`,
    badgeVariant: 'info',
    children: step.premises.map((premise, pIdx) => ({
      id: `proof_step_${step.step}_premise_${pIdx}`,
      label: premise,
      icon: <Check size={13} style={{ color: '#059669' }} />,
      badge: 'Premise',
      badgeVariant: 'default',
    })),
  }))
}
