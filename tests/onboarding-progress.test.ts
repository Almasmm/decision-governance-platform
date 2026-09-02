import { describe, expect, it } from "vitest";
import {
  getTourState,
  listProgress,
  onboardingProgressKey,
  resetOnboardingProgress,
  setTourState,
  shouldAutoStartTour,
} from "@/lib/onboarding/progress";
import type {
  OnboardingStorage,
  TourProgressKey,
} from "@/lib/onboarding/types";

class MemoryStorage implements OnboardingStorage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }
}

const key = (overrides: Partial<TourProgressKey> = {}): TourProgressKey => ({
  userId: "demo-user",
  role: "INITIATOR",
  tourId: "page-dashboard-initiator",
  tourVersion: 1,
  ...overrides,
});

describe("onboarding local progress", () => {
  it("stores and reads status by user, role, tour and version", () => {
    const storage = new MemoryStorage();
    const saved = setTourState(
      key(),
      { status: "in_progress", currentStepId: "page-dashboard-initiator:portfolio" },
      storage
    );

    expect(saved?.status).toBe("in_progress");
    expect(getTourState(key(), storage)).toEqual(saved);
    expect(getTourState(key({ role: "DATA_OWNER" }), storage)).toBeNull();
    expect(getTourState(key({ tourVersion: 2 }), storage)).toBeNull();
  });

  it("supports GUEST progress before login role resolution", () => {
    const storage = new MemoryStorage();
    const guestKey = key({ role: "GUEST", tourId: "thesis-jury-methodology" });
    setTourState(guestKey, { status: "in_progress", currentStepId: "choose-role" }, storage);

    expect(onboardingProgressKey(guestKey)).toContain(":GUEST:");
    expect(getTourState(guestKey, storage)?.role).toBe("GUEST");
  });

  it("keeps close, skip and complete as distinct states", () => {
    const storage = new MemoryStorage();
    setTourState(key({ tourId: "closed" }), { status: "dismissed" }, storage);
    setTourState(key({ tourId: "skipped" }), { status: "skipped" }, storage);
    setTourState(key({ tourId: "done" }), { status: "completed" }, storage);

    const statuses = listProgress({ userId: "demo-user", role: "INITIATOR" }, storage)
      .map((record) => record.status)
      .sort();
    expect(statuses).toEqual(["completed", "dismissed", "skipped"]);
  });

  it("lists and resets only the requested user's onboarding scope", () => {
    const storage = new MemoryStorage();
    setTourState(key({ role: "INITIATOR", tourId: "one" }), { status: "completed" }, storage);
    setTourState(key({ role: "ANALYST", tourId: "two" }), { status: "completed" }, storage);
    setTourState(key({ userId: "other", tourId: "three" }), { status: "completed" }, storage);
    storage.setItem("business:data", "must-survive");

    expect(resetOnboardingProgress({ userId: "demo-user", role: "INITIATOR" }, storage)).toBe(1);
    expect(listProgress({ userId: "demo-user" }, storage)).toHaveLength(1);
    expect(listProgress({ userId: "other" }, storage)).toHaveLength(1);
    expect(storage.getItem("business:data")).toBe("must-survive");
  });

  it("ignores corrupt records and degrades safely without browser storage", () => {
    const storage = new MemoryStorage();
    storage.setItem("decision-passport:onboarding:broken", "{not-json");
    expect(listProgress({ userId: "demo-user" }, storage)).toEqual([]);
    expect(getTourState(key(), null)).toBeNull();
    expect(setTourState(key(), { status: "completed" }, null)).toBeNull();
    expect(resetOnboardingProgress({ userId: "demo-user" }, null)).toBe(0);
  });

  it("auto-starts only an unseen auto-start version", () => {
    const tour = { id: "page-decisions", version: 1, autoStart: true };
    expect(shouldAutoStartTour(tour, null)).toBe(true);
    expect(
      shouldAutoStartTour(tour, {
        ...key({ tourId: tour.id }),
        status: "dismissed",
        updatedAt: new Date(0).toISOString(),
      })
    ).toBe(false);
    expect(
      shouldAutoStartTour({ ...tour, version: 2 }, {
        ...key({ tourId: tour.id }),
        status: "completed",
        updatedAt: new Date(0).toISOString(),
      })
    ).toBe(true);
    expect(shouldAutoStartTour({ ...tour, autoStart: false }, null)).toBe(false);
  });
});

