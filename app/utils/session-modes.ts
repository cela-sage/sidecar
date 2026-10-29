export interface SessionMode {
  id: string;
  name: string;
  about: string;
}

const LISTED: SessionMode[] = [
  { id: "default", name: "Default", about: "Asks before it edits or runs" },
  { id: "acceptEdits", name: "Accept edits", about: "Edits files without asking" },
  { id: "plan", name: "Plan", about: "Reads and plans, changes nothing" },
  { id: "auto", name: "Auto", about: "A classifier answers the prompts" },
  { id: "bypassPermissions", name: "Bypass permissions", about: "Skips every check" },
];

const known = new Map([...LISTED.map((one) => [one.id, one.name] as const), ["dontAsk", "Don't ask"] as const]);

const nameOf = (id: string): string => known.get(id) ?? id;

export const SessionModes = { listed: LISTED, nameOf };
