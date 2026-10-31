import * as Events from "../../../lib/sidecar/events.ts";
import { isKey, keyOf } from "./paths.ts";

export interface Envelope {
  text: string;
  slug?: string;
  from?: string;
}

const PEER_NOTE = "This came from another Claude session";
// cc-sidecar and mode-relay v1 are what the sidecar sent before, and older transcripts still hold them.
const MARKER = /\[\[(?:sidecar|cc-sidecar|mode-relay v1)(?: slug=[A-Za-z0-9._-]+)?(?: from=[0-9a-f]{8})?\]\]\n?/;
// The separator after the colon is a space in some builds and a newline in others.
const WRAP = /^Another Claude session sent a message:\s*/;

export const marked = ({ text, slug, from }: Envelope): string => {
  const fields = [...(slug ? [`slug=${slug}`] : []), ...(from ? [`from=${from}`] : [])];
  return `[[${["sidecar", ...fields].join(" ")}]]\n${text}`;
};

// The harness records a queued copy and a wrapped one; only normalised do the two compare equal.
export function plain(text: string): string {
  const body = text.replace(WRAP, "");
  if (!MARKER.test(body)) return text;
  const stripped = body.replace(MARKER, "");
  const cut = stripped.lastIndexOf(PEER_NOTE);
  return (cut < 0 ? stripped : stripped.slice(0, cut)).trim();
}

// The server drops the variable at start, so only a process running inside a conversation sends as one.
export const senderOf = (id = process.env.CLAUDE_CODE_SESSION_ID ?? ""): string | undefined =>
  isKey(keyOf(id)) ? keyOf(id) : undefined;

// A failed record never fails the send it describes, since the message already landed.
export const recorded = ({ to, from, text, slug }: Envelope & { to?: string }): void => {
  if (!from || !to || from === to) return;
  try {
    Events.publish({ topic: "relay.sent", key: from, data: { from, to, text, ...(slug ? { slug } : {}) } });
  } catch (error) {
    console.error(`[relay] could not record ${from} to ${to}`, error);
  }
};
