import React from 'react';

/** Makes render failures actionable instead of leaving an empty viewport. */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Diagnostics stay in the local browser console, never sent to the API.
    console.error('StorageOps dashboard render error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return <main className="render-error" role="alert">
      <div className="render-error-card">
        <div className="render-error-mark">!</div>
        <span className="eyebrow">STORAGEOPS LAB / DIAGNOSTICS</span>
        <h1>Unable to render this dashboard</h1>
        <p>The interface encountered a JavaScript error. The API and local agent data may still be available.</p>
        <pre>{String(this.state.error.message || 'Unknown rendering error')}</pre>
        <div className="render-error-actions">
          <button type="button" onClick={() => window.location.reload()}>Reload dashboard</button>
          <a href="/health" target="_blank" rel="noreferrer">Check API health</a>
        </div>
        <p className="render-error-hint">If this persists, open Chrome DevTools with F12 and inspect Console.</p>
      </div>
    </main>;
  }
}
