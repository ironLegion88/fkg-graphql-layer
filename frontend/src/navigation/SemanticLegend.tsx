import React from 'react'
import type { SemanticCategory } from '../interfaces/models'
import './SemanticLegend.css'

export interface SemanticLegendProps {
  categories: SemanticCategory[]
  activeCategories?: string[]
  onToggleCategory?: (categoryName: string) => void
}

export const SemanticLegend: React.FC<SemanticLegendProps> = ({
  categories = [],
  activeCategories,
  onToggleCategory,
}) => {
  if (categories.length === 0) return null

  return (
    <div className="semantic-legend" aria-label="Semantic category legend">
      <span className="legend-label">Legend:</span>
      <div className="legend-items">
        {categories.map((cat) => {
          const catNameLower = cat.name.toLowerCase()
          const isActive =
            activeCategories === undefined || activeCategories.includes(cat.name)
          const displayLabel = cat.label || cat.name

          return (
            <button
              key={cat.name}
              type="button"
              className={`legend-pill ${isActive ? 'active' : 'inactive'}`}
              onClick={() => onToggleCategory?.(cat.name)}
              title={`${displayLabel} (${cat.class_iris.length} ontology classes)`}
              aria-pressed={isActive}
            >
              <span
                className={`legend-dot ${catNameLower}`}
                style={cat.color ? { backgroundColor: cat.color } : undefined}
                aria-hidden="true"
              />
              <span className="legend-text">{displayLabel}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default SemanticLegend
