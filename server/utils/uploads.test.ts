import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Uploads } from "./uploads.ts";

test("a pasted image is named for its minute, takes -2 when that name is taken, and only safe names resolve to a file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "uploads-"));
  process.env.CLAUDE_CONFIG_DIR = dir;
  try {
    const now = new Date(2026, 9, 27, 14, 32);
    const first = await Uploads.save({ bytes: Buffer.from("a"), extension: "png", now, slug: "plan" });
    const second = await Uploads.save({ bytes: Buffer.from("b"), extension: "png", now, slug: "plan" });
    assert.deepEqual(
      [first, second],
      [
        { name: "pasted-1432.png", link: "../uploads/plan/pasted-1432.png" },
        { name: "pasted-1432-2.png", link: "../uploads/plan/pasted-1432-2.png" },
      ],
    );
    assert.equal(readFileSync(join(dir, "sidecar", "uploads", "plan", "pasted-1432.png"), "utf8"), "a");
    assert.equal(
      Uploads.pathOf({ name: "pasted-1432.png", slug: "plan" }),
      join(dir, "sidecar/uploads/plan/pasted-1432.png"),
    );
    for (const [slug, name] of [
      ["plan", "../x.png"],
      ["..", "x.png"],
      [".hidden", "x.png"],
      ["plan", "a/b.png"],
    ] as const)
      assert.equal(Uploads.pathOf({ name, slug }), undefined);
    assert.equal(Uploads.extensionOf("image/PNG; charset=binary"), "png");
    assert.equal(Uploads.extensionOf("image/svg+xml"), undefined);
  } finally {
    delete process.env.CLAUDE_CONFIG_DIR;
    rmSync(dir, { force: true, recursive: true });
  }
});

test("a file attached in the door keeps its own name made safe, takes -2 when taken, and comes back as an absolute path", async () => {
  const dir = mkdtempSync(join(tmpdir(), "uploads-"));
  process.env.CLAUDE_CONFIG_DIR = dir;
  try {
    const first = await Uploads.attach({ bytes: Buffer.from("a"), name: "Screen Shot 2026-10-28 at 16.02.png" });
    const second = await Uploads.attach({ bytes: Buffer.from("b"), name: "Screen Shot 2026-10-28 at 16.02.png" });
    const folder = join(dir, "sidecar", "uploads", "door");
    assert.deepEqual(
      [first, second],
      [
        { name: "Screen-Shot-2026-10-28-at-16.02.png", path: join(folder, "Screen-Shot-2026-10-28-at-16.02.png") },
        { name: "Screen-Shot-2026-10-28-at-16.02-2.png", path: join(folder, "Screen-Shot-2026-10-28-at-16.02-2.png") },
      ],
    );
    assert.equal(readFileSync(first.path, "utf8"), "a");
    assert.equal(Uploads.safeNameOf("../../etc/passwd"), "passwd");
    assert.equal(Uploads.safeNameOf("résumé final.pdf"), "resume-final.pdf");
    assert.equal(Uploads.safeNameOf(".env"), "env");
    assert.equal(Uploads.safeNameOf("Makefile"), "Makefile");
    assert.equal(Uploads.safeNameOf("???"), "file");
  } finally {
    delete process.env.CLAUDE_CONFIG_DIR;
    rmSync(dir, { force: true, recursive: true });
  }
});
