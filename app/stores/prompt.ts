import type { SessionCommand } from "~~/shared/types/command";
import type { AttachedFile } from "~~/shared/types/files";
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

export interface PromptRefusal {
  name: string;
}

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
  [
    text.trim(),
    ...blocks.map((one) => `${one.label}:\n\n\`\`\`\n${one.text}\n\`\`\``),
    ...(files.length ? [files.map((one) => AttachedFiles.line(one.path)).join("\n")] : []),
  ]
    .filter(Boolean)
    .join("\n\n");

export const $prompt = defineStore(() => {
  const sc = useSidecar();
  const chrome = useChrome();
  const drafts = ref<Partial<Record<string, Draft>>>({});
  const sent = ref<PromptSent[]>([]);
  const chosen = ref<Partial<Record<string, PromptPick>>>({});
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
  const commands = computed(() => listed.value[sc.sessionKey.value ?? ""]?.list ?? []);

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
    const got = await $fetch<AttachedFile>(`/api/uploads?name=${encodeURIComponent(file.name)}`, {
      body: file,
      headers: { "content-type": file.type || "application/octet-stream" },
      method: "POST",
    }).catch((error: unknown) => {
      chrome.toast(failReason(error) ?? `${file.name} did not attach`, "destructive");
      return undefined;
    });
    if (got) front()?.files.push({ ...got, preview: Attachments.previewOf(file) });
  };

  const unattach = (id: string): void => {
    const draft = front();
    if (!draft) return;
    Attachments.release(draft.files.filter((one) => one.path === id));
    draft.blocks = draft.blocks.filter((one) => one.id !== id);
    draft.files = draft.files.filter((one) => one.path !== id);
  };

  const deliver = async (key: string, path: "message" | "command", body: Record<string, string>): Promise<boolean> => {
    wakingKey.value = isAsleep(sc.sessions.value, key) ? key : undefined;
    const reply = await post(key, path, body);
    wakingKey.value = undefined;
    if (!reply.delivered) chrome.toast(FAILED[reply.reason], "destructive");
    return reply.delivered;
  };

  const loadCommands = (key: string): Promise<SessionCommand[]> => {
    const kept = listed.value[key];
    if (kept && Date.now() - kept.at < COMMANDS_FRESH_MS) return Promise.resolve(kept.list);
    const ask = async (): Promise<SessionCommand[]> => {
      const list = await $fetch<SessionCommand[]>(`/api/sessions/${encodeURIComponent(key)}/commands`).catch(
        (): SessionCommand[] => [],
      );
      asking.delete(key);
      if (!list.length) return kept?.list ?? [];
      listed.value = { ...listed.value, [key]: { at: Date.now(), list } };
      return list;
    };
    const pending = asking.get(key) ?? ask();
    asking.set(key, pending);
    return pending;
  };

  const run = async (key: string, command: CommandCall): Promise<boolean> => {
    const known = (await loadCommands(key)).find(
      (one) => one.name === command.name || one.aliases?.includes(command.name),
    );
    if (known && SlashCommand.needsTerminal(known, command.args)) {
      refused.value = { ...refused.value, [key]: { name: command.name } };
      return false;
    }
    return deliver(key, "command", { ...command });
  };

  const send = async (): Promise<void> => {
    const key = sc.sessionKey.value;
    const draft = front();
    if (!key || !draft || isEmpty.value || isSending.value) return;
    const said = compose(draft);
    const command = SlashCommand.parse(said);
    isSending.value = true;
    const isDelivered = await (command ? run(key, command) : deliver(key, "message", { text: said }));
    isSending.value = false;
    if (!isDelivered) return;
    sent.value = [...sent.value, { key, text: command ? SlashCommand.line(command) : said, at: Date.now() }];
    Attachments.release(draft.files);
    drafts.value = { ...drafts.value, [key]: { text: "", files: [], blocks: [] } };
  };

  watch(text, (value) => {
    if (value.startsWith("/") && sc.sessionKey.value) void loadCommands(sc.sessionKey.value);
  });

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
    files,
    focus,
    focusAsked,
    isEmpty,
    isSending,
    isWaking,
    landed,
    mention,
    pick,
    refused,
    send,
    sent,
    stop,
    text,
    unattach,
    upload,
  };
});
