import { AppRouter } from '@/app/router';
import React from 'react';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', color: 'hsl(var(--text-primary))', background: '#220000', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h2>React Render Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.5)', padding: '20px' }}>
            {this.state.error?.toString()}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <div className="app-container">
      <ErrorBoundary>
        <AppRouter />
      </ErrorBoundary>
    </div>
  );
}

export default App;
