import { describe, expect, it, vi } from "vitest";
import { createPolicyLoadQueue } from "../src/policy-load-queue";

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("createPolicyLoadQueue", () => {
  it("runs initial reconcile from the constructor", async () => {
    const reconcile = vi.fn().mockResolvedValue(undefined);
    createPolicyLoadQueue(reconcile);
    await vi.waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1));
  });

  it("awaitReconcileCaughtUp waits for the initial reconcile before returning", async () => {
    const d = deferred<void>();
    const reconcile = vi.fn().mockReturnValue(d.promise);
    const q = createPolicyLoadQueue(reconcile);
    const waiter = q.awaitReconcileCaughtUp();
    let settled = false;
    void waiter.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    d.resolve();
    await waiter;
    expect(settled).toBe(true);
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it("awaitReconcileCaughtUp waits for a reconcile scheduled while awaiting the first tail", async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    const reconcile = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockResolvedValue(undefined);
    const q = createPolicyLoadQueue(reconcile);

    const waiter = q.awaitReconcileCaughtUp();
    await Promise.resolve();
    expect(reconcile).toHaveBeenCalledTimes(1);

    q.scheduleReconcile();
    await Promise.resolve();
    expect(reconcile).toHaveBeenCalledTimes(1);

    first.resolve();
    await vi.waitFor(() => expect(reconcile).toHaveBeenCalledTimes(2));

    let waiterDone = false;
    void waiter.then(() => {
      waiterDone = true;
    });
    await Promise.resolve();
    expect(waiterDone).toBe(false);

    second.resolve();
    await waiter;
    expect(waiterDone).toBe(true);
  });

  it("chainAfterTail runs after prior reconciles and can be awaited via caught-up", async () => {
    const reconcile = vi.fn().mockResolvedValue(undefined);
    const q = createPolicyLoadQueue(reconcile);
    await q.awaitReconcileCaughtUp();

    const chained = vi.fn().mockResolvedValue(undefined);
    q.chainAfterTail(chained);
    await q.awaitReconcileCaughtUp();

    expect(reconcile.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(chained).toHaveBeenCalledTimes(1);
  });

  it("continues the chain when reconcile rejects", async () => {
    const reconcile = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue(undefined);
    const q = createPolicyLoadQueue(reconcile);
    await q.awaitReconcileCaughtUp();
    q.scheduleReconcile();
    await q.awaitReconcileCaughtUp();
    expect(reconcile).toHaveBeenCalledTimes(2);
  });

  it("serializes multiple scheduleReconcile calls while the first reconcile is still pending", async () => {
    const a = deferred<void>();
    const b = deferred<void>();
    const reconcile = vi
      .fn()
      .mockReturnValueOnce(a.promise)
      .mockReturnValueOnce(b.promise)
      .mockResolvedValue(undefined);
    const q = createPolicyLoadQueue(reconcile);
    await Promise.resolve();
    expect(reconcile).toHaveBeenCalledTimes(1);

    q.scheduleReconcile();
    q.scheduleReconcile();
    await Promise.resolve();
    expect(reconcile).toHaveBeenCalledTimes(1);

    a.resolve();
    await vi.waitFor(() => expect(reconcile).toHaveBeenCalledTimes(2));
    b.resolve();
    await q.awaitReconcileCaughtUp();
    expect(reconcile).toHaveBeenCalledTimes(3);
  });
});
