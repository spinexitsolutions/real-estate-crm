/** Standard return shape for server actions used with client forms. */
export type ActionResult<T = undefined> = { ok: true; data?: T; error?: undefined } | { ok?: false; error: string; data?: undefined };

export function fail(error: string): ActionResult<never> {
  return { error };
}
