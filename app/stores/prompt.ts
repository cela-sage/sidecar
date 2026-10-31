import type { SessionCommand } from "~~/shared/types/command";
import type { Topics } from "~~/shared/types/events";
import type { Delivery } from "~/stores/notes";
import type { Attachment } from "~/utils/attachments";
import type { CommandCall } from "~~/shared/utils/slash-command";

export interface PromptBlock {
  id: string;
  label: string;
  text: string;
}

export interface PromptAttach {
  label: string;
  text: string;
}

export interface PromptMention {
  key: string;
  title: string;
}

export interface PromptSent {
  key: string;
  text: string;
  at: number;
}

export interface PromptPick {
  model: string;
  at: number;
}

export interface PromptMove {
  mode: string;
  at: number;
}

export interface PromptRefusal {
  name: string;
}

export type PromptRun = "sent" | "terminal" | "failed";

interface Listed {
  at: number;
  list: SessionCommand[];
}

const COMMANDS_FRESH_MS = 60_000;

interface Draft {
  text: string;
  files: Attachment[];
  blocks: PromptBlock[];
}

const FAILED: Record<Exclude<Delivery, { delivered: true }>["reason"], string> = {
  "no-live-session": "This conversation isn't running and didn't wake, so it never got the message",
  "refused-by-inbox": "The conversation refused the message, try again in a moment",
};

const post = (key: string, path: string, body?: Record<string, string>): Promise<Delivery> =>
  $fetch<Delivery>(`/api/sessions/${encodeURIComponent(key)}/${path}`, { body, method: "POST" }).catch(
    (): Delivery => ({ delivered: false, reason: "refused-by-inbox" }),
  );

const compose = ({ text, files, blocks }: Draft): string =>
  AttachedFiles.append(
    [text.trim(), ...blocks.map((one) => `${one.label}:\n\n\`\`\`\n${one.text}\n\`\`\``)].filter(Boolean).join("\n\n"),
    files.map((one) => one.path),
  );

