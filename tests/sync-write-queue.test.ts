import { describe, expect, it, vi } from "vitest";
import { createAsyncQueue } from "../src/popup/sync-write-queue";

describe("createAsyncQueue", () => {
  it("runs jobs strictly one after another", async () => {
    const order: string[] = [];
    const q = createAsyncQueue();
    const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    const p1 = q.enqueue(async () => {
      order.push("a-start");
      await delay(15);
      order.push("a-end");
    });
    const p2 = q.enqueue(async () => {
      order.push("b");
    });
    await Promise.all([p1, p2]);
    expect(order).toEqual(["a-start", "a-end", "b"]);
  });

  it("advances the queue when a job rejects", async () => {
    const q = createAsyncQueue();
    const ok = vi.fn();

    await expect(
      q.enqueue(async () => {
        throw new Error("fail");
      }),
    ).rejects.toThrow("fail");

    await q.enqueue(async () => {
      ok();
    });
    expect(ok).toHaveBeenCalledTimes(1);
  });
});
