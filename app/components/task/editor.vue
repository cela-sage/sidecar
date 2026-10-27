<script lang="ts" setup>
import { useDebounceFn, useEventListener, useResizeObserver } from "@vueuse/core";
import type * as MonacoApi from "monaco-editor";
import type { TunePhase } from "~/components/task/tune.vue";
import { OneDarkVivid } from "~/utils/monaco/one-dark-vivid";
import { SideZones } from "~/utils/monaco/side-zones";
import type { ArtifactEditReply, ArtifactUpload } from "~~/shared/types/artifact";
import type { FileContent, FileSave } from "~~/shared/types/files";
import type { FastModelReply, FastModelRequest } from "~~/shared/types/models";

const { slug } = defineProps<{ slug: string }>();

const emit = defineEmits<{ saved: [at: string] }>();

interface Disk {
  hash: string;
  text: string;
}

interface Tune {
  phase: TunePhase;
  first: number;
  last: number;
  paragraph: string;
  selection: string;
  scope: string;
  sections: string[];
  instruction: string;
  proposal?: string;
  id?: string;
}

interface TuneHandle {
  focus: () => void;
}

const SAVE_MS = 800;
const ZONE = "tune";
const PASTED = "Pasted image";

const chrome = useChrome();
const task = $task();
const host = useTemplateRef<HTMLElement>("host");
const handle = useTemplateRef<TuneHandle>("handle");
const zone = document.createElement("div");
zone.className = "side-zone";
zone.dataset.surface = "task";

const disk = shallowRef<Disk>();
const draft = ref("");
const pending = ref<string>();
const unread = ref<string>();
const isStale = ref(false);
const tune = ref<Tune>();

let editor: MonacoApi.editor.IStandaloneCodeEditor | undefined;
let api: typeof MonacoApi | undefined;
let zones: ReturnType<typeof SideZones.attach> | undefined;
let marks: MonacoApi.editor.IEditorDecorationsCollection | undefined;
let asking: AbortController | undefined;
let saving: Promise<boolean> = Promise.resolve(true);

const base = computed(() => `/api/artifacts/${encodeURIComponent(slug)}`);
const words = computed<[number, number] | undefined>(() =>
  tune.value?.proposal
    ? [Paragraphs.wordsIn(tune.value.paragraph), Paragraphs.wordsIn(tune.value.proposal)]
    : undefined,
);

const read = (): Promise<FileContent> =>
  $fetch<FileContent>(`${base.value}/source`).catch((): FileContent => ({ path: slug, reason: "missing" }));

const clock = (): string => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

async function write(text: string): Promise<boolean> {
  const opened = disk.value;
  if (!opened || text === opened.text) return true;
  const reply = await $fetch<FileSave>(`${base.value}/source`, {
    body: { base: opened.hash, text },
    method: "PUT",
  }).catch(() => undefined);
  if (!reply) {
    chrome.toast("The save never reached the sidecar", "destructive");
    return false;
  }
  if (!reply.saved) {
    isStale.value = reply.reason === "changed-on-disk";
    chrome.toast(
      isStale.value ? "The file changed on disk since you opened it. Discard to load it again." : "The save failed",
      "destructive",
    );
    return false;
  }
  disk.value = { hash: reply.hash, text };
  isStale.value = false;
  emit("saved", clock());
  return true;
}

// The text is taken now, since an unmount disposes the model before the queued write runs.
function save(): Promise<boolean> {
  const model = editor?.getModel();
  if (!model) return saving;
  const text = model.getValue();
  saving = saving.then(() => write(text));
  return saving;
}

const autosave = useDebounceFn(() => {
  if (tune.value?.phase !== "proposed") void save();
}, SAVE_MS);

async function discard(): Promise<void> {
  const got = await read();
  if (!("text" in got)) return;
  disk.value = { hash: got.hash, text: got.text };
  editor?.getModel()?.setValue(got.text);
  isStale.value = false;
}

function rangeOf(first: number, last: number): MonacoApi.Range | undefined {
  const model = editor?.getModel();
  return api && model ? new api.Range(first, 1, last, model.getLineMaxColumn(last)) : undefined;
}

function mark(className?: string): void {
  const held = tune.value;
  const range = held && rangeOf(held.first, held.last);
  marks?.set(className && range ? [{ options: { inlineClassName: className }, range }] : []);
}

function closeTune(): void {
  asking?.abort();
  zones?.remove(ZONE);
  zones?.light([]);
  marks?.clear();
  editor?.updateOptions({ readOnly: false });
  tune.value = undefined;
  pending.value = undefined;
  editor?.focus();
}

