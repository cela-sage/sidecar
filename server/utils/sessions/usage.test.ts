import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { read } from "../../../lib/sidecar/events.ts";
import type { RateLimit, SessionUsage } from "../../../shared/types/usage.ts";
import { UsageStore } from "./usage.ts";

let dir = "";
before(() => {
  dir = mkdtempSync(join(tmpdir(), "sidecar-usage-"));
  process.env.CLAUDE_CONFIG_DIR = dir;
});
after(() => {
  delete process.env.CLAUDE_CONFIG_DIR;
  rmSync(dir, { recursive: true, force: true });
});

const usageOf = (tokens: number, rateLimits: RateLimit[] = []): SessionUsage => ({
  context: { window: 200_000, tokens },
  rateLimits,
});

test("a reading is held for the next read, and announced only when it changed", () => {
  assert.equal(UsageStore.held("aaaa0001"), undefined);
  UsageStore.answer("aaaa0001", usageOf(1000));
  UsageStore.answer("aaaa0001", usageOf(1000));
  UsageStore.answer("aaaa0001", usageOf(2000));

  assert.equal(UsageStore.held("aaaa0001")?.context.tokens, 2000);
  assert.deepEqual(
    read().events.map((one) => [one.topic, one.data]),
    [
      ["usage.changed", { key: "aaaa0001" }],
      ["usage.changed", { key: "aaaa0001" }],
    ],
  );
});

test("the plan is the newest reading of any conversation, less a window that has already reset", async () => {
  const now = Date.parse("2026-01-01T12:00:00Z");
  const ahead = (hours: number): string => new Date(now + hours * 3_600_000).toISOString();
  UsageStore.answer("bbbb0001", usageOf(1, [{ kind: "five_hour", percentUsed: 10, resetsAt: ahead(1) }]));
  await sleep(5);
  UsageStore.answer(
    "bbbb0002",
    usageOf(1, [
      { kind: "five_hour", percentUsed: 40, resetsAt: ahead(-1) },
      { kind: "seven_day", percentUsed: 68, resetsAt: ahead(30) },
    ]),
  );
  await sleep(5);
  UsageStore.answer("bbbb0003", usageOf(1));

  assert.deepEqual(UsageStore.plan(now), [{ kind: "seven_day", percentUsed: 68, resetsAt: ahead(30) }]);
});