export const $prompt = defineStore(() => {
  const sc = useSidecar();
  const chrome = useChrome();
  const drafts = ref<Partial<Record<string, Draft>>>({});
  const sent = ref<PromptSent[]>([]);
  const chosen = ref<Partial<Record<string, PromptPick>>>({});
  const moved = ref<Partial<Record<string, PromptMove>>>({});
  const listed = ref<Partial<Record<string, Listed>>>({});
  const refused = ref<Partial<Record<string, PromptRefusal>>>({});
  const focusAsked = ref(0);
  const isSending = ref(false);
  const wakingKey = ref<string>();
  const isWaking = computed(() => !!wakingKey.value && wakingKey.value === sc.sessionKey.value);
  const asking = new Map<string, Promise<SessionCommand[]>>();

  const draftOf = (key: string): Draft => (drafts.value[key] ??= { text: "", files: [], blocks: [] });
  const front = (): Draft | undefined => (sc.sessionKey.value ? draftOf(sc.sessionKey.value) : undefined);
  const held = computed(() => (sc.sessionKey.value ? drafts.value[sc.sessionKey.value] : undefined));
  const commandsOf = (key?: string): SessionCommand[] => listed.value[key ?? ""]?.list ?? [];
  const commands = computed(() => commandsOf(sc.sessionKey.value));

  const text = computed({
    get: () => held.value?.text ?? "",
    set: (value: string) => {
      const draft = front();
      if (!draft) return;
      draft.text = value;
      if (sc.sessionKey.value) refused.value = { ...refused.value, [sc.sessionKey.value]: undefined };
    },
  });
  const files = computed(() => held.value?.files ?? []);
  const blocks = computed(() => held.value?.blocks ?? []);
  const isEmpty = computed(() => !text.value.trim() && !files.value.length && !blocks.value.length);

  const focus = (): void => {
    chrome.view.set("conversation");
    focusAsked.value += 1;
  };

  const mention = ({ key, title }: PromptMention): void => {
    const draft = front();
    if (!draft) return;
    const gap = draft.text && !/\s$/.test(draft.text) ? " " : "";
    draft.text = `${draft.text}${gap}@${title} (${key}) `;
    focus();
  };

  const attach = ({ label, text: body }: PromptAttach): void => {
    front()?.blocks.push({ id: crypto.randomUUID(), label, text: body });
    focus();
  };

  const upload = async (file: File): Promise<void> => {
    const got = await Attachments.upload(file).catch((error: unknown) => {
      chrome.toast(failReason(error) ?? `${file.name} did not attach`, "destructive");
      return undefined;
    });
    if (got) front()?.files.push(got);
  };

  const unattach = (id: string): void => {
    const draft = front();
    if (!draft) return;
    Attachments.release(draft.files.filter((one) => one.path === id));
    draft.blocks = draft.blocks.filter((one) => one.id !== id);
    draft.files = draft.files.filter((one) => one.path !== id);
  };

  const deliver = async (key: string, path: "message" | "command", body: Record<string, string>): Promise<boolean> => {
    wakingKey.value = isKilled(sc.sessions.value, key) ? key : undefined;
    const reply = await post(key, path, body);
    wakingKey.value = undefined;
    if (!reply.delivered) chrome.toast(FAILED[reply.reason], "destructive");
    return reply.delivered;
  };

  const loadCommands = (key: string): Promise<SessionCommand[]> => {
    const kept = listed.value[key];
    if (kept && Date.now() - kept.at < COMMANDS_FRESH_MS) return Promise.resolve(kept.list);
    const ask = async (): Promise<SessionCommand[]> => {
      const fetched = await $fetch<SessionCommand[]>(`/api/sessions/${encodeURIComponent(key)}/commands`).catch(
        (): SessionCommand[] => [],
      );
      asking.delete(key);
      const list = fetched.length ? fetched : (kept?.list ?? []);
      listed.value = { ...listed.value, [key]: { at: fetched.length ? Date.now() : 0, list } };
      return list;
    };
    const pending = asking.get(key) ?? ask();
    asking.set(key, pending);
    return pending;
  };

  const heard = ({ key }: Topics["commands.changed"]): void => {
    const kept = listed.value[key];
    if (!kept) return;
    listed.value = { ...listed.value, [key]: { ...kept, at: 0 } };
    void loadCommands(key);
  };

  const run = async (key: string, command: CommandCall): Promise<PromptRun> => {
    const known = (await loadCommands(key)).find(
      (one) => one.name === command.name || one.aliases?.includes(command.name),
    );
    if (known && SlashCommand.needsTerminal(known, command.args)) return "terminal";
    return (await deliver(key, "command", { ...command })) ? "sent" : "failed";
  };

  const runHere = async (key: string, command: CommandCall): Promise<boolean> => {
    const ran = await run(key, command);
    if (ran === "terminal") refused.value = { ...refused.value, [key]: { name: command.name } };
    return ran === "sent";
  };

  const switchMode = async ({ id, command }: { id: string; command: string }): Promise<void> => {
    const key = sc.sessionKey.value;
    const call = { name: command, args: "" };
    if (!key || !(await runHere(key, call))) return;
    const at = Date.now();
    sent.value = [...sent.value, { key, text: SlashCommand.line(call), at }];
    moved.value = { ...moved.value, [key]: { mode: id, at } };
  };

  const send = async (): Promise<void> => {
    const key = sc.sessionKey.value;
    const draft = front();
    if (!key || !draft || isEmpty.value || isSending.value) return;
    const said = compose(draft);
    const command = SlashCommand.parse(said);
    isSending.value = true;
    const isDelivered = await (command ? runHere(key, command) : deliver(key, "message", { text: said }));
    isSending.value = false;
    if (!isDelivered) return;
    sent.value = [...sent.value, { key, text: command ? SlashCommand.line(command) : said, at: Date.now() }];
    Attachments.release(draft.files);
    drafts.value = { ...drafts.value, [key]: { text: "", files: [], blocks: [] } };
  };

  watch(
    () => sc.sessionKey.value,
    (key) => {
      if (key) void loadCommands(key);
    },
    { immediate: true },
  );

  const landed = (one: PromptSent): void => {
    sent.value = sent.value.filter((other) => other !== one);
  };

  const stop = async (): Promise<void> => {
    const key = sc.sessionKey.value;
    if (!key) return;
    const reply = await post(key, "stop");
    if (!reply.delivered) chrome.toast(FAILED[reply.reason], "destructive");
  };

  const pick = async (model: string): Promise<boolean> => {
    const key = sc.sessionKey.value;
    if (!key) return false;
    const reply = await post(key, "model", { model });
    if (!reply.delivered) {
      chrome.toast(FAILED[reply.reason], "destructive");
      return false;
    }
    chosen.value = { ...chosen.value, [key]: { model, at: Date.now() } };
    return true;
  };

  return {
    attach,
    blocks,
    chosen,
    commands,
    commandsOf,
    files,
    focus,
    focusAsked,
    heard,
    isEmpty,
    isSending,
    isWaking,
    landed,
    load: loadCommands,
    mention,
    moved,
    pick,
    refused,
    run,
    send,
    sent,
    stop,
    switchMode,
    text,
    unattach,
    upload,
  };
});
