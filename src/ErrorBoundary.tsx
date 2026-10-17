import { Component, type ReactNode } from 'react'

// Round each 3D canvas: if its scene throws (a model that won't load, a context that can't be made), the page shows
// its still in that place instead of going blank from top to bottom (React unmounts the whole root otherwise).
export default class ErrorBoundary extends Component<{ fallback: ReactNode; onError?: () => void; children: ReactNode }, { broken: boolean }> {
  state = { broken: false }
  static getDerivedStateFromError() {
    return { broken: true }
  }
  componentDidCatch() {
    this.props.onError?.()
  }
  render() {
    return this.state.broken ? this.props.fallback : this.props.children
  }
}
