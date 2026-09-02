"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import type { OnboardingRole } from "@/lib/onboarding/types";
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider";

interface Props {
  userId: string;
  role: OnboardingRole;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/** The product remains usable if the optional guidance subsystem fails. */
export class OnboardingBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[onboarding] Guidance disabled after an unexpected error.", error, info);
  }

  render() {
    if (this.state.failed) return this.props.children;
    return (
      <OnboardingProvider userId={this.props.userId} role={this.props.role}>
        {this.props.children}
      </OnboardingProvider>
    );
  }
}
