"use client";

import { useState, useEffect, useCallback } from "react";

const ONBOARDING_KEY = "otto-onboarding";

interface OnboardingState {
  keysEntered: boolean;
  tourCompleted: boolean;
  dismissed: boolean; // dismissed without entering keys
}

const DEFAULT_STATE: OnboardingState = {
  keysEntered: false,
  tourCompleted: false,
  dismissed: false,
};

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ONBOARDING_KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);

  const update = useCallback((patch: Partial<OnboardingState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(ONBOARDING_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const showWelcome = loaded && !state.keysEntered && !state.dismissed;
  const showTour = loaded && state.keysEntered && !state.tourCompleted;
  const showKeyBanner = loaded && state.dismissed && !state.keysEntered;

  return {
    state,
    loaded,
    showWelcome,
    showTour,
    showKeyBanner,
    completeKeys: () => update({ keysEntered: true, dismissed: false }),
    completeTour: () => update({ tourCompleted: true }),
    dismiss: () => update({ dismissed: true }),
    reopenTour: () => update({ tourCompleted: false }),
  };
}
