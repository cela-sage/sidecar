import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Projects } from "./projects.ts";

test("projects come from the config when it is well formed, and from the defaults with ~ expanded when it is not", () => {
  const dir = mkdtempSync(join(tmpdir(), "projects-"));
  process.env.CLAUDE_CONFIG_DIR = dir;
  try {
    mkdirSync(join(dir, "sidecar"), { recursive: true });
    const configure = (projects: unknown) =>
      writeFileSync(join(dir, "sidecar", "config.json"), JSON.stringify({ projects }));

    assert.deepEqual(
      Projects.list().map((one) => one.key),
      ["moneyfarm", "cela", "nana", "madong", "meta"],
    );
    assert.equal(Projects.list()[0]?.folder, join(homedir(), "Notes/projects/Moneyfarm"));

    configure([{ key: "acme", name: "Acme", token: "AC", folder: "~/acme" }]);
    assert.deepEqual(Projects.list(), [{ key: "acme", name: "Acme", token: "AC", folder: join(homedir(), "acme") }]);

    configure([{ key: "acme", name: "", token: "AC", folder: "~/acme" }]);
    assert.equal(Projects.list().length, 5);
    configure([]);
    assert.equal(Projects.list().length, 5);
  } finally {
    delete process.env.CLAUDE_CONFIG_DIR;
    rmSync(dir, { recursive: true, force: true });
  }
});
