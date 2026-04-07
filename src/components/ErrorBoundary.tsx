import React from "react";

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, fontFamily: "system-ui, sans-serif", maxWidth: 600, margin: "80px auto" }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>Something went wrong</h1>
          <p style={{ color: "#666", marginBottom: 16 }}>The app encountered an unexpected error. Try refreshing the page.</p>
          <details style={{ background: "#f5f5f5", padding: 16, borderRadius: 8, fontSize: 13 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Error details</summary>
            <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
              {this.state.error?.message}
              {"\n\n"}
              {this.state.error?.stack}
            </pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 16, padding: "8px 20px", borderRadius: 6, border: "1px solid #ccc", cursor: "pointer", background: "#fff" }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
