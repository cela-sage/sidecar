import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import type { Project } from "../../../shared/types/task.ts";
import { RunConfigs } from "./configs.ts";

describe("RunConfigs", () => {
  const root = mkdtempSync(join(tmpdir(), "runs-"));
  const folder = join(root, "acme");
  const project: Project = { key: "acme", name: "Acme", token: "AC", folder };

  before(() => {
    process.env.CLAUDE_CONFIG_DIR = join(root, "config");
    mkdirSync(join(folder, "web"), { recursive: true });
    mkdirSync(join(folder, "api"), { recursive: true });
    mkdirSync(join(folder, "notes"), { recursive: true });
    mkdirSync(join(folder, ".git"), { recursive: true });
    writeFileSync(join(folder, "web", "package.json"), JSON.stringify({ scripts: { dev: "vite", test: "vitest run" } }));
    writeFileSync(join(folder, "web", "pnpm-lock.yaml"), "");
    writeFileSync(join(folder, "api", "package.json"), JSON.stringify({ scripts: { start: "node ." } }));
    writeFileSync(
      join(folder, "api", "Makefile"),
      ".PHONY: up\nPORT := 8080\nup: build\n\tdocker compose up\nbuild:\n\tgo build\n%.o: %.c\n\tcc $<\n",
    );
  });

  after(() => {
    delete process.env.CLAUDE_CONFIG_DIR;
    rmSync(root, { recursive: true, force: true });
  });

  it("groups the repos one level down by repo then source, with the runner their lockfile names", () => {
    const groups = RunConfigs.groupsOf(project);
    assert.deepEqual(
      groups.map((group) => [group.repo, group.source, group.configs.map((one) => one.command)]),
      [
        ["api", "package.json", ["npm run start"]],
        ["api", "Makefile", ["make up", "make build"]],
        ["web", "package.json", ["pnpm run dev", "pnpm run test"]],
      ],
    );
    assert.equal(RunConfigs.find(project, "package.json:web:test")?.shown, "vitest run");
    assert.equal(RunConfigs.find(project, "Makefile:api:up")?.folder, join(folder, "api"));
  });

  it("keeps the project's own after the repos, replaced by name and removed by name", () => {
    RunConfigs.write("acme", { name: "e2e", command: "pnpm exec playwright test", folder: "web" });
    RunConfigs.write("acme", { name: "e2e", command: "pnpm exec playwright test --headed", folder: "web" });
    const own = RunConfigs.groupsOf(project).at(-1);
    assert.equal(own?.source, "assistant");
    assert.deepEqual(own?.configs, [
      {
        id: "assistant::e2e",
        name: "e2e",
        command: "pnpm exec playwright test --headed",
        shown: "pnpm exec playwright test --headed",
        folder: join(folder, "web"),
        source: "assistant",
      },
    ]);
    assert.equal(RunConfigs.remove("acme", "e2e"), true);
    assert.equal(RunConfigs.remove("acme", "e2e"), false);
    assert.equal(RunConfigs.groupsOf(project).at(-1)?.source, "package.json");
  });

  it("names an ad-hoc command by its first words, past a leading cd and any flag, and never saves it", () => {
    const named = (command: string): string => RunConfigs.adhoc({ command }).name;
    assert.equal(named("git push -u origin feature/AI-694/cash-isa"), "git push origin");
    assert.equal(named("cd ~/Notes/projects/Moneyfarm/mcp && git push -u origin x"), "git push origin");
    assert.equal(named("cd ~/Notes"), "cd ~/Notes");
    assert.equal(named("pnpm run build-everything-for-production-now\npnpm test"), "pnpm run build-everything-f…");
    const [one, two] = [RunConfigs.adhoc({ command: "ls", folder }), RunConfigs.adhoc({ command: "ls" })];
    assert.notEqual(one.id, two.id);
    assert.equal(one.folder, folder);
    assert.deepEqual(
      RunConfigs.groupsOf(project).filter((group) => group.source === "assistant"),
      [],
    );
  });

  it("finds nothing in a project folder that does not exist", () => {
    assert.deepEqual(RunConfigs.groupsOf({ ...project, folder: join(root, "gone") }), []);
  });
});
