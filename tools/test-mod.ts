import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const stage = mkdtempSync(join(tmpdir(), "sidecar-mod-"));
for (const part of [".claude-plugin", "hooks", "tests", "types"])
  cpSync(join(root, part), join(stage, part), {
    recursive: true,
    filter: (from) => !from.includes(".claude-plugin/types"),
  });
const { status } = spawnSync("claude", ["plugin", "test", stage], { stdio: "inherit" });
rmSync(stage, { force: true, recursive: true });
process.exitCode = status ?? 1;
