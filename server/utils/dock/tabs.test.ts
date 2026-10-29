import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import type { RunConfig } from "../../../shared/types/runs.ts";
import { RunConfigs } from "../runs/configs.ts";
import { DockTabs } from "./tabs.ts";

const size = { cols: 80, rows: 24 };

const until = async (done: () => boolean): Promise<void> => {
  for (let tries = 0; tries < 150 && !done(); tries++) await sleep(20);
  assert.ok(done(), "the dock did not settle");
};

const holds = (id: string): boolean => DockTabs.list().some((one) => one.id === id);

describe("DockTabs", () => {
  const root = mkdtempSync(join(tmpdir(), "dock-"));
  const config = (command: string): RunConfig => ({
    id: command,
    name: command,
    command,
    shown: command,
    folder: root,
    source: "package.json",
  });

  before(() => {
    process.env.CLAUDE_CONFIG_DIR = join(root, "config");
    process.env.SHELL = "/bin/sh";
  });

  after(() => {
    delete process.env.CLAUDE_CONFIG_DIR;
    rmSync(root, { recursive: true, force: true });
  });

  it("ends a shell and takes its tab with it", async () => {
    const { id } = DockTabs.shell({ project: "acme", folder: root, ...size });
    assert.ok(await DockTabs.close(id));
    await until(() => !holds(id));
  });

  it("interrupts a run that is still running before its tab leaves", async () => {
    const { id } = await DockTabs.run({ project: "acme", config: config("echo up; sleep 30"), ...size });
    let seen = "";
    DockTabs.join(id, { send: (data) => (seen += data), close: () => {} });
    await until(() => seen.includes("up"));
    const started = Date.now();
    assert.ok(await DockTabs.close(id));
    assert.ok(!holds(id));
    assert.ok(Date.now() - started < 2000, "Ctrl+C ended it, not the kill that follows three seconds later");
  });

  it("runs an ad-hoc script line by line in its folder and keeps its tab with the status", async () => {
    const { id, title } = await DockTabs.run({
      project: "acme",
      config: RunConfigs.adhoc({ command: "echo first\npwd", folder: root }),
      ...size,
    });
    let seen = "";
    DockTabs.join(id, { send: (data) => (seen += data), close: () => {} });
    await until(() => DockTabs.list().find((one) => one.id === id)?.status === "passed");
    assert.equal(title, "echo first");
    assert.ok(seen.indexOf("first") < seen.indexOf(root), "each line ran in order, in the folder");
    assert.ok(await DockTabs.close(id));
  });

  it("lets a finished run just leave, and refuses a tab it does not hold", async () => {
    const { id } = await DockTabs.run({ project: "acme", config: config("true"), ...size });
    await until(() => DockTabs.list().find((one) => one.id === id)?.status === "passed");
    assert.ok(await DockTabs.close(id));
    assert.ok(!holds(id));
    assert.equal(await DockTabs.close(id), false);
  });
});
