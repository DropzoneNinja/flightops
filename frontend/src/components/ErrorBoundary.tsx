import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary - Catches and handles React errors gracefully
 *
 * Wraps components to prevent the entire app from crashing when errors occur.
 * Provides a custom fallback UI with options to retry or navigate away.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
          <div className="max-w-lg mx-auto p-8 bg-white rounded-xl shadow-elevation-lg animate-scale-in">
            {/* Error Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-500"
                  fill="none"
                  strokeWidth={2}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
              </div>
            </div>

            {/* Error Message */}
            <h2 className="text-2xl font-display font-bold text-sky-night text-center mb-2">
              Something Went Wrong
            </h2>
            <p className="text-sky-dusk font-body text-center mb-6">
              {this.state.error.message || 'An unexpected error occurred.'}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-6 py-3 bg-sky-morning text-white font-body font-medium rounded-lg hover:bg-sky-dusk transition-all shadow-elevation hover:shadow-elevation-lg"
              >
                Try Again
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className="px-6 py-3 bg-white text-sky-dusk border border-sky-midday font-body font-medium rounded-lg hover:bg-sky-cloud transition-all"
              >
                Back to Map
              </button>
            </div>

            {/* Additional Help */}
            <div className="mt-6 p-4 bg-sky-cloud rounded-lg">
              <p className="text-sm font-body text-sky-dusk text-center">
                If this problem persists, please refresh the page or contact support.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
