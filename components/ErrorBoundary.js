"use client";
// If a screen fails while drawing (a bug, or data in a shape nobody expected), show what to do instead of a blank page.
import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Screen failed:", error, info?.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="guide" role="alert">
        <span>This screen ran into a problem and could not be shown. Your saved data is not affected.</span>
        <button className="btn btn-primary btn-sm" onClick={() => { this.setState({ error: null }); this.props.onHome?.(); }}>Go to Home</button>
        <button className="btn btn-light btn-sm" onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }
}
