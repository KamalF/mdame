/** Runs a named task after the tasks asked for before it. */
export type Queue = (name: string, task: () => Promise<void>) => void;

/**
 * Runs tasks one at a time, in the order asked. A task asked for again
 * while it still waits is not queued twice: it reads the state when it
 * starts, so one run serves both. Asked for while it runs, it runs again.
 */
export function serial(onError: (error: unknown) => void): Queue {
  let last = Promise.resolve();
  const waiting = new Set<string>();
  return (name, task) => {
    if (waiting.has(name)) return;
    waiting.add(name);
    last = last
      .then(() => {
        waiting.delete(name);
        return task();
      })
      // A task that throws must not block the ones after it.
      .catch(onError);
  };
}
