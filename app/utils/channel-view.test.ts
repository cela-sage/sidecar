import assert from "node:assert/strict";
import { test } from "node:test";
import type { Channel, ChannelMember, ChannelPost } from "../../shared/types/channel.ts";
import type { LiveSession } from "../../shared/types/session.ts";
import type { Role } from "../../shared/types/task.ts";
import { ChannelCast } from "./channel-cast.ts";
import { ChannelPicker } from "./channel-picker.ts";
import { ChannelView, type ChannelItem, type PostItem } from "./channel-view.ts";

const at = (minute: number): string => `2026-10-31T10:${String(minute).padStart(2, "0")}:00.000Z`;

const member = (key: string, name: string, role: Role, life: "alive" | "killed" = "alive"): ChannelMember => ({
  key,
  role,
  title: `[Cela] ${role} board-labels ${name.toLowerCase()} rows`,
  life,
  agent: { name, icon: 3 },
  joined: at(0),
});

const post = (id: string, by: string, text: string, more: Partial<ChannelPost> = {}): ChannelPost => ({
  kind: "post",
  id,
  at: at(Number(id.replace(/\D/g, "")) || 1),
  by,
  text,
  reach: { notified: [], missed: [], outside: [] },
  ...more,
});

const channelOf = (more: Partial<Channel> = {}): Channel => ({
  slug: "board-labels",
  title: "Board labels",
  archived: false,
  raised: [],
  members: [
    member("aaaaaaa1", "Ivo", "SL"),
    member("aaaaaaa2", "Juno", "IC"),
    member("aaaaaaa3", "Pip", "IC"),
    member("aaaaaaa4", "Tess", "IC", "killed"),
  ],
  lines: [],
  threads: {},
  dms: [],
  ...more,
});

const outsider = (key: string, name: string, token: string): LiveSession => ({
  id: key,
  key,
  name: `[${token}] IC rebase-ui ${name.toLowerCase()} work`,
  cwd: "/tmp",
  life: "alive",
  artifacts: [],
  agent: { name, icon: 9 },
});

const posts = (items: ChannelItem[]): PostItem[] => items.flatMap((one) => (one.kind === "post" ? [one] : []));

test("a raise waits on you until you answer in its thread, and an archived channel waits on nobody", () => {
  const raise = post("p2", "aaaaaaa2", "@boss fold done tasks or show them?", {
    reach: { boss: true, notified: [], missed: [], outside: [] },
  });
  const join = { kind: "join" as const, id: "j1", at: at(1), key: "aaaaaaa1", by: "YOU" };
  const waiting = channelOf({ lines: [join, raise], raised: ["p2"] });
  const cast = ChannelCast.castOf(waiting, []);
  const stream = ChannelView.streamOf(waiting, cast);
  assert.deepEqual(
    stream.map((one) => (one.kind === "system" ? `${one.text} ${one.meta}` : one.kind)),
    ["Ivo joined · spawned by you", "post"],
  );
  assert.equal(posts(stream)[0]?.raise, "waiting");

  const reply = post("p3", "YOU", "fold them", { reach: { notified: ["aaaaaaa2"], missed: [], outside: [] } });
  const answered = channelOf({ lines: [{ ...raise, answered: reply.at }], threads: { p2: [reply] } });
  const pane = ChannelView.paneOf(answered, cast, "p2");
  assert.equal(posts(ChannelView.streamOf(answered, cast))[0]?.raise, "answered");
  assert.deepEqual(
    pane.map((one) => (one.kind === "post" ? `${one.speaker.name}:${one.reach ?? ""}` : `${one.kind}:${one.text}`)),
    ["Juno:", "divider:1 reply", "You:", "system:Juno picked it up"],
  );

  const archived = channelOf({ archived: true, lines: [raise] });
  assert.equal(posts(ChannelView.streamOf(archived, cast))[0]?.raise, "none");
  assert.equal(
    ChannelView.closedOf({ ...archived, lines: [{ kind: "archive", id: "a1", at: at(9), by: "aaaaaaa1" }] }, cast),
    "Ivo archived Board labels, so its channel is read only. Restore brings it back with its history.",
  );
});

