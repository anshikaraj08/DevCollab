import React from "react";
import Button from "./ui/Button";

/**
 * Global ErrorBoundary wrapping the application or routes.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-canvas text-fg p-6 text-center select-none">
          <div className="w-full max-w-md p-8 rounded-3xl border border-line bg-surface shadow-xl space-y-5">
            <div className="size-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xl font-bold flex items-center justify-center mx-auto">
              ⚠
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-fg">
                Something went wrong
              </h1>
              <p className="text-xs text-muted mt-2 leading-relaxed">
                An unexpected error occurred. You can reload the page or return to the home screen.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={this.handleReset}>
                Go to Home
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={this.handleReload}>
                Reload Page
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

