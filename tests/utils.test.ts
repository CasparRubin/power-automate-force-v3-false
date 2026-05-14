import { describe, expect, it } from "vitest";
import { cn } from "../src/lib/utils";

describe("cn", () => {
  it("merges tailwind classes with later wins for conflicts", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("filters falsy fragments", () => {
    expect(cn("a", undefined, "c")).toBe("a c");
  });
});