test("the stream marks what is new since you last looked, never your own posts, sums a thread up and shows a reply sent to it", () => {
  const first = post("p1", "aaaaaaa3", "row menu order is in");
  const loud = post("p7", "aaaaaaa1", "merging it now", { thread: "p1", broadcast: true });
  const channel = channelOf({
    lines: [first, post("p4", "YOU", "thanks"), post("p6", "aaaaaaa2", "lane reuses the rows"), loud],
    threads: { p1: [post("p2", "YOU", "ok"), post("p3", "aaaaaaa1", "checked"), post("p5", "YOU", "merge it"), loud] },
  });
  const stream = ChannelView.streamOf(channel, ChannelCast.castOf(channel, []), at(3));
  assert.deepEqual(
    stream.map((one) => one.kind),
    ["post", "post", "divider", "post", "post"],
  );
  const thread = posts(stream)[0]?.thread;
  assert.deepEqual([thread?.count, thread?.last, thread?.who.map((one) => one.name)], [4, at(7), ["You", "Ivo"]]);
  assert.deepEqual(posts(stream).at(-1)?.replyTo, { id: "p1", text: "row menu order is in" });
  assert.deepEqual([ChannelView.rootOf(channel, "p3"), ChannelView.rootOf(channel, "p7")], ["p1", "p1"]);
  assert.equal(ChannelView.rootOf(channel, "p9"), undefined);
  assert.equal(ChannelView.latestOf(channel), at(7));
});

test("a mention reads as who it reaches: a member by name, an outside agent by key, @all and @boss by tone", () => {
  const channel = channelOf();
  const cast = ChannelCast.castOf(channel, [outsider("bbbbbbb1", "Nell", "MF")]);
  const segments = ChannelCast.segmentsOf("@juno and @bbbbbbb1 see @all, @boss and @nobody", cast);
  assert.deepEqual(
    segments.map((one) => [one.text, one.tone ?? ""]),
    [
      ["@juno", "agent"],
      [" and ", ""],
      ["@Nell", "out"],
      [" see ", ""],
      ["@all", "all"],
      [", ", ""],
      ["@boss", "boss"],
      [" and @nobody", ""],
    ],
  );
});

test("the picker offers alive members by name with what they do, then @all, then outside agents, keying a shared name", () => {
  const channel = channelOf({
    lines: [post("p1", "aaaaaaa2", "@boss which one?", { reach: { boss: true, notified: [], missed: [], outside: [] } })],
    raised: ["p1"],
  });
  const cast = ChannelCast.castOf(channel, [outsider("bbbbbbb1", "Nell", "MF"), outsider("bbbbbbb2", "Pip", "MF")]);
  const offer = ChannelPicker.offer({ channel, cast, query: "", busy: new Set(["aaaaaaa3"]) });
  assert.deepEqual(
    offer.map((one) => [one.section, one.handle, one.note]),
    [
      ["in", "@Ivo", "idle"],
      ["in", "@Juno", "waits on you"],
      ["in", "@Pip", "working"],
      ["in", "@all", "notifies 3"],
      ["out", "@Nell", "one read"],
      ["out", "@bbbbbbb2", "one read"],
    ],
  );
  assert.equal(offer.at(-2)?.work, "nell work · MF");
  assert.deepEqual(
    ChannelPicker.offer({ channel, cast, query: "ju", busy: new Set() }).map((one) => one.handle),
    ["@Juno"],
  );
  assert.equal(ChannelPicker.reachOf("plain words", cast), "no @ · notifies no one");
  assert.equal(ChannelPicker.reachOf("@Juno @Pip and @Nell", cast), "notifies Juno and Pip · Nell gets one read");
  assert.equal(ChannelPicker.reachOf("@all freeze", cast), "notifies everyone");
});
