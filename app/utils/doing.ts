import type { MascotState } from "~/components/claude/mascot.vue";
import type { ConversationTurn } from "~/composables/useConversation";

const WRITE = new Set(["Write", "Edit", "NotebookEdit"]);
const OFFLOAD = new Set(["Agent", "Task", "Workflow"]);

export type Doing = {
  /** The newest assistant block of any kind, not only tool calls. */
  turn?: ConversationTurn;
  /** Asked, nothing back yet. */
  awaiting?: boolean;
  wrote?: boolean;
  /** The open call is genuinely long-running: backgrounded, or outstanding past the threshold. */
  long?: boolean;
};

export function doingOf({ turn, awaiting, wrote, long }: Doing): MascotState {
  if (awaiting) return "thinking";
  if (!turn) return "idle";
  const tool = turn.kind === "acting" ? turn.tool : undefined;
  if (!tool) return "thinking";

  if (tool.startsWith("mcp__") || OFFLOAD.has(tool)) return "running";
  if (tool === "Bash" && long) return "running";
  if (WRITE.has(tool)) return "coding";
  // Once it has written, reading is part of the same job rather than a fresh investigation.
  if (wrote) return "coding";
  return "investigating";
}

export function wroteIn(turn?: ConversationTurn): boolean {
  return turn?.kind === "acting" && !!turn.tool && WRITE.has(turn.tool);
}

const VERB: Record<string, string> = {
  Read: "Reading",
  WebFetch: "Reading",
  Write: "Writing",
  Edit: "Editing",
  NotebookEdit: "Editing",
  Grep: "Searching for",
  Glob: "Looking for",
  WebSearch: "Searching the web for",
  AskUserQuestion: "Asking you",
  Agent: "Handing off",
  Task: "Handing off",
  Workflow: "Running a workflow",
  Skill: "Loading the skill",
};

const actingOf = (tool: string, arg?: string): string => {
  const verb = VERB[tool] ?? (tool.startsWith("mcp__") ? `Using ${tool.split("__").at(-1)}` : undefined);
  if (!verb) return arg ?? tool;
  return arg ? `${verb} ${arg}` : verb;
};

export function stepOf({ turn, awaiting }: Doing): string | undefined {
  if (awaiting) return "Reading your message";
  if (!turn) return undefined;
  if (turn.kind === "thinking") return "Thinking";
  if (turn.kind === "acting" && turn.tool) return actingOf(turn.tool, turn.arg);
  return turn.text.trim().split("\n")[0] || undefined;
}
