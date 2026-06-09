"use client";
import { fontMono, fontSerif, paper } from "@/lib/paper-theme";
import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          style={{
            padding: "40px 24px",
            fontFamily: fontMono,
            color: paper.ink,
            background: paper.paper,
            minHeight: "60vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40 }}>⚠</div>
          <div style={{ fontFamily: fontSerif, fontSize: 22, fontWeight: 700 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 12, color: paper.inkDim, maxWidth: 320 }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 8,
              padding: "6px 16px",
              fontFamily: fontMono,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase" as const,
              background: paper.ink,
              color: paper.paper,
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
