export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export function failure(e: unknown): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : "Неизвестная ошибка" };
}
