"use client";

import { Component, type ReactNode } from "react";
import { Button } from "./Button";

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Per-panel error boundary. Catches render errors inside a single dashboard
// panel so the rest of the dashboard remains usable. Each panel gets its own
// instance so a throw in one panel does not unmount its siblings.
export class PanelErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    const label = this.props.label ?? "panel";
    console.error(`[PanelErrorBoundary:${label}]`, error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const label = this.props.label ?? "this section";
      return <PanelFallback label={label} onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

// Exported for direct unit-test rendering without needing to trigger an error.
export function PanelFallback({
  label,
  onRetry,
}: {
  label: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-[120px] flex-col items-center justify-center gap-4 rounded-card border border-border bg-surface px-6 py-8 text-center">
      <p className="font-sans text-[16px] text-muted-strong">
        Could not load {label} — retry
      </p>
      <Button variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
