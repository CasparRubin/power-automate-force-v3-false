/**
 * Chains storage-backed reconcile work so navigation handlers can await a stable tail
 * (Chrome extension storage preload pattern for MV3 service workers).
 */
export type ReconcileFn = () => Promise<void>;

export function createPolicyLoadQueue(reconcile: ReconcileFn): {
  scheduleReconcile: () => void;
  chainAfterTail: (work: () => Promise<void>) => void;
  awaitReconcileCaughtUp: () => Promise<void>;
} {
  let policyReady: Promise<void> = Promise.resolve();

  /** Keeps the tail settled when `reconcile` rejects (`.then(fn)` alone does not absorb a rejected return). */
  const safeReconcile = (): Promise<void> =>
    reconcile().catch(() => {
      /* reconcile implementation is responsible for logging */
    });

  function scheduleReconcile(): void {
    policyReady = policyReady.then(safeReconcile, safeReconcile);
  }

  function chainAfterTail(work: () => Promise<void>): void {
    const safeWork = (): Promise<void> =>
      work().catch(() => {
        /* caller should catch and log; queue stays usable */
      });
    policyReady = policyReady.then(safeWork, safeWork);
  }

  async function awaitReconcileCaughtUp(): Promise<void> {
    for (;;) {
      const tail = policyReady;
      await tail;
      if (policyReady === tail) {
        return;
      }
    }
  }

  scheduleReconcile();

  return { scheduleReconcile, chainAfterTail, awaitReconcileCaughtUp };
}
