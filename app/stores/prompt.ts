import type { AttachedFile } from "~~/shared/types/files";
import type { Delivery } from "~/stores/notes";
import type { Attachment } from "~/utils/attachments";

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

interface Draft {
  text: string;
  files: Attachment[];
  blocks: PromptBlock[];
}

const FAILED: Record<Exclude<Delivery, { delivered: true }>["reason"], string> = {
  "no-live-session": "This conversation isn't running, so it never got the message",
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
  const focusAsked = ref(0);
  const isSending = ref(false);

  const draftOf = (key: string): Draft => (drafts.value[key] ??= { text: "", files: [], blocks: [] });
  const front = (): Draft | undefined => (sc.sessionKey.value ? draftOf(sc.sessionKey.value) : undefined);
  const held = computed(() => (sc.sessionKey.value ? drafts.value[sc.sessionKey.value] : undefined));

  const text = computed({
    get: () => held.value?.text ?? "",
    set: (value: string) => {
      const draft = front();
      if (draft) draft.text = value;
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

  const send = async (): Promise<void> => {
    const key = sc.sessionKey.value;
    const draft = front();
    if (!key || !draft || isEmpty.value || isSending.value) return;
    const said = compose(draft);
    isSending.value = true;
    const reply = await post(key, "message", { text: said });
    isSending.value = false;
    if (!reply.delivered) return chrome.toast(FAILED[reply.reason], "destructive");
    sent.value = [...sent.value, { key, text: said, at: Date.now() }];
    Attachments.release(draft.files);
    drafts.value = { ...drafts.value, [key]: { text: "", files: [], blocks: [] } };
  };

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
    files,
    focus,
    focusAsked,
    isEmpty,
    isSending,
    landed,
    mention,
    pick,
    send,
    sent,
    stop,
    text,
    unattach,
    upload,
  };
});
