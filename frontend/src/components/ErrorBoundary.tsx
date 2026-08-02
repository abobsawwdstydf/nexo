import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// React error boundaries cannot catch errors from async code (event handlers,
// timers, promise chains). Log them globally so they are not silently lost.
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    console.error('[ErrorBoundary:global] uncaught error:', e.error || e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[ErrorBoundary:global] unhandled rejection:', e.reason);
  });
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center p-8 bg-surface border border-border rounded-xl m-4 gap-4">
          <AlertTriangle className="w-12 h-12 text-white/50" />
          <h2 className="text-lg font-semibold text-primary">Что-то пошло не так</h2>
          <p className="text-sm text-secondary text-center max-w-md">
            Произошла непредвиденная ошибка. Попробуйте перезагрузить страницу.
          </p>
          {this.state.error && (
            <details className="w-full max-w-md">
              <summary className="text-xs text-secondary cursor-pointer hover:text-primary">
                Технические детали
              </summary>
              <pre className="mt-2 p-3 bg-zinc-900/10 rounded-lg text-xs overflow-auto max-h-40 text-white/70">
                {this.state.error.message}
                {'\n'}
                {this.state.error.stack}
              </pre>
            </details>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white/80 text-sm rounded-lg hover:bg-white/15 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Попробовать снова
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm rounded-lg hover:opacity-90 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Перезагрузить страницу
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
