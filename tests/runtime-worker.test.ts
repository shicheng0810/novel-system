import { describe, expect, test } from "vitest";

import { NovelRuntimeWorker } from "../src/runtime-worker";

describe("NovelRuntimeWorker", () => {
  test("runs jobs serially in enqueue order", async () => {
    const worker = new NovelRuntimeWorker();
    const events: string[] = [];

    const first = worker.enqueue("first", async () => {
      events.push("first-start");
      await new Promise((resolve) => setTimeout(resolve, 20));
      events.push("first-end");
      return "one";
    });
    const second = worker.enqueue("second", async () => {
      events.push("second-start");
      events.push("second-end");
      return "two";
    });

    await expect(first).resolves.toBe("one");
    await expect(second).resolves.toBe("two");
    expect(events).toEqual(["first-start", "first-end", "second-start", "second-end"]);
    expect(worker.snapshot().completedJobs).toBe(2);
  });

  test("continues after a failed job", async () => {
    const worker = new NovelRuntimeWorker();

    const failed = worker.enqueue("failed", async () => {
      throw new Error("planned failure");
    });
    const next = worker.enqueue("next", async () => "ok");

    await expect(failed).rejects.toThrow("planned failure");
    await expect(next).resolves.toBe("ok");
    expect(worker.snapshot().failedJobs).toBe(1);
    expect(worker.snapshot().completedJobs).toBe(1);
  });
});
