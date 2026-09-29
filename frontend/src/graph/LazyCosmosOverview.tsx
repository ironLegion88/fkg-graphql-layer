import React, { Suspense } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import type { CosmosOverviewProps } from './CosmosOverview'

const CosmosOverviewComponent = React.lazy(() => import('./CosmosOverview'))

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback: (error: Error) => React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class OverviewErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('OverviewErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback(this.state.error)
    }
    return this.props.children
  }
}

export const LazyCosmosOverview: React.FC<CosmosOverviewProps> = (props) => {
  return (
    <OverviewErrorBoundary
      fallback={(error) => (
        <div className="cosmos-error-overlay" role="alert" data-testid="cosmos-import-error">
          <AlertTriangle size={32} className="error-icon" aria-hidden="true" />
          <h3>GPU Overview Failed to Load</h3>
          <p>{error.message || 'An error occurred while loading the cosmos.gl WebGL module.'}</p>
          {props.onFallbackRequested && (
            <button
              type="button"
              className="fallback-btn"
              onClick={props.onFallbackRequested}
              data-testid="fallback-button"
            >
              Switch to Table and Detail View
            </button>
          )}
        </div>
      )}
    >
      <Suspense
        fallback={
          <div
            className="cosmos-loading-overlay"
            data-testid="cosmos-loading-spinner"
            role="status"
            aria-live="polite"
          >
            <Loader2 size={36} className="spin-animation" aria-hidden="true" />
            <p>Loading GPU-accelerated overview...</p>
          </div>
        }
      >
        <CosmosOverviewComponent {...props} />
      </Suspense>
    </OverviewErrorBoundary>
  )
}

export default LazyCosmosOverview
