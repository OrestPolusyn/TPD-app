"use client";

import { Component, type ReactNode } from "react";

/**
 * Isolates a client-side widget so its failure degrades to a placeholder
 * instead of reaching the route's error boundary and blanking the whole page.
 *
 * Added after a broken Leaflet marker-icon URL threw on every marker and took
 * the entire home page down with it — search, the share section and the rest
 * of the page were all fine, but the visitor saw only "Щось пішло не так".
 */
export class ClientErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
