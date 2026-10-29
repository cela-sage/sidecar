import assert from "node:assert/strict";
import { test } from "node:test";
import type { RunConfig, RunGroup } from "../../shared/types/runs.ts";
import { RunOrder } from "./runs.ts";

const config = (folder: string, name: string): RunConfig => ({
  id: name,
  name,
  command: name,
  shown: name,
  folder,
  source: "package.json",
});

const groups: RunGroup[] = [
  { source: "package.json", repo: "api", configs: [config("/p/api", "start")] },
  { source: "Makefile", repo: "web", configs: [config("/p/web", "check")] },
  { source: "package.json", repo: "web", configs: [config("/p/web", "dev")] },
  { source: "assistant", configs: [{ ...config("/p", "seed"), source: "assistant" }] },
];

test("the repo the conversation works in heads the menu, both its files, the rest in order", () => {
  const order = (cwd?: string) => RunOrder.frontFirst(groups, cwd).map((group) => `${group.repo ?? ""}:${group.source}`);
  assert.deepEqual(order("/p/web/src"), ["web:Makefile", "web:package.json", "api:package.json", ":assistant"]);
  assert.deepEqual(order("/p"), ["api:package.json", "web:Makefile", "web:package.json", ":assistant"]);
  assert.deepEqual(order("/p/webby"), ["api:package.json", "web:Makefile", "web:package.json", ":assistant"]);
  assert.deepEqual(order(), ["api:package.json", "web:Makefile", "web:package.json", ":assistant"]);
});
