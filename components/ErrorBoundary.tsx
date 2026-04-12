'use client'

import { Component } from 'react'

type Props = {
  children: React.ReactNode
}

type State = {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full bg-canvas">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-lg font-semibold text-ink mb-2">Something went wrong</h2>
            <p className="text-sm text-ink-3 mb-4">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false })
                window.location.reload()
              }}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hi transition-colors cursor-pointer"
            >
              Refresh page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