function openTune(): void {
  if (tune.value) return handle.value?.focus();
  const model = editor?.getModel();
  const at = editor?.getSelection();
  if (!model || !at) return;
  const lines = model.getLinesContent();
  const touched = Paragraphs.touched({ lines, from: at.startLineNumber, to: at.endLineNumber });
  const [first] = touched;
  const last = touched.at(-1);
  if (!first || !last) {
    chrome.toast("Put the cursor in a paragraph to tune it");
    return;
  }
  if (first.text.startsWith("<!--")) {
    chrome.toast("That is the stamp or the comments, not a paragraph");
    return;
  }
  const from = Paragraphs.sectionOf(lines, first.first);
  const to = Paragraphs.sectionOf(lines, last.first);
  tune.value = {
    phase: touched.length > 1 ? "split" : "typed",
    first: first.first,
    last: last.last,
    paragraph: first.text,
    selection: model.getValueInRange(at) || first.text,
    scope: from ?? "this",
    sections: from && to && from !== to ? [from, to] : ["one paragraph", "the next"],
    instruction: "",
  };
  zones?.place(ZONE, last.last, zone);
  zones?.light([{ isPointed: false, lines: [first.first, last.last] }]);
}

async function runTune(): Promise<void> {
  const held = tune.value;
  if (!held || held.phase !== "typed" || !held.instruction.trim()) return;
  held.phase = "tuning";
  mark("monaco-tune-dim");
  const back = (reason?: string): void => {
    if (reason) chrome.toast(reason, "destructive");
    if (tune.value !== held) return;
    held.phase = "typed";
    mark();
  };
  if (!(await save())) return back();
  const controller = new AbortController();
  asking = controller;
  const request = {
    context: held.paragraph,
    instruction: held.instruction,
    selection: held.selection,
    task: "tune",
  } satisfies FastModelRequest;
  const reply = await $fetch<FastModelReply>("/api/models/fast", {
    body: request,
    method: "POST",
    signal: controller.signal,
  }).catch((error: unknown) => {
    if (!controller.signal.aborted) back(failReason(error) ?? "The assistant could not tune that");
    return undefined;
  });
  if (tune.value !== held || held.phase !== "tuning" || !reply) return;
  if (reply.kind !== "edit") return back("The assistant answered instead of tuning");
  const proposal = reply.replacement.trim().replace(/\n\s*\n+/g, "\n");
  const applied = await $fetch<ArtifactEditReply>(`${base.value}/edit`, {
    body: { action: "apply", replacement: proposal, selection: held.paragraph },
    method: "POST",
  }).catch((error: unknown) => back(failReason(error) ?? "The tuned paragraph could not be placed"));
  if (!applied?.id) return;
  if (tune.value !== held || held.phase !== "tuning") {
    void $fetch(`${base.value}/edit`, { body: { action: "revert", id: applied.id }, method: "POST" });
    return;
  }
  const got = await read();
  if ("text" in got) {
    disk.value = { hash: got.hash, text: got.text };
    pending.value = got.text;
  }
  Object.assign(held, { id: applied.id, phase: "proposed", proposal });
  editor?.updateOptions({ readOnly: true });
  mark("monaco-tune-old");
}

function stopTune(): void {
  asking?.abort();
  if (tune.value?.phase !== "tuning") return;
  tune.value.phase = "typed";
  mark();
}

async function settle(action: "accept" | "revert"): Promise<void> {
  const held = tune.value;
  if (!held?.id) return closeTune();
  const ok = await $fetch(`${base.value}/edit`, { body: { action, id: held.id }, method: "POST" })
    .then(() => true)
    .catch((error: unknown) => {
      chrome.toast(failReason(error) ?? "That change could not be settled", "destructive");
      return false;
    });
  if (!ok) return;
  const got = await read();
  editor?.updateOptions({ readOnly: false });
  const range = rangeOf(held.first, held.last);
  if (action === "accept" && range && held.proposal) editor?.executeEdits("tune", [{ range, text: held.proposal }]);
  if ("text" in got) {
    disk.value = { hash: got.hash, text: got.text };
    const model = editor?.getModel();
    if (model && model.getValue() !== got.text) model.setValue(got.text);
  }
  closeTune();
}

function insertImage(link: string): void {
  const model = editor?.getModel();
  const at = editor?.getSelection();
  if (!api || !model || !at) return;
  const line = model.getLineContent(at.startLineNumber);
  const isMid = at.startColumn > 1;
  const above = at.startLineNumber > 1 && !!model.getLineContent(at.startLineNumber - 1).trim();
  const below = !!line.slice(at.endColumn - 1).trim();
  const before = isMid ? "\n\n" : above ? "\n" : "";
  editor?.executeEdits("paste", [
    { forceMoveMarkers: true, range: at, text: `${before}![${PASTED}](${link})${below ? "\n\n" : "\n"}` },
  ]);
  const row = at.startLineNumber + before.length;
  const column = (before ? 1 : at.startColumn) + 2;
  editor?.setSelection(new api.Range(row, column, row, column + PASTED.length));
}

