import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { read } from "../../../lib/sidecar/events.ts";
import { TurnBus } from "./busy.ts";
import { Seen } from "./seen.ts";

let dir = "";
before(() => {
  dir = mkdtempSync(join(tmpdir(), "sidecar-seen-"));
  process.env.CLAUDE_CONFIG_DIR = dir;
});
after(() => {
  delete process.env.CLAUDE_CONFIG_DIR;
  rmSync(dir, { recursive: true, force: true });
});

test("a turn ending leaves the conversation unseen before the change goes out, and a look clears it", () => {
  TurnBus.heard("abcd1234", [{ role: "user", text: "go" }]);
  assert.deepEqual(Seen.snapshot(), {});
  TurnBus.heard("abcd1234", [{ role: "system", kind: "end" }]);

  const { abcd1234: endedAt = 0 } = Seen.snapshot();
  assert.ok(endedAt > 0);
  assert.deepEqual(
    read().events.map((one) => [one.topic, one.data]),
    [
      ["conversation.changed", { key: "abcd1234", doing: true, asking: false }],
      ["conversation.unseen", { key: "abcd1234", endedAt }],
      ["conversation.changed", { key: "abcd1234", doing: false, asking: false }],
    ],
  );

  Seen.see("abcd1234", endedAt);
  assert.deepEqual(Seen.snapshot(), {});
  assert.deepEqual(read().events.at(-1)?.data, { key: "abcd1234" });
});

test("a look at an older turn leaves the dot of a newer one", () => {
  Seen.ended("beef0001", 2000);
  Seen.see("beef0001", 1000);
  assert.deepEqual(Seen.snapshot(), { beef0001: 2000 });
  Seen.see("beef0001", 2000);
  assert.deepEqual(Seen.snapshot(), {});
});
