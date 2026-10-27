import { spawnSync } from "node:child_process";
import z from "zod";

export interface Notice {
  title: string;
  subtitle: string;
  text: string;
}

export type Raised = "page" | "mac";

const NOTIFY = `on run argv
  display notification (item 1 of argv) with title (item 2 of argv) subtitle (item 3 of argv)
end run`;

const Listening = z.object({ listeners: z.number() });

const mac = ({ title, subtitle, text }: Notice): void => {
  spawnSync("osascript", ["-e", NOTIFY, text, title, subtitle]);
};

// An open sidecar raises its own notification, whose click opens the task, where osascript's opens Script Editor.
const raise = async ({ address, notice }: { address: string; notice: Notice }): Promise<Raised> => {
  const reply = await fetch(`${address}/api/events/listeners`, { signal: AbortSignal.timeout(1500) }).catch(
    () => undefined,
  );
  const heard = reply?.ok ? Listening.safeParse(await reply.json().catch(() => undefined)).data : undefined;
  if (heard?.listeners) return "page";
  mac(notice);
  return "mac";
};

export const TaskNotice = { mac, raise };
