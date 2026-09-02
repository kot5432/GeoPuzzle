import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode; resetKey?: string };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('GeoPuzzle render error', error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <main className="flex min-h-[100dvh] items-center justify-center bg-[#f4f0e6] px-6 text-center text-[#20373f]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.24em] text-[#668078]">something went wrong</p>
            <h1 className="mt-3 font-display text-3xl font-extrabold">画面の表示に失敗しました。</h1>
            <p className="mt-3 text-sm text-[#718078]">{this.state.error.message}</p>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="mt-8 rounded-xl bg-[#e47750] px-6 py-3 text-sm font-bold text-white shadow-[3px_3px_0_#a74e3b]"
            >
              ホームへ戻る
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
