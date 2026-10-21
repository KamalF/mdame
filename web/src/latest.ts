/**
 * Wraps `fn` so that only the latest call gets its answer: an earlier call
 * that answers later resolves to null, so a slow answer never replaces a
 * newer one on screen.
 */
export function latestOnly<A extends unknown[], T>(
  fn: (...args: A) => Promise<T>,
): (...args: A) => Promise<T | null> {
  let latest = 0;
  return async (...args) => {
    const id = ++latest;
    const answer = await fn(...args);
    return id === latest ? answer : null;
  };
}
