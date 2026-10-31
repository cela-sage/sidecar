import assert from "node:assert/strict";
import { rmSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { ALPHA_ID, BETA_ID, FIXTURES_DIR, useFixtures } from "./__fixtures__/env.ts";
import { Agents } from "./agents.ts";
import { liveSessions } from "./index.ts";
import type { LiveSession } from "../../../shared/types/session.ts";

let restore: () => void;

before(() => {
  restore = useFixtures();
});

after(() => restore());

function find(all: LiveSession[], key: string): LiveSession {
  const one = all.find((session) => session.key === key);
  assert.ok(one, `expected a session keyed ${key}`);
  return one;
}

test("a session keyed by its artifact list is skipped when nothing on disk can identify it", () => {
  const all = liveSessions();
  assert.deepEqual(
    all.map((session) => session.key),
    ["aaaaaaaa", "cccccccc", "bbbbbbbb"],
  );
});

test("the live scope builds only processes and jobs, plus the key asked for", () => {
  const keys = (key?: string): string[] => liveSessions({ scope: "live", key }).map((session) => session.key);
  assert.deepEqual(keys(), ["aaaaaaaa", "cccccccc"]);
  assert.deepEqual(keys("bbbbbbbb"), ["aaaaaaaa", "cccccccc", "bbbbbbbb"]);
});

test("a job identifies a session its artifact list alone could not, and supplies the name, cwd and detail", () => {
  const gamma = find(liveSessions(), "cccccccc");
  assert.equal(gamma.name, "Gamma, as the job knows it");
  assert.equal(gamma.cwd, "/tmp/gamma");
  assert.equal(gamma.detail, "retrying the gamma import");
  assert.equal(gamma.lane?.name, "working");
  assert.equal(gamma.archived, undefined);
});

// The CLI derives the lane, so a lane read off the file has to say so rather than pass for the CLI's.
test("a lane read from disk is marked derived", () => {
  assert.equal(find(liveSessions(), "cccccccc").lane?.derived, true);
});

test("a session no job owns is archived, and a job directory with no state file is no session", () => {
  const all = liveSessions();
  assert.equal(find(all, "aaaaaaaa").archived, true);
  assert.equal(find(all, "bbbbbbbb").archived, true);
  assert.equal(
    all.some((session) => session.key === "eeeeeeee"),
    false,
  );
});

test("a live process supplies the id, the name and the cwd, and outranks the transcript", () => {
  const alpha = find(liveSessions(), "aaaaaaaa");
  assert.equal(alpha.id, ALPHA_ID);
  assert.equal(alpha.life, "alive");
  assert.equal(alpha.name, "Alpha, as the process knows it");
  assert.equal(alpha.cwd, "/tmp/alpha-moved");
  assert.equal(alpha.status, "busy");
});

test("a dead pid's registry file is not a live session, and its name falls to the transcript", () => {
  const beta = find(liveSessions(), "bbbbbbbb");
  assert.equal(beta.life, "killed");
  assert.equal(beta.id, BETA_ID);
  assert.notEqual(beta.name, "Beta, from a process that died");
});

test("a title that is only the session key is not a name, so the next candidate wins", () => {
  assert.equal(find(liveSessions(), "bbbbbbbb").name, "Beta, auto but real");
});

test("each session has a colour of its own", () => {
  const all = liveSessions();
  assert.equal(find(all, "aaaaaaaa").color, "magenta");
  assert.equal(find(all, "bbbbbbbb").color, "cyan");
});

test("artifacts arrive newest first, blank lines dropped, a re-stamped slug keeping its later place", () => {
  const all = liveSessions();
  assert.deepEqual(find(all, "aaaaaaaa").artifacts, ["alpha-one", "alpha-three", "alpha-two"]);
  assert.deepEqual(find(all, "bbbbbbbb").artifacts, []);
});

const SUBAGENTS = join(FIXTURES_DIR, "config/projects/-tmp-alpha", ALPHA_ID, "subagents");

const touched = (file: string, agoMs: number): void => {
  const at = new Date(Date.now() - agoMs);
  utimesSync(join(SUBAGENTS, file), at, at);
};

test("agents come from the subagent metas, colourless members left out, each with its transcript's state", () => {
  touched("agent-aTwo-2222.jsonl", 0);
  assert.deepEqual(find(liveSessions(), "aaaaaaaa").agents, [
    { id: "aOne-1111", name: "One", color: "blue", state: "idle" },
    { id: "aTwo-2222", name: "Two", color: "green", description: "Patch: two", state: "working" },
  ]);
});

test("a specialist's turn left open with no write for ten minutes is a loop that died, so it reads idle", () => {
  touched("agent-aTwo-2222.jsonl", 11 * 60_000);
  assert.equal(find(liveSessions(), "aaaaaaaa").agents?.[1]?.state, "idle");
});

test("what the mod heard outranks the transcript", () => {
  Agents.hear("aaaaaaaa", { id: "aOne-1111", state: "killed" });
  rmSync(join(FIXTURES_DIR, "config/sidecar/events.jsonl"), { force: true });
  assert.equal(find(liveSessions(), "aaaaaaaa").agents?.[0]?.state, "killed");
});

test("a session with no subagents folder falls back to the team roster", () => {
  assert.deepEqual(find(liveSessions(), "bbbbbbbb").agents, [
    { id: "Three@session-bbbbbbbb", name: "Three", color: "cyan", state: "idle" },
  ]);
});

test("alive sessions sort ahead of the rest", () => {
  const all = liveSessions();
  assert.equal(all[0]?.life, "alive");
  assert.equal(all[1]?.life, "killed");
});

test("a transcript with no cwd record of its own reads the folder name back into a path", () => {
  assert.equal(find(liveSessions(), "bbbbbbbb").cwd, "/tmp/beta");
});

test("the transcript still supplies what the registry has no field for", () => {
  assert.equal(find(liveSessions(), "aaaaaaaa").gitBranch, "main");
});
