'use client'

import { Component, ReactNode } from 'react'

// Re-export from their own files for backwards compatibility
export { ErrorDisplay } from '@/components/ui/ErrorDisplay'
export { SuccessDisplay } from '@/components/ui/SuccessDisplay'
export { LoadingSpinner } from '@/components/ui/LoadingSpinner'
export { LoadingOverlay } from '@/components/ui/LoadingOverlay'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              Oops! Something went wrong
            </h2>
            <p className="text-gray-700 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
