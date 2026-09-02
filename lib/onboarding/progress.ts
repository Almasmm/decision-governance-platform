import type {
  OnboardingStorage,
  OnboardingRole,
  TourDefinition,
  TourProgressKey,
  TourProgressRecord,
  TourProgressUpdate,
} from "@/lib/onboarding/types";

const STORAGE_PREFIX = "decision-passport:onboarding:";

export interface ProgressScope {
  userId: string;
  role?: OnboardingRole;
}

function browserStorage(): OnboardingStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function storageFor(storage?: OnboardingStorage | null): OnboardingStorage | null {
  return storage === undefined ? browserStorage() : storage;
}

function safeSegment(value: string): string {
  return encodeURIComponent(value);
}

export function onboardingProgressKey(key: TourProgressKey): string {
  return `${STORAGE_PREFIX}${safeSegment(key.userId)}:${key.role}:${safeSegment(key.tourId)}:v${key.tourVersion}`;
}

function isProgressRecord(value: unknown): value is TourProgressRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<TourProgressRecord>;
  return (
    typeof record.userId === "string" &&
    typeof record.role === "string" &&
    typeof record.tourId === "string" &&
    Number.isInteger(record.tourVersion) &&
    ["in_progress", "completed", "skipped", "dismissed"].includes(record.status ?? "") &&
    typeof record.updatedAt === "string"
  );
}

function parseRecord(raw: string | null): TourProgressRecord | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isProgressRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function getTourState(
  key: TourProgressKey,
  storage?: OnboardingStorage | null
): TourProgressRecord | null {
  const target = storageFor(storage);
  if (!target) return null;
  try {
    return parseRecord(target.getItem(onboardingProgressKey(key)));
  } catch {
    return null;
  }
}

export function setTourState(
  key: TourProgressKey,
  update: TourProgressUpdate,
  storage?: OnboardingStorage | null
): TourProgressRecord | null {
  const target = storageFor(storage);
  if (!target) return null;
  const record: TourProgressRecord = {
    ...key,
    status: update.status,
    ...(update.currentStepId ? { currentStepId: update.currentStepId } : {}),
    updatedAt: new Date().toISOString(),
  };
  try {
    target.setItem(onboardingProgressKey(key), JSON.stringify(record));
    return record;
  } catch {
    return null;
  }
}

export function listProgress(
  scope: ProgressScope,
  storage?: OnboardingStorage | null
): TourProgressRecord[] {
  const target = storageFor(storage);
  if (!target) return [];
  const records: TourProgressRecord[] = [];
  try {
    for (let index = 0; index < target.length; index += 1) {
      const key = target.key(index);
      if (!key?.startsWith(STORAGE_PREFIX)) continue;
      const record = parseRecord(target.getItem(key));
      if (!record || record.userId !== scope.userId) continue;
      if (scope.role && record.role !== scope.role) continue;
      records.push(record);
    }
  } catch {
    return [];
  }
  return records.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function resetOnboardingProgress(
  scope: ProgressScope,
  storage?: OnboardingStorage | null
): number {
  const target = storageFor(storage);
  if (!target) return 0;
  const keys: string[] = [];
  try {
    for (let index = 0; index < target.length; index += 1) {
      const key = target.key(index);
      if (!key?.startsWith(STORAGE_PREFIX)) continue;
      const record = parseRecord(target.getItem(key));
      if (!record || record.userId !== scope.userId) continue;
      if (scope.role && record.role !== scope.role) continue;
      keys.push(key);
    }
    keys.forEach((key) => target.removeItem(key));
    return keys.length;
  } catch {
    return 0;
  }
}

/** Auto-start only for an unseen version; replay is always an explicit UI action. */
export function shouldAutoStartTour(
  tour: Pick<TourDefinition, "id" | "version" | "autoStart">,
  state: TourProgressRecord | null
): boolean {
  if (!tour.autoStart) return false;
  if (!state) return true;
  return state.tourId !== tour.id || state.tourVersion !== tour.version;
}