async function paste(event: ClipboardEvent): Promise<void> {
  const images = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith("image/"));
  if (!images.length || tune.value?.phase === "proposed") return;
  event.preventDefault();
  event.stopPropagation();
  for (const image of images) {
    const got = await $fetch<ArtifactUpload>(`${base.value}/uploads`, {
      body: image,
      headers: { "content-type": image.type },
      method: "POST",
    }).catch((error: unknown) => {
      chrome.toast(failReason(error) ?? "The image did not upload", "destructive");
      return undefined;
    });
    if (got) insertImage(got.link);
  }
}

async function finish(): Promise<boolean> {
  if (tune.value && tune.value.phase !== "proposed") closeTune();
  return save();
}

useResizeObserver(zone, ([entry]) => zones?.fit(ZONE, Math.ceil(entry?.borderBoxSize[0]?.blockSize ?? 0)));

useEventListener(window, "beforeunload", (event: BeforeUnloadEvent) => {
  if (editor?.getModel()?.getValue() !== disk.value?.text) event.preventDefault();
});

watch(
  () => task.tuneAsks,
  () => openTune(),
);

onMounted(async () => {
  api = await Monaco.load();
  if (!host.value) return;
  editor = api.editor.create(host.value, {
    automaticLayout: true,
    fixedOverflowWidgets: true,
    fontFamily: getComputedStyle(document.documentElement).getPropertyValue("--mono").trim() || undefined,
    fontSize: 13,
    lineNumbersMinChars: 3,
    minimap: { enabled: false },
    quickSuggestions: false,
    scrollBeyondLastLine: false,
    theme: OneDarkVivid.name,
    wordBasedSuggestions: "off",
    wordWrap: "on",
  });
  zones = SideZones.attach({ api, editor });
  marks = editor.createDecorationsCollection();
  // Registered after Monaco's own ⌘K chords, so it wins the first key, as the Files editor's note does.
  editor.addAction({
    contextMenuGroupId: "navigation",
    contextMenuOrder: 0,
    id: "sidecar.tune",
    keybindings: [api.KeyMod.CtrlCmd | api.KeyCode.KeyK],
    label: "Tune with the assistant",
    run: openTune,
  });
  editor.addCommand(api.KeyMod.CtrlCmd | api.KeyCode.KeyS, () => void save());
  editor.onDidChangeModelContent(() => {
    draft.value = editor?.getModel()?.getValue() ?? "";
    autosave();
  });
  host.value.addEventListener("paste", (event) => void paste(event), { capture: true });
  const got = await read();
  if (!("text" in got)) {
    unread.value = "The task's markdown could not be read.";
    return;
  }
  disk.value = { hash: got.hash, text: got.text };
  editor.setModel(api.editor.createModel(got.text, "markdown"));
  editor.focus();
});

onBeforeUnmount(() => {
  asking?.abort();
  if (editor?.getModel()?.getValue() !== disk.value?.text) void save();
  zones?.dispose();
  editor?.getModel()?.dispose();
  editor?.dispose();
});

defineExpose({ finish });
</script>

<template>
  <div class="editor" data-region="task-editor" :style="OneDarkVivid.cssVars">
    <div class="code">
      <div v-if="isStale" class="stale editor-tokens">
        <span class="mono-meta">changed on disk</span>
        <UiButton size="xs" variant="ghost" @click="discard">Discard</UiButton>
      </div>
      <div ref="host" class="host" data-region="task-markdown" />
      <UiStateMessage v-if="unread" align="center" class="unread editor-tokens" kind="error">{{
        unread
      }}</UiStateMessage>
    </div>
    <TaskPreview :slug="slug" :text="pending ?? draft" />
    <Teleport v-if="tune" :to="zone">
      <div class="editor-tokens">
        <TaskTune
          ref="handle"
          v-model="tune.instruction"
          :phase="tune.phase"
          :proposal="tune.proposal"
          :scope="tune.scope"
          :sections="tune.sections"
          :words="words"
          @cancel="tune.phase === 'proposed' ? settle('revert') : closeTune()"
          @discard="settle('revert')"
          @keep="settle('accept')"
          @stop="stopTune"
          @tune="runTune"
        />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.editor {
  @apply grid min-h-0 flex-1 grid-cols-2;
}

.code {
  @apply flex min-h-0 min-w-0 flex-col bg-ed-bg text-ed-ink;
}

.stale {
  @apply flex flex-none items-center justify-between gap-2 border-b border-b-ed-border bg-ed-bar px-3 py-1.5 text-ed-warn;
}

.host {
  @apply min-h-0 flex-1;
}

.unread {
  @apply flex-1 p-4;
}
</style>
