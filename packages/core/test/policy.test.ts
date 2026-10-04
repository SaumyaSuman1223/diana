import { describe, expect, it } from "vitest";
import { decide } from "../src/policy";

describe("decide", () => {
  it("treats direct user actions as their own confirmation", () => {
    expect(decide(3, "user", false)).toEqual({ kind: "allow", approval: "not_required" });
    expect(decide(3, "telegram", false)).toEqual({ kind: "allow", approval: "not_required" });
  });

  it("lets the assistant read and make internal writes", () => {
    expect(decide(0, "assistant", false).kind).toBe("allow");
    expect(decide(1, "assistant", false).kind).toBe("allow");
  });

  it("requires approval for external and consequential assistant actions", () => {
    expect(decide(2, "assistant", false)).toEqual({ kind: "needs_approval" });
    expect(decide(3, "worker", false)).toEqual({ kind: "needs_approval" });
    expect(decide(3, "assistant", true)).toEqual({ kind: "allow", approval: "approved" });
  });
});
