import z from "zod";

const Kind = z.enum([
  "thinking",
  "narration",
  "answer",
  "acting",
  "note",
  "summary",
  "command",
  "printed",
  "drop",
  "done",
  "end",
]);

// A field the client cannot read drops alone, so a newer server never costs the whole turn.
const Turn = z.object({
  at: z.number(),
  role: z.enum(["assistant", "user", "system"]),
  text: z.string(),
  kind: Kind.optional().catch(undefined),
  tool: z.string().min(1).optional().catch(undefined),
  arg: z.string().min(1).optional().catch(undefined),
  ref: z.string().min(1).optional().catch(undefined),
  bg: z.literal(true).optional().catch(undefined),
  queued: z.literal(true).optional().catch(undefined),
  joined: z.literal(true).optional().catch(undefined),
  via: z.literal("terminal").optional().catch(undefined),
  model: z.string().min(1).optional().catch(undefined),
  mode: z.string().min(1).optional().catch(undefined),
  sizes: z.object({ before: z.number(), after: z.number() }).optional().catch(undefined),
});

export type TurnKind = z.infer<typeof Kind>;
export type ConversationTurn = z.infer<typeof Turn>;

export function asTurn(value: unknown): ConversationTurn | undefined {
  return Turn.safeParse(value).data;
}

export function parseTurn(raw: string): ConversationTurn | undefined {
  try {
    return asTurn(JSON.parse(raw) as unknown);
  } catch {
    return undefined;
  }
}
