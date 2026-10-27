import z from "zod";
import { AskKind, Role, type TaskAsk } from "../../../shared/types/task.ts";

export const WHO = z.enum([...Role, "YOU"]);

const Schema = z.object({
  kind: z.enum(AskKind),
  from: z.string().optional(),
  options: z.array(z.string()).default([]),
  verdict: z
    .object({ from: z.string().optional(), text: z.string(), pick: z.number().int().positive().optional(), at: z.string() })
    .optional(),
  decision: z
    .object({
      who: WHO,
      from: z.string().optional(),
      text: z.string(),
      option: z.number().int().positive().optional(),
      at: z.string(),
    })
    .optional(),
}) satisfies z.ZodType<TaskAsk>;

export const Ask = {
  parse: (raw: unknown): TaskAsk | undefined => Schema.safeParse(raw).data,
};
